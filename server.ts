import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { Type } from '@google/genai';
import {
  initAiConfigStore,
  getSanitizedConfig,
  updateRuntimeConfig,
  setProviderApiKey,
  deleteProviderApiKey,
  getRecentLogs,
  clearLogs,
  ProviderType,
} from './server_ai_config';
import {
  executeTextGeneration,
  executeImageGeneration,
  executeVoiceGeneration,
  testProviderConnection,
  getGeminiClient,
} from './server_ai_dispatcher';

dotenv.config();

// Initialize persistent encrypted AI configuration vault
initAiConfigStore();

const app = express();
const PORT = 3000;

// Support large payloads for images, audio and projects
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Temp directories for video rendering and outputs
const TEMP_RENDER_DIR = path.resolve('/tmp/novel_renders');
if (!fs.existsSync(TEMP_RENDER_DIR)) {
  fs.mkdirSync(TEMP_RENDER_DIR, { recursive: true });
}

/**
 * 健壮的通用 AI JSON 提取与解析工具函数
 * 兼容纯 JSON、```json Markdown 代码围栏、混合前缀问候语、最外层括号定位及对象/数组形态自动清洗
 */
function extractAndParseJson<T = any>(rawText: string, contextName = 'AI 结果'): T {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error(`${contextName}为空，未获取到有效输出内容`);
  }

  const trimmed = rawText.trim();

  // 1. 尝试直接解析
  try {
    return JSON.parse(trimmed);
  } catch {
    // 继续
  }

  // 2. 匹配 Markdown 代码块 ```json ... ``` 或 ``` ... ```
  const markdownBlocks = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const match of markdownBlocks) {
    if (match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // 继续尝试其他代码块
      }
    }
  }

  // 3. 寻找最外层的 '{' ... '}'
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    } catch {
      // 继续
    }
  }

  // 4. 寻找最外层的 '[' ... ']'
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const candidate = trimmed.substring(firstBracket, lastBracket + 1);
      return JSON.parse(candidate);
    } catch {
      // 继续
    }
  }

  throw new Error(`${contextName}输出格式异常，未能解析为合法 JSON (输出摘要: "${trimmed.slice(0, 120)}")`);
}

// Serve rendered videos
app.use('/rendered-videos', express.static(TEMP_RENDER_DIR));

// ==========================================
// AI 管理中心 (AI Management Center) REST 接口
// ==========================================

// 1. 获取当前安全脱敏配置
app.get('/api/ai-settings', (req, res) => {
  try {
    const config = getSanitizedConfig();
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(500).json({ error: `获取配置失败: ${err.message}` });
  }
});

// 2. 更新运行时模型切换与参数
app.post('/api/ai-settings', (req, res) => {
  try {
    const { updates } = req.body;
    if (!updates) {
      return res.status(400).json({ error: '缺少配置更新参数' });
    }
    const updated = updateRuntimeConfig(updates);
    return res.json({ success: true, config: updated, message: '配置已安全保存并实时生效' });
  } catch (err: any) {
    return res.status(500).json({ error: `保存配置失败: ${err.message}` });
  }
});

// 3. 更新或添加供应商 API Key（加密保存，前台不暴露明文）
app.post('/api/ai-settings/key', (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: '必须提供 provider 和 apiKey' });
    }
    const validProviders: ProviderType[] = ['deepseek', 'volcengine', 'minimax', 'gemini'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: '无效的服务商类型' });
    }
    setProviderApiKey(provider, apiKey);
    const config = getSanitizedConfig();
    return res.json({ success: true, message: `已成功加密保存 ${provider} 的 API 密钥`, config });
  } catch (err: any) {
    return res.status(500).json({ error: `保存密钥失败: ${err.message}` });
  }
});

// 4. 删除供应商 API Key
app.delete('/api/ai-settings/key/:provider', (req, res) => {
  try {
    const provider = req.params.provider as ProviderType;
    deleteProviderApiKey(provider);
    const config = getSanitizedConfig();
    return res.json({ success: true, message: `已清除 ${provider} 的密钥配置`, config });
  } catch (err: any) {
    return res.status(500).json({ error: `删除密钥失败: ${err.message}` });
  }
});

// 5. 真实测试连接接口 (拒绝伪造测试结果)
app.post('/api/ai-settings/test-connection', async (req, res) => {
  try {
    const { provider, candidateApiKey } = req.body;
    if (!provider) {
      return res.status(400).json({ error: '缺少测试服务商参数' });
    }
    const result = await testProviderConnection(provider as ProviderType, candidateApiKey);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || '连接测试异常' });
  }
});

// 6. 获取最近调用记录与错误日志
app.get('/api/ai-settings/logs', (req, res) => {
  try {
    const logs = getRecentLogs();
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ error: `获取日志失败: ${err.message}` });
  }
});

