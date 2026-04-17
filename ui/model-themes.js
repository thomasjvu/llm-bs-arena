window.ModelThemes = (() => {
  const HUMAN_MODEL_ID = 'human/player';
  const REQUIRED_MODEL_IDS = [
    'qwen/qwen3.5-397b-a17b',
    'minimaxai/minimax-m2.5',
    'nvidia/nemotron-3-super-120b-a12b',
    'mistralai/mistral-small-4-119b-2603',
    'z-ai/glm5',
    'moonshotai/kimi-k2.5',
    HUMAN_MODEL_ID,
  ];

  const KNOWN_IMAGE_FOLDERS = new Set(['qwen', 'minimax', 'mistral', 'glm', 'kimi']);

  // Frontend asset audit:
  // - Active folders in use by the current live cohort: qwen, minimax, mistral, glm, kimi.
  // - Human seat uses generated art instead of a folder-backed portrait set.
  // - nvidia/nemotron-3-super-120b-a12b currently uses the GLM folder as a temporary placeholder.
  // - Unused image folders currently present in the repo: deepseek, gemma.
  // - Actively used states in gameplay: default, judged, judging, thinking/raising-hand, win, lose.
  // - Reveal-only states now available for challenge outcomes: safe-lie, safe-truth.
  // - Any unregistered provider/model id falls back to the GLM portrait set until dedicated art is added.
  const PLACEHOLDER_THEME_IDS = new Set([
    'nvidia/nemotron-3-super-120b-a12b',
  ]);

  const LEGACY_ALIASES = {
    'moonshotai/kimi-k2-instruct': 'moonshotai/kimi-k2.5',
    'z-ai/glm4.7': 'z-ai/glm5',
  };

  function svgDataUri(svg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function makePortraitShell(fill, lines, label) {
    return `
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="14" width="132" height="132" rx="28" fill="${fill}" opacity="0.18"/>
        <rect x="28" y="28" width="104" height="104" rx="20" stroke="${fill}" stroke-width="3" opacity="0.75"/>
        ${lines}
      </svg>
    `;
  }

  function nemotronPortrait(state) {
    const glow = state === 'win' ? '#8bf5a8' : state === 'judged' ? '#d8ff72' : '#5ee7a4';
    const core = state === 'lose' ? '#50655a' : '#0f2f20';
    return makePortraitShell(
      glow,
      `
        <circle cx="80" cy="62" r="20" fill="${core}" stroke="${glow}" stroke-width="3"/>
        <path d="M48 102H112" stroke="${glow}" stroke-width="4" stroke-linecap="round"/>
        <path d="M60 88L72 74L88 74L100 88" stroke="${glow}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="72" cy="62" r="4" fill="${glow}"/>
        <circle cx="88" cy="62" r="4" fill="${glow}"/>
        <path d="M60 114L72 96L88 96L100 114" fill="${glow}" opacity="0.22"/>
      `,
      'NEMO'
    );
  }

  function humanPortrait(state) {
    const fill = state === 'win' ? '#ffcc66' : '#f0d7bf';
    return makePortraitShell(
      '#f56b43',
      `
        <circle cx="80" cy="55" r="16" fill="${fill}" stroke="#25130f" stroke-width="3"/>
        <path d="M52 113C56 90 66 78 80 78C94 78 104 90 108 113" fill="${fill}" stroke="#25130f" stroke-width="3"/>
        <circle cx="74" cy="53" r="3" fill="#25130f"/>
        <circle cx="86" cy="53" r="3" fill="#25130f"/>
        <path d="M73 63C76 66 84 66 87 63" stroke="#25130f" stroke-width="3" stroke-linecap="round"/>
      `,
      'YOU'
    );
  }

  function unknownPortrait() {
    return makePortraitShell(
      '#b6a9de',
      `
        <circle cx="80" cy="72" r="26" stroke="#b6a9de" stroke-width="4" opacity="0.7"/>
        <path d="M68 68C68 61 73 56 80 56C87 56 92 61 92 68C92 74 88 77 84 80C81 82 80 84 80 88" stroke="#b6a9de" stroke-width="4" stroke-linecap="round"/>
        <circle cx="80" cy="99" r="3.5" fill="#b6a9de"/>
      `,
      'UNK'
    );
  }

  const registry = {
    'qwen/qwen3.5-397b-a17b': {
      name: 'Qwen 3.5 397B',
      shortName: 'Qwen',
      title: 'THE STRATAGEM',
      accent: '#ff8b47',
      accentBright: '#ffc26d',
      accentDim: '#a85421',
      secondary: '#ffe8c4',
      folder: 'qwen',
      bg: '#fafafa',
    },
    'minimaxai/minimax-m2.5': {
      name: 'MiniMax M2.5',
      shortName: 'MiniMax',
      title: 'THE INSTIGATOR',
      accent: '#ff6d60',
      accentBright: '#ffb18a',
      accentDim: '#b14239',
      secondary: '#ffe1d8',
      folder: 'minimax',
      bg: '#fafafa',
    },
    'nvidia/nemotron-3-super-120b-a12b': {
      name: 'Nemotron 3 Super 120B',
      shortName: 'Nemotron',
      title: 'THE HOUSE',
      accent: '#5ee7a4',
      accentBright: '#b8ffd2',
      accentDim: '#2d8a61',
      secondary: '#e8fff2',
      folder: 'glm',
      placeholderSource: 'z-ai/glm5',
    },
    'mistralai/mistral-small-4-119b-2603': {
      name: 'Mistral Small 4',
      shortName: 'Mistral',
      title: 'THE SQUALL',
      accent: '#8db7d8',
      accentBright: '#d7efff',
      accentDim: '#4c708d',
      secondary: '#eff8ff',
      folder: 'mistral',
      bg: '#fafafa',
    },
    'z-ai/glm5': {
      name: 'GLM 5',
      shortName: 'GLM',
      title: 'THE ANALYST',
      accent: '#54c4d8',
      accentBright: '#b9f4ff',
      accentDim: '#267f90',
      secondary: '#dcfcff',
      folder: 'glm',
      bg: '#fafafa',
    },
    'moonshotai/kimi-k2.5': {
      name: 'Kimi K2.5',
      shortName: 'Kimi',
      title: 'THE ORACLE',
      accent: '#bb87ff',
      accentBright: '#ebd3ff',
      accentDim: '#7448a8',
      secondary: '#f3e9ff',
      folder: 'kimi',
      bg: '#fafafa',
    },
    [HUMAN_MODEL_ID]: {
      name: 'You',
      shortName: 'You',
      title: 'THE PLAYER',
      accent: '#f56b43',
      accentBright: '#ffd27d',
      accentDim: '#90391f',
      secondary: '#fff0d9',
      bg: '#fafafa',
      renderCharacter: humanPortrait,
    },
  };

  const defaultTheme = {
    name: 'Unknown Model',
    shortName: 'Unknown',
    title: 'THE UNKNOWN',
    accent: '#b6a9de',
    accentBright: '#e3dbff',
    accentDim: '#70639d',
    secondary: '#f2ecff',
    bg: '#fafafa',
    folder: 'glm',
    placeholderSource: 'z-ai/glm5',
    renderCharacter: unknownPortrait,
  };

  const imageStates = {
    default: 'default',
    judged: 'judged',
    judging: 'judging',
    lose: 'lose',
    'safe-lie': 'safe-lie',
    'safe-truth': 'safe-truth',
    thinking: 'raising-hand',
    win: 'win',
  };

  function resolveModelId(modelId) {
    return LEGACY_ALIASES[modelId] || modelId;
  }

  function getTheme(modelId) {
    const resolvedModelId = resolveModelId(modelId);
    const theme = registry[resolvedModelId];
    if (!theme) {
      return {
        ...defaultTheme,
        isPlaceholder: true,
      };
    }
    return {
      ...theme,
      isPlaceholder: PLACEHOLDER_THEME_IDS.has(resolvedModelId),
    };
  }

  function getFolderState(theme, state) {
    if (theme.folder === 'minimax' && state === 'thinking') {
      return 'hand-raised';
    }
    return imageStates[state] || 'default';
  }

  function renderFolderCharacter(theme, state, cacheBust) {
    const folder = theme.folder;
    const fileState = getFolderState(theme, state);
    const cacheSuffix = cacheBust ? `?v=${cacheBust}` : '';
    const imagePath = `/images/${folder}/llms_${folder}_${fileState}.png${cacheSuffix}`;
    const fallbackMarkup = (theme.renderCharacter || defaultTheme.renderCharacter)(state);
    return `
      <div class="character-asset">
        <img
          src="${imagePath}"
          alt="${theme.name}"
          class="character-state-image"
          onerror="this.hidden=true;this.nextElementSibling.hidden=false;"
        />
        <div class="character-fallback" hidden>${fallbackMarkup}</div>
      </div>
    `;
  }

  function getCharacterImage(modelId, state = 'default', cacheBust = '') {
    const theme = getTheme(modelId);
    if (theme.folder) {
      return renderFolderCharacter(theme, state, cacheBust);
    }
    return `
      <div class="character-asset character-asset--generated">
        ${(theme.renderCharacter || defaultTheme.renderCharacter)(state)}
      </div>
    `;
  }

  function getThumbnail(modelId) {
    const theme = getTheme(modelId);
    if (theme.folder) {
      return `/images/${theme.folder}/llms_${theme.folder}_default.png`;
    }
    return svgDataUri((theme.renderCharacter || defaultTheme.renderCharacter)('default'));
  }

  function validateRegistry() {
    const issues = [];

    REQUIRED_MODEL_IDS.forEach((modelId) => {
      if (!registry[modelId]) {
        issues.push(`Missing theme registry entry for ${modelId}`);
      }
    });

    Object.entries(registry).forEach(([modelId, theme]) => {
      if (!theme.folder && typeof theme.renderCharacter !== 'function') {
        issues.push(`Theme ${modelId} has neither an image folder nor a generated portrait`);
      }
      if (theme.folder && !KNOWN_IMAGE_FOLDERS.has(theme.folder)) {
        issues.push(`Theme ${modelId} references unknown folder "${theme.folder}"`);
      }
    });

    return issues;
  }

  function getAssetAudit() {
    return {
      activeFolders: ['qwen', 'minimax', 'mistral', 'glm', 'kimi'],
      placeholderThemes: [...PLACEHOLDER_THEME_IDS],
      unusedFolders: ['deepseek', 'gemma'],
      activeStates: ['default', 'judged', 'judging', 'thinking', 'win', 'lose'],
      revealStates: ['safe-lie', 'safe-truth'],
    };
  }

  return {
    getTheme,
    getDefault: () => defaultTheme,
    getCharacterImage,
    getThumbnail,
    getFolder(modelId) {
      return getTheme(modelId).folder || null;
    },
    getAssetAudit,
    validateRegistry,
  };
})();
