/* ==========================================
   📋 全局类型定义（JSDoc）
   ========================================== */

/**
 * @typedef {'suzuki'|'beyer'|'pieces'|'free'|'review'} Category
 * 曲目分类：铃木 / 拜厄 / 小曲集 / 自由练习 / 复习
 */

/**
 * @typedef {'untouched'|'learning'|'learned'} PieceStatus
 * 曲目学习状态：未学 / 学习中 / 已学会
 */

/**
 * @typedef {0|1|2|3|4|5} Rating
 * 星星评分：0=未评分，1-5=星星数
 */

/**
 * @typedef {Object} SuzukiPiece
 * 铃木曲库静态数据条目
 * @property {string} id              唯一 ID（如 "s1-01"）
 * @property {number} book            册数
 * @property {number} num             在该册中的序号
 * @property {string} name            中文曲名
 * @property {string} en              英文曲名
 * @property {string} jp              日文曲名
 * @property {string} composer        作曲家
 * @property {1|2|3|4|5} difficulty   难度等级
 * @property {number} duration        预估演奏时长（分钟）
 */

/**
 * @typedef {Object} Repertoire
 * 曲库条目（在 SuzukiPiece 基础上扩展练习状态）
 * @property {string} id
 * @property {number} book
 * @property {number} num
 * @property {string} name
 * @property {string} en
 * @property {string} jp
 * @property {string} composer
 * @property {number} difficulty
 * @property {number} duration
 * @property {PieceStatus} status              学习状态
 * @property {boolean} memorized               是否能背谱
 * @property {boolean} handsTogether           是否合手
 * @property {string|null} startedDate         开始学习日期 YYYY-MM-DD
 * @property {string|null} completedDate       学会日期 YYYY-MM-DD
 * @property {number} totalMinutes             累计练习分钟
 * @property {number} practiceCount            练习次数
 * @property {string|null} lastPracticeDate    最后练习日期
 */

/**
 * @typedef {Object} LessonPiece
 * 课程中的一首曲目
 * @property {string} name                     曲目名称
 * @property {string} [repId]                  关联的曲库 ID
 * @property {Category} [category]             分类（默认 'suzuki'）
 * @property {string} [details]                老师的具体要求
 * @property {string[]} [focusAreas]           关注重点标签
 * @property {string} [composer]               作曲家
 */

/**
 * @typedef {Object} Lesson
 * 课程记录
 * @property {string} id                       唯一 ID
 * @property {string} date                     上课日期 YYYY-MM-DD
 * @property {LessonPiece[]} pieces            课程曲目列表
 * @property {string} [teacherNotes]           老师笔记
 */

/**
 * @typedef {Object} LogEntry
 * 练习日志中的一条记录（一首曲目）
 * @property {string} pieceName
 * @property {Category} category
 * @property {number} durationMin              练习时长（分钟）
 * @property {string} notes                    备注
 * @property {Rating} rating                   星星评分
 * @property {string} [repId]                  关联的曲库 ID
 * @property {number} [speed]                  练习速度 BPM
 * @property {boolean} [memorized]             是否背谱
 * @property {boolean} [handsTogether]         是否合手
 */

/**
 * @typedef {Object} Log
 * 每日练琴日志
 * @property {string} id
 * @property {string} date                     YYYY-MM-DD
 * @property {LogEntry[]} entries
 * @property {number} totalDurationMin         总时长（分钟）
 * @property {string} parentNotes              家长笔记
 * @property {string} [mood]                   心情
 * @property {string} [sticker]                贴纸
 */

/**
 * @typedef {Object} TodayPieceState
 * Today 页面单首曲目的运行时状态
 * @property {string} pieceName
 * @property {Rating} rating
 * @property {number} durationMin
 * @property {string} notes
 * @property {string|null} repId
 * @property {Category} category
 * @property {number} speed
 * @property {boolean} memorized
 * @property {boolean} handsTogether
 * @property {boolean} [reviewMem]             复习曲目背谱状态副本
 */
"use strict";

