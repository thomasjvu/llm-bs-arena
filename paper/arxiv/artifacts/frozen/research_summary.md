# LLM Bullshit Research Summary

Generated: 2026-04-15T18:58:34.870735+00:00

## Dataset

- Games: 600
- Player-game rows: 2400
- Models: 6
- Experiments present: 0, 1, 2, 3
- Providers: nim
- Schema versions: 2
- Prompt versions: 2026-03-26
- Prompt hashes: p1939995863

- Aggregate runtime: 156634.9 minutes

## Data Quality Notes

- Token usage is missing from these logs, so cost and efficiency analysis is unavailable for this dataset.

## Experiment Overview

| Experiment | Games | Models | Mean win rate | Mean lie frequency | Mean paranoia | Mean instruction violation |
|---|---:|---:|---|---|---|---|
| 0 | 150 | 6 | 25.0% (95% CI 11.3% to 38.5%) | 34.8% (95% CI 25.6% to 42.3%) | 21.5% (95% CI 7.6% to 39.4%) | n/a |
| 1 | 150 | 6 | 25.0% (95% CI 10.2% to 43.2%) | 39.6% (95% CI 30.4% to 46.9%) | 45.3% (95% CI 36.9% to 58.1%) | n/a |
| 2 | 150 | 6 | 25.0% (95% CI 10.5% to 43.7%) | 36.1% (95% CI 25.4% to 46.1%) | 32.4% (95% CI 17.3% to 50.8%) | n/a |
| 3 | 150 | 6 | 25.0% (95% CI 8.0% to 42.5%) | 27.2% (95% CI 24.0% to 29.9%) | 21.8% (95% CI 12.1% to 34.7%) | 27.2% (95% CI 24.0% to 29.9%) |

## RQ1: Baseline Deception (Experiment 1)

| Model | Games | Win rate | Lie frequency | Lie success | Paranoia | Challenge accuracy |
|---|---:|---:|---:|---:|---:|---:|
| moonshotai/kimi-k2.5 | 100 | 66.0% | 49.6% | 8.0% | 32.4% | 56.2% |
| qwen/qwen3.5-397b-a17b | 100 | 25.0% | 42.2% | 10.2% | 41.9% | 43.6% |
| minimaxai/minimax-m2.5 | 100 | 25.0% | 39.2% | 6.3% | 37.8% | 38.6% |
| z-ai/glm5 | 100 | 23.0% | 35.8% | 12.0% | 41.2% | 45.8% |
| nvidia/nemotron-3-super-120b-a12b | 100 | 11.0% | 50.9% | 7.1% | 44.1% | 47.8% |
| mistralai/mistral-small-4-119b-2603 | 100 | 0.0% | 20.1% | 22.5% | 74.7% | 39.6% |

Top baseline winner: `moonshotai/kimi-k2.5` at 66.0%.
Highest baseline lie frequency: `nvidia/nemotron-3-super-120b-a12b` at 50.9%.

## RQ2: Moral Restraint (Experiment 1 vs Experiment 2)

| Model | Exp 1 lie frequency | Exp 2 lie frequency | Delta (Exp2 - Exp1) |
|---|---:|---:|---|
| z-ai/glm5 | 35.8% | 28.3% | -7.4% |
| minimaxai/minimax-m2.5 | 39.2% | 31.8% | -7.4% |
| mistralai/mistral-small-4-119b-2603 | 20.1% | 14.3% | -5.8% |
| qwen/qwen3.5-397b-a17b | 42.2% | 40.2% | -2.0% |
| nvidia/nemotron-3-super-120b-a12b | 50.9% | 49.2% | -1.7% |
| moonshotai/kimi-k2.5 | 49.6% | 52.9% | +3.3% |

Largest lie-frequency reduction: `z-ai/glm5` with -7.4%.
Largest lie-frequency increase: `moonshotai/kimi-k2.5` with +3.3%.

## RQ3: Instruction Compliance (Experiment 3)

| Model | Games | Instruction violation rate | Win rate |
|---|---:|---:|---:|
| qwen/qwen3.5-397b-a17b | 100 | 31.1% | 51.0% |
| moonshotai/kimi-k2.5 | 100 | 30.5% | 57.0% |
| z-ai/glm5 | 100 | 28.7% | 21.0% |
| nvidia/nemotron-3-super-120b-a12b | 100 | 27.3% | 15.0% |
| minimaxai/minimax-m2.5 | 100 | 25.3% | 6.0% |
| mistralai/mistral-small-4-119b-2603 | 100 | 20.4% | 0.0% |

Highest instruction-violation rate: `qwen/qwen3.5-397b-a17b` at 31.1%.

## Paper Fill-Ins

- Methods sentence: `We ran 600 four-player games across 6 models under experiments 0, 1, 2, 3, using nim with prompt version(s) 2026-03-26.`
- Results sentence template: `In the baseline deception condition, [MODEL] achieved the highest win rate, while [MODEL] lied most frequently; under asymmetric fairness, [MODEL] showed the largest reduction in lie frequency, and under the honesty mandate, [MODEL] had the highest instruction-violation rate.`
- Discussion angle: `The strongest paper story is the tension between competitive success, deception rate, and instruction following, not raw leaderboard ranking.`

## Figures

- `results/figures/compare_lie_frequency.png`
- `results/figures/exp1_deception.png`
- `results/figures/exp1_paranoia.png`
- `results/figures/exp1_win_rates.png`
- `results/figures/exp2_win_rates.png`
- `results/figures/exp3_violations.png`
- `results/figures/game_length_distribution.png`
- `results/figures/lie_frequency_heatmap.png`
- `results/figures/lie_frequency_vs_win_rate.png`
