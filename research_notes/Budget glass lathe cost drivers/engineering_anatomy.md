# Engineering Anatomy of Glass Lathes (glassworking lathes for scientific glassblowers and borosilicate artists)

**Research-access caveat (read first):** In this session every WebFetch call was refused by the network egress proxy (littonengr.com, arnold-gruppe.de, lathes.co.uk, patents.google.com, uspto.gov, practicalmachinist.com, ilpi.com, imajeenyus.com, scribd.com, wikipedia.org, etc. all blocked), and the session's WebSearch budget ran out after ~40 queries. All findings below therefore come from search-result excerpts of the cited pages, not from reading the full pages. Numbers quoted from manufacturer pages (Litton, Arnold, SincTech, Bethlehem) are verbatim from those excerpts and should be reliable; forum/opinion material is marked as such. Where an excerpt could not be tied to one specific URL, the most probable URL is cited and the item is flagged "(search excerpt)". Items that could not be sourced at all are listed under Gaps rather than asserted.

---

## Key Question 1: Subsystems of a glass lathe and how commercial makers implement them

### Takeaway
A glass lathe is a two-spindle machine: a fixed, motor-driven headstock and a sliding tailstock whose spindle is mechanically (Litton/Arnold/Heathway/Bethlehem: splined shaft or gearing/clutch) or electronically (SincTech: two stepper motors under one controller) locked to the headstock, both spindles hollow (25 mm to 530 mm bores across the industry), both carrying 3-jaw scroll or "planetary" pin chucks, with a burner "firecarriage" sliding on the bed between them, a continuous stainless heat shield over the ways, and low, continuously variable speed (roughly 5–300 rpm).

### Cited Findings

