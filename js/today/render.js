/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
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
    const focusHtml = (e.focusAreas && e.focusAreas.length)
      ? '<div style="margin-top:6px">' +
          e.focusAreas.map(tag =>
            '<span class="badge badge-info" style="font-size:0.65rem;padding:1px 6px;margin-right:4px;display:inline-block">' +
              Utils.escape(tag) +
            '</span>'
          ).join('') +
        '</div>'
      : '';
    const detailsHtml = e.details
      ? '<div style="margin-top:6px;font-size:0.75rem;color:var(--text-3);line-height:1.4">' +
          '<span style="color:var(--accent-primary)">📝 </span>' +
          Utils.escape(e.details) +
        '</div>'
      : '';
    return (
      '<div style="padding:8px 0;border-bottom:1px solid var(--border-2)">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<div style="flex:1;font-size:0.85rem;font-weight:600;color:var(--text-1)">' +
            Utils.escape(e.pieceName) +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:4px">' +
            mem + stars + duration +
          '</div>' +
        '</div>' +
        focusHtml +
        detailsHtml +
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
 * @param {string[]} focusAreas 练习重点标签数组（用于在老师要求里高亮）
 * @param {string} details    老师要求/备注
 * @returns {string} HTML
 */
function pieceCardHTML(index, pieceName, num, focusAreas, details, lessonId) {
  // 老师要求：重点关键词高亮显示
  var detailsHtml = '';
  if (details) {
    var highlighted = Utils.escape(details);
    var focusKws = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏'];
    focusKws.forEach(function(kw) {
      // 用 HTML 高亮包裹匹配到的关键词
      highlighted = highlighted.split(kw).join(
        '<span style="background:rgba(94,106,210,0.25);color:#a5ade8;padding:1px 4px;border-radius:3px;font-weight:600">' + kw + '</span>'
      );
    });
    detailsHtml =
      '<div class="piece-details-row" style="margin-top:12px;padding:12px;background:rgba(var(--accent-primary-rgb),0.08);border-radius:8px;font-size:0.8rem;color:var(--text-2);line-height:1.5">' +
        '<span style="font-weight:600;color:var(--text-1)">📝 </span>' +
        highlighted +
      '</div>';
  }

  // 老师反馈（整理后的，带时间点+状态）
  var feedbackHtml = '';
  // 曲谱查看按钮（移到工具栏，此处只生成 HTML 片段）
  var sheetBtnHtml = '';
  if (typeof Feedback !== 'undefined' && pieceName) {
    var feedbacks = Feedback.byPiece(pieceName).filter(function(f) {
      return !lessonId || String(f.lessonId) === String(lessonId);
    });
    // 方案A：照片也直接挂在课程曲目上，没有图钉也能查看
    var lessonPhotoIds = collectLessonPiecePhotoIds(pieceName);
    if (feedbacks.length || lessonPhotoIds.length) {
      var statusMap = {
        'new': { icon: '🔵', label: '未完成', color: '#5E6AD2' },
        'resolved': { icon: '✅', label: '完成', color: '#4caf7d' }
      };

      // 曲谱照片查看入口：feedback 有 sheetPhotoId，或课程曲目上挂了照片
      var photoOwner = feedbacks.find(function(f) { return f.sheetPhotoId; });
      if (photoOwner || lessonPhotoIds.length) {
        var pinCount = feedbacks.filter(function(f) { return f.pinX !== null && f.pinX !== undefined; }).length;
        sheetBtnHtml = '<button type="button" onclick="viewSheetPhoto(\'' + Utils.escape(pieceName) + '\')" ' +
          'style="font-size:0.7rem;padding:4px 10px;border-radius:6px;border:1px solid rgba(94,106,210,0.3);background:rgba(94,106,210,0.08);color:#a5ade8;cursor:pointer">' +
          '🎼 课堂记录' + (pinCount ? '<span style="margin-left:3px;font-size:0.62rem;opacity:0.8">·' + pinCount + '</span>' : '') + '</button>';
      }

      var items = feedbacks.map(function(f) {
        var s = statusMap[f.status] || statusMap['new'];
        // 方案B：优先用 feedback 自己的 timestamp；向后兼容旧数据（无 timestamp 时从 marker 查找）
        var timeLabel = '';
        var markerNote = '';
        var playBlobId = null;
        var playOffsetSec = 0;
        if (f.timestamp != null) {
          // 新数据：图钉有自己的时间戳
          var sec = f.timestamp;
          var mm = Math.floor(sec / 60);
          var ss = sec % 60;
          timeLabel = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
          // 从课程录音段中定位
          var lessons = DB.lessons();
          for (var i = 0; i < lessons.length; i++) {
            if (String(lessons[i].id) === String(f.lessonId)) {
              var segments = lessons[i].lessonAudios
                || (lessons[i].lessonAudioId ? [{ id: lessons[i].lessonAudioId, startSec: 0, durationSec: lessons[i].audioDurationSec || 0 }] : []);
              if (segments.length && typeof LessonAudio !== 'undefined') {
                var seg = LessonAudio.findSegmentForTimestamp(segments, f.timestamp || 0);
                if (seg) {
                  playBlobId = seg.id;
                  playOffsetSec = seg.offsetSec;
                }
              }
              break;
            }
          }
        } else if (f.markerId) {
          // 旧数据兼容：从 marker 查找时间戳
          var lessons = DB.lessons();
          for (var i = 0; i < lessons.length; i++) {
            var markers = lessons[i].audioMarkers || [];
            var m = markers.find(function(mk) { return mk.id === f.markerId; });
            if (m) {
              var sec = m.timestamp;
              var mm = Math.floor(sec / 60);
              var ss = sec % 60;
              timeLabel = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
              markerNote = m.label || m.note || '';
              var segments = lessons[i].lessonAudios
                || (lessons[i].lessonAudioId ? [{ id: lessons[i].lessonAudioId, startSec: 0, durationSec: lessons[i].audioDurationSec || 0 }] : []);
              if (segments.length && typeof LessonAudio !== 'undefined') {
                var seg = LessonAudio.findSegmentForTimestamp(segments, m.timestamp || 0);
                if (seg) {
                  playBlobId = seg.id;
                  playOffsetSec = seg.offsetSec;
                }
              }
              break;
            }
          }
        }
        // 优先用 feedback 的 locationLabel + teacherNote，空则 fallback 到 marker.note
        var content = '';
        var locLabel = f.locationLabel ? ' ' + Utils.escape(f.locationLabel) : '';
        var noteLabel = f.teacherNote ? ' ' + Utils.escape(f.teacherNote) : '';
        if (locLabel || noteLabel) {
          content = locLabel + noteLabel;
        } else if (markerNote) {
          content = ' ' + Utils.escape(markerNote);
        }
        // 录音播放按钮（有定位到的录音段才显示）
        var playBtn = '';
        if (playBlobId) {
          playBtn = '<button type="button" class="feedback-play-btn" data-feedback-id="' + f.id + '" data-blob-id="' + playBlobId + '" data-timestamp="' + playOffsetSec + '"' +
            ' onclick="event.stopPropagation(); playFeedbackAudio(\'' + f.id + '\', this)"' +
            ' style="font-size:0.68rem;padding:2px 8px;border-radius:4px;border:1px solid rgba(94,106,210,0.35);background:rgba(94,106,210,0.1);color:#a5ade8;cursor:pointer">▶️ 从' + timeLabel + '播</button>';
        }
        // 方案 D：状态圆圈（紫○未完成 / 绿✓已完成），整行点击切换状态
        var isResolved = (f.status === Feedback.STATUS_RESOLVED);
        var statusDotStyle = isResolved
          ? 'background:#4caf7d;border-color:#4caf7d;color:#fff;'
          : 'background:transparent;border-color:#5E6AD2;color:#5E6AD2;';
        var statusDotIcon = isResolved ? '✓' : '';
        var rowBaseStyle =
          'display:flex;align-items:center;gap:6px;padding:6px 8px;margin:2px -8px;' +
          'font-size:0.78rem;border-radius:6px;cursor:pointer;user-select:none;' +
          'transition:background 120ms ease-out;';
        var rowHoverClass = 'feedback-row-toggle';
        var resolvedMuteStyle = isResolved ? 'opacity:0.55;text-decoration:line-through;text-decoration-thickness:1px;' : '';
        var rowOnclick = 'onclick="toggleFeedbackStatus(\'' + f.id + '\', this, event)"';
        var rowDataStatus = 'data-status="' + f.status + '"';
        return '<div ' + rowOnclick + ' ' + rowDataStatus + ' class="' + rowHoverClass + '" style="' + rowBaseStyle + '" data-feedback-id="' + f.id + '">' +
          (timeLabel ? '<span style="color:var(--text-4);font-family:monospace;font-size:0.72rem;min-width:36px;pointer-events:none">' + timeLabel + '</span>' : '<span style="min-width:36px;pointer-events:none"></span>') +
          // 方案D：彩色状态圆（紫○/绿✓），跟整行一起接收点击
          '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;border:1.5px solid;flex-shrink:0;font-size:11px;font-weight:600;pointer-events:none;' + statusDotStyle + '">' + statusDotIcon + '</span>' +
          '<span style="flex:1;color:var(--text-2);' + resolvedMuteStyle + ';pointer-events:none">' + content + '</span>' +
          // 右侧播放按钮（用 stopPropagation 阻止触发行切换）
          (playBtn ? playBtn : '') +
        '</div>';
      }).join('');
      feedbackHtml =
        '<div class="piece-feedback-row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-2)">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
            '<span style="font-size:0.75rem;color:var(--text-3)">📌 老师反馈</span>' +
            (sheetBtnHtml ? sheetBtnHtml : '') +
          '</div>' +
          items +
        '</div>';
    }
  }

  return (
    '<div class="piece-card" data-index="' + index + '" id="piece' + index + '" data-piece-name="' + Utils.escape(pieceName) + '">' +
      '<div class="piece-card-top" onclick="togglePieceExpand(\'' + index + '\', event)">' +
        '<span class="piece-number">' + num + '</span>' +
        '<div class="piece-info">' +
          '<div class="piece-title">' + Utils.escape(pieceName) + '</div>' +
        '</div>' +
        '<span class="piece-expand-icon">▼</span>' +
      '</div>' +
      '<div class="piece-card-body">' +
        detailsHtml +
        feedbackHtml +
        starRatingHTML(index) +
        '<div class="piece-toolbar" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px">' +
          '<label style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;color:var(--text-3)">' +
            '速度' +
            '<input type="number" class="piece-speed" data-index="' + index + '"' +
                   ' placeholder="120" min="40" max="240" maxlength="3"' +
                   ' oninput="onPieceSpeedChange(\'' + index + '\', this.value)"' +
                   ' style="width:56px;padding:4px 8px;font-size:0.7rem;text-align:center;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-1);color:var(--text-2);font-family:inherit">' +
          '</label>' +
          '<button class="btn btn-sm piece-stage-btn" data-index="' + index + '"' +
                  ' onclick="advancePieceStage(\'' + index + '\')"' +
                  ' style="font-size:0.7rem;padding:4px 10px;background:rgba(245,216,154,0.12);color:var(--accent-yellow);border:1px solid rgba(245,216,154,0.3)">🎓 阶段</button>' +
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
      '🔁 复习 <span id="reviewCount" style="font-size:0.75rem;color:var(--text-3);font-weight:400"></span> <button onclick="showReviewRangePanel()" style="font-size:0.65rem;padding:1px 6px;border:1px solid var(--border-2);border-radius:6px;background:transparent;color:var(--text-3);cursor:pointer">⚙️ 范围</button>',
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
      pieceCardHTML(String(i), p.name, seqInBook + 1, p.focusAreas, p.details, lesson.id)
    ).join('');

    html += renderCategorySectionOpen(catKey, bookLabel, cardsHtml);
  });

  html += renderCategorySectionOpen(
    'review',
    '🔁 复习 <span id="reviewCount" style="font-size:0.75rem;color:var(--text-3);font-weight:400"></span> <button onclick="showReviewRangePanel()" style="font-size:0.65rem;padding:1px 6px;border:1px solid var(--border-2);border-radius:6px;background:transparent;color:var(--text-3);cursor:pointer">⚙️ 范围</button>',
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
  html += '<div style="padding:12px 16px;margin-bottom:12px;background:var(--surface-1);border-radius:12px;display:flex;justify-content:space-around;align-items:center">';
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
   今日页：顶部组件（时钟 + 环状图 + 星星卡）
   ------------------------------------------ */

/**
 * 生成「练习计时」时钟 HTML（圆形表盘）
 * 保留 totalTimerDisplay / totalTimerStart/Pause/Stop 的 id 供 timer.js 绑定
 * @returns {string}
 */
function totalTimerHTML() {
  var ticks = '';
  for (var i = 0; i < 12; i++) {
    ticks += '<span class="today-clock-tick" style="transform:rotate(' + (i * 30) + 'deg)"></span>';
  }
  return '<div class="today-clock">' +
    '<div class="today-clock-face">' +
      '<div class="today-clock-ticks">' + ticks + '</div>' +
      '<div class="today-clock-center">' +
        '<span class="today-clock-label">练习计时</span>' +
        '<span class="total-timer-display" id="totalTimerDisplay">00:00</span>' +
      '</div>' +
    '</div>' +
    '<div class="today-clock-controls">' +
      '<button id="totalTimerStart" class="btn today-clock-btn start" title="开始">▶</button>' +
      '<button id="totalTimerPause" class="btn today-clock-btn pause" style="display:none" title="暂停">⏸</button>' +
      '<button id="totalTimerStop" class="btn today-clock-btn stop" style="display:none" title="停止">⏹</button>' +
    '</div>' +
  '</div>';
}

/**
 * 生成「老师反馈完成率」环状图 HTML
 * 无反馈时显示 0% 占位
 * @returns {string}
 */
function feedbackRateBarHTML() {
  const all = Feedback.all();
  const resolved = Feedback.byStatus(Feedback.STATUS_RESOLVED).length;
  const pct = all.length ? Math.round(resolved / all.length * 100) : 0;
  const R = 40;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  const sub = all.length ? (resolved + '/' + all.length) : '暂无';
  return '<div class="today-ring-wrap">' +
    '<svg class="today-ring" viewBox="0 0 100 100">' +
      '<circle class="today-ring-bg" cx="50" cy="50" r="' + R + '"></circle>' +
      '<circle class="today-ring-fill" cx="50" cy="50" r="' + R + '" style="stroke-dasharray:' + dash.toFixed(1) + ' ' + C.toFixed(1) + '"></circle>' +
    '</svg>' +
    '<div class="today-ring-center">' +
      '<span class="today-ring-num">' + pct + '%</span>' +
      '<span class="today-ring-label">反馈完成</span>' +
      '<span class="today-ring-sub">' + sub + '</span>' +
    '</div>' +
  '</div>';
}

/**
 * 生成「本周星星」卡片 HTML
 * @param {{stars:number, pieces:number}} encourage 本周激励数据
 * @returns {string}
 */
function todayEncourageHTML(encourage) {
  var stars = encourage.stars || 0;
  var pieces = encourage.pieces || 0;
  return '<div class="today-stat today-star-card">' +
    '<span class="today-stat-icon">⭐</span>' +
    '<div class="today-stat-body">' +
      '<span class="today-stat-title">本周已点亮</span>' +
      '<span class="today-stat-num">' + stars + '<em>颗</em></span>' +
      '<span class="today-stat-sub">练了 ' + pieces + ' 首</span>' +
    '</div>' +
  '</div>';
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

  // 本周激励 + 反馈环状图（统计区）
  const encourage = (typeof computeWeeklyEncourage === 'function') ? computeWeeklyEncourage() : { stars: 0, pieces: 0 };
  const statsHTML = '<div class="today-stats">' +
    todayEncourageHTML(encourage) +
    feedbackRateBarHTML() +
  '</div>';
  // 练习模式顶部：时钟 + 星星卡 + 反馈环 三个卡片一行（均分）
  const topHTML = '<div class="today-top">' +
    totalTimerHTML() +
    todayEncourageHTML(encourage) +
    feedbackRateBarHTML() +
  '</div>';

  // 已有今日日志 → 显示已完成记录
  if (log) {
    const msStats = computeMilestoneStatsForRange('day');
    const milestonesHTML = buildMilestonesHTML(msStats.maxStars, msStats.maxDuration, msStats.streak, msStats.title, true);
    page.innerHTML = '<div class="today-bright">' +
      statsHTML +
      '<div id="sectionCompleted">' +
        renderTodayCompletedHTML(log) +
        milestonesHTML +
      '</div>' +
    '</div>';
    // 绑定修改按钮
    const btnEdit = document.getElementById('btnEditToday');
    if (btnEdit) {
      btnEdit.addEventListener('click', function() {
        const lessons = DB.lessons();
        // 按日期降序排序，取最新课程
        const lesson = lessons.length
          ? lessons.sort((a, b) => b.date.localeCompare(a.date))[0]
          : null;
        page.innerHTML = '<div class="today-bright">' +
          topHTML +
          '<div id="sectionPracticeForm">' +
            '<div id="todayPracticeForm">' +
              buildPracticeFormHTML(lesson) +
            '</div>' +
            '<div class="today-notes">' +
              '<textarea id="parentNotes" class="form-input" placeholder="家长笔记（可选）" rows="2"></textarea>' +
            '</div>' +
            '<div class="today-submit">' +
              '<button id="btnCompletePractice" class="btn btn-primary today-submit-btn">✅ 保存修改</button>' +
            '</div>' +
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
  // 按日期降序排序，取最新课程（而非数组末尾元素）
  const lesson = lessons.length
    ? lessons.sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  page.innerHTML = '<div class="today-bright">' +
    topHTML +
    '<div id="sectionPracticeForm">' +
      '<div id="todayPracticeForm">' +
        buildPracticeFormHTML(lesson) +
      '</div>' +
      '<div class="today-notes">' +
        '<textarea id="parentNotes" class="form-input" placeholder="家长笔记（可选）" rows="2"></textarea>' +
      '</div>' +
      '<div class="today-submit">' +
        '<button id="btnCompletePractice" class="btn btn-primary today-submit-btn">✅ 完成今日练习</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  // 绑定事件（即使没有课程也要绑定，确保计时器、自由练习等功能正常）
  bindTodayEvents(lesson, null);
}

// app.js 兼容别名
const renderToday = renderTodayPage;

/**
 * 方案 D：点击反馈整行切换状态（new ↔ resolved）
 * 点击播放按钮会 stopPropagation，所以不会触发到这里
 */
window.toggleFeedbackStatus = function(feedbackId, rowEl, evt) {
  if (evt && evt.target) {
    // 双重保险：点的是播放按钮就不切状态
    var tgt = evt.target;
    while (tgt && tgt !== rowEl) {
      if (tgt.classList && tgt.classList.contains('feedback-play-btn')) return;
      if (tgt.tagName === 'BUTTON') return;
      tgt = tgt.parentNode;
    }
  }
  var current = Feedback.find(feedbackId);
  if (!current) return;
  var updated;
  if (current.status === Feedback.STATUS_RESOLVED) {
    updated = Feedback.markRegress(feedbackId, 'self');
    if (updated) Utils.showToast('↩️ 已撤销完成', 'info');
  } else {
    updated = Feedback.markProgress(feedbackId);
    if (updated) Utils.showToast('✅ 完成！', 'success');
  }
  if (updated) _refreshFeedbackRowUI(feedbackId, updated);
};

/**
 * 反馈「✅ 完成」（兼容保留，供别处旧代码调用）
 */
window.markFeedbackProgress = function(feedbackId, btn) {
  const updated = Feedback.markProgress(feedbackId);
  if (!updated) return;
  Utils.showToast('✅ 完成！', 'success');
  _refreshFeedbackRowUI(feedbackId, updated);
};

/**
 * 反馈「↩️ 撤销」（兼容保留，供别处旧代码调用）
 */
window.markFeedbackRegress = function(feedbackId, btn) {
  const updated = Feedback.markRegress(feedbackId, 'self');
  if (!updated) return;
  Utils.showToast('↩️ 已撤销完成', 'info');
  _refreshFeedbackRowUI(feedbackId, updated);
};

/**
 * 反馈项：从课堂录音的 marker 时间点开始播放
 * @param {string} feedbackId
 * @param {HTMLElement} btnEl 点击的播放按钮
 */
window.playFeedbackAudio = function(feedbackId, btnEl) {
  if (typeof LessonAudio === 'undefined') {
    Utils.showToast('⚠️ 录音模块未加载', 'warning');
    return;
  }
  const blobId = btnEl && btnEl.dataset ? btnEl.dataset.blobId : '';
  const timestamp = parseInt(btnEl && btnEl.dataset ? btnEl.dataset.timestamp || '0' : '0', 10);
  if (!blobId) { Utils.showToast('⚠️ 音频不存在', 'error'); return; }
  // 正在播放 → 停止；否则从 marker 时间点播放
  if (LessonAudio.isPlaying(feedbackId)) {
    LessonAudio.stopPlayback();
    return;
  }
  const originalText = btnEl.textContent;
  btnEl.textContent = '⏸ 播放中...';
  LessonAudio.playFromTimestamp(blobId, timestamp, feedbackId, function() {
    // 播放结束：恢复按钮文案
    const row = document.querySelector('[data-feedback-id="' + feedbackId + '"]');
    if (!row) return;
    const playBtn = row.querySelector('.feedback-play-btn');
    if (playBtn) playBtn.textContent = originalText;
  });
};

/**
 * 方案 D 局部刷新：状态圆圈、data-status、内容变淡删除线、onclick
 * DOM 顺序：row > [0]timeSpan [1]statusDotSpan [2]contentSpan [3]playBtn(可选)
 * @param {string} feedbackId
 * @param {FeedbackItem} updated
 */
function _refreshFeedbackRowUI(feedbackId, updated) {
  var row = document.querySelector('[data-feedback-id="' + feedbackId + '"]');
  if (!row) return;
  var isResolved = (updated.status === Feedback.STATUS_RESOLVED);
  row.setAttribute('data-status', updated.status);
  // 第2个子元素：状态圆圈 span
  var dotSpan = row.children[1];
  if (dotSpan && dotSpan.tagName === 'SPAN') {
    if (isResolved) {
      dotSpan.style.background = '#4caf7d';
      dotSpan.style.borderColor = '#4caf7d';
      dotSpan.style.color = '#fff';
      dotSpan.textContent = '✓';
    } else {
      dotSpan.style.background = 'transparent';
      dotSpan.style.borderColor = '#5E6AD2';
      dotSpan.style.color = '#5E6AD2';
      dotSpan.textContent = '';
    }
  }
  // 第3个子元素：内容 span
  var contentSpan = row.children[2];
  if (contentSpan) {
    if (isResolved) {
      contentSpan.style.opacity = '0.55';
      contentSpan.style.textDecoration = 'line-through';
      contentSpan.style.textDecorationThickness = '1px';
    } else {
      contentSpan.style.opacity = '';
      contentSpan.style.textDecoration = '';
      contentSpan.style.textDecorationThickness = '';
    }
  }
  // 更新行 onclick（保险起见，即使函数相同也重置一下 evt.target 判定）
  row.onclick = function(evt) { toggleFeedbackStatus(feedbackId, row, evt); };
}

/**
 * 收集课程数据里挂在曲目上的曲谱照片 ID（方案A：照片可独立于图钉存在）
 * @param {string} pieceName 曲子名称
 * @returns {string[]} 去重后的 blob id 列表
 */
function collectLessonPiecePhotoIds(pieceName) {
  var seen = {};
  var ids = [];
  (DB.lessons() || []).forEach(function(l) {
    (l.pieces || []).forEach(function(p) {
      if (p.name === pieceName && Array.isArray(p.sheetPhotoIds)) {
        p.sheetPhotoIds.forEach(function(id) {
          if (id && !seen[id]) { seen[id] = 1; ids.push(id); }
        });
      }
    });
  });
  return ids;
}

/**
 * 查看曲谱照片 + 图钉（可交互：点图钉弹出详情浮层，可听录音/推进状态）
 * @param {string} pieceName 曲子名称
 */
window.viewSheetPhoto = async function(pieceName) {
  var feedbacks = Feedback.byPiece(pieceName);

  // 收集所有唯一的照片 ID（去重，保持首次出现顺序）
  // 来源：课程曲目上挂的照片（方案A）+ 图钉反馈引用的照片（旧数据兼容）
  var seenIds = new Set();
  var allPhotoIds = [];
  collectLessonPiecePhotoIds(pieceName).forEach(function(id) {
    if (!seenIds.has(id)) { seenIds.add(id); allPhotoIds.push(id); }
  });
  feedbacks.forEach(function(f) {
    if (f.sheetPhotoId && !seenIds.has(f.sheetPhotoId)) {
      seenIds.add(f.sheetPhotoId);
      allPhotoIds.push(f.sheetPhotoId);
    }
  });

  if (allPhotoIds.length === 0) {
    Utils.showToast('⚠️ 无曲谱照片', 'warning');
    return;
  }

  // 把当前曲子的 feedbacks 存到闭包，供图钉点击回调使用
  window._sheetViewerContext = { pieceName: pieceName, feedbacks: feedbacks, allPhotoIds: allPhotoIds };

  var statusMap = {
    'new': { icon: '🔵', label: '未完成', color: '#5E6AD2' },
    'resolved': { icon: '✅', label: '完成', color: '#4caf7d' }
  };

  // 创建模态
  var overlay = document.createElement('div');
  overlay.id = 'sheetPhotoViewer';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML =
    '<div style="position:relative;max-width:100%;max-height:100%;overflow:auto">' +
      '<button type="button" onclick="window._closeSheetViewer()" ' +
      'style="position:absolute;top:8px;right:8px;z-index:2;font-size:1.2rem;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.6);color:#fff;cursor:pointer">✕</button>' +
      '<div id="sheetPhotoContainer" style="display:flex;flex-direction:column;align-items:center;gap:4px">' +
        '<p style="color:#aaa;text-align:center;padding:40px">加载中...</p>' +
      '</div>' +
    '</div>';
  // 浮层挂在 body 直接子元素（而非 modal 内层），避免被 modal 的 overflow:auto 容器裁剪/遮挡
  var bodyPopup = document.createElement('div');
  bodyPopup.id = 'sheetPinPopup';
  bodyPopup.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:10001;box-sizing:border-box';
  document.body.appendChild(bodyPopup);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) window._closeSheetViewer();
  });
  document.body.appendChild(overlay);

  window._closeSheetViewer = function() {
    // 关闭时清理播放
    if (typeof LessonAudio !== 'undefined') LessonAudio.stopPlayback();
    var vw = document.getElementById('sheetPhotoViewer');
    if (vw) vw.remove();
    var bp = document.getElementById('sheetPinPopup');
    if (bp) bp.remove();
    delete window._sheetViewerContext;
    delete window._openSheetPinPopup;
    delete window._closeSheetPinPopup;
    delete window._sheetPinProgress;
    delete window._sheetPinRegress;
    delete window._sheetPinPlay;
    delete window._closeSheetViewer;
    // 刷新今日页面反馈行 UI（状态可能被推进过）
    if (window._sheetViewerRefresh) { window._sheetViewerRefresh(); delete window._sheetViewerRefresh; }
  };

  /**
   * 渲染所有图钉（根据 feedbacks 当前状态渲染颜色，按 photoPage 分到各页）
   */
  function renderPins(container) {
    var fbs = window._sheetViewerContext.feedbacks;
    var pinData = fbs.filter(function(f) { return f.pinX !== null && f.pinX !== undefined; });

    // 按 photoPage 分组
    var pinsByPage = {};
    pinData.forEach(function(p) {
      var page = (p.photoPage != null) ? p.photoPage : 1;
      if (!pinsByPage[page]) pinsByPage[page] = [];
      pinsByPage[page].push(p);
    });

    // 全局序号：按页码从小到大累加
    var globalIdx = 0;
    // 为每个照片页渲染图钉
    var photoWraps = container.querySelectorAll('.sheet-photo-wrap');
    photoWraps.forEach(function(wrap) {
      var pageIdx = parseInt(wrap.getAttribute('data-page'), 10);
      var pageNum = pageIdx + 1;
      var pagePins = pinsByPage[pageNum] || [];

      var pinsLayer = wrap.querySelector('.sheet-pins-layer');
      if (!pinsLayer) {
        pinsLayer = document.createElement('div');
        pinsLayer.className = 'sheet-pins-layer';
        pinsLayer.style.cssText = 'position:absolute;inset:0;pointer-events:auto';
        wrap.appendChild(pinsLayer);
      }

      pinsLayer.innerHTML = pagePins.map(function(f) {
        globalIdx++;
        var s = statusMap[f.status] || statusMap['new'];
        var left = (f.pinX * 100).toFixed(1);
        var top = (f.pinY * 100).toFixed(1);
        return '<div data-fb-id="' + f.id + '"' +
          ' onclick="window._openSheetPinPopup(this)"' +
          ' style="position:absolute;left:' + left + '%;top:' + top + '%;transform:translate(-50%,-50%);' +
          'width:26px;height:26px;border-radius:50%;background:' + s.color + ';border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);' +
          'display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer">' + globalIdx + '</div>';
      }).join('');
    });
  }

  /**
   * 点击图钉 → 打开详情浮层
   */
  window._openSheetPinPopup = function(pinEl) {
    try {
    var fbId = pinEl.getAttribute('data-fb-id');
    var f = Feedback.find(fbId);
    if (!f) return;
    // 更新 context 中的 feedback（状态可能变了）
    var ctx = window._sheetViewerContext;
    ctx.feedbacks = Feedback.byPiece(ctx.pieceName);

    var s = statusMap[f.status] || statusMap['new'];
    var cat = Feedback.categoryInfo(f.category);

    // 计算录音播放信息
    var playBlobId = null;
    var playOffsetSec = 0;
    var timeLabel = '';
    var tsSource = null; // 'own' 或 'marker'
    var debugReason = null;
    if (f.timestamp != null) {
      tsSource = 'own';
      var sec = f.timestamp;
      var mm = Math.floor(sec / 60);
      var ss = sec % 60;
      timeLabel = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
      var lessons = DB.lessons();
      var lesson = null;
      for (var i = 0; i < lessons.length; i++) {
        if (String(lessons[i].id) === String(f.lessonId)) { lesson = lessons[i]; break; }
      }
      if (!lesson) {
        debugReason = '找不到 lessonId=' + f.lessonId;
      } else {
        var segments = lesson.lessonAudios
          || (lesson.lessonAudioId ? [{ id: lesson.lessonAudioId, startSec: 0, durationSec: lesson.audioDurationSec || 0 }] : []);
        if (!segments.length) {
          debugReason = 'lesson ' + f.lessonId + ' 无录音段';
        } else if (typeof LessonAudio === 'undefined') {
          debugReason = 'LessonAudio 未加载';
        } else {
          var seg = LessonAudio.findSegmentForTimestamp(segments, f.timestamp || 0);
          if (seg) { playBlobId = seg.id; playOffsetSec = seg.offsetSec; }
          else { debugReason = 'findSegmentForTimestamp(' + f.timestamp + ') 未命中, segments=' + JSON.stringify(segments); }
        }
      }
    } else if (f.markerId) {
      tsSource = 'marker';
      var lessons = DB.lessons();
      for (var i = 0; i < lessons.length; i++) {
        var markers = lessons[i].audioMarkers || [];
        var m = markers.find(function(mk) { return mk.id === f.markerId; });
        if (m) {
          var sec = m.timestamp;
          var mm = Math.floor(sec / 60);
          var ss = sec % 60;
          timeLabel = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
          var segments = lessons[i].lessonAudios
            || (lessons[i].lessonAudioId ? [{ id: lessons[i].lessonAudioId, startSec: 0, durationSec: lessons[i].audioDurationSec || 0 }] : []);
          if (segments.length && typeof LessonAudio !== 'undefined') {
            var seg = LessonAudio.findSegmentForTimestamp(segments, m.timestamp || 0);
            if (seg) { playBlobId = seg.id; playOffsetSec = seg.offsetSec; }
            else { debugReason = 'marker ' + m.id + ': findSegmentForTimestamp 未命中'; }
          } else if (!segments.length) {
            debugReason = 'marker ' + m.id + ': lesson 无录音段';
          }
          break;
        }
      }
    }

    if (!playBlobId && timeLabel) {
      console.warn('[sheet pin popup] 有时间戳但找不到录音段, fbId=' + f.id + ', ts=' + timeLabel + ', source=' + tsSource + ', reason=' + (debugReason || '?'));
    }

    var playBtnHtml = '';
    if (playBlobId) {
      playBtnHtml = '<button type="button" data-sheet-play-id="' + f.id + '"' +
        ' onclick="window._sheetPinPlay(this, \'' + f.id + '\', \'' + playBlobId + '\', ' + playOffsetSec + ')"' +
        ' style="font-size:0.7rem;padding:3px 10px;border-radius:5px;border:1px solid #5E6AD2;background:#5E6AD2;color:#fff;font-weight:700;cursor:pointer">▶️ 从' + timeLabel + '播</button>';
    } else if (timeLabel) {
      playBtnHtml = '<span style="font-size:0.7rem;color:#555;font-weight:700;padding:3px 8px;border:1px dashed #999;border-radius:5px">⏱ ' + timeLabel + '（录音不可用）</span>';
    }

    // 方案 D：状态圆圈（紫○未完成 / 绿✓已完成），点击圆圈切换状态，不再使用独立按钮
    var pinResolved = (f.status === Feedback.STATUS_RESOLVED);
    var pinDotBg = pinResolved ? '#4caf7d' : 'transparent';
    var pinDotBorder = pinResolved ? '#4caf7d' : '#5E6AD2';
    var pinDotColor = pinResolved ? '#fff' : '#5E6AD2';
    var pinDotIcon = pinResolved ? '✓' : '';
    // 状态圆圈：描边统一 2px 加粗；未完成加淡紫内填充，避免空心圈被半透底色稀释
    var pinDotBorderW = '2px';
    var pinDotBgFinal = pinResolved
      ? '#4caf7d'
      : 'rgba(94,106,210,0.20)';
    var pinStatusDot =
      '<span onclick="event.stopPropagation(); window._sheetPinToggleStatus(\'' + f.id + '\', this)"' +
      ' title="' + (pinResolved ? '已完成，点击撤销' : '未完成，点击标记完成') + '"' +
      ' style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;' +
      'border-radius:999px;border:' + pinDotBorderW + ' solid ' + pinDotBorder + ';background:' + pinDotBgFinal + ';' +
      'color:' + pinDotColor + ';font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;' +
      'box-shadow:0 1px 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.15)">' + pinDotIcon + '</span>';
    var pinStatusLabel =
      '<span style="font-size:0.72rem;color:' + s.color + ';font-weight:700">' + s.label + '</span>';

    // 淡黄便利贴底色方案：黑字 fill + 4 方向白色 text-shadow 做描边
    //   浅底（白谱纸+淡黄叠）→ 黑字直接可读
    //   深底（黑音符+淡黄叠）→ 白描边把黑字框出来
    var txtOutline =
      'color:#0a0a0a;' +
      'text-shadow:' +
      '-1px -1px 0 rgba(255,255,255,0.92),' +
      ' 1px -1px 0 rgba(255,255,255,0.92),' +
      '-1px  1px 0 rgba(255,255,255,0.92),' +
      ' 1px  1px 0 rgba(255,255,255,0.92),' +
      ' 0 1px 2px rgba(0,0,0,0.15);';
    var locHtml = f.locationLabel
      ? '<div style="font-size:0.75rem;margin-bottom:4px;font-weight:700;' + txtOutline + '">📍 ' + Utils.escape(f.locationLabel) + '</div>'
      : '';
    // 老师原话框：更浓的米白底（几乎不透明，稳承托文字）+ 纯黑字，与外框半透便利贴拉开层次
    var noteHtml = f.teacherNote
      ? '<div style="font-size:0.75rem;color:#0a0a0a;margin-bottom:6px;padding:6px 8px;' +
        'background:rgba(255,248,215,0.90);border-radius:5px;font-weight:700;' +
        'border:1px solid rgba(120,100,30,0.18);' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.12)">💬 ' +
        Utils.escape(f.teacherNote) + '</div>'
      : '';
    var voiceBtnHtml = '';
    if (f.parentVoiceId) {
      voiceBtnHtml = '<button type="button" data-sheet-voice-id="' + f.id + '"' +
        ' onclick="window._sheetPinPlayVoice(this, \'' + f.parentVoiceId + '\')"' +
        ' style="font-size:0.7rem;padding:3px 10px;border-radius:5px;border:1px solid #9333ea;background:#9333ea;color:#fff;font-weight:700;cursor:pointer">🎤 家长讲解</button>';
    }

    // 计算浮层位置：用 fixed 定位 + box-sizing:border-box
    // 用 documentElement.clientWidth/Height 取"不含滚动条"的真实可视区
    var popupEl = document.getElementById('sheetPinPopup');
    var pinRect = pinEl.getBoundingClientRect();

    var dEl = document.documentElement;
    var vw = dEl.clientWidth;
    var vh = dEl.clientHeight;
    var targetWidth = Math.min(240, vw - 16);
    var gap = 14;
    var edgeMargin = 12;
    var txtOutlineLocal = txtOutline; // 黑字白描边（适配淡黄底色）
    // 状态标签（紫色"未完成"/绿色"完成"）需保留彩色本体色，再叠白色描边做对比
    var statusTxtOutline =
      'color:' + s.color + ';' +
      'text-shadow:' +
      '-1px -1px 0 rgba(255,255,255,0.92),' +
      ' 1px -1px 0 rgba(255,255,255,0.92),' +
      '-1px  1px 0 rgba(255,255,255,0.92),' +
      ' 1px  1px 0 rgba(255,255,255,0.92);';

    // 先设初始样式：opacity:0 + pointer-events:none 防闪烁，同时保证浏览器正常渲染布局
    // 不能再用 left:-9999px —— 部分浏览器对极端离屏元素 getBoundingClientRect() 返回 0×0
    // 底色：淡黄便利贴 rgba(255,236,165,0.55)，边框仍用主题紫做弱分割
    popupEl.style.cssText =
      'position:fixed;left:0;top:0;width:' + targetWidth + 'px;' +
      'opacity:0;pointer-events:none;' +
      'box-sizing:border-box;' +
      'background:rgba(255,236,165,0.55);border:1px solid rgba(120,100,30,0.22);border-radius:10px;' +
      'padding:8px 10px;box-shadow:0 4px 18px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.18) inset;' +
      'z-index:10001;' + txtOutlineLocal +
      'font-family:inherit;line-height:1.4;font-weight:700;' +
      'max-height:' + (vh - 16) + 'px;overflow-y:auto';

    // 先写内容，再测真实尺寸（最稳：不再估任何 padding/border）
    popupEl.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          pinStatusDot +
          // 状态文字：彩色本体 + 白描边
          '<span style="font-size:0.72rem;font-weight:700;' + statusTxtOutline + '">' + s.label + '</span>' +
          // 分类标签：黑字白描边
          '<span style="font-size:0.72rem;font-weight:700;' + txtOutlineLocal + '">' + cat.icon + ' ' + cat.label + '</span>' +
        '</div>' +
        '<button type="button" onclick="window._closeSheetPinPopup()" style="font-size:0.9rem;background:none;border:none;' + txtOutlineLocal + 'cursor:pointer;padding:0 2px;font-weight:700">✕</button>' +
      '</div>' +
      locHtml +
      noteHtml +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
        playBtnHtml +
        voiceBtnHtml +
      '</div>';

    // ★ 渲染后测量真实宽高（彻底消除 padding/border/box-model 估算误差）
    var realRect = popupEl.getBoundingClientRect();
    var realWidth = realRect.width;
    var realHeight = realRect.height;

    // 默认放图钉右侧（距离用 gap = 14px）
    var leftPx = pinRect.right + gap;
    var topPx = pinRect.top + 4;

    // 简易定位：右侧 → 左侧 → 上方 → 下方，视口 clamp
    if (leftPx + realWidth > vw - edgeMargin) {
      leftPx = pinRect.left - realWidth - gap;
    }
    if (leftPx < edgeMargin) {
      leftPx = pinRect.left + pinRect.width / 2 - realWidth / 2;
      topPx = pinRect.top - realHeight - gap;
    }
    if (topPx < edgeMargin) {
      leftPx = pinRect.left + pinRect.width / 2 - realWidth / 2;
      topPx = pinRect.bottom + gap;
    }
    // 硬 clamp 到视口
    leftPx = Math.max(edgeMargin, Math.min(leftPx, vw - realWidth - edgeMargin));
    topPx  = Math.max(edgeMargin, Math.min(topPx, vh - realHeight - edgeMargin));

    leftPx = Math.trunc(leftPx);
    topPx  = Math.trunc(topPx);

    popupEl.style.left = leftPx + 'px';
    popupEl.style.top = topPx + 'px';

    popupEl.style.opacity = '1';
    popupEl.style.pointerEvents = 'auto';
  } catch (err) {
    // 兜底：任何异常都不允许静默吞掉，把错误显示到浮层里便于排查
    console.error('[sheet pin popup] 打开失败:', err);
    var pe = document.getElementById('sheetPinPopup');
    if (pe) {
      pe.style.cssText =
        'position:fixed;left:16px;top:16px;width:260px;opacity:1;pointer-events:auto;box-sizing:border-box;' +
        'background:#fff3cd;border:1px solid #e0a800;border-radius:8px;padding:10px;z-index:10001;' +
        'color:#6b4d00;font-size:12px;font-weight:700;line-height:1.5';
      pe.innerHTML = '⚠️ 打开图钉失败<br><span style="font-weight:400;color:#8a6d3b">' +
        Utils.escape(String(err && err.message || err)) + '</span>';
    }
  }
};

  window._closeSheetPinPopup = function() {
    var el = document.getElementById('sheetPinPopup');
    if (el) { el.innerHTML = ''; el.style.cssText = ''; }
    if (typeof LessonAudio !== 'undefined') LessonAudio.stopPlayback();
  };

  /**
   * 浮层里播放课堂录音
   */
  window._sheetPinPlay = function(btn, fbId, blobId, offset) {
    if (typeof LessonAudio === 'undefined') { Utils.showToast('⚠️ 录音模块未加载', 'warning'); return; }
    var playId = 'sheet_pin_' + fbId;
    if (LessonAudio.isPlaying(playId)) { LessonAudio.stopPlayback(); return; }
    var orig = btn.innerHTML;
    btn.innerHTML = '⏸ 播放中...';
    LessonAudio.playFromTimestamp(blobId, offset, playId, function() { btn.innerHTML = orig; });
  };

  /**
   * 浮层里播放家长语音
   */
  window._sheetPinPlayVoice = function(btn, voiceId) {
    if (typeof LessonAudio === 'undefined') { Utils.showToast('⚠️ 录音模块未加载', 'warning'); return; }
    var playId = 'sheet_voice_' + voiceId;
    if (LessonAudio.isPlaying(playId)) { LessonAudio.stopPlayback(); return; }
    var orig = btn.innerHTML;
    btn.innerHTML = '⏸ 播放中...';
    LessonAudio.playFromTimestamp(voiceId, 0, playId, function() { btn.innerHTML = orig; });
  };

  /**
   * 浮层方案 D：点击状态圆圈切换 new ↔ resolved
   * 推进/撤销合并一个函数，切完刷新图钉颜色 + 重开浮层 + 同步今日行
   */
  window._sheetPinToggleStatus = function(fbId, dotEl) {
    var current = Feedback.find(fbId);
    if (!current) return;
    var updated;
    if (current.status === Feedback.STATUS_RESOLVED) {
      updated = Feedback.markRegress(fbId, 'self');
      if (updated) Utils.showToast('↩️ 已撤销完成', 'info');
    } else {
      updated = Feedback.markProgress(fbId);
      if (updated) Utils.showToast('✅ 完成！', 'success');
    }
    if (!updated) return;
    // 刷新曲谱区图钉颜色（图钉颜色跟状态绑定）
    var container = document.getElementById('sheetPhotoContainer');
    if (typeof renderPins === 'function' && container) renderPins(container);
    // 重新打开浮层（状态圆圈/标签等会重绘）
    var newPin = document.querySelector('#sheetPhotoViewer [data-fb-id="' + fbId + '"]');
    if (newPin) window._openSheetPinPopup(newPin);
    // 同步刷新今日页面的反馈行 UI
    window._sheetViewerRefresh = function() { _refreshFeedbackRowUI(fbId, updated); };
  };

  /**
   * 浮层里"搞定"推进状态（兼容保留，旧代码可能调）
   */
  window._sheetPinProgress = function(fbId, btn) {
    window._sheetPinToggleStatus(fbId, btn);
  };

  /**
   * 浮层里"↩️ 撤销"（兼容保留，旧代码可能调）
   */
  window._sheetPinRegress = function(fbId, btn) {
    window._sheetPinToggleStatus(fbId, btn);
  };

  // 加载所有照片
  try {
    var container = document.getElementById('sheetPhotoContainer');
    var photosHtml = '';
    var loadedCount = 0;

    for (var p = 0; p < allPhotoIds.length; p++) {
      var photoId = allPhotoIds[p];
      var pageNum = p + 1;
      try {
        var record = await StorageAdapter.get(photoId);
        if (!record || !record.blob) {
          photosHtml += '<div class="sheet-photo-wrap" data-page="' + p + '" style="position:relative;display:inline-block;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden">' +
            '<p style="color:#aaa;text-align:center;padding:20px">照片已删除</p></div>';
          continue;
        }
        var blob = record.blob;
        var url = URL.createObjectURL(blob);
        photosHtml += '<div class="sheet-photo-wrap" data-page="' + p + '" style="position:relative;display:inline-block;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden">' +
          '<img src="' + url + '" style="max-width:100%;max-height:80vh;display:block;border-radius:8px" alt="曲谱 第' + pageNum + '页">' +
          '<div class="sheet-pins-layer" style="position:absolute;inset:0;pointer-events:auto"></div>' +
          '<div style="position:absolute;top:4px;right:4px">' +
            '<span style="font-size:0.65rem;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.5);padding:1px 6px;border-radius:4px">第' + pageNum + '页</span>' +
          '</div>' +
          '</div>';
        loadedCount++;
        // 清理 URL（图片加载后）
        (function(imgUrl) {
          var imgs = container.querySelectorAll('img');
          // URL 延迟清理
          setTimeout(function() { URL.revokeObjectURL(imgUrl); }, 5000);
        })(url);
      } catch (e) {
        photosHtml += '<div class="sheet-photo-wrap" data-page="' + p + '" style="position:relative;display:inline-block;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden">' +
          '<p style="color:#aaa;text-align:center;padding:20px">加载失败</p></div>';
      }
    }

    if (loadedCount === 0) {
      container.innerHTML = '<p style="color:#aaa;text-align:center;padding:40px">无可用照片</p>';
      return;
    }

    container.innerHTML = photosHtml;
    // 渲染图钉
    renderPins(container);
  } catch (e) {
    console.error('[viewSheetPhoto] error:', e);
    document.getElementById('sheetPhotoContainer').innerHTML = '<p style="color:#aaa;text-align:center;padding:40px">加载失败</p>';
  }
};

console.log('✅ Render module loaded');