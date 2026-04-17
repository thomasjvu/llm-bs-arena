import { fetchStats } from './app/api.js';
import { getExperimentMeta } from './app/experiments.js';

const dom = {
  experimentSelect: document.getElementById('experiment-select'),
  experimentTitle: document.getElementById('experiment-title'),
  experimentSummary: document.getElementById('experiment-summary'),
  experimentFraming: document.getElementById('experiment-framing'),
  experimentPurpose: document.getElementById('experiment-purpose'),
  includedGames: document.getElementById('included-games'),
  excludedGames: document.getElementById('excluded-games'),
  cohortMeta: document.getElementById('cohort-meta'),
  countsMeta: document.getElementById('counts-meta'),
  statsStatus: document.getElementById('stats-status'),
  statsEmpty: document.getElementById('stats-empty'),
  statsTableWrap: document.getElementById('stats-table-wrap'),
  statsBody: document.getElementById('stats-body'),
};

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

function readExperimentId() {
  const params = new URLSearchParams(window.location.search);
  return ['0', '1', '2', '3'].includes(params.get('experiment') || '') ? params.get('experiment') : '1';
}

function setExperimentMeta(experimentId) {
  const experiment = getExperimentMeta(experimentId);
  dom.experimentSelect.value = experiment.id;
  dom.experimentTitle.textContent = experiment.title;
  dom.experimentSummary.textContent = experiment.detail;
  dom.experimentFraming.textContent = experiment.framing;
  dom.experimentPurpose.textContent = experiment.purpose;
}

function sortRows(statsObj) {
  return Object.values(statsObj || {}).sort((left, right) => {
    if (right.winRate !== left.winRate) return right.winRate - left.winRate;
    if (right.wins !== left.wins) return right.wins - left.wins;
    return right.challengeAccuracy - left.challengeAccuracy;
  });
}

function renderRows(rows) {
  dom.statsBody.innerHTML = rows.map((stat, index) => {
    const theme = window.ModelThemes.getTheme(stat.modelId);
    return `
      <tr>
        <td>#${index + 1}</td>
        <td>
          <div class="stats-model">
            <span class="stats-dot" style="background:${theme.accent};"></span>
            <span class="stats-model-name">
              <span class="stats-model-short">${theme.shortName || stat.modelId}</span>
              <span class="stats-model-id">${stat.modelId}</span>
            </span>
          </div>
        </td>
        <td>${formatPercent(stat.winRate)}</td>
        <td>${stat.wins}/${stat.gamesPlayed}</td>
        <td>${formatPercent(stat.lieFrequency)}</td>
        <td>${formatPercent(stat.lieSuccessRate)}</td>
        <td>${formatPercent(stat.paranoiaFrequency)}</td>
        <td>${formatPercent(stat.challengeAccuracy)}</td>
      </tr>
    `;
  }).join('');
}

function renderMeta(data, experimentId) {
  const completedGames = data.counts?.[experimentId] ?? 0;
  dom.includedGames.textContent = String(completedGames);
  dom.excludedGames.textContent = String(data.excludedGames || 0);

  if (data.cohort) {
    const parts = [
      `schema v${data.cohort.schemaVersion}`,
      data.cohort.provider,
      data.cohort.promptVersion ? `prompt ${data.cohort.promptVersion}` : null,
      data.cohort.promptHash ? data.cohort.promptHash : null,
    ].filter(Boolean);
    dom.cohortMeta.textContent = parts.join(' • ');
  } else {
    dom.cohortMeta.textContent = 'No comparable cohort loaded yet.';
  }

  dom.countsMeta.textContent = `${completedGames} included games in experiment ${experimentId} • ${data.counts?.total ?? 0} total logs available`;
}

async function load() {
  const experimentId = dom.experimentSelect.value;
  const params = new URLSearchParams(window.location.search);
  params.set('experiment', experimentId);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  setExperimentMeta(experimentId);

  dom.statsStatus.textContent = 'Loading comparable cohort…';
  dom.statsEmpty.hidden = true;
  dom.statsTableWrap.hidden = true;

  try {
    const data = await fetchStats(experimentId);
    const rows = sortRows(data.stats);

    renderMeta(data, experimentId);

    if (!rows.length) {
      dom.statsStatus.textContent = 'No completed cohort yet';
      dom.statsEmpty.hidden = false;
      dom.statsEmpty.textContent = 'No comparable completed games were found for this experiment yet.';
      dom.statsTableWrap.hidden = true;
      return;
    }

    renderRows(rows);
    dom.statsStatus.textContent = `${rows.length} cohort models`;
    dom.statsEmpty.hidden = true;
    dom.statsTableWrap.hidden = false;
  } catch (error) {
    dom.statsStatus.textContent = 'Stats unavailable';
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = error instanceof Error ? error.message : String(error);
    dom.statsTableWrap.hidden = true;
    dom.cohortMeta.textContent = 'Failed to load cohort metadata.';
    dom.countsMeta.textContent = 'Stats request failed.';
  }
}

dom.experimentSelect.value = readExperimentId();
dom.experimentSelect.addEventListener('change', () => {
  void load();
});

void load();
