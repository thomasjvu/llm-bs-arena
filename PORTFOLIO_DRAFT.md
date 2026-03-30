# Portfolio and Resume Drafts

## One-Line Project Description

Built a reproducible multi-agent evaluation framework that makes frontier LLMs play the card game *Bullshit* to measure deception, lie detection, moral restraint, and instruction compliance under competitive pressure.

## Short Portfolio Blurb

This project studies how large language models behave when deception is strategically useful. I built a TypeScript game engine, NVIDIA NIM provider layer, browser visualizer, logging pipeline, and analysis workflow that let six hosted models play hundreds of games of *Bullshit* under four different prompt conditions. The system logs every move, lie, challenge opportunity, and reasoning trace, then exports reproducible CSVs, figures, and leaderboard views for analysis.

## Medium Portfolio Blurb

Most LLM honesty evaluations are static: ask a question, score the answer, move on. I wanted a setting where deception is legal, measurable, and strategically useful, so I built a research framework that makes four LLMs play the card game *Bullshit* against each other. The environment uses a seeded TypeScript rules engine, NVIDIA NIM-backed inference, provenance-aware logging, browser replay tools, and a player-game analysis pipeline built around bootstrap summaries. The resulting benchmark measures who lies, who gets away with it, who detects lies well, and who violates explicit honesty instructions when the game rewards doing so.

## Resume Bullets

### Version A: Research Engineering

- Built a reproducible multi-agent LLM benchmark in TypeScript/Node.js that evaluates deception, lie detection, and instruction compliance by having four hosted models play *Bullshit* across seeded tournament matchups.
- Designed a provenance-aware experiment pipeline with NVIDIA NIM integration, prompt/version hashing, JSON game logs, CSV exports, bootstrap analysis, and a browser leaderboard/visualizer for inspecting live and historical runs.
- Hardened long-running inference collection by adding retry/recovery logic, transcript logging, checkpointed tournament sharding, and dataset-cohort filtering to support a 600-game pilot study without manual log cleanup.

### Version B: Product + Infra

- Built an end-to-end evaluation product for competitive LLM behavior, including a game engine, live web UI, model-provider adapters, analytics pipeline, and publishable markdown/figure outputs.
- Implemented fault-tolerant hosted-model orchestration on NVIDIA NIM with multi-hour recovery windows, replayable transcripts, and safe parallel tournament sharding for large experiment runs.
- Turned raw LLM interactions into research-ready metrics, including win rate, lie frequency, lie success, challenge accuracy, and honesty-instruction violation rates.

### Version C: With Results Placeholder

- Built a reproducible multi-agent benchmark that ran `[X]` LLM-vs-LLM games of *Bullshit* across four prompt conditions to measure deception, strategic restraint, and instruction compliance.
- Engineered the full stack for experiment execution and analysis: TypeScript rules engine, NVIDIA NIM inference layer, browser replay UI, provenance-aware logs, and bootstrap-based reporting.
- Identified and fixed research-validity issues in early prototypes, including non-reproducible seeding, incorrect challenge-opportunity metrics, impossible public game states, and fragile long-run API failure handling.

## Project Page Structure

Use this order on a personal site or portfolio page:

1. Problem
   Evaluate how LLMs behave when deception is strategically useful rather than merely possible.
2. Why this setup
   Bullshit gives legal bluffing, objective truth labels, and challenge-based verification.
3. What you built
   Engine, provider integration, visualizer, logging, analysis, and leaderboard.
4. Hard engineering problems
   Reproducibility, failure recovery, game-rule enforcement, metric validity, and safe parallelization.
5. Results
   Insert 2-3 figures and one paragraph of findings after the pilot finishes.
6. Why it matters
   Better evaluation of honesty and strategic behavior in multi-agent LLM systems.

## Interview Walkthrough

### What the project is

I built a benchmark where large language models play the card game *Bullshit* against each other so I can measure strategic deception in a controlled environment.

### Why this game

It has the right properties for deception research: lying is legal, each claim is objectively verifiable, and success depends on both bluffing and lie detection.

### What was technically hard

The interesting part was not just wiring up model calls. I had to make the runs reproducible, log the right research metadata, harden the system against long-running API instability, and make sure the metrics actually matched what happened in the game.

### Example bugs that mattered

- challenge opportunities were initially counted incorrectly
- the opening-player rule needed to start with the Ace of Spades holder
- models could produce impossible public claims unless the engine enforced card-count constraints
- hosted NIM failures required adapter recreation and long-window recovery instead of simple retries
- same-experiment tournaments needed shard-specific checkpoints for safe parallelism

### Why employers should care

It demonstrates full-stack engineering, API integration, fault tolerance, experiment design, data analysis, and technical writing in one project. It is also a much more distinctive story than a generic model wrapper or dashboard clone.

## LinkedIn / Project Repository Summary

Built a research-grade benchmark that makes frontier LLMs play *Bullshit* to study deception, challenge behavior, and honesty under competitive pressure. The project combines a seeded TypeScript game engine, NVIDIA NIM model execution, live visualization, provenance-aware logging, and bootstrap-based analysis for a 600-game pilot study.
