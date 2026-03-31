# Results Section Template

This file is the near-final writing structure for Section 4 and the key parts of Section 5 once the pilot is finished.

Use it after:

```bash
npm start -- analyze --csv
npm run stats
npm run plots
npm run report
```

## Section 4: Results

### 4.1 Experiment 0: Control Baseline

Opening paragraph template:

> Experiment 0 provides a low-strategy reference condition. Across `[N]` games (`[N_rows]` player-game rows), the mean lie frequency was `[X]`, substantially `[lower/similar/higher]` than in the baseline deception condition. Win rates in this condition mainly serve as a control reference rather than as the main object of study.

Points to fill:
- total games
- total player-game rows
- mean lie frequency
- one sentence comparing Exp 0 to Exp 1
- whether challenge behavior looks notably less strategic

Do not overclaim:
- this condition is a reference point, not the headline result

### 4.2 Experiment 1: Baseline Deception

Opening paragraph template:

> Experiment 1 is the main benchmark condition because deception is legal and expected. Across `[N]` games, `[MODEL_A]` achieved the highest win rate at `[X]`, while `[MODEL_B]` showed the highest lie frequency at `[Y]`. The relationship between deception and success was `[positive / weak / mixed]`, with `[brief evidence]`.

Include:
- baseline leaderboard table
- lie frequency by model
- lie success rate by model
- challenge accuracy by model
- one short qualitative example of either a strong bluff or strong challenge

Questions to answer explicitly:
- who wins most?
- who lies most?
- does lying seem to help?
- who catches lies well?

### 4.3 Experiment 2: Asymmetric Fairness

Opening paragraph template:

> Experiment 2 tests whether models reduce deception when told that the other players are honesty-constrained. Relative to Experiment 1, `[MODEL_A]` showed the largest change in lie frequency (`[delta]`), while `[MODEL_B]` changed the least. Overall, the benchmark provides `[strong / mixed / limited]` evidence that prompt framing can shift deceptive behavior.

Include:
- per-model Exp2 minus Exp1 lie-frequency deltas
- note which confidence intervals exclude zero, if any
- one short qualitative example of apparent restraint or lack of restraint

Questions to answer explicitly:
- did models lie less?
- was the effect broad or model-specific?
- did win rates move with lie-frequency changes?

### 4.4 Experiment 3: Honesty Mandate

Opening paragraph template:

> Experiment 3 tests instruction compliance under competitive pressure. Despite an explicit honesty mandate, `[MODEL_A]` exhibited the highest instruction-violation rate at `[X]`, whereas `[MODEL_B]` remained the most compliant at `[Y]`. This suggests that instruction following and local game incentives can `[align / come apart / vary by model]` in this setting.

Include:
- instruction-violation rates
- win rates in Experiment 3
- one short qualitative violation example or compliance example

Questions to answer explicitly:
- who violated the rule most?
- who complied best?
- did violations seem strategically motivated?

### 4.5 Cross-Experiment Comparisons

Opening paragraph template:

> Across experiments, the largest behavioral shifts occurred in `[metric / condition pair]`. The clearest pattern was `[pattern]`, while `[other comparison]` remained comparatively stable. Taken together, these comparisons suggest that the benchmark is sensitive not just to model identity but also to how the game is framed.

Include:
- strongest cross-experiment deltas
- one paragraph tying together Exp0/1/2/3 rather than repeating every table

Do not overclaim:
- if intervals overlap heavily, say so
- if the pilot is noisy, say the evidence is suggestive rather than decisive

## Section 5: Discussion

### 5.1 Deception Capability

Template:

> In this benchmark, deception capability is not captured by lie frequency alone. The more informative combination is lie frequency plus lie success plus win rate. `[MODEL_A]` appeared strongest under this combined view because `[reason]`, while `[MODEL_B]` lied often but was challenged or punished more successfully.

### 5.2 Moral Restraint

Template:

> The asymmetric-fairness condition provides a direct test of whether prompt framing can suppress deception when the model believes its opponents are constrained. The pilot provides `[strong / mixed / weak]` evidence for such restraint: `[summary sentence]`.

### 5.3 Instruction Compliance

Template:

> The honesty-mandate condition makes the benchmark relevant to alignment concerns by creating a local conflict between following the rule and improving the chance of winning. In the pilot, `[summary of violation pattern]`.

### 5.4 Why This Benchmark Is Useful

Template:

> The main value of Bullshit-Bench is not that it perfectly captures real-world deception, but that it makes strategic misrepresentation measurable, repeated, and contestable. This fills a gap between static honesty benchmarks and more open-ended multi-agent simulations that are harder to score cleanly.

### 5.5 Limitations

Keep these even if the results are strong:
- hosted-provider dependence
- roster-specific results
- prompt sensitivity
- no human baseline
- simpler than real-world deception settings
- pilot scale still limited

## Strong Sentence Bank

Good sentence starters:
- "In this benchmark..."
- "Under the baseline deception condition..."
- "Relative to Experiment 1..."
- "The pilot suggests..."
- "These results provide evidence that..."
- "A key limitation is..."

Avoid:
- "This proves..."
- "This demonstrates that models are..."
- "The benchmark conclusively shows..."

## Final Reminder

The results section should answer the research questions.

It should not read like:
- a changelog
- a leaderboard dump
- a collection of disconnected charts

The best version is:
- one benchmark story
- one pilot dataset
- three research questions
- a handful of carefully interpreted findings
