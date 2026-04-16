import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { describe, expect, it } from 'vitest';
import { buildSlotLayout } from '../../ui/app/layout.js';

describe('frontend slot layout', () => {
  it('pins the challenged player to the active stage and keeps the rest in table order', () => {
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
    expect(layout.slots.active).toBe('player-2');
    expect(layout.slots['sidebar-0']).toBe('player-3');
    expect(layout.slots['sidebar-1']).toBe('player-0');
    expect(layout.slots['sidebar-2']).toBe('player-1');
  });
});

describe('frontend model themes', () => {
  it('maps Minimax to its own asset folder and gives Nemotron a generated fallback', () => {
    const source = fs.readFileSync(path.resolve('ui/model-themes.js'), 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context);
    const themes = context.window.ModelThemes;

    expect(themes.getFolder('minimaxai/minimax-m2.5')).toBe('minimax');
    expect(themes.getFolder('nvidia/nemotron-3-super-120b-a12b')).toBeNull();
    expect(themes.getThumbnail('nvidia/nemotron-3-super-120b-a12b')).toMatch(/^data:image\/svg\+xml/);
    expect(themes.validateRegistry()).toEqual([]);
  });
});
