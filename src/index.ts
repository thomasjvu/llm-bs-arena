#!/usr/bin/env node

import * as fs from 'fs';
import { Command, InvalidArgumentError } from 'commander';
import { TournamentRunner } from './tournament/tournament-runner.js';
import { createTournamentConfig, generateMatchups, combinations } from './tournament/matchup-generator.js';
import { createChutesClient } from './llm/chutes-api.js';
import { createNimClient } from './llm/nim-api.js';
import { GameLogger, formatGameSummary, selectComparableGameCohort, buildCohortManifest } from './logging/game-logger.js';
import { CSVExporter } from './logging/csv-exporter.js';
import { calculateAllStats, generateSummaryReport } from './metrics/player-stats.js';
import { MODELS, BASELINE_MODELS, ExperimentId } from './types/game.js';
import { createGameState } from './engine/game-state.js';
import { TurnManager } from './engine/turn-manager.js';
import { buildRunMetadata, createAdapter, detectProvider, Provider } from './llm/provider.js';
import { buildBenchmarkRelease } from './release/build-release.js';
import { BENCHMARK_NAME, BENCHMARK_VERSION, DATASET_VERSION, DEFAULT_RELEASE_DIR } from './release/version.js';

const program = new Command();

program
  .name('llm-bullshit')
  .description('LLM Bullshit Research Framework')
  .version('1.0.0');

function getModelsFromGames(games: { players: { modelId: string }[] }[]): string[] {
  return [...new Set(games.flatMap((game) => game.players.map((player) => player.modelId)))].sort();
}

function parseIntegerOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new InvalidArgumentError(`Expected an integer, got "${value}"`);
  }
  return parsed;
}

function parseMaxTurnsOption(value: string): number | undefined {
  const normalized = value.trim().toLowerCase();
  if (['0', 'none', 'uncapped', 'unlimited'].includes(normalized)) {
    return undefined;
  }

  const parsed = parseIntegerOption(value);
  if (parsed <= 0) {
    throw new InvalidArgumentError(`Expected a positive integer or one of: 0, none, uncapped, unlimited. Got "${value}"`);
  }
  return parsed;
}

function resolveModelSelection(models?: string[], expectedCount?: number): string[] {
  if (!models || models.length === 0) {
    return [...MODELS];
  }

  const uniqueModels = [...new Set(models)];
  if (uniqueModels.length !== models.length) {
    throw new InvalidArgumentError('Model roster must not contain duplicate model IDs');
  }

  if (expectedCount !== undefined && uniqueModels.length !== expectedCount) {
    throw new InvalidArgumentError(`Expected exactly ${expectedCount} model IDs, got ${uniqueModels.length}`);
  }

  if (uniqueModels.length < 4) {
    throw new InvalidArgumentError(`Expected at least 4 model IDs, got ${uniqueModels.length}`);
  }

  return uniqueModels;
}

