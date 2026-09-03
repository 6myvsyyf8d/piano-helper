/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   🏠 今日练琴 - 复习列表 + 自由练习 + 事件绑定 + 预填
   ========================================== */
"use strict";

/**
 * 任务 2：从 piece 或 entry 推断所属册号
 * 优先级：piece.book > 从 repId 反推（"s2-01"→2）> null
 * @param {Object} piece 含 book 或 repId 字段的对象
 * @returns {number|null}
 */
function inferBookFromPiece(piece) {
  if (piece.book) return piece.book;
  if (piece.repId) {
    const b = RepertoireManager.bookFromRepId(piece.repId);
    if (b != null) return b;
  }
  return null;
}

/* ------------------------------------------
   任务 3：复习游戏化抽卡
   ------------------------------------------ */

/**
 * 获取今日跳过次数
 * @returns {number}
 */
function getSkipCount() {
  const key = 'review_skip_count_' + Utils.today();
  return parseInt(localStorage.getItem(key) || '0');
}

/**
 * 递增今日跳过次数
 * @returns {number} 递增后的次数
 */
function incrementSkipCount() {
  const key = 'review_skip_count_' + Utils.today();
  const count = getSkipCount() + 1;
  localStorage.setItem(key, String(count));
  return count;
}

/* ------------------------------------------
   遗忘曲线复习：间隔表 + 状态计算
   ------------------------------------------ */

// 复习间隔表（按练习次数递增）：练 N 次后，下一次复习应在 interval 天后
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

/**
 * 根据练习次数取复习间隔（天）
 * 练 1 次 → 1 天，2 次 → 3 天，3 次 → 7 天，4 次 → 14 天，5+ 次 → 30 天
 */
function getReviewInterval(piece) {
  const n = piece.practiceCount || 0;
  const idx = Math.max(0, Math.min(n - 1, REVIEW_INTERVALS.length - 1));
  return REVIEW_INTERVALS[idx];
}

/**
 * 解析日期字符串为本地当日 00:00 Date（安全容错）
 * @param {string|null} d
 * @returns {Date|null}
 */
function _parseDay(d) {
  if (!d) return null;
  const t = new Date(d + 'T00:00:00');
  return isNaN(t.getTime()) ? null : t;
}

/**
 * 曲目「有效基准日期」的级联推断：
 * 优先用最近一次实际练习(lastPracticeDate)，否则用达到熟练的日期(completedDate)，
 * 再否则用开始日期(startedDate)，最后兜底为今天（保证从不出现空池/NaN）。
 * @param {Repertoire} piece
 * @returns {Date}
 */
function _effectivePracticeDate(piece) {
  const today = new Date(Utils.today() + 'T00:00:00');
  return (
    _parseDay(piece.lastPracticeDate) ||
    _parseDay(piece.completedDate) ||
    _parseDay(piece.startedDate) ||
    today
  );
}

/**
 * 计算一首曲目的遗忘曲线复习状态
 * score = 距上次练习天数 ÷ 复习间隔；score ≥ 1 即已到期
 * 从未实际完成今日练习的曲目，会用 completedDate / startedDate 级联推断日期，
 * 保证从合手/背谱/熟练阶段起就可以进入复习池。
 * @returns {{interval:number, daysSince:number, score:number, overdue:boolean, label:string, inferredDate:string, inferredFrom:string}}
 */
function computeReviewStatus(piece) {
  const interval = getReviewInterval(piece);
  const today = new Date(Utils.today() + 'T00:00:00');
  let inferredFrom = 'lastPracticeDate';
  if (!piece.lastPracticeDate) {
    if (piece.completedDate) inferredFrom = 'completedDate';
    else if (piece.startedDate) inferredFrom = 'startedDate';
    else inferredFrom = 'today';
  }
  const effDate = _effectivePracticeDate(piece);
  const daysSince = Math.max(0, Math.floor((today - effDate) / 86400000));
  const score = daysSince / interval;
  let label;
  if (inferredFrom !== 'lastPracticeDate') {
    label = '🆕 ' + daysSince + ' 天未练（已纳入复习）';
  } else if (daysSince > interval) {
    label = '🟠 已逾期 ' + (daysSince - interval) + ' 天';
  } else if (daysSince === interval) {
    label = '🟢 该复习';
  } else {
    label = '⚪ ' + (interval - daysSince) + ' 天后复习';
  }
  return {
    interval,
    daysSince,
    score,
    overdue: score >= 1,
    label,
    inferredDate: effDate.toISOString().slice(0, 10),
    inferredFrom
  };
}

