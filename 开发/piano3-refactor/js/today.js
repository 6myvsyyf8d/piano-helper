/* ==========================================
   🏠 今日练琴页面 - 完整逻辑
   ========================================== */

"use strict";


/* ------------------------------------------
   状态管理
   ------------------------------------------ */
const TodayState = {
  // 当前曲目状态（索引 → 状态对象）
  pieces: {},
  
  // 计时器
  timer: {
    seconds: 0,
    interval: null,
    isRunning: false
  },
  
  // 心情选择
  mood: '',
  
  // 贴纸选择
  sticker: '',
  
  // 编辑模式：保留原日志用于预填
  existingLog: null,
  
  // 重置所有状态
  reset() {
    // 清理所有曲目的计时器
    for (const [idx, piece] of Object.entries(this.pieces)) {
      if (piece._timerInterval) {
        clearInterval(piece._timerInterval);
        piece._timerInterval = null;
      }
    }
    this.pieces = {};
    this.timer.seconds = 0;
    this.timer.isRunning = false;
    if (this.timer.interval) {
      clearInterval(this.timer.interval);
      this.timer.interval = null;
    }
    this.mood = '';
    this.sticker = '';
    this.existingLog = null;
    if (typeof activeTimerIdx !== 'undefined') activeTimerIdx = null;
    if (typeof freePieceCount !== 'undefined') freePieceCount = 0;
  },
  
  // 初始化曲目状态
  initPiece(index, pieceName) {
    if (!this.pieces[index]) {
      this.pieces[index] = {
        pieceName: pieceName || '',
        rating: 0,
        durationMin: 0,
        notes: '',
        repId: null,
        category: 'pieces',
        speed: 0,
        memorized: false,
        handsTogether: true
      };
    }
    return this.pieces[index];
  },
  
  // 获取已完成的曲目
  getCompleted() {
    return Object.values(this.pieces).filter(p => p.rating > 0 || p.durationMin > 0);
  }
};

/* ------------------------------------------
   单曲卡片 HTML 生成（供练习表单和复习共用）
   ------------------------------------------ */
function pieceCardHTML(p) {
  return `
      <div class="piece-card" data-index="${p.index}" id="piece${p.index}">
        <div class="piece-card-top" onclick="togglePieceExpand('${p.index}')">
          <span class="piece-number">${typeof p.num === 'number' ? p.num : ''}</span>
          <div class="piece-info">
            <div class="piece-title">
              ${Utils.escape(p.en || p.name)}
              ${p.en ? '<span style="font-weight:400;color:var(--text-2);font-size:0.8rem"> ' + Utils.escape(p.name) + '</span>' : ''}
            </div>
            ${p.details ? '<div class="piece-subtitle"><span class="expand-hint">点击查看详情 ▸</span></div>' : '<div class="piece-subtitle"><span class="text-xs text-2">' + (p.composer || '') + '</span></div>'}
          </div>
        </div>

        ${(p.focusAreas && p.focusAreas.length) ? '<div class="tag-row" style="margin:6px 0">' + p.focusAreas.map(t => '<span class="badge" style="font-size:0.78rem;font-weight:800;color:var(--accent-yellow);background:rgba(245,216,154,0.15)">' + Utils.escape(t) + '</span>').join('') + '</div>' : ''}
        ${p.details ? '<div class="teacher-notes"><div class="teacher-notes-label">老师的要求</div><div class="teacher-notes-content">' + Utils.escape(p.details) + '</div></div>' : ''}

        <div class="star-rating" data-index="${p.index}">
          ${[1,2,3,4,5].map(s => '<button class="star-btn" data-star="' + s + '" onclick="setStarRating(\'' + p.index + '\', ' + s + ')">⭐</button>').join('')}
        </div>

        <!-- 单曲计时器 -->
        <div class="piece-timer" data-timer-idx="${p.index}">
          <span class="piece-timer-display" id="timerDisplay${p.index}">00:00</span>
          <button class="btn btn-sm btn-success piece-timer-start" data-timer-start="${p.index}">▶ 开始</button>
          <button class="btn btn-sm btn-secondary piece-timer-stop" data-timer-stop="${p.index}" style="display:none">⏹ 结束</button>
          <span class="piece-timer-badge" id="timerBadge${p.index}" style="display:none"></span>
        </div>

        <!-- 练习参数 -->
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
          <input type="number" class="piece-speed" data-index="${p.index}" min="0" max="999" placeholder="速度"
                 style="width:60px;height:30px;background:rgba(255,255,255,0.06);border:1px solid var(--border-2);border-radius:8px;color:var(--text-1);font-size:0.78rem;text-align:center;font-family:inherit"
                 oninput="onPieceSpeedChange('${p.index}', this.value)">
          <button class="btn btn-sm piece-mem-btn" data-index="${p.index}" data-mem="0"
                  style="font-size:0.7rem;padding:4px 10px;background:rgba(255,255,255,0.06);border:1px solid var(--border-2);border-radius:8px;color:var(--text-3);cursor:pointer"
                  onclick="togglePieceMemorized('${p.index}', this)">📖 看谱</button>
          <button class="btn btn-sm piece-hand-btn" data-index="${p.index}" data-hands="1"
                  style="font-size:0.7rem;padding:4px 10px;background:rgba(255,255,255,0.06);border:1px solid var(--border-2);border-radius:8px;color:var(--text-3);cursor:pointer"
                  onclick="togglePieceHands('${p.index}', this)">🤲 合手</button>
        </div>

      </div>
    `;
}

/* ------------------------------------------
   页面渲染
   ------------------------------------------ */
