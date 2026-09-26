/*
 * End-to-end test of the test app in headless Chromium with a simulated
 * receiver (fake Web Serial port) that behaves like the firmware: answers
 * commands and streams telemetry from a simulated hand whose sensor is
 * mounted at an arbitrary angle.
 *
 *   cd controller/test-app/tests && npm install playwright && node app.test.js
 */
const path = require("path");
const { chromium } = require("playwright");

const APP = "file://" + path.resolve(__dirname, "..", "index.html");

/* Runs inside the page before the app: a fake navigator.serial. */
function installMockSerial() {
  const enc = new TextEncoder(), dec = new TextDecoder();
  // Sensor mounted with an arbitrary rotation R (world = R * sensor).
  function rotZYX(a, b, c) {
    const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)];
    return [
      [ca * cb, ca * sb * sc - sa * cc, ca * sb * cc + sa * sc],
      [sa * cb, sa * sb * sc + ca * cc, sa * sb * cc - ca * sc],
      [-sb, cb * sc, cb * cc],
    ];
  }
  const R = rotZYX(0.7, -0.4, 1.9);
  const toSensor = (v) => [0, 1, 2].map((j) => R[0][j] * v[0] + R[1][j] * v[1] + R[2][j] * v[2]); // R^T v

  const mock = {
    R, toSensor,
    commands: [],
    worldRate: [0, 0, 0],     // deg/s, world frame (x fwd, y left, z up)
    still: true,
    cfg: {
      gain: [25], accel: [2], knee: [80], mincutoff: [1], beta: [1], speedcutoff: [30],
      deadzone: [0.15], predict: [0], still: [1.5], tilt: [1], autobias: [1],
      right: [0, 0, -1], up: [0, -1, 0], fwd: [1, 0, 0],
    },
    listening: false,
  };
  window.__mock = mock;

  let controller = null;
  const out = (line) => { if (controller && mock.listening) controller.enqueue(enc.encode(line + "\n")); };

  function handle(cmd) {
    mock.commands.push(cmd);
    const f = cmd.split(",");
    switch (f[0]) {
      case "ver": out("I,ver,receiver,1"); out("OK,ver"); break;
      case "get":
        for (const k in mock.cfg) out("C," + k + "," + mock.cfg[k].join(","));
        out("OK,get"); break;
      case "set":
        mock.cfg[f[1]] = f.slice(2).map(Number);
        out("C," + f[1] + "," + mock.cfg[f[1]].join(","));
        out("OK,set," + f[1]); break;
      case "rings": out("I,ring,1a2b3c4d,active,moving,rssi,-42,fw,1,lost,0,of,100"); out("OK,rings"); break;
      default: out("OK," + f[0]);
    }
  }

  let t0 = performance.now();
  setInterval(() => {
    const dt = 0.02;
    const w = toSensor(mock.worldRate);
    const ang = w.map((x) => x * dt);
    const acc = toSensor([0, 0, 1]);
    const speed = Math.hypot(...mock.worldRate);
    const fields = [
      "T", Math.round(performance.now() - t0), "1a2b3c4d", "R", 33, 33,
      ...ang.map((a) => Math.round(a * 1000)),
      Math.round(mock.worldRate[2] * -0.5), 0, Math.round(speed * 10), mock.still ? 1 : 0,
      120, -80, 40, ...acc.map((a) => Math.round(a * 1000)), ...acc.map((a) => Math.round(a * 1000)),
      150, 20, 33, 0, -42, 0, 0,
    ];
    out(fields.join(","));
  }, 20);

  class MockPort {
    constructor() {
      this.readable = new ReadableStream({ start: (c) => { controller = c; } });
      let buf = "";
      this.writable = new WritableStream({
        write: (chunk) => {
          buf += dec.decode(chunk);
          let i;
          while ((i = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
        },
      });
    }
    async open() {}
    async setSignals(s) { mock.listening = !!s.dataTerminalReady; }
    async close() { mock.listening = false; }
  }
  const target = new EventTarget();
  Object.defineProperty(navigator, "serial", {
    value: {
      requestPort: async () => new MockPort(),
      addEventListener: target.addEventListener.bind(target),
    },
  });
}

let failures = 0;
function check(cond, msg) {
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript(installMockSerial);
  await page.goto(APP);

  console.log("connect");
  await page.click("#btnConnect");
  await sleep(600);
  check((await page.textContent("#connPill")) === "Connected", "shows Connected");
  check((await page.textContent("#devInfo")).includes("Receiver, firmware v1"), "device info shown");
  check((await page.inputValue("#sliders input >> nth=0")) === "25", "gain slider synced from device");

  console.log("live status");
  await sleep(1300);
  const rate = Number(await page.textContent("#sRate"));
  check(rate > 1300 && rate < 2000, "packets/s shown: " + rate);
  check((await page.textContent("#sState")) === "active", "state active");

  console.log("calibration (sensor mounted at a random angle)");
  await page.click('#tabs button[data-tab="calibrate"]');
  await page.click("#calRest");
  await sleep(3800);
  check((await page.textContent("#calRestMsg")).startsWith("Done"), "step 1: " + await page.textContent("#calRestMsg"));

  await page.click("#calPose");
  await sleep(1800);
  check((await page.textContent("#calPoseMsg")) === "Got it.", "step 2: " + await page.textContent("#calPoseMsg"));

  // Step 3: turn right (rotation about world -up), then come back halfway.
  await page.click("#calRight");
  await page.evaluate(() => { __mock.worldRate = [0, 0, -60]; __mock.still = false; });
  await sleep(1400);
  await page.evaluate(() => { __mock.worldRate = [0, 0, 60]; });
  await sleep(600);
  await page.evaluate(() => { __mock.worldRate = [0, 0, 0]; });
  await sleep(1300);
  check((await page.textContent("#calRightMsg")).startsWith("Measured"), "step 3: " + await page.textContent("#calRightMsg"));

  // Step 4: tip up = rotation about world right axis (0,-1,0).
  await page.click("#calUp");
  await page.evaluate(() => { __mock.worldRate = [0, -50, 0]; });
  await sleep(1500);
  await page.evaluate(() => { __mock.worldRate = [0, 0, 0]; });
  await sleep(1800);
  const upMsg = await page.textContent("#calUpMsg");
  check(upMsg.startsWith("Done"), "step 4: " + upMsg);

  const res = await page.evaluate(() => {
    const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const m = __mock;
    return {
      right: d(m.cfg.right, m.toSensor([0, 0, -1])),
      up: d(m.cfg.up, m.toSensor([0, -1, 0])),
      fwd: d(m.cfg.fwd, m.toSensor([1, 0, 0])),
      cursorBack: m.commands.lastIndexOf("cursor,1") > m.commands.lastIndexOf("cursor,0"),
    };
  });
  check(res.right > 0.99, "right axis matches the true sensor axis (cos " + res.right.toFixed(4) + ")");
  check(res.up > 0.99, "up axis matches (cos " + res.up.toFixed(4) + ")");
  check(res.fwd > 0.99, "forward axis matches (cos " + res.fwd.toFixed(4) + ")");
  check(res.cursorBack, "cursor re-enabled after calibration");
  await page.click("#calSave");
  await sleep(200);
  check(await page.evaluate(() => __mock.commands.includes("save")), "save sent");

  console.log("tuning");
  await page.click('#tabs button[data-tab="tune"]');
  await page.click('[data-preset="raw"]');
  await sleep(300);
  check(await page.evaluate(() => __mock.commands.includes("set,mincutoff,1000")), "raw preset sent");
  const lagTxt = await page.textContent("#lagEstimate");
  check(lagTxt.includes("<0.5 ms at slow"), "lag estimate uses device value: " + lagTxt.slice(0, 60));
  await page.fill("#sliders input >> nth=0", "40");
  await page.dispatchEvent("#sliders input >> nth=0", "input");
  await sleep(400);
  check(await page.evaluate(() => __mock.commands.includes("set,gain,40")), "slider sends set,gain,40");

  console.log("lag flash test");
  await page.click('#tabs button[data-tab="tests"]');
  await page.click('[data-test="lag"]');
  const box = await page.locator("#flash").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 5; i++) { await page.mouse.move(cx + (i % 2), cy); await sleep(100); } // tiny wobble
  check((await page.textContent("#flashCount")) === "0", "tiny wobble does not flash");
  await sleep(500);
  await page.mouse.move(cx + 30, cy + 5, { steps: 3 });
  await sleep(50);
  check((await page.textContent("#flashCount")) === "1", "flick flashes");
  await page.fill("#frames", "5, 6, 5, 4, 6");
  await page.click("#btnLagSave");
  check((await page.textContent("#lagMsg")).includes("lag avg 21.7 ms"), "lag computed: " + await page.textContent("#lagMsg"));

  console.log("pointing test");
  await page.click('[data-test="fitts"]');
  await page.click("#btnFitts");
  const canvas = await page.locator("#fittsCanvas").boundingBox();
  let guard = 0;
  while (await page.evaluate(() => fitts.running) && guard++ < 200) {
    const t = await page.evaluate(() => {
      const c = document.getElementById("fittsCanvas");
      const r = c.getBoundingClientRect();
      return fittsTarget(FITTS_CONDITIONS[fitts.cond], fitts.seq[fitts.k], r.width, c.clientHeight);
    });
    const jitter = () => (Math.random() - 0.5) * 6;
    await page.mouse.move(canvas.x + t[0] + jitter(), canvas.y + t[1] + jitter(), { steps: 4 });
    await sleep(30);
    await page.keyboard.press("Space");
  }
  const fittsMsg = await page.textContent("#fittsMsg");
  check(fittsMsg.startsWith("Done: throughput"), "pointing test finished: " + fittsMsg);
  check(guard === 4 * 14, "exactly 4 rounds of 14 selections (" + guard + ")");
  check(/misses 0 %/.test(fittsMsg), "accurate selections scored as hits");

  console.log("timeline & knobs test");
  await page.click('[data-test="daw"]');
  await page.click("#btnDaw");
  const dc = await page.locator("#dawCanvas").boundingBox();
  guard = 0;
  while (await page.evaluate(() => daw.running) && guard++ < 50) {
    const t = await page.evaluate(() => {
      const r = document.getElementById("dawCanvas").getBoundingClientRect();
      const L = dawLayout(r.width);
      return daw.target.kind === "beat" ? [L.tlX + daw.target.i * BEAT_W + BEAT_W / 2, L.tlY + 30] : L.knobs[daw.target.i];
    });
    await page.mouse.move(dc.x + t[0], dc.y + t[1], { steps: 3 });
    await sleep(20);
    await page.keyboard.press("Space");
  }
  const dawMsg = await page.textContent("#dawMsg");
  check(dawMsg.includes("24/24 hit"), "timeline test: " + dawMsg);

  console.log("results");
  await page.click('#tabs button[data-tab="results"]');
  const rows = await page.locator("#resultsTable tr").count();
  check(rows === 4, "3 results + header rows (" + rows + ")");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnCsv")]);
  const csv = require("fs").readFileSync(await dl.path(), "utf8");
  check(csv.split("\n").length === 4 && csv.includes("throughput_bps"), "CSV export");

  console.log("disconnect / reconnect");
  await page.click('#tabs button[data-tab="connect"]');
  await page.click("#btnDisconnect");
  await sleep(300);
  check((await page.textContent("#connPill")) === "Not connected", "disconnected");
  await page.click("#btnConnect");
  await sleep(500);
  check((await page.textContent("#connPill")) === "Connected", "reconnected");

  check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
})();