/**
 * 构建复习候选池（按遗忘曲线优先级降序）
 * 筛选条件：阶段 ∈ {together(合手), memorize(背谱), proficient(熟练)}
 * 去重：与今日练习表单中其它已经出现的曲目不重复（课程曲目/自由练习曲目/当日已练）
 * 排序：已到期（score ≥ 1）排前，组内按 score 降序（严格符合遗忘曲线，不再加阶段加权）
 * @param {string[]} excludeNames 要排除的曲名列表（当日课程曲目）
 * @param {string[]} [extraExcludeNames] 额外要排除的曲名（自由练习、阶段卡等）
 * @returns {Array<{piece: Repertoire, priority: number, overdue: boolean}>}
 */
function buildReviewCandidates(excludeNames, extraExcludeNames) {
  const rep = DB.repertoire();

  // 排除当日已练（从今日日志中获取）
  const todayLog = DB.logs().find(l => l.date === Utils.today());
  const todayPracticedIds = new Set();
  if (todayLog) {
    todayLog.entries.forEach(e => { if (e.repId) todayPracticedIds.add(e.repId); });
  }

  // 去重池：名字集合（课程曲目 + 额外曲目）
  const excludeNameSet = new Set(excludeNames || []);
  (extraExcludeNames || []).forEach(function(n) { excludeNameSet.add(n); });

  const candidates = [];
  const REVIEWABLE_STAGES = new Set(['together', 'memorize', 'proficient']);

  for (const piece of rep) {
    // 阶段必须在合手/背谱/熟练
    if (!REVIEWABLE_STAGES.has(piece.stage)) continue;
    // 与其它曲目卡不重复（课程曲目 / 自由练习 / 阶段卡）
    if (excludeNameSet.has(piece.name)) continue;
    // 当日已练过的不重复
    if (todayPracticedIds.has(piece.id)) continue;

    const st = computeReviewStatus(piece);
    // 严格按遗忘曲线排序：score 越大优先级越高（越久没练 → 越该复习）
    candidates.push({ piece, priority: st.score, overdue: st.overdue, _reviewStatus: st });
  }

  // 已到期整体排前，组内按 score 降序
  candidates.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return b.priority - a.priority;
  });
  return candidates;
}

/**
 * 收集当前表单里「自由练习」已经添加的曲名（用于复习去重，不与其它曲目卡重复）
 * @returns {string[]}
 */
function _collectFreePieceNames() {
  const names = [];
  const nameEls = document.querySelectorAll('#freeList .free-piece-name');
  nameEls.forEach(function(el) {
    const v = (el.value || el.textContent || '').trim();
    if (v && v !== '自由练习') names.push(v);
  });
  // TodayState 兜底（DOM 尚未渲染时用内存中的）
  for (var idx in (window.TodayState && TodayState.pieces || {})) {
    const p = TodayState.pieces[idx];
    if (!p || !p.pieceName) continue;
    if (!p.category || p.category === 'free') {
      const n = p.pieceName.trim();
      if (n && n !== '自由练习' && names.indexOf(n) === -1) names.push(n);
    }
  }
  return names;
}

/**
 * 生成复习列表（任务 3：游戏化抽卡）
 * @param {Lesson} lesson 当前课程
 * @returns {void}
 */
