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

Tracked frozen artifacts live in `paper/arxiv/artifacts/frozen/` and tracked paper figures live in `paper/arxiv/figures/`.

## Release Surface

Primary technical docs:
- [BENCHMARK_SPEC.md](docs/BENCHMARK_SPEC.md)
- [DATASET_CARD.md](docs/DATASET_CARD.md)
- [RESEARCH_PLAN.md](docs/RESEARCH_PLAN.md)
- [RESEARCH_RUNBOOK.md](docs/RESEARCH_RUNBOOK.md)

Paper source:
- [paper/arxiv/main.tex](paper/arxiv/main.tex)
- [references.bib](references.bib)

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
LLM_PLAY_MAX_TOKENS=8192
LLM_CHALLENGE_MAX_TOKENS=4096
LLM_RECOVERY_WINDOW_MS=36000000
LLM_RECOVERY_BACKOFF_MS=30000
TOURNAMENT_GAME_RETRY_DELAY_MS=30000
TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT=10
```

Build:

```bash
npm run build
npm run python:setup
```

## Usage

Single game:

```bash
npm start -- game -e 1 -p nim
```

Tournament:

```bash
npm start -- tournament -e 1 -g 10 -p nim
```

Visualizer:

```bash
npm run visualizer
```

Open `http://localhost:3001`.

Analysis pipeline:

```bash
npm start -- manifest
npm start -- analyze --csv
npm run stats
npm run plots
npm run report
```

Release bundle:

```bash
npm start -- release
```

## Library API

The package exposes a phase-based multi-agent environment API:

```ts
import { createBullshitEnv, createBaselinePolicy } from 'llm-bullshit';

const env = createBullshitEnv({
  experimentId: 1,
  players: [
    'qwen/qwen3.5-397b-a17b',
    'minimaxai/minimax-m2.5',
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
