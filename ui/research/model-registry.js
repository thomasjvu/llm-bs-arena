const MODEL_REGISTRY = {
  'qwen/qwen3.5-397b-a17b': {
    shortName: 'Qwen',
    displayName: 'Qwen 3.5 397B',
    portraitUrl: '/images/qwen/llms_qwen_default.png',
  },
  'minimaxai/minimax-m2.5': {
    shortName: 'MiniMax',
    displayName: 'MiniMax M2.5',
    portraitUrl: '/images/minimax/llms_minimax_default.png',
  },
  'nvidia/nemotron-3-super-120b-a12b': {
    shortName: 'Nemotron',
    displayName: 'Nemotron 3 Super 120B',
    portraitUrl: '/images/glm/llms_glm_default.png',
  },
  'mistralai/mistral-small-4-119b-2603': {
    shortName: 'Mistral',
    displayName: 'Mistral Small 4',
    portraitUrl: '/images/mistral/llms_mistral_default.png',
  },
  'z-ai/glm5': {
    shortName: 'GLM',
    displayName: 'GLM 5',
    portraitUrl: '/images/glm/llms_glm_default.png',
  },
  'moonshotai/kimi-k2.5': {
    shortName: 'Kimi',
    displayName: 'Kimi K2.5',
    portraitUrl: '/images/kimi/llms_kimi_default.png',
  },
};

const DEFAULT_MODEL = {
  shortName: 'Unknown',
  displayName: 'Unknown Model',
  portraitUrl: '/images/glm/llms_glm_default.png',
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