function generateReviewList(lesson) {
  console.log('[generateReviewList] 生成复习列表', { lesson: !!lesson });
  const reviewList = document.getElementById('reviewList');
  if (!reviewList) {
    console.error('[generateReviewList] reviewList 元素不存在!');
    return;
  }

  // 自动展开复习分类
  var container = document.querySelector('.practice-category[data-cat="review"]');
  var body = document.querySelector('.practice-category-body[data-cat-body="review"]');
  if (container) container.classList.add('open');
  if (body) body.style.display = 'block';

  const lessonNames = (lesson && lesson.pieces) ? lesson.pieces.map(p => p.name) : [];
  const freeNames = _collectFreePieceNames();
  const candidates = buildReviewCandidates(lessonNames, freeNames);
  const countEl = document.getElementById('reviewCount');

  // 不足 4 首提示
  if (candidates.length < 4) {
    if (countEl) countEl.textContent = candidates.length + '首可选';
    if (candidates.length === 0) {
      reviewList.innerHTML =
        '<p class="text-sm text-2 text-center p-8">🎉 暂无可复习曲目</p>' +
        '<div class="text-xs text-3 text-center" style="max-width:360px;margin:0 auto 24px;line-height:1.7">' +
          '可能原因：<br>' +
          '1) 全部曲目今日已练；<br>' +
          '2) 阶段未达「合手 / 背谱 / 熟练」；<br>' +
          '3) 已出现于课堂曲目或自由练习中（复习卡不重复显示）。' +
        '</div>';
      return;
    }
    reviewList.innerHTML =
      '<p class="text-sm text-3 text-center" style="margin-bottom:8px">⚠️ 候选曲目不足 4 首（仅 ' + candidates.length + ' 首可选）</p>';
  } else {
    reviewList.innerHTML = '';
  }

  // 取前 4 首（或全部可选）
  const selected = candidates.slice(0, 4);
  if (countEl) countEl.textContent = selected.length + '首';

  // 存储候选池（跳过时用）
  window._reviewCandidates = candidates;
  window._reviewSelected = selected;
  window._reviewFlippedCount = 0;

  // 渲染翻卡 UI
  renderFlipCards(reviewList, selected);
}

/**
 * 渲染翻卡 UI（背面卡片，点击逐张翻转）
 * @param {HTMLElement} container 容器
 * @param {Array<{piece: Repertoire, priority: number}>} selected 选中的曲目
 * @returns {void}
 */
function renderFlipCards(container, selected) {
  // 保留已有的提示文字（不足 4 首时）
  const existingWarning = container.querySelector('p');
  let html = existingWarning ? existingWarning.outerHTML : '';

  html += '<div class="flip-cards-container" style="display:flex;flex-direction:column;gap:12px;margin-top:8px">';

  selected.forEach((item, i) => {
    const daysLabel = computeReviewStatus(item.piece).label;

    html +=
      '<div class="flip-card" data-flip-idx="' + i + '" id="flipCard' + i + '"' +
           ' style="position:relative;border-radius:12px;overflow:hidden;cursor:pointer;' +
           'border:1px solid var(--border-2);' +
           'background:var(--elevated);transition:all 0.3s var(--ease-out)">' +
        // 背面（未翻转时显示）
        '<div class="flip-card-back" data-back="' + i + '"' +
             ' style="padding:16px;display:flex;align-items:center;justify-content:center;gap:12px"' +
             ' onclick="flipReviewCard(' + i + ')">' +
          '<span style="font-size:1.8rem">🎵</span>' +
          '<div style="text-align:center">' +
            '<div style="font-size:0.9rem;font-weight:700;color:var(--text-1)">点击翻卡 ' + (i + 1) + '/' + selected.length + '</div>' +
            '<div style="font-size:0.7rem;color:var(--text-3);margin-top:2px">' + daysLabel + '</div>' +
          '</div>' +
        '</div>' +
        // 正面（翻转后显示练习卡片）
        '<div class="flip-card-front" data-front="' + i + '" style="display:none"></div>' +
      '</div>';
  });

  // 跳过按钮（仅当有可替换候选时才显示）
  const skipsLeft = 2 - getSkipCount();
  var hasReplacements = window._reviewCandidates && window._reviewSelected &&
    window._reviewCandidates.length > window._reviewSelected.length;
  html += '<div style="text-align:center;margin-top:8px">';
  if (skipsLeft > 0 && hasReplacements) {
    html += '<button class="btn btn-sm btn-secondary" id="btnSkipReview"' +
            ' onclick="skipReviewCard()"' +
            ' style="font-size:0.75rem;padding:6px 16px;opacity:0.7">' +
            '🔀 跳过一张（剩余 ' + skipsLeft + ' 次）</button>';
  } else if (skipsLeft <= 0) {
    html += '<span style="font-size:0.7rem;color:var(--text-4)">今日跳过次数已用完</span>';
  } else {
    html += '<span style="font-size:0.7rem;color:var(--text-4)">没有更多候选曲目了</span>';
  }
  html += '</div>';

  html += '</div>';

  container.innerHTML = html;
}
/* ------------------------------------------
   翻卡交互（全局函数，onclick 调用）
   ------------------------------------------ */

