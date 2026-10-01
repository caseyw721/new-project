# DIY, Homebuilt, Converted and Low-Cost Glass Lathes (catalog of builds, conversions, plans and budget commercial units)

**Research-method caveat (read first).** The sandbox's egress proxy blocked direct reads of almost every primary source for this topic (repairfaq.org, imajeenyus.com, lampworketc.com, talkglass.com, practicalmachinist.com, hobby-machinist.com, cnczone.com, homemadetools.net, diyvacuumtubes.com, daliborfarny.com, glassblowingforum.com, kickstarter.com, YouTube, Reddit, Instructables, Hackaday, Printables, Alibaba/Made-in-China, eBay, pubs.acs.org, asgs-glass.org). The only pages read in full were GitHub repositories (OpenChuck, OpenLatheV2, LatheDuino, Foton_Glass_Lathe, James-Edgar/Glass-Lathe). Every other finding below comes from search-engine summaries/snippets of the named page, so numbers are reported as the snippet stated them and should be spot-checked against the linked page before being quoted as hard fact. The session's web-search budget was also exhausted before Reddit threads, neon-bender builds, Seam Mini specs and several YouTube builds could be run down; those are listed under Gaps.

---

## Key Question 1: What documented DIY glass lathe builds exist (builder, year, approach, components, cost, capability, outcome)?

### Takeaway
At least a dozen documented homebuilt glass lathes exist online (2000s–2025), clustering into three archetypes: (a) two commercial mini-lathe headstocks (Taig) driven by paired stepper motors, (b) scratch-built hollow spindles in pillow-block/flanged bearings on steel-tube, plywood or aluminum-extrusion beds driven by steppers or DC motors, and (c) open-source "kit" designs (Kube OpenLathe 2017, Foton 2022, James-Edgar 2023, a 2025 J. Chem. Educ. 3D-printed micro lathe). Reported parts cost ranges from under $200 for a planetary chuck to "<$2k" for the full OpenLathe; most builders target 10–180 rpm and 20–45 mm bores.

### Cited Findings

