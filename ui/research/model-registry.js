const MODEL_REGISTRY = {
  'z-ai/glm-5.1': {
    shortName: 'GLM',
    displayName: 'GLM 5.1',
    portraitUrl: '/images/glm/llms_glm_default.png',
    winnerArtUrl: '/images/glm/llms_glm_objection_correct.png',
  },
  'google/gemma-4-31b-it': {
    shortName: 'Gemma',
    displayName: 'Gemma 4 31B IT',
    portraitUrl: '/images/gemma/llms_gemma_default.png',
    winnerArtUrl: '/images/gemma/llms_gemma_objection_correct.png',
  },
  'moonshotai/kimi-k2.6': {
    shortName: 'Kimi',
    displayName: 'Kimi K2.6',
    portraitUrl: '/images/kimi/llms_kimi_default.png',
    winnerArtUrl: '/images/kimi/llms_kimi_objection_correct.png',
  },
  'minimaxai/minimax-m2.7': {
    shortName: 'MiniMax',
    displayName: 'MiniMax M2.7',
    portraitUrl: '/images/minimax/llms_minimax_default.png',
    winnerArtUrl: '/images/minimax/llms_minimax_objection_correct.png',
  },
  'deepseek-ai/deepseek-v4-flash': {
    shortName: 'DeepSeek',
    displayName: 'DeepSeek V4 Flash',
    portraitUrl: '/images/deepseek/llms_deepseek_default.png',
    winnerArtUrl: '/images/deepseek/llms_deepseek_objection_correct.png',
  },
  'qwen/qwen3.5-397b-a17b': {
    shortName: 'Qwen',
    displayName: 'Qwen 3.5 397B',
    portraitUrl: '/images/qwen/llms_qwen_default.png',
    winnerArtUrl: '/images/qwen/llms_qwen_objection_correct.png',
  },
  'minimaxai/minimax-m2.5': {
    shortName: 'MiniMax',
    displayName: 'MiniMax M2.5',
    portraitUrl: '/images/minimax/llms_minimax_default.png',
    winnerArtUrl: '/images/minimax/llms_minimax_objection_correct.png',
  },
  'nvidia/nemotron-3-super-120b-a12b': {
    shortName: 'Nemotron',
    displayName: 'Nemotron 3 Super 120B',
    portraitUrl: '/images/nemotron/llms_nemotron_default.png',
    winnerArtUrl: '/images/nemotron/llms_nemotron_objection_correct.png',
  },
  'mistralai/mistral-small-4-119b-2603': {
    shortName: 'Mistral',
    displayName: 'Mistral Small 4',
    portraitUrl: '/images/mistral/llms_mistral_default.png',
    winnerArtUrl: '/images/mistral/llms_mistral_objection_correct.png',
  },
  'z-ai/glm5': {
    shortName: 'GLM',
    displayName: 'GLM 5',
    portraitUrl: '/images/glm/llms_glm_default.png',
    winnerArtUrl: '/images/glm/llms_glm_objection_correct.png',
  },
  'moonshotai/kimi-k2.5': {
    shortName: 'Kimi',
    displayName: 'Kimi K2.5',
    portraitUrl: '/images/kimi/llms_kimi_default.png',
    winnerArtUrl: '/images/kimi/llms_kimi_objection_correct.png',
  },
};

const DEFAULT_MODEL = {
  shortName: 'Unknown',
  displayName: 'Unknown Model',
  portraitUrl: '/images/glm/llms_glm_default.png',
  winnerArtUrl: '/images/glm/llms_glm_objection_correct.png',
};

export function getModelMeta(modelId) {
  return MODEL_REGISTRY[modelId] || DEFAULT_MODEL;
}

export function getShortName(modelId) {
  return getModelMeta(modelId).shortName;
}

export function getPortraitUrl(modelId) {
  return getModelMeta(modelId).portraitUrl;
}

export function getWinnerArtUrl(modelId) {
  return getModelMeta(modelId).winnerArtUrl || getModelMeta(modelId).portraitUrl;
}
