# Prompt: plan a next-generation task manager for capable, over-ambitious, disorganized people

*(A prompt written for Claude, by Claude, to run when the user says "plan the task manager".)*

---

You are planning a product, not writing code yet. The deliverable is a plan the user can read
in one sitting and say "yes, build that" or "no, change this." Write it in plain English, short
sentences, no jargon without a one-line explanation.

## Who this is for

People who have more ideas, projects and opportunities than they can hold in their head, and
whose brains do not run on the "make a list, work the list" model. Many are neurodivergent
(ADHD, autism, dyslexia, or undiagnosed but "wired that way"). Common traits to design around:

- **Working memory is the bottleneck, not intelligence.** If a thought isn't captured within
  seconds, it's gone. If the plan isn't visible, it doesn't exist.
- **Time blindness.** "Later" and "in three weeks" feel the same. Deadlines arrive as surprises.
- **Interest-based motivation.** Importance alone doesn't start a task. Novelty, urgency,
  curiosity, competition, or another person do.
- **Task initiation is the hard part, not the work.** A vague or big task never starts. A
  concrete 10-minute first step often does.
- **Hyperfocus and crashes.** Energy comes in bursts. A system that assumes a steady 8-hour
  day fails on day two.
- **Shame spiral around overdue items.** A screen full of red overdue tasks makes people close
  the app forever. Every failed system they've tried taught them "I'm bad at this."
- **Over-commitment.** They say yes to everything because everything is interesting. They
  need help choosing, not more lists.
- **Re-entry cost.** After an interruption, they can't remember what they were doing or why.

They are capable. They finish things when the path is clear. The product's job is to make the
path clear, keep it in front of them, and be kind when they fall off.

## Non-negotiable product principles

Treat these as constraints, not features:

1. **Capture in under 3 seconds, one thumb, from anywhere.** Widget, share sheet, voice, lock
   screen. No form, no required fields. Sorting happens later, and can be done by the app.
2. **One screen answers "what should I do right now?"** Not a list of 40 things. One to three
   things, chosen by the app from energy, time available, context and commitments. Everything
   else is a tap away but not in the face.
3. **Never punish.** No red overdue badge counts. Missed items roll forward quietly. Language is
   neutral ("moved to today") never judging ("overdue by 12 days"). A "fresh start" button
   that archives the mess without deleting it.
4. **Projects break themselves down.** Adding a project prompts for the very next physical
   action, and the app (with an AI assist) suggests a breakdown the user can accept, edit or
   ignore. A project with no next action is flagged, gently.
5. **Ideas and opportunities have a home that is not the to-do list.** A parking lot with a
   periodic, fast triage ("still excited? yes / no / not now") so ambitions don't clog the day.
6. **Time is shown, not just dates.** Visual countdowns, "this is 3 workdays away", how much of
   today is actually free. Duration estimates on tasks, with a reality check from history.
7. **Re-entry is one tap.** "Where was I?" shows the last thing worked on, its next step, and
   the note the user left themselves.
8. **Learnable in five minutes, with no manual.** Three core concepts at most (for example:
   Inbox, Now, Someday). Advanced features unlock only after the basics are used, and can be
   ignored forever.
9. **Works when the user does nothing.** Daily plan builds itself from what's known. The user's
   only required habit is capturing and tapping "done".
10. **Privacy by default.** Personal ambitions, health context, work plans. Local-first data,
    sync optional, no selling of anything, AI features explain what leaves the device.

## What to produce

Work through these in order. Each section gets a heading, and each stays short enough to read
on a phone.

1. **Who and why (one page).** Three personas with a day-in-the-life each: the founder with 14
   half-started projects, the student/creative with ADHD juggling deadlines, the capable
   professional who is "fine at work, chaos at home". State the single job the product does for
   each. Name what they've already tried (Todoist, Notion, Things, paper, reminders, nothing)
   and precisely why each failed them.
2. **The core loop.** Describe the one habit the product runs on, in a diagram of no more than
   five boxes: Capture → app sorts → "Now" screen → do one thing → done/celebrate → repeat.
   Say what happens on a bad day (nothing captured, nothing done) and how the app recovers.
3. **Concepts and vocabulary.** The three (max four) nouns the user must learn, with the
   one-line definition each would get in the onboarding. Explicitly list nouns you are
   *refusing* to add (tags, priorities P1–P4, contexts, areas, perspectives…) and why.
