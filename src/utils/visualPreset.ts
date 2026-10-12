// Generates aesthetic 9:16 cinematic SVG illustrations for storyboards
export interface VisualPreset {
  id: string;
  name: string;
  category: string;
  primaryColor: string;
}

export const VISUAL_PRESETS: VisualPreset[] = [
  { id: 'noir_rain', name: '雾夜深渊 (雨夜/悬疑)', category: '悬疑犯罪', primaryColor: '#0f172a' },
  { id: 'luxury_hall', name: '豪门夜宴 (水晶灯/奢华)', category: '豪门情感', primaryColor: '#2d1b09' },
  { id: 'emotional_window', name: '窗边沉思 (冷暖对比/独白)', category: '现实情感', primaryColor: '#1e1b4b' },
  { id: 'confrontation', name: '剑拔弩张 (暗红/戏剧光影)', category: '冲突反转', primaryColor: '#3b0764' },
  { id: 'ancient_mood', name: '烟雨楼阁 (水墨/古风)', category: '古风言情', primaryColor: '#1c1917' },
  { id: 'city_neon', name: '霓虹孤影 (街景/现代都市)', category: '都市职场', primaryColor: '#030712' },
];

export const generateCinematicSceneSVG = (
  presetId: string,
  sceneNumber: number,
  caption: string = '',
  composition: string = '中景'
): string => {
  let bgGradient = '';
  let accentElements = '';

  switch (presetId) {
    case 'luxury_hall':
      bgGradient = `
        <radialGradient id="lux" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#451a03" />
          <stop offset="50%" stop-color="#1c1108" />
          <stop offset="100%" stop-color="#090502" />
        </radialGradient>
      `;
      accentElements = `
        <!-- Chandelier silhouette & golden dust -->
        <g opacity="0.35">
          <circle cx="540" cy="380" r="220" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="10 15" />
          <circle cx="540" cy="380" r="140" fill="none" stroke="#d97706" stroke-width="1.5" />
          <line x1="540" y1="0" x2="540" y2="380" stroke="#f59e0b" stroke-width="3" />
          <polygon points="540,560 380,420 700,420" fill="#b45309" opacity="0.15" />
        </g>
        <rect x="180" y="800" width="720" height="600" rx="16" fill="#000" opacity="0.4" />
      `;
      break;

    case 'emotional_window':
      bgGradient = `
        <linearGradient id="lux" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#172554" />
          <stop offset="60%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#020617" />
        </linearGradient>
      `;
      accentElements = `
        <!-- Window frame silhouette & blue emotional light -->
        <g opacity="0.4">
          <line x1="200" y1="0" x2="200" y2="1920" stroke="#38bdf8" stroke-width="12" />
          <line x1="880" y1="0" x2="880" y2="1920" stroke="#38bdf8" stroke-width="12" />
          <line x1="0" y1="650" x2="1080" y2="650" stroke="#38bdf8" stroke-width="8" />
          <circle cx="540" cy="780" r="320" fill="#0284c7" opacity="0.12" filter="blur(40px)" />
        </g>
      `;
      break;

    case 'confrontation':
      bgGradient = `
        <radialGradient id="lux" cx="50%" cy="50%" r="80%">
          <stop offset="0%" stop-color="#4c0519" />
          <stop offset="45%" stop-color="#1c040d" />
          <stop offset="100%" stop-color="#050103" />
        </radialGradient>
      `;
      accentElements = `
        <!-- Dramatic slash / tension -->
        <g opacity="0.3">
          <polygon points="0,0 1080,1400 1080,1920 0,600" fill="#e11d48" opacity="0.12" />
          <line x1="0" y1="960" x2="1080" y2="960" stroke="#f43f5e" stroke-width="1" stroke-dasharray="20 20" />
        </g>
      `;
      break;

    case 'ancient_mood':
      bgGradient = `
        <linearGradient id="lux" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#1c1917" />
          <stop offset="50%" stop-color="#292524" />
          <stop offset="100%" stop-color="#44403c" />
        </linearGradient>
      `;
      accentElements = `
        <!-- Mountain silhouettes -->
        <path d="M0,1400 Q300,1100 600,1350 T1080,1200 L1080,1920 L0,1920 Z" fill="#0c0a09" opacity="0.6" />
        <path d="M0,1600 Q450,1420 800,1580 T1080,1500 L1080,1920 L0,1920 Z" fill="#000000" opacity="0.85" />
      `;
      break;

    case 'city_neon':
      bgGradient = `
        <linearGradient id="lux" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#18181b" />
          <stop offset="50%" stop-color="#09090b" />
          <stop offset="100%" stop-color="#000000" />
        </linearGradient>
      `;
      accentElements = `
        <!-- Neon bokeh circles -->
        <circle cx="280" cy="460" r="180" fill="#ec4899" opacity="0.15" />
        <circle cx="820" cy="880" r="240" fill="#06b6d4" opacity="0.12" />
        <rect x="140" y="1050" width="800" height="2" fill="#a855f7" opacity="0.3" />
      `;
      break;

    default: // noir_rain
      bgGradient = `
        <linearGradient id="lux" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0b0f19" />
          <stop offset="50%" stop-color="#030712" />
          <stop offset="100%" stop-color="#000000" />
        </linearGradient>
      `;
      accentElements = `
        <!-- Rain streaks & moody street lamp cone -->
        <polygon points="540,100 120,1700 960,1700" fill="#38bdf8" opacity="0.06" />
        <circle cx="540" cy="180" r="70" fill="#e0f2fe" opacity="0.18" />
      `;
      break;
  }

  // Escape caption for SVG XML safe
  const safeCaption = caption
    .slice(0, 40)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
    <defs>
      ${bgGradient}
      <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000" stop-opacity="0.6"/>
        <stop offset="50%" stop-color="#000" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.8"/>
      </linearGradient>
    </defs>
    
    <!-- Background -->
    <rect width="1080" height="1920" fill="url(#lux)" />
    
    ${accentElements}

    <!-- Cinematic Vignette -->
    <rect width="1080" height="1920" fill="url(#vignette)" />

    <!-- Scene Number Tag -->
    <g transform="translate(80, 140)">
      <rect width="210" height="64" rx="32" fill="#000000" opacity="0.65" stroke="#f59e0b" stroke-width="2" />
      <text x="105" y="42" font-family="'Noto Sans SC', sans-serif" font-size="28" font-weight="700" fill="#fbbf24" text-anchor="middle">场景 ${sceneNumber}</text>
    </g>

    <!-- Composition badge -->
    <g transform="translate(820, 140)">
      <rect width="180" height="64" rx="32" fill="#000000" opacity="0.65" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.3" />
      <text x="90" y="42" font-family="'Noto Sans SC', sans-serif" font-size="26" font-weight="500" fill="#cbd5e1" text-anchor="middle">${composition}</text>
    </g>

    <!-- Visual Center Card Frame -->
    <rect x="100" y="600" width="880" height="720" rx="24" fill="#000000" opacity="0.4" stroke="#ffffff" stroke-width="1" stroke-opacity="0.15" />
    
    <!-- Cinematic Crosshair Lines -->
    <line x1="540" y1="560" x2="540" y2="640" stroke="#f59e0b" stroke-width="2" opacity="0.6" />
    <line x1="500" y1="600" x2="580" y2="600" stroke="#f59e0b" stroke-width="2" opacity="0.6" />

    <text x="540" y="860" font-family="'Noto Serif SC', serif" font-size="44" font-weight="700" fill="#f8fafc" text-anchor="middle" letter-spacing="4">
      镜头画面分镜
    </text>

    <!-- Caption Snippet -->
    <text x="540" y="980" font-family="'Noto Sans SC', sans-serif" font-size="32" font-weight="400" fill="#94a3b8" text-anchor="middle" max-width="800">
      ${safeCaption ? `“${safeCaption}”` : '影视电影感构图 · 9:16竖屏'}
    </text>

    <!-- Bottom Notice -->
    <g transform="translate(540, 1580)">
      <text font-family="'Noto Sans SC', sans-serif" font-size="24" fill="#64748b" text-anchor="middle">
        点击分镜卡片可替换为 AI 绘画或本地高精度原画
      </text>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
