# Research Runbook

This is the first-time, do-it-right version of the workflow.

## What You Are Trying to Produce

By the end of this process, you want:
- a clean NIM-backed dataset in `logs/games/`
- exported analysis tables in `logs/csv/`
- figures in `results/figures/`
- a markdown summary in `results/research_summary.md`
- filled-in results in `PAPER_DRAFT.md`
- 2-3 resume bullets based on the real run

## Ground Rules

- Do not mix old and new datasets.
- Freeze the model roster before the main run.
- Do not change prompts, provider, or roster halfway through a dataset.
- Treat the first live games as validation, not as paper results.
- The engine enforces standard Bullshit turns: 1-4 cards per play, with the number of face-down cards visible to everyone.

## Step 0: Start Clean

You already asked me to clear the legacy logs and derived outputs. The workspace is now clean.

Before any future full rerun, make sure these directories only contain data from the run you are about to analyze:
- `logs/games/`
- `logs/csv/`
- `results/figures/`
- `results/research_summary.md`

## Step 1: Configure the Environment

1. Copy the env file:

```bash
cp .env.example .env
```

2. Open `.env` and set:

```bash
LLM_PROVIDER=nim
NVIDIA_API_KEY=your_real_key_here
```

For the current heavyweight NIM roster, these are good defaults:

```bash
NVIDIA_NIM_TIMEOUT_MS=180000
LLM_PLAY_MAX_TOKENS=8192
LLM_CHALLENGE_MAX_TOKENS=4096
LLM_RECOVERY_WINDOW_MS=36000000
LLM_RECOVERY_BACKOFF_MS=30000
```

Why these were chosen:
- some hosted NIM models in this roster can take more than 60 seconds to respond, so `180000` ms avoids premature timeouts
- `8192` for plays and `4096` for challenges are large enough to avoid most truncation without inviting long rambling outputs
- larger `max_tokens` does not reliably make the model "smarter"; it mostly gives it permission to output more text
- the game only includes the current state plus the last 5 turns, so the prompt stays bounded across a long game

How to tune them:
- if logs show `[TRUNCATED]`, raise the relevant token cap slightly
- if logs show request timeouts, raise `NVIDIA_NIM_TIMEOUT_MS`
- once the run settings look stable, do not change them halfway through a dataset
- the CLI will keep recreating the adapter for recoverable provider failures until the 10-hour recovery window expires

3. Do not set Chutes or Featherless unless you intentionally want to use them as fallbacks.

## Step 2: Install and Verify Dependencies

Run these commands exactly:

```bash
npm install
npm run audit
npm run check
npm run python:setup
```

What success looks like:
- `npm run audit` reports 0 vulnerabilities
- `npm run check` passes
- `.venv/` exists
- no TypeScript or test failures

## Step 3: Confirm NIM Is Reachable

Run:

```bash
npm start -- nim-models
```

What success looks like:
- it prints a list of available models
- it does not error on missing API key or auth
- the exact hosted model IDs you plan to use still appear in the list

If this fails, stop and fix the API key before doing anything else.

## Step 4: Sanity-Check the Game Logic in Mock Mode

Run one mock game:

```bash
npm start -- game -e 1 -p mock
```

Why:
- this checks the game engine without spending API calls

What success looks like:
- the game completes
- a JSON file appears in `logs/games/`

## Step 5: Validate One Real Game Per Experiment

Run these four commands:

```bash
npm start -- game -e 0 -p nim
npm start -- game -e 1 -p nim
npm start -- game -e 2 -p nim
npm start -- game -e 3 -p nim
```

If you want a terminal transcript saved while the game is running, use:

```bash
npm run run:logged -- game -e 0 -p nim
```

That writes the full terminal output to `logs/runs/` so you can share it, inspect it later, or ask me to review it from disk.

If you want a validation game to be exactly reproducible, pass an explicit seed:

```bash
npm start -- game -e 0 -p nim -s 123456
```

Uncapped play is now the default for live CLI and tournament runs. You can still pass `--max-turns <n>` as a safety valve for debugging or overnight recovery, but capped games are treated as censored and excluded from the default analysis/report pipeline.

What each command is doing:
- `npm start -- game -e 0 -p nim`
  Runs one single Bullshit game using NVIDIA NIM under the control condition.
  This is your low-strategy baseline. It checks that the full live pipeline works even when the prompt is not pushing strategy.
- `npm start -- game -e 1 -p nim`
  Runs one single Bullshit game using NVIDIA NIM under the normal deception-allowed condition.
  This is the baseline research condition and the first one you should inspect closely.