function renderToday() {
  const page = document.getElementById('page-today');
  if (!page) return;

  // 编辑模式：保留原日志数据
  if (TodayState.existingLog) {
    const lesson = getLatestLesson();
    page.innerHTML = renderTodayPracticeForm(lesson);
    bindTodayEvents(lesson, TodayState.existingLog);
    return;
  }

  const log = DB.logs().find(l => l.date === Utils.today());

  if (log) {
    // 今天已完成练习
    page.innerHTML = renderTodayCompleted(log);
  } else {
    // 显示练习表单
    const lesson = getLatestLesson();
    page.innerHTML = renderTodayPracticeForm(lesson);
    bindTodayEvents(lesson);
  }
}

/* ------------------------------------------
   获取最新课程
   ------------------------------------------ */
function getLatestLesson() {
  const lessons = DB.lessons();
  if (!lessons.length) return null;
  return lessons.sort((a, b) => b.date.localeCompare(a.date))[0];
}

/* ------------------------------------------
   渲染：已完成状态
   ------------------------------------------ */
function renderTodayCompleted(log) {
  const totalStars = log.entries.reduce((sum, e) => sum + (e.rating || 0), 0);
  const totalMin = log.totalDurationMin || 0;
  
  // 按分类分组
  const grouped = {};
  log.entries.forEach(entry => {
    const cat = entry.category || 'pieces';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  });
  
  const categoryLabels = {
    suzuki: '🎻 铃木',
    beyer: '🎼 拜厄',
    pieces: '🎵 小曲集',
    free: '🎹 自由练习',
    review: '🎲 复习'
  };

  // 生成分类列表（可折叠）
  const catOrder = ['suzuki', 'beyer', 'pieces', 'free', 'review'];
  const categoryBlocks = catOrder.filter(cat => grouped[cat]).map(cat => {
    const entries = grouped[cat];
    const catMin = entries.reduce((s, e) => s + (e.durationMin || 0), 0);
    const catStars = entries.reduce((s, e) => s + (e.rating || 0), 0);

    const piecesList = entries.map((entry, i) => `
      <div class="p-12 mb-8" style="background:rgba(255,255,255,0.04);border-radius:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <strong>${i + 1}. ${Utils.escape(entry.pieceName)}</strong>
          ${entry.rating ? '<span style="white-space:nowrap;flex-shrink:0">' + (entry.rating % 1 === 0 ? '⭐'.repeat(entry.rating) : entry.rating + '⭐') + '</span>' : ''}
        </div>
        ${entry.durationMin ? '<div class="text-xs text-3 mt-4">⏱ ' + entry.durationMin + '分钟</div>' : ''}
      </div>
    `).join('');

    return `
      <div class="practice-category open" data-cat="done-${cat}">
        <div class="practice-category-header" onclick="toggleCategory('done-${cat}')">
          <span class="font-bold">${categoryLabels[cat]}</span>
          <span class="cat-info">
            <span class="text-sm text-2">${catMin}分钟 · ${catStars}⭐</span>
            <span class="cat-toggle-icon">▸</span>
          </span>
        </div>
        <div data-cat-body="done-${cat}">
          ${piecesList}
        </div>
      </div>
    `;
  }).join('');
  
  // 星星分布统计
  const starDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  log.entries.forEach(e => { if (e.rating) { const bucket = Math.round(e.rating); if (starDist[bucket] !== undefined) starDist[bucket]++; } });
  const totalRated = [5,4,3,2,1].reduce((s, n) => s + starDist[n], 0);
  const allRatings = log.entries.filter(e => e.rating > 0).map(e => e.rating);
  const avgRating = allRatings.length > 0 ? (allRatings.reduce((s, r) => s + r, 0) / allRatings.length).toFixed(1) : '-';

  return `
    <!-- 完成卡片 — 扁平化 stats 面板 -->
    <div class="card" style="padding:20px 20px;background:linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);border:1px solid var(--border-1)">

      <!-- 上排：练琴时间 + 星星总数，双卡片并排 -->
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div style="flex:1;padding:14px 12px;background:rgba(255,255,255,0.04);border-radius:10px;text-align:center">
          <div style="font-size:0.7rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">练琴时间</div>
          <div style="font-size:2.2rem;font-weight:250;line-height:1.1;color:var(--text-1);letter-spacing:-0.02em">${totalMin}<span style="font-size:0.78rem;font-weight:500;color:var(--text-3);margin-left:2px">分钟</span></div>
        </div>
        <div style="flex:1;padding:14px 12px;background:rgba(255,255,255,0.04);border-radius:10px;text-align:center">
          <div style="font-size:0.7rem;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">星星总数</div>
          <div style="font-size:2.2rem;font-weight:250;line-height:1.1;color:var(--text-1);letter-spacing:-0.02em">${totalStars}<span style="font-size:0.78rem;font-weight:500;color:var(--text-3);margin-left:2px">颗</span></div>
          ${avgRating !== '-' ? '<div style="font-size:0.72rem;color:var(--text-3);margin-top:2px">平均 ' + avgRating + ' / 首</div>' : ''}
        </div>
      </div>

      <!-- 下排：星星分布，水平紧凑 -->
      <div style="display:flex;gap:4px;padding:10px 8px;background:rgba(255,255,255,0.04);border-radius:10px;justify-content:space-between;align-items:center;overflow-x:auto">
        ${[5,4,3,2,1].map(s => {
          const count = starDist[s] || 0;
          return '<div style="display:flex;align-items:center;gap:3px;flex-shrink:0;padding:0 4px">' +
            '<span style="font-size:0.72rem;line-height:1">' + '⭐'.repeat(s) + '</span>' +
            '<span style="font-size:0.82rem;font-weight:700;color:var(--text-1);min-width:16px;text-align:center">' + count + '</span>' +
          '</div>';
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">
          <span class="card-title-icon">🎵</span>
          今日练习
        </h3>
      </div>
      ${categoryBlocks}
    </div>

    ${log.parentNotes ? `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-title-icon">📝</span>
            家长笔记
          </h3>
        </div>
        <p style="font-size:0.9rem;line-height:1.6;color:var(--text-2)">
          ${Utils.escape(log.parentNotes)}
        </p>
      </div>
    ` : ''}

    <button class="btn btn-secondary" onclick="editTodayLog()" style="width:100%">
      ✏️ 修改今天的记录
    </button>
  `;
}

