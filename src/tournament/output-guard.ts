import * as fs from 'fs';
import * as path from 'path';
import { RunMetadata } from '../types/game.js';

export interface OutputCohortGuardOptions {
  allowMixedOutput?: boolean;
}

export function assertOutputCohortCompatible(
  outputDir: string,
  runMetadata: RunMetadata,
  options: OutputCohortGuardOptions = {}
): void {
  if (options.allowMixedOutput) {
    return;
  }

  const gamesDir = path.join(outputDir, 'games');
  if (!fs.existsSync(gamesDir)) {
    return;
  }

  const files = fs.readdirSync(gamesDir).filter((file) => file.endsWith('.json'));
  const incompatible = files.filter((file) => {
    const metadata = readGameLogMetadata(path.join(gamesDir, file));
    return (
      metadata?.logSchemaVersion !== runMetadata.logSchemaVersion ||
      metadata?.provider !== runMetadata.provider ||
      metadata?.promptVersion !== runMetadata.promptVersion ||
      metadata?.promptHash !== runMetadata.promptHash ||
      metadata?.contextBudgetTokens !== runMetadata.contextBudgetTokens ||
      metadata?.playMaxTokens !== runMetadata.playMaxTokens ||
      metadata?.challengeMaxTokens !== runMetadata.challengeMaxTokens
    );
  });

  if (incompatible.length === 0) {
    return;
  }

  throw new Error(
    `Output directory "${outputDir}" already contains ${incompatible.length} game log(s) from a different ` +
    'schema/provider/prompt/context-budget/token-cap cohort. Use a fresh output directory such as logs-v3-smoke or logs-v3, ' +
    'or pass --allow-mixed-output if you intentionally want to mix cohorts.'
  );
}

function readGameLogMetadata(filepath: string): RunMetadata | undefined {
  const fd = fs.openSync(filepath, 'r');
  try {
    let text = '';
    const buffer = Buffer.allocUnsafe(64 * 1024);

    while (text.length < 1024 * 1024) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }

      text += buffer.toString('utf8', 0, bytesRead);
      const metadata = extractMetadataFromPrefix(text);
      if (metadata) {
        return metadata;
      }

      if (text.includes('"turns"')) {
        break;
      }
    }

    return undefined;
  } finally {
    fs.closeSync(fd);
  }
}

function extractMetadataFromPrefix(text: string): RunMetadata | undefined {
  const keyIndex = text.indexOf('"metadata"');
  if (keyIndex < 0) {
    return undefined;
  }

  const colonIndex = text.indexOf(':', keyIndex);
  if (colonIndex < 0) {
    return undefined;
  }

  const objectStart = text.indexOf('{', colonIndex);
  if (objectStart < 0) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(objectStart, index + 1)) as RunMetadata;
      }
    }
  }

  return undefined;
}
