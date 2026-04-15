# Claims-Evidence Matrix

Use this to keep the TMLR submission aligned with the venue's main criterion: every important claim must be supported by clear, convincing evidence, or be reduced until it is.

## Submission Rule

For each headline claim in the abstract, introduction, results, and conclusion:
- state the claim in one sentence
- name the exact cohort and metric behind it
- point to the concrete file or figure that supports it
- note the limitation that keeps the claim honest

If a claim cannot be mapped this way, weaken or remove it.

## Current Headline Claims

### Claim 1

Claim:
- Plain-language honesty instructions reduce but do not eliminate deceptive play.

Evidence:
- Compare Experiment 1 and Experiment 3 lie frequency in the player-level exports.
- Frozen cohort: mean model-level lie frequency drops from `39.6%` in Exp1 to `27.2%` in Exp3.
- In the frozen Exp3 cohort, every model still lies at a material rate, ranging from `20.4%` to `31.1%`.

Sources:
- `paper/tmlr/artifacts/frozen/player_game_stats.csv`
- `paper/tmlr/artifacts/frozen/research_summary.md`

Limitation:
- This is a plain-language honesty mandate, not a maximal intervention.

### Claim 2

Claim:
- The honesty prompt changes table dynamics, not just liar behavior.

Evidence:
- Frozen cohort: mean model-level challenge frequency drops from `45.3%` in Exp1 to `21.8%` in Exp3.
- Mean model-level lie success rises from `11.0%` in Exp1 to `34.7%` in Exp3.

Sources:
- `paper/tmlr/artifacts/frozen/player_game_stats.csv`
- `paper/tmlr/artifacts/frozen/research_summary.md`

Limitation:
- This is still a roster-specific pilot and the mechanism is inferred from behavior, not directly elicited from internal model state.

### Claim 3

Claim:
- Asymmetric fairness produces mixed, model-specific restraint effects rather than a universal reduction in deception.

Evidence:
- Exp1-to-Exp2 lie-frequency deltas differ by model.
- Frozen cohort deltas:
  - GLM `-7.4 pts`
  - MiniMax `-7.4`
  - Mistral `-5.8`
  - Qwen `-2.0`
  - Nemotron `-1.7`
  - Kimi `+3.3`

Sources:
- `paper/tmlr/artifacts/frozen/player_game_stats.csv`
- `paper/tmlr/artifacts/frozen/research_summary.md`

Limitation:
- This is evidence of heterogeneous response to one framing, not proof of moral restraint as a general phenomenon.

### Claim 4

Claim:
- Bullshit-Bench measures stable strategic styles rather than only a raw leaderboard.

Evidence:
- Mistral shows a high-challenge, zero-win profile across the frozen cohort and is the clearest example of costly over-enforcement.
- Kimi leads Experiments 1, 2, and 3, while Nemotron leads Experiment 0.
- Qualitative case studies show recurring strategy types: successful bluffing, targeted challenge, and honesty-mandate violation.

Sources:
- `paper/tmlr/artifacts/frozen/player_game_stats.csv`
- `paper/tmlr/artifacts/frozen/research_summary.md`
- `paper/support/QUALITATIVE_CASE_STUDIES.md`

Limitation:
- Strategic-style claims should stay descriptive rather than causal; the benchmark measures behavior, not internal mechanisms.

### Claim 5

Claim:
- The benchmark is useful because it combines legal deception, objective verification, repeated peer challenge, and hidden private state in one reproducible environment.

Evidence:
- Environment and protocol are fully specified in the benchmark docs and code.
- Saved logs encode truthful vs deceptive play, challenge opportunities, and challenge outcomes directly from game state.

Sources:
- `BENCHMARK_SPEC.md`
- `DATASET_CARD.md`
- `src/engine/game-state.ts`
- `src/engine/play-rules.ts`
- `src/test/game.test.ts`

Limitation:
- The current paper still studies one environment family; broader generalization should be presented as future work.

## Final Pass Before Submission

- prune any claim that is not directly tied to a CSV, figure, case study, or benchmark-spec artifact
- keep “suggests” and “in this benchmark” language where evidence is still pilot-scale
- move speculative ideas into discussion or future work
