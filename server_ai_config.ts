import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

const DATA_DIR = path.resolve('/tmp/novel_ai_config');
const ENCRYPTED_CONFIG_FILE = path.join(DATA_DIR, 'ai_settings.enc.json');
const LOGS_FILE = path.join(DATA_DIR, 'ai_invocations.json');

// Derive encryption key from SERVER_SECRET or machine-unique salt
const SERVER_SECRET = process.env.AI_CONFIG_SECRET || 'aistudio_novel2video_vault_key_2026';
const ENCRYPTION_SALT = 'novel_ai_manager_salt_v1';
const CIPHER_KEY = crypto.scryptSync(SERVER_SECRET, ENCRYPTION_SALT, 32);

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', CIPHER_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(cipherText: string): string {
  const parts = cipherText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', CIPHER_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Memory cache of encrypted secrets: apiKey plaintexts are NEVER exposed over API
const plainApiKeyCache: Record<ProviderType, string> = {
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  volcengine: process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || '',
  minimax: process.env.MINIMAX_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || '',
};

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key ? '******' : '';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  version: 1,
  activeTextProvider: 'deepseek',
  activeTextModel: 'deepseek-flash',
  fallbackTextProvider: 'gemini',
  fallbackTextModel: 'gemini-3.8-flash',
  enableFallbackText: true,

  activeImageProvider: 'volcengine',
  activeImageModel: 'doubao-seedream-5-0-flash-260915',
  fallbackImageProvider: 'gemini',
  fallbackImageModel: 'gemini-3.1-flash-lite-image',
  enableFallbackImage: true,

  activeVoiceProvider: 'minimax',
  activeVoiceModel: 'speech-2.8-hd',
  fallbackVoiceProvider: 'gemini',
  fallbackVoiceModel: 'gemini-3.8-flash-lite-tts',
  enableFallbackVoice: true,

  providers: {
    deepseek: {
      id: 'deepseek',
      name: 'DeepSeek',
      category: 'text',
      enabled: true,
      apiKeyMasked: maskApiKey(plainApiKeyCache.deepseek),
      hasApiKey: !!plainApiKeyCache.deepseek,
      baseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-flash',
      availableModels: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
      parameters: {
        temperature: 0.7,
        max_tokens: 8192,
        top_p: 0.95,
        thinking_mode: 'disabled',
        reasoning_effort: 'low',
      },
    },
    volcengine: {
      id: 'volcengine',
      name: '火山引擎 Ark',
      category: 'image',
      enabled: true,
      apiKeyMasked: maskApiKey(plainApiKeyCache.volcengine),
      hasApiKey: !!plainApiKeyCache.volcengine,
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      defaultModel: 'doubao-seedream-5-0-flash-260915',
      availableModels: [
        'doubao-seedream-5-0-flash-260915',
        'doubao-seedream-4-5-251128',
        'doubao-seedream-4-0-241215',
      ],
      parameters: {
        width: 1080,
        height: 1920,
        aspect_ratio: '9:16',
      },
    },
    minimax: {
      id: 'minimax',
      name: 'MiniMax Speech',
      category: 'voice',
      enabled: true,
      apiKeyMasked: maskApiKey(plainApiKeyCache.minimax),
      hasApiKey: !!plainApiKeyCache.minimax,
      baseUrl: 'https://api.minimax.cn/v1',
      defaultModel: 'speech-2.8-hd',
      availableModels: ['speech-2.8-hd', 'speech-02-turbo', 'speech-01-hd'],
      parameters: {
        voice_id: 'female-yujie',
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
        audio_format: 'wav',
      },
    },
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      category: 'all',
      enabled: true,
      apiKeyMasked: maskApiKey(plainApiKeyCache.gemini),
      hasApiKey: !!plainApiKeyCache.gemini,
      baseUrl: 'https://generativelanguage.googleapis.com',
      defaultModel: 'gemini-3.8-flash',
      availableModels: [
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite-image',
        'gemini-3.8-flash-lite-tts',
      ],
      parameters: {
        temperature: 0.7,
      },
    },
  },
  textParams: {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.95,
    stream: false,
  },
  imageParams: {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    stylePreset: 'cinematic_illustration',
  },
  voiceParams: {
    voiceId: 'female-yujie',
    speed: 1.0,
    pitch: 0,
    volume: 1.0,
    format: 'wav',
    emotion: 'neutral',
  },
};