/**
 * 翻转一张复习卡片
 * 总时长约 4 秒：背面消失 2s → 正面曲名展示 2s → 恢复为练习卡片
 * @param {number} idx 卡片索引 (0-3)
 * @returns {void}
 */
window.flipReviewCard = function(idx) {
  var selected = window._reviewSelected;
  if (!selected || !selected[idx]) return;

  var back = document.querySelector('[data-back="' + idx + '"]');
  var front = document.querySelector('[data-front="' + idx + '"]');
  if (!back || !front) return;

  // 已翻转则忽略
  if (back.style.display === 'none') return;

  var item = selected[idx];
  var piece = item.piece;
  var index = 'r' + idx;
  var card = document.getElementById('flipCard' + idx);

  // 初始化 TodayState
  TodayState.initPiece(index, piece.en || piece.name + '（复习）');
  TodayState.pieces[index].category = 'review';
  TodayState.pieces[index].repId = piece.id;
  TodayState.pieces[index].book = piece.book || null;
  TodayState.pieces[index].reviewMem = RepertoireManager.isMemorized(piece);

  // 禁止重复点击
  back.style.pointerEvents = 'none';

  // ── Phase 1: 背面消失（2s） ──
  back.style.animation = 'cardBackOut 2s ease-in-out forwards';

  // ── Phase 2: 背面消失后，显示正面曲名 ──
  setTimeout(function() {
    back.style.display = 'none';
    front.style.display = 'block';
    front.style.animation = 'cardFrontIn 2s ease-out forwards';

    front.innerHTML =
      '<div style="padding:20px;display:flex;align-items:center;justify-content:center;min-height:70px">' +
        '<div class="flip-title-reveal" style="text-align:center">' +
          '<div style="font-size:1.2rem;font-weight:700;color:var(--accent-yellow)">' +
            Utils.escape(piece.en || piece.name) +
          '</div>' +
          '<div style="font-size:0.8rem;color:var(--text-2);margin-top:6px">' + Utils.escape(piece.name) + '</div>' +
        '</div>' +
      '</div>';
  }, 2000);

  // ── Phase 3: 曲名展示完后，恢复为练习卡片 ──
  setTimeout(function() {
    if (card) {
      card.style.animation = '';
      card.style.transform = '';
      card.style.borderColor = 'var(--accent-primary)';
    }
    front.style.animation = '';

    front.innerHTML =
      '<div class="piece-card" data-index="' + index + '" id="piece' + index + '" style="border:none;background:transparent;padding:0;margin:0">' +
        '<div class="piece-card-top" onclick="togglePieceExpand(\'' + index + '\', event)" style="padding:12px 12px 4px 12px">' +
          '<span class="piece-number">' + (idx + 1) + '</span>' +
          '<div class="piece-info" style="flex:1">' +
            '<div class="piece-title" style="font-size:0.9rem;font-weight:700;color:var(--text-1)">' +
              Utils.escape(piece.en || piece.name) +
            '</div>' +
            '<div class="piece-subtitle" style="font-size:0.75rem;color:var(--text-2)">' + Utils.escape(piece.name) + '</div>' +
          '</div>' +
          '<span class="piece-expand-icon">▼</span>' +
        '</div>' +
        '<div class="piece-card-body" style="padding:0 12px 12px 12px">' +
          starRatingHTML(index) +
        '</div>' +
      '</div>';

  }, 4500);

  window._reviewFlippedCount = (window._reviewFlippedCount || 0) + 1;
};/**
 * 跳过一张复习卡片（换一张新的）
 * @returns {void}
 */
