import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

function readBundle() {
  const bundlePath = path.resolve('ui/research/data/research-cohort.json');
  return JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
}

describe('research cohort bundle', () => {
  it('uses the frozen 600-game cohort with 150 games per experiment', () => {
    const bundle = readBundle();

    expect(bundle.all.includedCount).toBe(600);
    expect(bundle.experiments['0'].includedCount).toBe(150);
    expect(bundle.experiments['1'].includedCount).toBe(150);
    expect(bundle.experiments['2'].includedCount).toBe(150);
    expect(bundle.experiments['3'].includedCount).toBe(150);
    expect(bundle.compareRows).toHaveLength(24);
  });

  it('computes ALL scope from raw totals rather than averaging percentages', () => {
    const bundle = readBundle();
    const modelId = 'moonshotai/kimi-k2.5';
    const rows = ['0', '1', '2', '3'].map((experimentId) => bundle.experiments[experimentId].stats[modelId]);
    const aggregate = bundle.all.stats[modelId];

    const totals = rows.reduce((sum, row) => ({
      gamesPlayed: sum.gamesPlayed + row.gamesPlayed,
      wins: sum.wins + row.wins,
      totalPlays: sum.totalPlays + row.totalPlays,
      totalLies: sum.totalLies + row.totalLies,
      successfulLies: sum.successfulLies + row.successfulLies,
      challengesMade: sum.challengesMade + row.challengesMade,
      challengeOpportunities: sum.challengeOpportunities + row.challengeOpportunities,
      correctChallenges: sum.correctChallenges + row.correctChallenges,
    }), {
      gamesPlayed: 0,
      wins: 0,
      totalPlays: 0,
      totalLies: 0,
      successfulLies: 0,
      challengesMade: 0,
      challengeOpportunities: 0,
      correctChallenges: 0,
    });

    expect(aggregate.gamesPlayed).toBe(totals.gamesPlayed);
    expect(aggregate.wins).toBe(totals.wins);
    expect(aggregate.totalPlays).toBe(totals.totalPlays);
    expect(aggregate.totalLies).toBe(totals.totalLies);
    expect(aggregate.successfulLies).toBe(totals.successfulLies);
    expect(aggregate.challengesMade).toBe(totals.challengesMade);
    expect(aggregate.challengeOpportunities).toBe(totals.challengeOpportunities);
    expect(aggregate.correctChallenges).toBe(totals.correctChallenges);
    expect(aggregate.winRate).toBeCloseTo(totals.wins / totals.gamesPlayed, 10);
    expect(aggregate.lieFrequency).toBeCloseTo(totals.totalLies / totals.totalPlays, 10);
    expect(aggregate.lieSuccessRate).toBeCloseTo(totals.successfulLies / totals.totalLies, 10);
    expect(aggregate.paranoiaFrequency).toBeCloseTo(totals.challengesMade / totals.challengeOpportunities, 10);
    expect(aggregate.challengeAccuracy).toBeCloseTo(totals.correctChallenges / totals.challengesMade, 10);
  });
});
