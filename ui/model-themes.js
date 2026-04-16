// Model Themes — visual identity for each LLM
// Each model gets a unique color palette, background, and character emblem

window.ModelThemes = (() => {

  const themes = {

    'unsloth/gemma-3-27b-it': {
      name: 'Gemma-3-27B',
      shortName: 'Gemma',
      title: 'THE GEM',
      accent: '#00bbdd',
      accentBright: '#33ddff',
      accentDim: '#006688',
      secondary: '#0055aa',
      bg: [
        'radial-gradient(ellipse at 50% 30%, rgba(0,187,221,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 70% 80%, rgba(0,85,170,0.08) 0%, transparent 40%)',
        'radial-gradient(ellipse at 20% 60%, rgba(0,187,221,0.05) 0%, transparent 35%)',
        'linear-gradient(180deg, #050f14 0%, #081a22 35%, #06131a 70%, #030a0d 100%)',
      ].join(', '),
      patternSVG: `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="30" stroke="rgba(0,187,221,0.03)" stroke-width="1" fill="none"/><circle cx="40" cy="40" r="18" stroke="rgba(0,187,221,0.04)" stroke-width="0.5" fill="none"/><circle cx="10" cy="10" r="2" fill="rgba(0,187,221,0.03)"/><circle cx="70" cy="60" r="1.5" fill="rgba(0,187,221,0.03)"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="ds-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#00bbdd" stop-opacity="0.3"/>
              <stop offset="60%" stop-color="#0055aa" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="#00bbdd" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="ds-iris" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#33ddff"/>
              <stop offset="60%" stop-color="#0088bb"/>
              <stop offset="100%" stop-color="#003355"/>
            </radialGradient>
          </defs>
          <circle cx="80" cy="80" r="72" fill="url(#ds-glow)"/>
          <!-- Outer rings — sonar/depth -->
          <circle cx="80" cy="80" r="58" stroke="#00bbdd" stroke-width="1" fill="none" opacity="0.15"/>
          <circle cx="80" cy="80" r="50" stroke="#00bbdd" stroke-width="0.8" fill="none" opacity="0.12"/>
          <circle cx="80" cy="80" r="42" stroke="#00bbdd" stroke-width="0.6" fill="none" opacity="0.1"/>
          <!-- Eye shape — almond -->
          <ellipse cx="80" cy="80" rx="38" ry="22" fill="#081a22" stroke="#00bbdd" stroke-width="1.5" opacity="0.9"/>
          <!-- Iris -->
          <circle cx="80" cy="80" r="16" fill="url(#ds-iris)" opacity="0.9"/>
          <!-- Pupil — vertical slit -->
          <ellipse cx="80" cy="80" rx="4" ry="14" fill="#030a0d"/>
          <!-- Iris detail rings -->
          <circle cx="80" cy="80" r="12" stroke="#33ddff" stroke-width="0.5" fill="none" opacity="0.3"/>
          <circle cx="80" cy="80" r="8" stroke="#33ddff" stroke-width="0.3" fill="none" opacity="0.2"/>
          <!-- Highlight -->
          <circle cx="74" cy="74" r="3" fill="#ffffff" opacity="0.5"/>
          <circle cx="86" cy="85" r="1.5" fill="#ffffff" opacity="0.25"/>
          <!-- Depth particles -->
          <circle cx="45" cy="45" r="1.5" fill="#00bbdd" opacity="0.3"/>
          <circle cx="115" cy="50" r="1" fill="#33ddff" opacity="0.25"/>
          <circle cx="50" cy="115" r="1.2" fill="#00bbdd" opacity="0.2"/>
          <circle cx="110" cy="110" r="0.8" fill="#33ddff" opacity="0.2"/>
        </svg>`;
      }
    },

    'moonshotai/Kimi-K2-Instruct': {
      name: 'Kimi-K2-Instruct',
      shortName: 'Kimi',
      title: 'THE MOON',
      accent: '#b388ff',
      accentBright: '#d4b5ff',
      accentDim: '#7744bb',
      secondary: '#e0e0e0',
      bg: [
        'radial-gradient(ellipse at 40% 25%, rgba(179,136,255,0.12) 0%, transparent 50%)',
        'radial-gradient(ellipse at 65% 75%, rgba(212,181,255,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #0d0816 0%, #140e22 35%, #100a1c 70%, #080510 100%)',
      ].join(', '),
      patternSVG: `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="20" r="1" fill="rgba(212,181,255,0.06)"/><circle cx="75" cy="45" r="0.8" fill="rgba(212,181,255,0.05)"/><circle cx="40" cy="80" r="1.2" fill="rgba(212,181,255,0.04)"/><circle cx="90" cy="15" r="0.6" fill="rgba(212,181,255,0.07)"/><circle cx="10" cy="60" r="0.7" fill="rgba(212,181,255,0.04)"/><circle cx="60" cy="90" r="0.5" fill="rgba(212,181,255,0.05)"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="km-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#b388ff" stop-opacity="0.25"/>
              <stop offset="70%" stop-color="#b388ff" stop-opacity="0.06"/>
              <stop offset="100%" stop-color="#b388ff" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="km-moon" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#e0d0ff"/>
              <stop offset="100%" stop-color="#9966dd"/>
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="72" fill="url(#km-glow)"/>
          <circle cx="80" cy="80" r="56" stroke="#b388ff" stroke-width="0.8" fill="none" opacity="0.12"/>
          <!-- Crescent moon -->
          <circle cx="75" cy="75" r="34" fill="url(#km-moon)" opacity="0.85"/>
          <circle cx="90" cy="65" r="28" fill="#0d0816"/>
          <!-- Moon surface details -->
          <circle cx="62" cy="68" r="4" fill="#9966dd" opacity="0.15"/>
          <circle cx="70" cy="88" r="6" fill="#9966dd" opacity="0.1"/>
          <circle cx="58" cy="82" r="3" fill="#9966dd" opacity="0.12"/>
          <!-- Stars -->
          <circle cx="115" cy="42" r="2" fill="#e0d0ff" opacity="0.7"/>
          <circle cx="108" cy="55" r="1" fill="#d4b5ff" opacity="0.5"/>
          <circle cx="120" cy="65" r="1.3" fill="#e0d0ff" opacity="0.4"/>
          <circle cx="105" cy="100" r="1.5" fill="#d4b5ff" opacity="0.5"/>
          <circle cx="115" cy="88" r="0.8" fill="#e0d0ff" opacity="0.6"/>
          <circle cx="45" cy="42" r="1" fill="#d4b5ff" opacity="0.35"/>
          <circle cx="52" cy="110" r="1.2" fill="#e0d0ff" opacity="0.3"/>
          <!-- Subtle moon glow ring -->
          <circle cx="75" cy="75" r="38" stroke="#e0d0ff" stroke-width="0.5" fill="none" opacity="0.15"/>
        </svg>`;
      },
    },

    'Qwen/Qwen3-Coder-480B-A35B-Instruct': {
      name: 'Qwen3-Coder-480B',
      shortName: 'Q3Coder',
      title: 'THE CODER',
      accent: '#7c4dff',
      accentBright: '#a47aff',
      accentDim: '#5530bb',
      secondary: '#d1c4ff',
      bg: [
        'radial-gradient(ellipse at 50% 30%, rgba(124,77,255,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 65% 75%, rgba(209,196,255,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #0a0614 0%, #100c20 35%, #0c0818 70%, #06040e 100%)',
      ].join(', '),
      patternSVG: `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><text x="5" y="20" font-family="monospace" font-size="7" fill="rgba(124,77,255,0.04)">{ }</text><text x="30" y="50" font-family="monospace" font-size="7" fill="rgba(124,77,255,0.03)">//</text></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(124,77,255,0.12)"/>
          <circle cx="80" cy="80" r="56" stroke="#7c4dff" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Code brackets -->
          <text x="42" y="95" font-family="monospace" font-size="52" font-weight="bold" fill="#7c4dff" opacity="0.7">&lt;</text>
          <text x="98" y="95" font-family="monospace" font-size="52" font-weight="bold" fill="#a47aff" opacity="0.6">/&gt;</text>
          <!-- Code lines -->
          <line x1="62" y1="55" x2="98" y2="55" stroke="#d1c4ff" stroke-width="1.5" opacity="0.2"/>
          <line x1="68" y1="62" x2="92" y2="62" stroke="#7c4dff" stroke-width="1" opacity="0.15"/>
          <line x1="62" y1="105" x2="98" y2="105" stroke="#d1c4ff" stroke-width="1.5" opacity="0.2"/>
          <line x1="68" y1="98" x2="92" y2="98" stroke="#7c4dff" stroke-width="1" opacity="0.15"/>
          <!-- Cursor blink -->
          <rect x="78" y="72" width="2" height="16" fill="#a47aff" opacity="0.5"/>
        </svg>`;
      },
    },

    'Qwen/Qwen2.5-72B-Instruct': {
      name: 'Qwen2.5-72B',
      shortName: 'Q2.5-72B',
      title: 'THE SAGE',
      accent: '#3366ff',
      accentBright: '#5588ff',
      accentDim: '#2244aa',
      secondary: '#88aaff',
      bg: [
        'radial-gradient(ellipse at 50% 35%, rgba(51,102,255,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 35% 70%, rgba(136,170,255,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #040814 0%, #080e20 35%, #060a18 70%, #03060e 100%)',
      ].join(', '),
      patternSVG: `<svg width="70" height="70" xmlns="http://www.w3.org/2000/svg"><circle cx="35" cy="35" r="25" stroke="rgba(51,102,255,0.025)" fill="none"/><circle cx="35" cy="35" r="12" stroke="rgba(51,102,255,0.03)" fill="none"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(51,102,255,0.1)"/>
          <circle cx="80" cy="80" r="56" stroke="#3366ff" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Wisdom scroll -->
          <rect x="52" y="40" width="56" height="80" rx="4" fill="#3366ff" opacity="0.15" stroke="#3366ff" stroke-width="1.2" opacity="0.3"/>
          <!-- Scroll rolls top/bottom -->
          <ellipse cx="80" cy="40" rx="30" ry="5" fill="#5588ff" opacity="0.3"/>
          <ellipse cx="80" cy="120" rx="30" ry="5" fill="#5588ff" opacity="0.3"/>
          <!-- Text lines -->
          <line x1="60" y1="55" x2="100" y2="55" stroke="#88aaff" stroke-width="1.5" opacity="0.3"/>
          <line x1="60" y1="65" x2="95" y2="65" stroke="#88aaff" stroke-width="1" opacity="0.2"/>
          <line x1="60" y1="75" x2="100" y2="75" stroke="#88aaff" stroke-width="1.5" opacity="0.3"/>
          <line x1="60" y1="85" x2="90" y2="85" stroke="#88aaff" stroke-width="1" opacity="0.2"/>
          <line x1="60" y1="95" x2="100" y2="95" stroke="#88aaff" stroke-width="1.5" opacity="0.3"/>
          <line x1="60" y1="105" x2="88" y2="105" stroke="#88aaff" stroke-width="1" opacity="0.2"/>
          <!-- Seal -->
          <circle cx="92" cy="108" r="6" fill="#3366ff" opacity="0.4"/>
          <circle cx="92" cy="108" r="3" fill="#88aaff" opacity="0.3"/>
        </svg>`;
      },
    },

    'Qwen/Qwen2.5-32B-Instruct': {
      name: 'Qwen2.5-32B',
      shortName: 'Q2.5-32B',
      title: 'THE SWIFT',
      accent: '#2299dd',
      accentBright: '#44bbff',
      accentDim: '#1166aa',
      secondary: '#77ccee',
      bg: [
        'radial-gradient(ellipse at 55% 30%, rgba(34,153,221,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 40% 75%, rgba(119,204,238,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #040c14 0%, #081420 35%, #060e18 70%, #03080e 100%)',
      ].join(', '),
      patternSVG: `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><path d="M10 30 Q30 20 50 30" stroke="rgba(34,153,221,0.03)" fill="none"/><path d="M10 50 Q30 40 50 50" stroke="rgba(34,153,221,0.025)" fill="none"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(34,153,221,0.1)"/>
          <circle cx="80" cy="80" r="56" stroke="#2299dd" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Swift bird silhouette -->
          <path d="M30 80 Q50 55 80 60 Q95 40 120 35 Q100 55 105 65 Q130 70 135 80 Q105 75 95 80 Q100 100 90 120 Q85 95 80 85 Q60 95 35 130 Q55 100 60 85 Q40 85 30 80Z" fill="#2299dd" opacity="0.7"/>
          <!-- Wing highlight -->
          <path d="M60 75 Q80 62 105 65 Q95 72 75 78Z" fill="#44bbff" opacity="0.3"/>
          <!-- Eye -->
          <circle cx="90" cy="62" r="2.5" fill="#77ccee" opacity="0.9"/>
          <circle cx="90" cy="62" r="1" fill="#040c14"/>
        </svg>`;
      },
    },

    'Qwen/Qwen3-32B': {
      name: 'Qwen3-32B',
      shortName: 'Q3-32B',
      title: 'THE FALCON',
      accent: '#ff6b35',
      accentBright: '#ff8d5a',
      accentDim: '#cc5429',
      secondary: '#ffb380',
      bg: [
        'radial-gradient(ellipse at 50% 35%, rgba(255,107,53,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 35% 70%, rgba(255,179,128,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #140a04 0%, #1e1208 35%, #160e05 70%, #0d0603 100%)',
      ].join(', '),
      patternSVG: `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><path d="M10 30 Q30 15 50 30" stroke="rgba(255,107,53,0.03)" fill="none"/><path d="M10 50 Q30 35 50 50" stroke="rgba(255,107,53,0.025)" fill="none"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(255,107,53,0.1)"/>
          <circle cx="80" cy="80" r="56" stroke="#ff6b35" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Falcon silhouette -->
          <path d="M60 55 L70 45 L100 55 L95 65 L110 60 L115 70 L105 75 L115 85 L100 80 L90 90 L85 120 L65 120 L70 90 L60 80 L55 90 L60 100 L50 95 L55 85 L50 90 L50 100 L42 95 L48 85 L43 90 L45 80 L35 75 L45 70 L40 75 L40 65 L50 60 L55 55 Z" fill="#ff6b35" opacity="0.7"/>
          <!-- Eye -->
          <circle cx="75" cy="58" r="2" fill="#ffb380" opacity="0.9"/>
          <circle cx="75" cy="58" r="0.8" fill="#140a04"/>
          <!-- Wing details -->
          <path d="M60 80 Q75 85 90 90 Q80 95 70 90 Z" fill="#ff8d5a" opacity="0.3"/>
        </svg>`;
      },
    },

    'Qwen/Qwen3-Next-80B-A3B-Instruct': {
      name: 'Qwen3-Next-80B',
      shortName: 'Q3-Next',
      title: 'THE GRAND',
      accent: '#9944ff',
      accentBright: '#bb66ff',
      accentDim: '#7722dd',
      secondary: '#cc99ff',
      bg: [
        'radial-gradient(ellipse at 50% 30%, rgba(153,68,255,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 65% 75%, rgba(204,153,255,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #0a0414 0%, #100820 35%, #0c0618 70%, #06030e 100%)',
      ].join(', '),
      patternSVG: `<svg width="70" height="70" xmlns="http://www.w3.org/2000/svg"><circle cx="35" cy="35" r="25" stroke="rgba(153,68,255,0.025)" fill="none"/><circle cx="35" cy="35" r="12" stroke="rgba(153,68,255,0.03)" fill="none"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(153,68,255,0.1)"/>
          <circle cx="80" cy="80" r="56" stroke="#9944ff" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Grand throne -->
          <rect x="45" y="55" width="70" height="50" fill="#9944ff" opacity="0.3"/>
          <rect x="40" y="50" width="80" height="10" rx="2" fill="#bb66ff" opacity="0.5"/>
          <rect x="35" y="45" width="90" height="8" rx="2" fill="#9944ff" opacity="0.4"/>
          <rect x="45" y="103" width="70" height="10" rx="2" fill="#bb66ff" opacity="0.5"/>
          <rect x="50" y="111" width="60" height="8" rx="2" fill="#9944ff" opacity="0.4"/>
          <!-- Backrest pillars -->
          <rect x="55" y="35" width="8" height="25" fill="#bb66ff" opacity="0.4"/>
          <rect x="97" y="35" width="8" height="25" fill="#bb66ff" opacity="0.4"/>
          <!-- Seat cushion -->
          <ellipse cx="80" cy="75" rx="25" ry="10" fill="#cc99ff" opacity="0.3"/>
          <!-- Next numeral -->
          <text x="80" y="90" text-anchor="middle" font-family="serif" font-size="28" font-weight="bold" fill="#cc99ff" opacity="0.5">Ⅲ</text>
        </svg>`;
      },
    },

    'nousresearch/Hermes-4.3-36B': {
      name: 'Hermes-4.3-36B',
      shortName: 'Hermes',
      title: 'THE MESSENGER',
      accent: '#f59e0b',
      accentBright: '#fbbf24',
      accentDim: '#d97706',
      secondary: '#fcd34d',
      bg: [
        'radial-gradient(ellipse at 55% 30%, rgba(245,158,11,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 40% 75%, rgba(252,211,77,0.05) 0%, transparent 35%)',
        'linear-gradient(180deg, #140d04 0%, #1e1608 35%, #161005 70%, #0d0a03 100%)',
      ].join(', '),
      patternSVG: `<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><path d="M10 30 Q30 20 50 30" stroke="rgba(245,158,11,0.03)" fill="none"/><circle cx="20" cy="55" r="1" fill="rgba(245,158,11,0.02)"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(245,158,11,0.1)"/>
          <circle cx="80" cy="80" r="56" stroke="#f59e0b" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Winged sandals -->
          <ellipse cx="55" cy="115" rx="18" ry="8" fill="#f59e0b" opacity="0.6"/>
          <ellipse cx="105" cy="115" rx="18" ry="8" fill="#f59e0b" opacity="0.6"/>
          <!-- Wings -->
          <path d="M40 115 Q25 100 30 85 Q35 95 40 105 Z" fill="#fbbf24" opacity="0.5"/>
          <path d="M120 115 Q135 100 130 85 Q125 95 120 105 Z" fill="#fbbf24" opacity="0.5"/>
          <!-- Body/wand hint -->
          <line x1="74" y1="70" x2="86" y2="130" stroke="#fcd34d" stroke-width="3" opacity="0.4"/>
          <circle cx="80" cy="65" r="6" fill="#fcd34d" opacity="0.5"/>
          <circle cx="80" cy="65" r="3" fill="#f59e0b" opacity="0.6"/>
          <!-- Trail -->
          <path d="M80 50 Q70 40 60 35 Q75 38 85 35 Q90 42 80 50Z" fill="#fbbf24" opacity="0.3"/>
          <!-- Hermes reference -->
          <text x="80" y="145" text-anchor="middle" font-family="serif" font-size="8" fill="#f59e0b" opacity="0.4">4.3</text>
        </svg>`;
      },
    },

    'Qwen/Qwen2.5-32B-Instruct': {
      name: 'Qwen2-72B',
      shortName: 'Qwen2',
      title: 'THE ANCIENT',
      accent: '#4433aa',
      accentBright: '#6655cc',
      accentDim: '#332277',
      secondary: '#9988dd',
      bg: [
        'radial-gradient(ellipse at 50% 35%, rgba(68,51,170,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 60% 75%, rgba(153,136,221,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #080614 0%, #0e0a20 35%, #0a0818 70%, #05040e 100%)',
      ].join(', '),
      patternSVG: `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="40" height="40" stroke="rgba(68,51,170,0.025)" fill="none" transform="rotate(45 40 40)"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(68,51,170,0.1)"/>
          <circle cx="80" cy="80" r="56" stroke="#4433aa" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Ancient pillar -->
          <rect x="65" y="45" width="30" height="70" fill="#4433aa" opacity="0.3"/>
          <!-- Capital (top decoration) -->
          <rect x="58" y="40" width="44" height="8" rx="2" fill="#6655cc" opacity="0.5"/>
          <rect x="55" y="36" width="50" height="6" rx="2" fill="#6655cc" opacity="0.4"/>
          <!-- Base -->
          <rect x="58" y="113" width="44" height="8" rx="2" fill="#6655cc" opacity="0.5"/>
          <rect x="55" y="119" width="50" height="6" rx="2" fill="#6655cc" opacity="0.4"/>
          <!-- Column lines -->
          <line x1="72" y1="48" x2="72" y2="113" stroke="#9988dd" stroke-width="0.8" opacity="0.2"/>
          <line x1="80" y1="48" x2="80" y2="113" stroke="#9988dd" stroke-width="0.8" opacity="0.25"/>
          <line x1="88" y1="48" x2="88" y2="113" stroke="#9988dd" stroke-width="0.8" opacity="0.2"/>
          <!-- Numeral -->
          <text x="80" y="90" text-anchor="middle" font-family="serif" font-size="24" font-weight="bold" fill="#9988dd" opacity="0.5">II</text>
        </svg>`;
      },
    },

    'chutesai/Mistral-Small-3.2-24B-Instruct-2506': {
      name: 'Mistral-Small-3.2',
      shortName: 'Mistral',
      title: 'THE WIND',
      accent: '#8899bb',
      accentBright: '#aabbdd',
      accentDim: '#556688',
      secondary: '#ccddf0',
      bg: [
        'radial-gradient(ellipse at 50% 30%, rgba(136,153,187,0.1) 0%, transparent 55%)',
        'radial-gradient(ellipse at 60% 75%, rgba(204,221,240,0.05) 0%, transparent 40%)',
        'linear-gradient(180deg, #0a0c10 0%, #10141c 35%, #0c1018 70%, #06080e 100%)',
      ].join(', '),
      patternSVG: `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><path d="M0 40 Q20 30 40 40 Q60 50 80 40" stroke="rgba(136,153,187,0.03)" fill="none"/><path d="M0 60 Q20 50 40 60 Q60 70 80 60" stroke="rgba(136,153,187,0.02)" fill="none"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(136,153,187,0.08)"/>
          <circle cx="80" cy="80" r="56" stroke="#8899bb" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Wind swirls -->
          <path d="M30 60 Q55 45 80 55 Q105 65 130 50" stroke="#8899bb" stroke-width="2.5" fill="none" opacity="0.5" stroke-linecap="round"/>
          <path d="M25 80 Q50 68 80 78 Q110 88 140 72" stroke="#aabbdd" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/>
          <path d="M35 100 Q58 88 80 95 Q102 102 125 90" stroke="#8899bb" stroke-width="1.5" fill="none" opacity="0.35" stroke-linecap="round"/>
          <!-- Spiral accent -->
          <path d="M105 45 Q115 42 118 50 Q121 58 112 60 Q103 62 100 54 Q98 48 105 45" stroke="#ccddf0" stroke-width="1" fill="none" opacity="0.4"/>
          <!-- Small wind dots -->
          <circle cx="130" cy="50" r="2" fill="#aabbdd" opacity="0.4"/>
          <circle cx="140" cy="72" r="1.5" fill="#aabbdd" opacity="0.35"/>
          <circle cx="125" cy="90" r="1.5" fill="#8899bb" opacity="0.3"/>
          <circle cx="25" cy="80" r="1.5" fill="#8899bb" opacity="0.3"/>
        </svg>`;
      },
    },

    'dphn/Dolphin-Mistral-24B-Venice-Edition': {
      name: 'Dolphin-Mistral-24B',
      shortName: 'Dolphin',
      title: 'THE DOLPHIN',
      accent: '#20b2aa',
      accentBright: '#48d1cc',
      accentDim: '#148880',
      secondary: '#7fffd4',
      bg: [
        'radial-gradient(ellipse at 50% 35%, rgba(32,178,170,0.12) 0%, transparent 55%)',
        'radial-gradient(ellipse at 65% 70%, rgba(127,255,212,0.06) 0%, transparent 40%)',
        'linear-gradient(180deg, #041210 0%, #081e1c 35%, #061816 70%, #030e0d 100%)',
      ].join(', '),
      patternSVG: `<svg width="80" height="80" xmlns="http://www.w3.org/2000/svg"><path d="M10 50 Q40 30 70 50" stroke="rgba(32,178,170,0.03)" fill="none"/><circle cx="20" cy="65" r="1" fill="rgba(32,178,170,0.03)"/><circle cx="60" cy="35" r="1.2" fill="rgba(32,178,170,0.025)"/></svg>`,
      character() {
        return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="80" cy="80" r="72" fill="rgba(32,178,170,0.1)"/>
          <circle cx="80" cy="80" r="56" stroke="#20b2aa" stroke-width="1" fill="none" opacity="0.15"/>
          <!-- Dolphin body -->
          <path d="M40 85 Q45 60 70 55 Q85 52 95 58 Q110 48 115 42 Q108 55 100 60 Q115 68 120 85 Q115 100 95 105 Q80 108 65 100 Q50 95 40 85Z" fill="#20b2aa" opacity="0.7"/>
          <!-- Belly -->
          <path d="M55 88 Q65 95 85 98 Q100 95 110 88 Q100 100 80 102 Q60 100 55 88Z" fill="#48d1cc" opacity="0.3"/>
          <!-- Dorsal fin -->
          <path d="M75 55 Q78 38 85 35 Q82 48 85 52" fill="#148880" opacity="0.6"/>
          <!-- Tail -->
          <path d="M40 85 Q32 78 25 72 Q35 80 38 82" fill="#20b2aa" opacity="0.6"/>
          <path d="M40 85 Q32 92 25 98 Q35 90 38 88" fill="#20b2aa" opacity="0.5"/>
          <!-- Eye -->
          <circle cx="95" cy="62" r="3.5" fill="#7fffd4" opacity="0.9"/>
          <circle cx="95" cy="62" r="1.5" fill="#041210"/>
          <!-- Mouth line -->
          <path d="M105 68 Q112 72 118 75" stroke="#148880" stroke-width="1" fill="none" opacity="0.5"/>
          <!-- Smile -->
          <path d="M100 70 Q108 72 114 70" stroke="#48d1cc" stroke-width="0.8" fill="none" opacity="0.3"/>
          <!-- Water splashes -->
          <circle cx="35" cy="75" r="1.5" fill="#7fffd4" opacity="0.3"/>
          <circle cx="30" cy="95" r="1" fill="#48d1cc" opacity="0.25"/>
          <circle cx="125" cy="78" r="1.2" fill="#7fffd4" opacity="0.3"/>
        </svg>`;
      }
    }
  };

  const imageFolders = {
    'unsloth/gemma-3-27b-it': 'gemma',
    'moonshotai/Kimi-K2-Instruct': 'kimi',
    'Qwen/Qwen3-Coder-480B-A35B-Instruct': 'qwen',
    'Qwen/Qwen2.5-72B-Instruct': 'qwen',
    'Qwen/Qwen2.5-32B-Instruct': 'qwen',
    'Qwen/Qwen3-32B': 'qwen',
    'Qwen/Qwen3-Next-80B-A3B-Instruct': 'qwen',
    'nousresearch/Hermes-4.3-36B': 'qwen',
    'chutesai/Mistral-Small-3.2-24B-Instruct-2506': 'mistral',
    'deepseek/DeepSeek-V3-base': 'deepseek',
    'THUDM/GLM-4-32B': 'glm',
    'minimax/MiniMax-M2.1-8B-Instruct': 'minimax'
  };

  const modelAliases = {
    'qwen/qwen3.5-397b-a17b': 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    'minimaxai/minimax-m2.5': 'Qwen/Qwen3-32B',
    'nvidia/nemotron-3-super-120b-a12b': 'Qwen/Qwen2.5-72B-Instruct',
    'mistralai/mistral-small-4-119b-2603': 'chutesai/Mistral-Small-3.2-24B-Instruct-2506',
    'z-ai/glm5': 'THUDM/GLM-4-32B',
    'moonshotai/kimi-k2.5': 'moonshotai/Kimi-K2-Instruct',
    'google/gemma-2-27b-it': 'unsloth/gemma-3-27b-it',
    'moonshotai/kimi-k2-instruct': 'moonshotai/Kimi-K2-Instruct',
    'qwen/qwen3-next-80b-a3b-instruct': 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    'mistralai/mistral-small-24b-instruct': 'chutesai/Mistral-Small-3.2-24B-Instruct-2506',
    'deepseek-ai/deepseek-v3.2': 'deepseek/DeepSeek-V3-base',
    'z-ai/glm4.7': 'THUDM/GLM-4-32B',
    'NousResearch/Hermes-4.3-36B': 'nousresearch/Hermes-4.3-36B',
  };

  function resolveModelId(modelId) {
    return modelAliases[modelId] || modelId;
  }

  const HUMAN_MODEL_ID = 'human/player';
  const humanTheme = {
    name: 'You',
    shortName: 'You',
    title: 'THE PLAYER',
    accent: '#111111',
    accentBright: '#444444',
    accentDim: '#666666',
    secondary: '#d4d4d4',
    bg: [
      'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.08) 0%, transparent 52%)',
      'linear-gradient(180deg, #f7f7f7 0%, #ededed 50%, #f7f7f7 100%)',
    ].join(', '),
    patternSVG: '',
    character() {
      return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="72" fill="rgba(0,0,0,0.04)"/>
        <circle cx="80" cy="58" r="22" stroke="#111111" stroke-width="3" fill="white"/>
        <path d="M42 124C48 98 62 84 80 84C98 84 112 98 118 124" stroke="#111111" stroke-width="3" fill="white"/>
        <circle cx="72" cy="54" r="3" fill="#111111"/>
        <circle cx="88" cy="54" r="3" fill="#111111"/>
        <path d="M72 66C75 69 85 69 88 66" stroke="#111111" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
    },
  };

  function getCharacterImageForState(modelId, state, cacheBust = null) {
    if (resolveModelId(modelId) === HUMAN_MODEL_ID) {
      return humanTheme.character();
    }

    const folder = imageFolders[resolveModelId(modelId)] || 'mistral';
    
    const isMinimax = folder === 'minimax';
    
    const stateFileMap = {
      'default': 'default',
      'judged': 'judged',
      'judging': 'judging',
      'lose': 'lose',
      'thinking': isMinimax ? 'hand-raised' : 'raising-hand',
      'safe-lie': 'safe-lie',
      'safe-truth': state === 'safe-truth' && folder === 'deepseek' ? 'safe-true' : 'safe-truth',
      'win': 'win'
    };
    
    const fileName = stateFileMap[state] || 'default';
    const cacheParam = cacheBust ? `?t=${cacheBust}` : '';
    const imagePath = `/images/${folder}/llms_${folder}_${fileName}.png${cacheParam}`;
    return `<img src="${imagePath}" alt="character" class="character-state-image" />`;
  }

  // Fallback theme for unknown models
  const defaultTheme = {
    name: 'Unknown',
    shortName: '???',
    title: 'THE UNKNOWN',
    accent: '#9a9ab0',
    accentBright: '#c8c8d8',
    accentDim: '#606076',
    secondary: '#d4d4e4',
    bg: [
      'radial-gradient(ellipse at 50% 30%, rgba(160,160,180,0.06) 0%, transparent 50%)',
      'linear-gradient(180deg, #0c0c0f 0%, #101014 50%, #0c0c0f 100%)',
    ].join(', '),
    patternSVG: '',
    character() {
      return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="uk-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#9a9ab0" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#9a9ab0" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="80" cy="80" r="72" fill="url(#uk-glow)"/>
        <circle cx="80" cy="80" r="40" stroke="#9a9ab0" stroke-width="1.5" fill="none" opacity="0.2"/>
        <text x="80" y="88" text-anchor="middle" font-family="monospace" font-size="28" fill="#9a9ab0" opacity="0.6">?</text>
      </svg>`;
    },
      
  };

  return {
    getTheme(modelId) {
      if (resolveModelId(modelId) === HUMAN_MODEL_ID) {
        return humanTheme;
      }
      return themes[resolveModelId(modelId)] || defaultTheme;
    },
    getDefault() {
      return defaultTheme;
    },
    getCharacterImage(modelId, state, cacheBust) {
      // Direct call to function - themes don't need characterImageForState
      return getCharacterImageForState(modelId, state, cacheBust);
    },
    getThumbnail(modelId) {
      if (resolveModelId(modelId) === HUMAN_MODEL_ID) {
        return 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="white" stroke="black" stroke-width="4"/><text x="32" y="39" text-anchor="middle" font-family="monospace" font-size="18" font-weight="700" fill="black">YOU</text></svg>');
      }
      const folder = imageFolders[resolveModelId(modelId)] || 'mistral';
      return `/images/${folder}/llms_${folder}_default.png`;
    },
    getFolder(modelId) {
      return imageFolders[resolveModelId(modelId)] || 'mistral';
    }
  };
})();