window.skipReviewCard = function() {
  const skipsLeft = 2 - getSkipCount();
  if (skipsLeft <= 0) {
    Utils.showToast('今日跳过次数已用完', 'warning');
    return;
  }

  const selected = window._reviewSelected;
  const candidates = window._reviewCandidates;
  if (!selected || !candidates) return;

  // 找一张未翻转的卡片
  var skipIdx = -1;
  for (var i = 0; i < selected.length; i++) {
    var back = document.querySelector('[data-back="' + i + '"]');
    if (back && back.style.display !== 'none') {
      skipIdx = i;
      break;
    }
  }

  if (skipIdx === -1) {
    Utils.showToast('所有卡片已翻开', 'info');
    return;
  }

  // 找候选池中未被选中的下一首
  var selectedIds = new Set(selected.map(function(s) { return s.piece.id; }));
  var replacement = candidates.find(function(c) { return !selectedIds.has(c.piece.id); });

  if (!replacement) {
    Utils.showToast('没有更多候选曲目了', 'info');
    return;
  }

  // 替换
  incrementSkipCount();
  selected[skipIdx] = replacement;

  // 只更新被跳过的卡片，不影响已翻开的卡片
  var card = document.getElementById('flipCard' + skipIdx);
  var back = document.querySelector('[data-back="' + skipIdx + '"]');
  var front = document.querySelector('[data-front="' + skipIdx + '"]');
  if (card && back && front) {
    // 重置卡片到未翻转状态
    card.style.animation = '';
    card.style.transform = '';
    card.style.borderColor = 'var(--border-2)';
    back.style.display = '';
    back.style.animation = '';
    back.style.pointerEvents = '';
    front.style.display = 'none';
    front.style.animation = '';
    front.innerHTML = '';
    // 更新背面文字（新曲目的复习状态）
    var daysLabel = computeReviewStatus(replacement.piece).label;
    var backInner = back.querySelector('div[style*="text-align:center"]');
    if (backInner) {
      backInner.innerHTML =
        '<div style="font-size:0.9rem;font-weight:700;color:var(--text-1)">点击翻卡 ' + (skipIdx + 1) + '/' + selected.length + '</div>' +
        '<div style="font-size:0.7rem;color:var(--text-3);margin-top:2px">' + daysLabel + '</div>';
    }
  }

  // 更新跳过按钮状态
  var skipBtn = document.getElementById('btnSkipReview');
  if (skipBtn) {
    var newSkipsLeft = 2 - getSkipCount();
    var selIds = new Set(selected.map(function(s) { return s.piece.id; }));
    var stillHasReplacements = candidates.some(function(c) { return !selIds.has(c.piece.id); });
    if (newSkipsLeft > 0 && stillHasReplacements) {
      skipBtn.textContent = '🔀 跳过一张（剩余 ' + newSkipsLeft + ' 次）';
    } else {
      var span = document.createElement('span');
      span.style.cssText = 'font-size:0.7rem;color:var(--text-4)';
      span.textContent = newSkipsLeft <= 0 ? '今日跳过次数已用完' : '没有更多候选曲目了';
      skipBtn.parentNode.replaceChild(span, skipBtn);
    }
  }

  Utils.showToast('🔀 已换一张新卡', 'success');
};

/* ------------------------------------------
   绑定事件（练习表单初始化时调用）
   ------------------------------------------ */

/**
 * 绑定 Today 页面的所有事件
 * @param {Lesson} lesson 最新课程
 * @param {Log|null} [existingLog=null] 编辑模式下的原日志
 * @returns {void}
 */
