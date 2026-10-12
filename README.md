# 小说推文工坊 Novel-to-Video Studio

一站式小说短视频推文制作工具。输入小说文本，经过 AI 改编脚本、分镜拆解、插画生成、配音合成，最终导出 9:16 竖屏视频，适配抖音/快手等平台。

## 功能概览

**5 步工作流：**

1. **导入小说** — 支持 TXT / Markdown / DOCX / EPUB，自动分章（中文章回体/英文 Chapter），支持长篇小说库管理与跨章节背景检索
2. **生成脚本** — AI 将小说片段改编为短视频口播旁白，可配置时长（30-120秒）、叙事风格、视角、钩子强度等参数，支持微调（重写开头/扩写/缩写/润色）
3. **分镜拆解** — AI 将旁白自动拆分为连续场景，每个场景包含画面描述、英文生图 Prompt、镜头构图、情绪氛围
4. **素材制作** — AI 角色设定提取、逐场景插画生成、TTS 配音、字幕编辑（支持 SRT 导出）
5. **视频合成** — 服务端 FFmpeg 渲染，ASS 字幕烧录，实时进度轮询，输出 1080×1920 MP4

**其他功能：**

- AI 管理中心 — 多供应商 API Key 管理、模型切换、连接测试、调用日志审计
- 工程持久化 — IndexedDB 自动保存，支持 JSON 工程文件导入/导出
- 长篇小说库 — 独立存储整部小说，按章节浏览、索引、选段创建推文项目

## AI 供应商

| 能力 | 主力供应商 | 备用供应商 |
|------|-----------|-----------|
| 文本生成（脚本/分镜/角色） | DeepSeek | Google Gemini |
| 图像生成（场景插画） | 火山引擎 Ark（豆包 Seedream） | Google Gemini |
| 语音合成（TTS 配音） | MiniMax Speech | Google Gemini TTS |

所有供应商支持运行时热切换，主力不可用时自动降级到备用。

## 快速开始

### 环境要求

- Node.js ≥ 18 或 Bun
- FFmpeg（视频合成必需）

### 安装与运行

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GEMINI_API_KEY（必填），其他 Key 可在 Web 端 AI 管理中心配置

# 启动开发服务器（Express + Vite，端口 3000）
bun run dev
```

浏览器打开 `http://localhost:3000`。

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `GEMINI_API_KEY` | 是 | Google Gemini API Key |
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API Key |
| `VOLCENGINE_API_KEY` | 否 | 火山引擎 Ark API Key |
| `MINIMAX_API_KEY` | 否 | MiniMax 语音 API Key |
| `AI_CONFIG_SECRET` | 否 | API Key 加密存储密钥（有默认值） |

除 `GEMINI_API_KEY` 外，其余 Key 均可在运行后通过 Web 端 AI 管理中心配置和加密存储。

## 技术栈

- **前端**：React 19 + Tailwind CSS v4 + Vite 8 + Lucide Icons
- **后端**：Express + tsx（单进程，开发模式下集成 Vite 中间件）
- **AI 集成**：Google GenAI SDK、DeepSeek / 火山引擎 / MiniMax REST API
- **文档解析**：mammoth（DOCX）、adm-zip（EPUB）
- **视频合成**：FFmpeg（child_process.spawn）
- **持久化**：IndexedDB（前端）、AES-256-GCM 加密 JSON（服务端 API Key）

## 可用脚本

```bash
bun run dev      # 开发服务器
bun run build    # 生产构建
bun run preview  # 预览生产构建
bun run lint     # TypeScript 类型检查
bun run clean    # 清理 dist 目录
```

## 项目状态

本项目为个人学习项目，功能完整但不再积极开发。在"AI 文字成片"赛道上，剪映等成熟产品已提供更完善的体验和生态闭环。本项目的技术实现（多供应商 AI 调度、文档解析、FFmpeg 合成管线）仍可作为学习参考。

## License

MIT
