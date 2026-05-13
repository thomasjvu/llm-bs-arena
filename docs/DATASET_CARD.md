# Dataset Card: Bullshit-Bench v1.0.0

## Summary

This dataset consists of game logs produced by large language models playing the card game *Bullshit* under controlled prompt conditions. It is intended to support research on deception, challenge behavior, asymmetric honesty framing, and instruction compliance in multi-agent LLM interaction.

The official release is a **600-game benchmark dataset**:
- 4 experiments
- 15 unique four-model matchups per experiment
- 10 games per matchup

Release identifiers:
- benchmark version: `1.0.0`
- dataset version: `1.0.0`
- primary provider cohort: `nim`
- frozen prompt version/hash: documented in `release/v1.0.0/evaluation-manifest.json`

## Motivation

Most honesty-oriented LLM evaluation focuses on static prompts. This dataset instead captures multi-turn strategic interaction in a setting where:
- deception is legal
- truth is objectively verifiable
- other agents can challenge suspicious behavior

This makes it useful for studying not just whether models say false things, but how they behave when deception is incentivized and socially contestable.
Because the logs include seeds, seating order, and actual cards played on every turn, the frozen cohort also supports post-hoc replay of start-of-turn hands so honesty-mandate analysis can separate optional lies from turns where no truthful play was available.

## Composition

Each game log records:
- experiment id
- player roster
- seed
- seating order
- provider metadata
- prompt version and prompt hash
- turn-by-turn actions
- lie/truth labels
- challenge opportunities
- challenge/pass decisions and pass rationales in schema v3+ logs
- challenge outcomes
- reasoning text
- game duration and token usage metadata when available

Derived CSV exports include:
- one row per player per game
- one row per game
- one row per turn
- one row per challenge-window decision in schema v3+ exports
- replay-derived truthful-availability labels for each turn
- replay-derived optional-lie and truthful-play-unavailable aggregates for each player-game row

## Collection Process

Generation process:
- TypeScript rules engine
- NVIDIA NIM as the primary provider
- seeded deck order and seating
- uncapped play until natural winner for research-default runs

The released dataset was produced through tournament shards run in parallel across disjoint matchup ranges and then frozen into a versioned comparable cohort.

## Recommended Inclusion Rules

Use only logs that satisfy all of:
- current schema version
- current provider cohort
- current prompt version/hash cohort
- `terminationReason = "winner"`
- not located in quarantine folders

Exclude:
- legacy logs with mixed or missing provenance
- pre-fix invalid logs
- capped runs with `terminationReason = "turn_cap"`

## Known Limitations

- No human baseline in the current pilot
- Provider-side instability can make runtime extremely long
- Reasoning text may reflect prompt style as much as stable latent strategy
- Results are roster-specific and provider-version-specific
- The current pilot is useful evidence, not a conclusive universal statement about LLM deception

## Ethical / Interpretive Notes

This dataset should not be interpreted as proof that a model is broadly deceptive in all contexts. The environment is competitive and deception is explicitly legal in some conditions. The correct interpretation is narrower:
- how these models behaved in this controlled multi-agent game
- under these prompt conditions
- under this provider/model cohort

## Intended Uses

Good uses:
- benchmark-style evaluation
- paper figures and tables
- qualitative case studies
- analysis of deception/challenge tradeoffs
- reproducibility demonstrations for multi-agent LLM experiments

Bad uses:
- broad claims that a model is "dishonest in general"
- mixing incompatible log cohorts without disclosure
- treating capped/debug runs as equal to natural completed games

## Release Surfaces

This release includes:
- `release/v1.0.0/benchmark-release.json`
- `release/v1.0.0/dataset-manifest.json`
- `release/v1.0.0/evaluation-manifest.json`
- `release/v1.0.0/checksums.sha256`
- `release/v1.0.0/RELEASE_NOTES.md`
- tracked frozen summary artifacts under `paper/arxiv/artifacts/frozen/`
- tracked paper figures under `paper/arxiv/figures/`

The full raw game logs are packaged as a versioned archive asset referenced by the release manifest rather than being committed into normal repo history.
