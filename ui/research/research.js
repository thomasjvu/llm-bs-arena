import { getModelMeta, getPortraitUrl, getShortName as lookupShortName } from './model-registry.js';

const EXPERIMENTS = {
  all: {
    id: 'all',
    kicker: 'all',
    title: 'All Experiments',
    summary: 'Combined view across the full frozen 600-game paper cohort.',
    detail: 'Aggregates EXP0 through EXP3 using raw totals before deriving win, lie, and challenge rates.',
  },
  '0': {
    id: '0',
    kicker: 'exp0',
    title: 'Control',
    summary: '"Low-strategy / random-play baseline."',
    detail: 'No strategic deception guidance. This is the control condition used to establish the low-strategy reference point.',
  },
  '1': {
    id: '1',
    kicker: 'exp1',
    title: 'Baseline',
    summary: '"Deception is allowed and expected."',
    detail: 'The normal benchmark condition used for the main deception and challenge baseline.',
  },
  '2': {
    id: '2',
    kicker: 'exp2',
    title: 'Asymmetric Fairness',
    summary: '"The focal model may lie, but opponents are framed as honest."',
    detail: 'The moral-restraint probe in which the acting model is told opponents are honesty-constrained.',
  },
  '3': {
    id: '3',
    kicker: 'exp3',
    title: 'Honesty Mandate',
    summary: '"All players are instructed not to lie."',
    detail: 'The instruction-following probe where any lie counts as an explicit honesty violation.',
  },
};

const dom = {
  scopeTabs: [...document.querySelectorAll('[data-scope]')],
  panelTabs: [...document.querySelectorAll('[data-panel]')],
  chartTabsWrap: document.getElementById('research-chart-tabs'),
  chartTabs: [...document.querySelectorAll('[data-chart-view]')],
  panels: [...document.querySelectorAll('[data-panel-content]')],
  toolbarCopy: document.getElementById('toolbar-copy'),
  status: document.getElementById('research-status'),
  empty: document.getElementById('research-empty'),
  scopeKicker: document.getElementById('scope-kicker'),
  scopeTitle: document.getElementById('scope-title'),
  scopeSummary: document.getElementById('scope-summary'),
  scopeDetail: document.getElementById('scope-detail'),
  topModel: document.getElementById('research-top-model'),
  includedGames: document.getElementById('included-games'),
  excludedGames: document.getElementById('excluded-games'),
  modelCount: document.getElementById('model-count'),
  topWinRate: document.getElementById('top-win-rate'),
  scopeMeta: document.getElementById('scope-meta'),
  overviewRanking: document.getElementById('overview-ranking'),
  overviewLieScatter: document.getElementById('overview-lie-scatter'),
  overviewChallengeScatter: document.getElementById('overview-challenge-scatter'),
  chartKicker: document.getElementById('chart-kicker'),
  chartTitle: document.getElementById('chart-title'),
  chartCopy: document.getElementById('chart-copy'),
  chartLegend: document.getElementById('chart-legend'),
  chartCanvas: document.getElementById('chart-canvas'),
  chartInspector: document.getElementById('chart-inspector'),
  castGrid: document.getElementById('research-cast-grid'),
};

const uiState = {
  scope: 'all',
  panel: 'overview',
  chartView: 'ranking',
  bundle: null,
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

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value * 100));
}

function readScope() {
  const params = new URLSearchParams(window.location.search);
  const scope = params.get('scope') || '';
  return ['all', '0', '1', '2', '3'].includes(scope) ? scope : 'all';
}

