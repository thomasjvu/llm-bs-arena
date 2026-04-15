import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { BASELINE_MODELS, EXPERIMENT_NAMES, MODELS, RANKS } from '../types/game.js';
import { buildCohortManifest, GameLogger } from '../logging/game-logger.js';
import { BENCHMARK_NAME, BENCHMARK_VERSION, DATASET_VERSION, DEFAULT_RELEASE_DIR } from './version.js';

export interface ReleaseFileEntry {
  path: string;
  kind: 'raw-logs-archive' | 'frozen-artifact' | 'figure' | 'metadata';
  bytes: number;
  sha256: string;
}

export interface DatasetManifest {
  benchmarkName: string;
  benchmarkVersion: string;
  datasetVersion: string;
  generatedAt: string;
  totalGamesFound: number;
  includedGames: number;
  playerGameRows: number;
  countsByExperiment: Record<number, {
    included: number;
    excludedMixedCohort: number;
    excludedTurnCap: number;
  }>;
  comparableCohort: ReturnType<typeof buildCohortManifest>['comparableCohort'];
  rawLogArchive: ReleaseFileEntry;
  frozenArtifacts: ReleaseFileEntry[];
  trackedFigures: ReleaseFileEntry[];
}

export interface EvaluationManifest {
  benchmarkName: string;
  benchmarkVersion: string;
  datasetVersion: string;
  generatedAt: string;
  promptVersion: string;
  promptHash: string;
  schemaVersion: number;
  providerCohort: string;
  primaryHostedRoster: string[];
  baselinePolicyIds: string[];
  experiments: Array<{
    id: number;
    name: string;
    framing: string;
    interpretation: string;
  }>;
  environment: {
    players: number;
    deck: string;
    startRule: string;
    rankCycle: string[];
    playCount: { min: number; max: number };
    challengeOrder: 'sequential';
    uncappedDefault: true;
  };
  primaryMetrics: string[];
  validityRules: {
    included: string[];
    excluded: string[];
  };
  includedGames: string[];
  excludedGamesByReason: ReturnType<typeof buildCohortManifest>['excludedGamesByReason'];
  countsByExperiment: ReturnType<typeof buildCohortManifest>['countsByExperiment'];
}

export interface BenchmarkReleaseManifest {
  benchmarkName: string;
  benchmarkVersion: string;
  datasetVersion: string;
  generatedAt: string;
  releaseDate: string;
  libraryEntryPoint: string;
  apiStyle: string;
  officialReleaseNotes: string;
  datasetManifest: string;
  evaluationManifest: string;
  checksums: string;
  rawLogArchive: ReleaseFileEntry;
  comparableCohort: ReturnType<typeof buildCohortManifest>['comparableCohort'];
  primaryHostedRoster: string[];
  baselinePolicyIds: string[];
  frozenSummaryArtifacts: string[];
  trackedFigures: string[];
}

export interface BuildBenchmarkReleaseOptions {
  repoRoot?: string;
  logsDir?: string;
  releaseDir?: string;
  includeMixed?: boolean;
  archiveName?: string;
  benchmarkVersion?: string;
  datasetVersion?: string;
  frozenArtifacts?: string[];
  trackedFigures?: string[];
}

export const DEFAULT_FROZEN_ARTIFACTS = [
  'paper/tmlr/artifacts/frozen/cohort_manifest.json',
  'paper/tmlr/artifacts/frozen/player_game_stats.csv',
  'paper/tmlr/artifacts/frozen/player_stats_exp0.csv',
  'paper/tmlr/artifacts/frozen/player_stats_exp1.csv',
  'paper/tmlr/artifacts/frozen/player_stats_exp2.csv',
  'paper/tmlr/artifacts/frozen/player_stats_exp3.csv',
  'paper/tmlr/artifacts/frozen/research_summary.md',
] as const;

export const DEFAULT_TRACKED_FIGURES = [
  'paper/tmlr/figures/benchmark_overview.png',
  'paper/tmlr/figures/compare_lie_frequency.png',
  'paper/tmlr/figures/exp1_win_rates.png',
  'paper/tmlr/figures/exp3_violations.png',
  'paper/tmlr/figures/game_length_distribution.png',
  'paper/tmlr/figures/lie_frequency_heatmap.png',
] as const;

function normalizeRelativePath(repoRoot: string, absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function sha256File(filepath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filepath));
  return hash.digest('hex');
}

function buildFileEntry(repoRoot: string, filepath: string, kind: ReleaseFileEntry['kind']): ReleaseFileEntry {
  const stats = fs.statSync(filepath);
  return {
    path: normalizeRelativePath(repoRoot, filepath),
    kind,
    bytes: stats.size,
    sha256: sha256File(filepath),
  };
}

function assertFileExists(filepath: string): void {
  if (!fs.existsSync(filepath)) {
    throw new Error(`Required release artifact is missing: ${filepath}`);
  }
}

