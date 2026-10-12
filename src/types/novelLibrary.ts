export interface LibraryChapter {
  id: string;
  index: number;
  title: string;
  content: string;
  wordCount: number;
  summary?: string;
  characters?: string[];
  keyEvents?: string[];
}

export interface LibraryNovel {
  id: string;
  title: string;
  author?: string;
  fileName: string;
  fileType: 'docx' | 'txt' | 'md' | 'epub';
  totalWordCount: number;
  totalChapters: number;
  chapters: LibraryChapter[];
  rawFullText: string; // Pristine original text, never overwritten
  createdAt: number;
  updatedAt: number;
  status: 'ready' | 'parsing' | 'error';
  tags?: string[];
  description?: string;
}

export interface ChapterSliceSelection {
  novelId: string;
  novelTitle: string;
  chapterId: string;
  chapterIndex: number;
  chapterTitle: string;
  selectedText: string;
  wordCount: number;
  isFullChapter: boolean;
  sliceStartOffset?: number;
  sliceEndOffset?: number;
  includeContextBackground: boolean;
  contextSummary?: string;
}
