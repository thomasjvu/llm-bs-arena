import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function slugify(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'run';
}

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0) {
  console.error('Usage: npm run run:logged -- <cli-args>');
  console.error('Example: npm run run:logged -- game -e 0 -p nim');
  process.exit(1);
}

const runsDir = path.join(process.cwd(), 'logs', 'runs');
fs.mkdirSync(runsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const label = slugify(cliArgs.join('-'));
const logPath = path.join(runsDir, `${timestamp}__${label}.log`);
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

const command = process.execPath;
const commandArgs = ['--env-file=.env', 'dist/index.js', ...cliArgs];
const headerLines = [
  `Started: ${new Date().toISOString()}`,
  `CWD: ${process.cwd()}`,
  `Command: ${command} ${commandArgs.join(' ')}`,
  '',
];

logStream.write(headerLines.join('\n'));
process.stdout.write(`Writing run transcript to ${logPath}\n\n`);

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  logStream.write(chunk);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  logStream.write(chunk);
});

child.on('close', (code, signal) => {
  const footer = `\nFinished: ${new Date().toISOString()}\nExit code: ${code ?? 'null'}\nSignal: ${signal ?? 'none'}\n`;
  logStream.write(footer);
  logStream.end();

  process.stdout.write(`\nTranscript saved to ${logPath}\n`);

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