function bindTodayEvents(lesson, existingLog) {
  // 注意：编辑模式下 lesson 为 null，但仍需绑定事件
  console.log('[bindTodayEvents] 开始绑定事件', { lesson: !!lesson, existingLog: !!existingLog });
  window._currentLesson = lesson || null;

  initTotalTimer();

  TodayState.reset();
  if (existingLog) TodayState.existingLog = existingLog;

  // 初始化曲目状态（仅新建模式，编辑模式由 existingLog 填充）
  if (lesson && lesson.pieces) {
    lesson.pieces.forEach(function(piece, i) {
      var repPiece = (piece.repId && RepertoireManager.findById(piece.repId)) || RepertoireManager.findByName(piece.name);
      TodayState.initPiece(i, piece.name, piece.focusAreas, piece.details);
      TodayState.pieces[i].category = piece.category || 'pieces';
      TodayState.pieces[i].repId = piece.repId || (repPiece ? repPiece.id : null);
      TodayState.pieces[i].book = inferBookFromPiece({
        book: piece.book,
        repId: TodayState.pieces[i].repId
      });
      // 背谱/合手由 stage 推导（今日页不再手动设置，仅保留到日志字段）
      if (repPiece) {
        TodayState.pieces[i].memorized = RepertoireManager.isMemorized(repPiece);
        TodayState.pieces[i].handsTogether = true;
      }
    });
  }

  // 时刻③：同步阶段按钮显示（基于曲库 stage）
  if (typeof window.syncStageButtons === 'function') {
    setTimeout(function() { window.syncStageButtons(); }, 50);
  }

  // 编辑模式：预填已有数据
  if (existingLog) {
    TodayState.mood = existingLog.mood || '';
    TodayState.sticker = existingLog.sticker || '';
    existingLog.entries.forEach(function(entry) {
      for (var idx in TodayState.pieces) {
        var piece = TodayState.pieces[idx];
        if (piece.pieceName === entry.pieceName || piece.pieceName.includes(entry.pieceName)) {
          piece.rating = entry.rating || 0;
          piece.durationMin = entry.durationMin || 0;
          if (entry.repId) piece.repId = entry.repId;
          piece.speed = entry.speed || 0;
          // 任务 2：编辑模式下用 entry.book 优先，否则从 entry.repId 反推
          var inferred = inferBookFromPiece({ book: entry.book, repId: entry.repId });
          if (inferred) piece.book = inferred;
          break;
        }
      }
    });
    // UI 预填（延迟执行，等 DOM 渲染完成）
    setTimeout(prefillEditUI, 100);
  }

  // 生成复习列表：编辑模式恢复原记录，否则游戏化抽卡
  if (existingLog) {
    restoreReviewPieces(existingLog);
  } else {
    generateReviewList(lesson);
  }

  // 完成按钮
  var btnComplete = document.getElementById('btnCompletePractice');
  if (btnComplete) {
    btnComplete.addEventListener('click', handleCompletePractice);
  }

  // 自由练习：添加按钮
  var btnAddFree = document.getElementById('btnAddFree');
  if (btnAddFree) btnAddFree.addEventListener('click', function() { addFreePiece(); });

  // 自由练习：实时同步曲名和备注到 TodayState（使用事件委托）
  var freeList = document.getElementById('freeList');
  if (freeList) {
    freeList.addEventListener('input', function(e) {
      var target = e.target;
      var idx = target.dataset.index;
      if (!idx || !TodayState.pieces[idx]) return;
      if (target.classList.contains('free-piece-name')) {
        TodayState.pieces[idx].pieceName = target.value.trim() || '自由练习';
      } else if (target.classList.contains('free-piece-notes')) {
        TodayState.pieces[idx].notes = target.value.trim();
      }
    });
  }

  // 新建模式：默认添加 2 个自由练习
  if (!existingLog) {
    addFreePiece('基本功-左手');
    addFreePiece('基本功-右手');
  }

  // 编辑模式：自由练习预填
  if (existingLog) {
    existingLog.entries.forEach(function(entry) {
      if (entry.category === 'free') {
        addFreePiece(entry.pieceName);
        var lastIdx = 'f' + (freePieceCount - 1);
        if (TodayState.pieces[lastIdx]) {
          TodayState.pieces[lastIdx].rating = entry.rating || 0;
          TodayState.pieces[lastIdx].durationMin = entry.durationMin || 0;
          TodayState.pieces[lastIdx].notes = entry.notes || '';
          // 任务 2：自由练习不归任何册，book 保持 null
        }
      }
    });
    setTimeout(prefillFreeUI, 150);
  }
}

/* ------------------------------------------
   编辑模式预填 UI
   ------------------------------------------ */