// Run tournament command
program
  .command('tournament')
  .description('Run a tournament experiment')
  .requiredOption('-e, --experiment <number>', 'Experiment ID (0, 1, 2, or 3)', parseIntegerOption)
  .option('-g, --games <number>', 'Games per matchup', parseIntegerOption, 10)
  .option('-m, --models <models...>', 'Optional custom model roster (4+ model IDs)')
  .option('-t, --max-turns <number>', 'Optional safety cap; omit or pass "none" for uncapped play', parseMaxTurnsOption)
  .option('--matchup-start <number>', 'First matchup index to run (inclusive)', parseIntegerOption)
  .option('--matchup-end <number>', 'Last matchup index to run (inclusive)', parseIntegerOption)
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .option('-p, --provider <provider>', 'LLM provider: nim, chutes, featherless, or mock')
  .action(async (options) => {
    const experimentId = options.experiment as ExperimentId;
    if (![0, 1, 2, 3].includes(experimentId)) {
      console.error('Experiment ID must be 0, 1, 2, or 3');
      process.exit(1);
    }

    const models = resolveModelSelection(options.models);

    console.log(`Starting Experiment ${experimentId}`);
    console.log(`Games per matchup: ${options.games}`);
    console.log(`Max turns per game: ${options.maxTurns ?? 'none'}`);
    console.log(`Models: ${models.join(', ')}`);
    if (options.matchupStart !== undefined || options.matchupEnd !== undefined) {
      console.log(`Matchup shard: ${options.matchupStart ?? 0}-${options.matchupEnd ?? 'end'}`);
    }
    console.log(`Output directory: ${options.output}`);

    const config = createTournamentConfig(
      experimentId,
      options.games,
      options.output,
      options.maxTurns,
      options.matchupStart,
      options.matchupEnd,
      models
    );

    const provider = options.provider || detectProvider();
    const adapter = createAdapter(provider as Provider, config.models);

    const runner = new TournamentRunner(config, adapter, buildRunMetadata(provider as Provider, config.models));

    await runner.run((progress) => {
      process.stdout.write(
        `\rProgress: ${progress.completedGames}/${progress.totalGames} games (${progress.percentComplete.toFixed(1)}%)`
      );
    });

    console.log('\nTournament complete!');
  });

// Run single game command
program
  .command('game')
  .description('Run a single game')
  .requiredOption('-e, --experiment <number>', 'Experiment ID (0, 1, 2, or 3)', parseIntegerOption)
  .option('-m, --models <models...>', 'Model IDs (exactly 4)')
  .option('-p, --provider <provider>', 'LLM provider: nim, chutes, featherless, or mock')
  .option('-s, --seed <number>', 'Deterministic deck/shuffle seed', parseIntegerOption)
  .option('-t, --max-turns <number>', 'Optional safety cap; omit or pass "none" for uncapped play', parseMaxTurnsOption)
  .option('-v, --verbose', 'Show detailed turn-by-turn output')
  .action(async (options) => {
    const experimentId = options.experiment as ExperimentId;
    if (![0, 1, 2, 3].includes(experimentId)) {
      console.error('Experiment ID must be 0, 1, 2, or 3');
      process.exit(1);
    }

    const models = options.models ? resolveModelSelection(options.models, 4) : MODELS.slice(0, 4);
    console.log(`Running single game with: ${models.join(', ')}`);

    const seed = Number.isFinite(options.seed) ? options.seed : Date.now();
    console.log(`Seed: ${seed}`);
    console.log(`Max turns: ${options.maxTurns ?? 'none'}`);

    const provider = options.provider || detectProvider();
    const adapter = createAdapter(provider as Provider, models);

    const gameId = `single_${Date.now()}`;
    const state = createGameState(gameId, experimentId, [...models], seed);
    state.metadata = buildRunMetadata(provider as Provider, models);
    const turnManager = new TurnManager({ maxTurns: options.maxTurns });

    const finalState = await turnManager.runGame(state, adapter);

    const logger = new GameLogger();
    const log = logger.stateToLog(finalState);
    const filepath = logger.saveGameLog(log);

    console.log('\nSingle game complete!');
    console.log(formatGameSummary(log, { verbose: options.verbose }));
    console.log(`\nGame log saved to: ${filepath}`);
  });

