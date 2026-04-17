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

2026-04-16
- Reworked the live shell into a real two-column app layout: the hamburger now opens a right-side panel that pushes the board left instead of layering popup utility, log, and stats drawers on top of the stage.
- Updated the top HUD to a `25 / 50 / 25` composition so required claim, turn order, and round/discard align more cleanly with the four-seat board below.
- Switched the turn ribbon to frontend short names and kept the larger portrait-over-name tile format with arrows between seats.
- Added a lightweight Web Audio feedback layer for objections, resolutions, and pile pickups, with a persisted `soundEnabled` preference and sidebar toggle.
- Added restrained stage shake on challenge and resolution impacts, without bringing back fullscreen objection overlays.
- Fixed the spectator hover-rerender bug by stabilizing peek-tray render keys so an already-open tray does not re-flip on unrelated state updates.
- Replaced the last ambiguous `hold it!` / `defense` seat copy with literal live-state labels like `challenged` and `judge`.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/app/audio.js`, `ui/app/effects.js`, `ui/cards.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-16
- Reshaped the HUD again around clearer table-state scanning: the center column now shows the live table state (`2 x 7 on table`, `A required`, `winner decided`) plus a secondary action line, while the turn ribbon moved into the right header column above round/discard.
- Increased portrait scale further so the character art fills more of each column and removed the footer background overlay so name/card metadata sits directly on the stage art.
- Adjusted finished-game seat logic so the winner screen shows `winner` for the winning player and `lose` for everyone else instead of leaving live turn/judge/challenged language behind.
- Nudged the small corner suit icons in `ui/cards.js` inward on both the top-left and bottom-right corners to better center them beside the rank markers.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/cards.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-16
- Rebuilt the top HUD into strict `33 / 33 / 33`: left column now combines the oversized required claim with round/discard to its right, the middle column is a larger live table-state readout, and the right column is turn order only with no heading.
- Extended frontend persistence to track `activeGameId` and spectator autoplay resume intent, and switched load behavior from blind `startNewGame()` to reconnecting through the existing `GET /api/game/:id/state` route when possible.
- Fixed the refresh mismatch bug by restoring the existing game state on load, resuming spectator autoplay only when it was previously active, and clearing stale stored sessions when the server no longer has the game.
- Cleaned up seat emphasis so inactive seats fade as a whole, routine live-state labels are badge-only, footer status chips no longer duplicate `judge`/`acting`/`challenged`, and finished tables show only `winner` or `lose`.
- Corrected the spectator truth leak: the main HUD now stays public-only after unchallenged turns (`claim stands` instead of leaking `lie exposed`), while the sidebar log may show hidden truth after resolution in spectator mode.
- Added a subtle challenge “whistle” particle effect near the challenged character’s face and pushed the synthesized audio cues toward a more playful, pronounced tone.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/app/audio.js`, `ui/app/storage.js`, `ui/app/api.js`, `ui/cards.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-16
- Reskinned the right-side drawer into a full black in-game control panel with white text, white-on-black tabs, dark form controls, and matching log/stats styling.
- Removed the sidebar runtime/status chips entirely and added an always-available experiment guide under the selector with research-accurate descriptions for all four experiment conditions.
- Restyled the round counter as a compact top-spiral notebook card in the left HUD column while keeping the `33 / 33 / 33` header layout stable.
- Wired the experiment guide rendering into the frontend render path so the selected experiment stays emphasized as the selector changes.
- Light verification only: `node --check ui/app.js`, `node --check ui/app/render.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-16
- Added a client-side challenge reveal beat: challenged resolutions now hold the table for roughly 2 seconds, with an initial objection beat followed by a stronger winner/loser result beat before autoplay continues.
- Wired the dormant objection-resolution portrait states into that reveal phase, added a visible dedicated whistle particle layer for challenged claimants, and reduced spectator seat trays from 6 visible cards to 5.
- Removed the sidebar stats tab and added a dedicated `ui/stats.html` research summary page driven by the existing `/api/stats` API and shared experiment metadata.
- Tightened the left HUD spacing so required claim sits farther from the round notebook while the round and discard cluster sit closer together.
- Documented the current frontend asset audit in `ui/model-themes.js`, including active folders, unused folders, placeholder Nemotron behavior, and the newly used reveal-only states.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, `ui/stats.js`, `ui/model-themes.js`, and `npx vitest run src/test/frontend-ui.test.ts` all passed.

2026-04-17
- Fixed the manual-play surface layout so the human hand row gets dedicated space in the bottom strip instead of being clipped by the narration/banner rows inside the fixed-height dialogue box.
- Fixed the manual cross-examination grammar so the human seat now reads `You are...` instead of `You is...`.
- Replaced the temporary judge `?` cue with the supplied animated scribble SVG and moved it slightly higher above the judging character.
- Rebalanced the top HUD so required claim sits left, the notebook round card is centered, discard sits right, and the middle status subtitle now sits above a larger main state line.
- Flattened the card back further by removing the dot pattern and switching the center diamond sigil to a filled black mark.
- Removed the remaining dashed inner border from the card back, increased seat tray previews from 5 to 6 cards, and kept multi-row stacking only for the human player’s fully revealed tray.
- Added a subtle pulse to the actively thinking actor and a small live timer in the dialogue header so each message beat shows how long it has been on screen.
- Renamed the objection-resolution portrait assets to `objection_safe` / `objection_correct`, and updated reveal logic so objection outcomes use those dedicated poses plus `lose` instead of incorrectly reusing the game-winning `win` pose.
- Added explicit bottom-strip render modes (`manual-play`, `manual-challenge`, `spectator-feed`, `idle`) and used them to hide redundant narration while human action panels are open.
- Made manual play render the human hand whenever the hand array is present, added a fallback `hand unavailable` message if it is empty, and slightly enlarged the visible cards in play mode.
- Compressed the launcher into a shorter `spectator` / `manual` picker with tighter copy, smaller cards, a smaller heading, a denser control row, and a shorter launch button label.
- Light verification only: `node --check ui/app.js`, `ui/app/render.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-17
- Replaced the gray whistle particles with a right-side drifting monospace `*whistle*` text effect that only appears while a claimant is actively under challenge.
- Fixed the manual action strip again so human turns dominate the bottom panel: manual challenge now suppresses the banner above it, manual play renders from `humanPlayerId`, and the play/challenge panels get more dedicated height.
- Extended `ChallengeDecision` to store per-judge reasoning and sanitized that reasoning in client state, so spectator mode can render each pass/challenge explanation in order without leaking model traces into manual mode.
- Rebuilt the sidebar log into grouped turn traces: claim, each judge response, and final resolution now render as separate rows per turn, with reasoning notes only in spectator mode.
- Targeted verification only: `node --check ui/app/render.js` and `npx vitest run src/test/server-state.test.ts src/test/frontend-ui.test.ts` passed.

