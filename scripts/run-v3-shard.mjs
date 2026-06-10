import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_GAMES_PER_MATCHUP = 10;
const DEFAULT_MATCHUP_COUNT = 15;
const DEFAULT_SHARD_COUNT = 4;
const DEFAULT_OUTPUT_DIR = 'logs-v3';
const DEFAULT_CONTEXT_BUDGET_TOKENS = '120000';
const DEFAULT_NIM_TIMEOUT_MS = '180000';
const DEFAULT_VENICE_TIMEOUT_MS = '180000';
const DEFAULT_PLAY_MAX_TOKENS = '2048';
const DEFAULT_CHALLENGE_MAX_TOKENS = '4096';
const DEFAULT_MAX_GAME_FAILURES_PER_SLOT = '0';
const DEFAULT_NODE_MAX_OLD_SPACE_SIZE_MB = '8192';

function parseEnvFile(filepath) {
  if (!fs.existsSync(filepath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filepath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function hasVeniceKeys(env) {
  return Boolean(env.VENICE_API_KEYS?.trim() || env.VENICE_API_KEY?.trim());
}

function assertValidExperimentEnvFile(filepath, env, provider) {
  if (!fs.existsSync(filepath) || !path.basename(filepath).startsWith('.env.v3-exp')) return;
  const raw = fs.readFileSync(filepath, 'utf8').trim();
  if (!raw) return;

  if (provider === 'venice') {
    if (!hasVeniceKeys(env)) {
      throw new Error(
        `${path.basename(filepath)} does not define VENICE_API_KEYS or VENICE_API_KEY. ` +
        `Use: VENICE_API_KEYS=acct1:venice-...,acct2:venice-...`
      );
    }
    return;
  }

  if (!env.NVIDIA_API_KEY && !env.NVIDIA_NIM_API_KEY) {
    throw new Error(
      `${path.basename(filepath)} does not define NVIDIA_API_KEY. ` +
      `Use: NVIDIA_API_KEY=nvapi-...`
    );
  }
}

function parseVeniceKeyAliases(keysValue, singleKeyValue) {
  const aliases = [];
  if (keysValue?.trim()) {
    for (const rawEntry of keysValue.split(',')) {
      const entry = rawEntry.trim();
      if (!entry) continue;
      const separatorIndex = entry.indexOf(':');
      if (separatorIndex <= 0) continue;
      aliases.push(entry.slice(0, separatorIndex).trim());
    }
  }
  if (aliases.length === 0 && singleKeyValue?.trim()) {
    aliases.push('default');
  }
  return aliases;
}

function resolveApiKeySource(parsedEnvFiles, mergedEnv, provider) {
  if (provider === 'venice') {
    for (let i = parsedEnvFiles.length - 1; i >= 0; i -= 1) {
      const { filepath, env } = parsedEnvFiles[i];
      if (hasVeniceKeys(env)) {
        return path.basename(filepath);
      }
    }
    if (hasVeniceKeys(process.env)) {
      return 'shell environment';
    }
    return 'none';
  }

  for (let i = parsedEnvFiles.length - 1; i >= 0; i -= 1) {
    const { filepath, env } = parsedEnvFiles[i];
    if (env.NVIDIA_API_KEY || env.NVIDIA_NIM_API_KEY) {
      return path.basename(filepath);
    }
  }
  if (process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY) {
    return 'shell environment';
  }
  if (mergedEnv.NVIDIA_NIM_BASE_URL) {
    return 'NVIDIA_NIM_BASE_URL without API key';
  }
  return 'none';
}

function parseArgs(argv) {
  const options = {
    envFiles: [],
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--shards') {
      options.shards = Number.parseInt(argv[++i], 10);
    } else if (arg === '--games') {
      options.games = Number.parseInt(argv[++i], 10);
    } else if (arg === '--out' || arg === '--output') {
      options.output = argv[++i];
    } else if (arg === '--env') {
      options.envFiles.push(argv[++i]);
    } else if (arg === '--max-turns') {
      options.maxTurns = argv[++i];
    } else if (arg === '--provider') {
      options.provider = argv[++i];
    } else {
      positional.push(arg);
    }
  }

  if (positional.length >= 2) {
    options.experiment = Number.parseInt(positional[0], 10);
    options.shard = Number.parseInt(positional[1], 10);
  } else if (positional.length === 1) {
    options.experiment = Number.parseInt(process.env.V3_EXPERIMENT ?? '', 10);
    options.shard = Number.parseInt(positional[0], 10);
  } else {
    options.experiment = Number.parseInt(process.env.V3_EXPERIMENT ?? '', 10);
    options.shard = Number.parseInt(process.env.V3_SHARD ?? '', 10);
  }

  return options;
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got ${value}`);
  }
}

function assertNonnegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative integer, got ${value}`);
  }
}