4. **The "Now" engine.** How the app picks what to show. Inputs: deadlines, estimated
   duration, user's energy check-in (one tap: low/ok/high), time until next calendar event,
   what was recently touched, what has been avoided longest, what the user said matters this
   week. Explain the rules in plain English first; note where an AI model helps and where a
   simple rule is better and more predictable. Include how the user overrides it, and how it
   learns from "not now" taps without asking questions.
5. **Mobile UI plan.** Screen by screen, thumb-reachable, one primary action per screen.
   Sketch (in words or ASCII) the Now screen, the Capture flow, the Inbox triage, the Project
   view, the Ideas parking lot, and the weekly review. Say what is *not* on each screen. Define
   the gestures (swipe right = done, swipe left = not now, long-press = break it down) and keep
   them consistent. Cover accessibility: large text, reduced motion, screen reader, dyslexia-
   friendly font option, colour never the only signal.
6. **Motivation without manipulation.** Dopamine-aware, not dark-pattern. Streaks that forgive
   misses, visible progress on projects, a "done today" list that stays visible, optional body-
   doubling (a focus timer with a friend or a co-working room), novelty (a "surprise me" pick),
   and a hard rule list of things the app will never do (guilt notifications, fake urgency,
   engagement bait).
7. **Time and energy.** Duration estimates with a post-task "was that about right?" one-tap
   check, so estimates improve. Free-time calculation from the calendar. Energy-based
   filtering. Hyperfocus guard: a gentle "you've been on this 2h, water?" that can be turned off.
   Planning a day never over-fills it: the app leaves slack on purpose and says so.
8. **Ambition management.** How projects, ideas and opportunities get triaged into
   "committed / incubating / released". A cap on active projects with a friendly explanation.
   A monthly "what are you actually excited about?" review that takes under five minutes.
9. **Data model.** Just the entities and their fields, in a table. Keep it small. Note what
   must sync, what stays local, and what the AI features are allowed to read.
10. **Onboarding.** The first five minutes, step by step. First run must end with one captured
    item and one "Now" pick. No account required before value is shown.
11. **MVP scope.** Split every feature above into: MVP (the smallest thing that works for
    persona 1 for two weeks), v1.1, later, never. Be ruthless. The MVP list should fit on one
    screen.
12. **Success measures.** How we know it works for this audience specifically: day-14
    retention, capture-to-done ratio, "fresh start" usage (should exist, should be rare), how
    many overdue items exist per user (should be near zero by design), and a one-question
    weekly "did this help you finish something?" survey.
13. **Risks and open questions.** Including the honest one: many systems fail this audience at
    week three when novelty wears off. What in this design survives that, and what is a bet.
14. **Technical outline (one page, plain English).** Platform choice (native vs cross-platform),
    offline-first storage, sync approach, where AI runs (on device vs server) and the privacy
    consequence of each, notification strategy, and the widget/share-sheet/voice entry points
    per OS. Recommend one path, don't survey.
15. **Roadmap.** Phases with what each proves, roughly how long, and what the user needs to
    decide or provide before each starts.

## How to work

- Start by asking the user at most five questions, only ones that change the plan: which
  platform first (iOS/Android/both), solo or shared with a partner/team, whether calendar
  integration is essential from day one, whether AI features are welcome or off-putting, and
  what they personally have tried and abandoned. Then proceed with sensible defaults if
  answers are slow.
- Research what already exists before inventing: Sunsama, Tiimo, Amazing Marvin, Llama Life,
  Structured, Things, Todoist, Motion, Akiflow, Goblin Tools, and the ADHD-specific tools.
  Steal what works, name what you took, say what each gets wrong for this audience.
- Ground claims about neurodivergent needs in real sources (executive-function research,
  ADHD coaching practice, user communities), not in stereotypes. Say where you are guessing.
- Prefer one clear recommendation over a menu of options. Give the alternative in one line.
- Write for fast reading: bullets, tables, short paragraphs, a "Short version" of 3–6 bullets
  at the top of the whole plan.
- Every feature must trace back to a trait in "Who this is for" or a principle above. If it
  doesn't, cut it.
- End with a "decisions needed from you" list so the user knows exactly what to answer next.

## Quality bar

The plan is done when a designer could start wireframes from section 5, an engineer could
start the data layer from section 9, and the user could explain the product to a friend in two
sentences using only the vocabulary in section 3.