let currentConfig: RuntimeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let invocationLogs: InvocationLog[] = [];

// Initialize data directory and load existing encrypted store if present
export function initAiConfigStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(ENCRYPTED_CONFIG_FILE)) {
      const rawEnc = fs.readFileSync(ENCRYPTED_CONFIG_FILE, 'utf-8');
      const decryptedStr = decrypt(rawEnc);
      const parsed = JSON.parse(decryptedStr);
      
      // Load saved api keys into plain cache
      if (parsed.secretKeys) {
        for (const [pId, key] of Object.entries(parsed.secretKeys)) {
          if (key && typeof key === 'string') {
            plainApiKeyCache[pId as ProviderType] = key;
          }
        }
      }

      if (parsed.config) {
        const parsedProviders = parsed.config.providers || {};
        const safeProviders: Record<ProviderType, any> = { ...DEFAULT_CONFIG.providers };
        for (const pId of Object.keys(DEFAULT_CONFIG.providers) as ProviderType[]) {
          safeProviders[pId] = {
            ...DEFAULT_CONFIG.providers[pId],
            ...(parsedProviders[pId] || {}),
            enabled: parsedProviders[pId]?.enabled !== undefined ? parsedProviders[pId].enabled : DEFAULT_CONFIG.providers[pId].enabled,
            parameters: {
              ...DEFAULT_CONFIG.providers[pId].parameters,
              ...(parsedProviders[pId]?.parameters || {}),
            },
          };
        }

        currentConfig = {
          ...DEFAULT_CONFIG,
          ...parsed.config,
          providers: safeProviders,
        };

        if (currentConfig.providers?.deepseek) {
          currentConfig.providers.deepseek.availableModels = [
            'deepseek-flash',
            'deepseek-v4-pro',
            'deepseek-chat',
            'deepseek-reasoner',
          ];
          if (!currentConfig.providers.deepseek.parameters?.max_tokens || currentConfig.providers.deepseek.parameters.max_tokens < 8192) {
            currentConfig.providers.deepseek.parameters = {
              ...currentConfig.providers.deepseek.parameters,
              max_tokens: 8192,
              thinking_mode: currentConfig.providers.deepseek.parameters?.thinking_mode || 'disabled',
              reasoning_effort: currentConfig.providers.deepseek.parameters?.reasoning_effort || 'low',
            };
          }
        }
        // Ensure robust text and voice fallbacks are enabled by default
        currentConfig.enableFallbackText = true;
        currentConfig.enableFallbackVoice = true;
        currentConfig.fallbackVoiceProvider = 'gemini';
        currentConfig.fallbackVoiceModel = 'gemini-3.8-flash-lite-tts';

        // Clear bogus test status if key was an invalid placeholder
        if (
          currentConfig.providers?.minimax &&
          currentConfig.providers.minimax.lastTestStatus === 'success' &&
          plainApiKeyCache.minimax?.startsWith('sk-025a')
        ) {
          currentConfig.providers.minimax.lastTestStatus = 'failed';
          currentConfig.providers.minimax.lastTestMessage =
            'MiniMax 鉴权失败 (1004: login fail): API Key 无效或未生效，请更新有效密钥或使用 Gemini 语音';
        }
      }
    }

    if (fs.existsSync(LOGS_FILE)) {
      const rawLogs = fs.readFileSync(LOGS_FILE, 'utf-8');
      invocationLogs = JSON.parse(rawLogs);
    }
  } catch (err: any) {
    console.error('[AI Config Store] Initialization warning (using defaults):', err.message);
  }

  // Refresh masked keys in current config
  for (const pId of Object.keys(currentConfig.providers) as ProviderType[]) {
    const k = plainApiKeyCache[pId] || '';
    currentConfig.providers[pId].hasApiKey = !!k;
    currentConfig.providers[pId].apiKeyMasked = maskApiKey(k);
  }
}

