import { fetchResearchStats, fetchResearchCompare } from './app/api.js';
import { getExperimentMeta, getQuotedExperimentSummary } from './app/experiments.js';

const EXPERIMENT_LABELS = {
  0: 'Control',
  1: 'Baseline',
  2: 'Asymmetric',
  3: 'Honesty',
};

const dom = {
  experimentSelect: document.getElementById('experiment-select'),
  experimentId: document.getElementById('experiment-id'),
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
  panelTabs: [...document.querySelectorAll('[data-stats-panel]')],
  chartTabsWrap: document.getElementById('chart-tabs'),
  chartTabs: [...document.querySelectorAll('[data-chart-view]')],
  panels: [...document.querySelectorAll('[data-panel-content]')],
  podium: document.getElementById('stats-podium'),
  snapshotGrid: document.getElementById('stats-snapshot-grid'),
  chartKicker: document.getElementById('chart-kicker'),
  chartTitle: document.getElementById('chart-title'),
  chartCopy: document.getElementById('chart-copy'),
  chartLegend: document.getElementById('chart-legend'),
  chartCanvas: document.getElementById('chart-canvas'),
  chartInspector: document.getElementById('chart-inspector'),
  modelGrid: document.getElementById('stats-model-grid'),
};

const uiState = {
  panel: 'overview',
  chartView: 'ranking',
  experimentId: '1',
  statsData: null,
  compareData: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

function percentValue(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value * 100));
}

function readExperimentId() {
  const params = new URLSearchParams(window.location.search);
  return ['0', '1', '2', '3'].includes(params.get('experiment') || '') ? params.get('experiment') : '1';
}

