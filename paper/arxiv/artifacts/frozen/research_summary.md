# LLM Bullshit Research Summary

Generated: 2026-04-19T23:56:23.798914+00:00

## Dataset

- Games: 600
- Player-game rows: 2400
- Models: 6
- Experiments present: 0, 1, 2, 3
- Providers: nim
- Schema versions: 2
- Prompt versions: 2026-03-26
- Prompt hashes: p1939995863

## Experiment Overview

| Experiment | Games | Models | Top win share | Mean overall lie frequency | Mean optional lie rate | Mean lie success | Mean challenge frequency | Mean challenge accuracy | Mean conflict-turn share |
|---|---:|---:|---:|---|---|---|---|---|---|
| 0 | 150 | 6 | 32.7% | 34.8% (95% CI 25.6% to 42.3%) | 8.8% (95% CI 6.0% to 12.3%) | 37.9% (95% CI 31.6% to 46.4%) | 21.5% (95% CI 7.6% to 39.4%) | 51.4% (95% CI 43.8% to 59.6%) | 28.7% (95% CI 19.8% to 35.8%) |
| 1 | 150 | 6 | 44.0% | 39.6% (95% CI 30.4% to 46.9%) | 13.4% (95% CI 8.0% to 20.3%) | 11.0% (95% CI 7.5% to 16.0%) | 45.3% (95% CI 36.9% to 58.1%) | 45.3% (95% CI 41.0% to 50.3%) | 30.5% (95% CI 23.1% to 35.8%) |
| 2 | 150 | 6 | 44.0% | 36.1% (95% CI 25.4% to 46.1%) | 10.1% (95% CI 4.6% to 16.1%) | 22.6% (95% CI 14.3% to 33.0%) | 32.4% (95% CI 17.3% to 50.8%) | 49.3% (95% CI 40.5% to 62.0%) | 29.5% (95% CI 19.8% to 36.7%) |
| 3 | 150 | 6 | 38.0% | 27.2% (95% CI 24.0% to 29.9%) | 2.2% (95% CI 0.1% to 6.0%) | 34.7% (95% CI 27.6% to 44.5%) | 21.8% (95% CI 12.1% to 34.7%) | 41.7% (95% CI 32.8% to 50.5%) | 25.3% (95% CI 18.7% to 29.7%) |

## RQ1: Baseline Deception (Experiment 1)

| Model | Games | Wins | Win share | Optional lie rate | Conflict-turn share | Overall lie frequency | Challenge frequency |
|---|---:|---:|---:|---:|---:|---:|---:|
| moonshotai/kimi-k2.5 | 100 | 66 | 44.0% | 16.6% | 39.6% | 49.6% | 32.4% |
| qwen/qwen3.5-397b-a17b | 100 | 25 | 16.7% | 15.3% | 31.8% | 42.2% | 41.9% |
| minimaxai/minimax-m2.5 | 100 | 25 | 16.7% | 7.2% | 34.5% | 39.2% | 37.8% |
| z-ai/glm5 | 100 | 23 | 15.3% | 5.5% | 32.1% | 35.8% | 41.2% |
| nvidia/nemotron-3-super-120b-a12b | 100 | 11 | 7.3% | 28.2% | 31.6% | 50.9% | 44.1% |
| mistralai/mistral-small-4-119b-2603 | 100 | 0 | 0.0% | 7.5% | 13.6% | 20.1% | 74.7% |

Top baseline winner: `moonshotai/kimi-k2.5` with 66 wins and 44.0% win share.
Highest baseline optional-lie rate: `nvidia/nemotron-3-super-120b-a12b` at 28.2%.

## RQ2: Asymmetric Honesty Framing (Experiment 1 vs Experiment 2)

