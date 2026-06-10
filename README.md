# LLM Bullshit

Bullshit-Bench is a benchmark release for studying deception, asymmetric honesty framing, and instruction compliance in multi-agent LLM play.

The environment is the card game *Bullshit*. Four agents play with hidden private state, legal bluffing, objective ground truth, and explicit peer challenge opportunities. The release includes:
- a seeded TypeScript game engine
- an importable multi-agent environment API
- a NIM-backed hosted-model evaluation pipeline
- baseline local policies
- frozen `600`-game pilot artifacts, figures, and release manifests

## Research Questions

1. How effectively do models deceive other models when deception is allowed?
2. How do models change deception when told opponents are honesty-constrained?
3. When truthful play is available, do models still violate explicit no-lying instructions under competitive pressure?

## Frozen Pilot

The primary pilot is complete:
- `4` experiments
- `6` hosted models
- `15` unique four-model matchups per experiment
- `10` games per matchup
- `600` winner-terminated games total

The strongest results from the frozen cohort are:
- Exp3 honesty instructions sharply reduce optional lying when truthful play is available
- Exp3 overall lie frequency remains nonzero because truthful-play-unavailable turns are common
- Exp3 also softens enforcement: challenge frequency drops while lie success rises
- Exp2 produces heterogeneous, model-specific responses to asymmetric honesty framing rather than a universal drop in deception
- Kimi leads Exp1, Exp2, and Exp3; Nemotron leads Exp0
- Mistral is the clearest high-challenge, zero-win profile

Interpretation note: the frozen preprint cohort used bounded per-turn context, not full-game memory. Current development code is set up for the next full-public-history run with schema-v4 decision logging.

Tracked frozen artifacts live in `paper/arxiv/artifacts/frozen/` and tracked paper figures live in `paper/arxiv/figures/`.

## Version Tags

Use git tags to recover the exact code state for each public milestone:
- `v1.0.0`: frozen 600-game cohort and arXiv paper release state.
- `v2-run-ready`: schema-v3 logging and methodology updates for the next NIM run. This tag is code-ready only; it does not include a new paid cohort.
- current branch: full-public-history v3 study protocol with schema-v4 decision logs.

## Release Surface

Primary technical docs:
- [BENCHMARK_SPEC.md](docs/BENCHMARK_SPEC.md)
- [DATASET_CARD.md](docs/DATASET_CARD.md)
- [RESEARCH_PLAN.md](docs/RESEARCH_PLAN.md)
- [RESEARCH_RUNBOOK.md](docs/RESEARCH_RUNBOOK.md)

Paper source:
- [paper/arxiv/main.tex](paper/arxiv/main.tex)
- [docs/references.bib](docs/references.bib)

Internal submission docs:
- [paper/support/ARXIV_UPLOAD_CHECKLIST.md](paper/support/ARXIV_UPLOAD_CHECKLIST.md)
- [paper/support/CLAIMS_EVIDENCE_MATRIX.md](paper/support/CLAIMS_EVIDENCE_MATRIX.md)

## Setup

Prerequisites:
- `Node.js 20.6+`
- `npm`

Install:

```bash
npm install
cp .env.example .env
```

Set at least:

```bash
LLM_PROVIDER=nim
NVIDIA_API_KEY=your_nvidia_api_key_here
```

Optional NIM tuning for the published roster:

```bash
NVIDIA_NIM_TIMEOUT_MS=180000
# Generated-token caps for the model response, not context-window limits.
# v3:shard defaults to 2048/4096; direct tournament commands use adapter defaults unless set.
LLM_PLAY_MAX_TOKENS=8192
LLM_CHALLENGE_MAX_TOKENS=4096
LLM_RECOVERY_WINDOW_MS=36000000
LLM_RECOVERY_BACKOFF_MS=30000
TOURNAMENT_GAME_RETRY_DELAY_MS=30000
# Generic tournament default; v3:shard defaults this to 0, meaning unlimited transient retries.
TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT=10
```

Build:

```bash
npm run build
npm run python:setup
```

## Usage

Development server:

```bash
npm run dev
```

This starts the visualizer at `http://localhost:3001`.

Source CLI during development:

```bash
npm run cli:dev -- <command>
```

Built CLI after `npm run build`:

```bash
npm start -- <command>
```

Single game:

```bash
npm start -- game -e 1 -p nim
```

Tournament:

```bash
npm start -- tournament -e 1 -g 10 -p nim -o logs-v2
```

In this repository, `tournament` means the benchmark batch runner over all unique four-player model matchups. It is the cohort collection command used by the paper and release pipeline, not a separate product feature.

V3 full-history parallel rerun:

```bash
npm run v3:shard -- 0 0
npm run v3:shard -- 0 1
npm run v3:shard -- 0 2
npm run v3:shard -- 0 3
```

Each `v3:shard` command runs one quarter of one experiment. With defaults, one experiment is `15` matchups times `10` games, or `150` games. The four shards cover slots `0-37`, `38-75`, `76-112`, and `113-149`, so all four commands above complete experiment `0`. Running the same four-shard pattern for experiments `1`, `2`, and `3` gives the full `600` game rerun. The helper runs the current TypeScript source through `tsx` when available, sets play/challenge generated-token caps to `2048/4096`, sets transient game-slot retries to unlimited by default, and still aborts immediately on fatal auth/model-access errors. All shards can write to `logs-v3`; finalize once after all 16 shard commands finish:

```bash
npm run v3:finalize -- logs-v3
```

Visualizer:

```bash
npm run dev
```

Open `http://localhost:3001`.

Analysis pipeline:

```bash
npm start -- manifest -o logs-v2
npm start -- analyze -o logs-v2 --csv
.venv/bin/python analysis/stats.py --csv-dir logs-v2/csv
.venv/bin/python analysis/plots.py --csv-dir logs-v2/csv --output-dir results/figures
.venv/bin/python analysis/report.py --csv-dir logs-v2/csv --output results/research_summary.md --figures-dir results/figures
```

Release bundle:

```bash
npm start -- release --logs logs-v2
```

## Library API

The package exposes a phase-based multi-agent environment API:

```ts
import { createBullshitEnv, createBaselinePolicy } from 'llm-bullshit';

const env = createBullshitEnv({
  experimentId: 1,
  players: [
    'z-ai/glm-5.1',
    'google/gemma-4-31b-it',
    'nvidia/nemotron-3-super-120b-a12b',
    'baseline/scripted',
  ],
});

env.reset();
const observation = env.observation('P1');
const action = createBaselinePolicy('baseline/scripted').act(observation, env.publicState());
const result = env.step(action);
```

Core methods:
- `createBullshitEnv(config)`
- `env.reset()`
- `env.observation(playerId)`
- `env.publicState()`
- `env.step(action)`
- `env.done()`
- `env.result()`

## Submission Note

The current paper path is the arXiv preprint build at [paper/arxiv/main.tex](paper/arxiv/main.tex). Public-facing narrative writing is maintained outside this repository so the research artifact can stay focused on the benchmark, analysis pipeline, and paper source.