2026-04-17
- Updated interactive seat trays so manual mode always shows facedown cards for every player column instead of hiding trays entirely.
- Kept hover/tap reveal privacy-preserving in manual mode: only the human seat can flip face-up, while opponent trays stay facedown.
- Targeted verification only: `node --check ui/app.js`, `node --check ui/app/render.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-17
- Moved the `*whistle*` layer closer to the challenged portrait and shortened its drift so it reads as attached to the character instead of floating off-column.
- Added a seat-level judge-thinking FX layer: the current judge now gets a fast spinning scribble-ball above their head during the live challenge window.
- Increased manual action-strip space again, collapsed the empty hand row in challenge mode, and let the human seat reveal the full hand on hover/tap instead of capping at five face-up cards.
- Extended the incoming objection beat before the result state by roughly half a second and lengthened the total reveal window to preserve result readability.
- Targeted verification only: `node --check ui/app/render.js`, `node --check ui/app.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-17
- Changed the judge cue from the spinning scribble-ball to a simpler floating question mark above the active judge’s head.
- Updated the human full-hand reveal tray so an opened manual tray lays out cards in a 5-column grid with additional rows instead of forcing one long row.
- Tightened the round notebook to a fixed 100px width so the top spiral shows exactly four coils, and centered the round number/caption within the card.
- Replaced the card-back center `X` mark with the provided diamond SVG motif.
- Targeted verification only: `node --check ui/app/render.js`, `node --check ui/cards.js`, and `npx vitest run src/test/frontend-ui.test.ts` passed.

2026-04-17
- Moved the timer source of truth into the server snapshot by exposing `phaseStartedAt` and `serverNow`, then aligned the frontend timer to that clock so refresh restores the elapsed beat instead of restarting locally.
- Increased timer cadence to `100ms` while updating only the timer text node between renders, so it reads continuously without forcing a full app rerender every tenth of a second.
- Tightened the required-claim / round spacing in the left HUD column and kept discard anchored to the far right edge of that same row.
- Re-enabled the scribble cue for actively thinking actors, made the scribble animation much more obvious with a continuous spin layer, and nudged the whistle text slightly farther right again.

2026-04-17
- Slowed the `*whistle*` drift so the challenge effect feels less frantic, moved the whistle layer slightly higher on the portrait, and shortened the travel distance so the text stays more attached to the character.
- Simplified the scribble cue further by removing the conflicting bob+spin transform stack and using a much faster clean spin on the SVG plus faster internal path jitter so the animation actually reads in motion.

2026-04-17
- Removed the CSS spin/jitter overrides from the scribble cue so the judge/actor thinking mark now relies on the embedded SVG `animate` path morph itself, matching the reference behavior of staying in place while the scribble shape changes.