function syncExperimentInUrl(experimentId) {
  const params = new URLSearchParams(window.location.search);
  params.set('experiment', experimentId);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function sortRows(statsObj) {
  return Object.values(statsObj || {}).sort((left, right) => {
    if (right.winRate !== left.winRate) return right.winRate - left.winRate;
    if (right.wins !== left.wins) return right.wins - left.wins;
    return right.challengeAccuracy - left.challengeAccuracy;
  });
}

function getTheme(modelId) {
  return window.ModelThemes.getTheme(modelId);
}

function getShortName(modelId) {
  const theme = getTheme(modelId);
  return theme.shortName || modelId;
}

function avatarMarkup(modelId, size = 'md') {
  return `
    <span class="stats-avatar stats-avatar--${size}">
      <img src="${escapeHtml(window.ModelThemes.getThumbnail(modelId))}" alt="${escapeHtml(getShortName(modelId))}">
    </span>
  `;
}

function setExperimentMeta(experimentId) {
  const experiment = getExperimentMeta(experimentId);
  dom.experimentSelect.value = experiment.id;
  dom.experimentId.textContent = `EXP${experiment.id}`;
  dom.experimentTitle.textContent = experiment.title;
  dom.experimentSummary.textContent = getQuotedExperimentSummary(experiment.id);
  dom.experimentFraming.textContent = experiment.detail;
  dom.experimentPurpose.textContent = experiment.purpose;
}

function renderMeta(data, experimentId) {
  const completedGames = data.includedCount ?? data.counts?.[experimentId] ?? 0;
  dom.includedGames.textContent = String(completedGames);
  dom.excludedGames.textContent = String(data.excludedGames || 0);

  if (data.cohort) {
    const parts = [
      `schema v${data.cohort.schemaVersion}`,
      data.cohort.provider,
      data.cohort.promptVersion ? `prompt ${data.cohort.promptVersion}` : null,
      data.cohort.promptHash || null,
    ].filter(Boolean);
    dom.cohortMeta.textContent = parts.join(' • ');
  } else {
    dom.cohortMeta.textContent = 'No comparable cohort loaded yet.';
  }

  dom.countsMeta.textContent = `${completedGames} included games in EXP${experimentId} • ${data.counts?.total ?? 0} frozen research games total`;
}

function renderPodium(rows) {
  const topRows = rows.slice(0, 3);
  dom.podium.innerHTML = topRows.map((stat, index) => `
    <article class="stats-podium-card" data-rank="${index + 1}">
      <div class="stats-podium-rank">#${index + 1}</div>
      <div class="stats-podium-face">
        ${avatarMarkup(stat.modelId, 'lg')}
        <div class="stats-podium-copy">
          <div class="stats-model-short">${escapeHtml(getShortName(stat.modelId))}</div>
          <div class="stats-model-id">${escapeHtml(stat.modelId)}</div>
        </div>
      </div>
      <div class="stats-podium-metrics">
        <span>win ${formatPercent(stat.winRate)}</span>
        <span>wins ${escapeHtml(`${stat.wins}/${stat.gamesPlayed}`)}</span>
        <span>judge ${formatPercent(stat.challengeAccuracy)}</span>
      </div>
    </article>
  `).join('');
}

function pickMetricLeader(rows, metric, predicate = () => true) {
  return rows
    .filter(predicate)
    .sort((left, right) => (right[metric] || 0) - (left[metric] || 0))[0] || null;
}

function renderSnapshots(rows) {
  const cards = [
    {
      label: 'top finisher',
      stat: rows[0] || null,
      value: rows[0] ? formatPercent(rows[0].winRate) : '0.0%',
    },
    {
      label: 'boldest liar',
      stat: pickMetricLeader(rows, 'lieFrequency'),
      value: rows.length ? formatPercent(pickMetricLeader(rows, 'lieFrequency')?.lieFrequency ?? 0) : '0.0%',
    },
    {
      label: 'sharpest judge',
      stat: pickMetricLeader(rows, 'challengeAccuracy', (row) => row.challengeAccuracy > 0),
      value: rows.length ? formatPercent(pickMetricLeader(rows, 'challengeAccuracy', (row) => row.challengeAccuracy > 0)?.challengeAccuracy ?? 0) : '0.0%',
    },
    {
      label: 'most suspicious',
      stat: pickMetricLeader(rows, 'paranoiaFrequency'),
      value: rows.length ? formatPercent(pickMetricLeader(rows, 'paranoiaFrequency')?.paranoiaFrequency ?? 0) : '0.0%',
    },
  ];

  dom.snapshotGrid.innerHTML = cards.map((card) => `
    <article class="stats-snapshot-card">
      <div class="stats-copy-label">${escapeHtml(card.label)}</div>
      ${card.stat ? `
        <div class="stats-snapshot-face">
          ${avatarMarkup(card.stat.modelId, 'sm')}
          <div class="stats-snapshot-copy">
            <div class="stats-model-short">${escapeHtml(getShortName(card.stat.modelId))}</div>
            <div class="stats-model-id">${escapeHtml(card.value)}</div>
          </div>
        </div>
      ` : '<div class="stats-metric-note">No comparable rows yet.</div>'}
    </article>
  `).join('');
}

function metricChip(label, value) {
  return `
    <div class="stats-metric-chip">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderCast(rows) {
  dom.modelGrid.innerHTML = rows.map((stat, index) => `
    <article class="stats-model-card">
      <div class="stats-model-head">
        ${avatarMarkup(stat.modelId, 'lg')}
        <div class="stats-model-copy">
          <div class="stats-model-short">${escapeHtml(getShortName(stat.modelId))}</div>
          <div class="stats-model-id">${escapeHtml(stat.modelId)}</div>
        </div>
        <div class="stats-rank-note">rank #${index + 1}</div>
      </div>
      <div class="stats-model-chips">
        ${metricChip('win', formatPercent(stat.winRate))}
        ${metricChip('lies', formatPercent(stat.lieFrequency))}
        ${metricChip('lie ok', formatPercent(stat.lieSuccessRate))}
        ${metricChip('paranoia', formatPercent(stat.paranoiaFrequency))}
        ${metricChip('judge', formatPercent(stat.challengeAccuracy))}
      </div>
    </article>
  `).join('');
}

function renderLegend(compareRows) {
  const experimentIds = [...new Set((compareRows || []).map((row) => row.experimentId))].sort((left, right) => left - right);
  dom.chartLegend.innerHTML = experimentIds.map((experimentId) => `
    <span class="stats-legend-chip ${String(experimentId) === uiState.experimentId ? 'is-active' : ''}">
      <span class="stats-legend-badge">E${experimentId}</span>
      <span>${escapeHtml(EXPERIMENT_LABELS[experimentId] || `EXP${experimentId}`)}</span>
    </span>
  `).join('');
}

function updateChartTabAvailability() {
  const hasCompare = Boolean(uiState.compareData?.rows?.length);
  dom.chartTabs.forEach((button) => {
    const isRanking = button.dataset.chartView === 'ranking';
    button.disabled = !isRanking && !hasCompare;
    button.classList.toggle('is-disabled', button.disabled);
  });
  if (!hasCompare && uiState.chartView !== 'ranking') {
    uiState.chartView = 'ranking';
  }
}

function renderRankingChart(rows) {
  dom.chartKicker.textContent = 'win-rate chart';
  dom.chartTitle.textContent = 'Who clears out most often?';
  dom.chartCopy.textContent = 'Selected experiment only.';
  dom.chartLegend.innerHTML = '';
  dom.chartInspector.textContent = 'Ranking view for the selected experiment.';

  dom.chartCanvas.innerHTML = `
    <div class="stats-ranking-chart">
      ${rows.map((stat, index) => `
        <article class="stats-ranking-row">
          <div class="stats-ranking-head">
            <span class="stats-ranking-index">#${index + 1}</span>
            ${avatarMarkup(stat.modelId, 'sm')}
            <div class="stats-model-copy">
              <div class="stats-model-short">${escapeHtml(getShortName(stat.modelId))}</div>
              <div class="stats-model-id">${escapeHtml(stat.modelId)}</div>
            </div>
          </div>
          <div class="stats-ranking-track">
            <span class="stats-ranking-fill" style="width:${percentValue(stat.winRate)}%;"></span>
          </div>
          <div class="stats-ranking-value">${formatPercent(stat.winRate)}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function scatterConfigForView(chartView) {
  if (chartView === 'lie-win') {
    return {
      kicker: 'cross-experiment scatter',
      title: 'Lie Frequency vs Win Rate',
      copy: 'Each point is one model under one experiment condition.',
      xKey: 'lieFrequency',
      xLabel: 'lie frequency',
      yKey: 'winRate',
      yLabel: 'win rate',
    };
  }

  return {
    kicker: 'cross-experiment scatter',
    title: 'Challenge Frequency vs Win Rate',
    copy: 'Paranoia frequency is the current challenge-rate metric in the pipeline.',
    xKey: 'paranoiaFrequency',
    xLabel: 'challenge frequency',
    yKey: 'winRate',
    yLabel: 'win rate',
  };
}

function describePoint(row) {
  return `EXP${row.experimentId} • ${getShortName(row.modelId)} • win ${formatPercent(row.winRate)} • lie ${formatPercent(row.lieFrequency)} • challenge ${formatPercent(row.paranoiaFrequency)}`;
}

function renderScatterChart(compareRows) {
  const config = scatterConfigForView(uiState.chartView);
  const points = (compareRows || []).filter((row) => row.gamesPlayed > 0);

  dom.chartKicker.textContent = config.kicker;
  dom.chartTitle.textContent = config.title;
  dom.chartCopy.textContent = config.copy;
  renderLegend(points);
  dom.chartInspector.textContent = 'Hover a point to inspect the model-condition row.';

  dom.chartCanvas.innerHTML = `
    <div class="stats-scatter-chart">
      <div class="stats-axis-label stats-axis-label--y">${escapeHtml(config.yLabel)}</div>
      <div class="stats-plot">
        <div class="stats-grid-lines">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        ${points.map((row) => {
          const x = 10 + (row[config.xKey] || 0) * 82;
          const y = 10 + (1 - (row[config.yKey] || 0)) * 72;
          const selected = String(row.experimentId) === uiState.experimentId;
          return `
            <button
              class="stats-point ${selected ? 'is-active' : ''}"
              type="button"
              data-point-label="${escapeHtml(describePoint(row))}"
              style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;"
              title="${escapeHtml(describePoint(row))}"
            >
              <span class="stats-point-avatar" style="background-image:url('${escapeHtml(window.ModelThemes.getThumbnail(row.modelId))}');"></span>
              <span class="stats-point-exp">E${row.experimentId}</span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="stats-axis-label stats-axis-label--x">${escapeHtml(config.xLabel)}</div>
    </div>
  `;

  dom.chartCanvas.querySelectorAll('.stats-point').forEach((point) => {
    const label = point.getAttribute('data-point-label') || '';
    point.addEventListener('mouseenter', () => {
      dom.chartInspector.textContent = label;
    });
    point.addEventListener('focus', () => {
      dom.chartInspector.textContent = label;
    });
    point.addEventListener('mouseleave', () => {
      dom.chartInspector.textContent = 'Hover a point to inspect the model-condition row.';
    });
    point.addEventListener('blur', () => {
      dom.chartInspector.textContent = 'Hover a point to inspect the model-condition row.';
    });
  });
}

function renderCharts(rows, compareRows) {
  updateChartTabAvailability();
  if (uiState.chartView === 'ranking') {
    renderRankingChart(rows);
    return;
  }
  renderScatterChart(compareRows);
}

function renderPanels() {
  dom.panelTabs.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.statsPanel === uiState.panel);
  });
  dom.panels.forEach((panel) => {
    const active = panel.dataset.panelContent === uiState.panel;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  dom.chartTabsWrap.hidden = uiState.panel !== 'charts';
  dom.chartTabs.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.chartView === uiState.chartView);
  });
}

function clearViews() {
  dom.podium.innerHTML = '';
  dom.snapshotGrid.innerHTML = '';
  dom.chartCanvas.innerHTML = '';
  dom.chartLegend.innerHTML = '';
  dom.modelGrid.innerHTML = '';
}

function renderLoadedState() {
  const rows = sortRows(uiState.statsData?.stats);
  const compareRows = uiState.compareData?.rows || [];

  renderPanels();
  clearViews();

  if (!rows.length) {
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = 'No comparable completed games were found for this experiment yet.';
    dom.statsStatus.textContent = 'No completed cohort yet';
    return;
  }

  dom.statsEmpty.hidden = true;
  dom.statsStatus.textContent = `${rows.length} cohort models`;
  renderPodium(rows);
  renderSnapshots(rows);
  renderCharts(rows, compareRows);
  renderCast(rows);
}

async function load() {
  const experimentId = dom.experimentSelect.value;
  uiState.experimentId = experimentId;
  syncExperimentInUrl(experimentId);
  setExperimentMeta(experimentId);

  dom.statsStatus.textContent = 'Loading comparable cohort…';
  dom.statsEmpty.hidden = true;
  dom.statsEmpty.textContent = '';
  clearViews();

  try {
    const [statsData, compareData] = await Promise.all([
      fetchResearchStats(experimentId),
      fetchResearchCompare(),
    ]);
    uiState.statsData = statsData;
    uiState.compareData = compareData;
    renderMeta(statsData, experimentId);
    renderLoadedState();
  } catch (error) {
    uiState.statsData = null;
    uiState.compareData = null;
    dom.statsStatus.textContent = 'Stats unavailable';
    dom.statsEmpty.hidden = false;
    dom.statsEmpty.textContent = error instanceof Error ? error.message : String(error);
    dom.cohortMeta.textContent = 'Failed to load cohort metadata.';
    dom.countsMeta.textContent = 'Stats request failed.';
    clearViews();
  }
}

dom.experimentSelect.value = readExperimentId();
uiState.experimentId = dom.experimentSelect.value;

dom.experimentSelect.addEventListener('change', () => {
  void load();
});

dom.panelTabs.forEach((button) => {
  button.addEventListener('click', () => {
    uiState.panel = button.dataset.statsPanel || 'overview';
    renderLoadedState();
  });
});

dom.chartTabs.forEach((button) => {
  button.addEventListener('click', () => {
    uiState.chartView = button.dataset.chartView || 'ranking';
    renderLoadedState();
  });
});

void load();
