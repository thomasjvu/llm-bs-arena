import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Frontend modules are browser-targeted plain JS.
import { buildSlotLayout } from '../../ui/app/layout.js';

function readPngDimensions(filepath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filepath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const CANONICAL_CHARACTER_STATES = [
  'default',
  'judged',
  'judging',
  'raising-hand',
  'win',
  'lose',
  'objection_safe',
  'objection_correct',
];

const COHORT_IMAGE_FOLDERS = ['glm', 'gemma', 'nemotron', 'kimi', 'minimax', 'deepseek'];

describe('frontend slot layout', () => {
  it('keeps players in fixed table order while still marking the active speaker', () => {
    const state = {
      phase: 'challenging',
      currentPlayerIndex: 2,
      thinkingPlayerId: 'player-3',
      pendingTurn: { playerId: 'player-2' },
      players: [
        { id: 'player-0' },
        { id: 'player-1' },
        { id: 'player-2' },
        { id: 'player-3' },
      ],
    };

    const layout = buildSlotLayout(state);

    expect(layout.activePlayerId).toBe('player-2');
    expect(layout.slots['cast-0']).toBe('player-0');
    expect(layout.slots['cast-1']).toBe('player-1');
    expect(layout.slots['cast-2']).toBe('player-2');
    expect(layout.slots['cast-3']).toBe('player-3');
  });
});

describe('frontend model themes', () => {
  it('maps Minimax and Nemotron to their own asset folders', () => {
    const source = fs.readFileSync(path.resolve('ui/model-themes.js'), 'utf8');
    const context: {
      window: {
        ModelThemes?: {
          getFolder: (modelId: string) => string;
          getThumbnail: (modelId: string) => string;
          validateRegistry: () => string[];
        };
      };
    } = { window: {} };
    vm.runInNewContext(source, context);
    const themes = context.window.ModelThemes;

    expect(themes).toBeDefined();
    if (!themes) {
      throw new Error('ModelThemes registry did not attach to window');
    }
    expect(themes.getFolder('minimaxai/minimax-m2.7')).toBe('minimax');
    expect(themes.getFolder('google/gemma-4-31b-it')).toBe('gemma');
    expect(themes.getFolder('deepseek-ai/deepseek-v4-flash')).toBe('deepseek');
    expect(themes.getFolder('nvidia/nemotron-3-super-120b-a12b')).toBe('nemotron');
    expect(themes.getThumbnail('nvidia/nemotron-3-super-120b-a12b')).toBe('/images/nemotron/llms_nemotron_default.png');
    expect(themes.validateRegistry()).toEqual([]);
  });

  it('ships complete aligned canonical state image sets for every cohort folder', () => {
    for (const folder of COHORT_IMAGE_FOLDERS) {
      for (const state of CANONICAL_CHARACTER_STATES) {
        const filepath = path.resolve(`ui/images/${folder}/llms_${folder}_${state}.png`);
        expect(fs.existsSync(filepath), `${filepath} should exist`).toBe(true);
        expect(readPngDimensions(filepath)).toEqual({ width: 1024, height: 1024 });
      }
    }
  });
});