function prefillEditUI() {
  var log = TodayState.existingLog;
  if (!log) return;

  var notes = document.getElementById('parentNotes');
  if (notes && log.parentNotes) notes.value = log.parentNotes;

  var totalSecs = (log.totalDurationMin || 0) * 60;
  if (totalSecs === 0 && log.entries) {
    totalSecs = log.entries.reduce((sum, e) => sum + ((e.durationMin || 0) * 60), 0);
  }
  if (totalSecs > 0) setTotalTimerSeconds(totalSecs);

  for (var idx in TodayState.pieces) {
    var piece = TodayState.pieces[idx];
    if (piece.rating > 0) {
  updateStarDisplay(idx);
    }
    if (piece.speed) {
      var speedInput = document.querySelector('.piece-speed[data-index="' + idx + '"]');
      if (speedInput) speedInput.value = piece.speed;
    }
  }
}

function prefillFreeUI() {
  var log = TodayState.existingLog;
  if (!log) return;

  for (var idx in TodayState.pieces) {
    var piece = TodayState.pieces[idx];
    if (!idx.startsWith('f')) continue;
   if (piece.rating > 0) {
  updateStarDisplay(idx);
    }
    var notesEl = document.querySelector('.free-piece-notes[data-index="' + idx + '"]');
    if (notesEl && piece.notes) notesEl.value = piece.notes;
    if (piece.speed) {
      var speedInput = document.querySelector('.piece-speed[data-index="' + idx + '"]');
      if (speedInput) speedInput.value = piece.speed;
    }
  }
}

/* ------------------------------------------
   恢复复习曲目（编辑模式）
   ------------------------------------------ */

