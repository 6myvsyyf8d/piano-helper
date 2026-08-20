/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   ⭐ 鼓励体系 - 星星阶梯母题（四个关键时刻共用）
   ========================================== */
"use strict";

/* ------------------------------------------
   星星阶梯渲染：5 级阶段 → 一排星，点亮到当前步
   ------------------------------------------ */

/**
 * 生成 5 级星星阶梯 HTML
 * @param {string} stageKey 当前阶段 key
 * @param {number} lightCount 点亮颗数（0-5），默认按 stageKey 推导
 * @returns {string}
 */
function stageLadderHTML(stageKey, lightCount) {
  var idx = PIECE_STAGES.findIndex(function(s) { return s.key === stageKey; });
  var lit = (typeof lightCount === 'number') ? lightCount : (idx < 0 ? 0 : idx);
  var html = '<span class="star-ladder">';
  for (var i = 0; i < 5; i++) {
    html += '<span class="star-ladder-star ' + (i < lit ? 'lit' : '') + '">' +
      (i < lit ? '⭐' : '☆') + '</span>';
  }
  html += '</span>';
  return html;
}

/* ------------------------------------------
   时刻②：星星飘散（打星评分后）
   ------------------------------------------ */

/**
 * 在锚点元素上方蹦出几颗小星星
 * @param {Element} anchor 锚点元素
 * @returns {void}
 */
function burstStars(anchor) {
  if (!anchor) return;
  var rect = anchor.getBoundingClientRect();
  for (var i = 0; i < 3; i++) {
    var star = document.createElement('span');
    star.textContent = '⭐';
    star.className = 'celebrate-burst-star';
    star.style.left = (rect.left + rect.width / 2 - 10 + (i - 1) * 18) + 'px';
    star.style.top = (rect.top - 8) + 'px';
    star.style.animationDelay = (i * 60) + 'ms';
    document.body.appendChild(star);
    setTimeout(function(el) { return function() { el.remove(); }; }(star), 5200);
  }
}

/* ------------------------------------------
   时刻：每完成一首后 - 即时正向反馈
   ------------------------------------------ */

/**
 * 完成一首曲目后的正向反馈：星星飘散 + 鼓励 toast
 * @param {string} pieceName 曲目名称
 * @param {Element} anchor 锚点元素（星星评分区）
 * @returns {void}
 */
window.showPieceComplete = function(pieceName, anchor) {
  if (anchor) burstStars(anchor);
  var name = pieceName || '这首曲子';
  Utils.showToast('🎉 完成「' + name + '」！继续加油 ⭐', 'success');
};

/* ------------------------------------------
   时刻③：阶段升级 - 全屏庆祝
   ------------------------------------------ */

/**
 * 全屏庆祝：阶段升级
 * @param {string} fromKey 原阶段 key
 * @param {string} toKey   新阶段 key
 * @returns {void}
 */
window.showStageUpCelebration = function(fromKey, toKey) {
  var from = PIECE_STAGES.find(function(s) { return s.key === fromKey; }) || PIECE_STAGES[0];
  var to = PIECE_STAGES.find(function(s) { return s.key === toKey; });
  if (!to) return;

  var litCount = PIECE_STAGES.findIndex(function(s) { return s.key === toKey; }) + 1;
  var overlay = document.createElement('div');
  overlay.className = 'celebrate-stage-overlay';
  overlay.innerHTML =
    '<div class="celebrate-stage-card">' +
      '<div class="celebrate-stage-emoji">' +
        '<span>' + from.icon + '</span>' +
        '<span class="celebrate-stage-arrow">→</span>' +
        '<span class="celebrate-stage-new">' + to.icon + '</span>' +
      '</div>' +
      '<div class="celebrate-stage-title">' + from.label + ' → ' + to.label + '</div>' +
      stageLadderHTML(toKey, litCount) +
      '<div class="celebrate-stage-sub">' + (toKey === 'proficient' ? '太棒了，已经能熟练演奏！' : '又进步了一级，继续加油！') + '</div>' +
      '<button class="btn btn-primary celebrate-stage-btn" onclick="this.closest(\'.celebrate-stage-overlay\').remove()">🎉 太棒了</button>' +
    '</div>';
  document.body.appendChild(overlay);

  // 星星阶梯逐颗点亮
  var stars = overlay.querySelectorAll('.star-ladder-star');
  stars.forEach(function(s, i) {
    s.style.animationDelay = (200 + i * 80) + 'ms';
  });
};

/**
 * 同步今日页所有阶段按钮的显示（根据当前曲目 stage）
 * 首次进卡：若曲目仍是「未学」，自动推进为「分手」（进卡即开始学）
 * @returns {void}
 */
