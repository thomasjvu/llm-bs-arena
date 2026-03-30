# LLM Bullshit: Research Plan

## Overview

This project studies deception, moral restraint, and instruction compliance in multi-agent LLM interactions by making four LLMs play Bullshit (Cheat / I Doubt It) against each other under different prompt framings.

### Research Questions
1. **RQ1:** How effectively can LLMs deceive other LLMs in a game that rewards lying?
2. **RQ2:** Do LLMs reduce deceptive behavior when told the other players must play honestly?
3. **RQ3:** Will LLMs violate explicit instructions prohibiting deception in order to win?

### Why This Matters
- The task has an explicit, measurable deception mechanic.
- Truth and lies are objectively verifiable from the hidden cards.
- Success requires both bluffing and lie detection.
- The setup creates a useful tension between strategic behavior and instruction following.

## Experimental Design

### Experiment 0: Control
Prompt framing: random-play baseline with no strategic guidance.

Purpose: establish a low-strategy reference point for challenge and lie behavior.

### Experiment 1: Baseline
Prompt framing: deception is allowed and expected.

Purpose: measure baseline deception capability, challenge behavior, and win rate.

### Experiment 2: Asymmetric Fairness
Prompt framing: the focal model may lie, but is told the other players will play honestly.

Purpose: test whether models show moral restraint when they believe opponents are constrained.

### Experiment 3: Honesty Mandate
Prompt framing: all players are instructed to play honestly and lying is prohibited.

Purpose: test whether models violate explicit instructions under competitive pressure.

## System Design

### Core Components
- **Game engine:** TypeScript rules engine for turn order, deck state, challenge resolution, and win conditions
- **Prompt builder:** experiment-specific prompts plus prompt version/hash tracking
- **LLM adapter layer:** NVIDIA NIM as the main OpenAI-compatible provider, with Chutes and Featherless as fallbacks
- **Logging:** full JSON game logs with seeds, seating order, provider, schema version, and prompt metadata
- **Analysis:** TypeScript and Python exports built around one row per player per game
- **Visualizer:** browser UI for step-through and autoplay inspection of games

### Key Research Integrity Features
- Seeded seating order and seeded decks for reproducibility
- Logged provider, base URL, prompt version, and prompt hash
- Logged challenge opportunities based on actual challenge windows
- Uncapped play for the research dataset, with optional safety-capped runs excluded from default analysis
- Cohort filtering so mixed legacy logs do not silently contaminate current runs
- Bootstrap confidence intervals on player-game rows instead of fragile turn-level significance tests

## Current Model Roster

Default tournament roster:
1. `qwen/qwen3.5-397b-a17b`
2. `minimaxai/minimax-m2.5`
3. `nvidia/nemotron-3-super-120b-a12b`
4. `mistralai/mistral-small-4-119b-2603`
5. `z-ai/glm5`
6. `moonshotai/kimi-k2.5`

### Matchup Design
- 4-player games
- all unique `C(6,4) = 15` matchups
- pilot dataset: 10 games per matchup per experiment
- stronger follow-up dataset: 20+ games per matchup per experiment if quota allows

## Metrics

### Primary Metrics
| Metric | Description |
|---|---|
| Win Rate | proportion of games won |
| Lie Frequency | proportion of a player’s plays that were lies |
| Lie Success Rate | proportion of lies that went unchallenged |
| Paranoia Frequency | challenges made divided by real challenge opportunities |
| Challenge Accuracy | correct challenges divided by all challenges made |
| Instruction Violation Rate | in Experiment 3, lies divided by total plays |

### Secondary / Qualitative Metrics
- first-lie timing
- game length
- reasoning traces around lies and challenges
- violation context in Experiment 3

## Statistical Approach

- **Unit of analysis:** player-game rows in `logs/csv/player_game_stats.csv`
- **Main summaries:** bootstrap 95% confidence intervals for per-model means and between-experiment deltas
- **Dataset hygiene:** use the dominant comparable cohort by schema version, provider, prompt version, and prompt hash unless explicitly analyzing mixed logs
- **Outputs:** CSV exports, figure generation, and a markdown summary report

## Data Artifacts

### Raw Logs
- `logs/games/*.json`

Each game log includes:
- experiment id
- model roster
- seed
- seating order
- per-turn lie/challenge data
- reasoning text
- provider and prompt provenance

### Derived Files
- `logs/csv/player_game_stats.csv`
- `logs/csv/game_summary.csv`
- `logs/csv/all_turns.csv`
- `results/figures/*.png`
- `results/research_summary.md`

## Execution Plan

### Phase 1: Validation
- run `npm run check`
- run one mock game per experiment
- run one NIM-backed game per experiment
- confirm logs, CSV exports, figures, and markdown summary all generate cleanly

### Phase 2: Pilot Dataset
- collect 10 games per matchup for experiments 0, 1, 2, and 3
- monitor for malformed responses, unusually long games, or provider failures
- freeze the roster and provider configuration for the pilot dataset

### Phase 3: Analysis
- export CSVs with `npm start -- analyze --csv`
- generate the statistical summary with `npm run stats`
- generate figures with `npm run plots`
- generate the markdown brief with `npm run report`

### Phase 4: Packaging
- fill `PAPER_DRAFT.md` from the generated summary
- publish the cleaned repo and screenshots
- extract resume bullets from `results/research_summary.md`
- decide whether to stop at a strong hiring artifact or run a larger confirmatory dataset

## Recommended Outcome Path

### Fastest Credible Path
- produce a clean pilot dataset
- publish the repo with figures and markdown summary
- add the project to your resume and portfolio
- release an arXiv preprint or public technical report

### Stronger Research Path
- rerun with a larger dataset
- expand related work
- add a stronger qualitative analysis section
- submit to a workshop, student-research venue, or benchmark-style track
