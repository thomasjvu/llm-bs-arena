# Paper Positioning Notes

This file is the argument for how to present the project in the paper, on arXiv, and in any workshop submission.

## Short Answer

Do **not** pitch this as:
- "we solved LLM deception"
- "we built the definitive benchmark"
- "we prove these models are deceptive in general"

Do pitch it as:
- a **reproducible benchmark harness**
- a **controlled pilot study**
- a **dataset and protocol contribution**
- a **multi-agent honesty/deception evaluation artifact**

Best one-line positioning:

> We introduce Bullshit-Bench, a reproducible benchmark harness for measuring deception, challenge behavior, and instruction compliance in multi-agent LLM play, and we report a 600-game pilot.

## What The Paper Is Actually About

The paper has three layers of contribution.

### Layer 1: Benchmark / Protocol

This is the strongest and safest contribution.

You are contributing:
- the environment
- the prompt conditions
- the metric definitions
- the logging/provenance protocol
- the inclusion/exclusion rules
- the replay/analysis pipeline

Even if the final pilot findings are mixed, this layer still stands.

### Layer 2: Empirical Pilot

This is the next contribution.

You are reporting:
- how six hosted models behaved in this benchmark
- under four conditions
- across a 600-game pilot

This is valuable, but it should be framed as:
- controlled
- roster-specific
- provider-specific
- preliminary rather than definitive

### Layer 3: Alignment Interpretation

This is the weakest and most delicate layer.

You can discuss:
- tension between winning and honesty
- behavior changes under asymmetric or honesty-constrained prompts
- why strategic settings reveal behaviors that static benchmarks miss

But avoid jumping from:
- "models lied in this game"
to
- "models are broadly deceptive agents"

## Best Title Styles

Strongest benchmark-style title:

- `Bullshit-Bench: A Reproducible Benchmark Harness for Deception and Instruction Compliance in Multi-Agent LLM Card Play`

More readable hybrid title:

- `To Lie or Not to Lie: Bullshit-Bench, a Reproducible Benchmark Harness for Multi-Agent LLM Deception`

More empirical title:

- `Bullshit-Bench: A 600-Game Pilot Study of Deception and Instruction Compliance in Multi-Agent LLM Play`

Recommendation:
- use the benchmark-harness title for arXiv / workshop submission
- use the catchier "To Lie or Not to Lie" style for blog posts

## What To Emphasize In The Abstract

The abstract should do these four things:

1. Name the problem:
   honesty evaluations are often static and miss strategic interaction.
2. Name the artifact:
   Bullshit-Bench is a reproducible benchmark harness.
3. Name the design:
   four prompt conditions, seeded runs, provenance-aware logs, player-game analysis.
4. Name the scale:
   600-game pilot.

Optional fifth step after the pilot:
5. Add 2-3 headline findings, but only if they are stable and easy to defend.

## What To Emphasize In The Introduction

The introduction should not sound like:
- "we built a funny project where models bluff each other"

It should sound like:
- "we need better evaluation settings for strategic misrepresentation in multi-agent LLM systems"

The card game is the mechanism, not the full point.

Strong introduction arc:
- honesty and truthfulness benchmarks are useful but incomplete
- strategic interaction changes the problem
- we need legal deception + objective verification + measurable challenge windows
- Bullshit gives those properties with low task overhead
- benchmark validity depends on engineering details
- therefore we introduce a reproducible benchmark harness and a pilot study

## What To Emphasize In Results

Do not make the paper a pure leaderboard paper.

The results section should answer:
- what happened in the baseline deception condition?
- did any models reduce deception under asymmetric-fairness framing?
- did any models violate explicit honesty instructions?
- what tradeoff, if any, exists between lying and winning?

The strongest figures are not:
- "who is #1 overall?"

They are:
- lie frequency vs win rate
- Exp 1 vs Exp 2 lie-frequency deltas
- Exp 3 instruction-violation rates
- a compact baseline leaderboard table

## What To Emphasize In Discussion

Best discussion angle:

This benchmark is valuable because it makes deception a measurable, contestable, repeated behavior rather than a one-shot prompt artifact.

The discussion should separate:
- what the benchmark shows clearly
- what the pilot suggests
- what remains unresolved

Suggested structure:
- deception capability is measurable in this environment
- prompt framing can change strategic behavior
- instruction following and local goal achievement can come apart
- provider/roster/prompt dependence limit generalization

## Claims To Avoid

Avoid language like:
- "models are deceptive"
- "this proves deceptive alignment"
- "our benchmark captures real-world deception"
- "this is the definitive benchmark for honesty"
- "these findings generalize to all frontier models"

Prefer language like:
- "in this benchmark"
- "under this prompt condition"
- "in this hosted-model cohort"
- "the pilot suggests"
- "the benchmark provides evidence that"

## Best Venue Framing

### arXiv

Strong fit:
- benchmark harness
- systems + evaluation artifact
- pilot empirical study

### Workshop / student research / benchmark track

Best fit after the pilot.

Why:
- novel environment
- strong engineering story
- clean metrics
- visually memorable project

### Main conference?

Probably not as-is.

To get closer, you would likely need:
- larger and more stable dataset
- stronger comparison baselines
- human baseline or human-vs-model component
- stronger theoretical or alignment framing

## Fastest Path To A Good Paper

1. Finish the 600-game pilot.
2. Keep the benchmark-harness framing.
3. Report the pilot conservatively.
4. Include 3-5 qualitative case studies.
5. Make the artifact quality obvious:
   dataset card, benchmark spec, replay UI, figures, inclusion rules.

## Final Positioning Recommendation

The safest and strongest version of this paper is:

> a benchmark-harness paper with a 600-game pilot dataset and careful empirical findings

not:

> a grand theory-of-deception paper

That framing is more credible, more publishable, and better for hiring.
