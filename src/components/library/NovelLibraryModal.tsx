import React, { useState, useEffect, useRef } from 'react';
import { LibraryNovel, LibraryChapter, ChapterSliceSelection } from '../../types/novelLibrary';
import { projectStorage, PRESET_FULL_NOVEL } from '../../services/storage';
import { api } from '../../services/api';
import { downloadFile } from '../../utils/srt';
import {
  BookOpen,
  Library,
  Upload,
  Plus,
  Trash2,
  Search,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Edit2,
  Check,
  X,
  Split,
  Merge,
  RotateCcw,
  Sliders,
  HardDrive,
  Download,
  AlertTriangle,
  Bookmark,
  Users,
  Eye,
} from 'lucide-react';

interface NovelLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForCreation: (selection: ChapterSliceSelection) => void;
}

export const NovelLibraryModal: React.FC<NovelLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectForCreation,
}) => {
  const [novels, setNovels] = useState<LibraryNovel[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // Search & Filters
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');
  const [contentSearchQuery, setContentSearchQuery] = useState('');

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Chapter editing & reparse modal states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [showReparseModal, setShowReparseModal] = useState(false);
  const [customRegexPattern, setCustomRegexPattern] = useState('');
  const [isReparsing, setIsReparsing] = useState(false);

  // Chapter AI Indexing
  const [isIndexingChapter, setIsIndexingChapter] = useState(false);

  // Delete confirm
  const [novelToDelete, setNovelToDelete] = useState<LibraryNovel | null>(null);

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{ usedMB: number; quotaMB: number; percent: number }>({
    usedMB: 0,
    quotaMB: 0,
    percent: 0,
  });

  // Creation Scope Configuration Modal
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [creationMode, setCreationMode] = useState<'full_chapter' | 'custom_slice'>('full_chapter');
  const [includeContextBg, setIncludeContextBg] = useState(true);
  const [customSliceStart, setCustomSliceStart] = useState(0);
  const [customSliceEnd, setCustomSliceEnd] = useState(100);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load library novels from IndexedDB
  const refreshLibrary = async () => {
    try {
      const list = await projectStorage.getAllLibraryNovels();
      if (list.length === 0) {
        // Seed initial preset novel if library is empty
        await projectStorage.saveLibraryNovel(PRESET_FULL_NOVEL);
        setNovels([PRESET_FULL_NOVEL]);
        setSelectedNovelId(PRESET_FULL_NOVEL.id);
        setSelectedChapterId(PRESET_FULL_NOVEL.chapters[0]?.id || null);
      } else {
        setNovels(list);
        if (!selectedNovelId || !list.some((n) => n.id === selectedNovelId)) {
          setSelectedNovelId(list[0].id);
          setSelectedChapterId(list[0].chapters[0]?.id || null);
        }
      }

      const storage = await projectStorage.getStorageUsageEstimate();
      setStorageInfo(storage);
    } catch (e) {
      console.error('Failed to load novel library:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshLibrary();
    }
  }, [isOpen]);

  const activeNovel = novels.find((n) => n.id === selectedNovelId) || novels[0] || null;
  const activeChapter =
    activeNovel?.chapters.find((c) => c.id === selectedChapterId) ||
    activeNovel?.chapters[0] ||
    null;

  // Filtered chapters
  const filteredChapters = (activeNovel?.chapters || []).filter((chap) => {
    if (!chapterSearchQuery.trim()) return true;
    const q = chapterSearchQuery.toLowerCase();
    return chap.title.toLowerCase().includes(q) || chap.content.toLowerCase().includes(q);
  });

  // ==========================================
  // Novel Upload & Parsing
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgressText('正在读取并解析文档章节结构...');

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() as any;
      const parsed = await api.parseFile(file);

      const newNovelId = `novel_${Date.now()}`;
      const newChapters: LibraryChapter[] = (parsed.chapters || []).map((ch, idx) => ({
        id: `chap_${newNovelId}_${idx + 1}`,
        index: idx + 1,
        title: ch.title,
        content: ch.content,
        wordCount: ch.wordCount,
      }));

      const newNovel: LibraryNovel = {
        id: newNovelId,
        title: parsed.suggestedTitle || file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        fileType: ['docx', 'epub', 'md', 'txt'].includes(ext) ? ext : 'txt',
        totalWordCount: parsed.wordCount,
        totalChapters: newChapters.length,
        chapters: newChapters,
        rawFullText: parsed.text,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ready',
      };

      await projectStorage.saveLibraryNovel(newNovel);
      await refreshLibrary();
      setSelectedNovelId(newNovel.id);
      setSelectedChapterId(newNovel.chapters[0]?.id || null);
    } catch (err: any) {
      setUploadError(err.message || '上传解析小说失败，请重试');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ==========================================
  // Chapter Operations
  // ==========================================
  const handleSaveChapterTitle = async () => {
    if (!activeNovel || !activeChapter || !editingTitleValue.trim()) return;

    const updatedChapters = activeNovel.chapters.map((c) =>
      c.id === activeChapter.id ? { ...c, title: editingTitleValue.trim() } : c
    );

    const updatedNovel: LibraryNovel = {
      ...activeNovel,
      chapters: updatedChapters,
      updatedAt: Date.now(),
    };

    await projectStorage.saveLibraryNovel(updatedNovel);
    await refreshLibrary();
    setIsEditingTitle(false);
  };

  const handleReparseChapters = async () => {
    if (!activeNovel) return;
    setIsReparsing(true);
    try {
      const result = await api.reparseChapters(activeNovel.rawFullText, customRegexPattern);
      const newChapters: LibraryChapter[] = result.chapters.map((ch, idx) => ({
        id: `chap_${activeNovel.id}_${idx + 1}`,
        index: idx + 1,
        title: ch.title,
        content: ch.content,
        wordCount: ch.wordCount,
      }));

      const updatedNovel: LibraryNovel = {
        ...activeNovel,
        chapters: newChapters,
        totalChapters: newChapters.length,
        updatedAt: Date.now(),
      };

      await projectStorage.saveLibraryNovel(updatedNovel);
      await refreshLibrary();
      setSelectedChapterId(newChapters[0]?.id || null);
      setShowReparseModal(false);
    } catch (err: any) {
      alert(`重新分章失败: ${err.message}`);
    } finally {
      setIsReparsing(false);
    }
  };

  // AI Chapter Indexing
  const handleIndexActiveChapter = async () => {
    if (!activeNovel || !activeChapter) return;
    setIsIndexingChapter(true);
    try {
      const indexResult = await api.indexChapter({
        novelTitle: activeNovel.title,
        chapterTitle: activeChapter.title,
        content: activeChapter.content,
      });

      const updatedChapters = activeNovel.chapters.map((c) =>
        c.id === activeChapter.id
          ? {
              ...c,
              summary: indexResult.summary,
              characters: indexResult.characters,
              keyEvents: indexResult.keyEvents,
            }
          : c
      );

      const updatedNovel: LibraryNovel = {
        ...activeNovel,
        chapters: updatedChapters,
        updatedAt: Date.now(),
      };

      await projectStorage.saveLibraryNovel(updatedNovel);
      await refreshLibrary();
    } catch (err: any) {
      alert(`提取章节索引失败: ${err.message}`);
    } finally {
      setIsIndexingChapter(false);
    }
  };

  // Delete Novel
  const handleConfirmDelete = async () => {
    if (!novelToDelete) return;
    await projectStorage.deleteLibraryNovel(novelToDelete.id);
    setNovelToDelete(null);
    await refreshLibrary();
  };

  // Export Novel JSON
  const handleExportNovelBackup = (novel: LibraryNovel) => {
    const jsonStr = projectStorage.exportLibraryNovelJson(novel);
    downloadFile(jsonStr, `小说档案_${novel.title}.json`, 'application/json');
  };

  // ==========================================
  // Trigger Creation from Selected Chapter
  // ==========================================
  const handleConfirmCreation = () => {
    if (!activeNovel || !activeChapter) return;

    let targetText = activeChapter.content;
    const isFull = creationMode === 'full_chapter';

    if (!isFull) {
      const len = activeChapter.content.length;
      const startChar = Math.floor((customSliceStart / 100) * len);
      const endChar = Math.ceil((customSliceEnd / 100) * len);
      targetText = activeChapter.content.slice(startChar, endChar);
    }

    // Compose surrounding chapter context summary
    let contextSummary = '';
    if (includeContextBg) {
      const otherChapters = activeNovel.chapters.filter((c) => c.id !== activeChapter.id);
      const summaries = otherChapters
        .filter((c) => c.summary)
        .map((c) => `【${c.title}】: ${c.summary}`)
        .slice(0, 5);

      if (summaries.length > 0) {
        contextSummary = summaries.join('\n');
      } else {
        // Fallback: brief outline of adjacent chapters
        const prevChap = activeNovel.chapters.find((c) => c.index === activeChapter.index - 1);
        if (prevChap) {
          contextSummary = `前置章节【${prevChap.title}】截选开头：\n${prevChap.content.slice(0, 300)}...`;
        }
      }
    }

    const selection: ChapterSliceSelection = {
      novelId: activeNovel.id,
      novelTitle: activeNovel.title,
      chapterId: activeChapter.id,
      chapterIndex: activeChapter.index,
      chapterTitle: activeChapter.title,
      selectedText: targetText,
      wordCount: targetText.length,
      isFullChapter: isFull,
      includeContextBackground: includeContextBg,
      contextSummary: contextSummary || undefined,
    };

    onSelectForCreation(selection);
    setShowCreationModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden select-none">
      <div className="bg-stone-900 border border-stone-700 rounded-3xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 font-bold shadow-md shadow-amber-950/40">
              <Library className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-stone-100">
                  长篇小说资料库与章节管理
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">
                  已存 {novels.length} 部小说
                </span>
              </div>
              <p className="text-xs text-stone-400">
                一次导入完整长篇小说，按章节拆解管理。随时选取特定章节制作多条独立短视频推文，绝不覆盖原文。
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Storage indicator */}
            {storageInfo.quotaMB > 0 && (
              <div className="hidden md:flex items-center gap-2 text-[11px] text-stone-400 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  本地存储: {storageInfo.usedMB}MB / {storageInfo.quotaMB}MB ({storageInfo.percent}%)
                </span>
              </div>
            )}

            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.epub,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,text/plain,text/markdown"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? '解析中...' : '导入完整小说 (DOCX/EPUB/TXT/MD)'}</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {isUploading && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2 shrink-0 animate-pulse">
            <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span>{uploadProgressText}</span>
          </div>
        )}

        {/* Main Content Area (3-Column Layout) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Column 1: Novel List (Width: 260px) */}
          <div className="w-64 bg-stone-950/70 border-r border-stone-800 p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              <div className="px-2 py-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
                <span>书架小说 ({novels.length})</span>
              </div>

              {novels.map((novel) => {
                const isSelected = selectedNovelId === novel.id;
                return (
                  <div
                    key={novel.id}
                    onClick={() => {
                      setSelectedNovelId(novel.id);
                      setSelectedChapterId(novel.chapters[0]?.id || null);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer group relative ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-stone-900/60 hover:bg-stone-900 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-stone-100 truncate group-hover:text-amber-400 transition-colors">
                        《{novel.title}》
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 uppercase font-mono shrink-0">
                        {novel.fileType}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-400 font-mono">
                      <span>{novel.totalWordCount.toLocaleString()} 字</span>
                      <span>{novel.totalChapters} 章</span>
                    </div>

                    <div className="mt-1 text-[10px] text-stone-400">
                      {new Date(novel.createdAt).toLocaleDateString()} 导入
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Demo Seed Button */}
            <div className="pt-3 border-t border-stone-800/80">
              <button
                onClick={async () => {
                  const demoNovel = {
                    ...PRESET_FULL_NOVEL,
                    id: `demo_${Date.now()}`,
                    title: `豪门真假千金传 (${Date.now().toString().slice(-4)})`,
                  };
                  await projectStorage.saveLibraryNovel(demoNovel);
                  await refreshLibrary();
                  setSelectedNovelId(demoNovel.id);
                  setSelectedChapterId(demoNovel.chapters[0]?.id || null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>载入示范长篇小说</span>
              </button>
            </div>
          </div>

          {/* Column 2: Chapter Directory Sidebar (Width: 320px) */}
          <div className="w-80 bg-stone-900/60 border-r border-stone-800 p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              {/* Novel Title Banner & Reparse Trigger */}
              <div className="pb-2 border-b border-stone-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-100 truncate max-w-[180px]">
                    《{activeNovel?.title || '未选择小说'}》
                  </h3>
                  <span className="text-[11px] text-stone-400">
                    共 {activeNovel?.totalChapters || 0} 章 · {activeNovel?.totalWordCount || 0} 字
                  </span>
                </div>

                <button
                  onClick={() => setShowReparseModal(true)}
                  className="text-xs px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 flex items-center gap-1"
                  title="重新按自定义规则或正则划分章节"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>分章规则</span>
                </button>
              </div>

              {/* Chapter Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={chapterSearchQuery}
                  onChange={(e) => setChapterSearchQuery(e.target.value)}
                  placeholder="搜索章节名或章节内容..."
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Chapters List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredChapters.map((chap) => {
                  const isSelected = activeChapter?.id === chap.id;

                  return (
                    <div
                      key={chap.id}
                      onClick={() => setSelectedChapterId(chap.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold shadow-sm'
                          : 'bg-stone-950/60 hover:bg-stone-950 border-stone-800/80 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[200px] leading-tight">
                          {chap.title}
                        </span>
                        <span
                          className={`text-[10px] font-mono shrink-0 ml-1 ${
                            isSelected ? 'text-stone-950/80 font-bold' : 'text-stone-400'
                          }`}
                        >
                          {chap.wordCount}字
                        </span>
                      </div>

                      {chap.summary && (
                        <div
                          className={`mt-1 text-[10px] line-clamp-1 ${
                            isSelected ? 'text-stone-950/70 font-normal' : 'text-stone-400'
                          }`}
                        >
                          摘要: {chap.summary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Novel Backup & Delete */}
            {activeNovel && (
              <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
                <button
                  onClick={() => handleExportNovelBackup(activeNovel)}
                  className="hover:text-amber-400 flex items-center gap-1"
                  title="导出该小说完整数据备份 JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出备份</span>
                </button>

                <button
                  onClick={() => setNovelToDelete(activeNovel)}
                  className="hover:text-rose-400 flex items-center gap-1"
                  title="彻底从本地资料库删除该小说"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除小说</span>
                </button>
              </div>
            )}
          </div>

          {/* Column 3: Active Chapter Reader & Creation Launcher */}
          <div className="flex-1 bg-stone-950 p-6 flex flex-col justify-between overflow-y-auto">
            {activeChapter ? (
              <div className="space-y-5 max-w-4xl mx-auto w-full">
                {/* Chapter Title Bar */}
                <div className="pb-4 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          className="bg-stone-900 border border-amber-500 rounded-lg px-3 py-1.5 text-sm font-bold text-stone-100 focus:outline-none flex-1"
                        />
                        <button
                          onClick={handleSaveChapterTitle}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-stone-950 font-bold text-xs"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setIsEditingTitle(false)}
                          className="px-2 py-1.5 text-stone-400 text-xs"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold text-stone-100">
                          {activeChapter.title}
                        </h2>
                        <button
                          onClick={() => {
                            setEditingTitleValue(activeChapter.title);
                            setIsEditingTitle(true);
                          }}
                          className="p-1 text-stone-500 hover:text-amber-400 rounded transition-colors"
                          title="修改章节标题"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="text-xs text-stone-400 flex items-center gap-3 mt-1">
                      <span>章节字数：{activeChapter.wordCount} 字</span>
                      <span>序号：第 {activeChapter.index} 章</span>
                    </div>
                  </div>

                  {/* Top Right Action: Launch Video Creation */}
                  <button
                    onClick={() => setShowCreationModal(true)}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-lg shadow-amber-950/40 flex items-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>以此章节制作推文项目</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Chapter Summary / Index Info Card */}
                <div className="p-3.5 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                      <span>本章剧情摘要索引 (用于跨章节检索与辅助理解)：</span>
                    </div>
                    <p className="text-stone-400 text-[11px] leading-relaxed">
                      {activeChapter.summary || '尚未生成本章剧情摘要。点击右侧“AI 提炼本章要点”可快速索引。'}
                    </p>
                    {activeChapter.characters && activeChapter.characters.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-stone-400 pt-0.5">
                        <Users className="w-3 h-3 text-stone-400" />
                        <span>登场人物: {activeChapter.characters.join('、')}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleIndexActiveChapter}
                    disabled={isIndexingChapter}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-[11px] font-semibold shrink-0 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isIndexingChapter ? '提炼中...' : 'AI 提炼本章要点'}</span>
                  </button>
                </div>

                {/* Main Chapter Text Reader */}
                <div className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-6 text-sm text-stone-200 leading-relaxed font-sans whitespace-pre-wrap select-text max-h-[500px] overflow-y-auto">
                  {activeChapter.content}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-stone-500 space-y-2">
                <BookOpen className="w-12 h-12 stroke-1 mx-auto text-stone-600" />
                <p className="text-sm">请选择左侧章节进行阅读与创作</p>
              </div>
            )}
          </div>
        </div>

        {/* Creation Scope Selection Modal */}
        {showCreationModal && activeChapter && activeNovel && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-stone-100">
                    按需创作：选定推文改编范围
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreationModal(false)}
                  className="text-stone-400 hover:text-stone-200 text-sm"
                >
                  取消
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                  <div className="text-stone-400">选定来源：</div>
                  <div className="font-bold text-sm text-amber-400">
                    《{activeNovel.title}》· {activeChapter.title}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    全章字数：{activeChapter.wordCount} 字
                  </div>
                </div>

                {/* Scope Options */}
                <div className="space-y-2">
                  <label className="font-semibold text-stone-300 block">
                    选择本次改编文本范围：
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCreationMode('full_chapter')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        creationMode === 'full_chapter'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                          : 'bg-stone-950 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="text-xs">整章作为素材</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        适合完整单章情节推文
                      </div>
                    </button>

                    <button
                      onClick={() => setCreationMode('custom_slice')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        creationMode === 'custom_slice'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                          : 'bg-stone-950 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="text-xs">选定高潮切片</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        截选本章前段、中段或后段
                      </div>
                    </button>
                  </div>
                </div>

                {/* Slider if custom slice */}
                {creationMode === 'custom_slice' && (
                  <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl space-y-2">
                    <div className="flex justify-between text-[11px] text-stone-300">
                      <span>截选比例：从 {customSliceStart}% 到 {customSliceEnd}%</span>
                      <span className="font-mono text-amber-400">
                        约 {Math.round((activeChapter.wordCount * (customSliceEnd - customSliceStart)) / 100)} 字
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="range"
                        min="0"
                        max="80"
                        value={customSliceStart}
                        onChange={(e) => setCustomSliceStart(parseInt(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={customSliceEnd}
                        onChange={(e) => setCustomSliceEnd(parseInt(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* Context Background Toggle */}
                <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-stone-200">
                      开启 AI 跨章节背景关联（自动检索前情提要）
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      自动向模型提供前面章节的故事概要，确保人物动机、身份与背景因果准确无误。
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeContextBg}
                    onChange={(e) => setIncludeContextBg(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 cursor-pointer ml-3"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreationModal(false)}
                  className="px-3.5 py-2 text-xs text-stone-400 hover:text-stone-200 bg-stone-800 rounded-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmCreation}
                  className="px-5 py-2 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-md"
                >
                  确认并创建推文项目
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reparse Chapters Modal */}
        {showReparseModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Sliders className="w-5 h-5" />
                <h3 className="text-base font-bold text-stone-100">自定义章节划分规则</h3>
              </div>

              <p className="text-xs text-stone-300 leading-relaxed">
                系统默认使用中国网络小说通用正则（第X章/节/回、Chapter X 等）。如果您的文档章节格式特殊，可自定义正则表达式重新划分章节：
              </p>

              <div>
                <label className="text-xs text-stone-400 block mb-1">
                  自定义正则表达式模式（留空则使用默认通用规则）：
                </label>
                <input
                  type="text"
                  value={customRegexPattern}
                  onChange={(e) => setCustomRegexPattern(e.target.value)}
                  placeholder="如：第\\s*[0-9一二三四五六七八九十]+\\s*章"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowReparseModal(false)}
                  className="px-3.5 py-1.5 text-xs text-stone-400 hover:text-stone-200 bg-stone-800 rounded-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleReparseChapters}
                  disabled={isReparsing}
                  className="px-4 py-1.5 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl"
                >
                  {isReparsing ? '重新分章中...' : '应用并重新分章'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {novelToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-stone-100">二次删除确认</h3>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                确认从本地资料库中彻底删除小说《{novelToDelete.title}》吗？已基于该小说生成的推文项目仍会保留，不受影响。
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setNovelToDelete(null)}
                  className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 bg-stone-800 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