function syncScopeInUrl(scope) {
  const params = new URLSearchParams(window.location.search);
  params.set('scope', scope);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function getScopeMeta(scope) {
  return EXPERIMENTS[scope] || EXPERIMENTS.all;
}

function getShortName(modelId) {
  return lookupShortName(modelId) || modelId;
}

function avatarMarkup(modelId, size = 'md') {
  const model = getModelMeta(modelId);
  return `
    <span class="research-avatar research-avatar--${size}">
      <img src="${escapeHtml(getPortraitUrl(modelId))}" alt="${escapeHtml(model.displayName)}">
    </span>
  `;
}

function sortRows(stats) {
  return Object.values(stats || {}).sort((left, right) => {
    if (right.winRate !== left.winRate) return right.winRate - left.winRate;
    if (right.wins !== left.wins) return right.wins - left.wins;
    return right.challengeAccuracy - left.challengeAccuracy;
  });
}

function getScopeData(scope) {
  if (!uiState.bundle) return null;
  if (scope === 'all') {
    return uiState.bundle.all;
  }
  return uiState.bundle.experiments?.[scope] || null;
}

function getCompareRows(scope) {
  const rows = uiState.bundle?.compareRows || [];
  if (scope === 'all') return rows;
  return rows.filter((row) => String(row.experimentId) === String(scope));
}

function clearViews() {
  dom.overviewRanking.innerHTML = '';
  dom.overviewLieScatter.innerHTML = '';
  dom.overviewChallengeScatter.innerHTML = '';
  dom.chartLegend.innerHTML = '';
  dom.chartCanvas.innerHTML = '';
  dom.castGrid.innerHTML = '';
  dom.topModel.innerHTML = '';
}

function renderPanels() {
  dom.panelTabs.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.panel === uiState.panel);
  });
  dom.chartTabsWrap.hidden = uiState.panel !== 'charts';
  dom.chartTabs.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.chartView === uiState.chartView);
  });
  dom.panels.forEach((panel) => {
    const active = panel.dataset.panelContent === uiState.panel;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  dom.scopeTabs.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.scope === uiState.scope);
  });
}

function renderMiniRanking(container, rows) {
  container.innerHTML = rows.map((row, index) => `
    <article class="research-mini-rank-row">
      <div class="research-mini-rank-head">
        <span class="research-mini-rank-index">#${index + 1}</span>
        ${avatarMarkup(row.modelId, 'sm')}
        <span class="research-mini-rank-name">${escapeHtml(getShortName(row.modelId))}</span>
      </div>
      <div class="research-mini-rank-track">
        <span class="research-mini-rank-fill" style="width:${clampPercent(row.winRate)}%;"></span>
      </div>
      <div class="research-mini-rank-value">${formatPercent(row.winRate)}</div>
    </article>
  `).join('');
}

function renderMiniScatter(container, rows, xKey, yKey) {
  container.innerHTML = `
    <div class="research-mini-plot">
      <div class="research-mini-grid">
        <span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span>
      </div>
      ${rows.map((row) => {
        const x = 10 + (row[xKey] || 0) * 82;
        const y = 10 + (1 - (row[yKey] || 0)) * 72;
        return `
          <span
            class="research-mini-point"
            style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;background-image:url('${escapeHtml(getPortraitUrl(row.modelId))}');"
            title="${escapeHtml(`EXP${row.experimentId} • ${getShortName(row.modelId)}`)}"
          ></span>
        `;
      }).join('')}
    </div>
  `;
}

function renderLegend(rows) {
  const experimentIds = [...new Set(rows.map((row) => row.experimentId))].sort((left, right) => left - right);
  dom.chartLegend.innerHTML = experimentIds.map((experimentId) => `
    <span class="research-legend-chip ${String(experimentId) === uiState.scope ? 'is-active' : ''}">
      <span class="research-legend-badge">E${experimentId}</span>
      <span>${escapeHtml(getScopeMeta(String(experimentId)).title)}</span>
    </span>
  `).join('');
}

function describePoint(row) {
  return `EXP${row.experimentId} • ${getShortName(row.modelId)} • win ${formatPercent(row.winRate)} • lie ${formatPercent(row.lieFrequency)} • challenge ${formatPercent(row.paranoiaFrequency)}`;
}