// 7. 清空调用审计记录
app.delete('/api/ai-settings/logs', (req, res) => {
  try {
    clearLogs();
    return res.json({ success: true, message: '调用日志已清空' });
  } catch (err: any) {
    return res.status(500).json({ error: `清空日志失败: ${err.message}` });
  }
});

// ==========================================
// 辅助函数：EPUB 与长篇小说智能分章
// ==========================================
function extractEpubText(buffer: Buffer): { text: string; suggestedTitle?: string } {
  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    // find html/xhtml content entries
    const htmlEntries = zipEntries.filter((e) =>
      /\.(xhtml|html|htm)$/i.test(e.entryName) && !/cover|nav|toc/i.test(e.entryName)
    );

    htmlEntries.sort((a, b) => a.entryName.localeCompare(b.entryName));

    const textParts: string[] = [];
    for (const entry of htmlEntries) {
      const rawHtml = entry.getData().toString('utf-8');
      const plain = rawHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/(p|div|h[1-6]|tr|li|blockquote)>/gi, '\n')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();

      if (plain.length > 0) {
        textParts.push(plain);
      }
    }

    const fullText = textParts.join('\n\n');
    return { text: fullText };
  } catch (err: any) {
    throw new Error(`解析 EPUB 失败: ${err.message || '格式错误'}`);
  }
}