function buildReleaseNotes(
  datasetManifest: DatasetManifest,
  evaluationManifest: EvaluationManifest,
  benchmarkRelease: Omit<BenchmarkReleaseManifest, 'generatedAt' | 'releaseDate'>
): string {
  return `# ${benchmarkRelease.benchmarkName} v${benchmarkRelease.benchmarkVersion}

## Summary

- Benchmark version: \`${benchmarkRelease.benchmarkVersion}\`
- Dataset version: \`${benchmarkRelease.datasetVersion}\`
- Comparable cohort: \`${datasetManifest.includedGames}\` winner-terminated games
- Player-game rows: \`${datasetManifest.playerGameRows}\`
- Primary provider cohort: \`${evaluationManifest.providerCohort}\`
- Prompt version/hash: \`${evaluationManifest.promptVersion}/${evaluationManifest.promptHash}\`

## Release Contents

- Raw game archive: \`${benchmarkRelease.rawLogArchive.path}\`
- Frozen summary artifacts:
${benchmarkRelease.frozenSummaryArtifacts.map((artifact) => `  - \`${artifact}\``).join('\n')}
- Tracked figures:
${benchmarkRelease.trackedFigures.map((figure) => `  - \`${figure}\``).join('\n')}

## Official Rules

- Four-player Bullshit with a standard 52-card deck
- Required rank cycle: \`${RANKS.join(' -> ')}\`
- Public count must match the number of face-down cards
- Sequential challenge order
- Uncapped play until natural winner for benchmark-valid runs

## Inclusion Rules

- Same dominant comparable cohort across provider, prompt version/hash, and schema version
- Winner-terminated games only
- No turn-cap games in the main dataset
- Baseline policy IDs are shipped for side comparisons, but are not part of the primary hosted-model cohort
`;
}

