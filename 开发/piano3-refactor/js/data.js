/* ==========================================
   🎹 哆哩钢琴助手 v3.1 - JavaScript 核心
   ========================================== */

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
  
  // 深拷贝
  deepClone(obj) {
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
    toast.textContent = message;
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

