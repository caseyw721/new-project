# "Now" — a task manager for capable, over-committed, disorganized brains

*Product plan, v1. Working name: **Now** (the name of the main screen). Written to be read on a
phone in one sitting. Decisions you still need to make are at the very end.*

## Short version

- **One habit, one screen.** You capture thoughts in under three seconds. The app sorts them.
  A single screen called **Now** shows one to three things to do next. That's the product.
- **Three words to learn: Inbox, Now, Shelf.** Nothing else is required. No priorities, no
  tags, no due-date colouring, no "overdue".
- **It never punishes.** Missed things roll forward silently. There is a "fresh start" button.
  The word "overdue" does not appear anywhere in the app.
- **Rules, not AI.** Every pick the app makes can be explained in one sentence, and nothing
  leaves your phone. (Your call; it also makes the app faster and cheaper to build.)
- **Ambition has a home.** Ideas and half-started projects sit on the Shelf, with a five-minute
  monthly "still excited?" review, so they stop clogging today.
- **Built for iOS and Android at once** (Flutter), offline, local data, backup file. Sync is
  v1.1.
- **MVP is small:** capture, Inbox sort, Now, Shelf, done list, one widget, read-only calendar.
  Everything else waits until the core loop survives two months with real users (habits take
  ~66 days on average to become automatic; the drop-off is steepest in week one, not week three).

---

## 1. Who and why

### Persona 1 — Casey, founder with fourteen half-started projects
Runs a business, builds hardware on the side, has a music project, and gets three new ideas a
week that are genuinely good. Nothing is short of ability. Every to-do app became a museum of
good intentions: 300 open tasks, 80 "overdue", closed the app in disgust after a month. Paper
works for a day and gets lost. **Job to do:** *every morning, tell me the one to three things
that actually move something forward, and keep the other 297 out of my face without losing
them.*

### Persona 2 — Sam, student / creative with ADHD
Deadlines, shifts, a portfolio, a life. Hyperfocuses for nine hours on the wrong thing, then
finds out the essay was due yesterday. Reminders app pings at 9:00 with twelve items and gets
swiped away. **Job to do:** *make time visible and make starting easy: show me how far away
things really are and give me a concrete first step I can do in ten minutes.*

### Persona 3 — Jordan, "fine at work, chaos at home"
Has a work system (Jira, a manager, meetings). At home: unrenewed passport, a garage project,
a course they paid for, birthday presents forgotten. Tried Things, loved it for two weeks, then
stopped opening it because opening it felt bad. **Job to do:** *hold my personal life so I can
stop feeling like I'm failing at it, with two minutes a day, not twenty.*

### What they tried and why it failed (your answers: Todoist / Things / TickTick, paper,
Reminders, nothing)

| Tried | Why it failed this audience |
|---|---|
| Todoist / Things / TickTick | Lists only grow. Every item looks equally important. Priorities (P1–P4) are set once and mean nothing a week later. Overdue counts in red teach you the app is a place where you fail. Projects need you to break them down yourself, which is the exact skill that's missing. |
| Paper | Excellent capture, zero memory. Yesterday's page is gone, so is the plan. No countdown, no rollover. |
| Reminders (built-in) | Capture is fine. Then it nags with no plan: twelve notifications at 9:00, all equal, no "which first", no sense of how long anything takes. |
| Nothing | Works while everything is interesting. Fails the first time something boring and important arrives. |

The common thread: **all of them make the user do the sorting, planning and choosing, and all
of them display failure.** This product does the sorting and choosing, and never displays
failure.

---

## 2. The core loop

```
  ┌──────────┐    ┌──────────────┐    ┌─────────┐    ┌──────────┐
  │ Capture  │ →  │ App sorts it │ →  │   Now   │ →  │ Do one   │ → tap Done → back to Now
  │ (3 sec)  │    │ (rules)      │    │ 1–3 picks│    │ thing    │
  └──────────┘    └──────────────┘    └─────────┘    └──────────┘
        ↑                                                     │
        └──────────── evening: "done today" list ─────────────┘
```