window.syncStageButtons = function() {
  // 编辑旧日志时不自动推进阶段（避免改动历史），仅新建练习模式首次进卡才升级
  const allowAutoUpgrade = !TodayState.existingLog;
  Object.keys(TodayState.pieces).forEach(function(index) {
    var p = TodayState.pieces[index];
    if (!p || !p.repId) return;
    var repPiece = RepertoireManager.findById(p.repId);
    if (!repPiece) return;
    // 首次进卡：未学 → 自动升级为分手（曲目进入练习卡即代表开始学习）
    if (allowAutoUpgrade && (repPiece.stage || 'untouched') === 'untouched') {
      RepertoireManager.advanceStage(repPiece.id);
      repPiece = RepertoireManager.findById(p.repId);
    }
    var stage = repPiece.stage || 'untouched';
    var info = PIECE_STAGES.find(function(s) { return s.key === stage; });
    var btn = document.querySelector('.piece-stage-btn[data-index="' + index + '"]');
    if (btn) btn.innerHTML = (info ? info.icon + ' ' + info.label : '🎓 阶段');
  });
};

/* ------------------------------------------
   时刻④：今日达成 - 底部抽屉
   ------------------------------------------ */

/**
 * 底部抽屉庆祝：今日练习全部完成
 * @param {Object} opts { pieceCount, stars }
 * @returns {void}
 */
window.showDayCompleteDrawer = function(opts) {
  opts = opts || {};
  var pieceCount = opts.pieceCount || 0;
  var stars = opts.stars || 0;

  var drawer = document.createElement('div');
  drawer.className = 'celebrate-drawer-overlay';
  drawer.innerHTML =
    '<div class="celebrate-drawer">' +
      '<div class="celebrate-drawer-handle"></div>' +
      '<div class="celebrate-drawer-title">🎯 今日达成</div>' +
      '<div class="celebrate-drawer-stats">' +
        '<div class="celebrate-drawer-stat">' +
          '<div class="celebrate-drawer-stat-num">' + pieceCount + '</div>' +
          '<div class="celebrate-drawer-stat-label">练了曲目</div>' +
        '</div>' +
        '<div class="celebrate-drawer-stat">' +
          '<div class="celebrate-drawer-stat-num">' + stars + '</div>' +
          '<div class="celebrate-drawer-stat-label">获得星星</div>' +
        '</div>' +
      '</div>' +
      '<div class="celebrate-drawer-ladder">' + stageLadderHTML('proficient', 5) + '</div>' +
      '<button class="btn btn-primary celebrate-drawer-btn" onclick="this.closest(\'.celebrate-drawer-overlay\').remove()">🏅 收下</button>' +
    '</div>';
  document.body.appendChild(drawer);
};

/* ------------------------------------------
   时刻③入口：今日页曲目卡片的阶段推进
   ------------------------------------------ */

/**
 * 今日页推进曲目阶段（孩子练习时自评升级）
 * @param {string} index 曲目索引
 * @returns {void}
 */
window.advancePieceStage = function(index) {
  var p = TodayState.pieces[index];
  if (!p || !p.repId) {
    Utils.showToast('⚠️ 该曲目未关联曲库，无法升级阶段', 'warning');
    return;
  }
  var before = RepertoireManager.findById(p.repId);
  var fromKey = before ? (before.stage || 'untouched') : 'untouched';
  var res = RepertoireManager.advanceStage(p.repId);
  if (!res.ok) {
    Utils.showToast('🌟 已到最高阶段「熟练」', 'info');
    return;
  }
  // 更新按钮显示
  var btn = document.querySelector('.piece-stage-btn[data-index="' + index + '"]');
  if (btn) {
    var info = PIECE_STAGES.find(function(s) { return s.key === res.stage; });
    btn.innerHTML = (info ? info.icon + ' ' + info.label : '🎓 ' + res.stage);
  }
  showStageUpCelebration(fromKey, res.stage);
};

/* ------------------------------------------
   时刻①：本周激励数据
   ------------------------------------------ */

/**
 * 计算本周（周一~今天）练习星星数与完成曲目数
 * @returns {{stars:number, pieces:number}}
 */
function computeWeeklyEncourage() {
  var today = new Date();
  var dow = (today.getDay() + 6) % 7; // 周一=0
  var monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  var mondayStr = Utils.dateStr(monday);

  var stars = 0;
  var pieceSet = {};
  var logs = DB.logs();
  logs.forEach(function(l) {
    if (l.date >= mondayStr && l.date <= Utils.today()) {
      (l.entries || []).forEach(function(e) {
        stars += (e.rating || 0);
        if (e.pieceName && (e.rating || 0) > 0) pieceSet[e.pieceName] = true;
      });
    }
  });
  return { stars: stars, pieces: Object.keys(pieceSet).length };
}