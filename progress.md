Original prompt: the game frontend isn't working. nothing is happening. and the frontend looks pretty bad. audit and investigate it fully so we can get it fully working. it looks stalled. and we aren't seeing all the character images appropriately and stuff it all feels scattered. get it all working correctly and organized better

2026-04-16
- Resumed the frontend recovery pass with the explicit implementation plan.
- Confirmed the old UI still had the broken slot-swapping renderer, hidden launcher flow, malformed CSS, and wrong Minimax/Nemotron art mapping.
- Replaced the UI shell with a launcher-first layout, stable slot mapping, and a cleaned theme registry keyed to the frozen cohort.
- Split the frontend into `ui/app/storage.js`, `ui/app/layout.js`, `ui/app/api.js`, `ui/app/effects.js`, and `ui/app/render.js`.
- Rebuilt `ui/styles.css` around the new arcade-drama stage layout and first-class human action dock.
- Replaced that palette with a flat white/black minimalist stylesheet after the user rejected the brown scheme.
- Added a global `[hidden] { display: none !important; }` rule because the overlay components were overriding the browser default and making the winner modal show on first paint.
- Restored full-color character art and thumbnails after the user rejected the monochrome treatment.
- Removed the per-model subtitle labels from the table cards.
- Added stronger turn ownership and objection signaling: current-turn seat badges, louder objection/current-turn banner states, and clearer objection phrasing in the seat actions/log.
- Compressed spacing and card/avatar sizing further so the page reads flatter and denser.
- Added `src/server-state.ts` so the interactive client payload shaping is testable and consistent.
- Remaining manual follow-up: open `http://localhost:3001`, verify the launcher flow and visual polish in a real browser, and tune spacing/contrast if anything still feels off.

2026-04-16
- Created and switched to the dedicated cinematic design branch `codex/design-cinematic-stage` from the dirty worktree so the redesign can continue without disturbing `main`.
- Replaced the gameplay shell with a desktop-first cinematic HUD: compact top claim/turn/discard row, fixed four-seat cast strip, Phoenix-style lower-third dialogue box, utility drawer, and full-screen cue overlay.
- Rewrote `ui/styles.css` around the new one-page no-scroll presentation and removed the old dashboard/stage card styling entirely.
- Kept spectator hand peeks as overlay trays so they do not change layout height, and kept human actions inside the lower-third rather than a floating dock.
- Suppressed model reasoning notes in the public log for interactive mode so live play stays action-only.
- Light verification only: `node --check ui/app.js ui/app/render.js ui/app/layout.js ui/model-themes.js` all passed.
- Remaining manual follow-up: open the page on desktop, confirm all four portraits stay visible at once with no document scroll, and tune exact portrait cropping/alignment if any specific model art still feels off in-browser.

2026-04-16
- Reworked the cinematic layout again after browser screenshots: the active / accused player now owns the full left column and the other three players sit together on the right as a judge bench.
- Updated `ui/app/layout.js` so the focused player is the accused actor during objection windows, not the human challenger, and kept the turn ribbon aligned with that same actor.
- Moved the dialogue box into the left column under the actor stage so the bottom section no longer reads like a separate full-width slab.
- Flattened the top HUD and removed most panel framing: claim, turn order, round, and discard now read as one looser header with separators instead of boxed cards.
- Reduced visible borders across the board and shifted the stage toward softer surfaces, divider lines, and contrast-based focus rather than card-like boxes.
- Light verification only for this pass: `node --check ui/app.js ui/app/render.js ui/app/layout.js` passed.
- Remaining manual follow-up: inspect the new actor/judge split in browser and tune exact spacing, judge portrait crop, and header breathing room from screenshots instead of broad rewrites.