**The one habit:** capture when a thought arrives; look at Now when you have a moment. Two
taps a day is enough: one to capture, one to finish.

**On a bad day (nothing captured, nothing done):** nothing happens. No streak breaks. No
notification says "you missed 6 tasks". Tomorrow's Now is built from the same pool, and the
item you avoided longest moves *up*, quietly. If the Inbox gets big (> 30), the app offers a
five-minute triage — never demands one.

**On a terrible month:** the **Fresh start** button (Settings → Fresh start) moves everything
older than a chosen date into an archive on the Shelf. Nothing is deleted. The Now screen is
clean the next morning. Using it is not a failure; it's a feature people should use.

---

## 3. Concepts and vocabulary

Three nouns, each explained in the onboarding with the exact sentence below.

| Noun | Onboarding sentence |
|---|---|
| **Inbox** | "Anything you type, say or share lands here. You don't have to sort it; the app will." |
| **Now** | "The one to three things worth doing next. Tap one to start it, swipe it away if not now." |
| **Shelf** | "Everything else — projects, ideas, someday — kept safe and out of your way." |

Two verbs: **Done** (swipe right) and **Not now** (swipe left). One question the app asks you,
once a day at most: "Energy right now?" — low / okay / high — and it's skippable.

**Nouns we refuse to add, and why:**

| Refused | Why |
|---|---|
| Priorities (P1–P4, stars, flags) | Set once, never updated, then everything is P1. The Now engine ranks; the user doesn't. |
| Tags, labels, contexts, areas | Taxonomy work is the thing this audience can't sustain. A search box does the same job. |
| Due dates on everything | Only real deadlines get a date. Wishes with dates become "overdue" wishes. |
| Overdue | The concept doesn't exist. A dated item that passes its date becomes "past its date" on the Shelf, shown once, calmly. |
| Subtasks three levels deep | A project has a flat list of steps; one is the **next step**. That's all initiation needs. |
| Perspectives / custom views / filters | Configuration is procrastination with a good excuse. |
| Recurring-task rule builder | Only simple repeats (daily, weekly, monthly, "every N days"). |
| Points, levels, XP | Gamification wears off in exactly the week-three window we're fighting. |

---

## 4. The Now engine (rules, no AI)

Runs every time the Now screen opens, in under 50 ms, on the phone. Picks up to three items.
Every pick shows a one-line reason ("due Friday, ~20 min, you have 45 min free").

**Inputs it uses**

1. Real deadlines and how many *workdays* away they are (not calendar days).
2. The item's duration estimate (default 15 min; the user taps 5 / 15 / 30 / 60 / "half a day").
3. Free time until the next calendar event (read-only calendar access, optional).
4. Today's energy check-in, if given (low → short/easy items first).
5. How long an item has been avoided (each "not now" swipe counts).
6. Whether it's the **next step** of a project the user marked as *committed this week*.
7. Time of day (morning: the hard thing first; evening: small wins).

**Rules, in order**

1. **Hard deadline within 2 workdays** → always pick 1, no matter what. Max one of these per
   screen unless two are genuinely due today.
2. **Fits the gap.** Never suggest a 60-minute item when there are 20 minutes before the next
   meeting.
3. **Energy match.** Low energy → items marked "easy" or under 15 min; high energy → the
   longest-avoided hard item goes to slot 1.
4. **One from a committed project.** If the user committed to a project this week and none of
   its steps are in Now, its next step takes slot 2.
5. **The avoided thing.** Slot 3 is the item with the most "not now" swipes, *if* it's under 30
   minutes. Longer avoided items are instead offered as a "just 10 minutes on this?" pick.
6. **Variety.** No two picks from the same project unless both are deadline-driven.
7. **Slack.** The engine never fills more than about 60% of the visible free time. The screen
   says "and that's enough for today" underneath.

**Cue reminders:** an item with a "when" cue is reminded at that cue and at no other time —
the cue is where the action happens (lock screen, at that moment), not a 9:00 list of twelve.

