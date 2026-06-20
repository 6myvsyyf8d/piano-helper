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
    const m = piece.repId.match(/^s(\d+)-/);
    if (m) return parseInt(m[1]);
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

/**
 * 判断曲目是否为金卡（最近 7 天最后一次评分 ≥ 4 星）
 * @param {string} repId 曲库 ID
 * @returns {boolean}
 */
function isGoldCard(repId) {
  if (!repId) return false;
  const logs = DB.logs();
  const today = new Date(Utils.today() + 'T00:00:00');
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  let lastRating = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    const logDate = new Date(logs[i].date + 'T00:00:00');
    if (logDate < sevenDaysAgo) break;
    for (const entry of logs[i].entries) {
      if (entry.repId === repId && entry.rating > 0) {
        lastRating = entry.rating;
      }
    }
  }
  return lastRating >= 4;
}

/**
 * 构建复习候选池（按优先级降序）
 * priority = (memorized===false ? +50 : 0) + daysSinceLastPractice
 * @param {string[]} excludeNames 要排除的曲名列表（当日课程曲目）
 * @returns {Array<{piece: Repertoire, priority: number, gold: boolean}>}
 */
function buildReviewCandidates(excludeNames) {
  const today = new Date(Utils.today() + 'T00:00:00');
  const rep = DB.repertoire();

  // 排除当日已练（从今日日志中获取）
  const todayLog = DB.logs().find(l => l.date === Utils.today());
  const todayPracticedIds = new Set();
  if (todayLog) {
    todayLog.entries.forEach(e => { if (e.repId) todayPracticedIds.add(e.repId); });
  }

  const candidates = [];

  for (const piece of rep) {
    // 必须是已学会
    if (piece.status !== 'learned') continue;
    // 排除当日课程曲目
    if (excludeNames.includes(piece.name)) continue;
    // 排除当日已练
    if (todayPracticedIds.has(piece.id)) continue;

    // 计算距上次练习天数
    let daysSince = 999;
    if (piece.lastPracticeDate) {
      const lastDate = new Date(piece.lastPracticeDate + 'T00:00:00');
      daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    }

    const priority = (piece.memorized === false ? 50 : 0) + daysSince;
    const gold = isGoldCard(piece.id);

    candidates.push({ piece, priority, gold });
  }

  // 按 priority 降序
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates;
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
  const candidates = buildReviewCandidates(lessonNames);
  const countEl = document.getElementById('reviewCount');

  // 不足 4 首提示
  if (candidates.length < 4) {
    if (countEl) countEl.textContent = candidates.length + '首可选';
    if (candidates.length === 0) {
      reviewList.innerHTML = '<p class="text-sm text-2 text-center p-12">🎉 暂无可复习曲目（全部曲目今日已练或未学会）</p>';
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
 * @param {Array<{piece: Repertoire, priority: number, gold: boolean}>} selected 选中的曲目
 * @returns {void}
 */
function renderFlipCards(container, selected) {
  // 保留已有的提示文字（不足 4 首时）
  const existingWarning = container.querySelector('p');
  let html = existingWarning ? existingWarning.outerHTML : '';

  html += '<div class="flip-cards-container" style="display:flex;flex-direction:column;gap:12px;margin-top:8px">';

  selected.forEach((item, i) => {
    const goldClass = item.gold ? ' gold-card' : '';
    const goldBadge = item.gold ? '<span style="position:absolute;top:6px;right:8px;font-size:1.1rem">🌟</span>' : '';
    const daysSince = item.piece.lastPracticeDate
      ? Math.floor((new Date(Utils.today() + 'T00:00:00') - new Date(item.piece.lastPracticeDate + 'T00:00:00')) / 86400000)
      : 999;
    const daysLabel = daysSince >= 999 ? '从未练习' : daysSince + '天未练';

    html +=
      '<div class="flip-card' + goldClass + '" data-flip-idx="' + i + '" id="flipCard' + i + '"' +
           ' style="position:relative;border-radius:12px;overflow:hidden;cursor:pointer;' +
           'border:1px solid ' + (item.gold ? 'var(--accent-yellow)' : 'var(--border-2)') + ';' +
           'background:var(--elevated);transition:all 0.3s var(--ease-out)">' +
        // 背面（未翻转时显示）
        '<div class="flip-card-back" data-back="' + i + '"' +
             ' style="padding:16px;display:flex;align-items:center;justify-content:center;gap:12px"' +
             ' onclick="flipReviewCard(' + i + ')">' +
          goldBadge +
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

  // 跳过按钮
  const skipsLeft = 2 - getSkipCount();
  html += '<div style="text-align:center;margin-top:8px">';
  if (skipsLeft > 0) {
    html += '<button class="btn btn-sm btn-secondary" id="btnSkipReview"' +
            ' onclick="skipReviewCard()"' +
            ' style="font-size:0.75rem;padding:6px 16px;opacity:0.7">' +
            '🔀 跳过一张（剩余 ' + skipsLeft + ' 次）</button>';
  } else {
    html += '<span style="font-size:0.7rem;color:var(--text-4)">今日跳过次数已用完</span>';
  }
  html += '</div>';

  html += '</div>';

  container.innerHTML = html;
}
/* ------------------------------------------
   翻卡交互（全局函数，onclick 调用）
   ------------------------------------------ */

/**
 * 翻转一张复习卡片（金色光芒特效，文字不镜像）
 * 总时长约 4 秒：背面消失 2s → 正面曲名发光 2s → 恢复为练习卡片 2.5s 后
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
  TodayState.pieces[index].reviewMem = piece.memorized;

  // 禁止重复点击
  back.style.pointerEvents = 'none';

  // ── Phase 1: 背面消失（2s，带金色光芒） ──
  if (card) card.classList.add('flip-card-glowing');
  back.style.animation = 'cardBackOut 2s ease-in-out forwards';

  // ── Phase 2: 背面消失后，显示正面曲名（金色发光由小变大） ──
  setTimeout(function() {
    back.style.display = 'none';
    front.style.display = 'block';
    front.style.animation = 'cardFrontIn 2s ease-out forwards';

    var goldBadge = item.gold ? ' <span style="font-size:0.8rem">🌟</span>' : '';
    front.innerHTML =
      '<div style="padding:20px;display:flex;align-items:center;justify-content:center;min-height:70px">' +
        '<div class="flip-title-reveal" style="text-align:center">' +
          '<div style="font-size:1.2rem;font-weight:700;color:var(--accent-yellow)">' +
            Utils.escape(piece.en || piece.name) + goldBadge +
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
      card.classList.remove('flip-card-glowing');
      card.classList.add('flip-card-settled');
      card.style.borderColor = item.gold ? 'var(--accent-yellow)' : 'var(--accent-primary)';
    }
    front.style.animation = '';

    var goldBadge = item.gold ? ' <span style="font-size:0.8rem">🌟</span>' : '';
    front.innerHTML =
      '<div class="piece-card" data-index="' + index + '" id="piece' + index + '" style="border:none;background:transparent;padding:0;margin:0">' +
        '<div class="piece-card-top" onclick="togglePieceExpand(\'' + index + '\', event)" style="padding:12px 12px 4px 12px">' +
          '<span class="piece-number">' + (idx + 1) + '</span>' +
          '<div class="piece-info" style="flex:1">' +
            '<div class="piece-title" style="font-size:0.9rem;font-weight:700;color:var(--text-1)">' +
              Utils.escape(piece.en || piece.name) + goldBadge +
            '</div>' +
            '<div class="piece-subtitle" style="font-size:0.75rem;color:var(--text-2)">' + Utils.escape(piece.name) + '</div>' +
          '</div>' +
          '<span class="piece-expand-icon">▼</span>' +
        '</div>' +
        '<div class="piece-card-body" style="padding:0 12px 12px 12px">' +
          starRatingHTML(index) +
          '<div class="piece-extra-row" style="margin-top:8px">' +
            '<button class="btn btn-sm ' + (piece.memorized ? 'btn-primary' : 'btn-secondary') + ' piece-mem-btn"' +
                    ' data-index="' + index + '"' +
                    ' onclick="toggleReviewMemorized(\'' + index + '\', \'' + piece.id + '\')"' +
                    ' style="font-size:0.7rem;padding:5px 10px">' +
              (piece.memorized ? '🧠 背谱' : '📖 看谱') +
            '</button>' +
          '</div>' +
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

  // 重新渲染整个翻卡区
  var reviewList = document.getElementById('reviewList');
  if (reviewList) renderFlipCards(reviewList, selected);

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

  initTotalTimer();

  TodayState.reset();
  if (existingLog) TodayState.existingLog = existingLog;

  // 初始化曲目状态（仅新建模式，编辑模式由 existingLog 填充）
  if (lesson && lesson.pieces) {
    lesson.pieces.forEach(function(piece, i) {
      var repPiece = RepertoireManager.findByName(piece.name);
      TodayState.initPiece(i, piece.name);
      TodayState.pieces[i].category = piece.category || 'pieces';
      TodayState.pieces[i].repId = piece.repId || (repPiece ? repPiece.id : null);
      TodayState.pieces[i].book = inferBookFromPiece({
        book: piece.book,
        repId: TodayState.pieces[i].repId
      });
    });
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
          piece.memorized = !!entry.memorized;
          piece.handsTogether = entry.handsTogether !== false;
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
    if (piece.memorized) {
      var memBtn = document.querySelector('.piece-mem-btn[data-index="' + idx + '"]');
      if (memBtn) {
        memBtn.textContent = '🧠 背谱';
        memBtn.style.color = 'var(--accent-primary)';
        memBtn.style.borderColor = 'rgba(245,160,152,0.3)';
        memBtn.style.background = 'rgba(245,160,152,0.15)';
      }
    }
    if (piece.handsTogether === false) {
      var handBtn = document.querySelector('.piece-hand-btn[data-index="' + idx + '"]');
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
    if (piece.memorized) {
      var memBtn = document.querySelector('.piece-mem-btn[data-index="' + idx + '"]');
      if (memBtn) {
        memBtn.textContent = '🧠 背谱';
        memBtn.style.color = 'var(--accent-primary)';
        memBtn.style.borderColor = 'rgba(245,160,152,0.3)';
        memBtn.style.background = 'rgba(245,160,152,0.15)';
      }
    }
    if (piece.handsTogether === false) {
      var handBtn = document.querySelector('.piece-hand-btn[data-index="' + idx + '"]');
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
    var memorized = repPiece ? repPiece.memorized : false;
    var repId = entry.repId || (repPiece ? repPiece.id : '');

    TodayState.initPiece(index, entry.pieceName || pieceEn || '复习');
    TodayState.pieces[index].category = 'review';
    TodayState.pieces[index].repId = repId;
    TodayState.pieces[index].book = inferBookFromPiece({
      book: entry.book,
      repId: repId
    }) || (repPiece ? repPiece.book : null);
    TodayState.pieces[index].reviewMem = memorized;
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
};

console.log('✅ Review-Free module loaded');