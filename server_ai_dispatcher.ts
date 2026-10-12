import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  ProviderType,
  getSanitizedConfig,
  getPlainApiKey,
  addInvocationLog,
  updateRuntimeConfig,
} from './server_ai_config';

// -------------------------------------------------------------
// HTTP Utilities for DeepSeek, Volcengine Ark & MiniMax Speech
// -------------------------------------------------------------

async function postJson(url: string, headers: Record<string, string>, body: any, timeoutMs = 60000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not json
    }
    if (!res.ok) {
      const errMsg = json?.error?.message || json?.message || json?.base_resp?.status_msg || text || `HTTP ${res.status}`;
      throw new Error(`[${res.status}] ${errMsg}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// -------------------------------------------------------------
// Gemini Client Helper
// -------------------------------------------------------------
export function getGeminiClient(): GoogleGenAI {
  const apiKey = getPlainApiKey('gemini') || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 Gemini API Key，请在 AI 管理中心配置或环境变量中指定');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// -------------------------------------------------------------
// 1. TEXT GENERATION DISPATCHER
// -------------------------------------------------------------
export interface TextGenerateOptions {
  systemInstruction?: string;
  prompt: string;
  responseSchema?: any;
  temperature?: number;
  maxTokens?: number;
}

export async function executeTextGeneration(
  actionName: string,
  options: TextGenerateOptions
): Promise<{ text: string; provider: ProviderType; model: string }> {
  const config = getSanitizedConfig();
  const primaryProvider = config.activeTextProvider;
  const primaryModel = config.activeTextModel;
  const fallbackProvider = config.fallbackTextProvider;
  const fallbackModel = config.fallbackTextModel;
  const fallbackEnabled = config.enableFallbackText && fallbackProvider && fallbackModel;

  const startTime = Date.now();

  // Try Primary Provider
  try {
    const result = await callTextProvider(primaryProvider, primaryModel, options);
    addInvocationLog({
      category: 'text',
      action: actionName,
      provider: primaryProvider,
      model: primaryModel,
      status: 'success',
      durationMs: Date.now() - startTime,
      promptSnippet: options.prompt.slice(0, 120),
      resultSnippet: result.slice(0, 120),
    });
    return { text: result, provider: primaryProvider, model: primaryModel };
  } catch (primaryErr: any) {
    console.error(`[AI Service] Primary text provider (${primaryProvider}/${primaryModel}) failed:`, primaryErr.message);

    // If fallback is explicitly enabled by the user
    if (fallbackEnabled && fallbackProvider) {
      try {
        console.warn(`[AI Service] Triggering fallback text provider (${fallbackProvider}/${fallbackModel})...`);
        const fallbackResult = await callTextProvider(fallbackProvider, fallbackModel, options);
        addInvocationLog({
          category: 'text',
          action: actionName,
          provider: primaryProvider,
          model: primaryModel,
          status: 'fallback_triggered',
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
          fallbackProvider,
          fallbackModel,
          error: `主模型错误: ${primaryErr.message}，已自动降级至备用模型`,
          promptSnippet: options.prompt.slice(0, 120),
          resultSnippet: fallbackResult.slice(0, 120),
        });
        return { text: fallbackResult, provider: fallbackProvider, model: fallbackModel };
      } catch (fallbackErr: any) {
        addInvocationLog({
          category: 'text',
          action: actionName,
          provider: fallbackProvider,
          model: fallbackModel,
          status: 'failed',
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
          error: `主模型与备用模型均失败: ${fallbackErr.message}`,
        });
        throw new Error(`主模型与备用模型均调用失败: [${primaryProvider}] ${primaryErr.message} | [${fallbackProvider}] ${fallbackErr.message}`);
      }
    }

    addInvocationLog({
      category: 'text',
      action: actionName,
      provider: primaryProvider,
      model: primaryModel,
      status: 'failed',
      durationMs: Date.now() - startTime,
      error: primaryErr.message,
      promptSnippet: options.prompt.slice(0, 120),
    });
    throw primaryErr;
  }
}

async function callTextProvider(
  provider: ProviderType,
  model: string,
  options: TextGenerateOptions
): Promise<string> {
  const config = getSanitizedConfig();
  const providerMeta = config.providers[provider];

  if (!providerMeta || !providerMeta.enabled) {
    throw new Error(`服务商 ${provider} 处于停用状态，请在 AI 管理中心启用`);
  }

  const apiKey = getPlainApiKey(provider);
  if (!apiKey) {
    throw new Error(`未配置服务商 ${providerMeta.name} 的 API Key，请在 AI 管理中心录入`);
  }

  // 1. DeepSeek
  // 1. DeepSeek
  if (provider === 'deepseek') {
    const baseUrl = (providerMeta.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    // DeepSeek 官方最新主力模型为 deepseek-flash (V4.1-Flash) 与 deepseek-v4-pro，以及兼容的 deepseek-chat 与 deepseek-reasoner
    const targetModel = model || providerMeta.defaultModel || 'deepseek-flash';
    const isReasoner = targetModel.includes('reasoner');
    const isFlashOrPro = targetModel.includes('flash') || targetModel.includes('v4');

    const messages: Array<{ role: string; content: string }> = [];
    let sysText = options.systemInstruction || '';
    if (options.responseSchema && !sysText.toLowerCase().includes('json')) {
      sysText = sysText
        ? `${sysText}\n\n【输出格式要求】：请严格输出合法的 JSON 格式，不要包含任何多余的前缀、问候语或解释。`
        : '你是一名资深剧本文学专家。请严格输出合法的 JSON 格式，不要包含任何前缀、问候语或解释。';
    }

    if (sysText) {
      messages.push({ role: 'system', content: sysText });
    }
    messages.push({ role: 'user', content: options.prompt });

    // 针对长篇小说推文脚本生成，赋予充裕的输出 Token 预算（8192）
    const maxTokensLimit = options.maxTokens ?? config.textParams.maxTokens ?? 8192;

    const requestBody: any = {
      model: targetModel,
      messages,
      temperature: options.temperature ?? config.textParams.temperature ?? 0.7,
      max_tokens: Math.max(maxTokensLimit, 4096),
      top_p: config.textParams.topP ?? 0.95,
      stream: false,
    };

    // DeepSeek-V4.1 系列 (deepseek-flash / deepseek-v4-pro) 思考模式控制:
    // 官方默认开启思考模式。对于小说推文、分镜切分等自动化高频 JSON 任务，
    // 若未特别指定开启思考模式，显式传入 thinking: { type: 'disabled' }，可实现毫秒级纯正文/JSON 极速返回，杜绝思考链耗尽 Token 导致内容为空的问题。
    const wantsThinking = providerMeta.parameters?.thinking_mode === 'enabled' || isReasoner;
    if (isFlashOrPro) {
      if (wantsThinking) {
        requestBody.thinking = { type: 'enabled' };
        requestBody.reasoning_effort = providerMeta.parameters?.reasoning_effort || 'low';
        delete requestBody.temperature; // 官方规范：思考模式下不支持 temperature
      } else {
        requestBody.thinking = { type: 'disabled' };
      }
    }

    // 注意：在非推理模型或关闭思考模式时启用 json_object 强校验
    if (options.responseSchema && !isReasoner && (!isFlashOrPro || !wantsThinking)) {
      requestBody.response_format = { type: 'json_object' };
    }

    const res = await postJson(
      url,
      {
        Authorization: `Bearer ${apiKey}`,
      },
      requestBody,
      120000
    );

    const choice = res?.choices?.[0];
    const message = choice?.message;
    let content = message?.content;
    const refusal = message?.refusal;
    const finishReason = choice?.finish_reason;
    const reasoningContent = message?.reasoning_content;

    // 检查是否存在安全策略拦截
    if (refusal) {
      throw new Error(`DeepSeek 内容安全策略拒绝: ${refusal}`);
    }

    // 检查是否内容为空或被截断
    if (!content || !content.trim()) {
      // 容错：若推理模型在思考区包含了完整的 JSON markdown 代码块，尝试从中提取
      if (reasoningContent) {
        const jsonMatch = reasoningContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch && jsonMatch[1]) {
          return jsonMatch[1].trim();
        }
      }
      if (finishReason === 'length') {
        throw new Error(
          `DeepSeek 思考/输出耗尽了最大 Token 额度 (${requestBody.max_tokens}) 导致内容为空。建议在 AI 管理中心将 DeepSeek 设置为「极速非思考模式」，或增大 Token 上限。`
        );
      }
      throw new Error(`DeepSeek 返回内容为空 (finish_reason: ${finishReason || 'unknown'})`);
    }

    return content;
  }

  // 2. Google Gemini
  if (provider === 'gemini') {
    const ai = getGeminiClient();
    const reqConfig: any = {
      systemInstruction: options.systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };

    if (options.responseSchema) {
      reqConfig.responseMimeType = 'application/json';
      reqConfig.responseSchema = options.responseSchema;
    }

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.8-flash',
      contents: options.prompt,
      config: reqConfig,
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini 返回内容为空');
    }
    return text;
  }

  throw new Error(`不支持的文本模型服务商: ${provider}`);
}

// -------------------------------------------------------------
// 2. IMAGE GENERATION DISPATCHER
// -------------------------------------------------------------
export interface ImageGenerateOptions {
  prompt: string;
  visualDescription?: string;
  characterNotes?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
}

export async function executeImageGeneration(
  options: ImageGenerateOptions
): Promise<{ imageUrl: string; provider: ProviderType; model: string; promptUsed: string }> {
  const config = getSanitizedConfig();
  const primaryProvider = config.activeImageProvider;
  const primaryModel = config.activeImageModel;
  const fallbackProvider = config.fallbackImageProvider;
  const fallbackModel = config.fallbackImageModel;
  const fallbackEnabled = config.enableFallbackImage && fallbackProvider && fallbackModel;

  const startTime = Date.now();
  const enhancedPrompt = `${options.prompt || options.visualDescription}. ${
    options.characterNotes ? `Character appearance: ${options.characterNotes}.` : ''
  } 9:16 vertical orientation, cinematic composition, masterpiece digital illustration, dramatic lighting, high quality, no text, no subtitles, no watermarks.`;

  try {
    const imgUrl = await callImageProvider(primaryProvider, primaryModel, enhancedPrompt, options);
    addInvocationLog({
      category: 'image',
      action: 'generate_image',
      provider: primaryProvider,
      model: primaryModel,
      status: 'success',
      durationMs: Date.now() - startTime,
      promptSnippet: enhancedPrompt.slice(0, 120),
      resultSnippet: imgUrl.slice(0, 60),
    });
    return { imageUrl: imgUrl, provider: primaryProvider, model: primaryModel, promptUsed: enhancedPrompt };
  } catch (primaryErr: any) {
    console.error(`[AI Service] Primary image provider (${primaryProvider}/${primaryModel}) failed:`, primaryErr.message);

    if (fallbackEnabled && fallbackProvider) {
      try {
        console.warn(`[AI Service] Triggering fallback image provider (${fallbackProvider}/${fallbackModel})...`);
        const fallbackUrl = await callImageProvider(fallbackProvider, fallbackModel, enhancedPrompt, options);
        addInvocationLog({
          category: 'image',
          action: 'generate_image',
          provider: primaryProvider,
          model: primaryModel,
          status: 'fallback_triggered',
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
          fallbackProvider,
          fallbackModel,
          error: `主图像模型失败: ${primaryErr.message}，已降级至备用模型`,
          promptSnippet: enhancedPrompt.slice(0, 120),
          resultSnippet: fallbackUrl.slice(0, 60),
        });
        return { imageUrl: fallbackUrl, provider: fallbackProvider, model: fallbackModel, promptUsed: enhancedPrompt };
      } catch (fallbackErr: any) {
        addInvocationLog({
          category: 'image',
          action: 'generate_image',
          provider: fallbackProvider,
          model: fallbackModel,
          status: 'failed',
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
          error: `主模型与备用图像模型均失败: ${fallbackErr.message}`,
        });
        throw new Error(`生图主模型与备用模型均失败: [${primaryProvider}] ${primaryErr.message} | [${fallbackProvider}] ${fallbackErr.message}`);
      }
    }

    addInvocationLog({
      category: 'image',
      action: 'generate_image',
      provider: primaryProvider,
      model: primaryModel,
      status: 'failed',
      durationMs: Date.now() - startTime,
      error: primaryErr.message,
      promptSnippet: enhancedPrompt.slice(0, 120),
    });
    throw primaryErr;
  }
}

async function callImageProvider(
  provider: ProviderType,
  model: string,
  prompt: string,
  options: ImageGenerateOptions
): Promise<string> {
  const config = getSanitizedConfig();
  const providerMeta = config.providers[provider];

  if (!providerMeta || !providerMeta.enabled) {
    throw new Error(`服务商 ${provider} 处于停用状态，请在 AI 管理中心启用`);
  }

  const apiKey = getPlainApiKey(provider);
  if (!apiKey) {
    throw new Error(`未配置服务商 ${providerMeta.name} 的 API Key，请在 AI 管理中心录入`);
  }

  // 1. 火山引擎 Ark (Doubao Seedream)
  if (provider === 'volcengine') {
    const baseUrl = (providerMeta.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '');
    const url = `${baseUrl}/images/generations`;

    let width = options.width || config.imageParams.width || 1080;
    let height = options.height || config.imageParams.height || 1920;

    // 火山引擎要求总像素面积必须 >= 921,600 像素
    if (width * height < 921600) {
      const scale = Math.sqrt(921600 / (width * height));
      width = Math.ceil((width * scale) / 8) * 8;
      height = Math.ceil((height * scale) / 8) * 8;
    }

    const requestBody = {
      model: model || 'doubao-seedream-5-0-flash-260915',
      prompt,
      response_format: 'b64_json',
      width,
      height,
      size: `${width}x${height}`,
    };

    const res = await postJson(
      url,
      {
        Authorization: `Bearer ${apiKey}`,
      },
      requestBody,
      90000
    );

    const b64 = res?.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    const webUrl = res?.data?.[0]?.url;
    if (webUrl) {
      return webUrl;
    }
    throw new Error('火山引擎未返回有效图像 base64 或 url');
  }

  // 2. Google Gemini Image
  if (provider === 'gemini') {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: model || 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: (options.aspectRatio || config.imageParams.aspectRatio || '9:16') as any,
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }
    throw new Error('Gemini 图像模型未返回有效图像数据');
  }

  throw new Error(`不支持的图像服务商: ${provider}`);
}

// -------------------------------------------------------------
// 3. VOICE / TTS DISPATCHER
// -------------------------------------------------------------
export interface VoiceGenerateOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: string;
}

export async function executeVoiceGeneration(
  options: VoiceGenerateOptions
): Promise<{ audioUrl: string; duration: number; provider: ProviderType; model: string; voiceName: string }> {
  const config = getSanitizedConfig();
  const primaryProvider = config.activeVoiceProvider;
  const primaryModel = config.activeVoiceModel;
  const fallbackProvider = config.fallbackVoiceProvider;
  const fallbackModel = config.fallbackVoiceModel;
  const fallbackEnabled = config.enableFallbackVoice && fallbackProvider && fallbackModel;

  const startTime = Date.now();

  try {
    const result = await callVoiceProvider(primaryProvider, primaryModel, options);
    addInvocationLog({
      category: 'voice',
      action: 'generate_tts',
      provider: primaryProvider,
      model: primaryModel,
      status: 'success',
      durationMs: Date.now() - startTime,
      promptSnippet: options.text.slice(0, 100),
      resultSnippet: `时长 ${result.duration}s, 音色: ${result.voiceName}`,
    });
    return { ...result, provider: primaryProvider, model: primaryModel };
  } catch (primaryErr: any) {
    console.error(`[AI Service] Primary voice provider (${primaryProvider}/${primaryModel}) failed:`, primaryErr.message);

    if (fallbackEnabled && fallbackProvider) {
      try {
        console.warn(`[AI Service] Triggering fallback voice provider (${fallbackProvider}/${fallbackModel})...`);
        const fallbackResult = await callVoiceProvider(fallbackProvider, fallbackModel, options);
        addInvocationLog({
          category: 'voice',
          action: 'generate_tts',
          provider: primaryProvider,
          model: primaryModel,
          status: 'fallback_triggered',
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
          fallbackProvider,
          fallbackModel,
          error: `主语音服务失败: ${primaryErr.message}，已自动降级至备用服务`,
          promptSnippet: options.text.slice(0, 100),
          resultSnippet: `时长 ${fallbackResult.duration}s, 音色: ${fallbackResult.voiceName}`,
        });
        return {
          ...fallbackResult,
          provider: fallbackProvider,
          model: fallbackModel,
          fallbackUsed: true,
          fallbackNote: `主语音服务 (${primaryProvider}) 异常 [${primaryErr.message}]，系统已自动无缝切换至备用语音引擎 (${fallbackProvider} · ${fallbackResult.voiceName}) 完成高保真旁白合成`,
        } as any;
      } catch (fallbackErr: any) {
        addInvocationLog({
          category: 'voice',
          action: 'generate_tts',
          provider: fallbackProvider,
          model: fallbackModel,
          status: 'failed',
          durationMs: Date.now() - startTime,
          fallbackUsed: true,
          error: `主服务与备用语音服务均失败: ${fallbackErr.message}`,
        });
        throw new Error(`配音主服务与备用服务均失败: [${primaryProvider}] ${primaryErr.message} | [${fallbackProvider}] ${fallbackErr.message}`);
      }
    }

    addInvocationLog({
      category: 'voice',
      action: 'generate_tts',
      provider: primaryProvider,
      model: primaryModel,
      status: 'failed',
      durationMs: Date.now() - startTime,
      error: primaryErr.message,
      promptSnippet: options.text.slice(0, 100),
    });
    throw primaryErr;
  }
}

async function callVoiceProvider(
  provider: ProviderType,
  model: string,
  options: VoiceGenerateOptions
): Promise<{ audioUrl: string; duration: number; voiceName: string; fallbackUsed?: boolean; fallbackNote?: string }> {
  const config = getSanitizedConfig();
  const providerMeta = config.providers[provider];

  if (!providerMeta || !providerMeta.enabled) {
    throw new Error(`服务商 ${provider} 处于停用状态，请在 AI 管理中心启用`);
  }

  const apiKey = getPlainApiKey(provider);
  if (!apiKey) {
    throw new Error(`未配置服务商 ${providerMeta.name} 的 API Key，请在 AI 管理中心录入`);
  }

  // 1. MiniMax Speech
  if (provider === 'minimax') {
    const configuredBase = (providerMeta.baseUrl || 'https://api.minimax.cn/v1').replace(/\/+$/, '');
    const voice = options.voiceId || config.voiceParams.voiceId || 'female-yujie';
    const speed = options.speed ?? config.voiceParams.speed ?? 1.0;
    const vol = options.volume ?? config.voiceParams.volume ?? 1.0;
    const pitch = options.pitch ?? config.voiceParams.pitch ?? 0;

    const requestBody = {
      model: model || 'speech-2.8-hd',
      text: options.text.trim(),
      stream: false,
      voice_setting: {
        voice_id: voice,
        speed,
        vol,
        pitch,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'wav',
        channel: 1,
      },
    };

    const candidateEndpoints = Array.from(new Set([
      configuredBase,
      'https://api.minimax.cn/v1',
      'https://api.minimaxi.chat/v1',
      'https://api.minimax.io/v1',
    ]));

    let lastError: any = null;

    for (const base of candidateEndpoints) {
      try {
        const url = `${base}/t2a_v2`;
        const res = await postJson(
          url,
          { Authorization: `Bearer ${apiKey}` },
          requestBody,
          60000
        );

        if (res?.base_resp && res.base_resp.status_code !== 0) {
          if (res.base_resp.status_code === 1004) {
            lastError = new Error(`MiniMax 鉴权失败 (状态码 1004: login fail): API Secret Key 无效或未生效。请核对是否为 platform.minimax.cn「接口密钥」按量付费 Key 且账户有余额`);
            continue;
          }
          throw new Error(`MiniMax 语音接口错误 [代码 ${res.base_resp.status_code}]: ${res.base_resp.status_msg || '未知错误'}`);
        }

        const hexAudio = res?.data?.audio;
        if (hexAudio) {
          const audioBuffer = Buffer.from(hexAudio, 'hex');
          const b64 = audioBuffer.toString('base64');
          const duration = +(res?.data?.extra_info?.audio_length ? (res.data.extra_info.audio_length / 1000).toFixed(2) : (options.text.length / 4.2).toFixed(1));
          return {
            audioUrl: `data:audio/wav;base64,${b64}`,
            duration,
            voiceName: voice,
          };
        }

        const b64Audio = res?.audio_base64 || res?.data?.audio_base64;
        if (b64Audio) {
          return {
            audioUrl: `data:audio/wav;base64,${b64Audio}`,
            duration: +(options.text.length / 4.2).toFixed(1),
            voiceName: voice,
          };
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error(`MiniMax 语音合成失败: 未能从所有候选接入点获取音频数据`);
  }

  // 2. Google Gemini TTS
  if (provider === 'gemini') {
    const ai = getGeminiClient();

    // Comprehensive voice mapping from novel preset IDs to Gemini high-fidelity voices
    const voiceMapping: Record<string, { geminiVoice: string; style: string; label: string }> = {
      'male-qn-jingying': {
        geminiVoice: 'Charon',
        style: '磁性抓人、富有商战与反转戏剧张力、成熟稳重自信的精英男声旁白解说员',
        label: '精英男声',
      },
      'male-qn-qingse': {
        geminiVoice: 'Puck',
        style: '少年朝气、热血冲劲与生动自然的小说男主播音员',
        label: '青年音',
      },
      'female-yujie': {
        geminiVoice: 'Kore',
        style: '知性优雅、冷艳沉稳、富有豪门与悬疑沉浸感的御姐女主播',
        label: '御姐音',
      },
      'female-tianmei': {
        geminiVoice: 'Zephyr',
        style: '甜美轻快、温润亲切、富有言情生活气息的甜美女主播',
        label: '甜美音',
      },
      'Fenrir': {
        geminiVoice: 'Fenrir',
        style: '低沉浑厚、威严大气的史诗男主播',
        label: '沉厚男声',
      },
      'Charon': {
        geminiVoice: 'Charon',
        style: '磁性抓人、富有商战与反转戏剧张力、成熟稳重自信的精英男声旁白解说员',
        label: '精英男声',
      },
      'Puck': {
        geminiVoice: 'Puck',
        style: '少年朝气、热血冲劲与生动自然的小说男主播音员',
        label: '青年音',
      },
      'Kore': {
        geminiVoice: 'Kore',
        style: '知性优雅、冷艳沉稳、富有豪门与悬疑沉浸感的御姐女主播',
        label: '御姐音',
      },
      'Zephyr': {
        geminiVoice: 'Zephyr',
        style: '甜美轻快、温润亲切、富有言情生活气息的甜美女主播',
        label: '甜美音',
      },
    };

    const target = voiceMapping[options.voiceId || ''] || {
      geminiVoice: (options.voiceId && options.voiceId.toLowerCase().includes('male')) ? 'Charon' : 'Kore',
      style: '自然流畅、富有戏剧张力与情感沉浸感的专业小说推文解说播音员',
      label: options.voiceId || '默认音色',
    };

    const chosenVoice = target.geminiVoice;
    const stylePrompt = target.style;

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: options.text.trim(),
              speechMetadata: {
                style: stylePrompt,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Gemini TTS 未返回有效音频数据');
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64');
    let estimatedDuration = +(options.text.length / 4.2).toFixed(1);
    try {
      if (audioBuffer.length > 44) {
        const byteRate = audioBuffer.readUInt32LE(28) || 48000;
        estimatedDuration = +((audioBuffer.length - 44) / byteRate).toFixed(2);
      }
    } catch {
      // fallback to estimation
    }

    return {
      audioUrl: `data:audio/wav;base64,${base64Audio}`,
      duration: estimatedDuration || +(options.text.length / 4.2).toFixed(1),
      voiceName: options.voiceId || target.label,
    };
  }

  throw new Error(`不支持的语音服务商: ${provider}`);
}

// -------------------------------------------------------------
// 4. REAL CONNECTION TESTER (NO FAKE / MOCK RESULTS)
// -------------------------------------------------------------
export async function testProviderConnection(provider: ProviderType, candidateApiKey?: string): Promise<{
  success: boolean;
  message: string;
  latencyMs: number;
  testedModel: string;
}> {
  const config = getSanitizedConfig();
  const providerMeta = config.providers[provider];
  if (!providerMeta) {
    throw new Error(`未知服务商: ${provider}`);
  }

  const effectiveKey = (candidateApiKey && candidateApiKey.trim()) || getPlainApiKey(provider);
  if (!effectiveKey) {
    throw new Error(`请先输入或配置 ${providerMeta.name} 的 API Key`);
  }

  const start = Date.now();

  try {
    if (provider === 'deepseek') {
      const baseUrl = (providerMeta.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
      const testModel = providerMeta.defaultModel || 'deepseek-flash';
      const isFlashOrPro = testModel.includes('flash') || testModel.includes('v4');
      const testBody: any = {
        model: testModel,
        messages: [{ role: 'user', content: 'Ping. Reply OK in 1 word.' }],
        max_tokens: 50,
      };
      if (isFlashOrPro) {
        testBody.thinking = { type: 'disabled' };
      }
      const res = await postJson(
        `${baseUrl}/chat/completions`,
        { Authorization: `Bearer ${effectiveKey}` },
        testBody,
        15000
      );
      const text = res?.choices?.[0]?.message?.content || res?.choices?.[0]?.message?.reasoning_content || '';
      const latencyMs = Date.now() - start;
      const msg = `连接成功！响应: "${text.trim().slice(0, 20)}" (耗时 ${latencyMs}ms)`;
      
      updateRuntimeConfig({
        providers: {
          ...config.providers,
          deepseek: {
            ...config.providers.deepseek,
            lastTestStatus: 'success',
            lastTestMessage: msg,
            lastTestedAt: Date.now(),
          },
        },
      });

      return { success: true, message: msg, latencyMs, testedModel: testModel };
    }

    if (provider === 'volcengine') {
      const baseUrl = (providerMeta.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '');
      const testModel = providerMeta.defaultModel || 'doubao-seedream-5-0-flash-260915';
      
      // Test with lightweight prompt
      const res = await postJson(
        `${baseUrl}/images/generations`,
        { Authorization: `Bearer ${effectiveKey}` },
        {
          model: testModel,
          prompt: 'minimalist dot, clean white background',
          response_format: 'url',
          width: 1024,
          height: 1024,
          size: '1024x1024',
        },
        25000
      );

      const latencyMs = Date.now() - start;
      const msg = `连接成功！火山引擎模型 ${testModel} 校验通过 (耗时 ${latencyMs}ms)`;

      updateRuntimeConfig({
        providers: {
          ...config.providers,
          volcengine: {
            ...config.providers.volcengine,
            lastTestStatus: 'success',
            lastTestMessage: msg,
            lastTestedAt: Date.now(),
          },
        },
      });

      return { success: true, message: msg, latencyMs, testedModel: testModel };
    }

    if (provider === 'minimax') {
      const configuredBase = (providerMeta.baseUrl || 'https://api.minimax.cn/v1').replace(/\/+$/, '');
      const testModel = providerMeta.defaultModel || 'speech-2.8-hd';
      
      // Candidate endpoints based on platform.minimax.cn official docs
      const candidateEndpoints = Array.from(new Set([
        configuredBase,
        'https://api.minimax.cn/v1',
        'https://api.minimaxi.chat/v1',
        'https://api.minimax.io/v1',
        'https://api.minimax.chat/v1',
      ]));

      let lastErrorMsg = '';
      let is1004 = false;

      for (const base of candidateEndpoints) {
        try {
          const res = await postJson(
            `${base}/t2a_v2`,
            { Authorization: `Bearer ${effectiveKey}` },
            {
              model: testModel,
              text: '你好',
              stream: false,
              voice_setting: { voice_id: 'female-yujie', speed: 1.0 },
              audio_setting: { sample_rate: 16000, format: 'wav' },
            },
            15000
          );

          if (res?.base_resp && res.base_resp.status_code !== 0) {
            if (res.base_resp.status_code === 1004) {
              is1004 = true;
              lastErrorMsg = res.base_resp.status_msg || 'login fail';
              continue; // Try next endpoint in case key belongs to different regional domain
            }
            throw new Error(`MiniMax 接口错误 [代码 ${res.base_resp.status_code}]: ${res.base_resp.status_msg || '未知错误'}`);
          }

          if (res?.data?.audio || res?.audio_base64 || res?.data?.audio_base64) {
            // Success! Save working baseUrl
            const latencyMs = Date.now() - start;
            const msg = `连接成功！MiniMax 语音模型 ${testModel} 鉴权通过 [接入点: ${base}] (耗时 ${latencyMs}ms)`;

            updateRuntimeConfig({
              providers: {
                ...config.providers,
                minimax: {
                  ...config.providers.minimax,
                  baseUrl: base,
                  lastTestStatus: 'success',
                  lastTestMessage: msg,
                  lastTestedAt: Date.now(),
                },
              },
            });

            return { success: true, message: msg, latencyMs, testedModel: testModel };
          }
        } catch (endpointErr: any) {
          lastErrorMsg = endpointErr.message;
        }
      }

      if (is1004) {
        throw new Error(
          `MiniMax 鉴权失败 (1004: login fail): API Secret Key 无效或未生效。\n` +
          `官方文档排查要点 (https://platform.minimax.cn/docs/api-reference/api-overview)：\n` +
          `1. 密钥类型：必须是在「账户管理 > 接口密钥」创建的【按量付费 API Key】，不能使用「订阅管理 > M Plan」的订阅 Key（M Plan 订阅 Key 不支持 T2A 语音接口）；\n` +
          `2. 账户余额：请在「账户管理 > 余额」确认有可用余额；\n` +
          `3. 区域端点：国内开放平台与国际版 (platform.minimax.io) 密钥不互通；\n` +
          `4. 生效延迟：新创建密钥请等待 1-2 分钟后再试。\n` +
          `（提示：系统已内置 Gemini 原生高保真语音，支持精英男声，开启备用降级即可顺畅配音）`
        );
      }

      throw new Error(`MiniMax 连接失败: ${lastErrorMsg || '未返回有效音频'}`);
    }

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey: effectiveKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const testModel = providerMeta.defaultModel || 'gemini-3.8-flash';
      const res = await ai.models.generateContent({
        model: testModel,
        contents: 'Hi',
      });
      const text = res.text || '';
      const latencyMs = Date.now() - start;
      const msg = `连接成功！Gemini ${testModel} 响应正常 (耗时 ${latencyMs}ms)`;

      updateRuntimeConfig({
        providers: {
          ...config.providers,
          gemini: {
            ...config.providers.gemini,
            lastTestStatus: 'success',
            lastTestMessage: msg,
            lastTestedAt: Date.now(),
          },
        },
      });

      return { success: true, message: msg, latencyMs, testedModel: testModel };
    }

    throw new Error(`暂不支持测试该服务商: ${provider}`);
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const errorMsg = `连接失败: ${err.message || '网络连接超时或凭证失效'}`;

    updateRuntimeConfig({
      providers: {
        ...config.providers,
        [provider]: {
          ...config.providers[provider],
          lastTestStatus: 'failed',
          lastTestMessage: errorMsg,
          lastTestedAt: Date.now(),
        },
      },
    });

    return { success: false, message: errorMsg, latencyMs, testedModel: providerMeta.defaultModel };
  }
}
