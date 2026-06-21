/*
 * 哆哩的钢琴助手 — Piano Helper
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

/**
 * 切换背谱/看谱状态
 * @param {string} index 曲目索引
 * @param {HTMLElement} btn 按钮 DOM
 * @returns {void}
 */
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

/**
 * 切换合手/分手状态
 * @param {string} index 曲目索引
 * @param {HTMLElement} btn 按钮 DOM
 * @returns {void}
 */
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

/**
 * 切换复习曲目背谱状态（同步到曲库）
 * @param {string} index 曲目索引（如 "r0"）
 * @param {string} repId 曲库 ID
 * @returns {void}
 */
window.toggleReviewMemorized = function(index, repId) {
  if (!TodayState.pieces[index]) return;
  TodayState.pieces[index].reviewMem = !TodayState.pieces[index].reviewMem;
  RepertoireManager.toggleMemorized(repId);
  const btn = event.target;
  if (TodayState.pieces[index].reviewMem) {
    btn.textContent = '🧠 背谱';
    btn.className = 'btn btn-sm btn-primary';
  } else {
    btn.textContent = '📖 看谱';
    btn.className = 'btn btn-sm btn-secondary';
  }
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
  const completed = TodayState.getCompleted();
  const totalTimerMin = getTotalTimerMinutes();

  if (completed.length === 0 && totalTimerMin === 0) {
    Utils.showToast('⚠️ 请至少完成一项练习', 'warning');
    return;
  }

  const isEdit = !!TodayState.existingLog;
  const confirmMsg = isEdit
    ? '确认保存修改？\n\n已完成 ' + completed.length + ' 首曲目\n总时长 ' + totalTimerMin + ' 分钟'
    : '确认提交今日练习？\n\n已完成 ' + completed.length + ' 首曲目\n总时长 ' + totalTimerMin + ' 分钟';

  if (!confirm(confirmMsg)) return;

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

  const totalDurationMin = getTotalTimerMinutes();
  const completedCount = completed.length || 1;
  const perPieceDuration = Math.ceil(totalDurationMin / completedCount);

  const entries = Object.values(TodayState.pieces).map(piece => ({
    pieceName: piece.pieceName,
    category: piece.category,
    book: piece.book || null,
    durationMin: piece.rating > 0 ? perPieceDuration : 0,
    notes: piece.notes || '',
    focusAreas: piece.focusAreas || [],
    details: piece.details || '',
    rating: piece.rating || 0,
    repId: piece.repId || '',
    speed: piece.speed || 0,
    memorized: !!piece.memorized,
    handsTogether: piece.handsTogether !== false
  }));

  const totalMin = totalDurationMin;

  // 家长笔记
  const parentNotes = document.getElementById('parentNotes');
  const notesVal = parentNotes ? parentNotes.value.trim() : '';

  // 构建日志对象
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

  // 写入 DB
  const logs = DB.logs().filter(l => l.date !== todayStr);
  logs.push(log);
  DB.saveLogs(logs);

  // 更新曲库练习记录
  entries.forEach(e => {
    if (e.repId) {
      RepertoireManager.recordPractice(e.repId, e.durationMin || 0);
    }
    if (e.memorized !== undefined && e.repId) {
      RepertoireManager.setMemorized(e.repId, e.memorized);
    }
    if (e.handsTogether !== undefined && e.repId) {
      RepertoireManager.setHandsTogether(e.repId, e.handsTogether);
    }
  });

  // 检测新纪录（使用新变量名避免冲突）
  const newRecords = [];
  const allLogs = DB.logs();

  // 计算今日星星数
  const todayStars = entries.reduce((sum, e) => sum + (e.rating || 0), 0);

  // 获取历史最高记录（排除今日）
  let maxStars = 0;
  let maxDuration = 0;
  for (const l of allLogs) {
    if (l.date === todayStr) continue;
    const prevStars = (l.entries || []).reduce((sum, e) => sum + (e.rating || 0), 0);
    if (prevStars > maxStars) maxStars = prevStars;
    const prevDuration = l.totalDurationMin || 0;
    if (prevDuration > maxDuration) maxDuration = prevDuration;
  }

  // 检测今日是否打破记录
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

    // 添加徽章动画样式
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