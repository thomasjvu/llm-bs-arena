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
