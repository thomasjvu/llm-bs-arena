# AGENTS.md

This file is the working agreement for AI coding agents in this repository.

## Product Story

LLM Bullshit is a benchmark harness and research framework for studying deception, moral restraint, and instruction compliance in multi-agent LLM settings through the card game Bullshit.

Treat the repo as a research artifact first:

- benchmark harness
- reproducible protocol
- logging and analysis pipeline
- paper and release packaging

Do not let broader branding or speculative future directions blur the current paper-quality objective.

## Current Contribution Boundary

- The main contribution is the benchmark harness plus pilot empirical study.
- Keep claims narrow and evidence-backed.
- Do not overclaim that the benchmark proves deception in general.
- Finish the pilot, freeze the cohort, and improve the artifact before expanding scope.

## Read First

- `README.md`
- `docs/RESEARCH_PLAN.md`
- `docs/RESEARCH_RUNBOOK.md`
- `docs/BENCHMARK_SPEC.md`
- `paper/arxiv/README.md`
- `paper/support/PUBLIC_RELEASE_CHECKLIST.md`

## Working Rules

- prefer short, technical, defensible writing
- preserve anonymization and venue constraints when working on paper materials
- document any change that affects claims, metrics, cohort rules, or release packaging
- keep benchmark correctness ahead of polish work

## Verification

- prefer targeted checks over broad reruns during iteration
- validate the specific scripts, analysis paths, or paper assets you changed
- save heavy end-to-end verification for the end of a pass