function splitTextIntoChapters(rawText: string, customPattern?: string) {
  const text = rawText.replace(/\r\n/g, '\n').trim();
  const defaultRegex = /(?:^|\n)\s*(第\s*[0-9一二三四五六七八九十百千万零]+\s*[章回节卷部集][^\n]{0,40}|Chapter\s+[0-9]+[^\n]{0,40}|楔子[^\n]{0,20}|序言[^\n]{0,20}|引子[^\n]{0,20}|尾声[^\n]{0,20}|番外[^\n]{0,30}|后记[^\n]{0,20})/gi;

  let regex: RegExp;
  if (customPattern && customPattern.trim()) {
    try {
      regex = new RegExp(customPattern, 'gi');
    } catch {
      regex = defaultRegex;
    }
  } else {
    regex = defaultRegex;
  }

  const matches: Array<{ title: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push({
      title: m[1] ? m[1].trim() : m[0].trim(),
      index: m.index,
    });
  }

  const chapters: Array<{
    id: string;
    index: number;
    title: string;
    content: string;
    wordCount: number;
  }> = [];

  if (matches.length >= 2) {
    // If preamble text exists before first chapter match
    if (matches[0].index > 60) {
      const preambleText = text.slice(0, matches[0].index).trim();
      if (preambleText.length > 15) {
        chapters.push({
          id: `chap_${Date.now()}_0`,
          index: 0,
          title: '序言 / 简介',
          content: preambleText,
          wordCount: preambleText.length,
        });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
      const fullSection = text.slice(start, end).trim();
      const firstLineBreak = fullSection.indexOf('\n');
      const title = matches[i].title;
      const body = firstLineBreak !== -1 ? fullSection.slice(firstLineBreak).trim() : fullSection;

      chapters.push({
        id: `chap_${Date.now()}_${i + 1}`,
        index: chapters.length + 1,
        title,
        content: body || fullSection,
        wordCount: (body || fullSection).length,
      });
    }
  } else {
    // Single chapter or auto chunk if very long (>3500 chars)
    if (text.length > 3500) {
      const paragraphs = text.split('\n');
      let currentChunk = '';
      let chunkIdx = 1;

      for (const p of paragraphs) {
        if (currentChunk.length + p.length > 2800 && currentChunk.length > 1200) {
          chapters.push({
            id: `chap_${Date.now()}_${chunkIdx}`,
            index: chunkIdx,
            title: `第 ${chunkIdx} 节（自动分段）`,
            content: currentChunk.trim(),
            wordCount: currentChunk.trim().length,
          });
          chunkIdx++;
          currentChunk = p + '\n';
        } else {
          currentChunk += p + '\n';
        }
      }

      if (currentChunk.trim().length > 0) {
        chapters.push({
          id: `chap_${Date.now()}_${chunkIdx}`,
          index: chunkIdx,
          title: `第 ${chunkIdx} 节（自动分段）`,
          content: currentChunk.trim(),
          wordCount: currentChunk.trim().length,
        });
      }
    } else {
      chapters.push({
        id: `chap_${Date.now()}_1`,
        index: 1,
        title: '正文第一章',
        content: text,
        wordCount: text.length,
      });
    }
  }

  return chapters;
}

// ==========================================
// 1. 文档解析接口：支持 TXT, MD, DOCX, EPUB
// ==========================================
app.post('/api/parse-file', async (req, res) => {
  try {
    const { filename, base64Data, customRegex } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: '缺少文件内容数据' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const ext = (filename ? path.extname(filename) : '').toLowerCase();
    let text = '';

    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === '.epub') {
      const epubRes = extractEpubText(buffer);
      text = epubRes.text;
    } else {
      // txt, md or raw text
      text = buffer.toString('utf-8');
    }

    // Clean up text
    text = text.replace(/\r\n/g, '\n').trim();
    const wordCount = text.length;

    // Estimate title if first line looks like a title
    const firstLines = text.split('\n').filter((l: string) => l.trim().length > 0);
    const suggestedTitle =
      firstLines.length > 0 && firstLines[0].length < 35 && !/^第[0-9一二三四五六七八九十百千万]+[章回]/.test(firstLines[0])
        ? firstLines[0].trim().replace(/^《|》$/g, '')
        : (filename ? filename.replace(/\.[^/.]+$/, '') : '');

    // Split into chapters
    const chapters = splitTextIntoChapters(text, customRegex);

    return res.json({
      text,
      wordCount,
      suggestedTitle,
      chapters,
      totalChapters: chapters.length,
    });
  } catch (err: any) {
    console.error('File parse error:', err);
    return res.status(500).json({ error: `解析文件失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 1.1 重新划分章节结构 (自定义正则或规则)
// ==========================================
app.post('/api/reparse-chapters', (req, res) => {
  try {
    const { text, customRegex } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: '文本内容为空' });
    }

    const chapters = splitTextIntoChapters(text, customRegex);
    return res.json({
      chapters,
      totalChapters: chapters.length,
    });
  } catch (err: any) {
    console.error('Reparse chapters error:', err);
    return res.status(500).json({ error: `重新划分章节失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 1.2 章节背景索引提炼 (通过 AI 服务调度引擎)
// ==========================================
app.post('/api/index-chapter', async (req, res) => {
  try {
    const { novelTitle = '', chapterTitle = '', content = '' } = req.body;
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: '章节内容为空，无法生成索引' });
    }

    const prompt = `你是一名专业文学编辑。请快速提炼以下小说章节的剧情摘要、登场人物与核心事件，该摘要将作为长篇小说的检索索引：
书名：《${novelTitle}》
章节：${chapterTitle}

章节原文截选：
"""
${content.slice(0, 4000)}
"""

请返回包含以下字段的严格 JSON：
{
  "summary": "80字以内的剧情要点简述",
  "characters": ["本章出场角色1", "角色2"],
  "keyEvents": ["核心事件1", "核心事件2"]
}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        characters: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        keyEvents: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['summary', 'characters', 'keyEvents'],
    };

    const genResult = await executeTextGeneration('index_chapter', {
      systemInstruction: '你是一名专业文学编辑与小说剧情结构分析专家。输出必须为标准合法的 JSON 对象。',
      prompt,
      responseSchema: schema,
    });

    const parsed = extractAndParseJson(genResult.text, '章节索引');
    return res.json({
      ...parsed,
      _provider: genResult.provider,
      _model: genResult.model,
    });
  } catch (err: any) {
    console.error('Index chapter error:', err);
    return res.status(500).json({ error: `生成章节索引失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 2. 生成推文脚本接口 (通过 AI 服务调度引擎)
// ==========================================
app.post('/api/generate-script', async (req, res) => {
  try {
    const {
      novelText,
      novelTitle = '',
      chapterTitle = '',
      contextSummary = '', // 长篇小说背景与前情提要检索资料
      targetDuration = 60, // 30, 60, 90, 120 seconds
      narrativeStyle = '悬念反转', // 情绪叙事, 悬念反转, 现实情感, 剧情解说
      pov = '第一人称', // 第一人称, 第三人称
      hookStrength = '强钩子', // 强钩子, 自然铺垫
      adaptationDegree = '适度口语化', // 忠实原文, 适度口语化
      customInstructions = '',
    } = req.body;

    if (!novelText || novelText.trim().length < 10) {
      return res.status(400).json({ error: '小说正文内容过短或为空，请输入至少 10 个字' });
    }

    // Word target rule: ~250 words per minute for Chinese voiceover (roughly 4 words per second)
    const targetWordCount = Math.round(targetDuration * 4);

    const systemInstruction = `你是一名拥有数千万爆款小说推文创作经验的资深短视频编剧与文学顾问。
你的核心任务是将用户提供的小说原文片段，改编为适合抖音/快手短视频的旁白推文脚本。

【绝对遵守的创作红线原则】：
1. 【严格尊重原著事实】：严禁擅自凭空捏造原著中不存在的背叛、凶杀、绿帽、破产、身份等耸动爆点！
2. 【保留人物关系与因果】：保留关键人物动机、因果逻辑与情绪递进。绝不得为了缩短视频破坏事件原委。
3. 【禁止编造虚假结局】：若原文未交代结局，采用留白或引人入胜的悬念反问，严禁虚构结局。
4. 【拒绝空洞营销套话】：严禁使用“家人们谁懂啊”、“这女人居然…”等劣质短视频套话。语言要自然流畅、具象生动、适合中文口播。
5. 【黄金前3秒钩子】：开头迅速抛出核心人物困境、剧烈戏剧反差或引发强烈同理心的问句。
6. 【目标字数匹配】：目标视频时长为 ${targetDuration} 秒，口播旁白字数控制在 ${Math.round(targetWordCount * 0.85)} 至 ${Math.round(targetWordCount * 1.15)} 字之间。

输出必须是合法的 JSON 对象。`;

    const backgroundSection = contextSummary
      ? `\n【长篇前情提要与背景关联（供理解原著宏观脉络，本次推文重点改编下方选定章节正文）】：\n"""\n${contextSummary.slice(0, 3000)}\n"""\n`
      : '';

    const prompt = `请根据以下信息与小说片段生成短视频推文脚本：
作品名：《${novelTitle || '未命名作品'}》
章节：${chapterTitle || '节选'}
目标时长：${targetDuration} 秒（约 ${targetWordCount} 字）
叙事风格：${narrativeStyle}
叙述视角：${pov}
开头钩子强度：${hookStrength}
改编幅度：${adaptationDegree}
补充要求：${customInstructions || '无'}${backgroundSection}

本次选定改编小说原文：
"""
${novelText.slice(0, 8000)}
"""

请返回包含以下字段的严格 JSON：
- title: 吸引人的短视频标题（15字以内）
- hook: 黄金前3秒开头钩子文案（30字以内，极具吸引力）
- narration: 完整短视频旁白口播正文（必须包含开头钩子并顺畅过渡，语言精炼，适合口语播讲）
- estimatedDuration: 预估耗时（数字，单位秒）
- emotionArc: 情绪变化曲线说明（例如：困惑委屈 -> 隐忍蓄力 -> 惊天反转 -> 爽感释放）
- endingHook: 视频结尾留钩子文案（引导观众点赞、追更或看下一集）
- factCheckNotes: 原文事实核对说明（明确列出本次改编完全忠于原文的情节支柱与原文章节依据）`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        hook: { type: Type.STRING },
        narration: { type: Type.STRING },
        estimatedDuration: { type: Type.NUMBER },
        emotionArc: { type: Type.STRING },
        endingHook: { type: Type.STRING },
        factCheckNotes: { type: Type.STRING },
      },
      required: ['title', 'hook', 'narration', 'estimatedDuration', 'emotionArc', 'endingHook', 'factCheckNotes'],
    };

    const genResult = await executeTextGeneration('generate_script', {
      systemInstruction,
      prompt,
      responseSchema: schema,
    });

    const parsed = extractAndParseJson(genResult.text, '推文脚本');
    return res.json({
      ...parsed,
      _provider: genResult.provider,
      _model: genResult.model,
    });
  } catch (err: any) {
    console.error('Script generation error:', err);
    return res.status(500).json({ error: `生成推文脚本失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 3. 微调推文脚本 (重写开头 / 缩短 / 扩写)
// ==========================================
app.post('/api/refine-script', async (req, res) => {
  try {
    const { action, currentScript, novelText = '' } = req.body;
    if (!currentScript || !currentScript.narration) {
      return res.status(400).json({ error: '缺少当前脚本内容' });
    }

    let instruction = '';

    if (action === 'rewrite_hook') {
      instruction = `保持后续旁白主要内容基本不变，仅重新构思一个更具冲突感、画面感和吸引力的开头黄金前3秒钩子，并更新 narration 开头与 hook 字段。`;
    } else if (action === 'shorten') {
      instruction = `精简并压缩当前旁白文案，删减次要修饰词，保留核心转折和人物台词，将字数减少 20% 左右，节奏更紧凑。`;
    } else if (action === 'expand') {
      instruction = `根据原文情节扩充当前旁白文案，增加人物动作、眼神、心理细节与环境氛围描写，使字数增加 20% 左右，情绪更饱满。`;
    } else {
      instruction = `对当前旁白文案进行语言润色，使其更具网感和中文口播感染力，同时严守原著因果。`;
    }

    const prompt = `当前脚本：
标题：${currentScript.title}
原开头：${currentScript.hook}
原旁白正文：
${currentScript.narration}

小说原文背景：
${novelText.slice(0, 4000)}

优化目标：${instruction}

请返回更新后的 JSON（包含 title, hook, narration, estimatedDuration, emotionArc, endingHook, factCheckNotes）。`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        hook: { type: Type.STRING },
        narration: { type: Type.STRING },
        estimatedDuration: { type: Type.NUMBER },
        emotionArc: { type: Type.STRING },
        endingHook: { type: Type.STRING },
        factCheckNotes: { type: Type.STRING },
      },
      required: ['title', 'hook', 'narration', 'estimatedDuration', 'emotionArc', 'endingHook', 'factCheckNotes'],
    };

    const genResult = await executeTextGeneration('refine_script', {
      prompt,
      responseSchema: schema,
    });

    const parsed = extractAndParseJson(genResult.text, '脚本微调');
    return res.json({
      ...parsed,
      _provider: genResult.provider,
      _model: genResult.model,
    });
  } catch (err: any) {
    console.error('Refine script error:', err);
    return res.status(500).json({ error: `修改脚本失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 4. 拆分视频分镜 (通过 AI 服务调度引擎)
// ==========================================
app.post('/api/split-scenes', async (req, res) => {
  try {
    const { narration, characters = [] } = req.body;
    if (!narration || narration.trim().length < 10) {
      return res.status(400).json({ error: '旁白内容为空或过短，无法拆分分镜' });
    }

    const charContext = characters.length > 0
      ? `已知角色列表：${characters.map((c: any) => `${c.name} (${c.gender || ''}, ${c.age || ''}, 服饰特征: ${c.clothing || '无'})`).join('; ')}`
      : '未提供角色设定，请从旁白中自行提炼角色。';

    const systemInstruction = `你是一名专业短视频视觉导演与分镜师。
你需要将一段完整的中文口播旁白，拆分成适合 9:16 竖屏短视频的连续场景分镜（Storyboard）。

【分镜拆解关键规则】：
1. 【旁白完整性】：所有场景的 narration 合并起来，必须 100% 还原用户确认的完整旁白，绝不得随意漏字、删减句子或重复。
2. 【语义与画面节奏】：每个场景只表达一个清晰的画面视觉重点。每个场景时长通常在 3 到 6 秒之间（约 15-30 个汉字）。
3. 【画面具象化】：visualDescription 必须是画面导演视角描述，清晰包含主体、动作与表情、环境背景、光影氛围、镜头景别（如：特写/中景/全景/俯拍/低角度仰拍）。
4. 【图像生成提示词】：englishPrompt 必须是高质量的 AI 图像生成英文 prompt，专为 9:16 竖屏电影感概念插画设计，避免包含字幕、水印文字或乱码要求。
5. 【构图与情绪】：必须明确给出 composition（景别与构图）和 mood（情绪氛围）。
6. 【角色标记】：characters 数组列出本镜头中出现的角色名。

输出必须是标准的 JSON 数组。`;

    const prompt = `完整确认旁白：
"""
${narration}
"""

${charContext}

请将上述旁白拆分为有序的场景列表，返回合法的 JSON 数组。`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          order: { type: Type.INTEGER },
          narration: { type: Type.STRING },
          visualDescription: { type: Type.STRING },
          englishPrompt: { type: Type.STRING },
          characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          actions: { type: Type.STRING },
          environment: { type: Type.STRING },
          mood: { type: Type.STRING },
          composition: { type: Type.STRING },
          duration: { type: Type.NUMBER },
        },
        required: [
          'order',
          'narration',
          'visualDescription',
          'englishPrompt',
          'characters',
          'actions',
          'environment',
          'mood',
          'composition',
          'duration',
        ],
      },
    };

    const genResult = await executeTextGeneration('split_scenes', {
      systemInstruction,
      prompt,
      responseSchema: schema,
    });

    const parsed = extractAndParseJson(genResult.text, '分镜拆分');
    let rawScenes: any[] = [];
    if (Array.isArray(parsed)) {
      rawScenes = parsed;
    } else if (parsed && typeof parsed === 'object') {
      rawScenes = parsed.scenes || parsed.sceneList || parsed.items || parsed.data || Object.values(parsed).find(v => Array.isArray(v)) || [];
    }
    if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
      throw new Error('模型返回的分镜列表格式不符合预期');
    }

    const scenesWithId = rawScenes.map((scene: any, index: number) => ({
      ...scene,
      id: scene.id || `scene_${Date.now()}_${index + 1}`,
      order: index + 1,
    }));

    return res.json({
      scenes: scenesWithId,
      _provider: genResult.provider,
      _model: genResult.model,
    });
  } catch (err: any) {
    console.error('Split scenes error:', err);
    return res.status(500).json({ error: `拆分分镜失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 5. 提取角色视觉设定 (通过 AI 服务调度引擎)
// ==========================================
app.post('/api/extract-characters', async (req, res) => {
  try {
    const { novelText = '', narration = '' } = req.body;
    const content = (novelText + '\n' + narration).slice(0, 6000);

    if (content.trim().length < 10) {
      return res.status(400).json({ error: '文本内容过少，无法提取角色' });
    }

    const prompt = `请从以下小说及推文旁白内容中，提炼出 1 至 4 位主要登场角色的视觉外貌设定，方便后续为各场景生成高度一致的插画形象：

内容：
"""
${content}
"""

请为每位角色输出包含以下字段的严格 JSON 数组：
- id: 唯一标识
- name: 角色名字或代称（如“林婉”、“顾沉”、“继母”）
- age: 年龄段（如“22岁左右年轻女性”、“40岁干练中年男子”）
- gender: 性别（如“女”或“男”）
- hairstyle: 发型与发色（如“黑长直微卷披肩发”、“利落黑色短发背头”）
- facialFeatures: 面部特征与神态（如“清冷凤眼，皮肤白皙”、“轮廓分明，眉宇间带冷意”）
- clothing: 标志性服装穿搭（如“米白色羊绒大衣配复古珍珠耳环”、“黑色高定手工西装”）
- temperament: 性格与气质标签（如“外柔内刚、隐忍清冷”、“强势霸道、眼神深沉”）
- distinctVisuals: 其他固定视觉特征（如“左腕戴旧银镯”、“常戴金丝细框眼镜”）`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          age: { type: Type.STRING },
          gender: { type: Type.STRING },
          hairstyle: { type: Type.STRING },
          facialFeatures: { type: Type.STRING },
          clothing: { type: Type.STRING },
          temperament: { type: Type.STRING },
          distinctVisuals: { type: Type.STRING },
        },
        required: ['name', 'age', 'gender', 'hairstyle', 'facialFeatures', 'clothing', 'temperament', 'distinctVisuals'],
      },
    };

    const genResult = await executeTextGeneration('extract_characters', {
      systemInstruction: '你是一名资深角色概念设计师与视觉总监。输出必须为标准 JSON 数组。',
      prompt,
      responseSchema: schema,
    });

    const parsed = extractAndParseJson(genResult.text, '角色设定');
    let rawChars: any[] = [];
    if (Array.isArray(parsed)) {
      rawChars = parsed;
    } else if (parsed && typeof parsed === 'object') {
      rawChars = parsed.characters || parsed.characterList || parsed.items || parsed.data || Object.values(parsed).find(v => Array.isArray(v)) || [];
    }
    if (!Array.isArray(rawChars)) {
      rawChars = [];
    }

    const characters = rawChars.map((c: any, i: number) => ({
      ...c,
      id: c.id || `char_${Date.now()}_${i + 1}`,
    }));

    return res.json({
      characters,
      _provider: genResult.provider,
      _model: genResult.model,
    });
  } catch (err: any) {
    console.error('Extract characters error:', err);
    return res.status(500).json({ error: `提取角色失败: ${err.message || '未知错误'}` });
  }
});
// ==========================================
// 6. AI 图像生成接口 (通过 AI 服务调度引擎)
// ==========================================
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, visualDescription = '', characterNotes = '', aspectRatio, width, height } = req.body;
    if (!prompt && !visualDescription) {
      return res.status(400).json({ error: '缺少生图提示词' });
    }

    try {
      const result = await executeImageGeneration({
        prompt,
        visualDescription,
        characterNotes,
        aspectRatio,
        width,
        height,
      });

      return res.json({
        imageUrl: result.imageUrl,
        promptUsed: result.promptUsed,
        provider: result.provider,
        model: result.model,
        success: true,
      });
    } catch (imageErr: any) {
      console.warn('[AI Service] Image generation failed:', imageErr?.message);
      return res.status(422).json({
        success: false,
        error: `图像生成失败: ${imageErr.message || '模型调用失败'}。建议检查服务商 API Key 与状态，或使用右侧本地图片上传/系统内置高质感艺术氛围图。`,
        promptUsed: prompt || visualDescription,
      });
    }
  } catch (err: any) {
    console.error('Image generation error:', err);
    return res.status(500).json({
      success: false,
      error: `图像生成服务端异常: ${err.message || '未知错误'}`,
    });
  }
});

// ==========================================
// 7. 真实 AI 语音旁白生成 (通过 AI 服务调度引擎)
// ==========================================
app.post('/api/generate-tts', async (req, res) => {
  try {
    const { text, voice, speed, pitch, volume, emotion } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: '配音文本不能为空' });
    }

    const result = await executeVoiceGeneration({
      text,
      voiceId: voice,
      speed,
      pitch,
      volume,
      emotion,
    });

    return res.json({
      success: true,
      audioUrl: result.audioUrl,
      duration: result.duration,
      voiceName: result.voiceName,
      provider: result.provider,
      model: result.model,
      fallbackUsed: (result as any).fallbackUsed || false,
      fallbackNote: (result as any).fallbackNote || undefined,
    });
  } catch (err: any) {
    console.error('TTS Generation error:', err);
    return res.status(500).json({ error: `生成语音旁白失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 8. 视频真实合成服务 (Server-side FFmpeg)
// ==========================================
interface RenderSceneInput {
  id: string;
  order: number;
  duration: number; // in seconds
  imageUrl: string; // base64 or url
  narration?: string;
}

// In-memory job tracker for progress
const renderJobs = new Map<string, { status: string; progress: number; downloadUrl?: string; error?: string }>();

app.get('/api/render-status/:jobId', (req, res) => {
  const job = renderJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: '任务不存在或已过期' });
  }
  return res.json(job);
});

app.post('/api/render-video', async (req, res) => {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  renderJobs.set(jobId, { status: 'preparing', progress: 5 });

  try {
    const {
      scenes = [],
      audioBase64, // mp3/wav audio track (Required per user prompt rules!)
      subtitles = [], // list of { start, end, text }
      subtitleStyle = {
        fontSize: 38,
        fontColor: '&H00FFFFFF', // ASS color: White
        outlineColor: '&H00000000', // Outline: Black
        outlineWidth: 3,
        verticalMargin: 120, // distance from bottom
      },
      applyKenBurns = true,
    } = req.body;

    // Strict validation check as explicitly demanded:
    // "在合成前检查图片、音频、字幕和场景数据是否完整。对缺少音频的项目给出明确提示；不得输出带有静音占位音轨却声称已完成配音的成片。"
    if (!scenes || scenes.length === 0) {
      renderJobs.set(jobId, { status: 'failed', progress: 0, error: '场景列表为空，无法进行视频合成' });
      return res.status(400).json({ error: '场景列表为空，无法进行视频合成' });
    }

    if (!audioBase64 || audioBase64.trim().length === 0) {
      renderJobs.set(jobId, { status: 'failed', progress: 0, error: '缺少旁白音频！请先在第4步上传音频或生成 AI 旁白配音。' });
      return res.status(400).json({
        error: '缺少旁白音频！依据制作规范，必须具有真实配音音频后才可合成完整成片，不能输出无声音频伪造成片。',
      });
    }

    // Check images
    for (let i = 0; i < scenes.length; i++) {
      if (!scenes[i].imageUrl) {
        const errMsg = `场景 ${i + 1} 尚未配置配图，请在第4步为其生成或上传图片后再合成。`;
        renderJobs.set(jobId, { status: 'failed', progress: 0, error: errMsg });
        return res.status(400).json({ error: errMsg });
      }
    }

    // Return jobId immediately so frontend can poll real progress!
    res.json({ jobId, message: '视频合成任务已提交并启动' });

    // Execute background FFmpeg compilation
    (async () => {
      const jobDir = path.join(TEMP_RENDER_DIR, jobId);
      fs.mkdirSync(jobDir, { recursive: true });

      try {
        renderJobs.set(jobId, { status: 'writing_assets', progress: 15 });

        // 1. Write audio file
        const audioBuffer = Buffer.from(audioBase64.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
        const audioPath = path.join(jobDir, 'narration.wav');
        fs.writeFileSync(audioPath, audioBuffer);

        // 2. Prepare scene images
        const imagePaths: string[] = [];
        for (let i = 0; i < scenes.length; i++) {
          const sc = scenes[i];
          const imgPath = path.join(jobDir, `scene_${i}.png`);

          if (sc.imageUrl.startsWith('data:image/svg+xml;utf8,') || sc.imageUrl.startsWith('data:image/svg+xml;base64,')) {
            const svgPath = path.join(jobDir, `raw_${i}.svg`);
            if (sc.imageUrl.startsWith('data:image/svg+xml;utf8,')) {
              const svgContent = decodeURIComponent(sc.imageUrl.replace('data:image/svg+xml;utf8,', ''));
              fs.writeFileSync(svgPath, svgContent);
            } else {
              const rawB64 = sc.imageUrl.replace('data:image/svg+xml;base64,', '');
              fs.writeFileSync(svgPath, Buffer.from(rawB64, 'base64'));
            }
            // Use librsvg built into ffmpeg to render crisp 1080x1920 PNG
            execSync(`ffmpeg -y -i "${svgPath}" -vf "scale=1080:1920" "${imgPath}"`);
          } else {
            const rawBase64 = sc.imageUrl.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(imgPath, Buffer.from(rawBase64, 'base64'));
          }
          imagePaths.push(imgPath);
        }

        renderJobs.set(jobId, { status: 'generating_subtitles', progress: 30 });

        // 3. Generate ASS Subtitle File with WenQuanYi Zen Hei Chinese Font
        const assPath = path.join(jobDir, 'subtitles.ass');
        const formatAssTime = (seconds: number) => {
          const h = Math.floor(seconds / 3600);
          const m = Math.floor((seconds % 3600) / 60);
          const s = Math.floor(seconds % 60);
          const ms = Math.floor((seconds % 1) * 100);
          return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        };

        const assHeader = `[Script Info]
Title: Novel Video Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,WenQuanYi Zen Hei,${subtitleStyle.fontSize || 42},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${subtitleStyle.outlineWidth || 3},2,2,40,40,${subtitleStyle.verticalMargin || 280},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        let assEvents = '';
        if (Array.isArray(subtitles) && subtitles.length > 0) {
          for (const sub of subtitles) {
            const startStr = formatAssTime(sub.start || 0);
            const endStr = formatAssTime(sub.end || 3);
            const cleanText = (sub.text || '').replace(/\n/g, '\\N');
            assEvents += `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${cleanText}\n`;
          }
        }
        fs.writeFileSync(assPath, assHeader + assEvents);

        renderJobs.set(jobId, { status: 'encoding_video', progress: 45 });

        // 4. Construct FFmpeg command
        // We will scale/pad each image to exact 1080x1920 portrait resolution
        // and loop each image for its specified duration.
        const outputVideoPath = path.join(jobDir, 'output.mp4');

        // Total calculated video duration
        const totalDuration = scenes.reduce((sum: number, sc: RenderSceneInput) => sum + (sc.duration || 4), 0);

        // Build concat demuxer file for robust multi-scene stitching
        const concatTxtPath = path.join(jobDir, 'concat.txt');
        let concatContent = '';
        for (let i = 0; i < scenes.length; i++) {
          const sc = scenes[i];
          const dur = Math.max(1, sc.duration || 4);
          concatContent += `file '${imagePaths[i]}'\n`;
          concatContent += `duration ${dur}\n`;
        }
        // Concat demuxer requirement: repeat last file without duration
        if (imagePaths.length > 0) {
          concatContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
        }
        fs.writeFileSync(concatTxtPath, concatContent);

        // Subtitle filter using ASS with libass
        const vfFilters = [
          // Scale to 1080:1920 keeping aspect ratio and crop/pad to center
          'scale=1080:1920:force_original_aspect_ratio=increase',
          'crop=1080:1920',
          'fps=30',
        ];

        // Add subtitles if present
        if (subtitles.length > 0) {
          vfFilters.push(`ass='${assPath}'`);
        }

        const vfString = vfFilters.join(',');

        const ffmpegArgs = [
          '-y',
          '-f', 'concat',
          '-safe', '0',
          '-i', concatTxtPath,
          '-i', audioPath,
          '-vf', vfString,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'medium',
          '-crf', '22',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-t', `${totalDuration}`, // Match scenes duration
          outputVideoPath,
        ];

        console.log(`Starting FFmpeg for job ${jobId}: ffmpeg ${ffmpegArgs.join(' ')}`);

        const ffmpegProc = spawn('ffmpeg', ffmpegArgs);

        ffmpegProc.stderr.on('data', (data) => {
          const str = data.toString();
          // Parse time for real progress: time=00:00:15.20
          const timeMatch = str.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch) {
            const h = parseFloat(timeMatch[1]);
            const m = parseFloat(timeMatch[2]);
            const s = parseFloat(timeMatch[3]);
            const currentSeconds = h * 3600 + m * 60 + s;
            const progress = Math.min(95, Math.round(45 + (currentSeconds / Math.max(1, totalDuration)) * 50));
            renderJobs.set(jobId, { status: 'rendering', progress });
          }
        });

        ffmpegProc.on('close', (code) => {
          if (code === 0 && fs.existsSync(outputVideoPath)) {
            // Success! Copy or expose as public download URL
            const publicFilename = `${jobId}.mp4`;
            const destPath = path.join(TEMP_RENDER_DIR, publicFilename);
            fs.copyFileSync(outputVideoPath, destPath);

            renderJobs.set(jobId, {
              status: 'completed',
              progress: 100,
              downloadUrl: `/rendered-videos/${publicFilename}`,
            });
            console.log(`Job ${jobId} rendered successfully! Available at /rendered-videos/${publicFilename}`);
          } else {
            console.error(`FFmpeg process failed with code ${code}`);
            renderJobs.set(jobId, {
              status: 'failed',
              progress: 0,
              error: `FFmpeg 渲染器退出代码异常 (code ${code})，请检查图片格式或字幕字符`,
            });
          }
        });
      } catch (err: any) {
        console.error(`Render background execution error for ${jobId}:`, err);
        renderJobs.set(jobId, { status: 'failed', progress: 0, error: err.message || '未知合成错误' });
      }
    })();
  } catch (err: any) {
    console.error('Render video API error:', err);
    return res.status(500).json({ error: `提交视频合成任务失败: ${err.message || '未知错误'}` });
  }
});

// ==========================================
// 9. Vite Dev Server 或 静态托管挂载
// ==========================================
const isProduction = process.env.NODE_ENV === 'production';
const httpServer = http.createServer(app);

if (isProduction) {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve('dist/index.html'));
  });
} else {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: isHmrDisabled ? false : { server: httpServer },
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[小说推文工坊] 服务运行于: http://0.0.0.0:${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Server] Port ${PORT} already in use; continuing...`);
  } else {
    console.error('[Server] Unexpected listen error:', err);
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
