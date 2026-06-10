"use strict";

/* ==========================================
   🎼 曲库初始化与管理
   ========================================== */

"use strict";

const RepertoireManager = {
  // 曲库版本（升级时递增）
  VERSION: 3,
  
  // 初始化曲库
  init() {
    const storedVersion = localStorage.getItem('piano_rep_version');
    const currentRep = DB.repertoire();
    
    // 如果版本不匹配或曲库为空，重新初始化
    if (!currentRep.length || storedVersion != this.VERSION) {
      console.log('Initializing repertoire, version:', this.VERSION);
      
      const repertoire = SUZUKI_DATA.map(piece => ({
        ...piece,
        // 默认状态：Book 1 全部已学会，Book 2 前 4 首已学会
        status: piece.book === 1 ? 'learned' : 
                (piece.book === 2 && piece.num <= 4 ? 'learned' : 'untouched'),
        // 默认背谱：Book 1 全部可背谱，Book 2 前 4 首可背谱
        memorized: piece.book === 1 ? true : 
                   (piece.book === 2 && piece.num <= 4 ? true : false),
        // 学习日期
        startedDate: null,
        completedDate: piece.book === 1 ? '2026-01-01' : 
                       (piece.book === 2 && piece.num <= 4 ? '2026-03-01' : null),
        // 总练习时长（分钟）
        totalMinutes: 0,
        // 练习次数
        practiceCount: 0,
        // 最后练习日期
        lastPracticeDate: null,
        // 合手/分手
        handsTogether: true
      }));
      
      DB.saveRepertoire(repertoire);
      localStorage.setItem('piano_rep_version', this.VERSION);
      
      Utils.showToast('✅ 曲库已初始化', 'success');
    }
  },
  
  // 根据 ID 查找曲目
  findById(id) {
    return DB.repertoire().find(p => p.id === id);
  },
  
  // 根据名称查找曲目（模糊匹配）
  findByName(name) {
    if (!name) return null;
    const rep = DB.repertoire();
    // 精确匹配
    let match = rep.find(p => p.name === name || p.en === name);
    if (match) return match;
    // 模糊匹配
    return rep.find(p => 
      p.name.includes(name) || 
      name.includes(p.name) ||
      p.en.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(p.en.toLowerCase())
    );
  },
  
  // 获取指定 book 的所有曲目
  getByBook(bookNum) {
    return DB.repertoire().filter(p => p.book === bookNum);
  },
  
  // 获取已学会的曲目
  getLearned() {
    return DB.repertoire().filter(p => p.status === 'learned');
  },
  
  // 获取正在学习的曲目
  getLearning() {
    return DB.repertoire().filter(p => p.status === 'learning');
  },
  
  // 更新曲目状态
  updateStatus(id, status) {
    const rep = DB.repertoire();
    const piece = rep.find(p => p.id === id);
    if (!piece) return false;
    
    const today = Utils.today();
    piece.status = status;
    
    if (status === 'learning' && !piece.startedDate) {
      piece.startedDate = today;
    } else if (status === 'learned' && !piece.completedDate) {
      piece.completedDate = today;
    } else if (status === 'untouched') {
      piece.startedDate = null;
      piece.completedDate = null;
      piece.memorized = false;
    }
    
    DB.saveRepertoire(rep);
    return true;
  },
  
  // 切换背谱状态
  toggleMemorized(id) {
    const rep = DB.repertoire();
    const piece = rep.find(p => p.id === id);
    if (!piece) return false;

    piece.memorized = !piece.memorized;
    DB.saveRepertoire(rep);
    return piece.memorized;
  },

  setMemorized(id, value) {
    const rep = DB.repertoire();
    const piece = rep.find(p => p.id === id);
    if (!piece) return false;
    piece.memorized = value;
    DB.saveRepertoire(rep);
    return true;
  },

  setHandsTogether(id, value) {
    const rep = DB.repertoire();
    const piece = rep.find(p => p.id === id);
    if (!piece) return false;
    piece.handsTogether = value;
    DB.saveRepertoire(rep);
    return true;
  },
  
  // 记录练习
  recordPractice(id, minutes) {
    const rep = DB.repertoire();
    const piece = rep.find(p => p.id === id);
    if (!piece) return false;
    
    piece.totalMinutes = (piece.totalMinutes || 0) + minutes;
    piece.practiceCount = (piece.practiceCount || 0) + 1;
    piece.lastPracticeDate = Utils.today();
    
    DB.saveRepertoire(rep);
    return true;
  },
  
  // 随机获取复习曲目
  getRandomReview(count = 4, excludeNames = [], bookFilter = null) {
    const learned = DB.repertoire().filter(p => {
      if (p.status !== 'learned') return false;
      if (excludeNames.includes(p.name)) return false;
      if (bookFilter && p.book !== bookFilter) return false;
      return true;
    });
    
    return Utils.shuffle(learned).slice(0, count);
  },
  
  // 获取统计信息
  getStats() {
    const rep = DB.repertoire();
    return {
      total: rep.length,
      learned: rep.filter(p => p.status === 'learned').length,
      learning: rep.filter(p => p.status === 'learning').length,
      untouched: rep.filter(p => p.status === 'untouched').length,
      memorized: rep.filter(p => p.memorized).length,
      totalMinutes: rep.reduce((sum, p) => sum + (p.totalMinutes || 0), 0)
    };
  },

  // 获取所有分册列表
  getBookList() {
    const rep = DB.repertoire();
    const books = new Set(rep.map(p => p.book));
    return [...books].sort((a, b) => a - b);
  },

  // 获取下一个曲目编号
  getNextNum(book) {
    const rep = DB.repertoire().filter(p => p.book === book);
    if (!rep.length) return 1;
    return Math.max(...rep.map(p => p.num || 0)) + 1;
  },

  // 添加新曲目
  addPiece(pieceData) {
    const rep = DB.repertoire();
    const id = 's' + pieceData.book + '-' + String(pieceData.num).padStart(2, '0');
    rep.push({
      id,
      book: pieceData.book,
      num: pieceData.num,
      name: pieceData.name,
      en: pieceData.en || '',
      jp: pieceData.jp || '',
      composer: pieceData.composer || '',
      difficulty: pieceData.difficulty || 1,
      duration: pieceData.duration || 1,
      status: 'untouched',
      memorized: false,
      startedDate: null,
      completedDate: null,
      totalMinutes: 0,
      practiceCount: 0,
      lastPracticeDate: null,
      handsTogether: true
    });
    DB.saveRepertoire(rep);
    return true;
  },

  // 更新曲目信息
  updatePiece(id, updates) {
    const rep = DB.repertoire();
    const idx = rep.findIndex(p => p.id === id);
    if (idx < 0) return false;
    // 只允许更新元数据字段
    const allowed = ['name', 'en', 'jp', 'composer', 'difficulty', 'duration', 'book', 'num'];
    for (const key of allowed) {
      if (updates[key] !== undefined) rep[idx][key] = updates[key];
    }
    DB.saveRepertoire(rep);
    return true;
  },

  // 删除曲目
  removePiece(id) {
    const rep = DB.repertoire().filter(p => p.id !== id);
    DB.saveRepertoire(rep);
    return true;
  },

  // 重新编号指定册的曲目
  renumberBook(book) {
    const rep = DB.repertoire();
    const pieces = rep.filter(p => p.book === book).sort((a, b) => a.num - b.num);
    pieces.forEach((p, i) => {
      p.num = i + 1;
      p.id = 's' + book + '-' + String(i + 1).padStart(2, '0');
    });
    DB.saveRepertoire(rep);
  }
};