function positiveIntegerOrDefault(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function resolveShardRange(totalSlots, shardIndex, shardCount) {
  const baseSize = Math.floor(totalSlots / shardCount);
  const remainder = totalSlots % shardCount;
  const start = shardIndex * baseSize + Math.min(shardIndex, remainder);
  const size = baseSize + (shardIndex < remainder ? 1 : 0);
  return {
    start,
    end: start + size - 1,
    size,
  };
}

function formatFailureLimit(value) {
  return value === '0' ? 'unlimited' : value;
}

function withDefaultNodeHeapOptions(existingOptions, maxOldSpaceSizeMb) {
  if (/\b--max-old-space-size(?:=|\s+)/.test(existingOptions || '')) {
    return existingOptions;
  }

  return [existingOptions, `--max-old-space-size=${maxOldSpaceSizeMb}`]
    .filter(Boolean)
    .join(' ');
}

function latestSourceMtimeMs(dir) {
  let latest = 0;
  if (!fs.existsSync(dir)) return latest;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestSourceMtimeMs(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      latest = Math.max(latest, fs.statSync(fullPath).mtimeMs);
    }
  }
  return latest;
}

function freshDistCommand() {
  const distIndex = path.join(process.cwd(), 'dist', 'index.js');
  if (!fs.existsSync(distIndex)) return null;

  const distText = fs.readFileSync(distIndex, 'utf8');
  if (!distText.includes('--game-start') || !distText.includes('--game-end')) {
    return null;
  }

  const latestSrcMtime = latestSourceMtimeMs(path.join(process.cwd(), 'src'));
  if (fs.statSync(distIndex).mtimeMs < latestSrcMtime) {
    return null;
  }

  return {
    command: process.execPath,
    prefixArgs: [distIndex],
  };
}

function usage() {
  return `Usage:
  npm run v3:shard -- <experiment> <shard-index> [--shards 4] [--games 10] [--out logs-v3] [--provider nim|mock|venice]
  V3_EXPERIMENT=0 npm run v3:shard -- <shard-index>

Examples:
  npm run v3:shard -- 0 0
  npm run v3:shard -- 2 3 --shards 4 --out logs-v3
  npm run v3:shard -- 0 0 --games 1 --shards 15 --provider mock --out /private/tmp/llm-bullshit-v3-smoke
  V3_OUTPUT=logs-v3-venice-4096 npm run v3:shard -- 0 0 --provider venice

Optional per-experiment env file:
  .env.v3-exp0.local
  .env.v3-exp1.local
  .env.v3-exp2.local
  .env.v3-exp3.local`;
}