// Analyze results command
program
  .command('analyze')
  .description('Analyze tournament results')
  .option('-e, --experiment <number>', 'Experiment ID to analyze (or all)', parseIntegerOption)
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .option('--csv', 'Export results to CSV')
  .option('--include-mixed', 'Analyze all logs instead of auto-filtering to the dominant comparable cohort')
  .action(async (options) => {
    const logger = new GameLogger(`${options.output}/games`);
    const rawGames = logger.loadAllLogs(options.experiment);
    const selection = options.includeMixed ? null : selectComparableGameCohort(rawGames);
    const games = (selection ? selection.games : rawGames).filter((game) => game.terminationReason !== 'turn_cap');
    const excludedTurnCapGames = (selection ? selection.games : rawGames).length - games.length;

    if (games.length === 0) {
      console.log('No games found to analyze');
      return;
    }

    if (selection?.cohort) {
      console.log(
        `Using dominant comparable cohort: schema v${selection.cohort.schemaVersion}, ` +
        `provider=${selection.cohort.provider}, prompt=${selection.cohort.promptVersion}/${selection.cohort.promptHash} ` +
        `(${games.length}/${rawGames.length} games)`
      );
      if (selection.excludedGames > 0) {
        console.log(`Excluded ${selection.excludedGames} mixed or legacy games. Pass --include-mixed to override.`);
      }
    }
    if (excludedTurnCapGames > 0) {
      console.log(`Excluded ${excludedTurnCapGames} turn-cap games from analysis.`);
    }

    console.log(`Analyzing ${games.length} games`);

    const experimentIds = options.experiment ? [options.experiment] : [0, 1, 2, 3];

    for (const expId of experimentIds) {
      const expGames = games.filter((g) => g.experimentId === expId);
      if (expGames.length === 0) continue;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`EXPERIMENT ${expId}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Total games: ${expGames.length}`);

      const stats = calculateAllStats(getModelsFromGames(expGames), expGames, expId);
      console.log(generateSummaryReport(stats));

      if (options.csv) {
        const exporter = new CSVExporter(`${options.output}/csv`);
        const statsPath = exporter.exportPlayerStats(stats, expId);
        console.log(`Stats exported to: ${statsPath}`);
      }
    }

    if (options.csv) {
      const exporter = new CSVExporter(`${options.output}/csv`);
      const turnsPath = exporter.exportTurns(games);
      const summaryPath = exporter.exportGameSummary(games);
      const playerGamePath = exporter.exportPlayerGameStats(games);
      console.log(`Turns exported to: ${turnsPath}`);
      console.log(`Summary exported to: ${summaryPath}`);
      console.log(`Player-game stats exported to: ${playerGamePath}`);
    }
  });

// Compare experiments command
program
  .command('compare')
  .description('Compare results between experiments')
  .requiredOption('--exp1 <number>', 'First experiment ID', parseIntegerOption)
  .requiredOption('--exp2 <number>', 'Second experiment ID', parseIntegerOption)
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .option('--include-mixed', 'Compare all logs instead of auto-filtering to the dominant comparable cohort')
  .action(async (options) => {
    const logger = new GameLogger(`${options.output}/games`);

    const rawExp1Games = logger.loadAllLogs(options.exp1);
    const rawExp2Games = logger.loadAllLogs(options.exp2);
    const rawCombined = [...rawExp1Games, ...rawExp2Games];
    const selection = options.includeMixed ? null : selectComparableGameCohort(rawCombined);
    const exp1Games = (selection ? selection.games.filter((game) => game.experimentId === options.exp1) : rawExp1Games)
      .filter((game) => game.terminationReason !== 'turn_cap');
    const exp2Games = (selection ? selection.games.filter((game) => game.experimentId === options.exp2) : rawExp2Games)
      .filter((game) => game.terminationReason !== 'turn_cap');

    if (exp1Games.length === 0 || exp2Games.length === 0) {
      console.log('Need games from both experiments to compare');
      return;
    }

    if (selection?.cohort) {
      console.log(
        `Using dominant comparable cohort: schema v${selection.cohort.schemaVersion}, ` +
        `provider=${selection.cohort.provider}, prompt=${selection.cohort.promptVersion}/${selection.cohort.promptHash} ` +
        `(${selection.games.length}/${rawCombined.length} games across both experiments)`
      );
      if (selection.excludedGames > 0) {
        console.log(`Excluded ${selection.excludedGames} mixed or legacy games. Pass --include-mixed to override.`);
      }
    }

    console.log(`Comparing Experiment ${options.exp1} (${exp1Games.length} games) vs Experiment ${options.exp2} (${exp2Games.length} games)`);

    const modelIds = getModelsFromGames([...exp1Games, ...exp2Games]);
    const exp1Stats = calculateAllStats(modelIds, exp1Games, options.exp1);
    const exp2Stats = calculateAllStats(modelIds, exp2Games, options.exp2);

    console.log('\nCHANGES FROM EXP1 TO EXP2:');
    console.log('-'.repeat(80));
    console.log('Model'.padEnd(35) + 'Lie Freq Δ'.padEnd(15) + 'Paranoia Δ'.padEnd(15) + 'Win Rate Δ');
    console.log('-'.repeat(80));

    for (const [modelId, s1] of exp1Stats) {
      const s2 = exp2Stats.get(modelId);
      if (!s2) continue;

      const lieDelta = ((s2.lieFrequency - s1.lieFrequency) * 100).toFixed(1);
      const paranoiaDelta = ((s2.paranoiaFrequency - s1.paranoiaFrequency) * 100).toFixed(1);
      const winDelta = ((s2.winRate - s1.winRate) * 100).toFixed(1);

      console.log(
        modelId.padEnd(35) +
          `${lieDelta}%`.padEnd(15) +
          `${paranoiaDelta}%`.padEnd(15) +
          `${winDelta}%`
      );
    }

    const exporter = new CSVExporter(`${options.output}/csv`);
    const path = exporter.exportExperimentComparison(exp1Stats, exp2Stats, `compare_exp${options.exp1}_exp${options.exp2}`);
    console.log(`\nComparison exported to: ${path}`);
  });

