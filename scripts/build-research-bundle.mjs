import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT = path.resolve(SCRIPT_DIR, '..');
const FROZEN_DIR = path.join(ROOT, 'paper/arxiv/artifacts/frozen');
const OUTPUT_PATH = path.join(ROOT, 'ui/research/data/research-cohort.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseCsv(csvText) {
  const [headerLine, ...lines] = csvText.trim().split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

function toNumber(value) {
  if (value == null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRow(experimentId, row) {
  return {
    experimentId,
    modelId: row.model_id,
    gamesPlayed: toNumber(row.games_played),
    wins: toNumber(row.wins),
    winRate: toNumber(row.win_rate),
    totalPlays: toNumber(row.total_plays),
    totalLies: toNumber(row.total_lies),
    lieFrequency: toNumber(row.lie_frequency),
    successfulLies: toNumber(row.successful_lies),
    lieSuccessRate: toNumber(row.lie_success_rate),
    truthfulAvailableTurns: toNumber(row.truthful_available_turns),
    truthfulUnavailableTurns: toNumber(row.truthful_unavailable_turns),
    truthfulAvailableTurnShare: toNumber(row.truthful_available_turn_share),
    truthfulUnavailableTurnShare: toNumber(row.truthful_unavailable_turn_share),
    optionalLies: toNumber(row.optional_lies),
    optionalLieTurnShare: toNumber(row.optional_lie_turn_share),
    optionalLieRateGivenTruthfulAvailable: toNumber(row.optional_lie_rate_given_truthful_available),
    challengesMade: toNumber(row.challenges_made),
    challengeOpportunities: toNumber(row.challenge_opportunities),
    paranoiaFrequency: toNumber(row.paranoia_frequency),
    correctChallenges: toNumber(row.correct_challenges),
    challengeAccuracy: toNumber(row.challenge_accuracy),
    instructionViolations: toNullableNumber(row.instruction_violations),
    instructionViolationRate: toNullableNumber(row.instruction_violation_rate),
  };
}

function deriveRates(totals) {
  const lieFrequency = totals.totalPlays > 0 ? totals.totalLies / totals.totalPlays : 0;
  const lieSuccessRate = totals.totalLies > 0 ? totals.successfulLies / totals.totalLies : 0;
  const truthfulAvailableTurnShare = totals.totalPlays > 0
    ? totals.truthfulAvailableTurns / totals.totalPlays
    : 0;
  const truthfulUnavailableTurnShare = totals.totalPlays > 0
    ? totals.truthfulUnavailableTurns / totals.totalPlays
    : 0;
  const optionalLieTurnShare = totals.totalPlays > 0 ? totals.optionalLies / totals.totalPlays : 0;
  const optionalLieRateGivenTruthfulAvailable = totals.truthfulAvailableTurns > 0
    ? totals.optionalLies / totals.truthfulAvailableTurns
    : 0;
  const paranoiaFrequency = totals.challengeOpportunities > 0
    ? totals.challengesMade / totals.challengeOpportunities
    : 0;
  const challengeAccuracy = totals.challengesMade > 0
    ? totals.correctChallenges / totals.challengesMade
    : 0;
  const instructionViolationRate = totals.totalPlays > 0
    ? totals.instructionViolations / totals.totalPlays
    : null;

  return {
    ...totals,
    winRate: totals.gamesPlayed > 0 ? totals.wins / totals.gamesPlayed : 0,
    lieFrequency,
    lieSuccessRate,
    truthfulAvailableTurnShare,
    truthfulUnavailableTurnShare,
    optionalLieTurnShare,
    optionalLieRateGivenTruthfulAvailable,
    paranoiaFrequency,
    challengeAccuracy,
    instructionViolationRate,
  };
}

function aggregateExperimentRows(rows) {
  return Object.fromEntries(rows.map((row) => [row.modelId, { ...row }]));
}

function aggregateAll(rowsByExperiment) {
  const modelTotals = new Map();

  Object.values(rowsByExperiment).forEach((rows) => {
    rows.forEach((row) => {
      const current = modelTotals.get(row.modelId) || {
        modelId: row.modelId,
        gamesPlayed: 0,
        wins: 0,
        totalPlays: 0,
        totalLies: 0,
        successfulLies: 0,
        truthfulAvailableTurns: 0,
        truthfulUnavailableTurns: 0,
        optionalLies: 0,
        challengesMade: 0,
        challengeOpportunities: 0,
        correctChallenges: 0,
        instructionViolations: 0,
      };

      current.gamesPlayed += row.gamesPlayed;
      current.wins += row.wins;
      current.totalPlays += row.totalPlays;
      current.totalLies += row.totalLies;
      current.successfulLies += row.successfulLies;
      current.truthfulAvailableTurns += row.truthfulAvailableTurns;
      current.truthfulUnavailableTurns += row.truthfulUnavailableTurns;
      current.optionalLies += row.optionalLies;
      current.challengesMade += row.challengesMade;
      current.challengeOpportunities += row.challengeOpportunities;
      current.correctChallenges += row.correctChallenges;
      current.instructionViolations += row.instructionViolations ?? 0;
      modelTotals.set(row.modelId, current);
    });
  });

  return Object.fromEntries(
    [...modelTotals.values()]
      .sort((left, right) => left.modelId.localeCompare(right.modelId))
      .map((totals) => {
        const derived = deriveRates(totals);
        return [totals.modelId, derived];
      })
  );
}

function main() {
  const manifest = readJson(path.join(FROZEN_DIR, 'cohort_manifest.json'));
  const rowsByExperiment = {};
  const compareRows = [];

  for (const experimentId of ['0', '1', '2', '3']) {
    const csvPath = path.join(FROZEN_DIR, `player_stats_exp${experimentId}.csv`);
    const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
      .map((row) => normalizeRow(Number(experimentId), row))
      .sort((left, right) => left.modelId.localeCompare(right.modelId));
    rowsByExperiment[experimentId] = rows;
    compareRows.push(...rows);
  }

  const experiments = Object.fromEntries(
    Object.entries(rowsByExperiment).map(([experimentId, rows]) => {
      const counts = manifest.countsByExperiment[experimentId];
      return [experimentId, {
        includedCount: counts?.included ?? 0,
        excludedGames: (counts?.excludedMixedCohort ?? 0) + (counts?.excludedTurnCap ?? 0),
        stats: aggregateExperimentRows(rows),
      }];
    })
  );

  const allIncluded = Object.values(manifest.countsByExperiment).reduce((sum, counts) => sum + (counts.included ?? 0), 0);
  const allExcluded = Object.values(manifest.countsByExperiment).reduce(
    (sum, counts) => sum + (counts.excludedMixedCohort ?? 0) + (counts.excludedTurnCap ?? 0),
    0
  );

  const bundle = {
    generatedAt: manifest.generatedAt,
    cohort: {
      source: 'frozen-paper-cohort',
      schemaVersion: manifest.comparableCohort.schemaVersion,
      provider: manifest.comparableCohort.provider,
      promptVersion: manifest.comparableCohort.promptVersion,
      promptHash: manifest.comparableCohort.promptHash,
      comparableSize: manifest.comparableCohort.size,
      totalGamesFound: manifest.totalGamesFound,
      modelCount: compareRows.filter((row) => row.experimentId === 0).length,
    },
    countsByExperiment: manifest.countsByExperiment,
    all: {
      includedCount: allIncluded,
      excludedGames: allExcluded,
      stats: aggregateAll(rowsByExperiment),
    },
    experiments,
    compareRows: compareRows.sort((left, right) => {
      if (left.experimentId !== right.experimentId) return left.experimentId - right.experimentId;
      return left.modelId.localeCompare(right.modelId);
    }),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(bundle, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();
