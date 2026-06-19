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
      let statusBtn = '';
      if (piece.status === 'learned') {
        statusBtn = '<button class="btn btn-sm btn-success" style="font-size:0.7rem;padding:5px 10px" onclick="cycleRepStatus(\'' + piece.id + '\')">✅ 已学会</button>';
      } else if (piece.status === 'learning') {
        statusBtn = '<button class="btn btn-sm" style="font-size:0.7rem;padding:5px 10px;background:var(--accent-yellow-soft);color:var(--accent-yellow);border:1px solid var(--accent-yellow)" onclick="cycleRepStatus(\'' + piece.id + '\')">🌱 学习中</button>';
      } else {
        statusBtn = '<button class="btn btn-sm btn-secondary" style="font-size:0.7rem;padding:5px 10px" onclick="cycleRepStatus(\'' + piece.id + '\')">💤 未学</button>';
      }

      const memBtn = piece.status === 'learned'
        ? `<button class="btn btn-sm ${piece.memorized ? 'btn-primary' : 'btn-secondary'}" style="font-size:0.7rem;padding:5px 10px" onclick="toggleRepMemorized('${piece.id}')">${piece.memorized ? '🧠 可背谱' : '📖 不能背谱'}</button>`
        : '';

      return `
        <div class="card mb-8 ${isCardExpanded ? 'expanded' : ''}" id="repCard${piece.id}" style="cursor:pointer;margin-left:20px;border-left:2px solid var(--border-2)">
          <div class="flex-between" onclick="toggleRepCard('${piece.id}')">
            <span style="flex:1;min-width:0">
              <div class="font-bold">${piece.num}. ${Utils.escape(piece.en || piece.name)}</div>
              <div class="text-xs text-3">${Utils.escape(piece.name)} · ${Utils.escape(piece.composer || '')}</div>
            </span>
            <span class="flex-row gap-4" onclick="event.stopPropagation()">
              ${statusBtn}
              ${memBtn}
            </span>
          </div>
          ${isCardExpanded && (piece.status === 'learned' || piece.status === 'learning') ? `
            <div class="text-xs text-2 mt-8" style="padding-top:8px;border-top:1px solid var(--border-2)">
              ${piece.startedDate ? `📅 开始：${Utils.formatDate(piece.startedDate)}` : ''}
              ${piece.completedDate ? `· ✅ 完成：${Utils.formatDate(piece.completedDate)}` : ''}
              ${piece.totalMinutes ? `· ⏱ ${piece.totalMinutes}分钟` : ''}
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
      <button class="btn btn-primary btn-sm" onclick="showRepertoireEditor()">
        🔧 编辑曲库
      </button>
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
 * 循环切换曲目状态：未学 → 学习中 → 已学会 → 未学
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
window.cycleRepStatus = function(pieceId) {
  const piece = RepertoireManager.findById(pieceId);
  if (!piece) return;

  if (piece.status === 'untouched') {
    RepertoireManager.updateStatus(pieceId, 'learning');
    Utils.showToast('📚 开始学习', 'info');
  } else if (piece.status === 'learning') {
    RepertoireManager.updateStatus(pieceId, 'learned');
    Utils.showToast('🎉 恭喜学会！', 'success');
  } else {
    RepertoireManager.updateStatus(pieceId, 'untouched');
    Utils.showToast('🔄 状态已重置', 'info');
  }
  renderRepertoire();
};

/**
 * 切换曲目背谱状态
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
window.toggleRepMemorized = function(pieceId) {
  const newState = RepertoireManager.toggleMemorized(pieceId);
  Utils.showToast(newState ? '🧠 可以背谱了！' : '📖 还需要看谱', 'success');
  renderRepertoire();
};