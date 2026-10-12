export type ProviderType = 'deepseek' | 'volcengine' | 'minimax' | 'gemini';

export interface ProviderConfig {
  id: ProviderType;
  name: string;
  category: 'text' | 'image' | 'voice' | 'all';
  enabled: boolean;
  apiKeyMasked: string; // e.g. "sk-...ab12"
  hasApiKey: boolean;
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  parameters: Record<string, any>;
  lastTestStatus?: 'idle' | 'success' | 'failed';
  lastTestMessage?: string;
  lastTestedAt?: number;
}

export interface RuntimeConfig {
  version: number;
  activeTextProvider: ProviderType;
  activeTextModel: string;
  fallbackTextProvider?: ProviderType;
  fallbackTextModel?: string;
  enableFallbackText: boolean;

  activeImageProvider: ProviderType;
  activeImageModel: string;
  fallbackImageProvider?: ProviderType;
  fallbackImageModel?: string;
  enableFallbackImage: boolean;

  activeVoiceProvider: ProviderType;
  activeVoiceModel: string;
  fallbackVoiceProvider?: ProviderType;
  fallbackVoiceModel?: string;
  enableFallbackVoice: boolean;

  providers: Record<ProviderType, ProviderConfig>;
  textParams: {
    temperature: number;
    maxTokens: number;
    topP: number;
    stream: boolean;
  };
  imageParams: {
    aspectRatio: string;
    width: number;
    height: number;
    stylePreset: string;
  };
  voiceParams: {
    voiceId: string;
    speed: number;
    pitch: number;
    volume: number;
    format: string;
    emotion: string;
  };
}

export interface InvocationLog {
  id: string;
  timestamp: number;
  category: 'text' | 'image' | 'voice';
  action: string;
  provider: ProviderType;
  model: string;
  status: 'success' | 'failed' | 'fallback_triggered';
  durationMs: number;
  fallbackUsed?: boolean;
  fallbackProvider?: ProviderType;
  fallbackModel?: string;
  promptSnippet?: string;
  resultSnippet?: string;
  error?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  testedModel: string;
}