function restoreReviewPieces(existingLog) {
  console.log('[restoreReviewPieces] 恢复复习曲目', { existingLog: !!existingLog });
  var reviewList = document.getElementById('reviewList');
  if (!reviewList) {
    console.error('[restoreReviewPieces] reviewList 元素不存在!');
    return;
  }

  // 自动展开复习分类
  var container = document.querySelector('.practice-category[data-cat="review"]');
  var body = document.querySelector('.practice-category-body[data-cat-body="review"]');
  if (container) container.classList.add('open');
  if (body) body.style.display = 'block';

  var reviewEntries = existingLog.entries.filter(function(e) { return e.category === 'review'; });
  var countEl = document.getElementById('reviewCount');
  console.log('[restoreReviewPieces] 复习条目数量:', reviewEntries.length);
  if (countEl) countEl.textContent = reviewEntries.length + '首';

  if (!reviewEntries.length) {
    reviewList.innerHTML = '<p class="text-sm text-2 text-center p-12">暂无可复习曲目</p>';
    return;
  }

  reviewList.innerHTML = reviewEntries.map(function(entry, i) {
    var index = 'r' + i;
    var repPiece = RepertoireManager.findById(entry.repId);
    var pieceEn = repPiece ? repPiece.en : (entry.pieceName || '');
    var pieceName = repPiece ? repPiece.name : '';
    var repId = entry.repId || (repPiece ? repPiece.id : '');

    TodayState.initPiece(index, entry.pieceName || pieceEn || '复习');
    TodayState.pieces[index].category = 'review';
    TodayState.pieces[index].repId = repId;
    TodayState.pieces[index].book = inferBookFromPiece({
      book: entry.book,
      repId: repId
    }) || (repPiece ? repPiece.book : null);
    TodayState.pieces[index].reviewMem = repPiece ? RepertoireManager.isMemorized(repPiece) : false;
    TodayState.pieces[index].rating = entry.rating || 0;
    TodayState.pieces[index].durationMin = entry.durationMin || 0;

    return '<div class="piece-card" data-index="' + index + '" id="piece' + index + '">' +
      '<div class="piece-card-top" onclick="togglePieceExpand(\'' + index + '\', event)">' +
        '<span class="piece-number">' + (i + 1) + '</span>' +
        '<div class="piece-info" style="flex:1">' +
          '<div class="piece-title">' +
            Utils.escape(pieceEn) +
            (pieceName ? '<span style="font-weight:400;color:var(--text-2);font-size:0.8rem"> ' + Utils.escape(pieceName) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<span class="piece-expand-icon">▼</span>' +
      '</div>' +
      '<div class="piece-card-body">' +
        starRatingHTML(index) +
      '</div>' +
    '</div>';
  }).join('');
}

/* ------------------------------------------
   自由练习
   ------------------------------------------ */

function freePieceCardHTML(index, pieceName) {
  pieceName = pieceName || '';
  return '<div class="piece-card" data-index="f' + index + '" id="piecef' + index + '">' +
    '<div class="piece-card-top" onclick="togglePieceExpand(\'f' + index + '\', event)" style="align-items:center">' +
      '<span class="piece-number">' + (index + 1) + '</span>' +
      '<div class="piece-info" style="flex:1">' +
        '<input class="form-input free-piece-name" data-index="f' + index + '"' +
               ' placeholder="输入曲目名称..." value="' + Utils.escape(pieceName) + '"' +
               ' style="padding:6px 10px;font-size:0.85rem;border:none;background:transparent;font-weight:700;color:var(--text-1)">' +
      '</div>' +
      '<button class="btn btn-sm" onclick="event.stopPropagation(); removeFreePiece(\'f' + index + '\')"' +
              ' style="font-size:0.65rem;padding:3px 8px;color:var(--danger);background:transparent">✕</button>' +
      '<span class="piece-expand-icon">▼</span>' +
    '</div>' +
    '<div class="piece-card-body">' +
      starRatingHTML('f' + index) +
      '<div class="form-group" style="margin-top:8px">' +
        '<textarea class="form-input free-piece-notes" data-index="f' + index + '"' +
                  ' placeholder="练习备注..." rows="2"' +
                  ' style="min-height:40px;font-size:0.8rem;padding:8px 10px"></textarea>' +
      '</div>' +
    '</div>' +
  '</div>';
}

window.addFreePiece = function(name) {
  console.log('[addFreePiece] 添加自由练习曲目', { name: name, freePieceCount: freePieceCount });
  var freeList = document.getElementById('freeList');
  if (!freeList) {
    console.error('[addFreePiece] freeList 元素不存在!');
    return;
  }

  var placeholder = freeList.querySelector('p');
  if (placeholder) placeholder.remove();

  var card = document.createElement('div');
  card.innerHTML = freePieceCardHTML(freePieceCount, name || '');
  var cardEl = card.firstElementChild;
  freeList.appendChild(cardEl);

  // 自动展开自由练习分类
  var container = document.querySelector('.practice-category[data-cat="free"]');
  var body = document.querySelector('.practice-category-body[data-cat-body="free"]');
  if (container) container.classList.add('open');
  if (body) body.style.display = 'block';

  TodayState.initPiece('f' + freePieceCount, name || '');
  TodayState.pieces['f' + freePieceCount].category = 'free';
  TodayState.pieces['f' + freePieceCount].repId = '';
  // 任务 2：自由练习不归任何册，book 保持 null（state.js initPiece 默认值）

  freePieceCount++;
  var countEl = document.getElementById('freeCount');
  if (countEl) countEl.textContent = freePieceCount + '首';

  // 加了自由练习曲后，重新抽复习卡（保证复习卡不与自由练习曲目重复）
  var ls = window._currentLesson || null;
  var existingLog = TodayState.existingLog;
  if (!existingLog && document.getElementById('reviewList')) {
    generateReviewList(ls);
  }
};

window.removeFreePiece = function(index) {
  var card = document.getElementById('piece' + index);
  if (!card) return;
  card.remove();

  if (TodayState.pieces[index]) {
    delete TodayState.pieces[index];
  }

  freePieceCount = Math.max(0, freePieceCount - 1);
  var countEl = document.getElementById('freeCount');
  if (countEl) countEl.textContent = freePieceCount + '首';

  var freeList = document.getElementById('freeList');
  if (freeList && freeList.children.length === 0) {
    freeList.innerHTML = '<p class="text-xs text-3 text-center p-12">点击下方按钮添加练习曲目</p>';
  }

  // 移除自由练习后，也重新抽复习卡（释放被去重的候选曲目）
  var ls = window._currentLesson || null;
  var existingLog = TodayState.existingLog;
  if (!existingLog && document.getElementById('reviewList')) {
    generateReviewList(ls);
  }
};

console.log('✅ Review-Free module loaded');