**Overrides:** swipe left = "not now" (item drops for 4 hours, avoidance count +1). Long-press
= "pin to Now" (stays until done). "Surprise me" (shake, or a button) swaps the third slot for a
random short item from the Shelf — novelty on demand.

**What it learns without asking:** the actual time between "start" and "done" per item,
compared to the estimate, per duration bucket. After ten items, the estimates the user picks
are silently corrected ("your 15-minute tasks take about 25"). That's the whole learning
model. It is a lookup table, and it lives on the phone.

**Where AI would have helped, and what we do instead:** auto-sorting messy captures ("call
dentist re: crown, before the 14th") into title, date and project. Instead: rule-based date
parsing ("before the 14th", "Friday", "next week", "in 3 days"), a "?" anywhere in the text =
idea → Shelf, and "#project name" if the user wants. Everything else stays as typed.

---

## 5. Mobile UI plan

Design rules for every screen: primary action in the bottom third (thumb zone). One primary
action per screen. Text ≥ 17 pt by default, scales with system settings. Nothing important is
conveyed by colour alone. Reduced-motion respected. Plain sans-serif type with generous line
and letter spacing, left-aligned, off-white background — the things that measurably help
dyslexic readers (special "dyslexia fonts" don't, in eye-tracking studies, so we don't ship
one as a cure; a spacing slider is the honest version). Undo on every destructive action. Full
VoiceOver / TalkBack labels.

### 5.1 Now (home)

```
 ┌────────────────────────────────┐
 │  Tuesday · 2h 10m free         │  ← free time until next calendar event
 │  Energy: [low] [ok] [high]     │  ← one tap, optional, disappears after
 │                                │
 │  ┌──────────────────────────┐  │
 │  │ Send Marta the invoice   │  │  ← slot 1, biggest card
 │  │ due Thu · ~15 min        │  │     reason line under title
 │  └──────────────────────────┘  │
 │  ┌──────────────────────────┐  │
 │  │ Ring: solder battery     │  │  ← slot 2 (committed project step)
 │  │ next step · ~30 min      │  │
 │  └──────────────────────────┘  │
 │  ┌──────────────────────────┐  │
 │  │ Renew passport: book slot│  │  ← slot 3 (avoided ×4, ~10 min)
 │  │ you've skipped this 4×   │  │     said gently, never in red
 │  └──────────────────────────┘  │
 │      and that's enough today   │
 │                                │
 │  ✓ Done today (3)        Shelf │  ← small links
 │        [ + Capture ]           │  ← big thumb button
 └────────────────────────────────┘
```

Gestures: swipe right = Done (card flies off, small confetti, next card slides up). Swipe left
= Not now. Tap = Start (starts a timer drawn as a shrinking disc — time you can *see*, not a
number — and the card expands with the item's note). Long-press =
Break it down / Pin. Pull down = "Where was I?" (last started item and its note).

*Not on this screen:* counts of anything, dates of anything not in Now, badges, the Inbox.

### 5.2 Capture

Big text box, keyboard already up, cursor in it. Mic button. Typing "?" anywhere marks an idea.
Return = saved, box clears, stays open for the next one. Optional row of chips under the box:
*today · this week · has a deadline · idea · when…* — one tap, never required. "When…" takes
a cue ("after lunch", "when I get home", "Tue 9am") and the reminder fires on that cue: an
"if-then" plan, the single best-evidenced trick for getting a task started. From outside the app:
home-screen widget (one tap → capture), lock-screen widget (iOS), share sheet (a link or text
becomes an Inbox item with the source attached), Siri / Google Assistant "add to Now".

*Not on this screen:* project picker, date picker, priority, anything with a dropdown.

### 5.3 Inbox triage

A stack of cards, one at a time. Each card: the text, and four thumb-sized buttons — **Now
(today)** · **Shelf** · **Deadline…** (one tap opens a calendar, second tap sets it) · **Bin**.
Swipe up = "make it a project" (asks for one thing: the first step). Whole Inbox of 20 items
takes about a minute. The app suggests triage when the Inbox passes 30 or every Sunday
evening, in one calm notification, not a badge.

### 5.4 Project

Title, a one-line "why" the user wrote, a flat list of steps with the **next step** on top and
highlighted, a progress bar (done steps / all steps), and the state chip: *committed this week
/ incubating / released*. Adding a project asks exactly one question: "What's the very first
physical thing to do?" A project with no next step shows one calm line: "Needs a next step" —
that's the only nag in the app.

### 5.5 Shelf

Three sections, collapsed by default: **Committed** (max 3 projects — a fourth prompts "which
one goes to incubating?"), **Incubating** (projects and ideas the user is keeping warm),
**Released** (let go, kept forever, searchable). Ideas are single lines; they can become projects
with one swipe. Past-their-date items from the Now pool also show here, once, under
"Slipped" — with two buttons: *new date* or *release*.

### 5.6 Weekly review (Sunday, 5 minutes, optional)

Three cards in a row: "Done this week" (celebrate first), "Slipped" (re-date or release),
"Committed next week?" (pick up to 3 projects). Then done. No stats page.

### 5.7 Monthly "still excited?" (5 minutes, optional)

Every incubating project/idea, one card at a time: **Still excited** / **Not now** / **Release**.
That's the ambition-management feature in its entirety.

---

## 6. Motivation without manipulation

What the app does:
- **Done today** is always one tap away and is the first thing shown in the weekly review.
  Finishing is made visible; not-finishing is not.
- **Forgiving streaks:** "days you did at least one thing" with a free pass twice a week. A
  streak is never shown as broken, it's shown as "resumed".
- **Progress bars on projects**, because visible partial progress starts the next step.
- **"Surprise me"** — a random short item from the Shelf, for the days when nothing planned
  appeals. Novelty as a tool.
- **Focus timer with re-entry note:** starting an item starts a timer; stopping asks for a
  one-line "where I left off" note that shows next time. This is the body-double-lite.
- **Body doubling (v1.1):** a shared timer with one friend, both see "working on: …", no chat.
  Evidence for it is thin (surveys, small studies with mixed results), coaches swear by it; so
  it stays optional and low-pressure — presence, not policing.

What the app will never do:
- Guilt notifications ("you have 12 overdue tasks").
- Fake urgency (countdown to nothing, red anything).
- Badge counts on the app icon (off by default; on = Inbox only, capped at "9+").
- Daily-active-user bait (streak-loss warnings, "come back!" pushes).
- Sell, share or upload the data.

---

## 7. Time and energy

- **Duration on every item**, chosen by tap (5 / 15 / 30 / 60 / half-day), default 15.
- **Reality check:** when an item is marked done after being started, one tap: "about right /
  longer / shorter". After ten answers, the app adjusts new estimates in that bucket and shows
  the true number in the reason line.
- **Free time** = now → next calendar event (read-only calendar; optional; without it the app
  assumes 90-minute blocks).
- **Workdays, not days:** deadlines are shown as "3 workdays" and "Fri", never "in 5 days" when
  a weekend is in between. Items due within 2 workdays show a small shrinking bar — a shape, not just a number, because
time perception is one of the most replicated ADHD deficits and shapes are read faster than
digits.
- **Energy check-in:** one tap, optional, expires in 4 hours.
- **Hyperfocus guard (off by default):** after 90 minutes on one started item, one notification:
  "90 min on this. Water? Stretch?" Snooze or off.
- **The plan never over-fills:** at most ~60% of visible free time. If the user pins more, the
  screen says so ("this is more than fits — that's okay, do it in order").

---

## 8. Ambition management

Projects and ideas have three states: **committed** (max 3 at a time — the cap is the
feature), **incubating**, **released**. New projects start incubating unless there's a deadline.
Moving to committed requires a next step. The monthly review (5.7) keeps the incubating list
honest. Released is not deleted: "I let this go on purpose" is a decision worth keeping, and
things come back.

Opportunities (a job lead, a collaboration, an event) are ideas with a date; they go to the Shelf
with a "decide by" date and surface in Now once, on that day, as a single decision card.

---

## 9. Data model

| Entity | Fields | Notes |
|---|---|---|
| Item | id, text, note, kind (task / idea / step), state (inbox / now-pool / done / released), deadline?, duration bucket, estimate-adjusted?, project id?, created, started at?, done at?, not-now count, pinned, repeat rule?, source (typed / voice / share URL) | The only unit of work. |
| Project | id, title, why, state (committed / incubating / released), next-step item id, created, committed-on? | Flat list of step Items. |
| Session | item id, started, stopped, note | Feeds estimates and "where was I?". |
| EstimateStats | bucket → (count, mean actual minutes) | Five rows. The whole "learning". |
| Settings | energy today (+ expiry), calendar on?, font, motion, hyperfocus guard, badge | Local. |

All local (SQLite). Backup = one encrypted file to iCloud Drive / Google Drive / Files, manual
or nightly. Nothing is read by anything outside the app. Sync between your own devices is v1.1
(same file format, last-writer-wins per item, which is fine for one person).

---

## 10. Onboarding (the first five minutes)

1. Open app. No account. One screen: "Type anything you need to do or remember." Keyboard is up.
2. They type one thing. "Got it. That's the Inbox — you never have to sort it right away."
3. "Does it have a real deadline?" — *no / pick a date*. "Roughly how long?" — 5 / 15 / 30 / 60.
4. Now screen appears with that one item and the sentence "This is Now. One to three things.
   Swipe right when done, left for not now."
5. "Want capture on your home screen?" → adds the widget (OS prompt). Skip is fine.
6. Optional, last: "Let me see your calendar so I know how much time you have?" Skip is fine.

End state: one captured item, one Now pick, widget installed. Total taps: about eight.

---

## 11. MVP scope

**MVP — works for Casey for two weeks (fits on one screen). All of it is in the free tier:**
- Capture (in-app, home-screen widget, share sheet, mic via OS dictation)
- Inbox card triage (Now / Shelf / Deadline / Bin, swipe-up = project)
- Now engine (rules 1–7), reason lines, swipe done / not now, pin, start timer + re-entry note
- Shelf with committed (cap 3) / incubating / released, "Slipped" section
- Projects with next step and progress bar
- Done today list; Fresh start
- Duration buckets + reality check + estimate adjustment
- Read-only calendar for free time (both OSes)
- Local SQLite, backup file export/import
- Accessibility: dynamic type, reduced motion, screen-reader labels, dyslexia font

**v1.1:** weekly and monthly review cards; "Surprise me"; forgiving streaks; lock-screen
widget (iOS) and Assistant/Siri shortcuts; own-device sync; hyperfocus guard; simple repeats.

**Later:** body doubling with a friend; opportunity "decide by" cards; import from
Todoist/Things; watch complication; tablet layout.

**Never:** priorities, tags, nested subtasks, custom views, XP/levels, team features, AI (until
you say otherwise), ads, data sale.

---

## 12. Success measures

| Measure | Target | Why this one |
|---|---|---|
| Day-7 / day-28 / day-60 retention (opened Now at least 3 days that week) | ≥ 55% / ≥ 30% / ≥ 20% | Decay is steepest in week one; a habit takes ~2 months. Typical apps keep 4–7% at day 30, so 30% would be exceptional. |
| Capture-to-done ratio over 30 days | ≥ 35% | Lists that only grow are the failure mode. |
| Items past their date, per user, at any time | median 0, p90 ≤ 3 | By design, not by nagging. |
| Fresh-start usage | exists; < 10% of users per month | If everyone needs it monthly, the engine is over-filling. |
| Median time spent in app per day | 2–5 min | Less is success. |
| Weekly one-question survey ("Did this help you finish something this week?") | ≥ 70% yes | The only question that matters. |

All measured on the phone; the user can see their own numbers and opts in to sending
aggregate counts (no content, ever).

---

## 13. Risks and open questions

- **The drop-off.** "Apps die in week three" is folk wisdom; the data say decay is steepest
  in the first days and a habit takes about 66 days (18–254) to become automatic, and one
  missed day doesn't derail it. Our bet: day one is trivial (one capture, one pick), the app
  asks for two taps a day, never shows failure, and a week of neglect costs nothing to recover
  from. This is the bet; it is not proven until real users pass day 60.
- **Rules feel dumb sometimes.** Without AI, sorting captures is only as good as the date
  parser, and the Now picks are only as good as seven rules. Mitigation: the reason line makes
  every pick legible, and "not now" fixes any bad pick in one swipe. If it turns out users want
  smarter sorting, an on-device model can be added later without changing the data model.
- **Calendar permission refusal.** Some users won't grant it. The engine works without it
  (assumes 90-minute blocks) but the "free time" line — one of the best time-blindness aids —
  disappears. Ask late (step 6), explain what it's for.
- **Two platforms at once** slows polish of the capture entry points, which is the feature. We
  keep a shared core and accept that the iOS lock-screen widget lands after Android's
  home-screen widget, or vice versa.
- **The cap of three committed projects** will annoy exactly the people it helps. Make the
  fourth-project prompt kind and make "incubating" feel like a shelf, not a bin.
- **Core-loop reliability.** Competitors lose this audience over timers that don't pause and
  tasks that lose their text. Every phase ends with a soak test of capture → Now → Done on
  both platforms before anything new starts.
- **Open:** does "energy check-in" get used, or ignored? Ship it optional, measure, cut it if
  < 20% use it after a month.

---

## 14. Technical outline (one page)

- **Framework: Flutter.** One codebase, native-feeling gestures and animation on both
  platforms, mature offline storage (Drift/SQLite). Native shims (small, per OS) for: home-screen
  widget, lock-screen widget (iOS 16+), share sheet / share target, calendar read (EventKit /
  CalendarContract), speech via the OS keyboard dictation (no speech API of our own).
  *Alternative in one line:* React Native + Expo works too; Flutter's rendering makes the card
  gestures easier to get smooth.
- **Storage:** SQLite on device. Schema = section 9. Backup = encrypted (device-key +
  passphrase) JSON file to the user's cloud drive; import restores.
- **No server in the MVP.** No accounts. Nothing to breach. Sync (v1.1) uses the same file
  format on the user's own cloud drive with per-item last-writer-wins.
- **Notifications:** local only. Maximum one per day by default (the Sunday review), plus the
  optional hyperfocus guard. Deadline reminders only for items with real deadlines: one, the
  workday before, at a time the user picks once.
- **Performance budgets:** capture screen visible < 300 ms from tap; Now engine < 50 ms; app
  launch to Now < 1 s on a five-year-old phone.
- **Accessibility:** Flutter semantics on every control; dynamic type up to 200%; reduced-motion
  disables the card physics; colour-contrast ≥ 4.5:1; dyslexia font toggle.
- **Privacy:** no analytics SDK. Optional, opt-in aggregate counters sent as a single weekly
  request with no identifiers. Privacy label on both stores: "Data not collected".

---

## 15. Roadmap

| Phase | What it proves | Rough length | What we need from you first |
|---|---|---|---|
| 0. Paper prototype | The three-noun model and the Now card are understandable in five minutes, tested on 5 people (2 with ADHD) | 1 week | Names of five people willing to try it; your answers to the decisions below |
| 1. Core loop on one phone (your OS) | Capture → Inbox → Now → Done works and feels fast; you use it daily for two weeks | 3–4 weeks | Your phone, 10 minutes of feedback a day |
| 2. Second platform + widgets + calendar | Both stores' capture entry points work; free time shows correctly | 3 weeks | A test device of the other OS (or a friend with one) |
| 3. Shelf, projects, estimates, Fresh start, accessibility pass | Ambition management and the never-punish rules hold for a month of real use | 3 weeks | Your real project list, imported |
| 4. Closed beta, 20–30 people | Day-28 and day-60 retention and the survey question; adjust rules | 9–10 weeks | Recruit testers (ADHD communities, friends) |
| 5. Store release, v1.1 items | Reviews, sync, "Surprise me", streaks | ongoing | Store accounts ($99/yr Apple, $25 Google), a name, an icon |

---

## What we took from other apps

Researched September 2026 (Tiimo, Amazing Marvin, Llama Life, Structured, Sunsama, Motion,
Akiflow, Goblin Tools, Things 3, Todoist, TickTick, Apple Reminders, Numo, Focus Bear,
Routinery, Dubbii, Saner.ai, Inflow). The short version: the apps this audience keeps make time
visible, show one thing, warn before over-commitment, reschedule without blame and never show a
red overdue count. The ones they abandon need setup, punish a missed day, cost $20+/month
after a 7-day trial, or break on mobile.

| Taken from | What we took | What it gets wrong for this audience |
|---|---|---|
| **Todoist** | The best capture in the business: quick-add with natural-language dates ("Friday", "in 3 days"). Our date parser copies it. | The red overdue counter — "87 overdue in a month", "opening the app triggers shame". Priorities P1–P4 ignore interest and urgency. |
| **Tiimo** | The shrinking ring timer and "anytime" tasks that stay out of today. Our Start timer is a shrinking disc; our Shelf is "anytime". | Core-loop bugs (timers not pausing, notifications not firing) and a slow support queue on a $80/yr subscription. Reliability of the loop is the product. |
| **Llama Life / Goblin Taskmaster** | One task at a time. Both added it because "a wall of steps is still overwhelming even when each step is small". Now shows three cards, one at a time on tap. | Llama Life: no free tier, half-finished in 2026 (tasks losing their names). Goblin: nothing persists. |
| **Goblin Tools** | No account, no tutorial, no judgment. Our onboarding needs no sign-up and has no tour. | It generates steps "and then walks away" — no memory, no plan. |
| **Sunsama** | The capacity bar that turns yellow, then red, *before* you over-commit, and the explicit rollover prompt instead of silent overdue. Our "and that's enough today" line plus the Slipped section do both. | $240/yr, mobile app "barely functions", unfinished work doesn't flow past today. |
| **Amazing Marvin** | The Backburner and the "day capacity" idea; the insight that procrastination needs tools, not scolding. | Its toggleable strategies are so many that setting it up is itself the overwhelming task. Desktop-first, mobile weak. |
| **Motion** | Rescheduling that isn't a guilt event: "I no longer feel guilty about shifting tasks." Our Not-now swipe and silent roll-forward. | Packs days "to burnout" with no capacity view; feature bloat; billing dark patterns. |
| **Things 3** | Calm, quiet visuals; Today / This Evening; a learning curve people actually finish. | Apple-only; Today lets items scroll off the bottom — out of sight, out of mind. |
| **Apple Reminders** | Zero-friction capture from Siri, Watch and widgets: a great net. | Not an engine: one notification, swiped away, the infinite "remind me later" loop. |
| **Structured** | The vertical timeline that makes the day's shape visible. Our free-time line is the two-line version. | Free tier too limited to evaluate; a derailed day cascades manually. |
| **Routinery / Focus Bear** | Auto-advancing routines with a voice: the app "tells you what to do and when". Our Now cards do this for tasks, not routines. | Routines only; setup confusion; post-update bugs. |
| **Numo / newer ADHD apps** | Deliberately no streaks — "if you forget, nothing bad will happen." Our streaks forgive by design and never show as broken. | Paywalled community, price complaints ("$1–3 would be fair"), thin task features. |

**Two things the research changed in this plan:**

1. **Price and trial are retention features.** Quitting clusters around day 7–14 — exactly
   where most of these apps end their trials. So: a real free tier that includes the whole
   core loop (capture, Inbox, Now, Shelf, one widget) forever; paid features are the extras
   (sync, calendar free-time, reviews, body doubling) at a low price — a one-time purchase or
   ≤ $3/month — with a 30-day trial, no card. (Decision 7 below.)
2. **Reliability of the core loop beats every feature.** Tiimo, Llama Life and Routinery lose
   this audience over timers that don't pause and tasks that lose their names. Phase 1 ends
   with a two-week soak test on the loop, and the MVP list stays short so that's possible.

## Sources

What the design leans on, and how strong each leg is. (Journal pages were checked by
citation; abstracts and secondary summaries were readable, full texts often were not.)

| Design choice | Evidence | Strength |
|---|---|---|
| Cues where the action happens (widgets, lock screen, "when" reminders), not inside the app | Barkley's executive-function model ("point of performance"); CBT/skills trials that teach externalised systems: Safren et al. 2010, *JAMA* (RCT, n=86, 67% vs 33% responders); Solanto et al. 2010, *Am J Psychiatry* (RCT, n=88) | Theory strong; intervention evidence moderate |
| Time shown as shrinking shapes, workday countdowns | Time-perception deficits: Zheng et al. 2022, *J Attention Disorders* (27 studies, n=1,620); Marx et al. 2022, *JAACAP* (55 studies). Visual timers: Hallez & Vallier 2025 (n=44 children) lowered anxiety and restlessness, didn't change performance | Deficit strong; timer benefit weak–moderate |
| "When…" cue on capture (if-then plans) | Gollwitzer & Sheeran 2006 meta-analysis (94 studies, d=0.65); Gawrilow & Gollwitzer 2008 (children with ADHD reached non-ADHD inhibition levels); no adult-ADHD RCT | Strong generally; extrapolated to adults |
| Immediate visible reward on Done; "Surprise me" novelty | Reward-sensitivity evidence: Volkow et al. 2009, *JAMA*; Luman et al. 2005, *Clin Psychol Rev* (22 studies); Netzer Turgeman & Pollak 2026. Dodson's "interest-based nervous system" is a clinical heuristic, not a validated construct | Moderate; heuristic layered on top |
| Never punish; neutral "carried forward"; celebrate restarts | Heightened rejection sensitivity: Babinski et al. 2018, *J Abnorm Child Psychol* (n=391); punishment sensitivity: Luman 2008, *JCPP*; shame–avoidance cycles in qualitative work (2023). No experiment on app feedback and persistence | Moderate for sensitivity; weak for the app-specific claim |
| One concrete next step per project | Bandura & Schunk 1981 (proximal subgoals → progress and self-efficacy); Kruger & Evans 2004 (unpacking improves time estimates) | Moderate (general population) |
| Automatic estimate correction, shown gently | Prevatt et al. 2011 (ADHD students estimate less accurately); Bègue et al. 2021 (feedback-based timing learning is atypical in ADHD); no study on logging planned-vs-actual | Deficit moderate; feedback benefit unknown — so we don't rely on the user self-calibrating |
| Body doubling optional and low-pressure | Eagle et al. 2023/2024 (ACM ASSETS/TACCESS, survey n=220); 2025 EEG study (n=26) found no performance effect; coach reports consistent | Weak |
| Design for a two-month habit window; tolerate lapses | Lally et al. 2010, *Eur J Soc Psychol* (median 66 days, one miss doesn't derail); Eysenbach 2005 "law of attrition"; industry day-30 retention ~4–7% | Moderate; the "week three" cliff is unsupported |
| One purpose per screen, sans-serif with spacing, undo everywhere, no gimmick fonts | W3C COGA "Making Content Usable" (2021); GOV.UK accessibility posters; Rello & Baeza-Yates 2013 (eye-tracking, n=48: sans-serif and spacing help, OpenDyslexic doesn't), replicated by Wery & Diliberto 2017 | Expert consensus; typography moderate |

---

## Decisions needed from you

1. **Calendar in the MVP?** I've assumed yes, read-only, asked for last in onboarding. Say no and
   the "free time" line goes to v1.1.
2. **Working name.** "Now" is used as the screen name; the app can be called anything. Any
   preference, or shall I propose three?
3. **The cap of three committed projects** — keep at 3, or make it a setting (3–5)?
4. **Energy check-in** — ship it in MVP (optional, one tap) or cut it?
5. **Which OS is *your* daily phone?** Phase 1 builds there first even though both ship together.
6. **Duration buckets** — 5 / 15 / 30 / 60 / half-day, or would you rather type minutes?
7. **Pricing.** Free core loop forever + a one-time purchase (~$15–20) for the extras, or free +
   ≤ $3/month? Both are defensible; one-time is simpler and this audience distrusts
   subscriptions.
