# LLM Bullshit Research Summary

Generated: 2026-04-15T13:54:56.214383+00:00

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
| 0 | 150 | 6 | 25.0% (95% CI 21.5% to 28.5%) | 34.5% (95% CI 33.2% to 35.7%) | 20.4% (95% CI 18.8% to 22.0%) | n/a |
| 1 | 150 | 6 | 25.0% (95% CI 21.7% to 28.5%) | 38.5% (95% CI 37.3% to 39.8%) | 40.6% (95% CI 39.1% to 42.2%) | n/a |
| 2 | 150 | 6 | 25.0% (95% CI 21.7% to 28.5%) | 34.4% (95% CI 33.1% to 35.7%) | 29.1% (95% CI 27.2% to 31.0%) | n/a |
| 3 | 150 | 6 | 25.0% (95% CI 21.5% to 28.5%) | 26.5% (95% CI 25.5% to 27.5%) | 20.0% (95% CI 18.7% to 21.4%) | 26.5% (95% CI 25.5% to 27.5%) |

## RQ1: Baseline Deception (Experiment 1)

| Model | Games | Win rate | Lie frequency | Lie success | Paranoia | Challenge accuracy |
|---|---:|---:|---:|---:|---:|---:|
| moonshotai/kimi-k2.5 | 100 | 66.0% | 47.6% | 10.2% | 26.3% | 53.0% |
| qwen/qwen3.5-397b-a17b | 100 | 25.0% | 42.6% | 11.0% | 35.9% | 36.2% |
| minimaxai/minimax-m2.5 | 100 | 25.0% | 37.5% | 7.5% | 33.9% | 32.8% |
| z-ai/glm5 | 100 | 23.0% | 34.8% | 13.1% | 35.9% | 36.3% |
| nvidia/nemotron-3-super-120b-a12b | 100 | 11.0% | 49.4% | 7.0% | 38.3% | 41.5% |
| mistralai/mistral-small-4-119b-2603 | 100 | 0.0% | 19.3% | 25.9% | 73.2% | 34.8% |

Top baseline winner: `moonshotai/kimi-k2.5` at 66.0%.
Highest baseline lie frequency: `nvidia/nemotron-3-super-120b-a12b` at 49.4%.

## RQ2: Moral Restraint (Experiment 1 vs Experiment 2)

| Model | Exp 1 lie frequency | Exp 2 lie frequency | Delta (Exp2 - Exp1) |
|---|---:|---:|---|
| z-ai/glm5 | 34.8% | 27.0% | -7.9% (95% CI -11.3% to -4.4%) |
| minimaxai/minimax-m2.5 | 37.5% | 30.1% | -7.4% (95% CI -10.8% to -3.9%) |
| mistralai/mistral-small-4-119b-2603 | 19.3% | 15.7% | -3.6% (95% CI -6.5% to -0.8%) |
| qwen/qwen3.5-397b-a17b | 42.6% | 39.2% | -3.4% (95% CI -6.7% to -0.2%) |
| nvidia/nemotron-3-super-120b-a12b | 49.4% | 46.5% | -2.9% (95% CI -6.3% to +0.5%) |
| moonshotai/kimi-k2.5 | 47.6% | 48.1% | +0.4% (95% CI -3.3% to +4.0%) |

Largest lie-frequency reduction: `z-ai/glm5` with -7.9% (95% CI -11.3% to -4.4%).
Largest lie-frequency increase: `moonshotai/kimi-k2.5` with +0.4% (95% CI -3.3% to +4.0%).

## RQ3: Instruction Compliance (Experiment 3)

| Model | Games | Instruction violation rate | Win rate |
|---|---:|---:|---:|
| moonshotai/kimi-k2.5 | 100 | 29.2% | 57.0% |
| qwen/qwen3.5-397b-a17b | 100 | 29.0% | 51.0% |
| z-ai/glm5 | 100 | 27.7% | 21.0% |
| nvidia/nemotron-3-super-120b-a12b | 100 | 26.9% | 15.0% |
| minimaxai/minimax-m2.5 | 100 | 24.9% | 6.0% |
| mistralai/mistral-small-4-119b-2603 | 100 | 21.4% | 0.0% |

Highest instruction-violation rate: `moonshotai/kimi-k2.5` at 29.2%.

## Resume Bullets

- Built a reproducible TypeScript + Python multi-agent LLM research harness for deception and instruction-following experiments, with seeded tournaments, provenance-aware logs, and cohort-safe analysis.
- Ran 600 four-player games (2400 player-game observations) across 6 models and experiments 0, 1, 2, 3 using the `nim` provider stack.
- Shipped an interactive browser visualizer plus automated CSV, plotting, and markdown reporting so experimental results can be turned into paper figures and resume bullets quickly.

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