// Persist encrypted config to disk
export function persistAiConfig() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const payloadToEncrypt = {
      secretKeys: plainApiKeyCache,
      config: currentConfig,
      savedAt: Date.now(),
    };

    const encString = encrypt(JSON.stringify(payloadToEncrypt));
    fs.writeFileSync(ENCRYPTED_CONFIG_FILE, encString, 'utf-8');
  } catch (err: any) {
    console.error('[AI Config Store] Persist error:', err.message);
  }
}

export function persistLogs() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Keep last 150 logs in storage
    const trimmed = invocationLogs.slice(-150);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[AI Config Store] Log persist error:', err.message);
  }
}

export function addInvocationLog(log: Omit<InvocationLog, 'id' | 'timestamp'>) {
  const newLog: InvocationLog = {
    ...log,
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
  };
  invocationLogs.unshift(newLog);
  if (invocationLogs.length > 200) {
    invocationLogs = invocationLogs.slice(0, 200);
  }
  persistLogs();
}

export function getSanitizedConfig(): RuntimeConfig {
  // Always return config without sensitive plaintext keys
  const clone: RuntimeConfig = JSON.parse(JSON.stringify(currentConfig));
  for (const pId of Object.keys(clone.providers) as ProviderType[]) {
    clone.providers[pId].hasApiKey = !!plainApiKeyCache[pId];
    clone.providers[pId].apiKeyMasked = maskApiKey(plainApiKeyCache[pId]);
  }
  return clone;
}

export function getPlainApiKey(provider: ProviderType): string {
  return plainApiKeyCache[provider] || '';
}

export function setProviderApiKey(provider: ProviderType, newKey: string) {
  plainApiKeyCache[provider] = newKey.trim();
  currentConfig.providers[provider].hasApiKey = !!plainApiKeyCache[provider];
  currentConfig.providers[provider].apiKeyMasked = maskApiKey(plainApiKeyCache[provider]);
  persistAiConfig();
}

export function deleteProviderApiKey(provider: ProviderType) {
  plainApiKeyCache[provider] = '';
  currentConfig.providers[provider].hasApiKey = false;
  currentConfig.providers[provider].apiKeyMasked = '';
  persistAiConfig();
}

export function updateRuntimeConfig(updates: Partial<RuntimeConfig>) {
  const mergedProviders = { ...currentConfig.providers };
  if (updates.providers) {
    for (const [pKey, pVal] of Object.entries(updates.providers)) {
      if (pVal && typeof pVal === 'object') {
        const existing = mergedProviders[pKey as ProviderType] || DEFAULT_CONFIG.providers[pKey as ProviderType];
        mergedProviders[pKey as ProviderType] = {
          ...existing,
          ...pVal,
          parameters: {
            ...(existing?.parameters || {}),
            ...((pVal as any).parameters || {}),
          },
        };
      }
    }
  }

  currentConfig = {
    ...currentConfig,
    ...updates,
    providers: mergedProviders,
    textParams: {
      ...currentConfig.textParams,
      ...(updates.textParams || {}),
    },
    imageParams: {
      ...currentConfig.imageParams,
      ...(updates.imageParams || {}),
    },
    voiceParams: {
      ...currentConfig.voiceParams,
      ...(updates.voiceParams || {}),
    },
  };
  persistAiConfig();
  return getSanitizedConfig();
}

export function getRecentLogs(): InvocationLog[] {
  return invocationLogs;
}

export function clearLogs() {
  invocationLogs = [];
  persistLogs();
}
