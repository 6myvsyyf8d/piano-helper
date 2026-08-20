/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   🏠 今日练琴 - 交互函数 + 提交逻辑
   ========================================== */
"use strict";

/* ------------------------------------------
   交互函数（全局，HTML onclick 调用）
   ------------------------------------------ */

/**
 * 折叠/展开练习分类
 * @param {string} cat 分类标识
 * @returns {void}
 */
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

/**
 * 展开/收起曲目详情
 * @param {string} index 曲目索引
 * @returns {void}
 */
window.togglePieceExpand = function(index, event) {
  if (event) {
    var target = event.target;
    if (target.closest('.star-rating, .form-input, .form-textarea, button, .duration-display, input, textarea, select')) {
      return;
    }
  }
  var card = document.getElementById('piece' + index);
  if (card) {
    card.classList.toggle('expanded');
  }
};



 /**
 * 设置星星评分（支持半星，0.5 步长）
 * 每颗星三次点击循环：N-0.5 → N → N-1 → N-0.5 ...
 * 例如点击第2颗星：1星 → 1.5星 → 2星 → 1星
 * @param {string} index 曲目索引
 * @param {number} star 星星数（0.5, 1, 1.5, 2, ... 5）
 * @returns {void}
 */
window.setStarRating = function(index, star) {
  TodayState.initPiece(index, '');
  const current = TodayState.pieces[index].rating;
  const clickedStar = star; // 用户点击的值（N-0.5 或 N）
  let newRating;

  // 判断点击的是半星(N-0.5)还是整星(N)
  if (clickedStar % 1 === 0.5) {
    // 点击半星区域
    const wholeStar = Math.floor(clickedStar); // 对应的整星
    if (current < clickedStar) {
      // 当前评分 < 半星 → 设为半星
      newRating = clickedStar;
    } else if (current === clickedStar) {
      // 当前 = 半星 → 设为整星
      newRating = wholeStar + 1;
    } else if (current === wholeStar + 1) {
      // 当前 = 整星 → 设为整星-1
      newRating = wholeStar;
    } else {
      // 其他情况 → 设为半星
      newRating = clickedStar;
    }
  } else {
    // 点击整星区域（N）
    if (current < clickedStar) {
      newRating = clickedStar;
    } else if (current === clickedStar) {
      newRating = clickedStar - 0.5;
    } else if (current === clickedStar - 0.5) {
      newRating = clickedStar - 1;
    } else {
      newRating = clickedStar;
    }
  }

  // 确保评分在有效范围内（0.5 到 5）
  if (newRating < 0.5) newRating = 0;
  if (newRating > 5) newRating = 5;

  TodayState.pieces[index].rating = newRating;
  updateStarDisplay(index);

  var starEl = document.querySelector('.star-rating[data-index="' + index + '"]');

  // 时刻「每完成一首后」：首次评分（0 → >0），完成一首曲目，给正向反馈
  if (current === 0 && newRating > 0 && typeof window.showPieceComplete === 'function') {
    var p = TodayState.pieces[index];
    var card = document.getElementById('piece' + index);
    var name = (card && card.dataset.pieceName) || (p && p.pieceName) || '';
    window.showPieceComplete(name, starEl);
  }

  // 时刻②：打星评分（已有评分基础上提高且为整星），触发星星飘散微动画
  if (current > 0 && newRating > current && newRating % 1 === 0 && typeof burstStars === 'function') {
    if (starEl) burstStars(starEl);
  }
};

/**
 * 更新星星评分的 DOM 显示
 * @param {string} index 曲目索引
 * @returns {void}
 */
function updateStarDisplay(index) {
  const container = document.querySelector('.star-rating[data-index="' + index + '"]');
  if (!container) return;
  const rating = TodayState.pieces[index] ? TodayState.pieces[index].rating : 0;
  container.querySelectorAll('.star-unit').forEach(function(unit) {
    var starNum = parseFloat(unit.dataset.star);
    unit.classList.remove('full', 'half');
    if (rating >= starNum) {
      unit.classList.add('full');
    } else if (rating >= starNum - 0.5) {
      unit.classList.add('half');
    }
  });
}

/**
 * 练习速度变化（输入框 oninput）
 * @param {string} index 曲目索引
 * @param {string|number} val 速度值（BPM）
 * @returns {void}
 */
window.onPieceSpeedChange = function(index, val) {
  TodayState.initPiece(index, '');
  TodayState.pieces[index].speed = parseInt(val) || 0;
};

/* ------------------------------------------
   完成练习 / 编辑日志
   ------------------------------------------ */

