import { NovelProject } from '../types/project';
import { LibraryNovel, LibraryChapter } from '../types/novelLibrary';

const DB_NAME = 'NovelToVideoStudioDB';
const DB_VERSION = 2; // Upgraded for full novel library store
const STORE_PROJECTS = 'projects';
const STORE_NOVEL_LIBRARY = 'novel_library';
const STORE_CURRENT_ID = 'currentProjectId';
const STORE_CURRENT_NOVEL_ID = 'currentNovelId';

export const createDefaultProject = (name: string = '新推文项目'): NovelProject => {
  const now = Date.now();
  return {
    id: `proj_${now}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    novel: {
      text: '',
      title: '',
      chapter: '',
      wordCount: 0,
      targetDuration: 60,
      narrativeStyle: '悬念反转',
      pov: '第一人称',
      hookStrength: '强钩子',
      adaptationDegree: '适度口语化',
      customInstructions: '',
    },
    script: {
      title: '',
      hook: '',
      narration: '',
      estimatedDuration: 60,
      emotionArc: '',
      endingHook: '',
      factCheckNotes: '',
      isModifiedByUser: false,
      history: [],
    },
    scenes: [],
    characters: [],
    audio: {
      duration: 0,
      sourceType: 'none',
    },
    subtitles: [],
    subtitleStyle: {
      fontSize: 40,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      bgMode: 'none',
      position: 'bottom-safe',
      verticalMargin: 260,
    },
    exportConfig: {
      applyKenBurns: true,
    },
  };
};

// Preset demo projects for rapid testing
export const PRESET_PROJECTS = [
  {
    title: '豪门真假千金的反击',
    chapter: '第一章：真假项链与绝地反击',
    sampleText: `回到林家的第三年，我才明白，血缘在二十年的养育之情面前，薄如蝉翼。
今天是我二十二岁生日，也是假千金林薇的生日。
宴会厅里宾客云集，母亲亲手把那条价值三千万的“海洋之心”祖母绿项链戴在林薇脖子上，眼神里满是宠溺：“薇薇，这是妈妈给你的成人礼，你在妈妈心里永远是不可替代的掌上明珠。”
而递给我的，却是一个随意装在绒布盒里的普通银手镯。
林薇端着红酒走到我面前，嘴角挂着无辜的微笑，声音却只有我们两人听得见：“姐姐，就算你身上流着林家的血又怎样？在这个家里，大家眼里只有我。你永远只是个乡下来的外人。”
周围的宾客纷纷奉承林薇举止优雅，甚至有人对我指指点点，说我小家子气上不得台面。
我没有像三年前那样委屈落泪，只是平静地看着林薇脖子上的项链，淡淡地笑了笑。
他们不知道的是，真正的“海洋之心”早在半年前就被林氏集团以抵押形式私下转让给了京城神秘投资人，以填补林氏海外项目的巨额亏损。而林薇此刻戴着的，不过是她生母为了撑场面找高仿作坊做出来的假货。
更没人知道，那个在幕后低价收购林氏核心股份、掌控他们生杀大权的神秘投资公司幕后法人，正是我。
林薇还在洋洋得意，我拿出手机，当着所有媒体记者的面，拨通了工商与质检部门的电话。`,
    duration: 60,
    style: '悬念反转',
    pov: '第一人称',
  },
  {
    title: '深渊之眼：雾夜寻凶',
    chapter: '第三章：消失的第十三号储物柜',
    sampleText: `雨夜的滨海老火车站，空气中弥漫着铁锈与湿冷海水的气味。
刑警陆巡推开废弃行李寄存处的锈蚀铁门，手电筒的光柱切开浓重的霉尘。
十分钟前，局里收到一封匿名加密邮件，里面只有一张照片和一个坐标：站台尽头第十三号储物柜。
但按照车站当年的建筑图纸，这一排储物柜从一号编号到十二号，根本不存在第十三号。
陆巡用戴着白手套的手指扣开最底层的铁皮接缝。
伴随着刺耳的嘎吱声，暗层被缓缓抽开，里面赫然躺着一只沾着暗红污渍的老式卡式录音机，以及一枚刻着警徽的磨损打火机。
那枚打火机属于他的师父——八年前在一桩悬案中离奇失踪的老刑警陈岩。
陆巡的瞳孔骤然收缩，呼吸几乎停滞。
他按下播放键，磁带沙沙转动，扬声器里传出的却不是师父的声音，而是一个被电子变声器处理过的冰冷声线：
“陆警官，你终于来了。八年前陈岩不是失踪，而是被你们警局内部的人亲手推进了深渊。今晚十二点，带着打火机到灯塔，不要报警，否则真相将永远沉入海底。”`,
    duration: 60,
    style: '悬念反转',
    pov: '第三人称',
  },
];

// Preset full multi-chapter novel for library demonstration
export const PRESET_FULL_NOVEL: LibraryNovel = {
  id: 'preset_novel_haomen',
  title: '豪门真假千金传',
  author: '墨砚声',
  fileName: '豪门真假千金传.docx',
  fileType: 'docx',
  totalWordCount: 3120,
  totalChapters: 3,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
  status: 'ready',
  description: '真千金隐忍归来，暗中收购家族集团股份，在生日宴与董事会上层层反击偏心养母与虚伪养女的现代商战豪门故事。',
  rawFullText: `第一章 生日宴上的真假项链
回到林家的第三年，我才明白，血缘在二十年的养育之情面前，薄如蝉翼。
今天是我二十二岁生日，也是假千金林薇的生日。
宴会厅里宾客云集，母亲亲手把那条价值三千万的“海洋之心”祖母绿项链戴在林薇脖子上，眼神里满是宠溺：“薇薇，这是妈妈给你的成人礼，你在妈妈心里永远是不可替代的掌上明珠。”
而递给我的，却是一个随意装在绒布盒里的普通银手镯。
林薇端着红酒走到我面前，嘴角挂着无辜的微笑，声音却只有我们两人听得见：“姐姐，就算你身上流着林家的血又怎样？在这个家里，大家眼里只有我。你永远只是个乡下来的外人。”
周围的宾客纷纷奉承林薇举止优雅，甚至有人对我指指点点，说我小家子气上不得台面。
我没有像三年前那样委屈落泪，只是平静地看着林薇脖子上的项链，淡淡地笑了笑。
他们不知道的是，真正的“海洋之心”早在半年前就被林氏集团以抵押形式私下转让给了京城神秘投资人，以填补林氏海外项目的巨额亏损。而林薇此刻戴着的，不过是她生母为了撑场面找高仿作坊做出来的假货。
更没人知道，那个在幕后低价收购林氏核心股份、掌控他们生杀大权的神秘投资公司幕后法人，正是我。
林薇还在洋洋得意，我拿出手机，当着所有媒体记者的面，拨通了工商与质检部门的电话。

第二章 虚伪的母爱与暗流涌动
电话拨出后不到二十分钟，两名执法人员走进了宴会厅。
母亲林夫人脸色大变，厉声斥责我：“林夕！今天是薇薇的大好日子，你叫这些人来干什么？你是想丢尽我们林家的脸吗？”
我神色自若地放下酒杯：“母亲，有人用假冒伪劣珠宝在公开场合招摇撞骗，若是被媒体曝光，受损的才是林家的声誉。我这是在替林家未雨绸缪。”
林薇闻言眼圈瞬间红了，扑进林夫人怀里哭泣：“妈妈，姐姐为什么要这么针对我？如果不喜欢我戴这条项链，我摘下来还给姐姐就是了……”
宾客们纷纷指责我不识大体，林父更是气得拍桌子要将我赶出家门。
然而，当质检专家当场取出光谱仪检测，大屏幕上赫然显示出“合成锆石与树脂仿制品”的结果时，全场瞬间鸦雀无声。
林夫人的手在发抖，林薇的脸色惨白如纸。
我看着这一家人的窘态，微笑着收起手机。这只是第一步，真正的杀手锏还在后头。

第三章 董事会上的生死宣判
次日清晨九点，林氏集团紧急召开特别董事会。
因为昨晚的假项链丑闻，林氏旗下的珠宝连锁品牌股价开盘即跌停。
林父在董事会上焦头烂额，急于宣布将林薇指定为集团第三代继承人，试图挽回市场信心。
“我提议，将林氏集团百分之十五的核心投票权转让给林薇小姐……”林父的声音还在会议室回荡。
厚重的实木大门突然被推开。
我身穿干练的黑色高定西装，在四名法务顾问的陪同下缓步走入。
“林董事长，恐怕你没有权力转让这百分之十五的股份。”我将一份公证文件轻轻放在会议桌中央。
林父拍案而起：“林夕，这里是集团董事会，不是你胡闹的地方！”
“林先生，请看清楚公证书。”我的首席律师语气平静而冰冷，“半年前林氏向鼎峰资本抵押的百分之三十五股份，由于逾期未清偿本息，已于今晨八点整全额转入鼎峰资本旗下。而鼎峰资本的唯一控股人兼董事长——正是林夕女士。”
整个会议室陷入死一般的寂静。
林薇瘫软在椅子上，林父颤抖着拿起文件，终于看清了落款处那个他从不正眼看待的名字。`,
  chapters: [
    {
      id: 'chap_preset_1',
      index: 1,
      title: '第一章 生日宴上的真假项链',
      content: `回到林家的第三年，我才明白，血缘在二十年的养育之情面前，薄如蝉翼。
今天是我二十二岁生日，也是假千金林薇的生日。
宴会厅里宾客云集，母亲亲手把那条价值三千万的“海洋之心”祖母绿项链戴在林薇脖子上，眼神里满是宠溺：“薇薇，这是妈妈给你的成人礼，你在妈妈心里永远是不可替代的掌上明珠。”
而递给我的，却是一个随意装在绒布盒里的普通银手镯。
林薇端着红酒走到我面前，嘴角挂着无辜的微笑，声音却只有我们两人听得见：“姐姐，就算你身上流着林家的血又怎样？在这个家里，大家眼里只有我。你永远只是个乡下来的外人。”
周围的宾客纷纷奉承林薇举止优雅，甚至有人对我指指点点，说我小家子气上不得台面。
我没有像三年前那样委屈落泪，只是平静地看着林薇脖子上的项链，淡淡地笑了笑。
他们不知道的是，真正的“海洋之心”早在半年前就被林氏集团以抵押形式私下转让给了京城神秘投资人，以填补林氏海外项目的巨额亏损。而林薇此刻戴着的，不过是她生母为了撑场面找高仿作坊做出来的假货。
更没人知道，那个在幕后低价收购林氏核心股份、掌控他们生杀大权的神秘投资公司幕后法人，正是我。
林薇还在洋洋得意，我拿出手机，当着所有媒体记者的面，拨通了工商与质检部门的电话。`,
      wordCount: 520,
      summary: '真假千金二十二岁生日宴，偏心养母将三千万项链赠予假千金林薇，真千金林夕仅得地摊手镯。殊不知项链是高仿，真千金已是神秘投资法人并报警揭穿。',
      characters: ['林夕 (真千金)', '林薇 (假千金)', '林夫人 (母亲)'],
      keyEvents: ['生日宴偏心赠礼', '林薇私语嘲讽', '真千金林夕致电质检揭发高仿项链'],
    },
    {
      id: 'chap_preset_2',
      index: 2,
      title: '第二章 虚伪的母爱与暗流涌动',
      content: `电话拨出后不到二十分钟，两名执法人员走进了宴会厅。
母亲林夫人脸色大变，厉声斥责我：“林夕！今天是薇薇的大好日子，你叫这些人来干什么？你是想丢尽我们林家的脸吗？”
我神色自若地放下酒杯：“母亲，有人用假冒伪劣珠宝在公开场合招摇撞骗，若是被媒体曝光，受损的才是林家的声誉。我这是在替林家未雨绸缪。”
林薇闻言眼圈瞬间红了，扑进林夫人怀里哭泣：“妈妈，姐姐为什么要这么针对我？如果不喜欢我戴这条项链，我摘下来还给姐姐就是了……”
宾客们纷纷指责我不识大体，林父更是气得拍桌子要将我赶出家门。
然而，当质检专家当场取出光谱仪检测，大屏幕上赫然显示出“合成锆石与树脂仿制品”的结果时，全场瞬间鸦雀无声。
林夫人的手在发抖，林薇的脸色惨白如纸。
我看着这一家人的窘态，微笑着收起手机。这只是第一步，真正的杀手锏还在后头。`,
      wordCount: 380,
      summary: '质检执法人员到场检测，当众揭露林薇所戴项链为树脂仿制品，林家父母与林薇颜面扫地，林夕从容收网。',
      characters: ['林夕', '林薇', '林夫人', '林父'],
      keyEvents: ['质检人员进场检测', '假项链当场现形', '林氏夫妇颜面尽失'],
    },
    {
      id: 'chap_preset_3',
      index: 3,
      title: '第三章 董事会上的生死宣判',
      content: `次日清晨九点，林氏集团紧急召开特别董事会。
因为昨晚的假项链丑闻，林氏旗下的珠宝连锁品牌股价开盘即跌停。
林父在董事会上焦头烂额，急于宣布将林薇指定为集团第三代继承人，试图挽回市场信心。
“我提议，将林氏集团百分之十五的核心投票权转让给林薇小姐……”林父的声音还在会议室回荡。
厚重的实木大门突然被推开。
我身穿干练的黑色高定西装，在四名法务顾问的陪同下缓步走入。
“林董事长，恐怕你没有权力转让这百分之十五的股份。”我将一份公证文件轻轻放在会议桌中央。
林父拍案而起：“林夕，这里是集团董事会，不是你胡闹的地方！”
“林先生，请看清楚公证书。”我的首席律师语气平静而冰冷，“半年前林氏向鼎峰资本抵押的百分之三十五股份，由于逾期未清偿本息，已于今晨八点整全额转入鼎峰资本旗下。而鼎峰资本的唯一控股人兼董事长——正是林夕女士。”
整个会议室陷入死一般的寂静。
林薇瘫软在椅子上，林父颤抖着拿起文件，终于看清了落款处那个他从不正眼看待的名字。`,
      wordCount: 460,
      summary: '因丑闻股价跌停，林父欲在董事会上立林薇为继承人。林夕率律师团队现身，拿出抵押违约清偿公证书，曝光自己鼎峰资本大股东身份，直接掌控林氏集团。',
      characters: ['林夕', '林父', '林薇', '律师顾问'],
      keyEvents: ['股价跌停紧急董事会', '林父强行转让投票权', '林夕亮出鼎峰控股权反客为主'],
    },
  ],
};

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_NOVEL_LIBRARY)) {
          db.createObjectStore(STORE_NOVEL_LIBRARY, { keyPath: 'id' });
        }
      };
    });

    return this.dbPromise;
  }

  // ==========================================
  // 推文工程项目 (Projects)
  // ==========================================
  async saveProject(project: NovelProject): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_PROJECTS], 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const toSave = { ...project, updatedAt: Date.now() };
      store.put(toSave);
      localStorage.setItem(STORE_CURRENT_ID, project.id);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('Error saving project to IndexedDB:', err);
    }
  }

  async loadProject(id: string): Promise<NovelProject | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_PROJECTS], 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.get(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Error loading project from IndexedDB:', err);
      return null;
    }
  }

  async getAllProjects(): Promise<Array<{ id: string; name: string; updatedAt: number; currentStep: number; sourceNovelId?: string }>> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_PROJECTS], 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const list = (request.result || []).map((p: NovelProject) => ({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt,
            currentStep: p.currentStep,
            sourceNovelId: p.novel?.sourceNovelId,
          }));
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(list);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Error getting all projects:', err);
      return [];
    }
  }

  async getLastActiveProject(): Promise<NovelProject | null> {
    const lastId = localStorage.getItem(STORE_CURRENT_ID);
    if (lastId) {
      const proj = await this.loadProject(lastId);
      if (proj) return proj;
    }
    const all = await this.getAllProjects();
    if (all.length > 0) {
      return await this.loadProject(all[0].id);
    }
    return null;
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction([STORE_PROJECTS], 'readwrite');
    const store = tx.objectStore(STORE_PROJECTS);
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        if (localStorage.getItem(STORE_CURRENT_ID) === id) {
          localStorage.removeItem(STORE_CURRENT_ID);
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ==========================================
  // 长篇小说资料库 (Novel Library)
  // ==========================================
  async saveLibraryNovel(novel: LibraryNovel): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_NOVEL_LIBRARY], 'readwrite');
      const store = tx.objectStore(STORE_NOVEL_LIBRARY);
      const toSave = { ...novel, updatedAt: Date.now() };
      store.put(toSave);
      localStorage.setItem(STORE_CURRENT_NOVEL_ID, novel.id);

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('Error saving novel to IndexedDB:', err);
      throw err;
    }
  }

  async loadLibraryNovel(id: string): Promise<LibraryNovel | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_NOVEL_LIBRARY], 'readonly');
      const store = tx.objectStore(STORE_NOVEL_LIBRARY);
      const request = store.get(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Error loading library novel:', err);
      return null;
    }
  }

  async getAllLibraryNovels(): Promise<LibraryNovel[]> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_NOVEL_LIBRARY], 'readonly');
      const store = tx.objectStore(STORE_NOVEL_LIBRARY);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const list: LibraryNovel[] = request.result || [];
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(list);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Error getting all library novels:', err);
      return [];
    }
  }

  async deleteLibraryNovel(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction([STORE_NOVEL_LIBRARY], 'readwrite');
    const store = tx.objectStore(STORE_NOVEL_LIBRARY);
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        if (localStorage.getItem(STORE_CURRENT_NOVEL_ID) === id) {
          localStorage.removeItem(STORE_CURRENT_NOVEL_ID);
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Export full novel JSON
  exportLibraryNovelJson(novel: LibraryNovel): string {
    return JSON.stringify(novel, null, 2);
  }

  // Export full project JSON
  exportProjectJson(project: NovelProject): string {
    return JSON.stringify(project, null, 2);
  }

  // Import project from JSON
  async importProjectJson(jsonStr: string): Promise<NovelProject> {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !parsed.name || !parsed.novel) {
      throw new Error('无效的工程文件格式');
    }
    const importedProject: NovelProject = {
      ...parsed,
      id: `proj_${Date.now()}_imported`,
      name: `${parsed.name} (导入)`,
      updatedAt: Date.now(),
    };
    await this.saveProject(importedProject);
    return importedProject;
  }

  // Storage usage estimate for capacity warning
  async getStorageUsageEstimate(): Promise<{ usedMB: number; quotaMB: number; percent: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usedMB = Math.round((est.usage || 0) / (1024 * 1024));
        const quotaMB = Math.round((est.quota || 0) / (1024 * 1024));
        const percent = quotaMB > 0 ? Math.round((usedMB / quotaMB) * 100) : 0;
        return { usedMB, quotaMB, percent };
      } catch (e) {
        // ignore
      }
    }
    return { usedMB: 0, quotaMB: 0, percent: 0 };
  }
}

export const projectStorage = new StorageService();
