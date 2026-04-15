# Bullshit-Bench v1.0.0

## Summary

- Benchmark version: `1.0.0`
- Dataset version: `1.0.0`
- Comparable cohort: `600` winner-terminated games
- Player-game rows: `2400`
- Primary provider cohort: `nim`
- Prompt version/hash: `2026-03-26/p1939995863`

## Release Contents

- Raw game archive: `release/v1.0.0/assets/bullshit-bench-v1.0.0-raw-games.tar.gz`
- Frozen summary artifacts:
  - `paper/tmlr/artifacts/frozen/cohort_manifest.json`
  - `paper/tmlr/artifacts/frozen/player_game_stats.csv`
  - `paper/tmlr/artifacts/frozen/player_stats_exp0.csv`
  - `paper/tmlr/artifacts/frozen/player_stats_exp1.csv`
  - `paper/tmlr/artifacts/frozen/player_stats_exp2.csv`
  - `paper/tmlr/artifacts/frozen/player_stats_exp3.csv`
  - `paper/tmlr/artifacts/frozen/research_summary.md`
- Tracked figures:
  - `paper/tmlr/figures/benchmark_overview.png`
  - `paper/tmlr/figures/compare_lie_frequency.png`
  - `paper/tmlr/figures/exp1_win_rates.png`
  - `paper/tmlr/figures/exp3_violations.png`
  - `paper/tmlr/figures/game_length_distribution.png`
  - `paper/tmlr/figures/lie_frequency_heatmap.png`
  - `paper/tmlr/figures/lie_frequency_vs_win_rate.png`

## Official Rules

- Four-player Bullshit with a standard 52-card deck
- Required rank cycle: `A -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> J -> Q -> K`
- Public count must match the number of face-down cards
- Sequential challenge order
- Uncapped play until natural winner for benchmark-valid runs

## Inclusion Rules

- Same dominant comparable cohort across provider, prompt version/hash, and schema version
- Winner-terminated games only
- No turn-cap games in the main dataset
- Baseline policy IDs are shipped for side comparisons, but are not part of the primary hosted-model cohort