function resolveCliCommand() {
  const distCommand = freshDistCommand();
  if (distCommand) {
    return distCommand;
  }

  const tsxBin = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
  );
  if (fs.existsSync(tsxBin)) {
    return {
      command: tsxBin,
      prefixArgs: ['src/index.ts'],
    };
  }

  const distIndex = path.join(process.cwd(), 'dist', 'index.js');
  if (!fs.existsSync(distIndex)) {
    throw new Error('No runnable CLI found. Install dependencies or run npm run build before launching v3 shards.');
  }
  throw new Error('dist/index.js is stale for the current source tree. Run npm run build, then rerun this command.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const experiment = options.experiment;
  const shardIndex = options.shard;
  const shardCount = positiveIntegerOrDefault(
    options.shards ?? Number.parseInt(process.env.V3_SHARDS ?? '', 10),
    DEFAULT_SHARD_COUNT
  );
  const gamesPerMatchup = positiveIntegerOrDefault(
    options.games ?? Number.parseInt(process.env.V3_GAMES ?? '', 10),
    DEFAULT_GAMES_PER_MATCHUP
  );
  const outputDir = options.output ?? process.env.V3_OUTPUT ?? DEFAULT_OUTPUT_DIR;
  const provider = options.provider ?? process.env.V3_PROVIDER ?? 'nim';
  const maxTurns = options.maxTurns ?? process.env.V3_MAX_TURNS;

  if (![0, 1, 2, 3].includes(experiment)) {
    throw new Error(`experiment must be 0, 1, 2, or 3. Set V3_EXPERIMENT or pass it as the first argument.\n\n${usage()}`);
  }
  assertNonnegativeInteger('shard index', shardIndex);
  assertPositiveInteger('shard count', shardCount);
  assertPositiveInteger('games per matchup', gamesPerMatchup);
  if (shardIndex >= shardCount) {
    throw new Error(`shard index ${shardIndex} must be less than shard count ${shardCount}`);
  }
  if (!['nim', 'mock', 'venice'].includes(provider)) {
    throw new Error(`provider must be "nim", "mock", or "venice", got ${provider}`);
  }

  const cliCommand = resolveCliCommand();

  const totalSlots = DEFAULT_MATCHUP_COUNT * gamesPerMatchup;
  const range = resolveShardRange(totalSlots, shardIndex, shardCount);
  if (range.size <= 0) {
    throw new Error(`shard ${shardIndex}/${shardCount} has no game slots`);
  }

  const envFilePaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), `.env.v3-exp${experiment}.local`),
    ...options.envFiles.map((file) => path.resolve(process.cwd(), file)),
  ];
  const parsedEnvFiles = envFilePaths.map((filepath) => ({
    filepath,
    env: parseEnvFile(filepath),
  }));
  for (const entry of parsedEnvFiles) {
    assertValidExperimentEnvFile(entry.filepath, entry.env, provider);
  }
  const fileEnv = Object.assign({}, ...parsedEnvFiles.map((entry) => entry.env));
  const mergedEnv = {
    ...process.env,
    ...fileEnv,
  };
  const childEnv = {
    ...mergedEnv,
    NODE_OPTIONS: withDefaultNodeHeapOptions(
      mergedEnv.NODE_OPTIONS,
      mergedEnv.V3_NODE_MAX_OLD_SPACE_SIZE_MB || DEFAULT_NODE_MAX_OLD_SPACE_SIZE_MB
    ),
    LLM_CONTEXT_BUDGET_TOKENS:
      mergedEnv.LLM_CONTEXT_BUDGET_TOKENS ||
      DEFAULT_CONTEXT_BUDGET_TOKENS,
    LLM_PLAY_MAX_TOKENS:
      process.env.LLM_PLAY_MAX_TOKENS ||
      mergedEnv.V3_PLAY_MAX_TOKENS ||
      DEFAULT_PLAY_MAX_TOKENS,
    LLM_CHALLENGE_MAX_TOKENS:
      process.env.LLM_CHALLENGE_MAX_TOKENS ||
      mergedEnv.V3_CHALLENGE_MAX_TOKENS ||
      DEFAULT_CHALLENGE_MAX_TOKENS,
    NVIDIA_NIM_TIMEOUT_MS:
      mergedEnv.NVIDIA_NIM_TIMEOUT_MS ||
      DEFAULT_NIM_TIMEOUT_MS,
    VENICE_TIMEOUT_MS:
      mergedEnv.VENICE_TIMEOUT_MS ||
      DEFAULT_VENICE_TIMEOUT_MS,
    TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT:
      process.env.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT ||
      mergedEnv.V3_MAX_GAME_FAILURES_PER_SLOT ||
      DEFAULT_MAX_GAME_FAILURES_PER_SLOT,
  };

  const cliArgs = [
    ...cliCommand.prefixArgs,
    'tournament',
    '-e', String(experiment),
    '-g', String(gamesPerMatchup),
    '-p', provider,
    '-o', outputDir,
    '--game-start', String(range.start),
    '--game-end', String(range.end),
  ];
  if (maxTurns) {
    cliArgs.push('--max-turns', maxTurns);
  }

  console.log(`v3 experiment ${experiment}, shard ${shardIndex + 1}/${shardCount}`);
  console.log(`global game slots: ${range.start}-${range.end} (${range.size})`);
  console.log(`output: ${outputDir}`);
  console.log(`provider: ${provider}`);
  console.log(`context prompt budget: ${childEnv.LLM_CONTEXT_BUDGET_TOKENS}`);
  console.log(`play completion max tokens: ${childEnv.LLM_PLAY_MAX_TOKENS}`);
  console.log(`challenge completion max tokens: ${childEnv.LLM_CHALLENGE_MAX_TOKENS}`);
  console.log(`node max old space: ${childEnv.NODE_OPTIONS.match(/--max-old-space-size(?:=|\s+)(\d+)/)?.[1] || 'custom'} MB`);
  console.log(`max failed attempts per game slot: ${formatFailureLimit(childEnv.TOURNAMENT_MAX_GAME_FAILURES_PER_SLOT)}`);
  console.log(`env files checked: ${envFilePaths.filter((file) => fs.existsSync(file)).join(', ') || 'none'}`);
  if (provider === 'venice') {
    const veniceAliases = parseVeniceKeyAliases(childEnv.VENICE_API_KEYS, childEnv.VENICE_API_KEY);
    console.log(`Venice API keys loaded: ${veniceAliases.length > 0}`);
    console.log(`Venice API key aliases: ${veniceAliases.join(', ') || 'none'}`);
    console.log(`Venice API key source: ${resolveApiKeySource(parsedEnvFiles, childEnv, provider)}`);
  } else {
    console.log(`NVIDIA API key loaded: ${Boolean(childEnv.NVIDIA_API_KEY || childEnv.NVIDIA_NIM_API_KEY)}`);
    console.log(`NVIDIA API key source: ${resolveApiKeySource(parsedEnvFiles, childEnv, provider)}`);
  }
  console.log('');

  const child = spawn(cliCommand.command, cliArgs, {
    cwd: process.cwd(),
    env: childEnv,
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`v3 shard terminated by signal ${signal}`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`v3 shard exited with code ${code}`));
      }
    });
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
