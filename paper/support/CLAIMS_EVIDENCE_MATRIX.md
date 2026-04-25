# Claims-Evidence Matrix

Use this to keep the paper aligned with its main standard: every important claim must be supported by clear, convincing evidence, or be reduced until it is.

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
- Plain-language honesty instructions sharply reduce optional lying when truthful play is available, but overall lie frequency remains nonzero because truthful-play-unavailable turns are common.

Evidence:
- Compare Experiment 1 and Experiment 3 adjusted optional-lie rates in the player-level exports.
- Frozen cohort: mean model-level optional-lie rate given truthful availability drops from `13.4%` in Exp1 to `2.2%` in Exp3.
- In the frozen Exp3 cohort, mean model-level overall lie frequency is still `27.2%`, while truthful-play-unavailable turns account for `25.3%` of turns.
- Exp3 adjusted per-model optional-lie rates range from `0.0%` for Kimi to `11.7%` for Mistral.

Sources:
- `paper/arxiv/artifacts/frozen/player_game_stats.csv`
- `paper/arxiv/artifacts/frozen/research_summary.md`
- `paper/arxiv/figures/compare_optional_lie_rate.png`

Limitation:
- This is a plain-language honesty mandate with real conflict turns, so overall lie frequency is not a clean compliance metric by itself.

### Claim 2

Claim:
- The honesty prompt changes table dynamics, not just liar behavior.

Evidence:
- Frozen cohort: mean model-level challenge frequency drops from `45.3%` in Exp1 to `21.8%` in Exp3.
- Mean model-level lie success rises from `11.0%` in Exp1 to `34.7%` in Exp3.

Sources:
- `paper/arxiv/artifacts/frozen/player_game_stats.csv`
- `paper/arxiv/artifacts/frozen/research_summary.md`

Limitation:
- This is still a roster-specific pilot and the mechanism is inferred from behavior, not directly elicited from internal model state.

### Claim 3

Claim:
- Asymmetric fairness does not move all models in the same direction: five reduce optional lying relative to Experiment 1, while Kimi lies more.

Evidence:
- Exp1-to-Exp2 adjusted optional-lie deltas differ by model.
- Frozen cohort deltas:
  - Nemotron `28.2% -> 21.2%`
  - Qwen `15.3% -> 10.1%`
  - GLM `5.5% -> 0.7%`
  - MiniMax `7.2% -> 5.0%`
  - Mistral `7.5% -> 5.8%`
  - Kimi `16.6% -> 17.8%`

Sources:
- `paper/arxiv/artifacts/frozen/player_game_stats.csv`
- `paper/arxiv/artifacts/frozen/research_summary.md`

Limitation:
- This is evidence of a mixed response to one prompt framing, not proof of internal moral reasoning or a general honesty disposition.

### Claim 4

Claim:
- Bullshit-Bench measures stable strategic styles rather than only a raw leaderboard.

Evidence:
- Mistral shows a high-challenge, zero-win profile across the frozen cohort and is the clearest example of costly over-enforcement.
- Kimi leads Experiments 1, 2, and 3, while Nemotron leads Experiment 0.
- Qualitative case studies show recurring strategy types: successful bluffing, targeted challenge, optional dishonesty under an honesty rule, and conflict-turn bluffing under incompatible local constraints.

Sources:
- `paper/arxiv/artifacts/frozen/player_game_stats.csv`
- `paper/arxiv/artifacts/frozen/research_summary.md`
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

### Claim 6

Claim:
- Under the honesty mandate, some model-level performance shifts are consistent with a role for challenge calibration in addition to optional-lie reduction.

Evidence:
- Qwen's win rate rises from `25.0%` in Exp1 to `51.0%` in Exp3 while challenge frequency falls from `41.9%` to `6.1%` and challenge accuracy rises from `43.6%` to `55.7%`.
- MiniMax reduces adjusted optional-lie rate from `7.2%` to `0.8%`, but win rate still falls from `25.0%` to `6.0%`.
- Mistral remains the Exp3 negative anchor with `50.8%` challenge frequency, `11.7%` adjusted optional-lie rate, and `0.0%` win rate.
- Mean model-level challenge accuracy does not increase uniformly across conditions, which is why the paper keeps this as a descriptive model-level interpretation rather than a condition-wide claim.

Sources:
- `paper/arxiv/artifacts/frozen/player_stats_exp1.csv`
- `paper/arxiv/artifacts/frozen/player_stats_exp3.csv`
- `paper/arxiv/sections/05_discussion.tex`

Limitation:
- This is a descriptive six-model pattern, not a causal or general statistical claim.

### Claim 7

Claim:
- The frozen turn logs contain egregious zero-match bluffs, and a small fraction of them survive unchallenged, especially in Experiments 1 and 2.

Evidence:
- Strict definition: claim count `4` with `0` matching cards actually played.
- Control comparison under the strict definition:
  Exp0 `10` total, `0` unchallenged;
  Exp1 `1,369` total, `27` unchallenged;
  Exp2 `997` total, `15` unchallenged;
  Exp3 `277` total, `10` unchallenged.
- Frozen cohort aggregate: `2,653` strict zero-match four-card bluffs, `52` unchallenged.
- Broad definition: claim count `>=3` with `0` matching cards actually played.
- Broad comparison:
  Exp0 `52` total, `8` unchallenged;
  Exp1 `1,627` total, `33` unchallenged;
  Exp2 `1,233` total, `21` unchallenged;
  Exp3 `347` total, `16` unchallenged.
- Frozen cohort aggregate: `3,259` broad zero-match bluffs, `78` unchallenged.
- These events are concentrated in Experiments `1` and `2`, with most instances coming from Nemotron and Kimi.

Sources:
- `logs/csv/all_turns.csv`
- `paper/arxiv/sections/05_discussion.tex`

Limitation:
- These are turn-level descriptive counts, not normalized model-level rates, so they support a discussion point about bluff style rather than a headline ranking claim.

## Final Pass Before Submission

- prune any claim that is not directly tied to a CSV, figure, case study, or benchmark-spec artifact
- keep “suggests” and “in this benchmark” language where evidence is still pilot-scale
- move speculative ideas into discussion or future work
