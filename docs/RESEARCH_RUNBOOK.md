# Bullshit-Bench Research Runbook

## Overview
This runbook provides a step-by-step guide to reproduce the Bullshit-Bench pilot study and generate the official release. Follow these steps in order to ensure consistency and reproducibility.

## Prerequisites
- Node.js 20.6+
- npm
- Python 3.x
- NVIDIA API key (for NIM provider)

## Phase 0: Setup
1. Install dependencies:
   ```bash
   npm install
   npm run python:setup
   ```
2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env to set:
   LLM_PROVIDER=nim
   NVIDIA_API_KEY=your_key_here
   ```
3. Verify NIM connectivity:
   ```bash
   npm start -- nim-models
   ```

## Phase 1: Validation
1. Test game logic with mock provider:
   ```bash
   npm start -- game -e 1 -p mock
   ```
2. Validate one real game per experiment:
   ```bash
   npm start -- tournament -e 0 -g 1 -p nim -o logs-v2-smoke --matchup-start 0 --matchup-end 0
   npm start -- tournament -e 1 -g 1 -p nim -o logs-v2-smoke --matchup-start 0 --matchup-end 0
   npm start -- tournament -e 2 -g 1 -p nim -o logs-v2-smoke --matchup-start 0 --matchup-end 0
   npm start -- tournament -e 3 -g 1 -p nim -o logs-v2-smoke --matchup-start 0 --matchup-end 0
   ```
3. (Optional) Visual inspection:
   ```bash
   npm run visualizer
   # Open http://localhost:3001
   ```

## Phase 2: Dataset Collection

The `tournament` command is the benchmark batch runner over all unique four-player model matchups; it is the reproducible cohort-collection path used by the paper and release artifacts.

1. Freeze pilot dataset settings (do not change after this point):
   - Provider: nim
   - Roster: 6-model default
   - Experiments: 0, 1, 2, 3
   - Games per matchup: 10
   - Output directory: `logs-v2`
2. Collect pilot dataset (600 games total):
   ```bash
   npm start -- tournament -e 0 -g 10 -o logs-v2
   npm start -- tournament -e 1 -g 10 -o logs-v2
   npm start -- tournament -e 2 -g 10 -o logs-v2
   npm start -- tournament -e 3 -g 10 -o logs-v2
   ```
   - For parallel execution, shard by matchup index (0-4, 5-9, 10-14)

### V3 Full-History Rerun Shards

The v3 helper shards by global game slot, not by individual game. With the default roster:

- `C(6,4) = 15` matchups per experiment
- `10` games per matchup
- `150` games per experiment
- `4` experiments
- `600` games total

Each `npm run v3:shard -- <experiment> <shard-index>` command runs one quarter of one experiment:

| Command | Experiment | Global game slots | Games |
| --- | ---: | ---: | ---: |
| `npm run v3:shard -- 0 0` | 0 | `0-37` | 38 |
| `npm run v3:shard -- 0 1` | 0 | `38-75` | 38 |
| `npm run v3:shard -- 0 2` | 0 | `76-112` | 37 |
| `npm run v3:shard -- 0 3` | 0 | `113-149` | 37 |

The same shard split applies to experiments `1`, `2`, and `3`. Therefore:

```text
4 shard commands per experiment * 4 experiments = 16 shard commands
150 games per experiment * 4 experiments = 600 games
```

Run a build once as a paid-run preflight. The shard helper uses the current TypeScript source through `tsx` when available, so stale `dist/` output will not affect shard commands.

```bash
npm run build
```

Optional per-experiment API key files keep terminal commands short:

```bash
printf 'NVIDIA_API_KEY=EXP0_KEY_HERE\n' > .env.v3-exp0.local
printf 'NVIDIA_API_KEY=EXP1_KEY_HERE\n' > .env.v3-exp1.local
printf 'NVIDIA_API_KEY=EXP2_KEY_HERE\n' > .env.v3-exp2.local
printf 'NVIDIA_API_KEY=EXP3_KEY_HERE\n' > .env.v3-exp3.local
```

Launch four tabs per experiment terminal:

```bash
# Experiment 0
npm run v3:shard -- 0 0
npm run v3:shard -- 0 1
npm run v3:shard -- 0 2
npm run v3:shard -- 0 3

