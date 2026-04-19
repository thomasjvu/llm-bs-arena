import { getModelMeta, getPortraitUrl, getShortName as lookupShortName, getWinnerArtUrl } from './model-registry.js';

const EXPERIMENTS = {
  all: {
    id: 'all',
    kicker: 'all',
    title: 'All',
    summary: 'Combined view across the full 600-game paper cohort.',
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
    detail: 'The instruction-following probe where overall lies remain a table-dynamics signal, but optional lies with truthful play available are the primary compliance metric.',
  },
};

const dom = {
  homeBtn: document.getElementById('research-home-btn'),
  scopeTabs: [...document.querySelectorAll('[data-scope]')],
  panelTabs: [...document.querySelectorAll('[data-panel]')],
  chartTabsWrap: document.getElementById('research-chart-tabs'),
  chartTabs: [...document.querySelectorAll('[data-chart-view]')],
  panels: [...document.querySelectorAll('[data-panel-content]')],
  status: document.getElementById('research-status'),
  empty: document.getElementById('research-empty'),
  scopeTitle: document.getElementById('scope-title'),
  scopeSummary: document.getElementById('scope-summary'),
  scopeDetail: document.getElementById('scope-detail'),
  topModel: document.getElementById('research-top-model'),
  topModelCopy: document.getElementById('research-top-model-copy'),
  includedGames: document.getElementById('included-games'),
  modelCount: document.getElementById('model-count'),
  topWinRate: document.getElementById('top-win-rate'),
  topWinShare: document.getElementById('top-win-share'),
  overviewChartTitle: document.getElementById('overview-chart-title'),
  overviewChartCanvas: document.getElementById('overview-chart-canvas'),
  chartTitle: document.getElementById('chart-title'),
  chartCopy: document.getElementById('chart-copy'),
  chartLegend: document.getElementById('chart-legend'),
  chartCanvas: document.getElementById('chart-canvas'),
  chartInspector: document.getElementById('chart-inspector'),
  playerStage: document.getElementById('research-player-stage'),
  playerPrev: document.getElementById('research-player-prev'),
  playerNext: document.getElementById('research-player-next'),
};