/**
 * 完成今日练习（提交按钮回调）
 * 收集所有曲目状态 → 构建 Log → 写入 DB → 更新曲库 → 重新渲染
 * @returns {Promise<void>}
 */
async function handleCompletePractice() {
  const totalTimerMin = getTotalTimerMinutes();
  const isEdit = !!TodayState.existingLog;

  // 收集自由练习曲目的名称和备注（来自 DOM 输入）
  document.querySelectorAll('.free-piece-name').forEach(input => {
    const idx = input.dataset.index;
    if (TodayState.pieces[idx]) {
      TodayState.pieces[idx].pieceName = input.value.trim() || '自由练习';
    }
  });

  document.querySelectorAll('.free-piece-notes').forEach(textarea => {
    const idx = textarea.dataset.index;
    if (TodayState.pieces[idx]) {
      TodayState.pieces[idx].notes = textarea.value.trim();
    }
  });

  // 只有「真正练过」（有评分或时长）的曲目才进入日志，避免 0 星 0 分钟的空条目污染统计
  const practiced = Object.entries(TodayState.pieces)
    .filter(([, p]) => p.rating > 0 || p.durationMin > 0)
    .map(([index, p]) => Object.assign({ index: index }, p));

  if (practiced.length === 0 && totalTimerMin === 0) {
    Utils.showToast('⚠️ 请至少完成一项练习', 'warning');
    return;
  }

  // 构建日志条目（每首曲目时长来自家长的分配结果，不再平均伪造）
  function buildEntries(minutesByIndex) {
    return practiced.map(p => ({
      pieceName: p.pieceName || '',
      category: p.category || 'pieces',
      book: p.book || null,
      durationMin: (minutesByIndex && minutesByIndex[p.index]) || 0,
      notes: p.notes || '',
      focusAreas: p.focusAreas || [],
      details: p.details || '',
      rating: p.rating || 0,
      repId: p.repId || '',
      speed: p.speed || 0,
      memorized: !!p.memorized,
      handsTogether: p.handsTogether !== false
    }));
  }

  if (practiced.length === 0) {
    // 只计时、未对任何曲目评分：保存一条“仅总时长”的日志
    submitPracticeLog([], totalTimerMin, isEdit);
    return;
  }

  // 弹窗：为每首曲目分配练习时长（预填均分，家长可调整）
  showDurationSplitDialog(practiced, totalTimerMin, function(minutesByIndex) {
    submitPracticeLog(buildEntries(minutesByIndex), totalTimerMin, isEdit);
  });
}

/**
 * 弹窗：分配每首曲目的练习时长
 * @param {Array} pieces 已练曲目（含 index 字段）
 * @param {number} totalMin 总计时分钟
 * @param {Function} onConfirm (minutesByIndex: Object<string, number>) => void
 */
