# Results Fill Guide

This file is the fastest path from finished pilot dataset to finished paper/blog/resume text.

## 1. Generate the outputs

Run:

```bash
npm start -- analyze --csv
npm run stats
npm run plots
npm run report
```

Primary outputs:
- `logs/csv/player_game_stats.csv`
- `logs/csv/game_summary.csv`
- `logs/csv/all_turns.csv`
- `results/figures/`
- `results/research_summary.md`

## 2. Fill the paper

Use `results/research_summary.md` to populate:

### Abstract
- one sentence on dataset scale
- one sentence on main deception finding
- one sentence on Exp 2 restraint finding
- one sentence on Exp 3 compliance/violation finding

### Section 4.1
- control-condition win rates
- control lie frequency
- note whether behavior is meaningfully lower-strategy than Exp 1

### Section 4.2
- baseline deception leaderboard
- lie frequency by model
- lie success rate by model
- one short qualitative example

### Section 4.3
- Exp 2 minus Exp 1 lie-frequency deltas
- identify which models reduced lying, if any
- note whether CIs exclude zero for the biggest effects

### Section 4.4
- Exp 3 violation rates
- identify which models complied most and least
- include one example of a strategically tempting violation

### Section 4.5
- summarize the biggest cross-experiment shifts
- do not overclaim if intervals overlap heavily

### Discussion
- answer the three research questions directly
- separate strong findings from suggestive ones
- explicitly mention pilot-study limitations

## 3. Fill the blog post

Add:
- one headline table with per-model win rate and lie frequency
- one chart for lie frequency vs. win rate
- one chart for Exp 2 vs. Exp 1 lie frequency
- one chart for Exp 3 violation rate
- one representative game anecdote

Keep the blog more narrative than the paper.

## 3.5 Fill the qualitative examples

Use:
- `QUALITATIVE_CASE_STUDIES.md`

Select:
- 1 successful bluff
- 1 strong challenge/detection example
- 1 moral-restraint example
- 1 honesty-violation or compliance example

Make sure every selected case:
- comes from the final valid cohort
- supports a quantitative result already in the paper
- does not rely on capped or quarantined runs

## 4. Fill the portfolio / resume

Update:
- `PORTFOLIO_DRAFT.md`

Replace:
- `[X]` with total completed games
- add 1-2 numeric findings only if they are stable and easy to defend

Good examples:
- "Ran a 600-game multi-agent LLM benchmark..."
- "Measured per-model deception and challenge accuracy across four prompt conditions..."
- "Built fault-tolerant hosted-model orchestration with recovery, replay, and shard-safe checkpoints..."

## 5. Sanity rules before publishing claims

- Do not mix quarantined logs with the final cohort
- Do not include `turn_cap` games in the final paper tables or figures
- Do not report turn-level p-values as the main result
- Do not describe the pilot as conclusive
- Do not include a figure unless you can explain exactly what rows produced it
- Do not publish qualitative examples that rely on pre-fix invalid games
