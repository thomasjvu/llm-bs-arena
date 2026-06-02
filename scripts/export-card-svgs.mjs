import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const cardsJsPath = path.join(root, 'ui', 'cards.js');
const outputDir = path.join(root, 'ui', 'cards');

const cardsJs = await readFile(cardsJsPath, 'utf8');
const sandbox = {
  window: {},
  document: {
    createElement() {
      return {};
    },
  },
};

vm.createContext(sandbox);
vm.runInContext(cardsJs, sandbox, { filename: cardsJsPath });

const cardSvgs = sandbox.window.CardRenderer?.CARD_SVGS;

if (!cardSvgs || typeof cardSvgs !== 'object') {
  throw new Error(`Could not load generated card SVGs from ${cardsJsPath}`);
}

await mkdir(outputDir, { recursive: true });

const entries = Object.entries(cardSvgs).sort(([left], [right]) => left.localeCompare(right));

for (const [name, svg] of entries) {
  await writeFile(path.join(outputDir, `${name}.svg`), `${svg}\n`);
}

console.log(`Wrote ${entries.length} SVG files to ${path.relative(root, outputDir)}`);