function showDurationSplitDialog(pieces, totalMin, onConfirm) {
  const n = pieces.length;
  const base = Math.floor(totalMin / n);
  const remainder = totalMin % n;

  const rows = pieces.map((p, i) => {
    const splitDefault = i < remainder ? base + 1 : base;
    const defaultMin = (p.durationMin > 0) ? p.durationMin : splitDefault;
    const name = p.pieceName || '未命名';
    return (
      '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-2)">' +
        '<div style="flex:1;min-width:0;font-size:0.85rem;color:var(--text-1)">' +
          Utils.escape(name) +
          (p.rating ? ' <span style="color:var(--accent-yellow);font-size:0.75rem">' + p.rating + '⭐</span>' : '') +
        '</div>' +
        '<input type="number" class="split-min-input" data-index="' + p.index + '" value="' + defaultMin + '" min="0" max="999" inputmode="numeric" style="width:64px;padding:6px 8px;text-align:center;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-1);color:var(--text-1);font-size:0.85rem">' +
        '<span style="font-size:0.72rem;color:var(--text-3)">分钟</span>' +
      '</div>'
    );
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'durationSplitOverlay';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:14px';
  overlay.innerHTML =
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-header"><h2 class="modal-title">⏱ 分配练习时长</h2><button class="modal-close" onclick="window._closeDurationSplit()">✕</button></div>' +
      '<div class="modal-body">' +
        '<p class="text-xs text-2" style="margin-bottom:12px;line-height:1.5">本次总时长 <strong>' + totalMin + '</strong> 分钟。请确认或调整每首曲目的实际练习时长（影响曲目累计时长与排名）。</p>' +
        rows +
        '<div style="margin-top:10px;font-size:0.75rem;color:var(--text-3);text-align:right">合计：<span id="splitTotal" style="font-weight:700;color:var(--text-1)">' + totalMin + '</span> 分钟</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-primary" id="btnDurationSplitOk" style="width:100%">✅ 保存练习</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  window._closeDurationSplit = function() { overlay.remove(); };

  const inputs = overlay.querySelectorAll('.split-min-input');
  function updateTotal() {
    let sum = 0;
    inputs.forEach(function(x) { sum += (parseInt(x.value, 10) || 0); });
    const el = document.getElementById('splitTotal');
    if (el) el.textContent = sum;
  }
  inputs.forEach(function(inp) { inp.addEventListener('input', updateTotal); });

  document.getElementById('btnDurationSplitOk').addEventListener('click', function() {
    const minutesByIndex = {};
    inputs.forEach(function(inp) { minutesByIndex[inp.getAttribute('data-index')] = parseInt(inp.value, 10) || 0; });
    overlay.remove();
    onConfirm(minutesByIndex);
  });
}

/**
 * 写入练习日志 + 更新曲库 + 检测新纪录 + 刷新页面
 * @param {Array} entries
 * @param {number} totalMin
 * @param {boolean} isEdit
 */
function submitPracticeLog(entries, totalMin, isEdit) {
  const parentNotes = document.getElementById('parentNotes');
  const notesVal = parentNotes ? parentNotes.value.trim() : '';

  const todayStr = Utils.today();
  const log = {
    id: TodayState.existingLog ? TodayState.existingLog.id : Utils.uid(),
    date: todayStr,
    entries: entries,
    totalDurationMin: totalMin,
    parentNotes: notesVal,
    mood: TodayState.mood || '',
    sticker: TodayState.sticker || ''
  };

  const logs = DB.logs().filter(l => l.date !== todayStr);
  logs.push(log);
  DB.saveLogs(logs);

  entries.forEach(e => {
    if (e.repId) {
      RepertoireManager.recordPractice(e.repId, e.durationMin || 0);
      // 背谱/合手不再手动覆盖曲库（由 stage 推导），避免与曲库阶段冲突
    }
  });

  // 检测新纪录
  const newRecords = [];
  const allLogs = DB.logs();
  const todayStars = entries.reduce((sum, e) => sum + (e.rating || 0), 0);

  let maxStars = 0;
  let maxDuration = 0;
  for (const l of allLogs) {
    if (l.date === todayStr) continue;
    const prevStars = (l.entries || []).reduce((sum, e) => sum + (e.rating || 0), 0);
    if (prevStars > maxStars) maxStars = prevStars;
    const prevDuration = l.totalDurationMin || 0;
    if (prevDuration > maxDuration) maxDuration = prevDuration;
  }

  if (todayStars > maxStars) {
    newRecords.push({ type: 'stars', value: todayStars, oldValue: maxStars });
  }
  if (totalMin > maxDuration) {
    newRecords.push({ type: 'duration', value: totalMin, oldValue: maxDuration });
  }

  // 显示新纪录徽章
  if (newRecords.length > 0 && !isEdit) {
    const badgeHTML = newRecords.map(r => {
      if (r.type === 'stars') {
        return `<div style="background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:10px;animation:badgePop 0.5s ease">
          <span style="font-size:1.8rem">🏆</span>
          <div>
            <div style="font-weight:700;color:#333;font-size:0.9rem">🎉 新纪录！</div>
            <div style="color:#666;font-size:0.75rem">单日星星：${r.value} ⭐ (原纪录 ${r.oldValue} ⭐)</div>
          </div>
        </div>`;
      } else {
        return `<div style="background:linear-gradient(135deg,#4CAF50,#2E7D32);border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:10px;animation:badgePop 0.5s ease">
          <span style="font-size:1.8rem">⏱️</span>
          <div>
            <div style="font-weight:700;color:#fff;font-size:0.9rem">🎉 新纪录！</div>
            <div style="color:rgba(255,255,255,0.85);font-size:0.75rem">单日时长：${r.value} 分钟 (原纪录 ${r.oldValue} 分钟)</div>
          </div>
        </div>`;
      }
    }).join('');

    const style = document.createElement('style');
    style.textContent = '@keyframes badgePop{0%{transform:scale(0.5);opacity:0}100%{transform:scale(1);opacity:1}}';
    document.head.appendChild(style);

    Utils.showToast(
      `<div style="text-align:center">${badgeHTML}</div>`,
      'success',
      5000
    );
  } else {
    Utils.showToast(isEdit ? '✅ 修改已保存' : '🎉 练习记录已保存！', 'success');
  }

  // 重新渲染今日页
  TodayState.reset();
  renderTodayPage();
}

console.log('✅ Submit module loaded');