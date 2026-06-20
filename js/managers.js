"use strict";
/* ==========================================
   🎼 曲库初始化与管理
   ========================================== */
"use strict";

const RepertoireManager = {
  // 曲库版本（升级时递增）
  VERSION: '3.4-20260620',

  // 初始化曲库
  init() {
    const storedVersion = localStorage.getItem('piano_rep_version');
    const currentRep = DB.repertoire();

    // 如果版本不匹配或曲库为空，重新初始化
    if (!currentRep.length || storedVersion != this.VERSION) {
      console.log('Initializing repertoire, version:', this.VERSION);

      // 合并铃木和小曲集数据
      const allData = [...SUZUKI_DATA, ...OGATA_DATA];

      const repertoire = allData.map(piece => ({
        ...piece,
        // 默认状态：铃木 Book 1 全部已学会，Book 2 前 4 首已学会；小曲集默认未学
        status: piece.id.startsWith('s') ? (
          piece.book === 1 ? 'learned' :
          (piece.book === 2 && piece.num <= 4 ? 'learned' : 'untouched')
        ) : 'untouched',
        // 默认背谱：铃木 Book 1 全部可背谱，Book 2 前 4 首可背谱；小曲集默认不可背谱
        memorized: piece.id.startsWith('s') ? (
          piece.book === 1 ? true :
          (piece.book === 2 && piece.num <= 4 ? true : false)
        ) : false,
        // 学习日期
        startedDate: null,
        completedDate: piece.id.startsWith('s') ? (
          piece.book === 1 ? '2026-01-01' :
          (piece.book === 2 && piece.num <= 4 ? '2026-03-01' : null)
        ) : null,
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

  // 记录练习（自动从 untouched 升级为 learning）
  recordPractice(id, minutes) {
    const rep = DB.repertoire();
    const piece = rep.find(p => p.id === id);
    if (!piece) return false;
    if (piece.status === 'untouched') {
      piece.status = 'learning';
      if (!piece.startedDate) piece.startedDate = Utils.today();
    }
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

  // 判断是否为自定义册（bookNum >= 1000）
  isCustomBook(bookNum) {
    return Number(bookNum) >= 1000;
  },

  // 获取所有分册列表（不含自定义册，自定义册不显示在曲库页面）
  getBookList() {
    const rep = DB.repertoire();
    const books = new Set(rep.map(p => p.book));
    return [...books].filter(b => !this.isCustomBook(b)).sort((a, b) => a - b);
  },

  // 获取下一个可用的自定义册号
  getNextCustomBookNum() {
    const meta = DB.bookMeta();
    const used = Object.keys(meta).map(n => Number(n)).filter(n => n >= 1000);
    if (!used.length) return 1000;
    return Math.max(...used) + 1;
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
  },

  /**
   * 获取一本册的显示名称（优先用 bookMeta，否则用默认命名）
   * @param {number} bookNum - 册号
   * @returns {string} 显示名称（如 "铃木第一册"、"小曲集第一册"、"Book 3"）
   */
  getBookDisplayName(bookNum) {
    const meta = DB.bookMeta();
    if (meta[bookNum]) return meta[bookNum];
    // 小曲集（bookNum 21-31，对应拜尔10-110号）
    if (bookNum >= 21 && bookNum <= 31) {
      const beyerLevel = (bookNum - 20) * 10;
      return `小曲集-拜尔${beyerLevel}号`;
    }
    // 铃木
    if (bookNum === 1) return '铃木第一册';
    if (bookNum === 2) return '铃木第二册';
    return 'Book ' + bookNum;
  },

  // 数字转中文
  _toChineseNum(n) {
    const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'];
    return cn[n - 1] || n;
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
  // 获取所有分册（不含自定义册）
  getBooks() {
    const rep = DB.repertoire();
    const books = new Set(rep.map(p => p.book));
    return [...books].filter(b => !RepertoireManager.isCustomBook(b)).sort((a, b) => a - b);
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
      books.map(b => '<option value="' + b + '"' + (b == selectedBook ? ' selected' : '') + '>📖 ' + Utils.escape(RepertoireManager.getBookDisplayName(b)) + '</option>').join('') +
      '</select>';
  },

  // 构建 piece select HTML
  // 注：label 不再重复显示册名（册名已在上方分册下拉显示），只显示「编号 英文 中文」
  buildPieceSelect(book, cat, idx, repId, pieceName) {
    const dft = this.getBooks().includes(2) ? 2 : (this.getBooks()[0] || 1);
    const pieces = this.getPieces(book || dft);
    return '<select class="form-input piece-name-select suzuki-piece-select" data-cat="' + cat + '" data-idx="' + idx + '" style="padding:8px 10px;font-size:0.8rem">' +
      '<option value="">选择曲目...</option>' +
      pieces.map(rp => {
        const label = rp.num + ' ' + Utils.escape(rp.en) + ' ' + Utils.escape(rp.name);
        const selected = (repId && repId === rp.id) || (!repId && (pieceName === rp.name || pieceName === rp.en));
        return '<option value="' + rp.id + '" data-name="' + Utils.escape(rp.name) + '"' + (selected ? ' selected' : '') + '>' + label + '</option>';
      }).join('') +
      '</select>';
  }
};

// book 切换时更新曲目列表
// 注：label 不再重复显示册名（册名已在上方分册下拉显示）
window.onSuzukiBookChange = function(bookSelect) {
  const book = parseInt(bookSelect.value) || 1;
  const cat = bookSelect.dataset.cat;
  const idx = bookSelect.dataset.idx;
  const pieceSelect = document.querySelector('.suzuki-piece-select[data-cat="' + cat + '"][data-idx="' + idx + '"]');
  if (!pieceSelect) return;

  const pieces = SuzukiSelectHelper.getPieces(book);
  pieceSelect.innerHTML = '<option value="">选择曲目...</option>' +
    pieces.map(rp => '<option value="' + rp.id + '" data-name="' + Utils.escape(rp.name) + '">' + rp.num + ' ' + Utils.escape(rp.en) + ' ' + Utils.escape(rp.name) + '</option>').join('');
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

   /**
   * 检测导入数据与当前版本的差异
   * @param {Object} data 解码后的导入数据
   * @returns {Object} { compatible: boolean, issues: string[] }
   */
  detectIssues(data) {
    var issues = [];

    if (data.l && data.l.length) {
      var sampleLesson = data.l[0];
      if (sampleLesson.pieces && sampleLesson.pieces.length) {
        var samplePiece = sampleLesson.pieces[0];
        if (samplePiece.book === undefined) {
          issues.push('课程数据缺少 book（册号）字段');
        }
        if (!samplePiece.repId) {
          issues.push('课程数据缺少 repId（曲库关联 ID）字段');
        }
      }
    }

    if (data.g && data.g.length) {
      var sampleLog = data.g[0];
      if (sampleLog.entries && sampleLog.entries.length) {
        var sampleEntry = sampleLog.entries[0];
        if (sampleEntry.book === undefined) {
          issues.push('练习日志缺少 book（册号）字段');
        }
        if (!sampleEntry.category) {
          issues.push('练习日志缺少 category（分类）字段');
        }
      }
    }

    if (data.r && data.r.length) {
      var sampleRep = data.r[0];
      if (sampleRep.lastPracticeDate === undefined && sampleRep.memorized === undefined) {
        issues.push('曲库数据缺少练习状态字段（将使用默认值）');
      }
    }

    if (data.v && data.v < 3) {
      issues.push('数据来自旧版本 v' + data.v + '（当前 v3）');
    }

    return {
      compatible: issues.length === 0,
      issues: issues
    };
  },

  /**
   * 自动补全 lessons 中缺失的 book 和 repId 字段
   * @param {Array} lessons
   * @returns {Array}
   */
  migrateLessons(lessons) {
    var rep = DB.repertoire();
    lessons.forEach(function(lesson) {
      if (!lesson.pieces) return;
      lesson.pieces.forEach(function(piece) {
        if (!piece.repId) {
          var found = rep.find(function(r) {
            return r.name === piece.name || r.en === piece.name;
          });
          if (found) piece.repId = found.id;
        }
        if (piece.book == null) {
          if (piece.repId) {
            var m = piece.repId.match(/^s(\d+)-/);
            if (m) { piece.book = parseInt(m[1]); return; }
          }
          var found2 = rep.find(function(r) {
            return r.name === piece.name || r.en === piece.name;
          });
          if (found2) {
            piece.book = found2.book;
            if (!piece.repId) piece.repId = found2.id;
          }
        }
      });
    });
    return lessons;
  },

  /**
   * 自动补全 logs 中缺失的 book 和 category 字段
   * @param {Array} logs
   * @returns {Array}
   */
  migrateLogs(logs) {
    var rep = DB.repertoire();
    logs.forEach(function(log) {
      if (!log.entries) return;
      log.entries.forEach(function(entry) {
        if (entry.book == null) {
          if (entry.repId) {
            var m = entry.repId.match(/^s(\d+)-/);
            if (m) { entry.book = parseInt(m[1]); return; }
          }
          var found = rep.find(function(r) {
            return r.name === entry.pieceName || r.en === entry.pieceName;
          });
          if (found) {
            entry.book = found.book;
            if (!entry.repId) entry.repId = found.id;
          }
        }
        if (!entry.category) {
          var found2 = rep.find(function(r) {
            return r.name === entry.pieceName || r.en === entry.pieceName;
          });
          if (found2) {
            entry.category = 'suzuki';
            if (!entry.repId) entry.repId = found2.id;
            if (entry.book == null) entry.book = found2.book;
          } else {
            entry.category = 'pieces';
          }
        }
      });
    });
    return logs;
  },

  /**
   * 自动补全 repertoire 缺失字段
   * @param {Array} repData
   * @returns {Array}
   */
  migrateRepertoire(repData) {
    repData.forEach(function(piece) {
      if (piece.lastPracticeDate === undefined) piece.lastPracticeDate = null;
      if (piece.memorized === undefined) piece.memorized = false;
      if (piece.handsTogether === undefined) piece.handsTogether = true;
      if (piece.totalMinutes === undefined) piece.totalMinutes = 0;
      if (piece.practiceCount === undefined) piece.practiceCount = 0;
      if (piece.status === undefined) piece.status = 'untouched';
      if (piece.startedDate === undefined) piece.startedDate = null;
      if (piece.completedDate === undefined) piece.completedDate = null;
    });
    return repData;
  },

  importCode(codeStr) {
    var data = this.decode(codeStr);
    if (!data || !data.v) return { success: false, error: '无效的同步码' };

    // 检测兼容性
    var detection = this.detectIssues(data);

    // 如果有兼容性问题，显示确认对话框
    if (!detection.compatible) {
      var msg = '📋 导入数据兼容性检测\n\n发现以下差异：\n';
      detection.issues.forEach(function(issue, i) {
        msg += '  ' + (i + 1) + '. ' + issue + '\n';
      });
      msg += '\n✅ 系统将自动修复（从曲库反推缺失字段）。\n';
      msg += '无法识别的曲目将标记为"其他"分类。\n\n';
      msg += '是否继续导入？';
      if (!confirm(msg)) return { success: false, error: '用户取消导入' };
    }

    var stats = { lessons: 0, logs: 0, migrated: !detection.compatible };

    // 导入 lessons（含迁移 + 数据清洗）
    if (data.l && data.l.length) {
      var importedLessons = this.migrateLessons(data.l);
      // 数据清洗：统一曲目名称
      importedLessons.forEach(function(lesson) {
        if (!lesson.pieces) return;
        lesson.pieces.forEach(function(piece) {
          DataCleaner.cleanLessonPiece(piece);
        });
      });
      var merged = {};
      DB.lessons().forEach(function(l) { merged[l.id] = l; });
      importedLessons.forEach(function(l) {
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

    // 导入 logs（含迁移 + 数据清洗）
    if (data.g && data.g.length) {
      var importedLogs = this.migrateLogs(data.g);
      // 数据清洗：统一曲目名称
      importedLogs.forEach(function(log) {
        if (!log.entries) return;
        log.entries.forEach(function(entry) {
          DataCleaner.cleanLogEntry(entry);
        });
      });
      var mergedLogs = {};
      DB.logs().forEach(function(l) { mergedLogs[l.id] = l; });
      importedLogs.forEach(function(l) {
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

    // 导入 repertoire（含迁移）
    if (data.r && data.r.length) {
      var importedRep = this.migrateRepertoire(data.r);
      if (!DB.repertoire().length) {
        DB.saveRepertoire(importedRep);
      } else {
        var localRep = DB.repertoire();
        var localIds = new Set(localRep.map(function(r) { return r.id; }));
        importedRep.forEach(function(r) {
          if (!localIds.has(r.id)) {
            localRep.push(r);
          }
        });
        DB.saveRepertoire(localRep);
      }
    }

    return { success: true, stats: stats };
  }
};

/* ==========================================
   🧹 数据清洗器
   统一曲目名称、基本功写法，确保跨设备数据一致性
   ========================================== */
const DataCleaner = {
  // ── 曲目名称别名映射（别名 → 标准中文名） ──
  // 用于统一日志中的中英文曲名
  PIECE_ALIAS_MAP: {
    // 铃木第一册（英文名 → 中文名）
    'Twinkle, Twinkle, Little Star Variations': '小星星变奏曲',
    'The Honeybee': '小蜜蜂',
    'Cuckoo': '布谷鸟',
    'Lightly Row': '轻轻划',
    'French Children\'s Song': '法国童谣',
    'London Bridge': '伦敦桥',
    'Mary Had a Little Lamb': '玛丽有只小羔羊',
    'Go Tell Aunt Rhody': '告诉罗迪阿姨',
    'Au Clair de la Lune': '月光下',
    'Long, Long Ago': '很久以前',
    'Little Playmates': '小伙伴',
    'Chant Arabe': '阿拉伯之歌',
    'Allegretto 1': '小快板1',
    'Allegretto 2': '小快板2',
    'Good-bye to Winter': '告别冬天',
    'Christmas-Day Secrets': '圣诞节的秘密',
    'Allegro': '快板',
    'Musette': '风笛舞曲',
    // 铃木第二册
    'Écossaise': '埃科塞兹舞曲',
    'A Short Story': '小故事',
    'The Happy Farmer': '快乐的农夫',
    'Minuet 1, Klavier Suite in g minor': 'G小调小步舞曲 第一首',
    'Minuet 2, Notebook for AMB': '小步舞曲 第二首',
    'Minuet 3': '小步舞曲 第三首',
    'Minuet, Klavier Suite in g minor': 'G小调小步舞曲',
    'Cradle Song': '摇篮曲',
    'Minuet K.2': '小步舞曲 K.2',
    'Arietta': '小咏叹调',
    'Melody': '旋律',
    'Sonatina': '小奏鸣曲',
    'Musette, English Suite No.3': '风笛舞曲',
    'Minuet, Notebook for AMB': '小步舞曲',
    // 常见变体
    '小步舞曲第一首': 'G小调小步舞曲 第一首',
    '小步舞曲1': 'G小调小步舞曲 第一首',
    'G小调小步舞曲第一首': 'G小调小步舞曲 第一首',
    'G小调小步舞曲 1': 'G小调小步舞曲 第一首',
  },

  // ── 基本功别名映射（各种写法 → 标准写法） ──
  FOCUS_ALIAS_MAP: {
    // 基本功左手
    '左手基本功': '基本功（左手）',
    '左手基本功练习': '基本功（左手）',
    '基本功左手': '基本功（左手）',
    '基本功-左手': '基本功（左手）',
    '基本功，左手': '基本功（左手）',
    '基本功 左手': '基本功（左手）',
    '左手': '基本功（左手）',
    '左手练习': '基本功（左手）',
    // 基本功右手
    '右手基本功': '基本功（右手）',
    '右手基本功练习': '基本功（右手）',
    '基本功右手': '基本功（右手）',
    '基本功-右手': '基本功（右手）',
    '基本功，右手': '基本功（右手）',
    '基本功 右手': '基本功（右手）',
    '右手': '基本功（右手）',
    '右手练习': '基本功（右手）',
    // 基本功双手
    '双手基本功': '基本功（双手）',
    '双手基本功练习': '基本功（双手）',
    '基本功双手': '基本功（双手）',
    '基本功-双手': '基本功（双手）',
    '双手': '基本功（双手）',
    '合手基本功': '基本功（双手）',
    '双手合手': '基本功（双手）',
    // 基本功综合
    '基本功练习': '基本功',
    '基本功': '基本功',
    // 练习时间/节拍器
    '练习时间': '节拍器练习',
    '节拍器': '节拍器练习',
    // 其他常见变体
    '手腕放松': '手腕',
    '手腕练习': '手腕',
    '音阶练习': '音阶',
    '琶音练习': '琶音',
    '哈农': '哈农',
    '哈农练习': '哈农',
    // 节奏类
    '节奏练习': '节奏',
    '节奏感': '节奏',
    // 手型
    '手型练习': '手型',
    '手型纠正': '手型',
  },

  // ── 根据 repId 从曲库获取标准中文名 ──
  getStandardNameByRepId(repId) {
    if (!repId) return null;
    const rep = DB.repertoire();
    const piece = rep.find(p => p.id === repId);
    return piece ? piece.name : null;
  },

  // ── 标准化曲目名称（优先用 repId 查找，再用别名映射） ──
  // 注意：自由练习中用户可能输入「基本功-左手」作为曲名，这类也需要被标准化
  standardizePieceName(name, repId) {
    // 1. 如果有 repId，优先从曲库获取标准名
    if (repId) {
      const standardName = this.getStandardNameByRepId(repId);
      if (standardName) return standardName;
    }
    // 2. 没有 repId 或曲库找不到，用曲目别名映射
    if (!name || typeof name !== 'string') return name || '';
    const trimmed = name.trim();
    if (this.PIECE_ALIAS_MAP[trimmed]) return this.PIECE_ALIAS_MAP[trimmed];
    // 3. 曲目别名映射中找不到，再检查基本功别名映射（用户可能把基本功当曲名输入）
    if (this.FOCUS_ALIAS_MAP[trimmed]) return this.FOCUS_ALIAS_MAP[trimmed];
    return trimmed;
  },

  // ── 标准化基本功名称 ──
  standardizeFocusArea(name) {
    if (!name || typeof name !== 'string') return name || '';
    const trimmed = name.trim();
    return this.FOCUS_ALIAS_MAP[trimmed] || trimmed;
  },

  // ── 标准化日志条目中的名称 ──
  cleanLogEntry(entry) {
    // 标准化曲名（传入 repId）
    if (entry.pieceName) {
      entry.pieceName = this.standardizePieceName(entry.pieceName, entry.repId);
    }
    // 标准化 focusAreas 数组
    if (entry.focusAreas && Array.isArray(entry.focusAreas)) {
      entry.focusAreas = entry.focusAreas
        .map(f => this.standardizeFocusArea(f))
        .filter((f, i, arr) => f && arr.indexOf(f) === i); // 去重
    }
    return entry;
  },

  // ── 标准化课程曲目中的名称 ──
  cleanLessonPiece(piece) {
    // 标准化曲名（传入 repId）
    if (piece.name) {
      piece.name = this.standardizePieceName(piece.name, piece.repId);
    }
    if (piece.focusAreas && Array.isArray(piece.focusAreas)) {
      piece.focusAreas = piece.focusAreas
        .map(f => this.standardizeFocusArea(f))
        .filter((f, i, arr) => f && arr.indexOf(f) === i);
    }
    return piece;
  },

  // ── 清洗所有本地数据，返回清洗报告 ──
  cleanAll() {
    let report = { lessons: 0, logs: 0, pieces: 0, entries: 0, changes: [] };

    // 清洗课程
    const lessons = DB.lessons();
    let lessonsChanged = false;
    lessons.forEach(lesson => {
      if (!lesson.pieces) return;
      lesson.pieces.forEach(piece => {
        const before = JSON.stringify({ name: piece.name, repId: piece.repId, focusAreas: piece.focusAreas });
        this.cleanLessonPiece(piece);
        const after = JSON.stringify({ name: piece.name, repId: piece.repId, focusAreas: piece.focusAreas });
        if (before !== after) {
          report.changes.push({ type: 'lesson-piece', id: lesson.id, before: JSON.parse(before), after: JSON.parse(after) });
          report.pieces++;
          lessonsChanged = true;
        }
      });
      report.lessons++;
    });
    if (lessonsChanged) {
      DB.saveLessons(lessons);
    }

    // 清洗日志
    const logs = DB.logs();
    let logsChanged = false;
    logs.forEach(log => {
      if (!log.entries) return;
      log.entries.forEach(entry => {
        const before = JSON.stringify({ pieceName: entry.pieceName, repId: entry.repId, focusAreas: entry.focusAreas });
        this.cleanLogEntry(entry);
        const after = JSON.stringify({ pieceName: entry.pieceName, repId: entry.repId, focusAreas: entry.focusAreas });
        if (before !== after) {
          report.changes.push({ type: 'log-entry', id: log.id, date: log.date, before: JSON.parse(before), after: JSON.parse(after) });
          report.entries++;
          logsChanged = true;
        }
      });
    });
    if (logsChanged) {
      DB.saveLogs(logs);
    }

    return report;
  },

  // ── 获取清洗预览（不实际修改数据）──
  preview() {
    let stats = { lessonsAffected: 0, logsAffected: 0, piecesAffected: 0, entriesAffected: 0, changes: [] };

    // 复制数据进行预览
    const lessons = JSON.parse(JSON.stringify(DB.lessons()));
    lessons.forEach(lesson => {
      let lessonChanged = false;
      if (!lesson.pieces) return;
      lesson.pieces.forEach(piece => {
        const before = JSON.stringify({ name: piece.name, repId: piece.repId, focusAreas: piece.focusAreas || [] });
        this.cleanLessonPiece(piece);
        const after = JSON.stringify({ name: piece.name, repId: piece.repId, focusAreas: piece.focusAreas || [] });
        if (before !== after) {
          lessonChanged = true;
          stats.piecesAffected++;
          stats.changes.push({ type: 'lesson', lessonId: lesson.id, pieceName: piece.name, before: JSON.parse(before), after: JSON.parse(after) });
        }
      });
      if (lessonChanged) stats.lessonsAffected++;
    });

    const logs = JSON.parse(JSON.stringify(DB.logs()));
    logs.forEach(log => {
      let logChanged = false;
      if (!log.entries) return;
      log.entries.forEach(entry => {
        const before = JSON.stringify({ pieceName: entry.pieceName, repId: entry.repId, focusAreas: entry.focusAreas || [] });
        this.cleanLogEntry(entry);
        const after = JSON.stringify({ pieceName: entry.pieceName, repId: entry.repId, focusAreas: entry.focusAreas || [] });
        if (before !== after) {
          logChanged = true;
          stats.entriesAffected++;
          stats.changes.push({ type: 'log', date: log.date, pieceName: entry.pieceName, before: JSON.parse(before), after: JSON.parse(after) });
        }
      });
      if (logChanged) stats.logsAffected++;
    });

    return stats;
  }
};

/* ==========================================
   🏅 里程碑配置（悦跑圈风格）
   ========================================== */
const STAR_MILESTONES = [
  { stars: 5, label: '初露锋芒', icon: '🌟', desc: '单日获得 5 颗星' },
  { stars: 10, label: '稳步提升', icon: '⭐', desc: '单日获得 10 颗星' },
  { stars: 15, label: '星星之火', icon: '✨', desc: '单日获得 15 颗星' },
  { stars: 20, label: '光彩夺目', icon: '🌈', desc: '单日获得 20 颗星' },
  { stars: 25, label: '熠熠生辉', icon: '💫', desc: '单日获得 25 颗星' },
  { stars: 30, label: '星光璀璨', icon: '🏆', desc: '单日获得 30 颗星' }
];

const STREAK_MILESTONES = [
  { days: 3, label: '初尝甜头', icon: '🔥', desc: '连续练习 3 天' },
  { days: 7, label: '习惯养成', icon: '💪', desc: '连续练习 7 天' },
  { days: 14, label: '小有所成', icon: '🌱', desc: '连续练习 14 天' },
  { days: 30, label: '持之以恒', icon: '🏅', desc: '连续练习 30 天' },
  { days: 60, label: '锲而不舍', icon: '🎖️', desc: '连续练习 60 天' },
  { days: 100, label: '百炼成钢', icon: '👑', desc: '连续练习 100 天' },
  { days: 180, label: '半年荣耀', icon: '🎪', desc: '连续练习 180 天' },
  { days: 365, label: '年度巅峰', icon: '🎯', desc: '连续练习 365 天' }
];

const DURATION_MILESTONES = [
  { minutes: 30, label: '30分钟达人', icon: '⏰', desc: '单日练习 30 分钟' },
  { minutes: 60, label: '1小时战士', icon: '⌛', desc: '单日练习 60 分钟' },
  { minutes: 90, label: '90分钟精英', icon: '⏳', desc: '单日练习 90 分钟' },
  { minutes: 120, label: '2小时大师', icon: '🕐', desc: '单日练习 120 分钟' },
  { minutes: 180, label: '3小时传奇', icon: '⏱️', desc: '单日练习 180 分钟' }
];

/**
 * 构建里程碑 HTML（用于今日成绩、日历统计、统计页）
 * @param {number} maxStarsDay 最高单日星星数
 * @param {number} maxDurationDay 最高单日练习时长(分钟)
 * @param {number} currentStreak 连续练习天数
 * @param {string} [title='成就里程碑'] 可选标题
 * @param {boolean} [onlyAchieved=false] 是否只显示达成的里程碑
 * @returns {string} HTML
 */
function buildMilestonesHTML(maxStarsDay, maxDurationDay, currentStreak, title, onlyAchieved) {
  title = title || '成就里程碑';
  onlyAchieved = onlyAchieved || false;

  function renderBadge(achieved, icon, label, desc) {
    const borderColor = achieved ? 'var(--accent-primary)' : 'var(--border-2)';
    const bgColor = achieved ? 'rgba(245,160,152,0.1)' : 'rgba(255,255,255,0.02)';
    const opacity = achieved ? '1' : '0.4';
    const badgeStyle = achieved ? 'box-shadow:0 0 12px rgba(245,160,152,0.3)' : '';
    return `
      <div style="display:inline-flex;flex-direction:column;align-items:center;padding:10px 6px;border-radius:12px;background:${bgColor};border:1px solid ${borderColor};min-width:64px;opacity:${opacity};${badgeStyle}">
        <span style="font-size:1.3rem">${icon}</span>
        <span style="font-size:0.65rem;font-weight:600;color:var(--text-1);margin-top:4px;text-align:center">${label}</span>
        <span style="font-size:0.55rem;color:var(--text-3);margin-top:2px;text-align:center">${desc}</span>
        ${achieved ? '<span style="font-size:0.5rem;color:var(--accent-primary);margin-top:4px">✓ 已达成</span>' : ''}
      </div>
    `;
  }

  const achievedStar = STAR_MILESTONES.filter(m => maxStarsDay >= m.stars);
  const achievedStreak = STREAK_MILESTONES.filter(m => currentStreak >= m.days);
  const achievedDuration = DURATION_MILESTONES.filter(m => maxDurationDay >= m.minutes);

  const hasAnyAchievement = achievedStar.length + achievedStreak.length + achievedDuration.length > 0;

  let starBadges, streakBadges, durationBadges;
  if (onlyAchieved) {
    starBadges = achievedStar.map(m => renderBadge(true, m.icon, m.label, m.desc)).join('');
    streakBadges = achievedStreak.map(m => renderBadge(true, m.icon, m.label, m.desc)).join('');
    durationBadges = achievedDuration.map(m => renderBadge(true, m.icon, m.label, m.desc)).join('');
  } else {
    starBadges = STAR_MILESTONES.map(m => renderBadge(maxStarsDay >= m.stars, m.icon, m.label, m.desc)).join('');
    streakBadges = STREAK_MILESTONES.map(m => renderBadge(currentStreak >= m.days, m.icon, m.label, m.desc)).join('');
    durationBadges = DURATION_MILESTONES.map(m => renderBadge(maxDurationDay >= m.minutes, m.icon, m.label, m.desc)).join('');
  }

  function sectionHtml(label, badges) {
    if (onlyAchieved && !badges) return '';
    return `
      <div style="margin-bottom:14px">
        <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:8px">${label}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${badges || '<span style="font-size:0.65rem;color:var(--text-4);padding:8px">暂无</span>'}
        </div>
      </div>
    `;
  }

  let html = `
    <div class="card" style="margin-top:12px">
      <div class="card-header">
        <h3 class="card-title">🏅 ${title}</h3>
      </div>
      ${!hasAnyAchievement ? `<div style="text-align:center;color:var(--text-3);padding:20px;font-size:0.8rem">开始练习后解锁${title.replace('里程碑', '')}</div>` : `
      ${sectionHtml('🌟 星星成就', starBadges)}
      ${sectionHtml('🔥 连续成就', streakBadges)}
      ${!onlyAchieved ? '' : sectionHtml('⏱️ 时长成就', durationBadges)}
      ${onlyAchieved ? '' : sectionHtml('⏱️ 时长成就', durationBadges)}
      `}
    </div>
  `;

  // 修复：上面逻辑有误，这里直接重构
  if (hasAnyAchievement) {
    html = `
      <div class="card" style="margin-top:12px">
        <div class="card-header">
          <h3 class="card-title">🏅 ${title}</h3>
        </div>
        ${sectionHtml('🌟 星星成就', starBadges)}
        ${sectionHtml('🔥 连续成就', streakBadges)}
        ${sectionHtml('⏱️ 时长成就', durationBadges)}
      </div>
    `;
  } else {
    html = `
      <div class="card" style="margin-top:12px">
        <div class="card-header">
          <h3 class="card-title">🏅 ${title}</h3>
        </div>
        <div style="text-align:center;color:var(--text-3);padding:20px;font-size:0.8rem">暂无达成的里程碑</div>
      </div>
    `;
  }

  return html;
}

/**
 * 从日志计算里程碑统计数据
 * @returns {{maxStarsDay: number, maxDurationDay: number, currentStreak: number}}
 */
function computeMilestoneStats() {
  const logs = DB.logs();
  if (!logs.length) return { maxStarsDay: 0, maxDurationDay: 0, currentStreak: 0 };

  let maxStarsDay = 0;
  let maxDurationDay = 0;

  const datesSet = new Set();
  for (const l of logs) {
    datesSet.add(l.date);
    const dayStars = (l.entries || []).reduce((s, e) => s + (e.rating || 0), 0);
    if (dayStars > maxStarsDay) maxStarsDay = dayStars;
    const min = l.totalDurationMin || 0;
    if (min > maxDurationDay) maxDurationDay = min;
  }

  // 计算当前连续打卡天数
  const today = Utils.today();
  const todayDate = new Date(today + 'T00:00:00');
  let currentStreak = 0;
  function dateToYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const checkDate = new Date(todayDate);
  while (datesSet.has(dateToYMD(checkDate))) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  // 如果今天没打卡，从昨天开始算
  if (currentStreak === 0) {
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const ydCheck = new Date(yesterdayDate);
    while (datesSet.has(dateToYMD(ydCheck))) {
      currentStreak++;
      ydCheck.setDate(ydCheck.getDate() - 1);
    }
  }

  return { maxStarsDay, maxDurationDay, currentStreak };
}

/**
 * 按指定时间范围计算里程碑统计数据
 * @param {string} scope - 'day' | 'week' | 'month' | 'all'
 * @returns {{maxStars: number, maxDuration: number, streak: number, title: string}}
 */
function computeMilestoneStatsForRange(scope) {
  const logs = DB.logs();
  if (!logs.length) return { maxStars: 0, maxDuration: 0, streak: 0, title: '' };

  const todayStr = Utils.today();
  const todayDate = new Date(todayStr + 'T00:00:00');
  let filteredLogs = [];
  let title = '';

  if (scope === 'day') {
    filteredLogs = logs.filter(l => l.date === todayStr);
    title = '今日里程碑';
  } else if (scope === 'week') {
    const startOfWeek = new Date(todayDate);
    const dayOfWeek = todayDate.getDay();
    startOfWeek.setDate(todayDate.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    filteredLogs = logs.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      return d >= startOfWeek && d <= endOfWeek;
    });
    title = '本周里程碑';
  } else if (scope === 'month') {
    const year = todayDate.getFullYear();
    const month = todayDate.getMonth();
    filteredLogs = logs.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    });
    title = '本月里程碑';
  } else {
    filteredLogs = logs;
    title = '成就里程碑';
  }

  let maxStars = 0;
  let maxDuration = 0;

  for (const l of filteredLogs) {
    const dayStars = (l.entries || []).reduce((s, e) => s + (e.rating || 0), 0);
    if (dayStars > maxStars) maxStars = dayStars;
    const min = l.totalDurationMin || 0;
    if (min > maxDuration) maxDuration = min;
  }

  // 连续天数：day 范围用今日 streak，week/month 范围用该范围的 streak
  let streak = 0;
  const allDatesSet = new Set(logs.map(l => l.date));

  function dateToYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  if (scope === 'day') {
    const checkDate = new Date(todayDate);
    while (allDatesSet.has(dateToYMD(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    if (streak === 0) {
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const ydCheck = new Date(yesterdayDate);
      while (allDatesSet.has(dateToYMD(ydCheck))) {
        streak++;
        ydCheck.setDate(ydCheck.getDate() - 1);
      }
    }
  } else if (scope === 'week') {
    const dayOfWeek = todayDate.getDay();
    const startOfWeek = new Date(todayDate);
    startOfWeek.setDate(todayDate.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const weekDates = new Set(filteredLogs.map(l => l.date));
    let maxWeekStreak = 0;
    let currentWeekStreak = 0;
    const cursorDate = new Date(startOfWeek);
    while (cursorDate <= endOfWeek) {
      if (weekDates.has(dateToYMD(cursorDate))) {
        currentWeekStreak++;
        if (currentWeekStreak > maxWeekStreak) maxWeekStreak = currentWeekStreak;
      } else {
        currentWeekStreak = 0;
      }
      cursorDate.setDate(cursorDate.getDate() + 1);
    }
    streak = maxWeekStreak;
  } else if (scope === 'month') {
    const year = todayDate.getFullYear();
    const month = todayDate.getMonth();
    const monthDates = new Set(filteredLogs.map(l => l.date));
    let maxMonthStreak = 0;
    let currentMonthStreak = 0;
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);
    const cursorDate = new Date(startOfMonth);
    while (cursorDate <= endOfMonth) {
      if (monthDates.has(dateToYMD(cursorDate))) {
        currentMonthStreak++;
        if (currentMonthStreak > maxMonthStreak) maxMonthStreak = currentMonthStreak;
      } else {
        currentMonthStreak = 0;
      }
      cursorDate.setDate(cursorDate.getDate() + 1);
    }
    streak = maxMonthStreak;
  } else {
    const checkDate = new Date(todayDate);
    while (allDatesSet.has(dateToYMD(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    if (streak === 0) {
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const ydCheck = new Date(yesterdayDate);
      while (allDatesSet.has(dateToYMD(ydCheck))) {
        streak++;
        ydCheck.setDate(ydCheck.getDate() - 1);
      }
    }
  }

  return { maxStars, maxDuration, streak, title };
}

console.log('✅ Core modules loaded');