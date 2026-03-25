#!/usr/bin/env node

import { Command } from 'commander';
import { TournamentRunner } from './tournament/tournament-runner.js';
import { createTournamentConfig, generateMatchups, combinations } from './tournament/matchup-generator.js';
import { FeatherlessLLMAdapter, ChutesLLMAdapter, MockLLMAdapter } from './llm/llm-adapter.js';
import { createFeatherlessClient } from './llm/featherless-api.js';
import { createChutesClient } from './llm/chutes-api.js';
import { GameLogger, formatGameSummary } from './logging/game-logger.js';
import { CSVExporter } from './logging/csv-exporter.js';
import { calculateAllStats, generateSummaryReport } from './metrics/player-stats.js';
import { MODELS, ExperimentId } from './types/game.js';
import { createGameState } from './engine/game-state.js';
import { TurnManager } from './engine/turn-manager.js';

const program = new Command();

program
  .name('llm-bullshit')
  .description('LLM Bullshit Research Framework')
  .version('1.0.0');

type Provider = 'chutes' | 'featherless' | 'mock';

function createAdapter(provider: Provider = 'chutes') {
  switch (provider) {
    case 'mock':
      console.log('Using mock LLM adapter');
      return new MockLLMAdapter();
    case 'chutes':
      if (!process.env.CHUTES_API_TOKEN) {
        throw new Error('CHUTES_API_TOKEN environment variable is required for chutes provider');
      }
      console.log('Using Chutes API provider');
      return new ChutesLLMAdapter(createChutesClient());
    case 'featherless':
      if (!process.env.FEATHERLESS_API_KEY) {
        throw new Error('FEATHERLESS_API_KEY environment variable is required for featherless provider');
      }
      console.log('Using Featherless API provider');
      return new FeatherlessLLMAdapter(createFeatherlessClient());
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function detectProvider(): Provider {
  if (process.env.LLM_PROVIDER === 'mock') return 'mock';
  if (process.env.LLM_PROVIDER === 'featherless' && process.env.FEATHERLESS_API_KEY) return 'featherless';
  if (process.env.LLM_PROVIDER === 'chutes' && process.env.CHUTES_API_TOKEN) return 'chutes';
  if (process.env.CHUTES_API_TOKEN && process.env.FEATHERLESS_API_KEY) {
    return 'chutes';
  }
  if (process.env.CHUTES_API_TOKEN) return 'chutes';
  if (process.env.FEATHERLESS_API_KEY) return 'featherless';
  return 'mock';
}

// Run tournament command
program
  .command('tournament')
  .description('Run a tournament experiment')
  .requiredOption('-e, --experiment <number>', 'Experiment ID (0, 1, 2, or 3)', parseInt)
  .option('-g, --games <number>', 'Games per matchup', parseInt, 10)
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .option('-p, --provider <provider>', 'LLM provider: chutes, featherless, or mock')
  .action(async (options) => {
    const experimentId = options.experiment as ExperimentId;
    if (![0, 1, 2, 3].includes(experimentId)) {
      console.error('Experiment ID must be 0, 1, 2, or 3');
      process.exit(1);
    }

    console.log(`Starting Experiment ${experimentId}`);
    console.log(`Games per matchup: ${options.games}`);
    console.log(`Output directory: ${options.output}`);

    const config = createTournamentConfig(experimentId, options.games, options.output);

    const provider = options.provider || detectProvider();
    const adapter = createAdapter(provider as Provider);

    const runner = new TournamentRunner(config, adapter);

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
  .requiredOption('-e, --experiment <number>', 'Experiment ID (0, 1, 2, or 3)', parseInt)
  .option('-m, --models <models...>', 'Model IDs (exactly 4)')
  .option('-p, --provider <provider>', 'LLM provider: chutes, featherless, or mock')
  .option('-v, --verbose', 'Show detailed turn-by-turn output')
  .action(async (options) => {
    const experimentId = options.experiment as ExperimentId;
    if (![0, 1, 2, 3].includes(experimentId)) {
      console.error('Experiment ID must be 0, 1, 2, or 3');
      process.exit(1);
    }

    // Default to first 4 models if not specified
    const models = options.models?.length === 4 ? options.models : MODELS.slice(0, 4);
    console.log(`Running single game with: ${models.join(', ')}`);

    const provider = options.provider || detectProvider();
    const adapter = createAdapter(provider as Provider);

    const gameId = `single_${Date.now()}`;
    const state = createGameState(gameId, experimentId, [...models]);
    const turnManager = new TurnManager({ maxTurns: 100 });

    const finalState = await turnManager.runGame(state, adapter);

    const logger = new GameLogger();
    const log = logger.stateToLog(finalState);
    const filepath = logger.saveGameLog(log);

    console.log(formatGameSummary(log));
    console.log(`\nGame log saved to: ${filepath}`);
  });

// Analyze results command
program
  .command('analyze')
  .description('Analyze tournament results')
  .option('-e, --experiment <number>', 'Experiment ID to analyze (or all)', parseInt)
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .option('--csv', 'Export results to CSV')
  .action(async (options) => {
    const logger = new GameLogger(`${options.output}/games`);
    const games = logger.loadAllLogs(options.experiment);

    if (games.length === 0) {
      console.log('No games found to analyze');
      return;
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

      const stats = calculateAllStats([...MODELS], expGames, expId);
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
      console.log(`Turns exported to: ${turnsPath}`);
      console.log(`Summary exported to: ${summaryPath}`);
    }
  });

// Compare experiments command
program
  .command('compare')
  .description('Compare results between experiments')
  .requiredOption('--exp1 <number>', 'First experiment ID', parseInt)
  .requiredOption('--exp2 <number>', 'Second experiment ID', parseInt)
  .option('-o, --output <dir>', 'Output directory', 'logs')
  .action(async (options) => {
    const logger = new GameLogger(`${options.output}/games`);

    const exp1Games = logger.loadAllLogs(options.exp1);
    const exp2Games = logger.loadAllLogs(options.exp2);

    if (exp1Games.length === 0 || exp2Games.length === 0) {
      console.log('Need games from both experiments to compare');
      return;
    }

    console.log(`Comparing Experiment ${options.exp1} (${exp1Games.length} games) vs Experiment ${options.exp2} (${exp2Games.length} games)`);

    const exp1Stats = calculateAllStats([...MODELS], exp1Games, options.exp1);
    const exp2Stats = calculateAllStats([...MODELS], exp2Games, options.exp2);

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
    console.log('Models in tournament:');
    MODELS.forEach((model, i) => {
      console.log(`  ${i + 1}. ${model}`);
    });
    console.log(`\nTotal: ${MODELS.length} models`);
    console.log(`Total matchups (C(${MODELS.length}, 4)): ${combinations([...MODELS], 4).length}`);
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

program.parse();
