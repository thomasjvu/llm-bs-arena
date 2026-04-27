import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Frontend modules are browser-targeted plain JS.
import { buildSlotLayout } from '../../ui/app/layout.js';

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
  it('maps Minimax to its own asset folder and gives Nemotron the GLM placeholder set', () => {
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
    expect(themes.getFolder('minimaxai/minimax-m2.5')).toBe('minimax');
    expect(themes.getFolder('nvidia/nemotron-3-super-120b-a12b')).toBe('glm');
    expect(themes.getThumbnail('nvidia/nemotron-3-super-120b-a12b')).toBe('/images/glm/llms_glm_default.png');
    expect(themes.validateRegistry()).toEqual([]);
  });
});
