# Screenshot Checklist

Use this when the pilot is far enough along that the UI has meaningful data to show.

## Must-Have Screenshots

### 1. Visualizer Mid-Game

Capture:
- all four players visible
- current rank visible
- pile visible
- at least one thought bubble / reasoning snippet visible
- a turn history or challenge moment visible

Use for:
- README
- blog post
- portfolio page

### 2. Winner State

Capture:
- winner overlay or final board state
- enough surrounding UI to show this is a live game environment

Use for:
- blog post
- optional appendix figure

### 3. Leaderboard / Stats Panel

Capture:
- leaderboard sorted by win rate
- lie frequency / challenge accuracy columns visible
- experiment selector visible if possible

Use for:
- README
- portfolio page
- blog post

### 4. One Final Chart

Capture or export:
- lie frequency vs win rate
or
- Exp 1 vs Exp 2 lie-frequency deltas
or
- Exp 3 violation rates

Use for:
- README
- portfolio page
- paper teaser image if needed

## Nice-To-Have Screenshots

- transcript snippet showing a recovery/retry event
- one example JSON log or CSV summary excerpt
- comparison of control vs baseline stats views

## Quality Rules

- do not use screenshots from quarantined or pre-fix runs
- do not use screenshots showing obviously broken turns
- crop out unrelated desktop clutter
- prefer light annotation over heavy callouts
- keep one raw screenshot version and one annotated version

## Suggested Filenames

- `results/screenshots/visualizer-midgame.png`
- `results/screenshots/winner-state.png`
- `results/screenshots/leaderboard-exp1.png`
- `results/screenshots/chart-lie-vs-win.png`

## Best Timing

Take screenshots only after:
- at least one clean shard per experiment has completed
- the leaderboard looks populated
- the final cohort rules are stable