/* ------------------------------------------
   渲染：练习表单
   ------------------------------------------ */
function renderTodayPracticeForm(lesson) {
  if (!lesson) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📒</div>
        <div class="empty-title">还没有课程记录</div>
        <div class="empty-description">
          先去「课程」标签添加最近一次上课内容吧～
        </div>
        <button class="btn btn-primary mt-24" onclick="switchToTab('lessons')">
          📒 添加课程记录
        </button>
      </div>
    `;
  }
  
  // 曲目分类标签
  const categoryLabels = {
    suzuki: '🎻 铃木',
    beyer: '🎼 拜厄',
    pieces: '🎵 小曲集',
    free: '🎹 自由练习',
    review: '🎲 今日复习'
  };
  const categoryOrder = ['suzuki', 'beyer', 'pieces', 'free', 'review'];

  // 按分类分组
  const grouped = {};
  lesson.pieces.forEach((piece, i) => {
    const cat = piece.category || 'suzuki';
    if (!grouped[cat]) grouped[cat] = [];
    
    // 尝试从曲库匹配英文名
    const repPiece = RepertoireManager.findByName(piece.name);
    grouped[cat].push({
      ...piece,
      index: i,
      en: repPiece ? repPiece.en : '',
      repId: piece.repId || (repPiece ? repPiece.id : null)
    });
  });

  // 生成曲目卡片（默认折叠）
  const piecesHtml = categoryOrder.filter(cat => {
    if (cat === 'review') return true; // 复习始终显示
    if (cat === 'free') return false;  // 自由练习在外部独立渲染
    return grouped[cat];
  }).map(cat => {
    if (cat === 'review') {
      // 复习：placeholder，由 generateReviewList 填充
      return `
        <div class="practice-category mb-12" data-cat="review">
          <div class="practice-category-header" onclick="toggleCategory('review')">
            <span class="font-bold">${categoryLabels[cat]}</span>
            <span class="cat-info">
              <span class="text-sm text-2" id="reviewCount">从 Book 1 随机</span>
              <span class="cat-toggle-icon">▸</span>
            </span>
          </div>
          <div class="practice-category-body" data-cat-body="review" style="display:none">
            <div id="reviewList"></div>
          </div>
        </div>
      `;
    }

    const pieces = grouped[cat];

    const pieceCards = pieces.map(p => {
      const cardP = { ...p, num: p.index + 1 };
      return pieceCardHTML(cardP);
    }).join('');

    return `
      <div class="practice-category mb-12" data-cat="${cat}">
        <div class="practice-category-header" onclick="toggleCategory('${cat}')">
          <span class="font-bold">${categoryLabels[cat]}</span>
          <span class="cat-info">
            <span class="text-sm text-2">${pieces.length}首</span>
            <span class="cat-toggle-icon">▸</span>
          </span>
        </div>
        <div class="practice-category-body" data-cat-body="${cat}" style="display:none">
          ${pieceCards}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="text-sm text-2 mb-12" style="padding:0 4px">
      📅 ${Utils.formatDate(lesson.date)} 上课内容
    </div>

    ${piecesHtml}

    <!-- 自由练习 -->
    <div class="practice-category mb-12" data-cat="free">
      <div class="practice-category-header" onclick="toggleCategory('free')">
        <span class="font-bold">🎹 自由练习</span>
        <span class="cat-info">
          <span class="text-sm text-2" id="freeCount">0首</span>
          <span class="cat-toggle-icon">▸</span>
        </span>
      </div>
      <div class="practice-category-body" data-cat-body="free" style="display:none">
        <div id="freeList">
          <p class="text-xs text-3 text-center p-12">点击下方按钮添加练习曲目</p>
        </div>
        <button class="btn btn-sm btn-secondary" id="btnAddFree" style="width:100%;margin-top:8px">
          ➕ 添加自由练习曲目
        </button>
      </div>
    </div>

    <!-- 家长笔记 -->
    <div class="card mb-16">
      <div class="card-header">
        <h3 class="card-title">
          <span class="card-title-icon">📝</span>
          家长笔记
        </h3>
      </div>
      <textarea class="form-input" id="parentNotes" placeholder="记录孩子的进步、需要注意的地方..."
                style="min-height:80px"></textarea>
    </div>

    <button class="btn-big" id="btnCompletePractice">
      ${TodayState.existingLog ? '💾 保存修改' : '🎉 完成今日练习'}
    </button>
  `;
}

/* ------------------------------------------
   事件绑定
   ------------------------------------------ */
function bindTodayEvents(lesson, existingLog = null) {
  if (!lesson) return;
  
  // 重置状态
  TodayState.reset();
  if (existingLog) TodayState.existingLog = existingLog;
  
  // 初始化曲目状态
  lesson.pieces.forEach((piece, i) => {
    const repPiece = RepertoireManager.findByName(piece.name);
    TodayState.initPiece(i, piece.name);
    TodayState.pieces[i].category = piece.category || 'pieces';
    TodayState.pieces[i].repId = piece.repId || (repPiece ? repPiece.id : null);
  });
  
  // 预填已有数据
  if (existingLog) {
    TodayState.mood = existingLog.mood || '';
    TodayState.sticker = existingLog.sticker || '';
    existingLog.entries.forEach(entry => {
      for (const [idx, piece] of Object.entries(TodayState.pieces)) {
        if (piece.pieceName === entry.pieceName || piece.pieceName.includes(entry.pieceName)) {
          piece.rating = entry.rating || 0;
          piece.durationMin = entry.durationMin || 0;
          piece._timerSeconds = (entry.durationMin || 0) * 60;
          if (entry.repId) piece.repId = entry.repId;
          piece.speed = entry.speed || 0;
          piece.memorized = !!entry.memorized;
          piece.handsTogether = entry.handsTogether !== false;
          break;
        }
      }
    });
    // UI 预填（延迟执行，等 DOM 渲染完成）
    setTimeout(prefillEditUI, 100);
  }

  // 绑定单曲计时器
  bindPieceTimers();

  // 生成复习列表：编辑模式恢复原记录，否则随机生成
  if (existingLog) {
    restoreReviewPieces(existingLog);
  } else {
    generateReviewList(lesson);
  }

  // 完成按钮
  const btnComplete = document.getElementById('btnCompletePractice');
  if (btnComplete) {
    btnComplete.addEventListener('click', handleCompletePractice);
  }

  // 自由练习：添加按钮 + 计时器绑定
  const btnAddFree = document.getElementById('btnAddFree');
  if (btnAddFree) btnAddFree.addEventListener('click', () => addFreePiece());
  bindFreePieceTimers();

  // 编辑模式：自由练习预填
  if (existingLog) {
    existingLog.entries.forEach(entry => {
      if (entry.category === 'free') {
        addFreePiece(entry.pieceName);
        const lastIdx = 'f' + (freePieceCount - 1);
        if (TodayState.pieces[lastIdx]) {
          TodayState.pieces[lastIdx].rating = entry.rating || 0;
          TodayState.pieces[lastIdx].durationMin = entry.durationMin || 0;
          TodayState.pieces[lastIdx]._timerSeconds = (entry.durationMin || 0) * 60;
          TodayState.pieces[lastIdx].notes = entry.notes || '';
        }
      }
    });
    // 延迟 prefill free piece UI
    setTimeout(prefillFreeUI, 150);
  }
}
  
function prefillEditUI() {
  const log = TodayState.existingLog;
  if (!log) return;
  const notes = document.getElementById('parentNotes');
  if (notes && log.parentNotes) notes.value = log.parentNotes;
  for (const [idx, piece] of Object.entries(TodayState.pieces)) {
    // 星星
    if (piece.rating > 0) {
      updateStarDisplay(idx, piece.rating);
    }
    if ((piece._timerSeconds || 0) > 0 || piece.durationMin > 0) {
      updatePieceTimerDisplay(idx);
      const badge = document.getElementById('timerBadge' + idx);
      if (badge && piece.durationMin > 0) {
        badge.textContent = piece.durationMin + '分钟';
        badge.style.display = '';
      }
    }
    // 速度
    if (piece.speed) {
      const speedInput = document.querySelector(`.piece-speed[data-index="${idx}"]`);
      if (speedInput) speedInput.value = piece.speed;
    }
    // 背谱/看谱按钮
    if (piece.memorized) {
      const memBtn = document.querySelector(`.piece-mem-btn[data-index="${idx}"]`);
      if (memBtn) {
        memBtn.textContent = '🧠 背谱';
        memBtn.style.color = 'var(--accent-primary)';
        memBtn.style.borderColor = 'rgba(245,160,152,0.3)';
        memBtn.style.background = 'rgba(245,160,152,0.15)';
      }
    }
    // 合手/分手按钮
    if (piece.handsTogether === false) {
      const handBtn = document.querySelector(`.piece-hand-btn[data-index="${idx}"]`);
      if (handBtn) {
        handBtn.textContent = '🤚 分手';
        handBtn.style.color = 'var(--accent-yellow)';
        handBtn.style.borderColor = 'rgba(245,216,154,0.3)';
        handBtn.style.background = 'rgba(245,216,154,0.15)';
      }
    }
  }
}

function prefillFreeUI() {
  const log = TodayState.existingLog;
  if (!log) return;
  for (const [idx, piece] of Object.entries(TodayState.pieces)) {
    if (!idx.startsWith('f')) continue;
    if (piece.rating > 0) {
      updateStarDisplay(idx, piece.rating);
    }
    if (piece._timerSeconds > 0 || piece.durationMin > 0) {
      updatePieceTimerDisplay(idx);
      const badge = document.getElementById('timerBadge' + idx);
      if (badge && piece.durationMin > 0) {
        badge.textContent = piece.durationMin + '分钟';
        badge.style.display = '';
      }
    }
    const notes = document.querySelector(`.free-piece-notes[data-index="${idx}"]`);
    if (notes && piece.notes) notes.value = piece.notes;
    // 速度
    if (piece.speed) {
      const speedInput = document.querySelector(`.piece-speed[data-index="${idx}"]`);
      if (speedInput) speedInput.value = piece.speed;
    }
    // 背谱/看谱
    if (piece.memorized) {
      const memBtn = document.querySelector(`.piece-mem-btn[data-index="${idx}"]`);
      if (memBtn) {
        memBtn.textContent = '🧠 背谱';
        memBtn.style.color = 'var(--accent-primary)';
        memBtn.style.borderColor = 'rgba(245,160,152,0.3)';
        memBtn.style.background = 'rgba(245,160,152,0.15)';
      }
    }
    // 合手/分手
    if (piece.handsTogether === false) {
      const handBtn = document.querySelector(`.piece-hand-btn[data-index="${idx}"]`);
      if (handBtn) {
        handBtn.textContent = '🤚 分手';
        handBtn.style.color = 'var(--accent-yellow)';
        handBtn.style.borderColor = 'rgba(245,216,154,0.3)';
        handBtn.style.background = 'rgba(245,216,154,0.15)';
      }
    }
  }
}

/* ------------------------------------------
   单曲计时器绑定
   ------------------------------------------ */
let activeTimerIdx = null;  // 当前正在计时的曲目 index
let freePieceCount = 0;     // 自由练习曲目计数

function bindPieceTimers() {
  // 开始按钮
  document.querySelectorAll('.piece-timer-start').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.timerStart;
      startPieceTimer(idx);
    });
  });

  // 结束按钮
  document.querySelectorAll('.piece-timer-stop').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.timerStop;
      stopPieceTimer(idx);
    });
  });
}

function startPieceTimer(idx) {
  // 如果已有其他计时器在运行，先停止
  if (activeTimerIdx !== null && activeTimerIdx !== idx) {
    stopPieceTimer(activeTimerIdx);
  }

  TodayState.initPiece(idx, '');
  const piece = TodayState.pieces[idx];
  if (piece._timerRunning) return;

  piece._timerRunning = true;
  piece._timerSeconds = piece._timerSeconds || 0;
  activeTimerIdx = idx;

  // UI：切换按钮
  const startBtn = document.querySelector(`.piece-timer-start[data-timer-start="${idx}"]`);
  const stopBtn = document.querySelector(`.piece-timer-stop[data-timer-stop="${idx}"]`);
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = '';

  const card = document.getElementById('piece' + idx);
  if (card) card.style.boxShadow = '0 0 0 2px var(--accent-green)';

  // 启动计时
  piece._timerInterval = setInterval(() => {
    piece._timerSeconds++;
    updatePieceTimerDisplay(idx);
  }, 1000);
}

function stopPieceTimer(idx) {
  TodayState.initPiece(idx, '');
  const piece = TodayState.pieces[idx];
  if (!piece._timerRunning) return;

  clearInterval(piece._timerInterval);
  piece._timerInterval = null;
  piece._timerRunning = false;
  piece.durationMin = Math.ceil(piece._timerSeconds / 60);

  if (activeTimerIdx === idx) activeTimerIdx = null;

  // UI：切换按钮
  const startBtn = document.querySelector(`.piece-timer-start[data-timer-start="${idx}"]`);
  const stopBtn = document.querySelector(`.piece-timer-stop[data-timer-stop="${idx}"]`);
  if (startBtn) startBtn.style.display = '';
  if (stopBtn) stopBtn.style.display = 'none';

  const card = document.getElementById('piece' + idx);
  if (card) card.style.boxShadow = '';

  // 显示记录时长 badge
  const badge = document.getElementById('timerBadge' + idx);
  if (badge && piece.durationMin > 0) {
    badge.textContent = piece.durationMin + '分钟';
    badge.style.display = '';
  }

  updatePieceTimerDisplay(idx);
}

function updatePieceTimerDisplay(idx) {
  const piece = TodayState.pieces[idx];
  if (!piece) return;
  const secs = piece._timerSeconds || 0;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  const timeStr = String(mins).padStart(2, '0') + ':' + String(remainSecs).padStart(2, '0');

  const display = document.getElementById('timerDisplay' + idx);
  if (display) display.textContent = timeStr;
}

/* ------------------------------------------
   生成复习列表
   ------------------------------------------ */
function generateReviewList(lesson) {
  const reviewList = document.getElementById('reviewList');
  if (!reviewList) return;

  const lessonNames = lesson.pieces.map(p => p.name);
  const reviews = RepertoireManager.getRandomReview(4, lessonNames, 1);
  const countEl = document.getElementById('reviewCount');
  if (countEl) countEl.textContent = reviews.length + '首';

  if (!reviews.length) {
    reviewList.innerHTML = '<p class="text-sm text-2 text-center p-12">暂无可复习曲目</p>';
    return;
  }

  reviewList.innerHTML = reviews.map((piece, i) => {
    const index = 'r' + i;
    TodayState.initPiece(index, piece.en || piece.name + '（复习）');
    TodayState.pieces[index].category = 'review';
    TodayState.pieces[index].repId = piece.id;
    TodayState.pieces[index].reviewMem = piece.memorized;

    // 直接生成复习卡片（带背谱按钮和计时器）
    return `
      <div class="piece-card" data-index="${index}" id="piece${index}">
        <div class="piece-card-top">
          <span class="piece-number">${i + 1}</span>
          <div class="piece-info" style="flex:1">
            <div class="piece-title">
              ${Utils.escape(piece.en || piece.name)}
              <span style="font-weight:400;color:var(--text-2);font-size:0.8rem"> ${Utils.escape(piece.name)}</span>
            </div>
          </div>
          <button class="btn btn-sm ${piece.memorized ? 'btn-primary' : 'btn-secondary'}"
                  style="font-size:0.7rem;padding:5px 10px"
                  onclick="toggleReviewMemorized('${index}', '${piece.id}')">
            ${piece.memorized ? '🧠 背谱' : '📖 看谱'}
          </button>
        </div>

        <div class="star-rating" data-index="${index}">
          ${[1,2,3,4,5].map(s => `
            <button class="star-btn" data-star="${s}" onclick="setStarRating('${index}', ${s})">⭐</button>
          `).join('')}
        </div>

        <!-- 单曲计时器 -->
        <div class="piece-timer" data-timer-idx="${index}">
          <span class="piece-timer-display" id="timerDisplay${index}">00:00</span>
          <button class="btn btn-sm btn-success piece-timer-start" data-timer-start="${index}">▶ 开始</button>
          <button class="btn btn-sm btn-secondary piece-timer-stop" data-timer-stop="${index}" style="display:none">⏹ 结束</button>
          <span class="piece-timer-badge" id="timerBadge${index}" style="display:none"></span>
        </div>

      </div>
    `;
  }).join('');

  // 重新绑定计时器（因为 review 是动态生成）
  bindPieceTimersReview();
}

// 编辑模式：从已有日志恢复复习曲目（保留原始评分/时长）
function restoreReviewPieces(existingLog) {
  const reviewList = document.getElementById('reviewList');
  if (!reviewList) return;

  const reviewEntries = existingLog.entries.filter(e => e.category === 'review');
  const countEl = document.getElementById('reviewCount');
  if (countEl) countEl.textContent = reviewEntries.length + '首';

  if (!reviewEntries.length) {
    reviewList.innerHTML = '<p class="text-sm text-2 text-center p-12">暂无可复习曲目</p>';
    return;
  }

  reviewList.innerHTML = reviewEntries.map((entry, i) => {
    const index = 'r' + i;
    const repPiece = RepertoireManager.findById(entry.repId);

    const pieceEn = repPiece ? repPiece.en : (entry.pieceName || '');
    const pieceName = repPiece ? repPiece.name : '';
    const memorized = repPiece ? repPiece.memorized : false;
    const repId = entry.repId || (repPiece ? repPiece.id : '');

    TodayState.initPiece(index, entry.pieceName || pieceEn || '复习');
    TodayState.pieces[index].category = 'review';
    TodayState.pieces[index].repId = repId;
    TodayState.pieces[index].reviewMem = memorized;
    TodayState.pieces[index].rating = entry.rating || 0;
    TodayState.pieces[index].durationMin = entry.durationMin || 0;
    TodayState.pieces[index].timerSeconds = (entry.durationMin || 0) * 60;
    TodayState.pieces[index]._timerSeconds = (entry.durationMin || 0) * 60;

    return `
      <div class="piece-card" data-index="${index}" id="piece${index}">
        <div class="piece-card-top">
          <span class="piece-number">${i + 1}</span>
          <div class="piece-info" style="flex:1">
            <div class="piece-title">
              ${Utils.escape(pieceEn)}
              ${pieceName ? '<span style="font-weight:400;color:var(--text-2);font-size:0.8rem"> ' + Utils.escape(pieceName) + '</span>' : ''}
            </div>
          </div>
          <button class="btn btn-sm ${memorized ? 'btn-primary' : 'btn-secondary'}"
                  style="font-size:0.7rem;padding:5px 10px"
                  onclick="toggleReviewMemorized('${index}', '${repId}')">
            ${memorized ? '🧠 背谱' : '📖 看谱'}
          </button>
        </div>

        <div class="star-rating" data-index="${index}">
          ${[1,2,3,4,5].map(s => '<button class="star-btn" data-star="' + s + '" onclick="setStarRating(\'' + index + '\', ' + s + ')">⭐</button>').join('')}
        </div>

        <div class="piece-timer" data-timer-idx="${index}">
          <span class="piece-timer-display" id="timerDisplay${index}">00:00</span>
          <button class="btn btn-sm btn-success piece-timer-start" data-timer-start="${index}">▶ 开始</button>
          <button class="btn btn-sm btn-secondary piece-timer-stop" data-timer-stop="${index}" style="display:none">⏹ 结束</button>
          <span class="piece-timer-badge" id="timerBadge${index}" style="display:none"></span>
        </div>

      </div>
    `;
  }).join('');

  bindPieceTimersReview();
}

// 为复习曲目绑定计时器（DOM 已存在后调用）
function bindPieceTimersReview() {
  document.querySelectorAll('#reviewList .piece-timer-start').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.timerStart;
      startPieceTimer(idx);
    });
  });
  document.querySelectorAll('#reviewList .piece-timer-stop').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.timerStop;
      stopPieceTimer(idx);
    });
  });
}

/* ------------------------------------------
   自由练习曲目卡片
   ------------------------------------------ */
function freePieceCardHTML(index, pieceName = '') {
  return `
    <div class="piece-card" data-index="f${index}" id="piecef${index}">
      <div class="piece-card-top" style="align-items:center">
        <span class="piece-number">${index + 1}</span>
        <div class="piece-info" style="flex:1">
          <input class="form-input free-piece-name" data-index="f${index}"
                 placeholder="输入曲目名称..." value="${Utils.escape(pieceName)}"
                 style="padding:6px 10px;font-size:0.85rem;border:none;background:transparent;font-weight:700;color:var(--text-1)">
        </div>
        <button class="btn btn-sm" onclick="removeFreePiece('f${index}')"
                style="font-size:0.65rem;padding:3px 8px;color:var(--danger);background:transparent">✕</button>
      </div>

      <div class="star-rating" data-index="f${index}">
        ${[1,2,3,4,5].map(s => '<button class="star-btn" data-star="' + s + '" onclick="setStarRating(\'f' + index + '\', ' + s + ')">⭐</button>').join('')}
      </div>

      <div class="piece-timer" data-timer-idx="f${index}">
        <span class="piece-timer-display" id="timerDisplayf${index}">00:00</span>
        <button class="btn btn-sm btn-success piece-timer-start" data-timer-start="f${index}">▶ 开始</button>
        <button class="btn btn-sm btn-secondary piece-timer-stop" data-timer-stop="f${index}" style="display:none">⏹ 结束</button>
        <span class="piece-timer-badge" id="timerBadgef${index}" style="display:none"></span>
      </div>

      <div class="form-group" style="margin-top:8px">
        <textarea class="form-input free-piece-notes" data-index="f${index}"
                  placeholder="练习备注..." rows="2"
                  style="min-height:40px;font-size:0.8rem;padding:8px 10px"></textarea>
      </div>
    </div>
  `;
}

window.addFreePiece = function(name) {
  const freeList = document.getElementById('freeList');
  if (!freeList) return;

  const placeholder = freeList.querySelector('p');
  if (placeholder) placeholder.remove();

  const card = document.createElement('div');
  card.innerHTML = freePieceCardHTML(freePieceCount, name || '');
  const cardEl = card.firstElementChild;
  freeList.appendChild(cardEl);

  const container = document.querySelector('.practice-category[data-cat="free"]');
  const body = document.querySelector('.practice-category-body[data-cat-body="free"]');
  if (container) container.classList.add('open');
  if (body) body.style.display = 'block';

  TodayState.initPiece('f' + freePieceCount, name || '');
  TodayState.pieces['f' + freePieceCount].category = 'free';
  TodayState.pieces['f' + freePieceCount].repId = '';

  const idx = 'f' + freePieceCount;
  const startBtn = cardEl.querySelector('.piece-timer-start');
  const stopBtn = cardEl.querySelector('.piece-timer-stop');
  if (startBtn) startBtn.addEventListener('click', () => startPieceTimer(idx));
  if (stopBtn) stopBtn.addEventListener('click', () => stopPieceTimer(idx));

  freePieceCount++;
  const countEl = document.getElementById('freeCount');
  if (countEl) countEl.textContent = freePieceCount + '首';
};

window.removeFreePiece = function(index) {
  const card = document.getElementById('piece' + index);
  if (!card) return;
  card.remove();

  if (TodayState.pieces[index]) {
    if (TodayState.pieces[index]._timerInterval) {
      clearInterval(TodayState.pieces[index]._timerInterval);
    }
    delete TodayState.pieces[index];
  }

  freePieceCount = Math.max(0, freePieceCount - 1);
  const countEl = document.getElementById('freeCount');
  if (countEl) countEl.textContent = freePieceCount + '首';

  const freeList = document.getElementById('freeList');
  if (freeList && freeList.children.length === 0) {
    freeList.innerHTML = '<p class="text-xs text-3 text-center p-12">点击下方按钮添加练习曲目</p>';
  }
};

function bindFreePieceTimers() {
  document.querySelectorAll('#freeList .piece-timer-start').forEach(btn => {
    btn.addEventListener('click', () => startPieceTimer(btn.dataset.timerStart));
  });
  document.querySelectorAll('#freeList .piece-timer-stop').forEach(btn => {
    btn.addEventListener('click', () => stopPieceTimer(btn.dataset.timerStop));
  });
}

/* ------------------------------------------
   交互函数（全局）
   ------------------------------------------ */

// 折叠/展开练习分类
window.toggleCategory = function(cat) {
  const container = document.querySelector(`.practice-category[data-cat="${cat}"]`);
  const body = document.querySelector(`.practice-category-body[data-cat-body="${cat}"]`);
  if (!container || !body) return;
  const isOpen = container.classList.contains('open');
  if (isOpen) {
    container.classList.remove('open');
    body.style.display = 'none';
  } else {
    container.classList.add('open');
    body.style.display = 'block';
  }
};

// 展开/收起曲目详情
window.togglePieceExpand = function(index) {
  const card = document.getElementById('piece' + index);
  if (card) {
    card.classList.toggle('expanded');
  }
};

// 设置星星评分
window.setStarRating = function(index, star) {
  TodayState.initPiece(index, '');
  const current = TodayState.pieces[index].rating;

  if (current === star) {
    // 满星 → 半星
    TodayState.pieces[index].rating = star - 0.5;
  } else if (current === star - 0.5) {
    // 半星 → 取消
    TodayState.pieces[index].rating = 0;
  } else {
    // 新选择 → 满星
    TodayState.pieces[index].rating = star;
  }

  updateStarDisplay(index, TodayState.pieces[index].rating);
};

function updateStarDisplay(index, rating) {
  const container = document.querySelector(`.star-rating[data-index="${index}"]`);
  if (!container) return;
  container.querySelectorAll('.star-btn').forEach(btn => {
    const s = parseInt(btn.dataset.star);
    btn.classList.remove('active', 'half');
    if (s <= Math.floor(rating)) {
      btn.classList.add('active');
    } else if (s === Math.ceil(rating) && rating % 1 !== 0) {
      btn.classList.add('half');
    }
  });
}

// 曲目时长由单曲计时器自动计算

// 练习速度变化
window.onPieceSpeedChange = function(index, val) {
  TodayState.initPiece(index, '');
  TodayState.pieces[index].speed = parseInt(val) || 0;
};

// 切换背谱/看谱
window.togglePieceMemorized = function(index, btn) {
  TodayState.initPiece(index, '');
  const cur = TodayState.pieces[index].memorized;
  TodayState.pieces[index].memorized = !cur;
  if (!cur) {
    btn.textContent = '🧠 背谱';
    btn.style.color = 'var(--accent-primary)';
    btn.style.borderColor = 'rgba(245,160,152,0.3)';
    btn.style.background = 'rgba(245,160,152,0.15)';
  } else {
    btn.textContent = '📖 看谱';
    btn.style.color = 'var(--text-3)';
    btn.style.borderColor = 'var(--border-2)';
    btn.style.background = 'rgba(255,255,255,0.06)';
  }
};

// 切换合手/分手
window.togglePieceHands = function(index, btn) {
  TodayState.initPiece(index, '');
  const cur = TodayState.pieces[index].handsTogether !== false;
  TodayState.pieces[index].handsTogether = !cur;
  if (!cur) {
    btn.textContent = '🤲 合手';
    btn.style.color = 'var(--accent-green)';
    btn.style.borderColor = 'rgba(142,212,166,0.3)';
    btn.style.background = 'rgba(142,212,166,0.15)';
  } else {
    btn.textContent = '🤚 分手';
    btn.style.color = 'var(--accent-yellow)';
    btn.style.borderColor = 'rgba(245,216,154,0.3)';
    btn.style.background = 'rgba(245,216,154,0.15)';
  }
};

// 切换复习曲目背谱状态
window.toggleReviewMemorized = function(index, repId) {
  if (!TodayState.pieces[index]) return;
  
  TodayState.pieces[index].reviewMem = !TodayState.pieces[index].reviewMem;
  
  // 同步到曲库
  RepertoireManager.toggleMemorized(repId);
  
  // 更新按钮
  const btn = event.target;
  if (TodayState.pieces[index].reviewMem) {
    btn.textContent = '🧠 背谱';
    btn.className = 'btn btn-sm btn-primary';
  } else {
    btn.textContent = '📖 看谱';
    btn.className = 'btn btn-sm btn-secondary';
  }
};

// 家长工具已移除，各分类使用统一 toggleCategory

// 完成练习
async function handleCompletePractice() {
  const completed = TodayState.getCompleted();

  // 累计所有曲目的计时器时长
  const totalTimerMin = Object.values(TodayState.pieces).reduce((sum, p) => sum + Math.ceil((p._timerSeconds || 0) / 60), 0);

  if (completed.length === 0 && totalTimerMin === 0) {
    Utils.showToast('⚠️ 请至少完成一项练习', 'warning');
    return;
  }

  // 确认对话框
  const isEdit = !!TodayState.existingLog;
  const confirmMsg = isEdit
    ? '确认保存修改？\n\n已完成 ' + completed.length + ' 首曲目\n总时长 ' + totalTimerMin + ' 分钟'
    : '确认提交今日练习？\n\n已完成 ' + completed.length + ' 首曲目\n总时长 ' + totalTimerMin + ' 分钟';
  if (!confirm(confirmMsg)) {
    return;
  }

  // 收集自由练习曲目的名称和备注（来自 DOM 输入）
  document.querySelectorAll('.free-piece-name').forEach(input => {
    const idx = input.dataset.index;
    if (TodayState.pieces[idx]) TodayState.pieces[idx].pieceName = input.value.trim() || '自由练习';
  });
  document.querySelectorAll('.free-piece-notes').forEach(textarea => {
    const idx = textarea.dataset.index;
    if (TodayState.pieces[idx]) TodayState.pieces[idx].notes = textarea.value.trim();
  });

  // 构建日志
  const entries = Object.values(TodayState.pieces).map(piece => ({
    pieceName: piece.pieceName,
    category: piece.category,
    durationMin: Math.ceil((piece._timerSeconds || 0) / 60),
    notes: piece.notes || '',
    rating: piece.rating || 0,
    repId: piece.repId || '',
    speed: piece.speed || 0,
    memorized: !!piece.memorized,
    handsTogether: piece.handsTogether !== false
  }));

  const totalMin = entries.reduce((sum, e) => sum + e.durationMin, 0) || totalTimerMin;

  const log = {
    id: isEdit ? TodayState.existingLog.id : Utils.uid(),
    date: isEdit ? TodayState.existingLog.date : Utils.today(),
    entries: entries,
    totalDurationMin: totalMin,
    parentNotes: document.getElementById('parentNotes')?.value || '',
    mood: TodayState.mood,
    sticker: TodayState.sticker
  };

  // 保存到数据库（用日志自身的日期做替换，编辑/新建均正确）
  const logDate = log.date;
  const logs = DB.logs().filter(l => l.date !== logDate);
  logs.push(log);
  DB.saveLogs(logs);

  // 更新曲库练习记录
  entries.forEach(entry => {
    if (entry.repId) {
      if (entry.durationMin > 0) {
        RepertoireManager.recordPractice(entry.repId, entry.durationMin);
      }
      // 同步背谱状态
      if (entry.memorized) {
        const repPiece = RepertoireManager.findById(entry.repId);
        if (repPiece && !repPiece.memorized) {
          RepertoireManager.setMemorized(entry.repId, true);
        }
      }
      // 同步合手/分手状态
      if (entry.handsTogether !== undefined) {
        RepertoireManager.setHandsTogether(entry.repId, entry.handsTogether);
      }
    }
  });

  // 停止所有计时器
  if (activeTimerIdx !== null) stopPieceTimer(activeTimerIdx);

  // 重置状态
  TodayState.reset();

  // 显示成功提示
  Utils.showToast(isEdit ? '✅ 修改已保存！' : '✅ 今日练习已记录！', 'success');

  // 重新渲染
  renderAll();

  // 自动同步（异步，不阻塞）
  // sync now manual via sync code
}

// 编辑今日记录
window.editTodayLog = function() {
  // 保留原有数据，进入编辑模式
  const log = DB.logs().find(l => l.date === Utils.today());
  if (!log) return;
  
  TodayState.existingLog = log;
  renderAll();
  
  Utils.showToast('📝 编辑模式：修改后请点击「保存修改」保存', 'info', 2500);
};

console.log('✅ Today page module loaded');
