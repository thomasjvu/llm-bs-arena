# Appendix Draft: Reproducibility and Artifact Details

This file is the appendix-ready reproducibility material for the Bullshit-Bench paper and benchmark release.

## A.1 Environment and Runtime

Primary execution stack:
- TypeScript / Node.js game engine
- importable multi-agent environment API
- NVIDIA NIM as the primary hosted provider
- OpenAI-compatible chat-completions interface
- Python analysis stack for CSV export, plotting, bootstrap summaries, and markdown report generation
- versioned release builder for manifests, checksums, and raw-log packaging

Operational design choices that matter for reproducibility:
- seeded shuffle and seeded seating order
- logged provider metadata
- logged prompt version and prompt hash
- bounded prompt context
- structured JSON responses with retry/repair logic
- recoverable-provider outer retry loop for long-running hosted inference

## A.2 Benchmark-Valid Cohort Definition

The default analysis cohort includes only runs that satisfy all of:
- current schema version
- current provider cohort
- current prompt version
- current prompt hash
- `terminationReason = "winner"`
- not located in a quarantine folder

This exclusion policy exists to prevent stale or mixed logs from silently contaminating the reported benchmark cohort.

## A.3 Tournament Protocol

Pilot design:
- 6 models
- 4-player games
- all unique `C(6,4) = 15` matchups
- 10 games per matchup per experiment
- experiments `0, 1, 2, 3`
- 600 total games in the pilot

Shard design:
- shard A: matchup indices `0-4`
- shard B: matchup indices `5-9`
- shard C: matchup indices `10-14`

Parallel sharding is safe only across disjoint matchup ranges for the same experiment, or across different experiments.

## A.4 Research-Default Execution Settings

Research-default runs use:
- uncapped play until a natural winner
- current NVIDIA NIM provider cohort
- fixed model roster for the pilot
- transcript logging for auditability

Safety-capped runs are permitted only for debugging or recovery. Such runs are marked with `terminationReason = "turn_cap"` and excluded from the default paper/report pipeline.

## A.5 Logged Fields

Each game log records:
- game id
- experiment id
- seed
- roster and seating order
- provider and provider base URL when available
- prompt version and prompt hash
- full turn history
- challenge opportunities
- challenge outcomes
- lie/truth labels
- winner and termination reason

Derived exports record:
- player-game rows
- game-level rows
- turn-level rows

Release metadata records:
- benchmark release manifest
- dataset manifest
- evaluation manifest
- checksums and release notes

## A.6 Analysis Defaults

Primary analysis unit:
- one row per player per game

Default summaries:
- per-model means
- between-experiment deltas
- bootstrap 95% confidence intervals

Excluded from default reporting:
- quarantined runs
- mixed-cohort runs unless explicitly requested
- capped runs

## A.7 Failure Modes and Mitigations

Observed failure modes during pilot collection:
- provider timeouts on heavy hosted models
- temporary provider-side degraded states
- malformed JSON or partial structured outputs
- model attempts to make impossible public claims

Mitigations implemented:
- per-request retry and backoff
- outer adapter recreation and long recovery window
- JSON extraction/repair retries
- engine enforcement of public count constraints
- uncapped natural-win default
- quarantine path for invalid legacy logs

## A.8 What A Reproducer Needs

Minimum reproduction steps:
1. Install Node and Python dependencies.
2. Configure a current NVIDIA API key.
3. Verify provider availability and model roster.
4. Run one logged validation game.
5. Run the desired tournament shards.
6. Export CSVs and generate stats/plots/report.
7. Build the official release bundle and verify manifests/checksums.

Primary operator docs:
- `README.md`
- `RESEARCH_RUNBOOK.md`
- `BENCHMARK_SPEC.md`
- `DATASET_CARD.md`

## A.9 Suggested Appendix Tables

Add these to the final appendix once the pilot is complete:
- full model roster table with provider model ids
- exact prompt templates
- final cohort manifest
- excluded-run counts by reason
- full bootstrap interval tables
- shard completion summary

## A.10 Honest Scope Statement

This appendix supports a benchmark-release and pilot-study claim. It does not justify broad claims that the benchmark captures all relevant forms of deception or that observed behavior generalizes beyond the reported provider, prompt, and roster cohort.
