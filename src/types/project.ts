export interface Character {
  id: string;
  name: string;
  age: string;
  gender: string;
  hairstyle: string;
  facialFeatures: string;
  clothing: string;
  temperament: string;
  distinctVisuals: string;
}

export interface Scene {
  id: string;
  order: number;
  narration: string;
  visualDescription: string;
  englishPrompt: string;
  characters: string[];
  actions: string;
  environment: string;
  mood: string;
  composition: string;
  duration: number; // seconds
  imageUrl?: string; // base64 or url
  imagePromptCustom?: string;
  imageStatus: 'idle' | 'generating' | 'ready' | 'error';
  imageError?: string;
}

export interface SubtitleItem {
  id: string;
  order: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface SubtitleStyle {
  fontSize: number; // px, default 40
  color: string; // hex, default #FFFFFF
  outlineColor: string; // hex, default #000000
  outlineWidth: number; // px, default 3
  bgMode: 'none' | 'solid' | 'capsule'; // background mode
  bgColor?: string;
  position: 'bottom-safe' | 'bottom-normal' | 'center';
  verticalMargin: number; // pixels from bottom, default 280 (vertical safe margin for Douyin)
}

export interface ScriptState {
  title: string;
  hook: string;
  narration: string;
  estimatedDuration: number;
  emotionArc: string;
  endingHook: string;
  factCheckNotes: string;
  isModifiedByUser: boolean;
  history?: Array<{
    timestamp: number;
    title: string;
    hook: string;
    narration: string;
    note?: string;
  }>;
}

export interface AudioState {
  audioUrl?: string;
  audioBase64?: string;
  fileName?: string;
  duration: number;
  sourceType: 'none' | 'uploaded' | 'tts';
  ttsVoice?: string;
}

export interface NovelState {
  text: string;
  title: string;
  chapter: string;
  sourceFileName?: string;
  wordCount: number;
  targetDuration: number; // 30, 60, 90, 120 seconds
  narrativeStyle: string; // '情绪叙事' | '悬念反转' | '现实情感' | '剧情解说'
  pov: string; // '第一人称' | '第三人称'
  hookStrength: string; // '强钩子' | '自然铺垫'
  adaptationDegree: string; // '适度口语化' | '忠实原文'
  customInstructions: string;
  sourceNovelId?: string; // 关联的长篇小说库 ID
  sourceChapterId?: string; // 关联的章节 ID
  sourceChapterIndex?: number; // 关联的章节编号
  creationMode?: 'direct_text' | 'single_chapter' | 'multi_chapter' | 'chapter_slice';
  includeContextBackground?: boolean; // 是否包含跨章节背景检索
  contextSummary?: string; // 关联上下文概要（前情提要/背景）
}

export interface NovelProject {
  id: string;
  name: string;
  currentStep: number; // 1, 2, 3, 4, 5
  createdAt: number;
  updatedAt: number;
  novel: NovelState;
  script: ScriptState;
  scenes: Scene[];
  characters: Character[];
  audio: AudioState;
  subtitles: SubtitleItem[];
  subtitleStyle: SubtitleStyle;
  exportConfig: {
    applyKenBurns: boolean;
    lastExportUrl?: string;
    lastJobId?: string;
  };
}