**Overall architecture / what makes it a glass lathe**
- A glass lathe has "two rotating, synchronized headstocks (chucks) that grip a piece of glass, usually tubing, and spin it on a horizontal axis so it heats and shapes evenly"; the headstock (usually left) is fixed and houses the main controls, the tailstock (right) slides toward or away from it, and "the two are motor driven and tied together mechanically so they never drift out of sync" — [glasstorches.com guide](https://glasstorches.com/guides/clusters/glass-lathes/) (search excerpt)
- "The headstock is fixed on the bed and rotates synchronously with the sliding tailstock, and there is a 'burner carriage' between them." Glass lathes "allow a glassblower to rotate two pieces of glass while fusing them together", with "gas jets on the carriage" — [Practical Machinist, "OT: what is a glass lathe"](https://www.practicalmachinist.com/forum/threads/ot-what-is-a-glass-lathe.193550/) (search excerpt)
- "Glass lathes have two spindles with 3-jaw chucks lined with ceramic cloth. The spindles are geared together to turn at the same slow rate, so the glass doesn't twist", allowing one part of a tube to be heated evenly around its circumference — [Practical Machinist, "OT: what is a glass lathe"](https://www.practicalmachinist.com/forum/threads/ot-what-is-a-glass-lathe.193550/) (search excerpt, forum opinion)
- "Glass lathes almost always have two 'chucks' to support the work piece and have a spindle thru-hole of at least 4"" — [Practical Machinist, "Building a glass lathe cheap-o"](https://www.practicalmachinist.com/forum/threads/building-a-glass-lathe-cheap-o.227302/) (forum opinion)
- Patent background (Wargo/Lobley scroll-chuck patent): in glassworking lathes it is necessary "to rotate both ends of a tubular workpiece simultaneously to minimize stresses, with motor-driven means rotating both chucks via suitable drive means" — [US 4,693,148 at freepatentsonline](https://www.freepatentsonline.com/4693148.html)

**Bed, ways, heat shield (Litton)**
- Litton HSJ (114 mm bore bench lathe): "The bed is covered by a continuous heat shield extending from under the headstock to the end of the ways." A "T-Slot Firecarriage Cover provides a base for mounting other apparatus to the firecarriage"; HSJ093 includes a "Rack & Pinion Burner Mount & T-Slot Firecarriage Cover"; "Lathe bed scales are also a standard feature." — [Litton HSJ product page](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714) and [MachineTools.com HSJ093](https://www.machinetools.com/en/models/litton-hsj093)
- "Heat shielding uses stainless steel bed cover to deflect radiant burner heat" — [ABR Imagery lathes collection](https://abrimagery.com/collections/lathes) (search excerpt; likely describing an Arnold or Litton listing)
- Litton EE (1979): "floor to ways height of 30-1/8"", "fire carriage travel distance of 36"" — [Revelation Machinery, Litton EE listing](https://revelationmachinery.com/product/litton-ee-glass-blowing-lathe-1979-dragbar-option-litton-engineering-laboratories/)

**Headstock / tailstock / traverse / declutch**
- Litton: "Behind the shielded bed is a splined shaft running from the headstock to the tailstock, with the tailstock having a sliding drive gear that moves as needed on this splined shaft. This keeps both headstock and tailstock in sync." "Most models have a way to disengage the tailstock rotation." — [Practical Machinist, "Litton glass blowing lathe"](https://www.practicalmachinist.com/forum/threads/litton-glass-blowing-lathe.81589/) (search excerpt, forum)
- "A glass lathe utilizes a splined shaft to connect the headstock and tailstock, with the tailstock sliding along this spline, and adjustable snubbers on both ends to take up slack." — [Practical Machinist, "Building a custom glassblowing lathe"](https://www.practicalmachinist.com/forum/threads/building-a-custom-glassblowing-lathe.150111/) (search excerpt, forum)
- Litton HSJ / U lathes: controls include "spindle On/Off, speed and direction controls, tailstock spindle On/Off switch, jog switch for spindles, and sockets which allow connection of remote control devices for control of spindle On/Off and speed functions" — [Litton HSJ page](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714); [MachineTools.com Litton U077](https://www.machinetools.com/en/models/litton-u077)
- Herbert Arnold Precision Mini 1060: "The headstock is fixed, the tailstock can be moved sensibly via toothed rack and handwheel. Against moderate surcharge the headstock can also be executed movable. The tailstock can be separated from the drive by means of an mechanical clutch. The rotation of the working spindles can be reversed." Standard accessories: "a burner support, a blowing swivel with holder, an electromagnetic brake, an electromagnetic clutch for the tailstock spindle, clamping units for the burner support and tailstock, and a set of tools." — [ABR Imagery, Arnold Precision Mini 1060](https://abrimagery.com/products/arnold-precision-mini-glass-lathe) (quoting Arnold literature)
- Heathway 1979 lathe (1-1/4" bore, 8" swing, 17" between spindles): "Right hand spindle travels left and right as well as the 'fire carriage'" — [Hobby-Machinist gallery listing](https://www.hobby-machinist.com/gallery/1979-heathway-11-4-bore-8-swing-glass-blowing-lathe-17-between-spindles-right-hand-spindle-travels-left-and-right-as-well-as-the-fire-carriage.35044/)
- German patent DE 2330395 A1 describes a glass-tubing lathe with "two longitudinally displaceable spindle heads with hollow working spindles with flanged-on chucks, with a common drive for both work spindles" and slotted chucks for quick workpiece changeover — [DE2330395A1, Google Patents](https://patents.google.com/patent/DE2330395A1/en) (search excerpt)

**Drive and speed control**
- Litton HSJ and U lathes: "infinitely variable 'V' belt drive" (i.e., a mechanical variator) with spindle speed range 10–240 rpm (HSJ) and 10–300 rpm (U) — [Litton HSJ page](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714); [MachineTools.com U077](https://www.machinetools.com/en/models/litton-u077)
- Litton Art Lathe: "200 rpm maximum operating speed" — [Litton Art Lathe page](https://www.littonengr.com/Products.cfm?pn=ART-21&pID=214); [Carlisle Machine Works lathe page](http://carlislemachine.com/glassblowing/lathe.php)
- Litton ME (36" swing): "maximum spindle speed of 5 to 280 RPM" — [eBay Litton ME listing](https://www.ebay.com/itm/395608048965)
- Aftermarket "Electric Lathe Motor w/ DC Speed Controller" sold for Litton / Herbert Arnold lathes: 1/4 hp, 1800 rpm, 22 lb, listed $895 — [eBay listing](https://www.ebay.com/itm/Tool-Electric-Lathe-Motor-W-DC-Speed-Controller-Litton-Herbert-Arnold-/261217026072)
- Litton HSA (large, discontinued) used listing: Dayton motor 3/4 hp @ 2500 rpm — [Recycled Goods HSA listing](https://recycledgoods.com/litton-hsa-glass-blowing-lathe/)
- Bethlehem GL-50A: 1/12 hp, 115 V 60 Hz motor — [MachineTools.com Bethlehem GL-100A / parttarget NSN data](https://www.parttarget.com/Bethlehem-Apparatus-International_nsn-parts_CW12_VP-2.html) (search excerpt)
- Litton U lathe electrical supply: 100–120 V AC, 50–60 Hz single phase — [MachineTools.com U077](https://www.machinetools.com/en/models/litton-u077)
- Generic: "A glassblowing lathe does not require the torque that a metal or wood lathe requires, nor the top end speed, with top RPM requirements being 350–400 rpm" — [lathemachine.org, "What is a glass lathe machine"](https://www.lathemachine.org/blog/what-is-glass-lathe-machine) (vendor blog, low authority)
- SincTech ADV-2AXL (electronic design): "In run mode, the chucks are locked in synchronization with powerful stepper motors under the control of the internal computer"; "the internal computer automatically synchronizes two stepper motors"; features "programmable speed memory, twist functionality, and foot pedal jog control"; spindle speed 0–200 rpm, CW or CCW; 115 VAC 60 Hz 1-phase 5.6 A — [SincTech specifications](https://sinctechlathes.com/specifications/); [SincTech controller features](https://sinctechlathes.com/internal-computer-control/)

**Spindles and chucks (hollow bore, scroll vs planetary, jaws)**
- Spindle bores across Litton's line: F lathe 33 mm (1-5/16"); Art Lathe 67 mm spindle / 52 mm scroll chuck bore; U lathe 79 mm (3-1/8"); EE lathe 98 mm (3-7/8"); HSJ 114 mm (4-1/2"); "A" designation 210 mm (8-1/4") and "B" designation 260 mm (10-1/4") spindle bores on large models — [Litton F lathe](https://www.littonengr.com/Products.cfm?pn=F11-111&pID=718); [Litton U lathe](https://www.littonengr.com/Products.cfm?pn=U11&pID=719); [Litton EE lathe](http://www.littonengr.com/Products.cfm?pn=EE125); [Litton HSJ](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714); [Litton Section 2 catalog PDF](https://www.littonengr.com/Downloads.cfm?fID=19&fCS=E0AFE933-3048-5243-DEC12FA4B96380A2&fID=19&fCS=E0AFE933-3048-5243-DEC12FA4B96380A2) (search excerpt for A/B designations)
- Herbert Arnold bores: 1025 "Assistent" 25 mm; 1040 "Assistent" 40 mm; V 1060 F/G 62 mm; V 1080 F/G/H 82 mm; floor models 2080 series 82 mm, 2100 series 112 mm; 2120/2160 series larger (bores not captured) — [ARNOLD Lathes PDF](https://downloads.arnold-gruppe.de/ARNOLD%20Lathes.pdf) (search excerpt); Precision Mini 1060 "built around a 60 mm bore" — [ABR Imagery](https://abrimagery.com/products/arnold-precision-mini-glass-lathe)
- Heathway: "small bench top models with a 32mm spindle bore, up to large floor standing models for quartz working with a 530mm spindle bore"; seven head sizes, four bed lengths — [lathes.co.uk Heathway page](https://www.lathes.co.uk/heathway/); [MachineTools.com Heathway Products Division](https://www.machinetools.com/en/companies/332126-heathway-products-division)
- "The spindle bore size is much larger than spindle bores found on metal or woodworking lathes, as glassblowing lathe capacity is partially determined by the size of the glass tubing able to pass through the spindle" — [lathemachine.org](https://www.lathemachine.org/blog/what-is-glass-lathe-machine)
- "Glass lathe spindles are typically hollow, with a blowhose attachment to allow the inside of work to be pressurised/evacuated while rotating" — [imajeenyus.com dual-spindle glass lathe](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml) (search excerpt)
- Litton chuck families: "Three jaw chucks available in configurations FC, UC, HC, EC, ESC, KC and KCB"; "UC planetary 3 jaw chuck with 3" bore for U or HSA Litton glass lathes"; "The chucks come with two sets of jaws; one set grips either the inside or outside of the glass, while the other set grips the outside surface only" — [E. McGrath, Litton UC planetary chuck](https://www.emcgrath.com/product/litton-uc-planetary-3-jaw-chuck/); [Litton chucks catalog PDF](https://www.littonengr.com/Downloads.cfm?fID=14&fCS=604279F5-3048-5243-DE559D38F06056E2&fID=14&fCS=604279F5-3048-5243-DE559D38F06056E2) (search excerpts)
- "Litton has introduced the planetary glass chuck"; "The most common chuck type for glass lathes is the planetary 3 jaw pin style, and this design offers the least amount of heat transfer and is best for holding a wide range of tubing diameters" — [Litton Heritage page](https://www.littonengr.com/About_Litton_Products.cfm) / [glasstorches.com](https://glasstorches.com/guides/clusters/glass-lathes/) (search excerpt; exact URL of second quote uncertain)
- Scroll vs planetary (forum opinion): "Many lathes have scroll chucks with modified jaws made of graphite as to not damage the glass, but it seems most glassblowers would rather use planetary chucks" for "better grip without cracking the glass and the ability to use larger tubing" — [Practical Machinist, "Planetary chucks for glassblowing lathe"](https://www.practicalmachinist.com/forum/threads/planetary-chucks-for-glassblowing-lathe.272554/)
- "Many glass lathe chucks have quite long chuck jaws in the shape of bobbins, with lobes both close to the chuck body and at the extended tips of the jaws" — [PolyTech Forum, "Boring out a 3-jaw chuck for a glass lathe?"](https://www.polytechforum.com/metalworking/boring-out-a-3-jaw-chuck-for-a-glass-lathe-44495-.htm) (search excerpt, forum)
- "Stainless steel jaw inserts are standard on some glass lathe chucks" — [ABR Imagery lathes](https://abrimagery.com/collections/lathes) (search excerpt)
- Indian maker Scientico: "Both spindles are typically equipped with 3-jaw precision ring chucks made from hardened alloy steel and fitted with taper wedges" — [Scientico Lab Equipments](https://www.scienticolabequipments.com/glass-blowing-lab-equipments.html) (vendor claim)
- US 4,693,148 (Wargo/Lobley, 1987) describes a glassworking chuck with "a chuck body rotatable with a drive spindle nose about a longitudinal axis and a handwheel rotatable about the same longitudinal axis"; "a spiral gear or scroll is fixed to the handwheel"; "jaw base members include spiral gear grooves" and "each jaw base member is adapted for optional complemental mating with a corresponding jaw outer member or with a planetary beam assembly thereby permitting the chuck to be configured as a scroll chuck or as a planetary chuck" — [US4693148 at Justia](https://patents.justia.com/patent/4693148); [freepatentsonline](https://www.freepatentsonline.com/4693148.html)
- US 2,398,959 "Vacuum chuck for glass lathes": lets "glass objects such as tubes ... be easily and quickly attached to and removed from a lathe chuck without breaking the glass" — [US2398959A, Google Patents](https://patents.google.com/patent/US2398959)
- US 4,082,531 "Holder for rotating glass body" (Floyd W. Kolleck, assigned to the US Government, granted 4 Apr 1978): "a tubular tip holder which may be held in a lathe chuck, and can utilize a variety of centering tips each adapted for a particular configuration, such as a glass O-ring joint or semi-ball joint"; its background notes that "Glass being fragile cannot be gripped tightly, and wobbling of the glass in the lathe chuck is common, which prevents centering in a precise manner" — [US4082531 at OSTI](https://www.osti.gov/biblio/863045); [Google Patents](https://patents.google.com/patent/US4082531)

**Rotary unions / swivels (air, vacuum)**
- Litton "Swivel/Stop System delivers sealed pressure or vacuum to the work, with a rotary union on the outboard end facilitating the delivery of pressure or vacuum via any air or vacuum source" — [Litton Section 5 General Accessories PDF](https://www.littonengr.com/Downloads.cfm?fID=24&fCS=E1538F1A-3048-5243-DEB48934193D074A&fID=24&fCS=E1538F1A-3048-5243-DEB48934193D074A) (search excerpt)
- Arnold Mini 1060 ships with "a blowing swivel with holder" — [ABR Imagery](https://abrimagery.com/products/arnold-precision-mini-glass-lathe)
- DIY implementation: "a pneumatic swivel coupling that consists of sealed ball bearings in a mount which provide a rotating airtight seal" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml) (search excerpt)
- Commodity blowhose: "1/4" diameter 90° angle swivel, six feet of 5/16" O.D. latex tubing and a mouthpiece" — [D&L Art Glass blowhose assembly](https://www.dlartglass.com/product/detail/blowhose-assembly-with-swivel)

**Burner carriage / burner mounts / torches**
- Litton: "rack and pinion firecarriage burner bracket" standard (U lathe); "Rack & Pinion Burner Mount & T-Slot Firecarriage Cover" (HSJ093) — [MachineTools.com U077](https://www.machinetools.com/en/models/litton-u077); [MachineTools.com HSJ093](https://www.machinetools.com/en/models/litton-hsj093)
- Litton Art Lathe: radial clearance 175 mm from spindle bore to firecarriage and 205 mm to cover plate — [Litton Art Lathe](https://www.littonengr.com/Products.cfm?pn=ART-21&pID=214)
- Litton EE: "radial clearance from adjustable burner mount of 11-5/8"" — [Revelation Machinery](https://revelationmachinery.com/product/litton-ee-glass-blowing-lathe-1979-dragbar-option-litton-engineering-laboratories/)
- Wale Apparatus sells "Litton Lathe Burners Seven Jet" (SKUs 9116SS, 9123SS, 9130SS, 9136SS, 9142SS, 9148SS) — [Wale Apparatus](https://www.waleapparatus.com/product/litton-lathe-burners-seven-jet); Carlisle CC "Plus" burner with centerfire tip on rack & pinion is sold as a lathe burner — [Carlisle CC burner PDF](http://carlislemachine.com/webcatalog/cc_burner.pdf)
- Third-party "Premium Lathe Torch Stand for Litton HSA, HSJ or HSD" exists (hand-torch mounting on the carriage) — [The Blast Shield](https://theblastshield.net/products/premium-lathe-torch-stand)
- Old patent exists specifically on lathe burners: US 2,781,832 "Burner for glass blowing lathe" — [Google Patents](https://patents.google.com/patent/US2781832A/en) (title only)

**Braking / jogging / foot pedal**
- Arnold Mini 1060: electromagnetic brake and electromagnetic clutch for tailstock spindle are standard — [ABR Imagery](https://abrimagery.com/products/arnold-precision-mini-glass-lathe)
- Litton HSJ/U: "jog switch for spindles" and "sockets which allow connection of remote control devices for control of spindle On/Off and speed functions" (foot controls plug in here) — [Litton HSJ page](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714)
- SincTech: "foot pedal jog control for synchronized spindle operation" — [SincTech controller features](https://sinctechlathes.com/internal-computer-control/)

### Inferences
- Every established maker (Litton, Arnold, Heathway, Bethlehem) uses a mechanical link between spindles (Litton: splined shaft with sliding gear in the tailstock; Arnold: a drive that can be de-clutched from the tailstock by a mechanical or electromagnetic clutch). Only the newer SincTech design uses two independently driven stepper motors locked electronically. This suggests electronic sync is a viable modern substitute for the long splined shaft.
- Litton's "infinitely variable V-belt drive" on HSJ/U lathes is a mechanical variator, while the aftermarket 1/4 hp DC motor + controller sold for Litton/Arnold lathes indicates that DC-motor speed control is a common retrofit. Motor power is tiny by machine-tool standards (1/12 hp Bethlehem GL-50A; 1/4 hp Litton retrofit; 3/4 hp on a ~4,000 lb Litton HSA).
- The "two sets of jaws" convention (one internal/external, one external-only) and the Wargo/Lobley interchangeable-jaw patent indicate jaw tooling is a modular, high-value accessory sold separately from the lathe.

### Gaps
- Bed construction material (cast iron vs. steel weldment, whether ways are ground) for Litton, Heathway, Arnold could not be verified; no page excerpt stated it.
- Spindle bearing type (ball, taper roller, plain bronze) for any commercial lathe: not found.
- Whether any maker uses chain or timing-belt drive to the tailstock (as opposed to splined shaft/gears): not found for commercial machines; chain-and-sprocket appears only in a DIY design (see KQ5/6).
- Water cooling of chucks or jaws: no source mentioned it; the only cooling-related statements are about heat shields and "least heat transfer" planetary pin jaws.
- Gas/oxygen plumbing on the carriage, lighting, and formal safety features: no detail found beyond "gas jets on the carriage" and the bed heat shield.
- Litton "dragbar option" (EE lathe) and Heathway "tilting lathe" thread titles were seen but not explained.

---

## Key Question 2: Key specs that matter (swing, distance between chucks, chuck capacity, runout, synchronization accuracy, low-speed stability)

### Takeaway
Manufacturer spec sheets lead with spindle bore, chuck bore/capacity, distance between chuck faces, radial clearance (swing) and speed range; the only hard runout number found is SincTech's "< ±0.005" (±0.13 mm) typical" and an Indian maker's "0.1–0.2 mm", which is 3–5x looser than a typical metal-lathe 3-jaw chuck (0.025–0.075 mm). No source quantified allowable phase error between spindles.

### Cited Findings

**Published spec tables (manufacturer data)**
- Litton Art Lathe (ART-21): 67 mm spindle bore, 52 mm scroll chuck bore, 741 mm distance between chuck faces, 175 mm radial clearance spindle-bore-to-firecarriage, 205 mm to cover plate, 200 rpm max — [Litton Art Lathe](https://www.littonengr.com/Products.cfm?pn=ART-21&pID=214); Carlisle: "can handle up to 67mm tubing and comes with two scroll chucks" — [Carlisle lathe page](http://carlislemachine.com/glassblowing/lathe.php)
- Litton HSJ: 114 mm (4-1/2") bore; max spindle nose-to-nose 1,429 mm; radial clearance above heat shield 232 mm; above T-slot firecarriage cover 190 mm; 10–240 rpm; HSJ093 ~189 kg (shipping 232 kg), HSJ143 ~222 kg (shipping 264 kg); overall 546 mm H x 482 mm W x 1,625 mm L (HSJ093) or 2,127 mm L (HSJ143) — [Litton HSJ page](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714)
- Litton U077: 79 mm (3-1/8") bore; 10–300 rpm; ~726 kg (1,600 lb), shipping 885 kg (1,950 lb) — [MachineTools.com U077](https://www.machinetools.com/en/models/litton-u077)
- Litton EE (1979): 3-7/8" bore, 12" spindle length, 49-1/4" max length, 36" firecarriage travel — [Revelation Machinery](https://revelationmachinery.com/product/litton-ee-glass-blowing-lathe-1979-dragbar-option-litton-engineering-laboratories/)
- Litton ME: 21-1/4" swing-over-bed clearance, 47-1/4" between centers, "swings 36"", 5–280 rpm — [eBay ME listing](https://www.ebay.com/itm/395608048965)
- Arnold 1025/1040 "Assistent": 25 / 40 mm bore; working length between spindle flanges 560, 750 or 1,000 mm; centre height above bed 140 mm; 2080 series 82 mm bore / 1,200 mm; 2100 series 112 mm bore / 1,200 mm; 2120 & 2160 series 1,600 mm working length — [ARNOLD Lathes PDF](https://downloads.arnold-gruppe.de/ARNOLD%20Lathes.pdf) (search excerpt)
- Arnold large: "#3360, 14" bore, 10' centers" offered used — [Surplus Record](https://surplusrecord.com/listing/herbert-arnold-3360-glass-lathe-14-bore-10-centers-746979/); "60" x 10' Glass Lathe w/ Torch Controls" — [BidSpotter](https://www.bidspotter.com/en-us/auction-catalogues/tauber-arons/catalogue-id-bsctau10123/lot-de2fd0b1-91d1-44b1-bbe5-ac13017bb90f)
- Bethlehem GL-50A: 11" swing, 1/12 hp, 39" L x 23" W x 21" H. GL-100A: 33" max between chuck jaws, 4.375" chuck capacity, 8" outside spindle diameter, 16" swing over bed, 51" x 35" x 15" — [MachineTools.com Bethlehem GL-100A](https://www.machinetools.com/en/models/bethlehem-apparatus-gl-100a); [parttarget NSN data](https://www.parttarget.com/Bethlehem-Apparatus-International_nsn-parts_CW12_VP-2.html)
- SincTech ADV-2AXL: max tube diameter in chuck 4.75" (120 mm); spindle bore 2.5" (63.5 mm); radial swing 9.125" (232 mm); max 31.25" (794 mm) between chuck faces, 24" (610 mm) between chuck jaws; 0–200 rpm; "Circular runout at chuck: Less than +/- 0.005" typical (+/- 0.13mm)" — [SincTech specifications](https://sinctechlathes.com/specifications/)
- Heathway examples: 9" bore, 7 ft bed (Type LCU/OFC 10-626) — [eBay](https://www.ebay.com/itm/284985728365); 1-1/4" bore, 8" swing, 17" between spindles (1979) — [Hobby-Machinist](https://www.hobby-machinist.com/gallery/1979-heathway-11-4-bore-8-swing-glass-blowing-lathe-17-between-spindles-right-hand-spindle-travels-left-and-right-as-well-as-the-fire-carriage.35044/); 14" bore model (discontinued) — [MachineTools.com](https://www.machinetools.com/en/models/heathway-14-bore-lathe)

**Runout / concentricity**
- Scientico (India): "Glass blowing lathes can achieve tolerances of just 0.1–0.2 mm, verified through dial gauge testing" — [Scientico Lab Equipments](https://www.scienticolabequipments.com/glass-blowing-lab-equipments.html) (vendor claim)
- SincTech: "< +/- 0.005" typical (+/- 0.13 mm)" circular runout at chuck — [SincTech specifications](https://sinctechlathes.com/specifications/)
- Reference point for metal lathes: "on three-jaw chucks the runout typically ranges from .001-.003 in (0.025-0.075 mm)" — [Practical Machinist, 3-jaw chuck runout](https://www.practicalmachinist.com/vb/south-bend-lathes/3-jaw-chuck-runout-220807/) (forum)
- Glass cannot be gripped tightly, so wobble in the chuck is common and limits precise centering — [US4082531 background, OSTI](https://www.osti.gov/biblio/863045)

**Speed range**
- Observed ranges: 5–280 rpm (Litton ME), 10–240 (Litton HSJ), 10–300 (Litton U), 0–200 (SincTech, Litton Art Lathe max 200) — sources as above
- "top RPM requirements being 350–400 rpm" — [lathemachine.org](https://www.lathemachine.org/blog/what-is-glass-lathe-machine) (vendor blog)

### Inferences
- The specs every maker publishes (and therefore the ones buyers compare) are: spindle bore, chuck bore / max tube diameter, max distance between chuck faces or jaws, radial clearance above the heat shield and above the firecarriage, and speed range. Weight and footprint follow bore size: ~190–220 kg for a 114 mm-bore bench lathe, ~730 kg for a 79 mm-bore floor lathe (Litton U), ~1,800 kg (4,000 lb) for the large Litton HSA.
- Acceptable runout for glass is an order of magnitude looser than for metal: 0.1–0.13 mm total indicated is marketed as adequate (SincTech, Scientico). This is consistent with soft glass centering itself once molten and with the US 4,082,531 statement that glass cannot be gripped tightly anyway.
- Because every maker lists a bottom speed of 0–10 rpm, low-speed torque smoothness (no cogging) matters more than top speed; this favors geared DC motors, variators, or steppers over a bare VFD-driven induction motor at 5% speed.

### Gaps
- No source quantified tolerable phase/angular error between headstock and tailstock while the tube is soft; only qualitative statements ("so the glass doesn't twist", "minimize stresses") were found.
- No source gave a speed-stability or speed-ripple specification.
- No source gave minimum tube diameter per chuck size (only maximums).

---

## Key Question 3: Which parts are genuinely hard or expensive to produce (cost drivers, failure points)

### Takeaway
Prices and listings point to the hollow-bore chucks as the single most expensive discrete component (Litton 32 mm scroll chuck $1,785; 52 mm $2,700; used planetary pairs ~$1,750), with a complete small Arnold bench lathe at $28,995 and a large used Arnold at ~$20,000; forum builders identify the long splined synchronizing shaft and its bearings/snubbers, and the large hollow spindles, as the elements that distinguish a glass lathe from a cheap metal lathe.

### Cited Findings
- Litton 32 mm scroll chuck $1,785; 52 mm scroll chuck $2,700 (new, list) — [Litton 32 mm scroll chuck](https://www.littonengr.com/Products.cfm?pn=97121-01&pID=728); [Litton chucks page](https://www.littonengr.com/Chucks.cfm)
- Used Litton EE scroll chuck (98 mm-bore lathe) $1,750 — [eBay](https://www.ebay.com/itm/327053978605); used pair of Litton HSA planetary chucks $1,750 — [PicClick](https://picclick.com/LITTON-HSA-Planetary-Chucks-Pair-for-Glass-Lathe-201872171933.html)
- Herbert Arnold Precision Mini 1060 (60 mm bore bench lathe) new: $28,995.00 — [ABR Imagery](https://abrimagery.com/products/arnold-precision-mini-glass-lathe)
- Used Herbert Arnold lathe with chucks: $20,000 — [PicClick](https://picclick.com/Herbert-Arnold-Glassblowing-Lathe-with-Chucks-Litton-Bethlehem-235504721940.html); used Litton HSA: previously $9,500 — [Recycled Goods](https://recycledgoods.com/litton-hsa-glass-blowing-lathe/); used Bethlehem GL-30: $3,150 — [PicClick](https://picclick.com/Bethlehem-Glass-Lathe-GL-30-183291700627.html); small used Litton lathe $1,649 (120 lb) — [Bid-on-Equipment](https://www.bid-on-equipment.com/machine-shop-and-tools/primary-machine-tools/lathes-and-turning-machines/350651~litton-glass-lathe.htm); Heathway bench-top S32 EV-1 listed £5,086.70 — [PicClick UK](https://picclick.co.uk/Heathway-Glassblowing-6-Inch-Lathe-186624093933.html)
- Replacement DC motor + controller for Litton/Arnold lathes: $895 — [eBay](https://www.ebay.com/itm/Tool-Electric-Lathe-Motor-W-DC-Speed-Controller-Litton-Herbert-Arnold-/261217026072)
- Synchronizing mechanism described by machinists: "splined shaft running from the headstock to the tailstock, with the tailstock having a sliding drive gear"; "adjustable snubbers on both ends to take up slack" — [Practical Machinist 81589](https://www.practicalmachinist.com/forum/threads/litton-glass-blowing-lathe.81589/); [Practical Machinist 150111](https://www.practicalmachinist.com/forum/threads/building-a-custom-glassblowing-lathe.150111/) (forum)
- Hobby machinists discussing budget builds focus on the chuck problem ("Boring out a 3-jaw chuck for a glass lathe?") and on bobbin-shaped long jaws — [PolyTech Forum](https://www.polytechforum.com/metalworking/boring-out-a-3-jaw-chuck-for-a-glass-lathe-44495-.htm); one home-brew approach pads extended external jaws with wood "so that glass can be held tightly without risk of cracking" — [Simplifier, Glassworking Chuck Jaws](https://simplifier.neocities.org/glassjaws) (search excerpt)
- Scroll chucks with graphite jaws are a known but disliked low-cost option vs planetary chucks — [Practical Machinist 272554](https://www.practicalmachinist.com/forum/threads/planetary-chucks-for-glassblowing-lathe.272554/) (forum opinion)
- Bethlehem GL-100 headstock gear sold as "Old. Rare parts" on eBay (indicates gear-driven headstock and parts scarcity) — [eBay Bethlehem GL 100 headstock gear](https://www.ebay.com/itm/326636256186)
- The Wargo/Lobley patent's commercial purpose was to let one chuck body serve as either scroll or planetary chuck via interchangeable jaw assemblies (reducing tooling cost per lathe) — [US4693148, Justia](https://patents.justia.com/patent/4693148)

### Inferences
- A pair of hollow-bore 3-jaw chucks alone lists at roughly $3,500–5,500 new for the smallest Litton sizes, i.e. a substantial fraction of a small-lathe price; chucks scale with bore and are the most natural place for a budget design to substitute (bored-out commodity scroll chucks with padded/graphite/stainless-insert jaws, as hobbyists already do).
- The long splined shaft with a sliding gear in the tailstock, plus end bearings and anti-backlash "snubbers", is a precision, length-dependent part that must stay aligned over a 1.4–3 m bed; it is the obvious candidate for replacement by electronically locked twin stepper/servo drives, which is exactly what SincTech does.
- Large spindles (114–530 mm bores) require large thin-section bearings and heavy castings; weight jumps from ~200 kg (114 mm bench) to ~730 kg (79 mm floor U) to ~1,800 kg (HSA) indicate that bed mass/length, not just bore, drives cost in floor machines.

### Gaps
- No maker or machinist statement was captured that explicitly ranks component costs or names recurring failure modes (e.g., spline wear, bearing failure, jaw warping). Litton manuals on lubrication/adjustment could not be opened.
- New-machine list prices for Litton lathes (F, U, HSJ) were not found; only used prices and the Arnold Mini 1060 new price.

---

## Key Question 4: How glass lathes differ from metal lathes (why a metal lathe cannot be used directly)

### Takeaway
Sources consistently cite four differences: a driven, synchronized tailstock spindle; large hollow bores on both spindles for tubing, air and vacuum; very low speeds (0–300 rpm) with little torque needed; and radiant heat from burners requiring heat shields and heat-tolerant jaws, with negligible cutting forces and no swarf.

### Cited Findings
- "A metalworking lathe drives only the headstock, while a glass lathe drives both ends with two spindles that are synchronized and rotate together at the same speed" — [glasstorches.com](https://glasstorches.com/guides/clusters/glass-lathes/) (search excerpt)
- "A glass lathe is very similar to a metalworking lathe, except that it has two spindles which are synchronised and rotate together"; "Forces experienced in a glass lathe are far less than in a similar metalworking lathe" — [imajeenyus.com dual-spindle glass lathe](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml) (search excerpt)
- "A glassblowing lathe does not require the torque that a metal or wood lathe requires, nor the top end speed ... top RPM requirements being 350–400 rpm"; "The spindle bore size is much larger than spindle bores found on metal or woodworking lathes" — [lathemachine.org](https://www.lathemachine.org/blog/what-is-glass-lathe-machine)
- Spindles are hollow "with a blowhose attachment to allow the inside of work to be pressurised/evacuated while rotating" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml)
- Heat management is a design feature: "continuous heat shield extending from under the headstock to the end of the ways" (Litton HSJ) — [Litton HSJ](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714); planetary pin jaws chosen for "least amount of heat transfer" — [glasstorches.com](https://glasstorches.com/guides/clusters/glass-lathes/) (search excerpt)
- Chuck jaws are "lined with ceramic cloth" and spindles "geared together ... so the glass doesn't twist" — [Practical Machinist 193550](https://www.practicalmachinist.com/forum/threads/ot-what-is-a-glass-lathe.193550/) (forum)
- Motor sizes are tiny: 1/12 hp (Bethlehem GL-50A), 1/4 hp retrofit motor for Litton/Arnold, 3/4 hp for the ~4,000 lb Litton HSA — [parttarget](https://www.parttarget.com/Bethlehem-Apparatus-International_nsn-parts_CW12_VP-2.html); [eBay motor](https://www.ebay.com/itm/Tool-Electric-Lathe-Motor-W-DC-Speed-Controller-Litton-Herbert-Arnold-/261217026072); [Recycled Goods HSA](https://recycledgoods.com/litton-hsa-glass-blowing-lathe/)
- Hobbyists do adapt metal-lathe hardware: one DIY design "uses standard Taig lathe components and uses two stepper motors, driven in-phase, to achieve synchronous rotation of the spindles" — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml) (search excerpt)

### Inferences
- Because cutting forces are negligible, bed stiffness requirements are far lower than for a metal lathe; what the bed must provide is straightness/alignment between two spindles over 0.7–3 m, carriage travel, and heat resistance. This supports building a budget bed from linear rails or ground bar on a steel weldment rather than a cast-iron metal-lathe bed.
- The large hollow bore at both ends is incompatible with a metal lathe's solid tailstock quill; even a big-bore metal lathe only has a hollow headstock.

### Gaps
- No academic or textbook (Wheeler, Barbour, ASGS "Fusion") passage on glass-vs-metal lathe design could be retrieved in this session.

---

## Key Question 5: Patents on glass lathe designs or chucks

### Takeaway
Several directly relevant patents exist (US 4,693,148 scroll/planetary interchangeable-jaw chuck, US 2,398,959 vacuum chuck, US 4,082,531 centering holder, US 5,803,944 blowing lathe, DE 2330395 common-drive twin-spindle tubing lathe, US 2,781,832 lathe burner, plus US 3,810,748 and US 2012/0186302), but only abstracts/claims excerpts could be accessed; none found was assigned to Litton, Heathway or Arnold.

### Cited Findings
- **US 4,693,148** "Glassworking scroll chuck with interchangeable jaws" (assignee Andrew J. Wargo; inventor David M. Lobley): chuck body rotates with the drive spindle nose; a handwheel on the same axis carries the scroll; jaw base members with spiral grooves move radially; each base optionally mates with a jaw outer member or a "planetary beam assembly", so the user can configure the chuck as scroll or planetary. Background: both ends of the tubular workpiece must be rotated simultaneously "to minimize stresses" by motor-driven means — [Justia](https://patents.justia.com/patent/4693148); [freepatentsonline](https://www.freepatentsonline.com/4693148.html); [USPTO PDF](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/4693148)
- **US 4,524,983** "Coordinated lathe chuck" — [USPTO PDF](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/4524983) (title only; content not accessible)
- **US 2,398,959** "Vacuum chuck for glass lathes": quick attach/remove of glass tubes without breakage — [Google Patents](https://patents.google.com/patent/US2398959)
- **US 4,082,531** "Holder for rotating glass body" (Kolleck, US Government/DOE, 4 Apr 1978): tubular tip holder held in a lathe chuck with interchangeable centering tips for O-ring and semi-ball joints; background notes glass cannot be gripped tightly and wobbles in the chuck — [OSTI](https://www.osti.gov/biblio/863045); [Google Patents](https://patents.google.com/patent/US4082531)
- **US 5,803,944** "Lathe for blowing glass" (Robert Domka; priority 26 Mar 1997, published 8 Sep 1998, expired): claims involve a blowpipe, motor, gear and lathe mechanism — [Google Patents](https://patents.google.com/patent/US5803944); [Justia](https://patents.justia.com/patent/5803944)
- **DE 2330395 A1** "Glass tubing lathe – has slotted chucks and spindles for easy workpiece changeover": two longitudinally displaceable spindle heads, hollow working spindles with flanged-on chucks, common drive for both spindles — [Google Patents](https://patents.google.com/patent/DE2330395A1/en)
- **US 2,781,832** "Burner for glass blowing lathe" — [Google Patents](https://patents.google.com/patent/US2781832A/en) (title only)
- **US 3,810,748** "Glass processing lathe" and **US 2012/0186302 A1** "Glass lathe" — [Google Patents US3810748](https://patents.google.com/patent/US3810748); [Google Patents US20120186302A1](https://patents.google.com/patent/US20120186302A1/en) (titles only)
- **US 4,767,125** "Expansion chuck" appeared in the glass-lathe chuck search — [Google Patents](https://patents.google.com/patent/US4767125A/en) (title only)

### Inferences
- The interchangeable scroll/planetary chuck patent (1987) is the most informative mechanical description found: it confirms a handwheel-actuated scroll on the chuck's own axis (needed because there is no T-key access through a hollow spindle) and codifies the two jaw styles the market uses.
- The DE 2330395 patent (1970s, German) confirms the twin-displaceable-spindle, common-drive architecture used by Arnold-style machines where the headstock can also be made movable.

### Gaps
- Full patent texts (drawings, dimensions, drive descriptions, assignees of DE 2330395, US 3,810,748, US 2012/0186302, US 4,524,983) could not be read because patents.google.com, uspto.gov, justia and freepatentsonline were all blocked for fetch in this session.
- No patent assigned to Litton Engineering, Heathway, or Herbert Arnold was identified by search; a dedicated assignee search could not be completed.

---

## Key Question 6: Sizes and weights of typical machines (small artist lathes to large scientific lathes), plus DIY benchmarks

### Takeaway
Bench artist/scientific lathes with 60–114 mm bores weigh roughly 120–220 kg and are 1.6–2.1 m long; a 79 mm-bore floor lathe (Litton U) is ~726 kg; the large Litton HSA is ~1,800 kg (4,000 lb) and Heathway/Arnold quartz lathes reach 14" (356 mm) to 530 mm bores on 7–10 ft beds.

### Cited Findings
- Litton HSJ093: ~189 kg (shipping 232 kg), 1,625 mm L x 482 mm W x 546 mm H; HSJ143: ~222 kg (shipping 264 kg), 2,127 mm L — [Litton HSJ page](https://www.littonengr.com/Products.cfm?pn=HJ11-211&pID=714)
- Litton U077: ~726 kg (1,600 lb), shipping 885 kg (1,950 lb) — [MachineTools.com U077](https://www.machinetools.com/en/models/litton-u077)
- Litton HSA: "weighs approximately 4000 pounds" — [MachineTools.com Litton HSA](https://www.machinetools.com/en/models/litton-hsa); contradicted by a used-equipment listing giving "450 pounds" with a 3/4 hp Dayton motor — [Recycled Goods](https://recycledgoods.com/litton-hsa-glass-blowing-lathe/) (likely a mislabelled or partial listing; treat the 4,000 lb figure as more plausible for an 8-1/4"/10-1/4"-bore class machine)
- Small Litton lathe (4" tabletop class) used listing: 120 lb — [Bid-on-Equipment](https://www.bid-on-equipment.com/machine-shop-and-tools/primary-machine-tools/lathes-and-turning-machines/350651~litton-glass-lathe.htm); "litton glass lathe 4" tabletop" — [eBay](https://www.ebay.com/itm/404169950419)
- Litton EE: 49-1/4" max length, 30-1/8" floor-to-ways (floor-standing) — [Revelation Machinery](https://revelationmachinery.com/product/litton-ee-glass-blowing-lathe-1979-dragbar-option-litton-engineering-laboratories/)
- Bethlehem GL-50A: 39" x 23" x 21"; GL-100A: 51" x 35" x 15", 8" outside spindle diameter — [MachineTools.com GL-100A](https://www.machinetools.com/en/models/bethlehem-apparatus-gl-100a)
- Arnold bench "Assistent": working lengths 560 / 750 / 1,000 mm; floor 2080/2100: 1,200 mm; 2120/2160: 1,600 mm — [ARNOLD Lathes PDF](https://downloads.arnold-gruppe.de/ARNOLD%20Lathes.pdf) (search excerpt); large Arnold: 14" bore, 10 ft centers — [Surplus Record](https://surplusrecord.com/listing/herbert-arnold-3360-glass-lathe-14-bore-10-centers-746979/)
- Heathway: 32 mm to 530 mm bores; 9" bore on 7 ft bed; 14" bore model — [lathes.co.uk](https://www.lathes.co.uk/heathway/); [eBay](https://www.ebay.com/itm/284985728365); [MachineTools.com](https://www.machinetools.com/en/models/heathway-14-bore-lathe)
- SincTech ADV-2AXL: 794 mm max between chuck faces, 232 mm radial swing, 63.5 mm bore, 115 V / 5.6 A — [SincTech specifications](https://sinctechlathes.com/specifications/)
- DIY benchmark 1: Taig-component lathe with two in-phase stepper motors for synchronous rotation and a sealed-ball-bearing pneumatic swivel — [imajeenyus.com](http://www.imajeenyus.com/workshop/20110125_glass_lathe/index.shtml) (search excerpt)
- DIY benchmark 2 (home-made mini lathe guide): spindles coupled by "a piece of 8mm square steel bar mounted below the spindles ... mounted in bearings at either end and ... driven from the fixed spindle with a chain and sprocket drive. An identical chain and sprocket drives the moveable spindle" — [Scribd, "Home Made Mini Glass Working Lathe"](https://www.scribd.com/document/64543108/Home-Made-Mini-Glass-Working-Lathe) (search excerpt)
- Other DIY/discussion threads located but not readable: [Dalibor Farny glass working lathe](https://www.daliborfarny.com/glass-working-lathe/); [CNCZone newbie glass lathe build](https://www.cnczone.com/forums/uncategorised-metalworking-machines/129981-glass-lathe-build.html); [ATXHS "DIY CNC glassblowing lathe"](https://groups.google.com/g/atxhs-discuss/c/1roUvBj09sc); [Practical Machinist "Glass lathe desired features"](https://www.practicalmachinist.com/forum/threads/glass-lathe-desired-features.271697/)

### Inferences
- A "4-inch" artist lathe (≈100 mm bore class) is a ~120–220 kg bench machine; a "12-inch" scientific/quartz lathe (260–356 mm bore) is a multi-tonne floor machine on a 7–10 ft bed. Bed length and bore both roughly double between classes while mass rises ~10x.
- The two DIY builds that were found both abandoned the commercial splined shaft: one used twin in-phase steppers, the other a square bar with chain/sprocket at each spindle, confirming these as the practical low-cost synchronization routes.

### Gaps
- Weights for Arnold models, Heathway models, Litton F and Art lathes, and Bethlehem lathes were not found.
- DIY build costs, bore sizes, bearing choices and lessons-learned could not be read because the hosting sites were blocked.