export function buildBenchmarkRelease(
  options: BuildBenchmarkReleaseOptions = {}
): BenchmarkReleaseManifest {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const logsDir = path.resolve(repoRoot, options.logsDir ?? 'logs');
  const gamesDir = path.join(logsDir, 'games');
  const releaseDir = path.resolve(repoRoot, options.releaseDir ?? DEFAULT_RELEASE_DIR);
  const assetsDir = path.join(releaseDir, 'assets');
  const benchmarkVersion = options.benchmarkVersion ?? BENCHMARK_VERSION;
  const datasetVersion = options.datasetVersion ?? DATASET_VERSION;
  const frozenArtifacts = (options.frozenArtifacts ?? [...DEFAULT_FROZEN_ARTIFACTS]).map((entry) =>
    path.resolve(repoRoot, entry)
  );
  const trackedFigures = (options.trackedFigures ?? [...DEFAULT_TRACKED_FIGURES]).map((entry) =>
    path.resolve(repoRoot, entry)
  );
  const archiveName = options.archiveName ?? `${BENCHMARK_NAME.toLowerCase()}-v${benchmarkVersion}-raw-games.tar.gz`;

  const logger = new GameLogger(gamesDir);
  const logs = logger.loadAllLogs();
  const cohortManifest = buildCohortManifest(logs, { includeMixed: options.includeMixed });

  if (cohortManifest.includedGames.length === 0) {
    throw new Error('No included games were found for the benchmark release');
  }

  for (const filepath of [...frozenArtifacts, ...trackedFigures]) {
    assertFileExists(filepath);
  }

  fs.mkdirSync(assetsDir, { recursive: true });

  const archivePath = path.join(assetsDir, archiveName);
  const archiveMembers = [...cohortManifest.includedGames].sort().map((gameId) => `${gameId}.json`);

  try {
    execFileSync('tar', ['-czf', archivePath, '-C', gamesDir, ...archiveMembers], {
      stdio: 'ignore',
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('The "tar" command is required to build the raw-log archive');
    }
    throw error;
  }

  const rawLogArchive = buildFileEntry(repoRoot, archivePath, 'raw-logs-archive');
  const frozenArtifactEntries = frozenArtifacts.map((filepath) => buildFileEntry(repoRoot, filepath, 'frozen-artifact'));
  const trackedFigureEntries = trackedFigures.map((filepath) => buildFileEntry(repoRoot, filepath, 'figure'));

  const comparableCohort = cohortManifest.comparableCohort;
  if (!comparableCohort) {
    throw new Error('Comparable cohort metadata is missing from the cohort manifest');
  }

  const datasetManifest: DatasetManifest = {
    benchmarkName: BENCHMARK_NAME,
    benchmarkVersion,
    datasetVersion,
    generatedAt: new Date().toISOString(),
    totalGamesFound: cohortManifest.totalGamesFound,
    includedGames: cohortManifest.includedGames.length,
    playerGameRows: cohortManifest.includedGames.length * 4,
    countsByExperiment: cohortManifest.countsByExperiment,
    comparableCohort,
    rawLogArchive,
    frozenArtifacts: frozenArtifactEntries,
    trackedFigures: trackedFigureEntries,
  };

  const evaluationManifest: EvaluationManifest = {
    benchmarkName: BENCHMARK_NAME,
    benchmarkVersion,
    datasetVersion,
    generatedAt: new Date().toISOString(),
    promptVersion: comparableCohort.promptVersion,
    promptHash: comparableCohort.promptHash,
    schemaVersion: comparableCohort.schemaVersion,
    providerCohort: comparableCohort.provider,
    primaryHostedRoster: [...MODELS],
    baselinePolicyIds: [...BASELINE_MODELS],
    experiments: [
      {
        id: 0,
        name: EXPERIMENT_NAMES[0],
        framing: 'low-strategy reference',
        interpretation: 'prompt-level comparison condition, not a true random baseline',
      },
      {
        id: 1,
        name: EXPERIMENT_NAMES[1],
        framing: 'deception allowed and expected',
        interpretation: 'main deception-capability condition',
      },
      {
        id: 2,
        name: EXPERIMENT_NAMES[2],
        framing: 'focal model may lie while opponents are honesty-constrained',
        interpretation: 'mixed, model-specific restraint probe',
      },
      {
        id: 3,
        name: EXPERIMENT_NAMES[3],
        framing: 'plain-language honesty mandate',
        interpretation: 'instruction-compliance probe rather than a maximal anti-lying intervention',
      },
    ],
    environment: {
      players: 4,
      deck: 'standard-52-card',
      startRule: 'player holding the Ace of Spades starts',
      rankCycle: [...RANKS],
      playCount: { min: 1, max: 4 },
      challengeOrder: 'sequential',
      uncappedDefault: true,
    },
    primaryMetrics: [
      'win_rate',
      'lie_frequency',
      'lie_success_rate',
      'challenge_frequency',
      'challenge_accuracy',
      'instruction_violation_rate_exp3',
    ],
    validityRules: {
      included: [
        'provider/prompt/schema metadata present',
        'game belongs to the dominant comparable cohort',
        'game ends with terminationReason = winner',
      ],
      excluded: [
        'mixed cohort logs outside the official comparable cohort',
        'turn-cap runs',
        'legacy pre-fix logs',
      ],
    },
    includedGames: [...cohortManifest.includedGames],
    excludedGamesByReason: cohortManifest.excludedGamesByReason,
    countsByExperiment: cohortManifest.countsByExperiment,
  };

  const releaseNotesPath = path.join(releaseDir, 'RELEASE_NOTES.md');
  const datasetManifestPath = path.join(releaseDir, 'dataset-manifest.json');
  const evaluationManifestPath = path.join(releaseDir, 'evaluation-manifest.json');
  const checksumsPath = path.join(releaseDir, 'checksums.sha256');
  const benchmarkReleasePath = path.join(releaseDir, 'benchmark-release.json');

  const benchmarkReleaseBase = {
    benchmarkName: BENCHMARK_NAME,
    benchmarkVersion,
    datasetVersion,
    libraryEntryPoint: 'dist/lib.js',
    apiStyle: 'phase-based multi-agent environment API with strict reset/step semantics',
    officialReleaseNotes: normalizeRelativePath(repoRoot, releaseNotesPath),
    datasetManifest: normalizeRelativePath(repoRoot, datasetManifestPath),
    evaluationManifest: normalizeRelativePath(repoRoot, evaluationManifestPath),
    checksums: normalizeRelativePath(repoRoot, checksumsPath),
    rawLogArchive,
    comparableCohort,
    primaryHostedRoster: [...MODELS],
    baselinePolicyIds: [...BASELINE_MODELS],
    frozenSummaryArtifacts: frozenArtifactEntries.map((entry) => entry.path),
    trackedFigures: trackedFigureEntries.map((entry) => entry.path),
  } satisfies Omit<BenchmarkReleaseManifest, 'generatedAt' | 'releaseDate'>;

  fs.writeFileSync(datasetManifestPath, JSON.stringify(datasetManifest, null, 2));
  fs.writeFileSync(evaluationManifestPath, JSON.stringify(evaluationManifest, null, 2));
  fs.writeFileSync(releaseNotesPath, buildReleaseNotes(datasetManifest, evaluationManifest, benchmarkReleaseBase));

  const checksumEntries = [
    rawLogArchive,
    ...frozenArtifactEntries,
    ...trackedFigureEntries,
    buildFileEntry(repoRoot, datasetManifestPath, 'metadata'),
    buildFileEntry(repoRoot, evaluationManifestPath, 'metadata'),
    buildFileEntry(repoRoot, releaseNotesPath, 'metadata'),
  ];

  fs.writeFileSync(
    checksumsPath,
    checksumEntries
      .map((entry) => `${entry.sha256}  ${entry.path}`)
      .join('\n') + '\n'
  );

  const benchmarkRelease: BenchmarkReleaseManifest = {
    ...benchmarkReleaseBase,
    generatedAt: new Date().toISOString(),
    releaseDate: new Date().toISOString().slice(0, 10),
  };

  fs.writeFileSync(benchmarkReleasePath, JSON.stringify(benchmarkRelease, null, 2));

  return benchmarkRelease;
}
