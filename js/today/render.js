/* ==========================================
   🏠 今日练琴 - 渲染逻辑
   ========================================== */
"use strict";

/* ------------------------------------------
   星星评分组件（所有模块共享，定义在 render.js 最前面）
   ------------------------------------------ */

/**
 * 生成半星评分组件 HTML
 * 每颗星分左右两个点击区域，左半=X-0.5，右半=X.0
 * @param {string} index 曲目索引
 * @returns {string} HTML
 */
function starRatingHTML(index) {
  var html = '<div class="star-rating" data-index="' + index + '">';
  for (var i = 1; i <= 5; i++) {
    html += '<div class="star-unit" data-star="' + i + '">';
    html += '<div class="star-half-left" onclick="event.stopPropagation(); setStarRating(\'' + index + '\', ' + (i - 0.5) + ')"></div>';
    html += '<div class="star-half-right" onclick="event.stopPropagation(); setStarRating(\'' + index + '\', ' + i + ')"></div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/**
 * 生成半星显示 HTML（只读，用于已完成记录展示）
 * @param {number} rating 评分（0-5，步长 0.5）
 * @returns {string} HTML
 */
function starDisplayHTML(rating) {
  if (!rating) return '';
  var html = '<span class="star-display">';
  for (var i = 1; i <= 5; i++) {
    if (rating >= i) {
      html += '<span class="star-display-unit full"></span>';
    } else if (rating >= i - 0.5) {
      html += '<span class="star-display-unit half"></span>';
    } else {
      html += '<span class="star-display-unit empty"></span>';
    }
  }
  html += '</span>';
  return html;
}

/* ------------------------------------------
   内部工具：按册分组
   ------------------------------------------ */

/**
 * 从 lesson.pieces 数组提取有序 book 列表（去重，保持首次出现顺序）
 * @param {LessonPiece[]} lessonPieces
 * @returns {Array<number|null>}
 */
function getOrderedBooks(lessonPieces) {
  const seen = new Set();
  const order = [];
  for (const p of lessonPieces) {
    const b = (p.book != null) ? p.book : null;
    const key = String(b);
    if (!seen.has(key)) {
      seen.add(key);
      order.push(b);
    }
  }
  return order;
}

/**
 * 生成折叠式分类区块 HTML（表单用，默认折叠）
 * @param {string} catKey   data-cat 标识
 * @param {string} titleHtml 标题（可含子标签）
 * @param {string} bodyHtml  内容
 * @returns {string}
 */
function renderCategorySection(catKey, titleHtml, bodyHtml) {
  return (
    '<div class="practice-category" data-cat="' + catKey + '">' +
      '<div class="practice-category-header" onclick="toggleCategory(\'' + catKey + '\')">' +
        '<span class="practice-category-title">' + titleHtml + '</span>' +
        '<span class="practice-category-arrow">▶</span>' +
      '</div>' +
      '<div class="practice-category-body" data-cat-body="' + catKey + '" style="display:none">' +
        bodyHtml +
      '</div>' +
    '</div>'
  );
}

/**
 * 生成折叠式分类区块 HTML（默认展开，用于复习和自由练习）
 * @param {string} catKey   data-cat 标识
 * @param {string} titleHtml 标题（可含子标签）
 * @param {string} bodyHtml  内容
 * @returns {string}
 */
function renderCategorySectionOpen(catKey, titleHtml, bodyHtml) {
  return (
    '<div class="practice-category open" data-cat="' + catKey + '">' +
      '<div class="practice-category-header" onclick="toggleCategory(\'' + catKey + '\')">' +
        '<span class="practice-category-title">' + titleHtml + '</span>' +
        '<span class="practice-category-arrow">▼</span>' +
      '</div>' +
      '<div class="practice-category-body" data-cat-body="' + catKey + '">' +
        bodyHtml +
      '</div>' +
    '</div>'
  );
}

/**
 * 生成折叠式分类区块 HTML（已完成记录用，默认展开）
 * @param {string}     catKey    区块标识
 * @param {string}     titleHtml 标题
 * @param {LogEntry[]} entries   该组条目
 * @returns {string}
 */
function renderCompletedSection(catKey, titleHtml, entries) {
  const rows = entries.map(e => {
   const stars = e.rating
  ? starDisplayHTML(e.rating)
  : '<span style="color:var(--text-4);font-size:0.75rem">未评分</span>';
    const duration = e.durationMin
      ? ' <span style="color:var(--text-3);font-size:0.75rem">' + e.durationMin + '分钟</span>'
      : '';
    const mem = e.memorized
      ? '<span style="font-size:0.7rem;color:var(--accent-primary);margin-right:4px">🧠</span>'
      : '';
    return (
      '<div style="display:flex;align-items:center;gap:8px;' +
            'padding:8px 0;border-bottom:1px solid var(--border-2)">' +
        '<div style="flex:1;font-size:0.85rem;font-weight:600;color:var(--text-1)">' +
          Utils.escape(e.pieceName) +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:4px">' +
          mem + stars + duration +
        '</div>' +
      '</div>'
    );
  }).join('');

  return (
    '<div class="practice-category open" data-cat="' + catKey + '">' +
      '<div class="practice-category-header" onclick="toggleCategory(\'' + catKey + '\')">' +
        '<span class="practice-category-title">' + titleHtml + '</span>' +
        '<span class="practice-category-arrow">▶</span>' +
      '</div>' +
      '<div class="practice-category-body" data-cat-body="' + catKey + '" style="display:block">' +
        rows +
      '</div>' +
    '</div>'
  );
}

/* ------------------------------------------
   曲目卡片 HTML（不改，保持原样）
   ------------------------------------------ */

/**
 * 生成单首课程曲目的练习卡片 HTML
 * @param {string} index      曲目索引（如 "0"、"1"）
 * @param {string} pieceName  曲目名称
 * @param {number} num        卡片内序号（显示用）
 * @returns {string} HTML
 */
function pieceCardHTML(index, pieceName, num) {
  return (
    '<div class="piece-card" data-index="' + index + '" id="piece' + index + '">' +
      '<div class="piece-card-top" onclick="togglePieceExpand(\'' + index + '\', event)">' +
        '<span class="piece-number">' + num + '</span>' +
        '<div class="piece-info">' +
          '<div class="piece-title">' + Utils.escape(pieceName) + '</div>' +
        '</div>' +
        '<span class="piece-expand-icon">▼</span>' +
      '</div>' +
      '<div class="piece-card-body">' +
        starRatingHTML(index) +
        '<div class="piece-extra-row">' +
          '<div class="piece-extra-item">' +
            '<label class="piece-extra-label">速度 BPM</label>' +
            '<input type="number" class="form-input piece-speed" data-index="' + index + '"' +
                   ' placeholder="120" min="40" max="240"' +
                   ' oninput="onPieceSpeedChange(\'' + index + '\', this.value)"' +
                   ' style="width:80px;padding:5px 8px;font-size:0.8rem">' +
          '</div>' +
          '<button class="btn btn-sm btn-secondary piece-mem-btn" data-index="' + index + '"' +
                  ' onclick="togglePieceMemorized(\'' + index + '\', this)"' +
                  ' style="font-size:0.7rem;padding:5px 10px">📖 看谱</button>' +
          '<button class="btn btn-sm btn-secondary piece-hand-btn" data-index="' + index + '"' +
                  ' onclick="togglePieceHands(\'' + index + '\', this)"' +
                  ' style="font-size:0.7rem;padding:5px 10px">🤲 合手</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

/* ------------------------------------------
   今日练习表单（按册分组，返回 HTML 字符串）
   ------------------------------------------ */

/**
 * 构建今日练习表单 HTML
 * 分组顺序：册卡（按课程录入顺序）→ 复习卡 → 自由练习卡
 * @param {Lesson} lesson 当前课程
 * @returns {string} HTML 字符串
 */
function buildPracticeFormHTML(lesson) {
  // 即使没有课程，也需要显示复习和自由练习部分
  if (!lesson) {
    return renderCategorySectionOpen(
      'review',
      '🔁 复习 <span id="reviewCount" style="font-size:0.75rem;color:var(--text-3);font-weight:400"></span>',
      '<div id="reviewList"><p class="text-sm text-2 text-center p-12">加载中...</p></div>'
    ) + renderCategorySectionOpen(
      'free',
      '🎹 自由练习 <span id="freeCount" style="font-size:0.75rem;color:var(--text-3);font-weight:400">0首</span>',
      '<div id="freeList"><p class="text-xs text-3 text-center p-12">点击下方按钮添加练习曲目</p></div>' +
      '<div style="margin-top:8px"><button class="btn btn-secondary btn-sm" id="btnAddFree" style="width:100%;font-size:0.8rem">＋ 添加自由练习曲目</button></div>'
    );
  }

  const orderedBooks = getOrderedBooks(lesson.pieces);
  let html = '';

  orderedBooks.forEach(bookNum => {
    const piecesInBook = lesson.pieces
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => (p.book != null ? p.book : null) === bookNum);

    if (!piecesInBook.length) return;

    const bookLabel = (bookNum != null)
      ? '📖 ' + RepertoireManager.getBookDisplayName(bookNum)
      : '📖 其他';

    const catKey = 'book_' + bookNum;

    const cardsHtml = piecesInBook.map(({ p, i }, seqInBook) =>
      pieceCardHTML(String(i), p.name, seqInBook + 1)
    ).join('');

    html += renderCategorySectionOpen(catKey, bookLabel, cardsHtml);
  });

  html += renderCategorySectionOpen(
    'review',
    '🔁 复习 <span id="reviewCount" style="font-size:0.75rem;color:var(--text-3);font-weight:400"></span>',
    '<div id="reviewList"><p class="text-sm text-2 text-center p-12">加载中...</p></div>'
  );

  html += renderCategorySectionOpen(
    'free',
    '🎹 自由练习 <span id="freeCount" style="font-size:0.75rem;color:var(--text-3);font-weight:400">0首</span>',
    '<div id="freeList"><p class="text-xs text-3 text-center p-12">点击下方按钮添加练习曲目</p></div>' +
    '<div style="margin-top:8px"><button class="btn btn-secondary btn-sm" id="btnAddFree" style="width:100%;font-size:0.8rem">＋ 添加自由练习曲目</button></div>'
  );

  return html;
}

/* ------------------------------------------
   今日已完成记录（按册分组，返回 HTML 字符串）
   ------------------------------------------ */

/**
 * 构建今日已完成记录 HTML
 * 分组顺序：册卡 → 复习卡 → 自由练习卡
 * @param {Log} log 日志对象
 * @returns {string} HTML 字符串
 */
function renderTodayCompletedHTML(log) {
  if (!log || !log.entries || !log.entries.length) {
    return '<p class="text-sm text-2 text-center p-12">今日暂无练习记录</p>';
  }

  const entries = log.entries;
  const reviewEntries = entries.filter(e => e.category === 'review');
  const freeEntries = entries.filter(e => e.category === 'free');
  const bookEntries = entries.filter(e => e.category !== 'review' && e.category !== 'free');

  // ── 汇总信息 ──
  const totalPieces = entries.length;
  const totalMin = log.totalDurationMin || entries.reduce((s, e) => s + (e.durationMin || 0), 0);
  const totalStars = entries.reduce((s, e) => s + (e.rating || 0), 0);

  let html = '';

  // 汇总卡片
  html += '<div style="padding:12px 16px;margin-bottom:12px;background:rgba(255,255,255,0.04);border-radius:12px;display:flex;justify-content:space-around;align-items:center">';
  html += '<div style="text-align:center"><div style="font-size:1.4rem;font-weight:700;color:var(--text-1)">' + totalPieces + '</div><div style="font-size:0.7rem;color:var(--text-3)">首曲目</div></div>';
  html += '<div style="text-align:center"><div style="font-size:1.4rem;font-weight:700;color:var(--text-1)">' + totalMin + '</div><div style="font-size:0.7rem;color:var(--text-3)">分钟</div></div>';
  html += '<div style="text-align:center"><div style="font-size:1.4rem;font-weight:700;color:var(--accent-yellow)">' + totalStars + '</div><div style="font-size:0.7rem;color:var(--text-3)">总星星</div></div>';
  html += '</div>';

  // ── 按 book 分组课程曲目 ──
  const bookMap = new Map();
  for (const entry of bookEntries) {
    const b = (entry.book != null) ? entry.book : null;
    const key = String(b);
    if (!bookMap.has(key)) bookMap.set(key, { bookNum: b, entries: [] });
    bookMap.get(key).entries.push(entry);
  }

  // 册卡
  for (const { bookNum, entries: group } of bookMap.values()) {
    const bookLabel = (bookNum != null)
      ? '📖 ' + RepertoireManager.getBookDisplayName(bookNum)
      : '📖 其他';
    html += renderCompletedSection('done_book_' + bookNum, bookLabel, group);
  }

  // 复习卡
  if (reviewEntries.length) {
    html += renderCompletedSection('done_review', '🔁 复习', reviewEntries);
  }

  // 自由练习卡
  if (freeEntries.length) {
    html += renderCompletedSection('done_free', '🎹 自由练习', freeEntries);
  }

  // ── 修改按钮 ──
  html += '<div style="padding:16px 12px">';
  html += '<button class="btn btn-secondary" id="btnEditToday" style="width:100%;padding:12px;font-size:0.9rem">✏️ 修改今日练习</button>';
  html += '</div>';

  return html;
}

/* ------------------------------------------
   今日页顶层入口（直接写入 page-today）
   ------------------------------------------ */

/**
 * 渲染整个今日页
 * 直接操作 #page-today 的 innerHTML
 * @returns {void}
 */
function renderTodayPage() {
  console.log('[renderTodayPage] 渲染今日页');
  const page = document.getElementById('page-today');
  if (!page) return;

  const todayStr = Utils.today();
  const log = DB.logs().find(l => l.date === todayStr) || null;
  console.log('[renderTodayPage] 今日日志:', !!log);

  // 已有今日日志 → 显示已完成记录
    if (log) {
    page.innerHTML = '<div id="sectionCompleted">' +
      renderTodayCompletedHTML(log) +
    '</div>';
    // 绑定修改按钮
    const btnEdit = document.getElementById('btnEditToday');
    if (btnEdit) {
      btnEdit.addEventListener('click', function() {
        const lessons = DB.lessons();
        const lesson = lessons.length ? lessons[lessons.length - 1] : null;
        page.innerHTML =
          '<div id="sectionPracticeForm">' +
            '<div class="total-timer">' +
              '<span class="total-timer-label">⏱ 练习计时</span>' +
              '<span class="total-timer-display" id="totalTimerDisplay">00:00</span>' +
              '<div class="total-timer-controls">' +
                '<button id="totalTimerStart" class="btn btn-sm btn-success">▶ 开始</button>' +
                '<button id="totalTimerPause" class="btn btn-sm btn-secondary" style="display:none">⏸ 暂停</button>' +
                '<button id="totalTimerStop" class="btn btn-sm btn-danger" style="display:none">⏹ 停止</button>' +
              '</div>' +
            '</div>' +
            '<div id="todayPracticeForm">' +
              buildPracticeFormHTML(lesson) +
            '</div>' +
            '<div style="margin-top:16px;padding:12px">' +
              '<textarea id="parentNotes" class="form-input" placeholder="家长笔记（可选）" rows="2" style="font-size:0.85rem"></textarea>' +
            '</div>' +
            '<div style="padding:12px">' +
              '<button id="btnCompletePractice" class="btn btn-primary" style="width:100%;padding:14px;font-size:1rem;font-weight:700">✅ 保存修改</button>' +
            '</div>' +
          '</div>';
        // 注意：即使没有课程，也要绑定事件（计时器、自由练习等仍需工作）
        bindTodayEvents(lesson, log);
      });
    }
    return;
  }

  // 无日志 → 显示练习表单
  const lessons = DB.lessons();
  const lesson = lessons.length ? lessons[lessons.length - 1] : null;

  page.innerHTML =
    '<div id="sectionPracticeForm">' +
      '<div class="total-timer">' +
        '<span class="total-timer-label">⏱ 练习计时</span>' +
        '<span class="total-timer-display" id="totalTimerDisplay">00:00</span>' +
        '<div class="total-timer-controls">' +
          '<button id="totalTimerStart" class="btn btn-sm btn-success">▶ 开始</button>' +
          '<button id="totalTimerPause" class="btn btn-sm btn-secondary" style="display:none">⏸ 暂停</button>' +
          '<button id="totalTimerStop" class="btn btn-sm btn-danger" style="display:none">⏹ 停止</button>' +
        '</div>' +
      '</div>' +
      '<div id="todayPracticeForm">' +
        buildPracticeFormHTML(lesson) +
      '</div>' +
      '<div style="margin-top:16px;padding:12px">' +
        '<textarea id="parentNotes" class="form-input" placeholder="家长笔记（可选）" rows="2" style="font-size:0.85rem"></textarea>' +
      '</div>' +
      '<div style="padding:12px">' +
        '<button id="btnCompletePractice" class="btn btn-primary" style="width:100%;padding:14px;font-size:1rem;font-weight:700">✅ 完成今日练习</button>' +
      '</div>' +
    '</div>';

  // 绑定事件（即使没有课程也要绑定，确保计时器、自由练习等功能正常）
  bindTodayEvents(lesson, null);
}

// app.js 兼容别名
const renderToday = renderTodayPage;

console.log('✅ Render module loaded');