// List models command
program
  .command('models')
  .description('List all models in the tournament')
  .action(() => {
    console.log('Default tournament models:');
    MODELS.forEach((model, i) => {
      console.log(`  ${i + 1}. ${model}`);
    });
    console.log(`\nTotal: ${MODELS.length} models`);
    console.log(`Total matchups (C(${MODELS.length}, 4)): ${combinations([...MODELS], 4).length}`);
    console.log('\nOptional local baseline models:');
    BASELINE_MODELS.forEach((model, i) => {
      console.log(`  ${i + 1}. ${model}`);
    });
  });

// List NVIDIA NIM models command
program
  .command('nim-models')
  .description('List available models from NVIDIA NIM')
  .option('--filter <pattern>', 'Filter models by pattern (e.g., "qwen", "gemma")')
  .action(async (options) => {
    if (!process.env.NVIDIA_API_KEY && !process.env.NVIDIA_NIM_API_KEY && !process.env.NVIDIA_NIM_BASE_URL) {
      console.error('NVIDIA_API_KEY or NVIDIA_NIM_BASE_URL environment variable is required');
      process.exit(1);
    }

    try {
      const client = createNimClient();
      console.log('Fetching available models from NVIDIA NIM...\n');
      const models = await client.fetchAvailableModels();

      let filteredModels = models;
      if (options.filter) {
        const pattern = options.filter.toLowerCase();
        filteredModels = models.filter(m => m.id.toLowerCase().includes(pattern));
      }

      console.log(`Found ${filteredModels.length} models${options.filter ? ` matching "${options.filter}"` : ''}:\n`);

      filteredModels.sort((a, b) => a.id.localeCompare(b.id));

      filteredModels.forEach((model, i) => {
        const ctx = model.max_model_len || 'N/A';
        console.log(`  ${i + 1}. ${model.id}`);
        console.log(`     Context: ${ctx}`);
        if (model.owned_by) {
          console.log(`     Owned by: ${model.owned_by}`);
        }
      });
    } catch (error) {
      console.error(`Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// List Chutes models command
program
  .command('chutes-models')
  .description('List all available models from Chutes API')
  .option('--filter <pattern>', 'Filter models by pattern (e.g., "qwen", "gemma")')
  .action(async (options) => {
    if (!process.env.CHUTES_API_TOKEN) {
      console.error('CHUTES_API_TOKEN environment variable is required');
      process.exit(1);
    }

    try {
      const client = createChutesClient();
      console.log('Fetching available models from Chutes API...\n');
      const models = await client.fetchAvailableModels();

      let filteredModels = models;
      if (options.filter) {
        const pattern = options.filter.toLowerCase();
        filteredModels = models.filter(m => m.id.toLowerCase().includes(pattern));
      }

      console.log(`Found ${filteredModels.length} models${options.filter ? ` matching "${options.filter}"` : ''}:\n`);
      
      filteredModels.sort((a, b) => a.id.localeCompare(b.id));

      filteredModels.forEach((model, i) => {
        const ctx = model.context_length || model.max_model_len || 'N/A';
        const out = model.max_output_length || 'N/A';
        const q = model.quantization || 'N/A';
        console.log(`  ${i + 1}. ${model.id}`);
        console.log(`     Context: ${ctx}, Output: ${out}, Quantization: ${q}`);
        console.log(`     Owned by: ${model.owned_by}`);
      });
    } catch (error) {
      console.error(`Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show tournament progress')
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .action(async (options) => {
    const logger = new GameLogger(`${options.output}/games`);
    const counts = logger.getGameCounts();

    const totalMatchups = combinations([...MODELS], 4).length;
    const gamesPerExp = totalMatchups * 10; // Assuming 10 games per matchup

    console.log('Tournament Status:');
    console.log('='.repeat(50));

    for (const exp of [0, 1, 2, 3] as const) {
      const completed = counts[exp] || 0;
      const percent = ((completed / gamesPerExp) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(completed / gamesPerExp * 20)) + '░'.repeat(20 - Math.floor(completed / gamesPerExp * 20));
      const expName = exp === 0 ? 'Control' : `Exp ${exp}`;
      console.log(`${expName}: ${completed}/${gamesPerExp} [${bar}] ${percent}%`);
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const totalExpected = gamesPerExp * 4;
    console.log('-'.repeat(50));
    console.log(`Total: ${total}/${totalExpected} games (${((total / totalExpected) * 100).toFixed(1)}%)`);
  });

program
  .command('manifest')
  .description('Write a cohort manifest for the current logs')
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .option('--include-mixed', 'Build the manifest from all logs instead of the dominant comparable cohort')
  .option('--manifest <path>', 'Manifest output path')
  .action(async (options) => {
    const logger = new GameLogger(`${options.output}/games`);
    const logs = logger.loadAllLogs();
    const manifest = buildCohortManifest(logs, { includeMixed: options.includeMixed });
    const manifestPath = options.manifest || `${options.output}/cohort_manifest.json`;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`Wrote cohort manifest to: ${manifestPath}`);
    console.log(`Included games: ${manifest.includedGames.length}`);
    console.log(`Excluded for mixed cohort: ${manifest.excludedGamesByReason.mixedCohort.length}`);
    console.log(`Excluded for turn cap: ${manifest.excludedGamesByReason.turnCap.length}`);
  });

program
  .command('release')
  .description('Build versioned benchmark release metadata and the official raw-log archive')
  .option('-o, --output <dir>', 'Release output directory', DEFAULT_RELEASE_DIR)
  .option('--logs <dir>', 'Logs directory containing games/ and csv/', 'logs')
  .option('--include-mixed', 'Build the release from all logs instead of the dominant comparable cohort')
  .action(async (options) => {
    const release = buildBenchmarkRelease({
      releaseDir: options.output,
      logsDir: options.logs,
      includeMixed: options.includeMixed,
    });

    console.log(`Built ${BENCHMARK_NAME} v${BENCHMARK_VERSION} / dataset v${DATASET_VERSION}`);
    console.log(`Release manifest: ${release.datasetManifest}`);
    console.log(`Evaluation manifest: ${release.evaluationManifest}`);
    console.log(`Checksums: ${release.checksums}`);
    console.log(`Raw log archive: ${release.rawLogArchive.path}`);
    console.log(`Included games: ${release.rawLogArchive.path ? release.comparableCohort?.size ?? 'n/a' : 'n/a'}`);
  });

program.parse();