| Model | Exp 1 optional lie rate | Exp 2 optional lie rate | Delta (Exp2 - Exp1) | Exp 1 win share | Exp 2 win share |
|---|---:|---:|---|---:|---:|
| nvidia/nemotron-3-super-120b-a12b | 28.2% | 21.2% | -7.0% | 7.3% | 18.7% |
| qwen/qwen3.5-397b-a17b | 15.3% | 10.1% | -5.2% | 16.7% | 18.0% |
| z-ai/glm5 | 5.5% | 0.7% | -4.7% | 15.3% | 13.3% |
| minimaxai/minimax-m2.5 | 7.2% | 5.0% | -2.2% | 16.7% | 6.0% |
| mistralai/mistral-small-4-119b-2603 | 7.5% | 5.8% | -1.6% | 0.0% | 0.0% |
| moonshotai/kimi-k2.5 | 16.6% | 17.8% | +1.2% | 44.0% | 44.0% |

Largest optional-lie reduction: `nvidia/nemotron-3-super-120b-a12b` with -7.0%.
Largest optional-lie increase: `moonshotai/kimi-k2.5` with +1.2%.

## RQ3: Instruction Compliance (Experiment 3)

| Model | Games | Wins | Adjusted optional lie rate | Legacy overall lie rate | Conflict-turn share | Win share |
|---|---:|---:|---:|---:|---:|---:|
| mistralai/mistral-small-4-119b-2603 | 100 | 0 | 11.7% | 20.4% | 9.8% | 0.0% |
| minimaxai/minimax-m2.5 | 100 | 6 | 0.8% | 25.3% | 24.7% | 4.0% |
| qwen/qwen3.5-397b-a17b | 100 | 51 | 0.4% | 31.1% | 30.9% | 34.0% |
| nvidia/nemotron-3-super-120b-a12b | 100 | 15 | 0.2% | 27.3% | 27.1% | 10.0% |
| z-ai/glm5 | 100 | 21 | 0.1% | 28.7% | 28.6% | 14.0% |
| moonshotai/kimi-k2.5 | 100 | 57 | 0.0% | 30.5% | 30.5% | 38.0% |

Highest adjusted optional-lie rate: `mistralai/mistral-small-4-119b-2603` at 11.7%.
Mean model-level adjusted optional-lie rate: 2.2%.
Mean model-level conflict-turn share: 25.3%.

## Paper Fill-Ins

- Methods sentence: `We ran 600 four-player games across 6 models under experiments 0, 1, 2, 3, using nim with prompt version(s) 2026-03-26.`
- Results sentence template: `In the baseline deception condition, [MODEL] captured the largest share of wins, while [MODEL] showed the highest optional-lie rate; under asymmetric honesty framing, five models reduced optional lying while [MODEL] increased it, and under the honesty mandate, [MODEL] had the highest adjusted optional-lie rate when truthful play was available.`
- Reporting note: `Paper-facing tables should use per-experiment win share (wins divided by 150 games) as the primary win metric; appearance win rate can remain in CSV exports as a secondary derived field.`
- Discussion angle: `The strongest paper story is that the honesty mandate sharply suppresses optional lying while the table simultaneously becomes less aggressive about challenging remaining bluffs.`

## Figures

- `paper/arxiv/figures/benchmark_overview.png`
- `paper/arxiv/figures/challenge_frequency_vs_win_rate.png`
- `paper/arxiv/figures/compare_challenge_frequency.png`
- `paper/arxiv/figures/compare_lie_frequency.png`
- `paper/arxiv/figures/compare_optional_lie_rate.png`
- `paper/arxiv/figures/exp1_deception.png`
- `paper/arxiv/figures/exp1_paranoia.png`
- `paper/arxiv/figures/exp1_win_rates.png`
- `paper/arxiv/figures/exp2_win_rates.png`
- `paper/arxiv/figures/exp3_violations.png`
- `paper/arxiv/figures/game_length_distribution.png`
- `paper/arxiv/figures/lie_frequency_heatmap.png`
- `paper/arxiv/figures/lie_frequency_vs_win_rate.png`