/* ==========================================
   📊 连续打卡计算
   ========================================== */
const StreakManager = {
  // 计算连续打卡天数
  calculate() {
    const logs = DB.logs();
    if (!logs.length) return 0;
    
    const dates = new Set(logs.map(log => log.date));
    let streak = 0;
    const today = new Date(Utils.today() + 'T00:00:00');
    
    // 从今天开始往前数
    while (true) {
      const dateStr = today.toISOString().slice(0, 10);
      if (dates.has(dateStr)) {
        streak++;
        today.setDate(today.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  },
  
  // 获取本月练习天数
  getMonthDays(year, month) {
    const logs = DB.logs();
    return logs.filter(log => {
      const date = new Date(log.date + 'T00:00:00');
      return date.getFullYear() === year && date.getMonth() === month;
    }).length;
  },
  
  // 获取本月练习总分钟数
  getMonthMinutes(year, month) {
    const logs = DB.logs();
    return logs.filter(log => {
      const date = new Date(log.date + 'T00:00:00');
      return date.getFullYear() === year && date.getMonth() === month;
    }).reduce((sum, log) => sum + (log.totalDurationMin || 0), 0);
  },
  
  // 获取总统计
  getTotalStats() {
    const logs = DB.logs();
    return {
      totalDays: logs.length,
      totalMinutes: logs.reduce((sum, log) => sum + (log.totalDurationMin || 0), 0),
      totalStars: logs.reduce((sum, log) => 
        sum + log.entries.reduce((s, e) => s + (e.rating || 0), 0), 0
      ),
      avgMinutesPerDay: logs.length ? 
        Math.round(logs.reduce((sum, log) => sum + (log.totalDurationMin || 0), 0) / logs.length) : 0
    };
  }
};

/* ==========================================
   📝 Logo 头像管理
   ========================================== */
const LogoManager = {
  // 加载头像
  load() {
    const saved = localStorage.getItem('piano_logo');
    const img = document.getElementById('logoImg');
    const placeholder = document.getElementById('logoPlaceholder');
    
    if (saved && img && placeholder) {
      img.src = saved;
      img.style.display = 'block';
      placeholder.style.display = 'none';
    }
  },
  
  // 上传并压缩头像
  upload(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select an image file'));
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          // 压缩图片到最大 200px
          const canvas = document.createElement('canvas');
          const maxSize = 200;
          let width = img.width;
          let height = img.height;
          
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          
          try {
            localStorage.setItem('piano_logo', compressed);
            this.load();
            Utils.showToast('✅ 头像更新成功', 'success');
            resolve(compressed);
          } catch (error) {
            reject(new Error('Storage error: ' + error.message));
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = e.target.result;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }
};

// 全局 Logo 上传处理函数
window.handleLogoUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    await LogoManager.upload(file);
  } catch (error) {
    console.error('Logo upload error:', error);
    Utils.showToast('❌ ' + error.message, 'error');
  }
};

/* ==========================================
   🎻 铃木曲目两级选择器辅助
   ========================================== */
const SuzukiSelectHelper = {
  // 获取所有分册
  getBooks() {
    const rep = DB.repertoire();
    const books = new Set(rep.map(p => p.book));
    return [...books].sort((a, b) => a - b);
  },

  // 获取指定册的曲目
  getPieces(book) {
    return DB.repertoire().filter(p => p.book === book).sort((a, b) => a.num - b.num);
  },

  // 构建 book select HTML
  buildBookSelect(selectedBook, cat, idx) {
    const books = this.getBooks();
    if (!selectedBook) selectedBook = books.includes(2) ? 2 : (books[0] || 1);
    return '<select class="form-input suzuki-book-select" data-cat="' + cat + '" data-idx="' + idx + '" onchange="onSuzukiBookChange(this)" style="padding:8px 10px;font-size:0.8rem;margin-bottom:6px">' +
      '<option value="">选择分册...</option>' +
      books.map(b => '<option value="' + b + '"' + (b == selectedBook ? ' selected' : '') + '>📖 Book ' + b + '</option>').join('') +
      '</select>';
  },

  // 构建 piece select HTML
  buildPieceSelect(book, cat, idx, repId, pieceName) {
    const dft = this.getBooks().includes(2) ? 2 : (this.getBooks()[0] || 1);
    const pieces = this.getPieces(book || dft);
    return '<select class="form-input piece-name-select suzuki-piece-select" data-cat="' + cat + '" data-idx="' + idx + '" style="padding:8px 10px;font-size:0.8rem">' +
      '<option value="">选择曲目...</option>' +
      pieces.map(rp => {
        const label = 'Book ' + rp.book + '-' + rp.num + ' ' + Utils.escape(rp.en) + ' ' + Utils.escape(rp.name);
        const selected = (repId && repId === rp.id) || pieceName === rp.name || pieceName === rp.en;
        return '<option value="' + Utils.escape(rp.name) + '" data-repid="' + rp.id + '"' + (selected ? ' selected' : '') + '>' + label + '</option>';
      }).join('') +
      '</select>';
  }
};

// book 切换时更新曲目列表
window.onSuzukiBookChange = function(bookSelect) {
  const book = parseInt(bookSelect.value) || 1;
  const cat = bookSelect.dataset.cat;
  const idx = bookSelect.dataset.idx;
  const pieceSelect = document.querySelector('.suzuki-piece-select[data-cat="' + cat + '"][data-idx="' + idx + '"]');
  if (!pieceSelect) return;
  const pieces = SuzukiSelectHelper.getPieces(book);
  pieceSelect.innerHTML = '<option value="">选择曲目...</option>' +
    pieces.map(rp => '<option value="' + Utils.escape(rp.name) + '" data-repid="' + rp.id + '">Book ' + rp.book + '-' + rp.num + ' ' + Utils.escape(rp.en) + ' ' + Utils.escape(rp.name) + '</option>').join('');
};

/* ==========================================
   🔄 同步码管理器
   ========================================== */
const SyncCode = {
  encode(data) {
    var json = JSON.stringify(data);
    var bytes = new TextEncoder().encode(json);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },

  decode(hash) {
    try {
      hash = hash.replace(/-/g, '+').replace(/_/g, '/');
      while (hash.length % 4) hash += '=';
      var binary = atob(hash);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      return null;
    }
  },

  generateCode() {
    var data = {
      v: 3,
      l: DB.lessons(),
      g: DB.logs(),
      r: DB.repertoire(),
      t: new Date().toISOString().slice(0, 10)
    };
    return this.encode(data);
  },

  importCode(codeStr) {
    var data = this.decode(codeStr);
    if (!data || !data.v) return { success: false, error: '无效的同步码' };

    var stats = { lessons: 0, logs: 0 };

    if (data.l && data.l.length) {
      var merged = {};
      DB.lessons().forEach(function(l) { merged[l.id] = l; });
      data.l.forEach(function(l) {
        if (!merged[l.id]) {
          merged[l.id] = l;
          stats.lessons++;
        } else if (l.date >= merged[l.id].date) {
          merged[l.id] = l;
          stats.lessons++;
        }
      });
      DB.saveLessons(Object.values(merged));
    }

    if (data.g && data.g.length) {
      var mergedLogs = {};
      DB.logs().forEach(function(l) { mergedLogs[l.id] = l; });
      data.g.forEach(function(l) {
        if (!mergedLogs[l.id]) {
          mergedLogs[l.id] = l;
          stats.logs++;
        } else if (l.entries.length > mergedLogs[l.id].entries.length) {
          mergedLogs[l.id] = l;
          stats.logs++;
        }
      });
      DB.saveLogs(Object.values(mergedLogs));
    }

    if (data.r && data.r.length && !DB.repertoire().length) {
      DB.saveRepertoire(data.r);
    }

    return { success: true, stats: stats };
  }
};

console.log('✅ Core modules loaded');
