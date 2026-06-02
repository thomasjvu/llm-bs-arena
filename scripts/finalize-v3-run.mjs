import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const options = {
    output: 'logs-v3',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '-o' || arg === '--output') {
      options.output = argv[++i];
    } else {
      options.output = arg;
    }
  }

  return options;
}

function usage() {
  return `Usage:
  npm run v3:finalize
  npm run v3:finalize -- logs-v3
  npm run v3:finalize -- --output logs-v3`;
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

  const latestSrcMtime = latestSourceMtimeMs(path.join(process.cwd(), 'src'));
  if (fs.statSync(distIndex).mtimeMs < latestSrcMtime) {
    return null;
  }

  return {
    command: process.execPath,
    prefixArgs: [distIndex],
  };
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
    throw new Error('No runnable CLI found. Install dependencies or run npm run build before finalizing v3 results.');
  }

  throw new Error('dist/index.js is stale for the current source tree. Run npm run build, then rerun this command.');
}

function run(cliCommand, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cliCommand.command, [...cliCommand.prefixArgs, ...commandArgs], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`command terminated by signal ${signal}`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`command exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const cliCommand = resolveCliCommand();

  await run(cliCommand, ['analyze', '-o', options.output, '--csv']);
  await run(cliCommand, ['audit-v3', '-o', options.output, '--require-csv']);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
