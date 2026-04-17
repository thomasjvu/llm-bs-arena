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

2026-04-16
- Implemented the flat cinematic polish pass on `codex/design-cinematic-stage`.
- Judge portraits now render as true front/back flip cards in spectator mode: hover reveals on desktop and tap toggles one reveal at a time on touch.
- Rebuilt the turn order into image-over-name tiles and replaced the `menu` pill with a hamburger button.
- Reworked the dialogue area into a flatter visual-novel box and removed remaining shadow/gradient-heavy chrome from the live board.
- Updated `ui/cards.js` to use flatter SVG cards and nudged the center suit icon left for better centering.
- Switched Nemotron and unknown/unapproved model art to the GLM portrait set temporarily, with the placeholder TODO documented in `ui/model-themes.js`.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/app/layout.js`, `ui/model-themes.js`, and `ui/cards.js` passed.

2026-04-16
- Adjusted spectator judge-hand behavior: judge card trays now stay visible as facedown cards, and only the hovered/tapped judge flips that tray face-up.
- Added more table motion: resolved plays now animate into the pile, and challenged piles animate back to the loser seat after objections resolve.
- Normalized displayed model names through frontend theme short names so verbose provider/model ids stop leaking into the main VN dialogue.
- Flattened the dialogue box further, fixed its height bands so the main text area stays stable, and shrank/restyled the hamburger to a small black button with white bars.
- Added turn-order arrows, moved discard metadata to the right of the pile, and constrained actor/judge portrait art to the same max visible size.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/app/effects.js`, `ui/app/layout.js`, `ui/model-themes.js`, and `ui/cards.js` passed.

2026-04-16
- Replaced the actor-left / judge-stack composition with a fixed 4-column board so all four players stay visible at equal scale in a stable seat order.
- Removed the fullscreen cinematic cue path and replaced it with inline attention flashes on the affected seat columns plus the claim/pile zones.
- Kept spectator hand trays always visible as facedown cards for every visible player hand, with hover/tap revealing only that one player at a time.
- Removed standby `ready` filler tags from idle seats and kept the VN strip at a fixed height under the board.
- Rebuilt the DOM and stylesheet around the new board structure, including a portrait-mobile orientation guard that blocks the app and asks the user to switch to landscape.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/app/layout.js`, and `ui/app/effects.js` passed.

2026-04-16
- Increased portrait presence again and overlaid the facedown hand trays onto the lower part of each character stage so the figures dominate the columns instead of sitting above separate card rows.
- Split seat emphasis into explicit acting vs judging states and restyled them as spotlight overlays plus outlines on a consistent white stage, instead of changing the whole column background.
- Added a spectator-specific live feed in the bottom VN strip so autoplay surfaces the recent public events in sequence instead of only showing the player-mode narration block.
- Added subtle round metadata to each public log entry, including the log drawer and the new spectator feed.
- Swapped the UI font stack to bolder system display/body fonts and nudged the large center suit icon in `ui/cards.js` further left to correct the card-face centering.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, and `ui/cards.js` passed.

2026-04-16
- Added explicit per-challenger public decision history to the server turn state and exposed a `currentTurnFeed` snapshot in `buildClientGameState`, so the spectator UI no longer has to infer pass/challenge flow from recent logs.
- Reworked spectator bottom-strip rendering to show only the current play-cycle transcript: claim, each judge pass/challenge in order, and final resolution, with the feed resetting automatically when the next play begins.
- Removed resolved-turn portrait leakage like `holds` by making seat shouts and badges depend only on live phase state, and corrected the actor-vs-judge portrait logic for current thinking states.
- Fixed the autoplay control so `stop` remains clickable while autoplay is running, and updated hover-reveal cards to animate left-to-right with staggered face-up flips.
- Shifted the seat layout further toward figure-dominant columns: portraits scale larger, idle portraits fade back, footer metadata overlays at the bottom, and the old orange live spotlight treatment is gone.
- Updated targeted tests for the new fixed-slot frontend assumptions and added server-state coverage for pending/resolved current-turn feeds including explicit pass entries.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/cards.js` and `npx vitest run src/test/server-state.test.ts src/test/frontend-ui.test.ts` all passed.