function renderRankingChart(rows) {
  dom.chartKicker.textContent = uiState.scope === 'all' ? 'aggregate ranking' : `ranking for ${getScopeMeta(uiState.scope).kicker}`;
  dom.chartTitle.textContent = 'Win Rate Ranking';
  dom.chartCopy.textContent = uiState.scope === 'all'
    ? 'Aggregate across the frozen 600-game cohort.'
    : `${getScopeMeta(uiState.scope).title} only.`;
  dom.chartLegend.innerHTML = '';
  dom.chartInspector.textContent = 'Ranking view for the selected scope.';
  dom.chartCanvas.innerHTML = `
    <div class="research-ranking-chart">
      ${rows.map((row, index) => `
        <article class="research-ranking-row">
          <div class="research-ranking-head">
            <span class="research-ranking-index">#${index + 1}</span>
            ${avatarMarkup(row.modelId, 'sm')}
            <div class="research-model-copy">
              <div class="research-model-short">${escapeHtml(getShortName(row.modelId))}</div>
              <div class="research-model-id">${escapeHtml(row.modelId)}</div>
            </div>
          </div>
          <div class="research-ranking-track">
            <span class="research-ranking-fill" style="width:${clampPercent(row.winRate)}%;"></span>
          </div>
          <div class="research-ranking-value">${formatPercent(row.winRate)}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function getScatterConfig(chartView) {
  if (chartView === 'lie-win') {
    return {
      kicker: 'scatter chart',
      title: 'Lie Frequency vs Win Rate',
      copy: uiState.scope === 'all'
        ? 'Each point is one model under one experiment condition.'
        : `${getScopeMeta(uiState.scope).title} only.`,
      xKey: 'lieFrequency',
      xLabel: 'lie frequency',
      yKey: 'winRate',
      yLabel: 'win rate',
    };
  }

  return {
    kicker: 'scatter chart',
    title: 'Challenge Frequency vs Win Rate',
    copy: uiState.scope === 'all'
      ? 'Each point is one model under one experiment condition.'
      : `${getScopeMeta(uiState.scope).title} only.`,
    xKey: 'paranoiaFrequency',
    xLabel: 'challenge frequency',
    yKey: 'winRate',
    yLabel: 'win rate',
  };
}

function renderScatterChart(rows) {
  const config = getScatterConfig(uiState.chartView);
  dom.chartKicker.textContent = config.kicker;
  dom.chartTitle.textContent = config.title;
  dom.chartCopy.textContent = config.copy;
  renderLegend(rows);
  dom.chartInspector.textContent = 'Hover a point to inspect the model-condition row.';
  dom.chartCanvas.innerHTML = `
    <div class="research-scatter-chart">
      <div class="research-axis-label research-axis-label--y">${escapeHtml(config.yLabel)}</div>
      <div class="research-plot">
        <div class="research-grid-lines">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        ${rows.map((row) => {
          const x = 10 + (row[config.xKey] || 0) * 82;
          const y = 10 + (1 - (row[config.yKey] || 0)) * 72;
          return `
            <button
              class="research-point ${String(row.experimentId) === uiState.scope ? 'is-active' : ''}"
              type="button"
              data-label="${escapeHtml(describePoint(row))}"
              style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;"
              title="${escapeHtml(describePoint(row))}"
            >
              <span class="research-point-avatar" style="background-image:url('${escapeHtml(getPortraitUrl(row.modelId))}');"></span>
              <span class="research-point-exp">E${row.experimentId}</span>
            </button>
          `;
        }).join('')}
      </div>
      <div class="research-axis-label research-axis-label--x">${escapeHtml(config.xLabel)}</div>
    </div>
  `;

  dom.chartCanvas.querySelectorAll('.research-point').forEach((point) => {
    const label = point.getAttribute('data-label') || '';
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
  if (uiState.chartView === 'ranking') {
    renderRankingChart(rows);
    return;
  }
  renderScatterChart(compareRows);
}

function metricChip(label, value) {
  return `
    <div class="research-metric-chip">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderCast(rows) {
  dom.castGrid.innerHTML = rows.map((row, index) => `
    <article class="research-cast-card">
      <div class="research-cast-head">
        ${avatarMarkup(row.modelId, 'lg')}
        <div class="research-model-copy">
          <div class="research-model-short">${escapeHtml(getShortName(row.modelId))}</div>
          <div class="research-model-id">${escapeHtml(row.modelId)}</div>
        </div>
        <div class="research-rank-note">rank #${index + 1}</div>
      </div>
      <div class="research-cast-chips">
        ${metricChip('win', formatPercent(row.winRate))}
        ${metricChip('lies', formatPercent(row.lieFrequency))}
        ${metricChip('lie ok', formatPercent(row.lieSuccessRate))}
        ${metricChip('paranoia', formatPercent(row.paranoiaFrequency))}
        ${metricChip('judge', formatPercent(row.challengeAccuracy))}
      </div>
    </article>
  `).join('');
}

function renderScopeSummary(scopeData, rows) {
  const scopeMeta = getScopeMeta(uiState.scope);
  const topRow = rows[0] || null;
  const cohort = uiState.bundle?.cohort;

  dom.scopeKicker.textContent = scopeMeta.kicker;
  dom.scopeTitle.textContent = scopeMeta.title;
  dom.scopeSummary.textContent = scopeMeta.summary;
  dom.scopeDetail.textContent = scopeMeta.detail;
  dom.includedGames.textContent = String(scopeData?.includedCount ?? 0);
  dom.excludedGames.textContent = String(scopeData?.excludedGames ?? 0);
  dom.modelCount.textContent = String(rows.length);
  dom.topWinRate.textContent = topRow ? formatPercent(topRow.winRate) : '0.0%';

  dom.scopeMeta.textContent = [
    `schema v${cohort?.schemaVersion ?? '?'}`,
    cohort?.provider || 'unknown provider',
    cohort?.promptVersion ? `prompt ${cohort.promptVersion}` : null,
    cohort?.promptHash || null,
  ].filter(Boolean).join(' • ');

  dom.toolbarCopy.textContent = uiState.scope === 'all'
    ? 'Frozen 600-game paper cohort across EXP0-EXP3.'
    : `Frozen 150-game ${scopeMeta.title} slice from the paper cohort.`;

  if (topRow) {
    dom.topModel.innerHTML = `
      <div class="research-top-model-face">
        ${avatarMarkup(topRow.modelId, 'lg')}
        <div class="research-top-model-copy">
          <div class="research-top-model-label">top finisher</div>
          <div class="research-top-model-name">${escapeHtml(getShortName(topRow.modelId))}</div>
          <div class="research-top-model-stat">${formatPercent(topRow.winRate)} win rate</div>
        </div>
      </div>
    `;
  } else {
    dom.topModel.innerHTML = '';
  }
}

function renderLoadedState() {
  renderPanels();
  clearViews();

  const scopeData = getScopeData(uiState.scope);
  const rows = sortRows(scopeData?.stats);
  const compareRows = getCompareRows(uiState.scope);

  if (!scopeData || !rows.length) {
    dom.empty.hidden = false;
    dom.empty.textContent = 'Frozen research data is missing for this scope.';
    dom.status.textContent = 'No research cohort loaded';
    return;
  }

  dom.empty.hidden = true;
  dom.status.textContent = uiState.scope === 'all' ? '600-game frozen cohort' : `${getScopeMeta(uiState.scope).title} • 150-game slice`;

  renderScopeSummary(scopeData, rows);
  renderMiniRanking(dom.overviewRanking, rows);
  renderMiniScatter(dom.overviewLieScatter, compareRows, 'lieFrequency', 'winRate');
  renderMiniScatter(dom.overviewChallengeScatter, compareRows, 'paranoiaFrequency', 'winRate');
  renderCharts(rows, compareRows);
  renderCast(rows);
}

async function loadBundle() {
  const response = await fetch('./data/research-cohort.json');
  if (!response.ok) {
    throw new Error(`Failed to load research cohort (${response.status})`);
  }
  return response.json();
}

async function load() {
  dom.status.textContent = 'Loading frozen cohort…';
  dom.empty.hidden = true;
  dom.empty.textContent = '';

  try {
    uiState.bundle = await loadBundle();
    syncScopeInUrl(uiState.scope);
    renderLoadedState();
  } catch (error) {
    uiState.bundle = null;
    clearViews();
    dom.status.textContent = 'Research data unavailable';
    dom.empty.hidden = false;
    dom.empty.textContent = error instanceof Error ? error.message : String(error);
  }
}

uiState.scope = readScope();

dom.scopeTabs.forEach((button) => {
  button.addEventListener('click', () => {
    uiState.scope = button.dataset.scope || 'all';
    renderLoadedState();
    syncScopeInUrl(uiState.scope);
  });
});

dom.panelTabs.forEach((button) => {
  button.addEventListener('click', () => {
    uiState.panel = button.dataset.panel || 'overview';
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
