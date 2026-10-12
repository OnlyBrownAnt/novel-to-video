import { Character, Scene, SubtitleItem, SubtitleStyle } from '../types/project';

export interface ScriptGenResult {
  title: string;
  hook: string;
  narration: string;
  estimatedDuration: number;
  emotionArc: string;
  endingHook: string;
  factCheckNotes: string;
}

export const api = {
  // Parse TXT, MD, DOCX, EPUB
  async parseFile(
    file: File,
    customRegex?: string
  ): Promise<{
    text: string;
    wordCount: number;
    suggestedTitle: string;
    chapters: Array<{ id: string; index: number; title: string; content: string; wordCount: number }>;
    totalChapters: number;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(',')[1] || result;

          const res = await fetch('/api/parse-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              base64Data,
              customRegex,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '解析失败' }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }

          const data = await res.json();
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('读取本地文件失败'));
      reader.readAsDataURL(file);
    });
  },

  // Reparse chapters with custom regex
  async reparseChapters(
    text: string,
    customRegex?: string
  ): Promise<{
    chapters: Array<{ id: string; index: number; title: string; content: string; wordCount: number }>;
    totalChapters: number;
  }> {
    const res = await fetch('/api/reparse-chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, customRegex }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '重新分章失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
  },

  // Generate Chapter Summary Index
  async indexChapter(params: {
    novelTitle: string;
    chapterTitle: string;
    content: string;
  }): Promise<{
    summary: string;
    characters: string[];
    keyEvents: string[];
  }> {
    const res = await fetch('/api/index-chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '提取章节索引失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
  },

  // Generate Script
  async generateScript(params: {
    novelText: string;
    novelTitle?: string;
    chapterTitle?: string;
    contextSummary?: string;
    targetDuration?: number;
    narrativeStyle?: string;
    pov?: string;
    hookStrength?: string;
    adaptationDegree?: string;
    customInstructions?: string;
  }): Promise<ScriptGenResult> {
    const res = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '生成脚本失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
  },

  // Refine Script
  async refineScript(params: {
    action: 'rewrite_hook' | 'shorten' | 'expand' | 'polish';
    currentScript: {
      title: string;
      hook: string;
      narration: string;
    };
    novelText?: string;
  }): Promise<ScriptGenResult> {
    const res = await fetch('/api/refine-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '修改脚本失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
  },

  // Split Scenes
  async splitScenes(narration: string, characters: Character[] = []): Promise<Scene[]> {
    const res = await fetch('/api/split-scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ narration, characters }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '拆分分镜失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.scenes || [];
  },

  // Extract Characters
  async extractCharacters(novelText: string, narration: string = ''): Promise<Character[]> {
    const res = await fetch('/api/extract-characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novelText, narration }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '提取角色失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.characters || [];
  },

  // Generate Image
  async generateImage(params: {
    prompt: string;
    visualDescription?: string;
    characterNotes?: string;
  }): Promise<{ imageUrl: string; promptUsed: string }> {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({ error: '生成图片返回异常' }));
    if (!res.ok || !data.success) {
      throw new Error(data.error || '图片生成失败');
    }

    return {
      imageUrl: data.imageUrl,
      promptUsed: data.promptUsed,
    };
  },

  // Generate TTS Audio
  async generateTTS(
    text: string,
    voice: string = 'female-yujie'
  ): Promise<{
    audioUrl: string;
    duration: number;
    voiceName: string;
    provider?: string;
    model?: string;
    fallbackUsed?: boolean;
    fallbackNote?: string;
  }> {
    const res = await fetch('/api/generate-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'TTS 配音生成失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
  },

  // Trigger Video Render
  async renderVideo(payload: {
    scenes: Array<{ id: string; order: number; duration: number; imageUrl: string }>;
    audioBase64: string;
    subtitles: SubtitleItem[];
    subtitleStyle: SubtitleStyle;
    applyKenBurns?: boolean;
  }): Promise<{ jobId: string }> {
    const res = await fetch('/api/render-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '发起合成任务失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
  },

  // Poll Video Render Status
  async getRenderStatus(jobId: string): Promise<{
    status: 'preparing' | 'writing_assets' | 'generating_subtitles' | 'encoding_video' | 'rendering' | 'completed' | 'failed';
    progress: number;
    downloadUrl?: string;
    error?: string;
  }> {
    const res = await fetch(`/api/render-status/${jobId}`);
    if (!res.ok) {
      throw new Error('查询渲染状态失败');
    }
    return await res.json();
  },

  // ==========================================
  // AI Management Center API
  // ==========================================
  async getAiSettings(): Promise<any> {
    const res = await fetch('/api/ai-settings');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '获取设置失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },

  async updateAiSettings(updates: any): Promise<any> {
    const res = await fetch('/api/ai-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '更新设置失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },

  async saveProviderKey(provider: string, apiKey: string): Promise<any> {
    const res = await fetch('/api/ai-settings/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '保存密钥失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },

  async deleteProviderKey(provider: string): Promise<any> {
    const res = await fetch(`/api/ai-settings/key/${provider}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '删除密钥失败' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },

  async testProviderConnection(provider: string, candidateApiKey?: string): Promise<{
    success: boolean;
    message: string;
    latencyMs: number;
    testedModel: string;
  }> {
    const res = await fetch('/api/ai-settings/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, candidateApiKey }),
    });
    const data = await res.json().catch(() => ({ success: false, message: '返回数据格式异常' }));
    return data;
  },

  async getAiLogs(): Promise<any> {
    const res = await fetch('/api/ai-settings/logs');
    if (!res.ok) {
      throw new Error('获取调用日志失败');
    }
    return await res.json();
  },

  async clearAiLogs(): Promise<any> {
    const res = await fetch('/api/ai-settings/logs', {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('清空日志失败');
    }
    return await res.json();
  },
};
