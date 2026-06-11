import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_SHARD_COUNT = 4;
const EXPERIMENTS = [0, 1, 2, 3];

function parseArgs(argv) {
  const options = {};
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--shards') {
      options.shards = Number.parseInt(argv[++i], 10);
    } else if (arg === '--out' || arg === '--output') {
      options.output = argv[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    options.experiments = positional.map((value) => Number.parseInt(value, 10));
  }

  return options;
}

function usage() {
  return `Usage:
  npm run v3:launch-all
  npm run v3:launch-all -- --dry-run
  npm run v3:launch-all -- 0 1 2 3 --shards 4 --out logs-v3

Launches every experiment/shard pair as a detached background process (default: 16).
Each process pins one NVIDIA API key via global slot = experiment * shardCount + shardIndex.
Logs: logs-v3/launcher/exp{e}-shard{s}.log`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const shardCount = Number.isInteger(options.shards) && options.shards > 0
    ? options.shards
    : DEFAULT_SHARD_COUNT;
  const experiments = options.experiments?.length
    ? options.experiments
    : EXPERIMENTS;
  const outputDir = options.output ?? process.env.V3_OUTPUT ?? 'logs-v3';
  const launcherDir = path.join(process.cwd(), outputDir, 'launcher');
  fs.mkdirSync(launcherDir, { recursive: true });

  const launches = [];
  for (const experiment of experiments) {
    for (let shard = 0; shard < shardCount; shard += 1) {
      const globalSlot = experiment * shardCount + shard;
      const logFile = path.join(launcherDir, `exp${experiment}-shard${shard}.log`);
      const npmArgs = [
        'run',
        'v3:shard',
        '--',
        String(experiment),
        String(shard),
        '--shards',
        String(shardCount),
        '--out',
        outputDir,
      ];
      launches.push({ experiment, shard, globalSlot, logFile, npmArgs });
    }
  }

  console.log(`Preparing ${launches.length} parallel v3 shard(s) → ${outputDir}`);
  for (const launch of launches) {
    const command = `npm ${launch.npmArgs.join(' ')}`;
    console.log(`slot ${launch.globalSlot}: exp${launch.experiment} shard${launch.shard} → ${launch.logFile}`);
    if (options.dryRun) {
      console.log(`  ${command}`);
      continue;
    }

    const out = fs.openSync(launch.logFile, 'a');
    const child = spawn('npm', launch.npmArgs, {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: ['ignore', out, out],
    });
    child.unref();
    fs.closeSync(out);
    console.log(`  pid ${child.pid}`);
  }

  if (!options.dryRun) {
    console.log('');
    console.log(`All ${launches.length} shard(s) launched. Tail logs with:`);
    console.log(`  tail -f ${launcherDir}/exp0-shard0.log`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});