/* ==========================================
   📦 数据层 - LocalStorage 封装
   ========================================== */
const DB = {
  _key(k) { return 'piano_' + k; },

  get(key, fallback = null) {
    try {
      const value = localStorage.getItem(this._key(key));
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error('DB.get error:', key, error);
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('DB.set error:', key, error);
      if (error.name === 'QuotaExceededError') {
        alert('⚠️ 存储空间不足，请清理旧数据或联系开发者');
      }
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(this._key(key));
      return true;
    } catch (error) {
      console.error('DB.remove error:', key, error);
      return false;
    }
  },

  lessons() { return this.get('lessons', []); },
  saveLessons(data) { return this.set('lessons', data); },
  logs() { return this.get('logs', []); },
  saveLogs(data) { return this.set('logs', data); },
  repertoire() { return this.get('repertoire', []); },
  saveRepertoire(data) { return this.set('repertoire', data); },
  config() { return this.get('config', {}); },
  saveConfig(data) { return this.set('config', data); },
  bookMeta() { return this.get('bookMeta', {}); },
  saveBookMeta(data) { return this.set('bookMeta', data); },

  getStorageInfo() {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith('piano_')) {
        total += localStorage[key].length + key.length;
      }
    }
    return {
      used: total,
      usedKB: (total / 1024).toFixed(2),
      usedMB: (total / 1024 / 1024).toFixed(2)
    };
  }
};

/* ==========================================
   🛠️ 工具函数集合
   ========================================== */
