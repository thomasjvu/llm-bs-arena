# Research Progress Tracker

Last Updated: 2026-03-27

## Status Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESEARCH PIPELINE STATUS                     │
├─────────────────────────────────────────────────────────────────┤
│  [x] 1. Core infrastructure and quality gate                    │
│  [~] 2. Live NIM validation                                     │
│  [ ] 3. Pilot data collection                                   │
│  [ ] 4. Analysis, figures, and markdown summary                 │
│  [~] 5. Paper / portfolio packaging                             │
│  [ ] 6. Public release / submission                             │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Infrastructure

### Completed
- [x] TypeScript build passes
- [x] tests pass
- [x] `npm run check` passes
- [x] NVIDIA NIM added as the primary provider
- [x] seeded tournament reproducibility added
- [x] challenge-opportunity logging fixed
- [x] provenance-aware logs added
- [x] dominant-cohort filtering added
- [x] bootstrap statistical summaries added
- [x] CI workflow added

### Remaining
- [x] configure `NVIDIA_API_KEY` in `.env`
- [~] verify one live NIM-backed game per experiment
- [~] long-run recovery behavior validated under real NIM instability

### Commands
```bash
cp .env.example .env
npm run check
npm run python:setup
npm start -- nim-models
```

## Phase 2: Validation

### Mock Validation
```bash
npm start -- game -e 0 -p mock
npm start -- game -e 1 -p mock
npm start -- game -e 2 -p mock
npm start -- game -e 3 -p mock
```

- [ ] all four mock games complete successfully
- [ ] logs appear in `logs/games/`

### Live NIM Validation
```bash
npm start -- game -e 0 -p nim
npm start -- game -e 1 -p nim
npm start -- game -e 2 -p nim
npm start -- game -e 3 -p nim
```

- [x] at least one full live game completed successfully
- [~] Experiment 1 validation currently in progress with fixed seed and extended recovery
- [x] provider metadata appears in the logs
- [~] parsing/pathology issues identified and fixed during validation (count rules, turn-cap parsing, recoverable provider failures)

## Phase 3: Pilot Data Collection

### Target
- 15 matchups per experiment
- 10 games per matchup
- 150 games per experiment
- 600 games total across experiments 0-3

### Commands
```bash
npm start -- tournament -e 0 -g 10
npm start -- tournament -e 1 -g 10
npm start -- tournament -e 2 -g 10
npm start -- tournament -e 3 -g 10
```

### Tracking Table
| Experiment | Target Games | Completed | Notes |
|---|---:|---:|---|
| 0 | 150 | 0 | |
| 1 | 150 | 0 | |
| 2 | 150 | 0 | |
| 3 | 150 | 0 | |

### Checks During Collection
- [ ] roster frozen for the run
- [ ] provider/config unchanged mid-run
- [ ] no mixed legacy logs left in the active dataset folder
- [ ] unusual games inspected in the visualizer

## Phase 4: Analysis and Reporting

### Commands
```bash
npm start -- analyze --csv
npm run stats
npm run plots
npm run report
```

### Outputs
- [ ] `logs/csv/player_game_stats.csv`
- [ ] `logs/csv/game_summary.csv`
- [ ] `logs/csv/all_turns.csv`
- [ ] `results/figures/*.png`
- [ ] `results/research_summary.md`

### Analysis Checklist
- [ ] dominant cohort confirmed
- [ ] baseline deception results reviewed
- [ ] moral-restraint deltas reviewed
- [ ] instruction-violation rates reviewed
- [ ] 2-3 qualitative examples selected from game logs

## Phase 5: Paper and Portfolio Packaging

### Repo / Portfolio
- [~] README points to the draft paper/blog/portfolio docs
- [ ] screenshots or GIFs of the visualizer prepared
- [ ] `results/research_summary.md` polished for public reading
- [x] 2-3 resume bullets selected

### Paper Draft
- [x] abstract filled in
- [~] related work skeleton drafted
- [x] methods synced to the shipped code
- [ ] results section filled from exported metrics
- [ ] figures inserted
- [ ] limitations section updated

### Draft Assets
- [x] `PAPER_DRAFT.md` upgraded from outline to working draft
- [x] `BLOG_POST_DRAFT.md` created
- [x] `PORTFOLIO_DRAFT.md` created
- [x] `RESULTS_FILL_GUIDE.md` created

## Phase 6: Release Strategy

### Fastest Path
- [ ] push the repo publicly
- [ ] publish a technical writeup or arXiv preprint
- [ ] add the project to resume, LinkedIn, and portfolio

### Stronger Research Path
- [ ] run a larger follow-up dataset
- [ ] tighten qualitative analysis
- [ ] submit to a workshop or benchmark-style venue

## Key File Locations

```text
logs/games/                 raw JSON game logs
logs/csv/                   exported CSVs
results/figures/            generated figures
results/research_summary.md generated markdown brief
README.md                   public project overview
RESEARCH_PLAN.md            current research design
PAPER_DRAFT.md              paper draft
```