const uiState = {
  scope: 'all',
  panel: 'overview',
  chartView: 'ranking',
  playerIndex: 0,
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

function getScopeIncludedCount(scope) {
  const scopeData = getScopeData(scope);
  return scopeData?.includedCount ?? 0;
}

function getExperimentIncludedCount(experimentId) {
  return uiState.bundle?.experiments?.[String(experimentId)]?.includedCount ?? 0;
}

function getWinShare(row, includedCount) {
  if (!row || !includedCount) return 0;
  return row.wins / includedCount;
}

function clearViews() {
  dom.overviewChartCanvas.innerHTML = '';
  dom.chartLegend.innerHTML = '';
  dom.chartCanvas.innerHTML = '';
  dom.playerStage.innerHTML = '';
  dom.topModel.innerHTML = '';
  if (dom.topModelCopy) {
    dom.topModelCopy.innerHTML = '';
  }
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

function renderMiniRanking(container, rows, includedCount) {
  container.innerHTML = rows.map((row, index) => `
    <article class="research-mini-rank-row">
      <div class="research-mini-rank-head">
        <span class="research-mini-rank-index">#${index + 1}</span>
        ${avatarMarkup(row.modelId, 'sm')}
        <span class="research-mini-rank-name">${escapeHtml(getShortName(row.modelId))}</span>
      </div>
      <div class="research-mini-rank-track">
        <span class="research-mini-rank-fill" style="width:${clampPercent(getWinShare(row, includedCount))}%;"></span>
      </div>
      <div class="research-mini-rank-value">
        <strong>${formatPercent(getWinShare(row, includedCount))}</strong>
        <span>seat win ${formatPercent(row.winRate)}</span>
      </div>
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

function renderAxisTicks(axis) {
  const values = axis === 'y' ? [100, 75, 50, 25, 0] : [0, 25, 50, 75, 100];
  return `
    <div class="research-axis-ticks research-axis-ticks--${axis}">
      ${values.map((value) => {
        const position = axis === 'y'
          ? 10 + (1 - value / 100) * 72
          : 10 + (value / 100) * 82;
        const style = axis === 'y' ? `top:${position.toFixed(2)}%;` : `left:${position.toFixed(2)}%;`;
        return `<span style="${style}">${value}%</span>`;
      }).join('')}
    </div>
  `;
}

function describePoint(row) {
  const includedCount = getExperimentIncludedCount(row.experimentId);
  return `EXP${row.experimentId} • ${getShortName(row.modelId)} • seat win ${formatPercent(row.winRate)} • share ${formatPercent(getWinShare(row, includedCount))} • lie ${formatPercent(row.lieFrequency)} • challenge ${formatPercent(row.paranoiaFrequency)}`;
}

function renderRankingChart(rows, includedCount) {
  dom.chartTitle.textContent = 'Win Share Ranking';
  dom.chartCopy.textContent = uiState.scope === 'all'
    ? 'Primary value is win share; secondary note is seat win rate from the 600-game cohort.'
    : `Primary value is win share; secondary note is seat win rate in ${getScopeMeta(uiState.scope).title}.`;
  dom.chartLegend.innerHTML = '';
  dom.chartInspector.hidden = true;
  dom.chartInspector.textContent = '';
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
            <span class="research-ranking-fill" style="width:${clampPercent(getWinShare(row, includedCount))}%;"></span>
          </div>
          <div class="research-ranking-value">
            <strong>${formatPercent(getWinShare(row, includedCount))}</strong>
            <span>seat win ${formatPercent(row.winRate)}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function getScatterConfig(chartView) {
  if (chartView === 'lie-win') {
    return {
      title: 'Lie Frequency vs Win Rate',
      copy: uiState.scope === 'all'
        ? 'Each point is one model under one experiment condition.'
        : `${getScopeMeta(uiState.scope).title} only.`,
      xKey: 'lieFrequency',
      xLabel: 'lie frequency',
      yKey: 'winRate',
      yLabel: 'seat win rate',
    };
  }

  return {
    title: 'Challenge Frequency vs Win Rate',
    copy: uiState.scope === 'all'
      ? 'Each point is one model under one experiment condition.'
      : `${getScopeMeta(uiState.scope).title} only.`,
    xKey: 'paranoiaFrequency',
    xLabel: 'challenge frequency',
    yKey: 'winRate',
    yLabel: 'seat win rate',
  };
}

function renderScatterChart(rows) {
  const config = getScatterConfig(uiState.chartView);
  dom.chartTitle.textContent = config.title;
  dom.chartCopy.textContent = config.copy;
  renderLegend(rows);
  dom.chartInspector.hidden = false;
  dom.chartInspector.textContent = 'Hover a point to inspect the model-condition row.';
  dom.chartCanvas.innerHTML = `
    <div class="research-scatter-chart">
      <div class="research-axis-label research-axis-label--y">${escapeHtml(config.yLabel)}</div>
      <div class="research-plot">
        <div class="research-grid-lines">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        ${renderAxisTicks('y')}
        ${renderAxisTicks('x')}
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
    renderRankingChart(rows, getScopeIncludedCount(uiState.scope));
    return;
  }
  renderScatterChart(compareRows);
}

function renderOverviewSpotlight(rows, compareRows) {
  void compareRows;
  dom.overviewChartTitle.textContent = 'LEADERBOARD';
  renderMiniRanking(dom.overviewChartCanvas, rows, getScopeIncludedCount(uiState.scope));
}

function metricChip(label, value) {
  return `
    <div class="research-metric-chip">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function metricBar(label, value, emphasis = 'default') {
  return `
    <div class="research-player-metric">
      <div class="research-player-metric-head">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
      <div class="research-player-metric-track">
        <span class="research-player-metric-fill research-player-metric-fill--${escapeHtml(emphasis)}" style="width:${clampPercent(parseFloat(String(value)) / 100)}%;"></span>
      </div>
    </div>
  `;
}

function renderCast(rows) {
  const includedCount = getScopeIncludedCount(uiState.scope);
  if (!rows.length) {
    dom.playerStage.innerHTML = '';
    dom.playerPrev.disabled = true;
    dom.playerNext.disabled = true;
    return;
  }

  uiState.playerIndex = ((uiState.playerIndex % rows.length) + rows.length) % rows.length;
  const row = rows[uiState.playerIndex];
  const rank = uiState.playerIndex + 1;

  dom.playerPrev.disabled = rows.length < 2;
  dom.playerNext.disabled = rows.length < 2;

  dom.playerStage.innerHTML = `
    <article class="research-player-showcase">
      <div class="research-player-showcase-rail">
        <div class="research-player-portrait-wrap research-player-portrait-wrap--hero">
          ${avatarMarkup(row.modelId, 'hero')}
        </div>
        <div class="research-player-footer research-player-footer--hero">
          <div class="research-player-name">${escapeHtml(getShortName(row.modelId))}</div>
          <div class="research-player-id">${escapeHtml(row.modelId)}</div>
          <div class="research-player-rank research-player-rank--hero">rank #${rank}</div>
        </div>
      </div>
      <div class="research-player-showcase-main">
        <div class="research-player-stat-grid research-player-stat-grid--hero">
          ${metricBar('win share', formatPercent(getWinShare(row, includedCount)), 'primary')}
          ${metricBar('seat win', formatPercent(row.winRate), 'strong')}
          ${metricBar('lie freq', formatPercent(row.lieFrequency))}
          ${metricBar('lie success', formatPercent(row.lieSuccessRate))}
          ${metricBar('challenge freq', formatPercent(row.paranoiaFrequency))}
          ${metricBar('judge accuracy', formatPercent(row.challengeAccuracy))}
        </div>
      </div>
    </article>
  `;
}

function renderScopeSummary(scopeData, rows) {
  const scopeMeta = getScopeMeta(uiState.scope);
  const topRow = rows[0] || null;

  dom.scopeTitle.textContent = scopeMeta.title;
  dom.scopeSummary.textContent = scopeMeta.summary;
  dom.scopeDetail.textContent = scopeMeta.detail;
  dom.includedGames.textContent = String(scopeData?.includedCount ?? 0);
  dom.modelCount.textContent = String(rows.length);
  dom.topWinRate.textContent = topRow ? formatPercent(topRow.winRate) : '0.0%';
  dom.topWinShare.textContent = topRow ? formatPercent(getWinShare(topRow, scopeData?.includedCount ?? 0)) : '0.0%';

  if (topRow) {
    const topMeta = getModelMeta(topRow.modelId);
    dom.topModel.innerHTML = `
      <img class="research-top-model-art" src="${escapeHtml(getWinnerArtUrl(topRow.modelId))}" alt="${escapeHtml(topMeta.displayName)}">
    `;
    if (dom.topModelCopy) {
      dom.topModelCopy.innerHTML = `
        <div class="research-top-model-label">top finisher</div>
        <div class="research-top-model-name">${escapeHtml(getShortName(topRow.modelId))}</div>
        <div class="research-top-model-stat">${formatPercent(getWinShare(topRow, scopeData?.includedCount ?? 0))} share • ${formatPercent(topRow.winRate)} seat win</div>
      `;
    }
  } else {
    dom.topModel.innerHTML = '';
    if (dom.topModelCopy) {
      dom.topModelCopy.innerHTML = '';
    }
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
    dom.empty.textContent = 'Research data is missing for this cohort scope.';
    dom.status.textContent = 'No cohort data loaded';
    return;
  }

  dom.empty.hidden = true;
  dom.status.textContent = uiState.scope === 'all' ? '600-game cohort' : `${getScopeMeta(uiState.scope).title} • 150-game cohort slice`;

  renderScopeSummary(scopeData, rows);
  renderOverviewSpotlight(rows, compareRows);
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
  dom.status.textContent = 'Loading cohort…';
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
    uiState.playerIndex = 0;
    renderLoadedState();
    syncScopeInUrl(uiState.scope);
  });
});

if (dom.homeBtn) {
  dom.homeBtn.addEventListener('click', () => {
    uiState.panel = 'overview';
    renderLoadedState();
  });
}

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

dom.playerPrev.addEventListener('click', () => {
  uiState.playerIndex -= 1;
  renderLoadedState();
});

dom.playerNext.addEventListener('click', () => {
  uiState.playerIndex += 1;
  renderLoadedState();
});

void load();