const Utils = {
  // HTML 转义（防止 XSS）
  escape(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  
  // HTML 反转义
  unescape(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent;
  },
  
  // 获取今日日期 (YYYY-MM-DD)
  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  
  // 格式化日期：2024-03-15 → 3月15日
  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    } catch (error) {
      return dateStr;
    }
  },
  
  // 格式化日期：2024-03-15 → 03-15
  formatDateShort(dateStr) {
    if (!dateStr) return '';
    return dateStr.slice(5);
  },
  
  // 格式化日期：2024-03-15 → 2024年3月15日
  formatDateFull(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } catch (error) {
      return dateStr;
    }
  },
  
  // 计算日期差（天数）
  daysBetween(date1, date2) {
    const d1 = new Date(date1 + 'T00:00:00');
    const d2 = new Date(date2 + 'T00:00:00');
    const diff = Math.abs(d2 - d1);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  },
  
  // 生成唯一 ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  
  // 防抖函数
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // 节流函数
  throttle(func, limit = 200) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  // 深拷贝（优先使用 structuredClone，性能/正确性更好）
  deepClone(obj) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(obj); } catch (e) {}
    }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      console.error('deepClone error:', error);
      return obj;
    }
  },
  
  // 数组去重
  unique(arr, key) {
    if (!key) {
      return [...new Set(arr)];
    }
    const seen = new Set();
    return arr.filter(item => {
      const val = item[key];
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  },
  
  // 格式化时长：120秒 → 02:00
  formatDuration(seconds) {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },
  
  // 随机数
  random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  // 随机打乱数组
  shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },
  
  // 延迟执行
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // 复制到剪贴板
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      }
    } catch (error) {
      console.error('copyToClipboard error:', error);
      return false;
    }
  },
  
  // 显示 Toast 提示
  showToast(message, type = 'info', duration = 2000) {
    // 移除旧的 toast
    const oldToast = document.querySelector('.toast');
    if (oldToast) oldToast.remove();
    
    // 创建新的 toast
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    // 支持 HTML 内容（用于新纪录徽章等）
    if (typeof message === 'string' && message.includes('<')) {
      toast.innerHTML = message;
      toast.style.padding = '16px 20px';
      toast.style.borderRadius = '16px';
      toast.style.fontSize = '0.85rem';
      toast.style.fontWeight = '400';
    } else {
      toast.textContent = message;
    }
    toast.style.cssText = `
      position: fixed;
      top: calc(var(--safe-top, 0px) + 20px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--elevated);
      color: var(--text-1);
      padding: 12px 24px;
      border-radius: var(--r-full);
      box-shadow: var(--shadow-lg);
      z-index: 9999;
      font-size: 0.9rem;
      font-weight: 600;
      backdrop-filter: saturate(180%) blur(20px);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      animation: toast-in 0.3s var(--ease-spring);
      border: 1px solid var(--border-1);
      max-width: 90vw;
    `;
    
    if (type === 'success') {
      toast.style.background = 'var(--accent-green-soft)';
      toast.style.color = 'var(--accent-green)';
      toast.style.borderColor = 'var(--accent-green)';
    } else if (type === 'error') {
      toast.style.background = 'rgba(255, 107, 107, 0.2)';
      toast.style.color = 'var(--accent-red)';
      toast.style.borderColor = 'var(--accent-red)';
    } else if (type === 'warning') {
      toast.style.background = 'rgba(245, 216, 154, 0.2)';
      toast.style.color = 'var(--accent-yellow)';
      toast.style.borderColor = 'var(--accent-yellow)';
    }
    
    document.body.appendChild(toast);
    
    // 添加动画样式
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // 自动移除
    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s var(--ease-out)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

/* ==========================================
   🎵 铃木钢琴曲库数据
   ========================================== */
const SUZUKI_DATA = [
  // ===== Book 1 (18首) =====
  {
    id: "s1-01",
    book: 1,
    num: 1,
    name: "小星星变奏曲",
    en: "Twinkle, Twinkle, Little Star Variations",
    jp: "きらきらぼし変奏曲",
    composer: "铃木镇一",
    difficulty: 1,
    duration: 3 // 预估演奏时长（分钟）
  },
  {
    id: "s1-02",
    book: 1,
    num: 2,
    name: "小蜜蜂",
    en: "The Honeybee",
    jp: "ぶんぶんぶん",
    composer: "Folk Song",
    difficulty: 1,
    duration: 1
  },
  {
    id: "s1-03",
    book: 1,
    num: 3,
    name: "布谷鸟",
    en: "Cuckoo",
    jp: "かっこう",
    composer: "Folk Song",
    difficulty: 1,
    duration: 1
  },
  {
    id: "s1-04",
    book: 1,
    num: 4,
    name: "轻轻划",
    en: "Lightly Row",
    jp: "こぎつね",
    composer: "Folk Song",
    difficulty: 1,
    duration: 1
  },
  {
    id: "s1-05",
    book: 1,
    num: 5,
    name: "法国童谣",
    en: "French Children's Song",
    jp: "フランスのこどもの歌",
    composer: "Folk Song",
    difficulty: 1,
    duration: 1
  },
  {
    id: "s1-06",
    book: 1,
    num: 6,
    name: "伦敦桥",
    en: "London Bridge",
    jp: "ロンドン橋",
    composer: "Folk Song",
    difficulty: 1,
    duration: 1
  },
  {
    id: "s1-07",
    book: 1,
    num: 7,
    name: "玛丽有只小羔羊",
    en: "Mary Had a Little Lamb",
    jp: "メリーさんのひつじ",
    composer: "Folk Song",
    difficulty: 1,
    duration: 1
  },
  {
    id: "s1-08",
    book: 1,
    num: 8,
    name: "告诉罗迪阿姨",
    en: "Go Tell Aunt Rhody",
    jp: "おばあさんに伝えて",
    composer: "Folk Song",
    difficulty: 1,
    duration: 1
  },
  {
    id: "s1-09",
    book: 1,
    num: 9,
    name: "月光下",
    en: "Au Clair de la Lune",
    jp: "月の光に",
    composer: "J.B. Lully",
    difficulty: 2,
    duration: 1
  },
  {
    id: "s1-10",
    book: 1,
    num: 10,
    name: "很久以前",
    en: "Long, Long Ago",
    jp: "むかし、むかし",
    composer: "T.H. Bayly",
    difficulty: 2,
    duration: 2
  },
  {
    id: "s1-11",
    book: 1,
    num: 11,
    name: "小伙伴",
    en: "Little Playmates",
    jp: "小さな遊び仲間",
    composer: "F.X. Chwatal",
    difficulty: 2,
    duration: 1
  },
  {
    id: "s1-12",
    book: 1,
    num: 12,
    name: "阿拉伯之歌",
    en: "Chant Arabe",
    jp: "アラビアの歌",
    composer: "Anonymous",
    difficulty: 2,
    duration: 1
  },
  {
    id: "s1-13",
    book: 1,
    num: 13,
    name: "小快板1",
    en: "Allegretto 1",
    jp: "アレグレット 1",
    composer: "C. Czerny",
    difficulty: 2,
    duration: 1
  },
  {
    id: "s1-14",
    book: 1,
    num: 14,
    name: "告别冬天",
    en: "Good-bye to Winter",
    jp: "冬よさようなら",
    composer: "Folk Song",
    difficulty: 2,
    duration: 1
  },
  {
    id: "s1-15",
    book: 1,
    num: 15,
    name: "小快板2",
    en: "Allegretto 2",
    jp: "アレグレット 2",
    composer: "C. Czerny",
    difficulty: 2,
    duration: 1
  },
  {
    id: "s1-16",
    book: 1,
    num: 16,
    name: "圣诞节的秘密",
    en: "Christmas-Day Secrets",
    jp: "クリスマスの秘密",
    composer: "T. Dutton",
    difficulty: 2,
    duration: 2
  },
  {
    id: "s1-17",
    book: 1,
    num: 17,
    name: "快板",
    en: "Allegro",
    jp: "アレグロ",
    composer: "铃木镇一",
    difficulty: 3,
    duration: 2
  },
  {
    id: "s1-18",
    book: 1,
    num: 18,
    name: "风笛舞曲",
    en: "Musette",
    jp: "ミュゼット",
    composer: "Anonymous",
    difficulty: 3,
    duration: 2
  },
  
  // ===== Book 2 (14首) =====
  {
    id: "s2-01",
    book: 2,
    num: 1,
    name: "埃科塞兹舞曲",
    en: "Écossaise",
    jp: "エコセーズ",
    composer: "J.N. Hummel",
    difficulty: 3,
    duration: 2
  },
  {
    id: "s2-02",
    book: 2,
    num: 2,
    name: "小故事",
    en: "A Short Story",
    jp: "短いお話",
    composer: "H. Lichner",
    difficulty: 3,
    duration: 2
  },
  {
    id: "s2-03",
    book: 2,
    num: 3,
    name: "快乐的农夫",
    en: "The Happy Farmer",
    jp: "楽しい農夫",
    composer: "R. Schumann",
    difficulty: 3,
    duration: 1
  },
  {
    id: "s2-04",
    book: 2,
    num: 4,
    name: "G小调小步舞曲 第一首",
    en: "Minuet 1, Klavier Suite in g minor",
    jp: "メヌエット 1",
    composer: "J.S. Bach",
    difficulty: 4,
    duration: 2
  },
  {
    id: "s2-05",
    book: 2,
    num: 5,
    name: "小步舞曲 第二首",
    en: "Minuet 2, Notebook for AMB",
    jp: "メヌエット 2",
    composer: "Anonymous",
    difficulty: 4,
    duration: 2
  },
  {
    id: "s2-06",
    book: 2,
    num: 6,
    name: "小步舞曲 第三首",
    en: "Minuet 3",
    jp: "メヌエット 3",
    composer: "C. Petzold",
    difficulty: 4,
    duration: 2
  },
  {
    id: "s2-07",
    book: 2,
    num: 7,
    name: "G小调小步舞曲",
    en: "Minuet, Klavier Suite in g minor",
    jp: "メヌエット",
    composer: "J.S. Bach",
    difficulty: 4,
    duration: 3
  },
  {
    id: "s2-08",
    book: 2,
    num: 8,
    name: "摇篮曲",
    en: "Cradle Song",
    jp: "子守歌",
    composer: "C.M. von Weber",
    difficulty: 3,
    duration: 2
  },
  {
    id: "s2-09",
    book: 2,
    num: 9,
    name: "小步舞曲 K.2",
    en: "Minuet K.2",
    jp: "メヌエット K.2",
    composer: "W.A. Mozart",
    difficulty: 4,
    duration: 2
  },
  {
    id: "s2-10",
    book: 2,
    num: 10,
    name: "小咏叹调",
    en: "Arietta",
    jp: "アリエッタ",
    composer: "W.A. Mozart",
    difficulty: 3,
    duration: 1
  },
  {
    id: "s2-11",
    book: 2,
    num: 11,
    name: "旋律",
    en: "Melody",
    jp: "メロディー",
    composer: "R. Schumann",
    difficulty: 3,
    duration: 2
  },
  {
    id: "s2-12",
    book: 2,
    num: 12,
    name: "小奏鸣曲",
    en: "Sonatina",
    jp: "ソナチネ",
    composer: "L. van Beethoven",
    difficulty: 4,
    duration: 3
  },
  {
    id: "s2-13",
    book: 2,
    num: 13,
    name: "风笛舞曲",
    en: "Musette, English Suite No.3",
    jp: "ミュゼット",
    composer: "J.S. Bach",
    difficulty: 4,
    duration: 2
  },
  {
    id: "s2-14",
    book: 2,
    num: 14,
    name: "小步舞曲",
    en: "Minuet, Notebook for AMB",
    jp: "メヌエット",
    composer: "C. Petzold",
    difficulty: 4,
    duration: 3
  }
];

/* ==========================================
   🎵 小曲集（小川一郎）曲库数据
   ========================================== */

const OGATA_DATA = [
  // ===== Book 1 (拜尔10号程度，7首) =====
  { id: "o1-01", book: 21, num: 1, name: "多来米法梭之歌", en: "Do Re Mi Fa Sol Song", jp: "ドレミファソの歌", composer: "", difficulty: 1, duration: 1 },
  { id: "o1-02", book: 21, num: 2, name: "歌调", en: "Melody", jp: "メロディー", composer: "", difficulty: 1, duration: 1 },
  { id: "o1-03", book: 21, num: 3, name: "蝴蝶", en: "Butterfly", jp: "ちょうちょ", composer: "", difficulty: 1, duration: 1 },
  { id: "o1-04", book: 21, num: 4, name: "圆舞曲", en: "Waltz", jp: "ワルツ", composer: "", difficulty: 1, duration: 1 },
  { id: "o1-05", book: 21, num: 5, name: "雨滴的舞蹈", en: "Dance of Raindrops", jp: "雨粒の舞", composer: "J. Engel", difficulty: 1, duration: 1 },
  { id: "o1-06", book: 21, num: 6, name: "小蜜蜂", en: "The Honeybee", jp: "ぶんぶんぶん", composer: "", difficulty: 1, duration: 1 },
  { id: "o1-07", book: 21, num: 7, name: "德国之歌", en: "German Song", jp: "ドイツの歌", composer: "", difficulty: 1, duration: 1 },

  // ===== Book 2 (拜尔20号程度，5首) =====
  { id: "o2-01", book: 22, num: 8, name: "水车", en: "Waterwheel", jp: "水車", composer: "Jensen", difficulty: 2, duration: 2 },
  { id: "o2-02", book: 22, num: 9, name: "铃", en: "Bell", jp: "すず", composer: "J. Pierpont", difficulty: 2, duration: 1 },
  { id: "o2-03", book: 22, num: 10, name: "优柔的圆舞曲", en: "Gentle Waltz", jp: "優しいワルツ", composer: "Gurlitt", difficulty: 2, duration: 2 },
  { id: "o2-04", book: 22, num: 11, name: "春之歌", en: "Spring Song", jp: "春の歌", composer: "J. Thompson", difficulty: 2, duration: 2 },
  { id: "o2-05", book: 22, num: 12, name: "五月", en: "May", jp: "五月", composer: "F. Behr", difficulty: 2, duration: 2 },

  // ===== Book 3 (拜尔30号程度，6首) =====
  { id: "o3-01", book: 23, num: 13, name: "欢喜之歌", en: "Song of Joy", jp: "歓びの歌", composer: "Beethoven", difficulty: 3, duration: 2 },
  { id: "o3-02", book: 23, num: 14, name: "小孩之歌", en: "Children's Song", jp: "子供の歌", composer: "F. Behr", difficulty: 3, duration: 2 },
  { id: "o3-03", book: 23, num: 15, name: "可爱的小朋友", en: "Lovely Children", jp: "かわいい子供たち", composer: "F. X. Chwatal", difficulty: 3, duration: 2 },
  { id: "o3-04", book: 23, num: 16, name: "三个钟", en: "Three Bells", jp: "三つの鐘", composer: "Williams", difficulty: 3, duration: 2 },
  { id: "o3-05", book: 23, num: 17, name: "布谷鸟", en: "Cuckoo", jp: "かっこう", composer: "奥国民谣", difficulty: 3, duration: 1 },
  { id: "o3-06", book: 23, num: 18, name: "小河的水车", en: "Waterwheel by the Stream", jp: "小川の水車", composer: "W. Tschirch", difficulty: 3, duration: 2 },

  // ===== Book 4 (拜尔40号程度，6首) =====
  { id: "o4-01", book: 24, num: 19, name: "吹土巴的小孩", en: "The Little Trumpeter", jp: "トランペット吹きの子", composer: "Levine", difficulty: 4, duration: 2 },
  { id: "o4-02", book: 24, num: 20, name: "雪", en: "Snow", jp: "雪", composer: "J. Thompson", difficulty: 4, duration: 2 },
  { id: "o4-03", book: 24, num: 21, name: "钢管乐队的练习", en: "Brass Band Practice", jp: "金管楽団の練習", composer: "Aaron", difficulty: 4, duration: 2 },
  { id: "o4-04", book: 24, num: 22, name: "魔术", en: "Magic", jp: "マジック", composer: "L. Streabbeg", difficulty: 4, duration: 2 },
  { id: "o4-05", book: 24, num: 23, name: "厌烦的啄木鸟", en: "The Bored Woodpecker", jp: "退屈なキツツキ", composer: "J. Thompson", difficulty: 4, duration: 2 },
  { id: "o4-06", book: 24, num: 24, name: "泉", en: "Spring", jp: "泉", composer: "T. H. Oesten", difficulty: 4, duration: 2 },

  // ===== Book 5 (拜尔50号程度，4首) =====
  { id: "o5-01", book: 25, num: 25, name: "响音器", en: "Chime", jp: "チャイム", composer: "C. Czerny", difficulty: 5, duration: 2 },
  { id: "o5-02", book: 25, num: 26, name: "主题与变奏曲", en: "Theme and Variations", jp: "主題と変奏曲", composer: "J. W. Schaum", difficulty: 5, duration: 3 },
  { id: "o5-03", book: 25, num: 27, name: "狮子大游行", en: "The Lion's Parade", jp: "ライオン大行進", composer: "Saint-Saëns", difficulty: 5, duration: 3 },
  { id: "o5-04", book: 25, num: 28, name: "往事难忘", en: "Long, Long Ago", jp: "むかし、むかし", composer: "T. H. Bayly", difficulty: 5, duration: 2 },

  // ===== Book 6 (拜尔60号程度，5首) =====
  { id: "o6-01", book: 26, num: 29, name: "人鱼之歌", en: "Mermaid's Song", jp: "人魚の歌", composer: "C.M.von Weber", difficulty: 6, duration: 3 },
  { id: "o6-02", book: 26, num: 30, name: "故乡的小河", en: "My Hometown Stream", jp: "故郷の小川", composer: "K.Ounold", difficulty: 6, duration: 2 },
  { id: "o6-03", book: 26, num: 31, name: "造船之歌", en: "Song of Shipbuilding", jp: "造船の歌", composer: "R. Sheffer", difficulty: 6, duration: 2 },
  { id: "o6-04", book: 26, num: 32, name: "果树园满花开", en: "Orchard in Bloom", jp: "果樹園の花", composer: "G. H. Davis", difficulty: 6, duration: 2 },
  { id: "o6-05", book: 26, num: 33, name: "美洲土风舞", en: "American Folk Dance", jp: "アメリカンフォークダンス", composer: "W. P.Mero", difficulty: 6, duration: 2 },

  // ===== Book 7 (拜尔70号程度，7首) =====
  { id: "o7-01", book: 27, num: 34, name: "嗒喀钟", en: "Tick Tock Clock", jp: "チクタク時計", composer: "C. Czerny", difficulty: 7, duration: 2 },
  { id: "o7-02", book: 27, num: 35, name: "动物园开假时", en: "At the Zoo", jp: "動物園で", composer: "Williams", difficulty: 7, duration: 2 },
  { id: "o7-03", book: 27, num: 36, name: "破雪疾驱", en: "Dashing Through the Snow", jp: "雪をかき分けて", composer: "J. C. Castle", difficulty: 7, duration: 2 },
  { id: "o7-04", book: 27, num: 37, name: "跳着圆舞曲", en: "Waltzing", jp: "ワルツを踊って", composer: "M. R. Jesse", difficulty: 7, duration: 2 },
  { id: "o7-05", book: 27, num: 38, name: "可爱的奥古斯丁", en: "Lovely Augustine", jp: "かわいいアウグスティン", composer: "德国民谣", difficulty: 7, duration: 2 },
  { id: "o7-06", book: 27, num: 39, name: "德国民谣", en: "German Folk Song", jp: "ドイツ民謡", composer: "L. Köhler", difficulty: 7, duration: 2 },
  { id: "o7-07", book: 27, num: 40, name: "测验摇篮歌", en: "Cradle Song Test", jp: "子守歌のテスト", composer: "B. Frost", difficulty: 7, duration: 2 },

  // ===== Book 8 (拜尔80号程度，11首) =====
  { id: "o8-01", book: 28, num: 41, name: "测验月光", en: "Moonlight Test", jp: "月光のテスト", composer: "B. Frost", difficulty: 8, duration: 2 },
  { id: "o8-02", book: 28, num: 42, name: "余兴用橘子狂想曲", en: "Orange Rhapsody", jp: "みかんラプソディー", composer: "J. Engel", difficulty: 8, duration: 3 },
  { id: "o8-03", book: 28, num: 43, name: "老乡亲", en: "Old Folks at Home", jp: "故郷の人々", composer: "S. Foster", difficulty: 8, duration: 3 },
  { id: "o8-04", book: 28, num: 44, name: "乡下的舞蹈", en: "Country Dance", jp: "田舎のダンス", composer: "Fr. Hunten", difficulty: 8, duration: 2 },
  { id: "o8-05", book: 28, num: 45, name: "牧歌", en: "Pastoral", jp: "牧歌", composer: "Burgmüller", difficulty: 8, duration: 3 },
  { id: "o8-06", book: 28, num: 46, name: "小孩的谢肉祭", en: "Children's Carnival", jp: "子供の謝肉祭", composer: "L. Streabhog", difficulty: 8, duration: 2 },
  { id: "o8-07", book: 28, num: 47, name: "海滨游戏", en: "Seaside Play", jp: "海辺の遊び", composer: "L. Köhler", difficulty: 8, duration: 2 },
  { id: "o8-08", book: 28, num: 48, name: "在墨西哥", en: "In Mexico", jp: "メキシコで", composer: "Aaron", difficulty: 8, duration: 2 },
  { id: "o8-09", book: 28, num: 49, name: "芭蕾舞女", en: "Ballerina", jp: "バレリーナ", composer: "M. Littoff", difficulty: 8, duration: 2 },
  { id: "o8-10", book: 28, num: 50, name: "小舞曲", en: "Minuet", jp: "メヌエット", composer: "F. J. Haydn", difficulty: 8, duration: 2 },
  { id: "o8-11", book: 28, num: 51, name: "抒情调", en: "Arioso", jp: "アリオソ", composer: "J. S. Bach", difficulty: 8, duration: 3 },

  // ===== Book 9 (拜尔90号程度，6首) =====
  { id: "o9-01", book: 29, num: 52, name: "印第安人的祈雨舞", en: "Indian Rain Dance", jp: "インディアンの雨乞い舞", composer: "J. Stockbridge", difficulty: 9, duration: 3 },
  { id: "o9-02", book: 29, num: 53, name: "五月的微风", en: "May Breeze", jp: "五月のそよ風", composer: "B. Rolesth", difficulty: 9, duration: 3 },
  { id: "o9-03", book: 29, num: 54, name: "吟诵", en: "Chant", jp: "吟詠", composer: "Keanum", difficulty: 9, duration: 2 },
  { id: "o9-04", book: 29, num: 55, name: "月亮", en: "Moon", jp: "月", composer: "德国民谣", difficulty: 9, duration: 2 },
  { id: "o9-05", book: 29, num: 56, name: "欢喜", en: "Joy", jp: "歓喜", composer: "L. Köhler", difficulty: 9, duration: 2 },
  { id: "o9-06", book: 29, num: 57, name: "紫罗兰", en: "Violet", jp: "スミレ", composer: "L. Streabhog", difficulty: 9, duration: 3 },

  // ===== Book 10 (拜尔100号程度，6首) =====
  { id: "o10-01", book: 30, num: 58, name: "游泳池", en: "Swimming Pool", jp: "プール", composer: "M. Adler", difficulty: 10, duration: 3 },
  { id: "o10-02", book: 30, num: 59, name: "阿拉贝斯克", en: "Arabesque", jp: "アラベスク", composer: "Burgmüller", difficulty: 10, duration: 3 },
  { id: "o10-03", book: 30, num: 60, name: "转动的独乐儿", en: "Spinning Top", jp: "まわし独楽", composer: "H. M. Gregor", difficulty: 10, duration: 2 },
  { id: "o10-04", book: 30, num: 61, name: "舞蹈的时间", en: "Dance Time", jp: "ダンスの時間", composer: "H. Lichner", difficulty: 10, duration: 2 },
  { id: "o10-05", book: 30, num: 62, name: "进行曲「快乐的休假」", en: "March: Happy Vacation", jp: "行進曲「楽しい休暇」", composer: "Kinball", difficulty: 10, duration: 3 },
  { id: "o10-06", book: 30, num: 63, name: "屋顶的鸽子", en: "Pigeons on the Roof", jp: "屋根のハト", composer: "W. Fink", difficulty: 10, duration: 2 },

  // ===== Book 11 (拜尔100号以后，6首) =====
  { id: "o11-01", book: 31, num: 64, name: "河畔明月", en: "Moon Over the River", jp: "川辺の月", composer: "美国民谣", difficulty: 11, duration: 3 },
  { id: "o11-02", book: 31, num: 65, name: "狩猎", en: "The Hunt", jp: "狩猟", composer: "Burgmüller", difficulty: 11, duration: 3 },
  { id: "o11-03", book: 31, num: 66, name: "飞着雪鹰", en: "Flying Snow Eagle", jp: "雪鷹の飛行", composer: "L. Köhler", difficulty: 11, duration: 3 },
  { id: "o11-04", book: 31, num: 67, name: "波罗希斯舞曲", en: "Polonaise", jp: "ポロネーズ", composer: "A. Schmoll", difficulty: 11, duration: 3 },
  { id: "o11-05", book: 31, num: 68, name: "平安夜", en: "Silent Night", jp: "聖なる夜", composer: "F. Gruber", difficulty: 11, duration: 3 },
  { id: "o11-06", book: 31, num: 69, name: "土耳其进行曲", en: "Turkish March", jp: "トルコ行進曲", composer: "Beethoven", difficulty: 11, duration: 3 }
];

