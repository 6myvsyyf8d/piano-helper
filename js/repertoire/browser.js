/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   🎵 曲库 - 浏览页（状态 + 渲染 + 交互）
   ========================================== */
"use strict";

/**
 * 曲库浏览页的展开状态
 * @namespace
 */
let repertoireState = {
  /** @type {Object<number, boolean>} 各册的展开状态 */
  expandedBooks: { 1: false, 2: false },
  /** @type {Object<string, boolean>} 各曲目卡片的展开状态 */
  expandedPieces: {}
};

/**
 * 渲染曲库浏览页
 * @returns {void}
 */
function renderRepertoire() {
  const page = document.getElementById('page-repertoire');
  if (!page) return;

  const repertoire = DB.repertoire();
  if (!repertoire.length) {
    page.innerHTML = '<div class="empty-state"><div class="empty-icon">🎵</div><p>曲库加载中...</p></div>';
    return;
  }

  // 动态获取所有分册
  const bookNums = RepertoireManager.getBookList();
  const books = bookNums.map(bn => {
    const pieces = repertoire.filter(p => p.book === bn);
    const learned = pieces.filter(p => p.status === 'learned').length;
    return {
      num: bn,
      // ✅ 统一使用 getBookDisplayName，支持自定义册名
      title: RepertoireManager.getBookDisplayName(bn),
      subtitle: pieces.length + '曲 · 已学' + learned + '首',
      pieces
    };
  });

  const booksHtml = books.map(book => {
    const total = book.pieces.length;
    const learned = book.pieces.filter(p => p.status === 'learned').length;
    const progress = total > 0 ? Math.round((learned / total) * 100) : 0;
    const isExpanded = repertoireState.expandedBooks[book.num];

    const piecesHtml = book.pieces.map(piece => {
      const isCardExpanded = repertoireState.expandedPieces[piece.id];
      // 5 级阶段按钮：显示当前阶段，点击弹面板选择阶段（可升可降）
      const curStage = piece.stage || 'untouched';
      const stageIdx = PIECE_STAGES.findIndex(s => s.key === curStage);
      const stageInfo = PIECE_STAGES[stageIdx >= 0 ? stageIdx : 0];
      const isTop = stageIdx >= PIECE_STAGES.length - 1;
      const stageBtn = '<button class="btn btn-sm stage-advance-btn" style="font-size:0.7rem;padding:5px 10px" onclick="openRepStagePanel(\'' + piece.id + '\')">' +
          stageInfo.icon + ' ' + stageInfo.label +
          (isTop ? ' ✓' : '<span style="opacity:0.6"> ▾</span>') +
        '</button>';

      // 背谱由 stage 推导（背谱/熟练 = 已能背谱），不再手动设置
      const memBadge = (curStage === 'memorize' || curStage === 'proficient')
        ? '<span class="btn btn-sm" style="font-size:0.7rem;padding:5px 10px;background:rgba(142,212,166,0.12);color:var(--accent-green);border:1px solid rgba(142,212,166,0.3);pointer-events:none">🧠 已能背谱</span>'
        : '';

      return `
        <div class="card mb-8 ${isCardExpanded ? 'expanded' : ''}" id="repCard${piece.id}" style="cursor:pointer;margin-left:20px;border-left:2px solid var(--border-2)">
          <div class="flex-between" onclick="toggleRepCard('${piece.id}')">
            <span style="flex:1;min-width:0">
              <div class="font-bold">${piece.num}. ${Utils.escape(piece.en || piece.name)}</div>
              <div class="text-xs text-3">${Utils.escape(piece.name)} · ${Utils.escape(piece.composer || '')}</div>
            </span>
            <span class="flex-row gap-4" onclick="event.stopPropagation()">
              ${stageBtn}
              ${memBadge}
            </span>
          </div>
          ${isCardExpanded && (piece.status === 'learned' || piece.status === 'learning') ? `
            <div class="text-xs text-2 mt-8" style="padding-top:8px;border-top:1px solid var(--border-2)">
              ${renderStageTimeline(piece)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="card mb-16">
        <div class="flex-between" onclick="toggleRepertoireBook(${book.num})" style="cursor:pointer">
          <span style="flex:1">
            <div class="font-bold text-lg">📖 ${Utils.escape(book.title)}</div>
            <div class="text-xs text-3 mt-4">${book.subtitle}</div>
          </span>
          <span style="display:flex;align-items:center;gap:12px">
            <span class="text-sm text-2">${progress}% · ${learned}/${total}</span>
            <span style="font-size:1.2rem;color:var(--text-3);transition:transform 0.3s;transform:rotate(${isExpanded ? '90deg' : '0'})">▶</span>
          </span>
        </div>
        <div id="bookList${book.num}" style="display:${isExpanded ? 'block' : 'none'};margin-top:12px">
          ${piecesHtml}
        </div>
      </div>
    `;
  }).join('');

  page.innerHTML = `
    <div class="flex-between mb-16">
      <span class="text-lg font-bold">🎵 曲库</span>
      <span class="flex-row gap-8">
        <button class="btn btn-secondary btn-sm" onclick="showPortfolio()">🎓 作品档案</button>
        <button class="btn btn-primary btn-sm" onclick="showRepertoireEditor()">🔧 编辑曲库</button>
      </span>
    </div>
    ${booksHtml}
  `;
}

/* ------------------------------------------
   交互函数（全局，HTML onclick 调用）
   ------------------------------------------ */

/**
 * 展开/收起书籍
 * @param {number} bookNum 册号
 * @returns {void}
 */
window.toggleRepertoireBook = function(bookNum) {
  repertoireState.expandedBooks[bookNum] = !repertoireState.expandedBooks[bookNum];
  renderRepertoire();
};

/**
 * 展开/收起曲目详情卡片
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
window.toggleRepCard = function(pieceId) {
  repertoireState.expandedPieces[pieceId] = !repertoireState.expandedPieces[pieceId];
  renderRepertoire();
};

/**
 * 推进曲目阶段到下一级（今日页首次进卡等场景仍在用；曲库按钮已改为弹面板）
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
window.advanceRepStage = function(pieceId) {
  const res = RepertoireManager.advanceStage(pieceId);
  if (!res.ok) {
    Utils.showToast('🌟 已到最高阶段「熟练」', 'info');
    return;
  }
  const stage = PIECE_STAGES.find(s => s.key === res.stage);
  if (res.stage === 'proficient') {
    Utils.showToast('🎉 恭喜！已熟练掌握', 'success');
  } else {
    Utils.showToast((stage ? stage.icon + ' ' : '') + '进入「' + (stage ? stage.label : res.stage) + '」阶段', 'info');
  }
  renderRepertoire();
};

/**
 * 打开阶段选择面板（点曲库阶段按钮，可升可降）
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
window.openRepStagePanel = function(pieceId) {
  const piece = RepertoireManager.findById(pieceId);
  if (!piece) return;
  const curStage = piece.stage || 'untouched';
  const curIdx = Math.max(0, PIECE_STAGES.findIndex(s => s.key === curStage));

  const optionsHtml = PIECE_STAGES.map(function(s, i) {
    const active = i === curIdx;
    const stateHtml = active
      ? '<span style="font-size:0.65rem;color:var(--accent-primary);border:1px solid rgba(94,106,210,0.35);background:rgba(94,106,210,0.1);padding:1px 6px;border-radius:999px">当前</span>'
      : '';
    return (
      '<button type="button" class="rep-stage-option' + (active ? ' active' : '') + '"' +
        ' onclick="applyRepStage(\'' + pieceId + '\', \'' + s.key + '\')"' +
        ' style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid ' + (active ? 'rgba(94,106,210,0.45)' : 'var(--border-2)') + ';' +
          'background:' + (active ? 'rgba(94,106,210,0.12)' : 'transparent') + ';cursor:pointer;text-align:left">' +
        '<span style="font-size:1.2rem">' + s.icon + '</span>' +
        '<span style="flex:1;font-size:0.85rem;font-weight:600;color:var(--text-1)">' + s.label + '</span>' +
        stateHtml +
      '</button>'
    );
  }).join('');

  const old = document.getElementById('repStagePanelOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'repStagePanelOverlay';
  overlay.className = 'modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeRepStagePanel(); };
  overlay.innerHTML =
    '<div class="modal" style="max-width:340px" onclick="event.stopPropagation()">' +
      '<div class="modal-header">' +
        '<h2 class="modal-title" style="font-size:1rem">🎓 选择阶段</h2>' +
        '<button class="modal-close" onclick="closeRepStagePanel()">✕</button>' +
      '</div>' +
      '<div class="modal-body" style="padding:12px 16px 16px">' +
        '<div style="font-size:0.78rem;color:var(--text-3);margin-bottom:10px">' + Utils.escape(piece.name) + ' · 可升可降</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + optionsHtml + '</div>' +
      '</div>' +
    '</div>';
  document.getElementById('modalContainer').appendChild(overlay);
};

/**
 * 关闭阶段选择面板
 */
window.closeRepStagePanel = function() {
  const overlay = document.getElementById('repStagePanelOverlay');
  if (overlay) overlay.remove();
};

/**
 * 应用所选阶段（阶段选择面板）
 * @param {string} pieceId 曲目 ID
 * @param {string} stageKey 目标阶段
 */
window.applyRepStage = function(pieceId, stageKey) {
  const res = RepertoireManager.setStage(pieceId, stageKey);
  if (!res.ok) return;
  closeRepStagePanel();
  const stage = PIECE_STAGES.find(s => s.key === res.stage);
  const label = stage ? (stage.icon + ' ' + stage.label) : res.stage;
  if (res.stage === 'proficient') {
    Utils.showToast('🎉 恭喜！已熟练掌握', 'success');
  } else if (res.down) {
    Utils.showToast('已调整到「' + label + '」', 'info');
  } else {
    Utils.showToast(label + '，进入「' + (stage ? stage.label : '') + '」阶段', 'info');
  }
  renderRepertoire();
};

/**
 * 渲染曲目学习历程时间线（作品档案 + 曲库卡片共用）
 * 横向 5 节点：未学 → 分手 → 合手 → 背谱 → 熟练
 * @param {Object} piece 曲目对象
 * @returns {string} HTML
 */
function renderStageTimeline(piece) {
  const history = Array.isArray(piece.stageHistory) ? piece.stageHistory : [];
  // 构建每个阶段对应的到达日期
  const stageDate = {};
  if (piece.startedDate) stageDate['separate'] = piece.startedDate;
  history.forEach(function(h) { if (h && h.stage) stageDate[h.stage] = h.date; });

  const curStage = piece.stage || 'untouched';
  const curIdx = PIECE_STAGES.findIndex(s => s.key === curStage);
  const activeIdx = curIdx >= 0 ? curIdx : 0;

  let html = '<div class="stage-timeline">';
  PIECE_STAGES.forEach(function(s, i) {
    if (i > 0) html += '<span class="stage-connector"></span>';
    const active = i <= activeIdx;
    html += '<div class="stage-node' + (active ? ' active' : '') + '">' +
      '<span class="stage-dot">' + s.icon + '</span>' +
      '<span class="stage-label">' + s.label + '</span>' +
      (stageDate[s.key] ? '<span class="stage-date">' + Utils.formatDate(stageDate[s.key]) + '</span>' : '') +
    '</div>';
  });
  html += '</div>';
  return html;
}

/**
 * 作品档案：弹窗展示已学习曲目的成长时间线
 * @returns {void}
 */
window.showPortfolio = function() {
  const learned = DB.repertoire().filter(p => p.status === 'learned' || p.status === 'learning');
  // 按开始学习日期倒序（最近的在前）
  const sorted = learned.slice().sort(function(a, b) {
    const da = a.completedDate || a.startedDate || '';
    const db = b.completedDate || b.startedDate || '';
    return (da < db) ? 1 : ((da > db) ? -1 : 0);
  });

  const itemsHtml = sorted.map(function(piece) {
    const stageInfo = PIECE_STAGES.find(s => s.key === (piece.stage || 'untouched')) || PIECE_STAGES[0];
    return (
      '<div class="portfolio-item" style="padding:12px 0;border-bottom:1px solid var(--border-2)">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
          '<span style="font-size:1.1rem">' + stageInfo.icon + '</span>' +
          '<span style="font-weight:600;color:var(--text-1)">' + Utils.escape(piece.name) + '</span>' +
          (piece.en ? '<span style="font-size:0.72rem;color:var(--text-3)">' + Utils.escape(piece.en) + '</span>' : '') +
        '</div>' +
        renderStageTimeline(piece) +
      '</div>'
    );
  }).join('');

  const modal = document.getElementById('modalContainer');
  modal.innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" style="max-width:460px">' +
      '<div class="modal-header"><h2 class="modal-title">🎓 作品档案</h2><button class="modal-close" onclick="closeModal()">✕</button></div>' +
      '<div class="modal-body">' +
        '<div style="font-size:0.75rem;color:var(--text-3);margin-bottom:12px">已学习 ' + sorted.length + ' 首曲目</div>' +
        (itemsHtml || '<div class="empty-state"><div class="empty-icon">🌟</div><p>还没有开始学习的曲目</p></div>') +
      '</div>' +
    '</div></div>';
};