# Experiment 1
npm run v3:shard -- 1 0
npm run v3:shard -- 1 1
npm run v3:shard -- 1 2
npm run v3:shard -- 1 3

# Experiment 2
npm run v3:shard -- 2 0
npm run v3:shard -- 2 1
npm run v3:shard -- 2 2
npm run v3:shard -- 2 3

# Experiment 3
npm run v3:shard -- 3 0
npm run v3:shard -- 3 1
npm run v3:shard -- 3 2
npm run v3:shard -- 3 3
```

All shards write into `logs-v3`, so there is no manual merge step. When all 16 commands finish, finalize once:

```bash
npm run v3:finalize -- logs-v3
```

The v3 shard helper defaults to:

- `LLM_CONTEXT_BUDGET_TOKENS=120000`
- `LLM_PLAY_MAX_TOKENS=2048`
- `LLM_CHALLENGE_MAX_TOKENS=4096`
- `TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT=0`

The play/challenge token settings are generated-token completion caps, not context-window limits. A value of `0` for `TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT` means unlimited retries for transient provider failures. Fatal auth/model-access/configuration errors still abort the shard immediately because waiting will not repair them.

## Phase 3: Analysis
1. Generate analysis outputs:
   ```bash
   npm start -- analyze -o logs-v2 --csv
   .venv/bin/python analysis/stats.py --csv-dir logs-v2/csv
   .venv/bin/python analysis/plots.py --csv-dir logs-v2/csv --output-dir results/figures
   .venv/bin/python analysis/report.py --csv-dir logs-v2/csv --output results/research_summary.md --figures-dir results/figures
   ```
   This produces:
   - `logs-v2/csv/player_game_stats.csv`
   - `logs-v2/csv/game_summary.csv`
   - `logs-v2/csv/all_turns.csv`
   - `logs-v2/csv/challenge_decisions.csv`
   - `logs-v2/csv/decision_log.csv` for schema-v4 full-history runs
   - `results/figures/*.png`
   - `results/research_summary.md`
2. Verify success:
   - Report contains correct provider and prompt metadata
   - No warnings about legacy/incomplete dataset
   - Figures generated for all experiments

## Phase 4: Release Packaging
1. Build official release bundle:
   ```bash
   npm start -- release --logs logs-v2
   ```
2. Verify outputs exist:
   - `release/v1.0.0/benchmark-release.json`
   - `release/v1.0.0/dataset-manifest.json`
   - `release/v1.0.0/evaluation-manifest.json`
   - `release/v1.0.0/checksums.sha256`
   - `release/v1.0.0/assets/bullshit-bench-v1.0.0-raw-games.tar.gz`

## Phase 5: Paper Preparation
1. Review analysis before writing:
   - `results/research_summary.md`
   - `paper/arxiv/main.tex`
2. Answer key questions:
   - Who won most in Experiment 1?
   - Who lied most in Experiment 1?
   - Who reduced lying most in Experiment 2?
   - Who violated honesty instructions most in Experiment 3?
3. If report shows dataset is incomplete/legacy, do not proceed.
4. Write paper using this order:
   - Fill `paper/arxiv/sections/*.tex` methods from actual run settings
   - Fill results from `paper/arxiv/artifacts/frozen/research_summary.md`
   - Add tracked figures from `paper/arxiv/figures/`
   - Write abstract last
   - Prepare blinded submission assets before public release

## Common Mistakes to Avoid
- Analyzing leftover logs from old runs
- Writing v2 smoke or paid runs into `logs/`; use `logs-v2-smoke` or `logs-v2`
- Changing provider or roster mid-dataset
- Using validation games as main results
- Drawing conclusions from tiny/incomplete datasets
- Writing paper before checking generated report

## Troubleshooting
- **Provider timeouts**: Increase `NVIDIA_NIM_TIMEOUT_MS` in .env
- **Truncated outputs**: Increase relevant `LLM_*_MAX_TOKENS`
- **Missing API key**: Verify `NVIDIA_API_KEY` in .env
- **Failed games**: Check `logs/runs/` for terminal transcripts
- **Analysis failures**: Ensure all previous steps completed successfully

## Verification
- Target cohort: 600 winner-terminated games
- Default analysis unit: one row per player per game (2,400 rows)
- Primary metrics: Win rate, lie frequency, lie success rate, challenge frequency, challenge accuracy, optional lie rate, truthful-play-unavailable turn share