- `npm start -- game -e 2 -p nim`
  Runs one single game where the player is told the other players must be honest, while it may still lie.
  This validates the moral-restraint framing before you spend time on a tournament.
- `npm start -- game -e 3 -p nim`
  Runs one single game where the prompt says all players must be honest.
  This validates that instruction-violation logging works and that Experiment 3 behaves as expected.

What the flags mean:
- `npm start --`
  Runs the compiled CLI entrypoint in `dist/index.js`.
- `game`
  Chooses the single-game command instead of tournament, analysis, or compare.
- `-e <id>`
  Chooses the experiment prompt framing.
- `-p nim`
  Forces the run to use NVIDIA NIM instead of auto-detecting another provider from your env.

What you are checking:
- each game completes
- the logs include provider/prompt metadata
- experiment 2 still allows lying
- experiment 3 records violations if the model lies
- there are no repeated parse failures or obviously broken turns

What "complete" looks like:
- the terminal returns to your shell prompt
- the CLI prints `Single game complete!`
- it prints a summary containing `Turns`, `Duration`, `Seed`, and `Winner`
- it prints a summary containing `Turns`, `Duration`, `Seed`, `Max Turns`, and `Winner`
- it prints `Game log saved to: ...`

How long it usually takes:
- with the current heavyweight NIM roster, a single validation game can easily take 15-45 minutes
- if one model retries or regularly uses most of the 180-second timeout window, it can take longer

If anything looks wrong here, do not start the tournament yet.

## Step 6: Optional UI Review

If you want to inspect behavior visually:

```bash
npm run server
```

Then open `http://localhost:3001`.

Use this to inspect:
- whether turns make sense
- whether challenge behavior looks plausible
- whether the reasoning traces look coherent

## Step 7: Freeze the Pilot Dataset Settings

Before the main run, commit to these settings:
- provider: `nim`
- current default 6-model roster
- experiments: `0, 1, 2, 3`
- games per matchup: `10`

Do not change these once the pilot run starts.

## Step 8: Collect the Pilot Dataset

Run these commands:

```bash
npm start -- tournament -e 0 -g 10
npm start -- tournament -e 1 -g 10
npm start -- tournament -e 2 -g 10
npm start -- tournament -e 3 -g 10
```

This produces:
- 150 games per experiment
- 600 games total

If you want to parallelize one experiment safely across multiple terminals, shard by matchup index:

```bash
npm run run:logged -- tournament -e 1 -g 10 --matchup-start 0 --matchup-end 4
npm run run:logged -- tournament -e 1 -g 10 --matchup-start 5 --matchup-end 9
npm run run:logged -- tournament -e 1 -g 10 --matchup-start 10 --matchup-end 14
```

Rules for sharding:
- shard bounds are inclusive
- each shard writes a separate checkpoint file
- it is safe to run different shards of the same experiment in parallel
- do not run the same experiment twice without shard bounds against the same output directory
- shard progress is counted by successful completed games, not raw attempts
- interrupted long games can resume from `logs/active/` snapshots when you restart the same shard command

During the run, check progress with:

```bash
npm start -- status
```

If a run fails midway, inspect the last logs before restarting.

## Step 9: Generate the Analysis Outputs

Run:

```bash
npm run research:brief
```

This will produce:
- `logs/csv/player_game_stats.csv`
- `logs/csv/game_summary.csv`
- `logs/csv/all_turns.csv`
- `results/figures/*.png`
- `results/research_summary.md`

What success looks like:
- the report contains the right provider and prompt metadata
- the report does not warn that the dataset is legacy or incomplete
- figures are generated for the experiments you ran

## Step 10: Read the Report Before Writing Anything Public

Open:
- `results/research_summary.md`
- `PAPER_DRAFT.md`

Use the report to answer:
- who won most in Experiment 1
- who lied most in Experiment 1
- who reduced lying most in Experiment 2
- who violated honesty instructions most in Experiment 3

If the report still says the dataset is incomplete or legacy, do not use it for resume or paper claims.

## Step 11: Turn It Into a Hiring Project

Your resume bullets should focus on:
- the system you built
- the scale of the experiments you actually ran
- the strongest empirical finding

Good bullet shape:
- built X
- ran Y games across Z models
- found A under condition B

## Step 12: Turn It Into a Paper Fast

Use this order:
1. Fill `PAPER_DRAFT.md` methods from the actual run settings
2. Fill results from `results/research_summary.md`
3. Add the generated figures
4. Write the abstract last
5. Publish a polished repo and preprint first

## Common Mistakes

- analyzing leftover logs from an old run
- changing the provider or roster mid-dataset
- using validation games as main results
- claiming conclusions from tiny or incomplete datasets
- writing the paper before checking the generated report
