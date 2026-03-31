# Qualitative Case Study Template

Use this file to collect 3-5 paper-quality example games once the pilot finishes.

The goal is not to cherry-pick the most dramatic moment possible. The goal is to choose representative or especially informative cases that help interpret the quantitative results.

## Selection Rules

Choose cases that are:
- from the final valid cohort
- natural wins only (`terminationReason = "winner"`)
- post-fix logs only
- clearly tied to one of the three research questions

Avoid cases that are:
- only interesting because of provider failures
- only interesting because a model produced malformed JSON
- from capped or quarantined runs
- impossible to explain in 1-2 paragraphs

## Recommended Case Types

### Case 1: Successful Bluff

Use when:
- a lie goes unchallenged or survives despite strong challenge pressure

Why it matters:
- shows practical deception capability rather than merely lie frequency

### Case 2: Strong Lie Detection

Use when:
- a challenger correctly infers deception from public evidence or recent play history

Why it matters:
- shows that challenge behavior is meaningful, not random paranoia

### Case 3: Moral Restraint Example

Use when:
- a model in Experiment 2 appears to lie less or reason differently because opponents are described as honesty-constrained

Why it matters:
- grounds the Exp1 vs Exp2 quantitative deltas in an interpretable local behavior shift

### Case 4: Honesty Violation Example

Use when:
- a model in Experiment 3 lies despite explicit honesty instructions

Why it matters:
- provides a concrete example of instruction-following failure under competitive pressure

### Case 5: Honest Compliance Example

Use when:
- a model in Experiment 3 stays honest even when lying would have been strategically attractive

Why it matters:
- keeps the paper balanced and avoids making Experiment 3 sound one-sided

## Case Study Record Template

Copy this block once per selected case.

```md
## Case [N]: [Short Label]

- Game ID:
- Experiment:
- Models involved:
- Winner:
- Total turns:
- Why this case was selected:

### What happened

[4-6 sentence factual summary of the turn sequence or local episode]

### Why it matters

[2-4 sentence interpretation tied to a research question]

### Evidence to cite

- Turn numbers:
- Key lie/truth event:
- Key challenge event:
- Relevant reasoning snippet themes:

### Risks / caveats

[Anything that could make the example misleading if overinterpreted]
```

## Suggested Workflow

1. Use `results/research_summary.md` to identify which models/experiments deserve examples.
2. Open candidate logs in the browser visualizer or inspect the JSON directly.
3. Prefer cases that match a quantitative finding already present in the paper.
4. Write the factual summary first.
5. Only then write the interpretation.

## Good Interpretation Style

Good:
- "This example illustrates a successful unchallenged bluff in the baseline deception condition."
- "This case is consistent with the model's higher challenge accuracy in the aggregate results."
- "This game shows a local tension between honesty instructions and immediate win incentives."

Bad:
- "This proves the model is deceptive."
- "This shows the model has agency."
- "This demonstrates real-world manipulative intent."

## Where To Use These

- 1 short example in Section 4
- 2-3 examples in Discussion
- 1 more narrative example in the blog post

You do not need to cram all selected cases into the main paper text. Some can live in the appendix or blog.