**Open-source / published designs**
- Kube OpenLathe (Jordan Kube, Kickstarter 12 Jan–14 Feb 2017): goal "to bring a glassblowing lathe to every shop, coming in at less than $2k in parts"; specs: 9.75 in radial swing, 24 in max between spindles ("or as long as desired, with the lathe bed easily extended for tens of dollars"), 20 mm stock spindle bore "with the possibility to bore chucks to 30 mm", 0.25 in cold-rolled-steel ways, 8020 aluminum-extrusion frame; promised deliverables were a BOM, schematics, construction/operation videos and a forum; raised $14,057 of a $12,000 goal (117%) from 67 backers — [Kickstarter page](https://www.kickstarter.com/projects/1932619845/kube-openlathe-the-open-source-glass-blowing-lathe); [BackerTracker](https://www.backerkit.com/projects/1932619845/kube-openlathe-the-open-source-glass-blowing-lathe); [Geeky Gadgets, 13 Jan 2017](https://www.geeky-gadgets.com/open-source-glass-blowing-lathe-13-01-2017/)
- OpenLatheV2 (GitHub user amasarac / Brandon Marsh, last update 3 Oct 2021): "a branch of the OpenLathe Project started by Jordan Kube trying to further the spirit of accessible glass lathes for everyone by simplifying some of the tougher to build components and to reduce the complexity to needing just a drill and a screwdriver"; GPL-3.0; the repo holds only a README and LICENSE (2 commits), i.e., no files were ever published — [GitHub OpenLatheV2](https://github.com/amasarac/OpenLatheV2)
- OpenChuck (amasarac, last update 6 Dec 2022): "Open Source Planetary Chuck for Glass Lathes" whose "goal is to expand the capabilities of the Kube OpenLathe by allowing much larger tube to be held within the chuck"; "planetary arm design allows for much larger work holding than other commercially availible stepper powered 4th axis"; design goal "to make the chuck without need for CNC tools or expensive equipment", layout "using only a compass, straightedge, and protractor", three drill bits (5, 6, 13 mm); usable in synchronous (centered) or asynchronous (offset) modes; GPL-3.0; BOM and plans linked to a Google Drive folder — [GitHub OpenChuck](https://github.com/amasarac/OpenChuck)
- OpenChuck bill of materials totals **$186.64** (2022): 3× "0.5M brass worm gear 1:60 with stainless steel worm Rod Set" $7.99 ea (AliExpress), 3× 6 mm × 200 mm 1566 carbon-steel shafts $8.60 ea and 3× 13 mm OD/6 mm ID bearings $6.46 ea (McMaster-Carr), GT2 1 m belt $0.69 and GT2 6 mm-bore pulleys 3-pack $8.29, 6063 aluminum rectangle bar 0.25×0.75×12 in $4.35 and 0.375×1.25×12 in $6.74 (Online Metals), M5 hardware, 13 mm reduced-shank drill $7.99, Dykem layout fluid $16.35, guitar control knobs $7.29 (as hand knobs); a 6 in aluminum master lap ($21.99) is listed at qty 0 as an optional base — [OpenChuck BOM (Sheet1.html)](https://raw.githubusercontent.com/amasarac/OpenChuck/main/Sheet1.html)
- LatheDuino (David Van Horn): "Arduino code for the Jordan Kube Open Lathe project"; targets an "Industrial-PLC-Open-Source-Arduino-Mega-2560-Kit-DIN-Rail-Mount" (eBay item 332406924434), "a pair of industrial stepper drivers" on a 48 V SMPS; headstock step/dir/enable on pins 44/43/38, tailstock on 45/41/39; AccelStepper DRIVER mode; 400 steps/rev; max speed 4500 steps/s ("6600 is the CPU maximum but motors plateau around 4500 on low-current drive"); MaxAccel 1000 steps/s²; comments reference KL-5056D drivers needing a 2.5 µs minimum pulse width; MIT license — [GitHub LatheDuino](https://github.com/DavidVanHorn/LatheDuino); [LatheDuinoSketch.ino](https://raw.githubusercontent.com/DavidVanHorn/LatheDuino/master/LatheDuinoSketch.ino)
- Foton_Glass_Lathe (GitHub user NPoole, created 14 May 2022): "Small Homebrew OSHW Glassblowing Lathe", marked "WORK IN PROGRESS"; the repo contains one Fusion 360 archive (CAD/FOTON v20.f3z) and a render; no BOM or text documentation; 4 stars — [GitHub Foton_Glass_Lathe](https://github.com/NPoole/Foton_Glass_Lathe)
- James-Edgar/Glass-Lathe (created 23 Dec 2023): "A glassblowing lathe made from off the shelf parts with limited machining"; files: "Glass Lathe 1.2 Complete Build.step", ".f3z", "Glass Lathe 1.2 v35.zip" and "Wood Chuck Model v52.step" (a wooden chuck design); README is one line, no BOM or cost — [GitHub James-Edgar/Glass-Lathe](https://github.com/James-Edgar/Glass-Lathe)
- A GitHub repository search for "glass lathe" / "glassblowing lathe" returns only the Foton and James-Edgar repos; "openlathe" returns only OpenLatheV2 — [GitHub search](https://github.com/search?q=%22glass+lathe%22&type=repositories)
- "An Open-Source 3D Printed Micro Lathe for Scientific Glassblowing", J. Chem. Educ. 2025, 102(12), 5373: a "3D printed one chuck micro lathe for scientific glassblowing has been designed, constructed, and thoroughly tested"; "All hardware and electronics required for the micro lathe are commercially available and inexpensive"; assembly and use documented in YouTube videos (an intro video demonstrates it using honey as a molten-glass substitute; another makes a test tube) — [ACS J. Chem. Educ.](https://pubs.acs.org/doi/10.1021/acs.jchemed.5c00939); [Intro video](https://www.youtube.com/watch?v=JCthSZkNHv0); [Test-tube video](https://www.youtube.com/watch?v=lEDQ32-JXgI)
- A YouTube video "Designing an Open Hardware Glassblowing Lathe" "introduces the concept of glassblowing lathes and walks through the CAD for an Open Source Hardware design" — [YouTube](https://www.youtube.com/watch?v=5BPOcQ8e1Mc)
- Hackaday (Oct 2024) covered a 3D-printed open-source lathe and noted it "could be customized for specialized purposes like a glassblowing lathe for plastic" (i.e., not an actual glass lathe) — [Hackaday](https://hackaday.com/2024/10/23/a-3d-printed-open-source-lathe/)

**Taig-based dual-stepper builds**
- "Dual-spindle glass lathe" (imajeenyus.com, dated 25 Jan 2011 in URL): "loosely based on home-built glass lathes", "uses standard Taig lathe components and uses two stepper motors, driven in-phase, to achieve synchronous rotation of the spindles"; built "for a friend using two Taig headstocks and one bed section"; one spindle fixed, the other "moveable with a handwheel to allow tubing to be positioned"; author notes in-phase stepper drive "is certainly a neat solution, but requires a bit of electronics"; normal glass lathes "have a splined shaft drive between the headstock and tailstock" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml)

**Scratch-built hollow-spindle builds**
- Sam's Laser FAQ "A Home-Built Glass Working Lathe" (Sam Goldwasser's site; written for amateur laser builders making plasma tubes, water jackets and other scientific glassware): "A commercial glass-working lathe is fairly expensive, making a home-built version useful for sporadic and limited hobby work"; the hollow shaft is "¾ in stainless-steel tube [that] rides in two flanged ball bearings mounted in pieces of thick plywood, which while not seeming the most rigid arrangement, is sufficient"; the designer "repurposed a microwave measurement device with carriages using linear ball bearings" as the lathe base; "A metal working lathe chuck can be used on one end to support short pieces of glass, such as the end pieces of pulsed Argon tubes and sealing electrodes to Pyrex glass" — [repairfaq.org/sam/gwl](https://www.repairfaq.org/sam/gwl/)
- diyvacuumtubes.com "My Glass Lathe Build" (thread t57): "inspired by George's glass lathe"; "142 oz stepper motors driven by a custom ARM based controller"; speed "adjustable from 5-180 RPM"; "optical encoder based hand wheel to allow both heads to be manually rotated in sync"; chuck is "a machined fitting attached to the spindle ... a 1.5 in compression holder similar to George's"; "The blow tube is attached to a sealed compartment in the head and the air passes through the spindle to the sealed compression fitting"; motors are 1.8°/step "running in 1/128 micro-stepping mode" — [diyvacuumtubes.com t57](https://diyvacuumtubes.com/my-glass-lathe-build-t57.html); related threads [Glass Lathe Test t36](https://diyvacuumtubes.com/glass-lathe-test-t36.html), [Glass Blowing Lathe Chuck DIY t68](https://diyvacuumtubes.com/glass-blowing-lathe-chuck-diy-t68.html), [DIY Glass Blowing Lathe Chuck t69](https://diyvacuumtubes.com/diy-glass-blowing-lathe-chuck-t69.html)
- Dalibor Farny (Czech nixie-tube maker) "Glass working lathe": design "consists of four ball bearings, two DC motors, one linear bearing, and several aluminum profiles with manual synchronization by setting slave motor RPM according to the master one"; lesson: "Buying a covered bearing wasn't the best idea as it was very stiff to rotate; the dense lubricant was replaced with thin oil" — [daliborfarny.com](https://www.daliborfarny.com/glass-working-lathe/); Farny "acquired a helium leak detector, built a glass lathe, and after several attempts, built his first Nixie tube in 2013" — [Interesting Engineering](https://interestingengineering.com/innovation/breathing-life-obsolete-tech-dalibor-farny-nixie-tubes)
- HomemadeTools.net "Homemade Glass Lathe": "dual spindle arrangement to secure two borosilicate tubes on center while turning in the same direction and at the same speed"; specs quoted as "44 mm bore, 600 mm between centers, 110 volt operation"; synchronization: "HTD pulleys are used with both run by a steel bar with a keyway" — [HomemadeTools.net homemade-glass-lathe](https://www.homemadetools.net/homemade-glass-lathe); [HomemadeTools.net forum glass-lathe-1079](https://www.homemadetools.net/forum/glass-lathe-1079)
- HomemadeTools.net "Homemade Glassblowing Lathe": "constructed from commercial lathe components and intended to facilitate the production of oil lamp globes" — [HomemadeTools.net](https://www.homemadetools.net/homemade-glassblowing-lathe)
- HomemadeTools.net glass-lathe discussion states a glassblowing lathe "does not require the torque that a metal or wood lathe requires, nor the top end speed, with top RPM requirements being 350-400 rpm"; one builder "used a piece of 60 mm × 40 mm aluminum extrusion section for the lathe bed" — [HomemadeTools.net forum](https://www.homemadetools.net/forum/glass-lathe-1079)
- Practical Machinist "Building a glass lathe cheap-o" (thread 227302): builder "used two rectangular steel tubes for the ways and planned 4 in 3-jaw chucks for workholding"; "the lathe's top speed only needs to be a hair over 60 rpm, most of the work will be done with 10-40 rpm" — [Practical Machinist](https://www.practicalmachinist.com/forum/threads/building-a-glass-lathe-cheap-o.227302/)
- Lampwork Etc. "Making my own glass lathe" (thread 182421): builder "with access to a machine shop decided to make their own glass lathe and got ideas from Yahoo groups like MultiMachine and Gingery Machines"; "published design files in Google SketchUp format for others"; forum members noted "Wood lathes won't work for glass because only one end spins on wood lathes, while a glass lathe needs both ends to spin" — [Lampwork Etc. archive](https://www.lampworketc.com/forums/archive/index.php/t-182421.html); [live thread](https://www.lampworketc.com/forums/showthread.php?t=182421)
- Hobby-Machinist "Glassblowing lathe finished!!" (thread 118093) — a completed homebuilt glassblowing lathe build thread (content not retrievable) — [Hobby-Machinist](https://www.hobby-machinist.com/threads/glassblowing-lathe-finished.118093/)
- CNCZone "Newbie glass lathe build" (thread 129981) — a build thread by a self-described newbie (content not retrievable) — [CNCZone](https://www.cnczone.com/forums/uncategorised-metalworking-machines/129981-glass-lathe-build.html)
- ATX Hackerspace list "want to build a DYI CNC Glassblowing lathe": "One CNC glass lathe was made with two stepper motors that had collets on their shafts, with one mounted on a slide controlled by another stepper to extend or shorten the glass and another held the torch" — [Google Groups atxhs-discuss](https://groups.google.com/g/atxhs-discuss/c/1roUvBj09sc)
- YouTube "Stepper motor Glass Lathe made using open build components": "A small glass lathe built with two stepper motors to control the chucks, created using open build components typically used for 3D printers" — [YouTube kkNrYnDewH0](https://www.youtube.com/watch?v=kkNrYnDewH0)
- YouTube "First test of the Experimental Prototype Glass Lathe": "scroll chucks are identified as the most challenging part"; "the creator is making everything except the chucks first because of this complexity" — [YouTube Id93ObuINfI](https://www.youtube.com/watch?v=Id93ObuINfI)
- YouTube "Amateur Scientific Glassblowing: Make a Lathe!" (content not retrievable) — [YouTube ivor-MYXOh8](https://www.youtube.com/watch?v=ivor-MYXOh8)
- TalkGlass: "VertigoGlass on talkglass.com is doing glass lathe builds, and there's a thread by hglasswell about his lathe where he answers people's questions about lathe building"; the forum has a "Lathe Library" section; there is a "For Sale Custom Lathe *NEW*" thread (t-67021) and an "Older lathe refurbishment project" thread (t-57333) — [TalkGlass custom lathe](http://www.talkglass.com/forum/archive/index.php/t-67021.html); [TalkGlass refurbishment](http://www.talkglass.com/forum/archive/index.php/t-57333.html)
- Hackaday vacuum-tube articles describe the glass-sealing step as "placing these parts in a specially made lathe with two headstocks that turn in unison" — [Hackaday 2014](https://hackaday.com/2014/11/21/artisanal-vacuum-tubes-hackaday-shows-you-how/); [Hackaday 2018](https://hackaday.com/2018/12/31/the-art-of-vacuum-tube-fabrication/)
- Bob's Log "Tubemaking" (KD2NCT) is a hobby vacuum-tube-making log that includes glass-lathe content (not retrievable) — [qsl.net/kd2nct](https://qsl.net/kd2nct/tubemaking.html)

### Inferences
- The two cheapest documented routes to a working two-spindle lathe are (1) buying two Taig/Sherline-class headstocks and a bed and adding paired steppers, and (2) welding two steel tubes as ways and mounting hollow shafts in pillow/flanged bearings; both avoid machining a precision bed.
- The vacuum-tube/nixie hobbyist community (Farny, diyvacuumtubes, Sam's Laser FAQ, KD2NCT) is a disproportionately rich source of small-bore (≈20–45 mm) DIY glass lathe documentation because they need lathes but not large bores.
- The OpenLathe ecosystem shows the typical open-source arc: the 2017 Kickstarter funded, a controller (LatheDuino) and a chuck (OpenChuck, $187 BOM) were spun off, but the "V2" simplification stalled with an empty repo in 2021.

### Gaps
- No builder's full parts cost with year could be verified from a primary page except the OpenChuck BOM ($186.64, 2022) and the OpenLathe "<$2k" target (2017). Costs for the Taig, Farny, diyvacuumtubes, HomemadeTools and Practical Machinist builds are not in the snippets.
- "What I'd do differently" statements were only found for Farny (bearing lubricant). The Hobby-Machinist, CNCZone, Lampwork Etc. and TalkGlass build threads almost certainly contain more, but were blocked.
- Whether the Kube OpenLathe BOM/plans were actually delivered to backers, and whether they remain downloadable, could not be verified (Kickstarter blocked; the only public derivative, OpenLatheV2, contains no files).
- The authorship/institution of the 2025 J. Chem. Educ. micro lathe, its cost figure and its file-hosting location could not be read (paywalled/blocked). A University of Iowa chemistry page appeared in results and may be the source institution — unverified.
- No Instructables or Hackaday.io project specifically for a glass lathe was found; searches surfaced only wood/metal lathe projects.
- No Reddit thread (r/Lampwork, r/glassblowing, r/scientificglassblowing, r/Machinists) could be retrieved; site-restricted searches returned nothing usable.

---

## Key Question 2: What donor machines have been converted, and what does a driven, synchronized tailstock on a metal lathe require?

### Takeaway
Documented conversions are mostly of small hobby-lathe *components* (Taig headstocks and beds) rather than whole metal lathes; welding positioners are sold on eBay re-labeled as "glass lathes"; wood lathes are explicitly rejected by glass forums because only one end spins. The accepted way to make a tailstock turn in sync is either a mechanical common shaft (splined or keyed bar driving pulleys/sprockets at both ends) or giving the tailstock its own motor and electronically locking its speed to the headstock.

### Cited Findings
- Taig components: the imajeenyus build "uses standard Taig lathe components ... two Taig headstocks and one bed section", with "two stepper motors, driven in-phase" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml)
- Sam's Laser FAQ build repurposed "a microwave measurement device with carriages using linear ball bearings" as the bed/carriage — [repairfaq.org](https://www.repairfaq.org/sam/gwl/)
- A HomemadeTools build was "constructed from commercial lathe components" (oil-lamp-globe production) — [HomemadeTools.net](https://www.homemadetools.net/homemade-glassblowing-lathe)
- Welding positioner as glass lathe: an eBay listing titled "Accu-met Precision Laser Welding Positioner Lathe (glass lathe)" — [eBay 134712640847](https://www.ebay.com/itm/134712640847)
- Wood lathe rejected: "Wood lathes won't work for glass because only one end spins on wood lathes, while a glass lathe needs both ends to spin" — [Lampwork Etc.](https://www.lampworketc.com/forums/archive/index.php/t-182421.html); "The glassblowing lathe is different from a machine or wood lathe in that both the headstock and tailstock are driven synchronously" — [Scientific Glassblowing Learning Center (ilpi.com)](https://www.ilpi.com/glassblowing/glasslathe.html)
- Tailstock-chuck requirement from the machinist side: "Glass lathes almost always have two 'chucks' (one where the tailstock typically would be on a metal lathe) to support the work piece and have a spindle through-hole of at least 4 inches" — [Practical Machinist "Need built custom glass lathe"](https://www.practicalmachinist.com/forum/threads/need-built-custom-glass-lathe.186669/)
- Conventional synchronization hardware: "Normally glass lathes have a splined shaft drive between the headstock and tailstock" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml); a homemade unit used "HTD pulleys ... with both run by a steel bar with a keyway" — [HomemadeTools.net](https://www.homemadetools.net/homemade-glass-lathe); glass-lathe spindles "are geared together to turn at the same (slow) rate so the glass doesn't twist" — [Home Shop Machinist BBS "How do glass lathes work?"](https://bbs.homeshopmachinist.net/forum/general/6789-how-do-glass-lathes-work)
- A wood-lathe tailstock can carry a chuck by "inserting a mandrel into the Morse taper of a lathe's tailstock" so "a chuck or faceplate can be threaded on" (free-spinning only, not driven) — [Practical Machinist tailstock thread](https://www.practicalmachinist.com/forum/threads/tailstock-on-wood-lathe.162651/); tailstock chuck-reversing adaptors (MT2) are a stock woodturning accessory — [Packard Woodworks](https://www.packardwoodworks.com/lathes-acc-tlstkadp.html)
- Patent literature (CVD/fiber preform glass lathes) describes the electronic alternative: "both the headstock and tailstock are driven by servo motors, and means is provided to synchronize the two driving motors" — [USPTO 6359400](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/6359400)
- CNC-style conversion: "two stepper motors that had collets on their shafts, with one mounted on a slide controlled by another stepper" — [atxhs-discuss](https://groups.google.com/g/atxhs-discuss/c/1roUvBj09sc)

### Inferences
- No retrievable source documented converting a complete Atlas/South Bend/7x12/9x20 metal lathe into a glass lathe; the practical obstacle implied by the sources is that those lathes have small spindle bores (a 7x12 has roughly a 20 mm bore) and a dead tailstock, so builders instead buy two headstocks or build spindles from scratch.
- A driven tailstock on a metal-lathe bed needs, at minimum: a second hollow spindle in bearings on a sliding base, a chuck, and either (a) a long keyed/splined shaft parallel to the bed with a sliding sprocket/pulley on the tailstock, or (b) a second motor with a shared step signal or follower control.

### Gaps
- No thread describing a specific Atlas/South Bend/mini-lathe glass conversion was found; the "7x12/9x20 glass conversion" search returned only generic mini-lathe pages.
- Pipe-threading-machine, pottery-wheel, tube-rotator and pipe-roller conversions returned no glass-specific results.
- No first-hand description of a chain- or shaft-driven tailstock retrofit on a hobby metal lathe was retrievable; the Practical Machinist "Need built custom glass lathe" and "desired features" threads likely discuss this but were blocked.

---

## Key Question 3: What off-the-shelf chucks do DIYers use, and how do they get air through the spindle?

### Takeaway
DIYers use (a) cheap import 3-jaw scroll chucks bored out and sometimes fitted with extended/padded jaws, (b) compression-fitting "collet" holders for small tube, (c) wooden or 3D-printed chuck designs, and (d) the open-source worm-driven planetary OpenChuck ($187 BOM). Air passes through a hollow spindle to a pneumatic swivel (Festo-type), a sealed-bearing fitting, or even a cork-and-bearing improvisation.

### Cited Findings
- Bored-out import chucks: "get cheap 8 in chucks, remove the jaws, and bore out the center to 3 in or more for glass lathe purposes" — [PolyTech Forum "Boring out a 3-jaw chuck for a glass lathe?"](https://www.polytechforum.com/metalworking/boring-out-a-3-jaw-chuck-for-a-glass-lathe-44495-.htm)
- Padded jaw extensions: "extensions can be made for a 3-jaw chuck's external jaws, padded with wood so that glass can be held tightly without risk of cracking" — [Simplifier "Glassworking Chuck Jaws"](https://simplifier.neocities.org/glassjaws)
- Jaw reversal: "For standard scroll chucks, the jaws can't be turned around as they fit the scroll only one way"; Sherline chucks "have reversible scroll jaws with elliptical shaped teeth" so jaws "can be removed and reversed to hold larger stock" — [Sherline chuck instructions PDF](https://sherline.com/wp-content/uploads/2015/01/1075inst.pdf); [Home Shop Machinist "flipping chuck jaws"](http://bbs.homeshopmachinist.net/archive/index.php/t-15227.html)
- Planned 4 in 3-jaw chucks on the Practical Machinist cheap-o build — [Practical Machinist](https://www.practicalmachinist.com/forum/threads/building-a-glass-lathe-cheap-o.227302/)
- Compression-fitting holder: diyvacuumtubes build uses "a 1.5 in compression holder" machined fitting as the chuck — [diyvacuumtubes.com](https://diyvacuumtubes.com/my-glass-lathe-build-t57.html)
- Wooden chuck: James-Edgar's repo includes "Wood Chuck Model v52.step" — [GitHub](https://github.com/James-Edgar/Glass-Lathe)
- Commercial glass-lathe chucks use ceramic cloth liners: "two spindles with 3-jaw chucks lined with ceramic cloth" — [Home Shop Machinist BBS](https://bbs.homeshopmachinist.net/forum/general/6789-how-do-glass-lathes-work); a Litton EE scroll chuck alone was listed used at $1,750 — [eBay search summary](https://www.ebay.com/sch/i.html?_nkw=glass+lathe+used&_sop=12)
- OpenChuck planetary design: three 1:60 brass worm sets on 6 mm shafts, GT2-belt coupled, $186.64 total BOM; "Cost-saving synchronous-only configuration options" documented — [OpenChuck README](https://github.com/amasarac/OpenChuck); [BOM](https://raw.githubusercontent.com/amasarac/OpenChuck/main/Sheet1.html)
- Planetary chucks are discussed by machinists for glass lathes — [Practical Machinist "Planetary chucks for glassblowing lathe"](https://www.practicalmachinist.com/forum/threads/planetary-chucks-for-glassblowing-lathe.272554/); Cygnet Aerospace announced new scroll chucks on TalkGlass — [TalkGlass t-53591](http://www.talkglass.com/forum/archive/index.php/t-53591.html)
- 3D-printed chucks exist generically (Thingiverse dan241297 chuck; BunkerBuilder1 jaws V2; scooter46290 3/4-jaw) but are warned to be "quite dangerous if the plastic is not strong enough to resist the centrifugal forces" — [Thingiverse 3308072](https://www.thingiverse.com/thing:3308072); [Thingiverse 3896925](https://www.thingiverse.com/thing:3896925); [HomemadeTools 3D printed chuck](https://www.homemadetools.net/forum/3d-printed-lathe-chuck-2-5-a-71369)
- Air through spindle, option 1: "A Festo pneumatic swivel coupling provides a connection for a blowhose and consists basically of sealed ball bearings in a mount which provide a rotating airtight seal" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml)
- Option 2: "The blow tube is attached to a sealed compartment in the head and the air passes through the spindle to the sealed compression fitting" — [diyvacuumtubes.com](https://diyvacuumtubes.com/my-glass-lathe-build-t57.html)
- Option 3: "A champagne bottle cork can accommodate the bearing responsible for having the blowhose without spinning, as cork makes an airtight seal with the tail stock spindle, and a sealed bearing allows the hose to stay without spinning" — [HomemadeTools.net](https://www.homemadetools.net/forum/glass-lathe-1079)
- Chuck heat limit: a lathe-system patent notes "the limited amount of heat that prior art chuck inserts can withstand, with certain high-temperature applications causing chuck inserts to fail by melting and/or breaking" — [Google Patents US5158589A](https://patents.google.com/patent/US5158589)

### Inferences
- Scroll chucks are the single hardest DIY component (per the prototype video) and the single most expensive used component (a Litton chuck ≈ $1,750), which explains the proliferation of workarounds: bored-out import chucks, compression fittings, wood chucks and the worm-driven OpenChuck.
- 3D-printed chucks appear only as generic lathe projects; no source showed one used in a flame, and heat near the jaws makes PLA/PETG unsuitable for anything but cold ends of long tube.

### Gaps
- Could not retrieve prices/specs for Cygnet Aerospace scroll chucks or confirm whether any "glass lathe chuck kit" exists on Etsy/Thingiverse/Printables.
- No source documented a rotary union part number or cost other than the generic "Festo swivel".

---

## Key Question 4: What synchronization approaches have hobbyists used, and does phase drift matter?

### Takeaway
Hobby builds split between mechanical common-shaft drives (keyed bar + HTD pulleys) and electronic approaches: two steppers sharing a step signal or run by one controller (the dominant DIY choice), two DC motors with manually matched RPM (Farny), and software speed-matching of independent steppers (LatheDuino). Industrial sources explain why two VFD-driven induction motors "ramp together then drift apart". Explicit hobbyist reports on whether residual drift ruins glasswork were not retrievable.

### Cited Findings
- Mechanical: "HTD pulleys are used with both run by a steel bar with a keyway" — [HomemadeTools.net](https://www.homemadetools.net/homemade-glass-lathe); conventional lathes use "a splined shaft drive between the headstock and tailstock" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml)
- Two steppers in phase: "two stepper motors, driven in-phase, to achieve synchronous rotation of the spindles" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml)
- Two steppers, one controller: 142 oz-in steppers "driven by a custom ARM based controller", plus an "optical encoder based hand wheel to allow both heads to be manually rotated in sync" — [diyvacuumtubes.com](https://diyvacuumtubes.com/my-glass-lathe-build-t57.html)
- Software speed-matching (LatheDuino): headstock and tailstock are separate AccelStepper instances on separate step pins; a `speed_sync()` routine "adjusts the faster motor to match the slower one's speed rather than shared pulse timing"; the motors can run "in sync (normal) or slightly different speeds (twisting)" with a "Sync" switch to restore matching — [LatheDuino sketch](https://raw.githubusercontent.com/DavidVanHorn/LatheDuino/master/LatheDuinoSketch.ino); [LatheDuino README](https://github.com/DavidVanHorn/LatheDuino)
- Two DC motors, manual matching: "manual synchronization by setting slave motor RPM according to the master one" — [daliborfarny.com](https://www.daliborfarny.com/glass-working-lathe/)
- Why two induction motors drift: "Mismatched ramps reproduce the 'ramp together then drift apart' symptom"; with one VFD on two motors "both motors must be identical (same HP, RPM, voltage, FLA, and ideally the same frame and manufacturer)"; "The normal scheme is to make the second drive a follower" — [Industrial Monitor Direct, two motors one VFD](https://industrialmonitordirect.com/blogs/knowledgebase/running-two-motors-on-one-vfd-sizing-torque-and-load-sharing); [Mike Holt forum "Motors synchronising using VFD"](https://forums.mikeholt.com/threads/motors-synchronising-using-vfd.2559132/)
- Servo synchronization is the industrial answer for preform lathes: "both the headstock and tailstock are driven by servo motors, and means is provided to synchronize the two driving motors" — [USPTO 6359400](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/6359400)
- Phase-locked stepper following (for threading, but the same principle): "your stepper frequency needs to be matched 'in phase' to the spindle, and if it falls behind, it needs to send extra steps to catch up" — [Arduino Forum stepper synchronization](https://forum.arduino.cc/index.php?topic=349341.0)
- CNC glass-lathe vendors sell controlled twist as a feature, implying that controllable phase offset is desirable, not merely tolerated — [Sinc Tech lathes controller features](https://sinctechlathes.com/internal-computer-control/)

### Inferences
- Open-loop steppers fed identical step pulses cannot drift unless a motor stalls, which is why the imajeenyus/OpenLathe-style approach dominates DIY builds; LatheDuino's proximity "home" sensors exist specifically to detect "unplanned motor slippage", i.e., a stalled stepper losing phase.
- Farny's manually matched DC motors imply that for short seals on small tube, a small, slowly accumulating phase difference is tolerable because the glass is only soft for seconds and any twist is worked out by hand; this is consistent with LatheDuino offering deliberate "twist" mode.

### Gaps
- No hobbyist post quantifying acceptable drift (degrees per minute) or describing a failed VFD-pair glass lathe was retrievable; the VFD-drift findings above are from industrial, not glass, sources.
- The exact electronics of the imajeenyus in-phase drive (shared driver vs. shared step signal) were not readable.

---

## Key Question 5: What motors and controllers are typical?

### Takeaway
NEMA-23-class steppers (≈142 oz-in) on hobby/industrial digital drivers with Arduino or custom ARM controllers are the most documented; DC gearmotors with manual speed knobs (Farny) and treadmill motors (discussed) are the cheap alternatives; foot pedals appear as deadman/stop switches (LatheDuino) and as sewing-machine-style speed control (generic lathe practice).

### Cited Findings
- Steppers: "142 oz stepper motors driven by a custom ARM based controller", 1.8°, 1/128 microstepping, 5–180 RPM — [diyvacuumtubes.com](https://diyvacuumtubes.com/my-glass-lathe-build-t57.html)
- Steppers on Taig headstocks, "driven in-phase" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml)
- Steppers with OpenBuilds 3D-printer-style hardware — [YouTube kkNrYnDewH0](https://www.youtube.com/watch?v=kkNrYnDewH0)
- OpenLathe controller: Arduino Mega 2560 industrial PLC kit, "pair of industrial stepper drivers" (KL-5056D referenced) on 48 V, 400 steps/rev, max 4500 steps/s (= 675 rpm at 400 steps/rev before any gearing), accel 1000 steps/s², arcade joystick for faster/slower/twist±, foot-pedal deadman "orderly deceleration to stopped", proximity home sensors, vibration sensor that triggers deceleration, watchdog — [LatheDuino README](https://github.com/DavidVanHorn/LatheDuino); [sketch](https://raw.githubusercontent.com/DavidVanHorn/LatheDuino/master/LatheDuinoSketch.ino)
- DC motors: "two DC motors ... manual synchronization" — [daliborfarny.com](https://www.daliborfarny.com/glass-working-lathe/)
- Treadmill motors: "discussion about repurposing old treadmill motors for DIY lathes in glassblowing communities" — [glassblowingforum.com "First one out here"](https://glassblowingforum.com/threads/first-one-out-here.6/)
- Sewing-machine motors: "Sewing machine motors with foot control have been used for lathe speed control for a long time" (generic small-lathe practice) — [NAWCC forum](https://mb.nawcc.org/threads/switching-from-footpedal-to-rheostat-for-speed-control.79590/); a sewing servo "with a built-in 3:1 reduction gear, yielding 500 rpm max at the shaft, with 3× the torque" is sold for leather machines — [Leatherworker.net](https://leatherworker.net/forum/topic/19963-who-makes-a-variable-speed-foot-controlled-servo-motor/); a foot-pedal potentiometer (≈20 kΩ to ≈1 kΩ) is a $-level Adafruit part — [Adafruit 3739](https://www.adafruit.com/product/3739)
- Stepper troubleshooting is a recurring theme: "Steppers making noise but not spinning my lathe chuck...any advice?" — [CNCZone 427728](https://www.cnczone.com/forums/stepper-motors-drives/427728-steppers-making-noise-spinning-lathe-chuck-advice.html)
- VFD on a single-motor lathe is a well-trodden Instructable (wood lathe) but not a glass-specific one — [Instructables VFD wood lathe](https://www.instructables.com/Whats-Old-Is-New-Fixing-an-Old-Wood-Lathe-With-a-V/)

### Inferences
- The LatheDuino comment that motors "plateau around 4500 [steps/s] on low-current drive" is a direct statement that under-powered stepper drives limit top speed; at 400 steps/rev that is still far above the 60–180 rpm builders say they use, so top speed is not the binding constraint — low-speed smoothness (hence 1/128 microstepping on the diyvacuumtubes build) is.
- Sewing-machine servo motors with foot pedals are documented for small lathes generally but no glass-lathe build using one was found; the same is true for closed-loop (encoder) steppers.

### Gaps
- No glass-lathe build using a closed-loop stepper, a sewing-machine servo, or a 3-phase+VFD pair was retrievable (search budget exhausted before these queries ran).
- Motor/driver cost figures were not present in any retrievable source.

---

## Key Question 6: Are there published plans, CAD, BOMs or kits, and what do they cost?

### Takeaway
Free, open plans exist but are thin: the Kube OpenLathe (BOM/plans promised to 2017 backers), OpenChuck (full BOM $186.64 + Google-Drive plans, GPL-3.0), LatheDuino firmware (MIT), Foton (Fusion 360 file only), James-Edgar (STEP/F3Z + wood chuck), a Lampwork Etc. SketchUp set, and a 2025 peer-reviewed 3D-printed micro lathe. No paid "glass lathe plans" product or kit was found.

### Cited Findings
- Kube OpenLathe deliverables: "bill of materials, schematics, construction and operation videos, as well as a forum"; parts "<$2k" — [Kickstarter](https://www.kickstarter.com/projects/1932619845/kube-openlathe-the-open-source-glass-blowing-lathe)
- OpenChuck: GPL-3.0; BOM $186.64; plans in a public Google Drive folder; downloadable zip — [GitHub OpenChuck](https://github.com/amasarac/OpenChuck)
- LatheDuino: MIT-licensed Arduino Mega sketch for the OpenLathe — [GitHub](https://github.com/DavidVanHorn/LatheDuino)
- Foton_Glass_Lathe: OSHW, Fusion 360 archive only, WIP since May 2022 — [GitHub](https://github.com/NPoole/Foton_Glass_Lathe)
- James-Edgar/Glass-Lathe: STEP + F3Z full build v1.2 and wood chuck, Dec 2023, no license text visible — [GitHub](https://github.com/James-Edgar/Glass-Lathe)
- Lampwork Etc. builder "published design files in Google SketchUp format" — [Lampwork Etc.](https://www.lampworketc.com/forums/archive/index.php/t-182421.html)
- J. Chem. Educ. 2025 open-source 3D-printed micro lathe (one chuck), with assembly videos — [ACS](https://pubs.acs.org/doi/10.1021/acs.jchemed.5c00939)
- Older designs referenced as sources of plans: "plans available on sites like gordonhaag.com and diyvacuumtubes.com" (search summary; gordonhaag.com not verified) — [HomemadeTools.net forum](https://www.homemadetools.net/forum/glass-lathe-1079)
- A Printables model "Open Lathe V1" (model 1048400) exists; whether it is a glass lathe could not be confirmed — [Printables 1048400](https://printables.com/model/1048400-open-lathe-v1)
- Historical: ASGS *Fusion* May 1968 includes "specifications for a basic lathe" and a lathe-burner design; Feb 1970 profiles the Litton Model U; Aug 1974 covers lathe alignment/construction — [Fusion May 1968 PDF](https://asgs-glass.org/wp-content/uploads/2020/05/Fusion-v15-2-May-1968.pdf); [Fusion Feb 1970 PDF](https://asgs-glass.org/wp-content/uploads/2018/05/Fusion-v17-1-Feb-1970.pdf); [Fusion Aug 1974 PDF](https://asgs-glass.org/wp-content/uploads/2020/05/Fusion-v21-3-Aug-1974.pdf)
- Patent US6957552B2 "Manual glass lathe" describes a hand-operated lathe for artists "to control and rotate a glass workpiece while being blown, shaped, colored, or fumed" — [Google Patents](https://patents.google.com/patent/US6957552)

### Inferences
- Nothing resembling a complete, maintained, buildable open plan set with a current BOM exists; a report should characterize the open-source landscape as "fragments" (controller, chuck, CAD) around a 2017 Kickstarter whose documents are behind backer access.

### Gaps
- Could not verify whether Kube OpenLathe plans are publicly downloadable today, nor the final backer reward prices.
- Etsy "glass lathe plans", Thingiverse "glass lathe" and GrabCAD searches were not completed (budget exhausted); no evidence either way.

---

## Key Question 7: Small commercial lathes marketed as affordable for artists (and whether they resemble DIY designs)

### Takeaway
The cheapest purpose-built glassblowing lathes found are the Seam Lathe Mini ($3,590 on sale from $4,390) and Seam's 85 mm floor model ($5,050), followed by an "Indian Made" 85 mm bench lathe at $7,500 (ABR Imagery) and Chinese factory lathes quoted from ≈$1,600–4,500 for small units; used Littons run $9,000–25,000. Beware that several "$1,750 mini glass lathes" in search results are cold-working/engraving lathes, not glassblowing lathes.

### Cited Findings
- Seam Glass Lathe (California): "manufacturer and nationwide distributor of scientific grade glassblowing lathes ... affordable lathes assembled in the US"; 85 mm floor model $5,050 — [seamglasslathe.com](https://www.seamglasslathe.com/); Seam Lathe Mini "$3,590.00 (on sale, originally $4,390.00)" — [Seam Lathe Mini](https://www.seamglasslathe.com/product/Seam-Lathe-Mini-Reduced-Price)
- ABR Imagery: "85mm Indian Made Lathe with 85mm bore ... $7,500.00 with 110V Single Phase Power, Forward/Reverse, and adjustable speed control"; Herbert Arnold Precision Mini 1060 (60 mm bore) $28,995 — [ABR lathes collection](https://abrimagery.com/collections/lathes); [Arnold Mini 1060](https://abrimagery.com/products/arnold-precision-mini-glass-lathe)
- Chinese factory pricing (search summary of Made-in-China listings): glass blowing lathes "starting at US$4,000" with bores of 45/60/90/125/155/205/260/300 mm; "Mini glass blowing lathes starting at US$350-600"; "Smaller glass blowing lathe models ranging from US$1,600-US$4,500"; 260 mm units "US$15,000"; makers named: Shanghai Sumore, Jinan Glass International Trade, Okay Energy, Shanghai Sihao — [Made-in-China glass blowing lathe](https://www.made-in-china.com/manufacturers/glass-blowing-lathe.html); [Jinan Glass pipe lathe listing](https://jnglass.en.made-in-china.com/product/LvdmBXsKSOrn/China-Glass-Lathe-Machine-Glass-Blowing-Machine-for-Glass-Pipe.html)
- Used market: Litton 4 in tabletop "$13,250"; Litton ME 36 in swing "$17,400"; Litton KA 35 in swing "$9,000"; Litton EE #79 with chucks "$12,000"; 1998 Litton EEL "$25,000"; Litton EE scroll chuck "$1,750"; Litton cradle burner "$1,500" (eBay asking prices, 2024–25) — [eBay Litton tabletop](https://www.ebay.com/itm/404169950419); [eBay Litton ME](https://www.ebay.com/itm/395608048965); [eBay EEL](https://www.ebay.com/itm/236705941663)
- Bethlehem GL100 lab lathe listed used at "$6k" in ASGS classifieds — [ASGS classifieds](https://asgs-glass.org/blog/category/classifieds/)
- NOT glassblowing lathes (cold-working/engraving) but frequently returned for "mini glass lathe": Covington Mini Professional Glass Lathe $1,750, 0–1800 rpm DC motor, 4 in wheels — [Covington](https://covington-engineering.com/equipment/mini-professional-glass-lathe/); Mini-Jim portable cold-working lathe $3,955, 3/4 HP — [His Glassworks](https://www.hisglassworks.com/jim-tabletop-lathe-with-1-inch-straight-shaft.html)
- A "Custom Lathe *NEW*" was offered for sale on TalkGlass by a member-builder (details not retrievable) — [TalkGlass t-67021](http://www.talkglass.com/forum/archive/index.php/t-67021.html)
- Sinc Tech sells computer-controlled glass lathes (commercial, not budget) — [Sinc Tech](https://sinctechlathes.com/internal-computer-control/)

### Inferences
- The Seam Mini at ≈$3.6–4.4k and the "Indian Made" 85 mm at $7.5k bracket the price at which buying beats building for most artists; the OpenLathe's "<$2k parts" target (2017) sits roughly at half the cheapest new commercial unit.
- "US$350–600 mini glass blowing lathes" on Chinese marketplaces are almost certainly mis-categorized engraving/polishing lathes or single-spindle tube rotators; treat with suspicion until specs (two driven chucks, bore) are confirmed.

### Gaps
- Seam Mini specifications (bore, between-centers, rpm, drive, air-through) could not be read (domain blocked, search budget exhausted).
- No source confirmed any commercial lathe that originated from a DIY/open design.
- No pricing was found for "pipe lathes"/"tube rotators" sold by small shops to pipe makers.

---

## Key Question 8: Common pitfalls reported

### Takeaway
Reported problems cluster on chucks (hard to make, expensive, heat-sensitive liners), bearings/lubrication at slow speed, insufficient rigidity of improvised beds, and stepper issues (stalling, low-current speed plateau, noise); synchronization drift is a concern mainly for two-induction-motor schemes.

### Cited Findings
- Scroll chucks are "the most challenging part" of a prototype build — [YouTube Id93ObuINfI](https://www.youtube.com/watch?v=Id93ObuINfI)
- Chuck inserts can "fail by melting and/or breaking" under high heat — [US5158589A](https://patents.google.com/patent/US5158589)
- Sealed/"covered" bearing "was very stiff to rotate; the dense lubricant was replaced with thin oil" — [daliborfarny.com](https://www.daliborfarny.com/glass-working-lathe/)
- Plywood-mounted flanged bearings are "not ... the most rigid arrangement" though "sufficient" — [repairfaq.org](https://www.repairfaq.org/sam/gwl/)
- Stepper motors "plateau around 4500 [steps/s] on low-current drive"; firmware includes a proximity sensor "to detect unplanned motor slippage" and a vibration sensor that forces deceleration "if excessive shaking occurs" — [LatheDuino](https://github.com/DavidVanHorn/LatheDuino)
- "Steppers making noise but not spinning my lathe chuck" — [CNCZone 427728](https://www.cnczone.com/forums/stepper-motors-drives/427728-steppers-making-noise-spinning-lathe-chuck-advice.html)
- Two induction motors on VFDs "ramp together then drift apart" unless identical and ramp-matched — [Industrial Monitor Direct](https://industrialmonitordirect.com/blogs/knowledgebase/running-two-motors-on-one-vfd-sizing-torque-and-load-sharing)
- Generic chuck runout causes (dirt between chuck/backplate, incorrect mounting) and fixes (full disassembly and cleaning) — [Home Shop Machinist runout thread](https://bbs.homeshopmachinist.net/archive/index.php/t-53114.html)
- Plastic chucks: "quite dangerous if the plastic is not strong enough to resist the centrifugal forces" — [HomemadeTools 3D printed chuck](https://www.homemadetools.net/forum/3d-printed-lathe-chuck-2-5-a-71369)
- Standard scroll-chuck jaws "can't be turned around as they fit the scroll only one way" (limits cheap-chuck capacity tricks) — [Home Shop Machinist "flipping chuck jaws"](http://bbs.homeshopmachinist.net/archive/index.php/t-15227.html)

### Inferences
- The recurring DIY failure mode is work-holding, not drive: every cheap route (bored chuck, compression fitting, wood jaws) trades capacity or heat tolerance for cost.

### Gaps
- No retrievable first-hand report of bed flex, tailstock misalignment, glass-dust damage, or heat-killed spindle bearings on a DIY glass lathe (likely present in the blocked Hobby-Machinist/CNCZone/TalkGlass threads).

---

## Key Question 9: Minimum capability artists/scientific glassblowers say they need from a small lathe

### Takeaway
Sources converge on very low speed (10–60 rpm for most work, ≤180–400 rpm top), modest torque, and a bore sized to the tube actually used: 20–30 mm (OpenLathe) to 44 mm (homemade) for tube/nixie/lab work, 60–85 mm for the cheapest commercial artist lathes, with ≈4 in (100 mm) cited by machinists as "typical" for full-size scientific lathes.

### Cited Findings
- "the lathe's top speed only needs to be a hair over 60 rpm, most of the work will be done with 10-40 rpm" — [Practical Machinist cheap-o](https://www.practicalmachinist.com/forum/threads/building-a-glass-lathe-cheap-o.227302/)
- "does not require the torque that a metal or wood lathe requires, nor the top end speed, with top RPM requirements being 350-400 rpm" — [HomemadeTools.net](https://www.homemadetools.net/forum/glass-lathe-1079)
- diyvacuumtubes build: 5–180 rpm, 1.5 in compression holder — [diyvacuumtubes.com](https://diyvacuumtubes.com/my-glass-lathe-build-t57.html)
- OpenLathe: 20 mm bore (30 mm chucks possible), 24 in between spindles, 9.75 in swing — [Kickstarter](https://www.kickstarter.com/projects/1932619845/kube-openlathe-the-open-source-glass-blowing-lathe)
- Homemade unit: 44 mm bore, 600 mm between centers — [HomemadeTools.net](https://www.homemadetools.net/homemade-glass-lathe)
- Machinist view of full-size scientific lathes: "spindle through-hole of at least 4 inches" — [Practical Machinist](https://www.practicalmachinist.com/forum/threads/need-built-custom-glass-lathe.186669/)
- Cheapest commercial artist lathes: 60 mm bore (Arnold Mini), 85 mm (Seam floor model, Indian-made bench lathe) — [ABR Imagery](https://abrimagery.com/collections/lathes); [Seam](https://www.seamglasslathe.com/)
- Chinese factory lathes offered from 45 mm bore upward — [Made-in-China](https://www.made-in-china.com/manufacturers/glass-blowing-lathe.html)
- "the main specialized components are the tailstock and spindle bore" (why DIY is feasible) — [Practical Machinist affordable-lathe thread summary](https://www.practicalmachinist.com/forum/threads/affordable-lathe-recommendations.415688/)
- Glass-lathe function definition used by artists' guides: "two rotating, synchronized headstocks (chucks) that grip a piece of glass, usually tubing, and spin it on a horizontal axis so it heats and shapes evenly" — [glasstorches.com](https://glasstorches.com/guides/clusters/glass-lathes/); [Dickinson Glass](https://www.dickinsonglass.com/blog/glass-flameworking-lathe-machine-scientific-glassblowing)

### Inferences
- Because the 10–60 rpm working range is far below any motor's natural speed, every DIY design needs either a stepper (inherently slow and positional) or a large reduction (worm/HTD belt) — this is the single biggest reason steppers dominate DIY glass lathes.
- Bore, not length or speed, is the dominant cost driver: DIY designs stay at ≤45 mm because hollow spindles, through-bore bearings and bored chucks above that size become expensive.

### Gaps
- No artist-written "minimum spec" post (e.g., from TalkGlass "Looking for my first lathe", t-42804, or Practical Machinist "Glass lathe desired features", 271697) could be read; both threads exist and are the best next sources — [TalkGlass t-42804](http://www.talkglass.com/forum/archive/index.php/t-42804.html); [Practical Machinist 271697](https://www.practicalmachinist.com/forum/threads/glass-lathe-desired-features.271697/)
- The ilpi.com Scientific Glassblowing Learning Center lathe page likely states typical scientific-shop lathe sizes but was blocked — [ilpi.com](https://www.ilpi.com/glassblowing/glasslathe.html)
