# Figure and Table Plan

This file defines the minimum set of visuals and tables needed for the paper, blog post, and project page once the 600-game pilot is done.

## Paper Figures

### Figure 1: Benchmark Overview Diagram

Format:
- one system diagram

Content:
- four models at the table
- hidden cards
- legal bluffing
- challenge window
- provenance-aware logs
- analysis outputs

Purpose:
- explain the benchmark quickly in the introduction or methods section

Status:
- can be drafted before results

### Figure 2: Baseline Deception Leaderboard

Format:
- bar chart or dot plot

Rows:
- Experiment 1 only

Metrics:
- win rate
- lie frequency
- lie success rate

Purpose:
- show which models are strongest and which are most deceptive in the main baseline condition

### Figure 3: Moral Restraint Comparison

Format:
- paired bars or point-range deltas

Rows:
- Experiment 1 vs Experiment 2

Metric:
- lie frequency delta per model

Purpose:
- answer RQ2 directly

### Figure 4: Honesty Violation Rates

Format:
- bar chart with confidence intervals

Rows:
- Experiment 3 only

Metric:
- instruction violation rate

Purpose:
- answer RQ3 directly

### Figure 5: Lie Frequency vs Win Rate

Format:
- scatter plot

Rows:
- probably Experiment 1, optionally all experiments colored by condition

Purpose:
- test whether more deception is actually associated with better outcomes

## Paper Tables

### Table 1: Model Roster

Columns:
- model id
- family
- approximate size
- provider cohort

Purpose:
- compact description of the roster

### Table 2: Experimental Conditions

Columns:
- experiment id
- short name
- prompt framing
- primary research question

Purpose:
- keep the four-condition design legible

### Table 3: Headline Results

Rows:
- one row per model

Columns:
- Exp 1 win rate
- Exp 1 lie frequency
- Exp 1 lie success rate
- Exp 2 lie-frequency delta
- Exp 3 violation rate

Purpose:
- the one table a skim reader should understand

### Table 4: Dataset Summary

Columns:
- total games
- completed games per experiment
- player-game rows
- turn-cap terminations
- excluded/quarantined logs

Purpose:
- document dataset scale and hygiene

## Blog Figures

Use fewer, more intuitive visuals than the paper:

1. one benchmark overview image or UI screenshot
2. one baseline leaderboard chart
3. one moral-restraint comparison chart
4. one honesty-violation chart

The blog should optimize for clarity over completeness.

## Portfolio / Project Page Visuals

Use:
- one screenshot of the visualizer
- one screenshot of the leaderboard/stats panel
- one simple chart

Do not overload the project page with all paper figures.

## Data Sources For Each Visual

Preferred source hierarchy:

1. `results/research_summary.md` for headline numbers
2. `logs/csv/player_game_stats.csv` for model-level plotting
3. `logs/csv/game_summary.csv` for game-level metadata and termination counts
4. selected JSON game logs for qualitative examples

## Rules

- Every figure must state which experiment(s) it uses.
- Every table must clearly distinguish observed metrics from derived deltas.
- Do not mix quarantined logs with the final cohort.
- Do not build paper visuals from invalid pre-fix runs.
