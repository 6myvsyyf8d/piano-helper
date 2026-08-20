/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   📒 课程记录页面（按册分组版）
   ========================================== */
"use strict";

/* ------------------------------------------
   课程列表渲染
   ------------------------------------------ */
function renderLessons() {
  const page = document.getElementById('page-lessons');
  if (!page) return;

  const lessons = DB.lessons().sort((a, b) => b.date.localeCompare(a.date));

  if (!lessons.length) {
    page.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📒</div>
        <div class="empty-title">还没有课程记录</div>
        <div class="empty-description">
          记录每次钢琴课的重点，帮助孩子更好地练习
        </div>
        <button class="btn btn-primary mt-24" onclick="showLessonForm()">
          ➕ 添加第一课
        </button>
      </div>
    `;
    return;
  }

  const lessonsHtml = lessons.map(lesson => {
    const pieceNames = lesson.pieces.map(p => p.name).join('、');
    const focusTags = lesson.focusAreas && lesson.focusAreas.length
      ? lesson.focusAreas.map(tag => `<span class="badge badge-info">${Utils.escape(tag)}</span>`).join('')
      : '';
    return `
      <div class="card card-highlight" onclick="showLessonForm('${lesson.id}')" style="cursor:pointer">
        <div class="flex-between mb-8">
          <span class="font-bold">📅 ${Utils.formatDate(lesson.date)}</span>
          <span class="text-xs text-3">${lesson.pieces.length} 首曲目</span>
        </div>
        <div class="text-sm text-2 mb-8">
          🎵 ${Utils.escape(pieceNames)}
        </div>
        ${focusTags ? `
          <div class="tag-row mb-8">
            ${focusTags}
          </div>
        ` : ''}
        ${lesson.notes ? `
          <div class="text-xs text-3" style="line-height:1.5;margin-top:8px">
            💬 ${Utils.escape(lesson.notes).slice(0, 80)}${lesson.notes.length > 80 ? '...' : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  page.innerHTML = `
    <div class="flex-between mb-16">
      <span class="text-lg font-bold">共 ${lessons.length} 次课</span>
      <button class="btn btn-primary btn-sm" onclick="showLessonForm()">
        ➕ 新课程
      </button>
    </div>
    ${lessonsHtml}
  `;
}

/* ------------------------------------------
   显示课程表单（添加/编辑）
   ------------------------------------------ */

/**
 * 显示课程表单（按册分组）
 * @param {string} [lessonId] - 编辑时传入课程 ID，新增时不传
 * @returns {void}
 */
window.showLessonForm = function(lessonId) {
  const lesson = lessonId ? DB.lessons().find(l => l.id === lessonId) : null;
  const isEdit = !!lesson;
  const pieces = lesson ? lesson.pieces : [];

  // 把现有曲目按 book 字段分组（保留向后兼容老数据）
  const piecesByBook = groupLessonPiecesByBook(pieces);

  // 渲染所有册卡片（按 book 数字升序）
  const bookCardsHtml = Array.from(piecesByBook.keys())
    .sort((a, b) => a - b)
    .map(bookNum => renderBookCard(bookNum, piecesByBook.get(bookNum)))
    .join('');

  // 初始化课堂标记模块（Phase 1）
  LessonMarkers.init(lesson);
  const markersHtml = LessonMarkers.render();

  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay modal-lesson-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal modal-lesson">
        <div class="modal-header">
          <h2 class="modal-title">${isEdit ? '✏️ 编辑课程' : '📒 新增课程'}</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="lessonForm">
            <div class="form-group">
              <label class="form-label">📅 上课日期</label>
              <input type="date" class="form-input" id="lessonDate" value="${lesson ? lesson.date : Utils.today()}" required>
            </div>

            ${markersHtml}

            <div class="form-group">
              <div id="lessonBookCardsContainer">
                ${bookCardsHtml || '<p class="text-xs text-3 text-center p-12" id="lessonEmptyHint">还没有添加曲目，点击下方按钮添加</p>'}
              </div>
              ${(!isEdit && DB.lessons().length > 0) ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="copyPreviousLessonPieces()" style="width:100%;margin-top:8px">
                  📋 复制上节课曲目
                </button>
              ` : ''}
              <button type="button" class="btn btn-primary btn-sm" onclick="showLessonAddBookPicker()" style="width:100%;margin-top:8px">
                ➕ 添加册
              </button>
            </div>

            <div class="form-group">
              <label class="form-label">📝 整课备注</label>
              <textarea class="form-input" id="lessonNotes" placeholder="老师的叮嘱、下节课安排..." style="min-height:70px">${lesson ? Utils.escape(lesson.notes || '') : ''}</textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="saveLesson('${lessonId || ''}')" style="width:100%">
            💾 保存课程
          </button>
          ${isEdit ? `
            <button class="btn btn-danger mt-8" onclick="deleteLesson('${lesson.id}')" style="width:100%">
              🗑 删除此课程
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // 课堂标记：启动计时器（仅新增模式）+ 渲染各曲目卡片内的标记
  if (!isEdit) LessonMarkers.startTimer();

  // 事件委托：曲名变化时更新标记的 pieceTitle + 刷新标记区
  const lessonForm = document.getElementById('lessonForm');
  if (lessonForm) {
    // focus 时记录当前曲名（用于 change 时比较）
    lessonForm.addEventListener('focusin', function(e) {
      var el = e.target;
      if (el && (el.classList.contains('piece-name-select') || el.classList.contains('piece-name-input'))) {
        var card = el.closest('.lesson-piece-card');
        el._prevPieceName = card ? LessonMarkers._getPieceNameFromCard(card) : '';
      }
    });
    // change 时更新标记 + 刷新
    lessonForm.addEventListener('change', function(e) {
      var el = e.target;
      if (el && (el.classList.contains('piece-name-select') || el.classList.contains('piece-name-input'))) {
        var card = el.closest('.lesson-piece-card');
        if (card) {
          var newName = LessonMarkers._getPieceNameFromCard(card);
          var oldName = el._prevPieceName || '';
          if (oldName && newName && oldName !== newName) {
            LessonMarkers._markers.forEach(function(m) {
              if (m.pieceTitle === oldName) m.pieceTitle = newName;
            });
          }
          LessonMarkers.refreshAllPieceMarkers();
        }
      }
    });
  }
  // 初始渲染所有曲目卡片内的标记
  LessonMarkers.refreshAllPieceMarkers();

  // 阻止左右滑动时画面跟随（iOS橡皮筋效果）
  var overlay = modal.querySelector('.modal-lesson-overlay');
  if (overlay) {
    overlay.addEventListener('touchmove', function(e) {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
  }
};

/* ------------------------------------------
   辅助函数：曲目按 book 分组
   ------------------------------------------ */

/**
 * 把课程的曲目数组按 book 字段分组
 * 兼容老数据：没有 book 字段的曲目，从 repId 反推；都没有则归到 book=1
 * @param {Array} pieces 曲目数组
 * @returns {Map<number, Array>} bookNum → 该册的曲目列表
 */
function groupLessonPiecesByBook(pieces) {
  const map = new Map();
  pieces.forEach(piece => {
    let bookNum = piece.book;

    // 老数据兼容：从 repId 反推（如 "s2-01" → 2、"o3-02" → 23）
    if (!bookNum && piece.repId) {
      const b = RepertoireManager.bookFromRepId(piece.repId);
      if (b != null) bookNum = b;
    }

    // 还是没有就归到 book=1（避免数据丢失，Rule 12）
    if (!bookNum) bookNum = 1;

    if (!map.has(bookNum)) map.set(bookNum, []);
    map.get(bookNum).push(piece);
  });
  return map;
}

/**
 * 渲染一张册卡片（含已删除册的灰色样式）
 * @param {number} bookNum 册号
 * @param {Array} bookPieces 该册的曲目列表
 * @returns {string} HTML
 */
function renderBookCard(bookNum, bookPieces) {
  // 检查册是否还存在于曲库（影响：是否灰色显示）
  const allBooks = RepertoireManager.getBookList();
  const isCustom = RepertoireManager.isCustomBook(bookNum);
  // 自定义册不算 deleted（因为曲库里本来就没有）
  const isDeleted = !isCustom && !allBooks.includes(bookNum);
  const displayName = RepertoireManager.getBookDisplayName(bookNum);

  // 灰色样式（已删除册）
  const cardStyle = isDeleted
    ? 'background:rgba(255,107,107,0.05);border-left:3px solid var(--accent-red);opacity:0.7'
    : 'background:rgba(255,255,255,0.03);border-left:3px solid var(--accent-primary)';

  // 该册下的所有曲目卡片
  const piecesHtml = bookPieces.map((piece, idx) =>
    lessonPieceCardHTML(piece, idx, bookNum, isDeleted)
  ).join('');

  // 已删除册的提示
  const deletedBadge = isDeleted
    ? '<span class="text-xs" style="color:var(--accent-red);margin-left:6px">⚠️ 此册已从曲库移除</span>'
    : '';

  // 书名显示：自定义册用可编辑输入框，曲库册用纯文本
  const titleHtml = isCustom
    ? '<input type="text" class="form-input custom-book-title" data-book="' + bookNum + '" value="' + Utils.escape(displayName) + '" placeholder="例如：拜厄钢琴基本教程" style="padding:6px 10px;font-size:0.9rem;background:rgba(255,255,255,0.06);border:1px solid var(--border-1)">'
    : '<span class="font-bold text-sm">📖 ' + Utils.escape(displayName) + deletedBadge + '</span>';

  // 添加曲目按钮（已删除册不允许加新曲目）
  const addPieceBtn = isDeleted
    ? ''
    : '<button type="button" class="btn btn-sm btn-secondary" onclick="addLessonPiece(' + bookNum + ')" style="font-size:0.7rem;padding:4px 10px;width:100%;margin-top:6px">＋ 添加这册的曲目</button>';

  return `
    <div class="lesson-book-card mb-12" data-book-num="${bookNum}" style="${cardStyle};padding:12px;border-radius:8px">
      <div class="flex-between mb-8">
        <span style="flex:1;min-width:0">${titleHtml}</span>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeLessonBookCard(${bookNum})" style="font-size:0.65rem;padding:3px 8px" title="移除整张卡片">✕</button>
      </div>
      <div class="lesson-book-pieces" data-book-pieces="${bookNum}">
        ${piecesHtml || '<p class="text-xs text-3 text-center p-8">点击下方按钮添加曲目</p>'}
      </div>
      ${addPieceBtn}
    </div>
  `;
}

/**
 * 渲染单首曲目的 HTML（册卡片内）
 * @param {Object} piece 曲目对象
 * @param {number} idx 在该册中的索引
 * @param {number} bookNum 所属册号
 * @param {boolean} isDeleted 该册是否已从曲库删除
 * @returns {string} HTML
 */
function lessonPieceCardHTML(piece, idx, bookNum, isDeleted) {
  const scoreStars = (piece.score || '').length;
  const isCustom = RepertoireManager.isCustomBook(bookNum);

  // 曲目选择器：
  // - 自定义册 (bookNum >= 1000)：自由输入框
  // - 已删除册：纯文本输入框
  // - 曲库册：下拉选择器
  let nameField;
  if (isCustom) {
    nameField = '<input type="text" class="form-input piece-name-input" value="' + Utils.escape(piece.name || '') + '" placeholder="例如：拜厄第12首" style="padding:8px 10px;font-size:0.85rem">';
  } else if (isDeleted) {
    nameField = '<input class="form-input piece-name-input" value="' + Utils.escape(piece.name || '') + '" disabled style="padding:8px 10px;font-size:0.85rem;opacity:0.7">';
  } else {
    nameField = SuzukiSelectHelper.buildPieceSelect(bookNum, 'book' + bookNum, idx, piece.repId, piece.name);
  }

  return `
    <div class="card mb-8 lesson-piece-card" data-book="${bookNum}" data-piece-idx="${idx}" style="padding:10px">
      <div class="flex-between mb-8">
        <span class="font-bold text-xs">#${idx + 1}</span>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeLessonPiece(this)" style="font-size:0.6rem;padding:2px 6px">✕</button>
      </div>

      <div class="form-group" style="margin-bottom:8px">
        ${nameField}
      </div>

      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label" style="font-size:0.7rem;margin-bottom:4px">📝 老师要求</label>
        <textarea class="form-input piece-details" placeholder="例如：注意手型、节奏要稳、第二段力度变化..." style="min-height:80px;font-size:0.8rem">${Utils.escape(piece.details || '')}</textarea>
      </div>

      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" style="font-size:0.7rem;margin-bottom:4px">⭐ 回课评分</label>
        <div class="star-rating" data-piece-idx="${idx}" data-book="${bookNum}">
          ${[1,2,3,4,5].map(s => `
            <button type="button" class="star-btn${s <= scoreStars ? ' active' : ''}" data-star="${s}" onclick="setLessonPieceStar(${bookNum}, ${idx}, ${s})">⭐</button>
          `).join('')}
        </div>
      </div>

      <div class="piece-markers-area" style="margin-top:8px"></div>

      <input type="hidden" class="piece-book" value="${bookNum}">
      <input type="hidden" class="piece-repid" value="${piece.repId || ''}">
      <input type="hidden" class="piece-score" value="${piece.score || ''}">
    </div>
  `;
}

/* ------------------------------------------
   交互函数：添加/删除册卡片
   ------------------------------------------ */

/**
 * 显示"添加册"选择器（弹出曲库已有册列表）
 * @returns {void}
 */
window.showLessonAddBookPicker = function() {
  const allBooks = RepertoireManager.getBookList();

  // 找出当前已添加的 book，避免重复
  const existingBooks = new Set();
  document.querySelectorAll('.lesson-book-card').forEach(card => {
    existingBooks.add(parseInt(card.dataset.bookNum));
  });

  // 可选的册（去掉已添加的，曲库册 + 自定义册入口）
  const availableBooks = allBooks.filter(b => !existingBooks.has(b));

  const modal = document.getElementById('modalContainer');

  // 保留当前模态框（不 closeModal），用临时 picker 浮层
  const pickerHtml = `
    <div class="modal-overlay" id="lessonBookPicker" onclick="if(event.target===this)closeLessonBookPicker()" style="z-index:1100">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h2 class="modal-title">📖 选择册</h2>
          <button class="modal-close" onclick="closeLessonBookPicker()">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-2 mb-12">从曲库中选择本次课要练的册，或自由添加教材：</p>
          ${availableBooks.length ? availableBooks.map(bn => {
            const name = RepertoireManager.getBookDisplayName(bn);
            return `
              <button type="button" class="btn btn-secondary mb-8" onclick="addLessonBookCard(${bn})" style="width:100%;text-align:left;padding:12px">
                📖 ${Utils.escape(name)}
              </button>
            `;
          }).join('') : '<p class="text-xs text-3 mb-8 text-center">曲库中所有册已添加</p>'}
          <button type="button" class="btn btn-primary mb-8" onclick="addCustomLessonBookCard()" style="width:100%;padding:12px;background:var(--accent-primary);border:none;color:#fff">
            ➕ 自定义教材（自由输入书名、曲名）
          </button>
        </div>
      </div>
    </div>
  `;

  // 追加到 body（不覆盖原模态框）
  const div = document.createElement('div');
  div.innerHTML = pickerHtml;
  document.body.appendChild(div.firstElementChild);
};

/**
 * 关闭添加册选择器
 * @returns {void}
 */
window.closeLessonBookPicker = function() {
  const picker = document.getElementById('lessonBookPicker');
  if (picker) picker.remove();
};

/**
 * 选择册后添加卡片到表单
 * @param {number} bookNum 册号
 * @returns {void}
 */
window.addLessonBookCard = function(bookNum) {
  closeLessonBookPicker();

  const container = document.getElementById('lessonBookCardsContainer');
  if (!container) return;

  // 移除空状态提示
  const emptyHint = document.getElementById('lessonEmptyHint');
  if (emptyHint) emptyHint.remove();

  // 该册卡片已存在则不重复添加
  if (container.querySelector('.lesson-book-card[data-book-num="' + bookNum + '"]')) {
    Utils.showToast('ℹ️ 该册已添加', 'info');
    return;
  }

  // 渲染新卡片（无曲目）
  const cardHtml = renderBookCard(bookNum, []);
  const div = document.createElement('div');
  div.innerHTML = cardHtml;
  container.appendChild(div.firstElementChild);
};

/**
 * 添加一张自定义册卡片（bookNum >= 1000，自由输入书名和曲名）
 * @returns {void}
 */
window.addCustomLessonBookCard = function() {
  closeLessonBookPicker();

  const container = document.getElementById('lessonBookCardsContainer');
  if (!container) return;

  // 移除空状态提示
  const emptyHint = document.getElementById('lessonEmptyHint');
  if (emptyHint) emptyHint.remove();

  // 分配一个新的自定义册号
  const newBookNum = RepertoireManager.getNextCustomBookNum();

  // 渲染新卡片（空曲目列表）
  const cardHtml = renderBookCard(newBookNum, []);
  const div = document.createElement('div');
  div.innerHTML = cardHtml;
  container.appendChild(div.firstElementChild);
};

/**
 * 复制上节课的所有曲目到当前表单（仅新建课程时可用）
 * - 取最新一次课程（按日期降序）的所有 pieces
 * - 每首仅保留 name、book、repId，清空 details/focusAreas/score
 * - 按册分组后追加到表单：册已存在则追加曲目，否则新建册卡片
 * - 追加而非覆盖；移除空状态提示
 * @returns {void}
 */
window.copyPreviousLessonPieces = function() {
  // 按日期降序取最新一节课（不修改原数组）
  const sorted = [...DB.lessons()].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    Utils.showToast('⚠️ 没有历史课程可复制', 'warning');
    return;
  }
  const latestLesson = sorted[0];
  if (!latestLesson.pieces || !latestLesson.pieces.length) {
    Utils.showToast('⚠️ 上节课没有曲目', 'warning');
    return;
  }

  // 提取曲目：仅保留 name、book、repId，清空其它字段
  const copiedPieces = latestLesson.pieces.map(p => ({
    name: p.name || '',
    book: p.book,
    repId: p.repId || '',
    details: '',
    focusAreas: [],
    score: ''
  }));

  // 按册分组
  const grouped = groupLessonPiecesByBook(copiedPieces);

  const container = document.getElementById('lessonBookCardsContainer');
  if (!container) return;

  // 移除空状态提示
  const emptyHint = document.getElementById('lessonEmptyHint');
  if (emptyHint) emptyHint.remove();

  // 预读曲库信息（用于判断 isDeleted，与 renderBookCard 一致）
  const allBooks = RepertoireManager.getBookList();

  // 按册号升序遍历，逐册追加
  Array.from(grouped.keys()).sort((a, b) => a - b).forEach(bookNum => {
    const bookPieces = grouped.get(bookNum);
    const existingCard = container.querySelector('.lesson-book-card[data-book-num="' + bookNum + '"]');

    if (existingCard) {
      // 册卡片已存在：将曲目追加到该册的 .lesson-book-pieces 容器
      const piecesContainer = existingCard.querySelector('.lesson-book-pieces');
      if (!piecesContainer) return;

      // 移除该册的空状态文本
      const placeholder = piecesContainer.querySelector('p');
      if (placeholder) placeholder.remove();

      // 当前已有曲目数作为起始 idx
      const startIdx = piecesContainer.querySelectorAll('.lesson-piece-card').length;
      const isCustom = RepertoireManager.isCustomBook(bookNum);
      const isDeleted = !isCustom && !allBooks.includes(bookNum);

      bookPieces.forEach((piece, i) => {
        const idx = startIdx + i;
        const cardHtml = lessonPieceCardHTML(piece, idx, bookNum, isDeleted);
        const div = document.createElement('div');
        div.innerHTML = cardHtml;
        piecesContainer.appendChild(div.firstElementChild);
      });
    } else {
      // 册卡片不存在：新建整张册卡片（renderBookCard 内部处理 isCustom/isDeleted）
      const cardHtml = renderBookCard(bookNum, bookPieces);
      const div = document.createElement('div');
      div.innerHTML = cardHtml;
      container.appendChild(div.firstElementChild);
    }
  });

  Utils.showToast('✅ 已复制上节课曲目', 'success');
  // 刷新标记区
  if (typeof LessonMarkers !== 'undefined') LessonMarkers.refreshAllPieceMarkers();
};

/**
 * 移除整张册卡片（连同其下所有曲目）
 * @param {number} bookNum 册号
 * @returns {void}
 */
window.removeLessonBookCard = function(bookNum) {
  if (!confirm('确定移除这一册及其下所有曲目吗？')) return;

  const card = document.querySelector(`.lesson-book-card[data-book-num="${bookNum}"]`);
  if (card) card.remove();

  // 如果全删完了，显示空状态提示
  const container = document.getElementById('lessonBookCardsContainer');
  if (container && !container.querySelector('.lesson-book-card')) {
    container.innerHTML = '<p class="text-xs text-3 text-center p-12" id="lessonEmptyHint">还没有添加曲目，点击下方按钮添加</p>';
  }
};

/* ------------------------------------------
   交互函数：添加/删除单首曲目
   ------------------------------------------ */

/**
 * 在指定册的卡片内添加一首曲目
 * @param {number} bookNum 册号
 * @returns {void}
 */
window.addLessonPiece = function(bookNum) {
  const piecesContainer = document.querySelector(`.lesson-book-pieces[data-book-pieces="${bookNum}"]`);
  if (!piecesContainer) return;

  // 移除空状态文本
  const placeholder = piecesContainer.querySelector('p');
  if (placeholder) placeholder.remove();

  // 当前该册已有几首曲目
  const idx = piecesContainer.querySelectorAll('.lesson-piece-card').length;

  // 渲染新曲目卡片（空数据）
  const cardHtml = lessonPieceCardHTML({}, idx, bookNum, false);
  const div = document.createElement('div');
  div.innerHTML = cardHtml;
  piecesContainer.appendChild(div.firstElementChild);
  // 刷新标记区（新卡片无标记，但需确保事件绑定一致）
  if (typeof LessonMarkers !== 'undefined') LessonMarkers.refreshAllPieceMarkers();
};

/**
 * 删除单首曲目
 * @param {HTMLElement} btn 触发删除的按钮（用于定位卡片）
 * @returns {void}
 */
window.removeLessonPiece = function(btn) {
  if (!confirm('确定删除这首曲目吗？')) return;
  const card = btn.closest('.lesson-piece-card');
  if (card) card.remove();
};

/**
 * 从曲目卡片读取曲名
 * @param {HTMLElement} card
 * @returns {string}
 */
function getLessonPieceNameFromCard(card) {
  if (!card) return '';
  const nameSelect = card.querySelector('.piece-name-select');
  const nameInput = card.querySelector('.piece-name-input');
  if (nameSelect) {
    const selectedOption = nameSelect.options[nameSelect.selectedIndex];
    return selectedOption ? (selectedOption.dataset.name || '') : '';
  } else if (nameInput) {
    return nameInput.value.trim();
  }
  return '';
}

/**
 * 点击曲子卡片上的「⏱ 标记此曲」按钮：自动关联当前曲名添加课堂标记
 * @param {HTMLElement} btn 触发按钮
 * @param {number} bookNum 册号
 * @param {number} pieceIdx 曲目在该册中的索引
 * @returns {void}
 */
window.markLessonPiece = function(btn, bookNum, pieceIdx) {
  const card = btn.closest('.lesson-piece-card');
  const pieceName = getLessonPieceNameFromCard(card);
  if (!card) return;
  if (!pieceName) {
    Utils.showToast('⚠️ 请先从下拉中选择这首曲子', 'warning');
    const ns = card.querySelector('.piece-name-select');
    const ni = card.querySelector('.piece-name-input');
    if (ns) ns.focus(); else if (ni) ni.focus();
    return;
  }
  if (typeof LessonMarkers !== 'undefined' && typeof LessonMarkers.addMarkForPiece === 'function') {
    LessonMarkers.addMarkForPiece(pieceName);
  } else {
    Utils.showToast('⚠️ 课堂标记模块未加载', 'warning');
  }
};

/**
 * 从曲目卡片的标记区按钮调用（没有 bookNum/pieceIdx 参数）
 * @param {HTMLElement} btn
 */
window.markLessonPieceFromCard = function(btn) {
  const card = btn.closest('.lesson-piece-card');
  const pieceName = getLessonPieceNameFromCard(card);
  if (!card) return;
  if (!pieceName) {
    Utils.showToast('⚠️ 请先选择这首曲子', 'warning');
    return;
  }
  if (typeof LessonMarkers !== 'undefined' && typeof LessonMarkers.addMarkForPiece === 'function') {
    LessonMarkers.addMarkForPiece(pieceName);
  } else {
    Utils.showToast('⚠️ 课堂标记模块未加载', 'warning');
  }
};

/**
 * 设置曲目星星评分
 * ⚠️ 修复了原版 setLessonPieceStar 的反引号 Bug：querySelector(`...`)
 * @param {number} bookNum 册号
 * @param {number} pieceIdx 曲目在该册中的索引
 * @param {number} star 星数（1-5）
 * @returns {void}
 */
window.setLessonPieceStar = function(bookNum, pieceIdx, star) {
  // ✅ 修复：原代码缺左括号 querySelector`...`)
  const container = document.querySelector(`.star-rating[data-book="${bookNum}"][data-piece-idx="${pieceIdx}"]`);
  if (!container) return;

  const card = container.closest('.lesson-piece-card');
  if (!card) return;

  const scoreInput = card.querySelector('.piece-score');
  const buttons = container.querySelectorAll('.star-btn');

  // 当前分数
  const currentScore = scoreInput.value.length;

  // 如果点击的是已选中的，则取消（点 3 星，当前是 3 星 → 变成 2 星）
  const newScore = (currentScore === star) ? star - 1 : star;

  // 更新隐藏字段
  scoreInput.value = '⭐'.repeat(newScore);

  // 更新按钮状态
  buttons.forEach(btn => {
    const s = parseInt(btn.dataset.star);
    if (s <= newScore) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
};

/* ------------------------------------------
   保存 / 删除课程
   ------------------------------------------ */

/**
 * 保存课程（新增或编辑）
 * @param {string} [lessonId] 编辑时传入课程 ID
 * @returns {void}
 */
window.saveLesson = function(lessonId) {
  const date = document.getElementById('lessonDate').value;
  const notes = document.getElementById('lessonNotes').value.trim();

  if (!date) {
    Utils.showToast('⚠️ 请选择上课日期', 'warning');
    return;
  }

  const focusOptions = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏'];
  const pieces = [];

  // 遍历每张册卡片，收集其中所有曲目
  document.querySelectorAll('.lesson-book-card').forEach(bookCard => {
    const bookNum = parseInt(bookCard.dataset.bookNum);

    bookCard.querySelectorAll('.lesson-piece-card').forEach(pieceCard => {
      const nameSelect = pieceCard.querySelector('.piece-name-select');
      const nameInput = pieceCard.querySelector('.piece-name-input');
      const detailsEl = pieceCard.querySelector('.piece-details');
      const repIdInput = pieceCard.querySelector('.piece-repid');
      const scoreInput = pieceCard.querySelector('.piece-score');

      let name = '';
      let repId = '';

      if (nameSelect) {
        // 曲库册：从下拉选择器读取（value 是 repId，data-name 是中文曲名）
        repId = nameSelect.value.trim();
        const selectedOption = nameSelect.options[nameSelect.selectedIndex];
        name = selectedOption ? (selectedOption.dataset.name || '') : '';
      } else if (nameInput) {
        // 自定义册 或 已删除册：从 input 读取
        name = nameInput.value.trim();
        // 只有非自定义册才尝试从曲库找 repId
        if (!RepertoireManager.isCustomBook(bookNum)) {
          const repPiece = RepertoireManager.findByName(name);
          if (repPiece) repId = repPiece.id;
        }
      }

      if (!name) return; // 跳过空曲目

      // 从老师要求文本中自动提取练习重点关键词
      const detailsText = detailsEl ? detailsEl.value.trim() : '';
      const focusKeywords = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏'];
      const focusAreas = focusKeywords.filter(kw => detailsText.includes(kw));

      pieces.push({
        name,
        details: detailsEl ? detailsEl.value.trim() : '',
        book: bookNum,
        category: 'suzuki',  // 保留向后兼容（旧 today.js 可能依赖此字段）
        repId: repId || (repIdInput ? repIdInput.value : ''),
        score: scoreInput ? scoreInput.value : '',
        focusAreas: focusAreas
      });
    });
  });

  if (!pieces.length) {
    Utils.showToast('⚠️ 请至少添加一首曲目', 'warning');
    return;
  }

  // ── 保存自定义册的书名到 bookMeta ──
  // 对所有 bookNum >= 1000 的册，从 .custom-book-title 读取书名并存入
  let customBookTitles = {};
  document.querySelectorAll('.custom-book-title').forEach(inputEl => {
    const bn = parseInt(inputEl.dataset.book);
    const title = inputEl.value.trim();
    if (bn && title) customBookTitles[bn] = title;
  });

  if (Object.keys(customBookTitles).length) {
    const meta = DB.bookMeta();
    let changed = false;
    for (const [bn, title] of Object.entries(customBookTitles)) {
      if (meta[bn] !== title) {
        meta[bn] = title;
        changed = true;
      }
    }
    if (changed) DB.saveBookMeta(meta);
  }

  // 构建课程对象
  const lesson = {
    id: lessonId || Utils.uid(),
    date,
    pieces,
    focusAreas: [],  // 保留向后兼容
    notes,
    audioMarkers: LessonMarkers.getMarkers(), // Phase 1 课堂书签（spec v1.1：背景录音 + 时间戳书签）
    lessonAudioId: LessonMarkers.getLessonAudioId(), // 课堂录音首段 blob ID（向后兼容）
    audioDurationSec: LessonMarkers.getAudioDurationSec(), // 录音总时长（秒，课程时间轴）
    lessonAudios: LessonMarkers.getLessonAudios() // 多段录音 [{id, startSec, durationSec}]
  };

  // 保存到数据库
  let lessons = DB.lessons();
  if (lessonId) {
    lessons = lessons.map(l => l.id === lessonId ? lesson : l);
  } else {
    lessons.push(lesson);
  }
  DB.saveLessons(lessons);

  // 修复：新建课程期间通过「整理曲谱」创建的图钉反馈，此时 lesson 尚未生成 id，
  // FeedbackOrganizer 以空 lessonId 创建了它们。保存后需要回填真正的 lesson.id，
  // 否则这些反馈在今日页无法与课程关联（永远不显示），成为孤儿数据。
  if (!lessonId) {
    const pieceTitles = new Set(pieces.map(p => p.name));
    const orphanFbs = DB.feedbacks();
    let orphanChanged = false;
    orphanFbs.forEach(f => {
      if (!f.lessonId && pieceTitles.has(f.pieceTitle)) {
        f.lessonId = lesson.id;
        orphanChanged = true;
      }
    });
    if (orphanChanged) DB.saveFeedbacks(orphanFbs);
  }

  // 保存课程时：自动把「有备注文字 + 有曲子」的 marker 转成 FeedbackItem（new 状态）
  // spec v1.1：marker 不再携带独立片段录音，仅作为全程背景录音的时间戳书签
  let autoCreatedCount = 0;
  const allFbs = DB.feedbacks();
  lesson.audioMarkers.forEach(m => {
    const hasNote = !!(m.label && m.label.trim() && m.pieceTitle && m.pieceTitle.trim());
    if (!hasNote) return;
    if (m.reviewed) return; // 已手动整理过就不自动生成
    // 避免重复：同一个 lesson + markerId 组合不生成两次
    const dup = allFbs.find(f => f.lessonId === lesson.id && f.markerId === m.id);
    if (dup) return;
    const fb = Feedback.create({
      lessonId: lesson.id,
      markerId: m.id,
      pieceTitle: (m.pieceTitle || '').trim() || '其他',
      locationLabel: '', // 位置描述：自动生成时无线位置信息，留空（课后图钉整理时再填）
      category: 'other',
      teacherNote: (m.label || '').trim() // 备注文字：顺手写的那句话，作为老师原话简述
    });
    allFbs.push(fb);
    m.reviewed = true; // 标记为已整理，避免重复生成
    autoCreatedCount++;
  });
  if (autoCreatedCount > 0) {
    DB.saveFeedbacks(allFbs);
    // 写回已更新的 markers（reviewed=true）
    const updatedLessons = DB.lessons().map(l => l.id === lesson.id ? { ...l, audioMarkers: lesson.audioMarkers } : l);
    DB.saveLessons(updatedLessons);
  }

  // 新增课程时触发事件（Phase 1 起供 feedback 模块监听）
  if (!lessonId) {
    Events.emit('lesson:created', { lessonId: lesson.id, date, autoCreated: autoCreatedCount });
  }
  if (autoCreatedCount > 0) {
    Utils.showToast('🎙 自动整理出 ' + autoCreatedCount + ' 条老师反馈，明日练琴时可见', 'success');
  }

  // 同步更新曲库状态：本课程中出现的曲目，若为 untouched 自动升为 learning
  pieces.forEach(p => {
    if (p.repId) {
      const repPiece = RepertoireManager.findById(p.repId);
      if (repPiece && repPiece.status === 'untouched') {
        RepertoireManager.updateStatus(p.repId, 'learning');
      }
    }
  });

  closeModal();
  renderAll();
  Utils.showToast('✅ 课程已保存', 'success');

  // 课后整理：弹出课程小结
  showLessonSummary(lesson);
};

/**
 * 级联删除课程关联的媒体数据（课堂录音、曲谱照片、家长语音）+ 关联反馈
 * @param {Lesson} lesson 课程对象
 * @returns {Promise<void>}
 */
async function cleanupLessonMedia(lesson) {
  if (!lesson || typeof StorageAdapter === 'undefined') return;

  // 1. 收集课堂录音 blob（多段 + 旧单段字段）
  const blobIds = new Set();
  (lesson.lessonAudios || []).forEach(s => { if (s && s.id) blobIds.add(s.id); });
  if (lesson.lessonAudioId) blobIds.add(lesson.lessonAudioId);

  // 2. 收集本课程所有反馈的曲谱照片 / 家长语音 blob
  const fbs = Feedback.byLesson(lesson.id);
  const fbIds = new Set(fbs.map(f => f.id));
  fbs.forEach(f => {
    if (f.parentVoiceId) blobIds.add(f.parentVoiceId);
    if (f.sheetPhotoId) blobIds.add(f.sheetPhotoId);
  });

  // 3. 删除本课程的反馈
  if (fbs.length) {
    DB.saveFeedbacks(DB.feedbacks().filter(f => !fbIds.has(f.id)));
  }

  // 4. 曲谱照片可能被其它反馈共享，仅在无任何剩余引用时才删
  const referenced = new Set();
  DB.feedbacks().forEach(f => {
    if (f.sheetPhotoId) referenced.add(f.sheetPhotoId);
    if (f.parentVoiceId) referenced.add(f.parentVoiceId);
  });

  for (const id of blobIds) {
    if (!referenced.has(id)) {
      try { await StorageAdapter.remove(id); } catch (e) { /* ignore */ }
    }
  }
}

/**
 * 删除课程（带二次确认 + 级联删除关联媒体）
 * @param {string} lessonId 课程 ID
 * @returns {void}
 */
window.deleteLesson = function(lessonId) {
  if (!confirm('确定要删除这条课程记录吗？\n\n将同时删除关联的课堂录音、曲谱照片和反馈。\n此操作不可恢复！')) return;

  const lesson = DB.lessons().find(l => l.id === lessonId);
  const lessons = DB.lessons().filter(l => l.id !== lessonId);
  DB.saveLessons(lessons);

  cleanupLessonMedia(lesson).then(function() {
    closeModal();
    renderAll();
    Utils.showToast('✅ 课程已删除（含关联录音/照片/反馈）', 'success');
  });
};

console.log('✅ Lessons module (book-grouped version) loaded');

/* ==========================================
   📋 课后整理：课程小结
   ========================================== */

/**
 * 保存课程后弹出课程小结，自动整理本节课的曲目和练习要点
 * @param {Lesson} lesson
 */
function showLessonSummary(lesson) {
  var pieces = lesson.pieces || [];
  var feedbacks = Feedback.byLesson(lesson.id);

  // 按册分组曲目
  var bookGroups = {};
  pieces.forEach(function(p) {
    var bookNum = p.book || 1;
    if (!bookGroups[bookNum]) bookGroups[bookNum] = [];
    bookGroups[bookNum].push(p);
  });

  // 生成曲目列表 HTML
  var piecesHtml = '';
  Object.keys(bookGroups).sort(function(a, b) { return a - b; }).forEach(function(bookNum) {
    var bookName = RepertoireManager.getBookDisplayName(Number(bookNum));
    piecesHtml += '<div style="margin-bottom:8px;font-size:0.8rem;color:var(--text-3);font-weight:600">📖 ' + Utils.escape(bookName) + '</div>';
    bookGroups[bookNum].forEach(function(p) {
      var stars = (p.score || '').length;
      var starStr = stars ? '⭐'.repeat(stars) : '未评分';
      var details = p.details ? '<div style="font-size:0.72rem;color:var(--text-3);margin-top:2px">📝 ' + Utils.escape(p.details) + '</div>' : '';
      piecesHtml += '<div style="padding:8px 12px;margin-bottom:4px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:2px solid var(--accent-primary)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-weight:600;font-size:0.85rem;color:var(--text-1)">' + Utils.escape(p.name) + '</span>' +
          '<span style="font-size:0.7rem;color:var(--accent-yellow)">' + starStr + '</span>' +
        '</div>' +
        details +
        '</div>';
    });
  });

  // 反馈摘要
  var fbHtml = '';
  if (feedbacks.length) {
    var statusMap = { 'new': '🔵 待练习', 'resolved': '✅ 已完成' };
    fbHtml = '<div style="margin-top:12px;border-top:1px dashed var(--border-2);padding-top:8px">' +
      '<div style="font-size:0.75rem;color:var(--text-3);margin-bottom:6px">📌 课堂反馈（' + feedbacks.length + ' 条）</div>';
    feedbacks.forEach(function(f) {
      var s = statusMap[f.status] || statusMap['new'];
      var note = f.teacherNote || f.locationLabel || '';
      fbHtml += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.75rem">' +
        '<span>' + s + '</span>' +
        '<span style="color:var(--text-2)">' + Utils.escape(note).slice(0, 40) + (note.length > 40 ? '...' : '') + '</span>' +
        '</div>';
    });
    fbHtml += '</div>';
  }

  // 练习重点关键词提取
  var focusTags = {};
  pieces.forEach(function(p) {
    if (p.focusAreas) {
      p.focusAreas.forEach(function(tag) {
        focusTags[tag] = (focusTags[tag] || 0) + 1;
      });
    }
  });
  var focusTagsHtml = '';
  var tagKeys = Object.keys(focusTags);
  if (tagKeys.length) {
    focusTagsHtml = '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">' +
      tagKeys.map(function(tag) {
        return '<span style="font-size:0.65rem;padding:2px 8px;border-radius:10px;background:rgba(94,106,210,0.15);color:#a5ade8">' + Utils.escape(tag) + '</span>';
      }).join('') +
      '</div>';
  }

  var modal = document.getElementById('modalContainer');
  modal.innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" style="max-width:420px">' +
      '<div class="modal-header">' +
        '<h2 class="modal-title">📋 课程小结</h2>' +
        '<button class="modal-close" onclick="closeModal()">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div style="padding:12px;background:rgba(94,106,210,0.08);border-radius:10px;margin-bottom:12px">' +
          '<div style="display:flex;justify-content:space-between;font-size:0.8rem">' +
            '<span style="color:var(--text-3)">📅 ' + Utils.formatDate(lesson.date) + '</span>' +
            '<span style="color:var(--text-3)">🎵 ' + pieces.length + ' 首曲目</span>' +
          '</div>' +
          (lesson.notes ? '<div style="margin-top:6px;font-size:0.78rem;color:var(--text-2)">💬 ' + Utils.escape(lesson.notes) + '</div>' : '') +
        '</div>' +

        '<div style="margin-bottom:12px">' +
          '<div style="font-size:0.8rem;color:var(--text-2);font-weight:600;margin-bottom:8px">🎼 本节课曲目</div>' +
          piecesHtml +
        '</div>' +

        focusTagsHtml +
        fbHtml +

        '<div style="margin-top:16px;padding:12px;background:rgba(142,212,166,0.08);border-radius:10px;border:1px solid rgba(142,212,166,0.2)">' +
          '<div style="font-size:0.75rem;color:var(--accent-green);font-weight:600;margin-bottom:4px">💡 练习建议</div>' +
          '<div style="font-size:0.72rem;color:var(--text-2);line-height:1.6">' +
            '复习今日曲目时，重点关注上方标注的练习要点。' +
            (feedbacks.length ? '课堂反馈中的问题已加入「今日」页面的练习提醒。' : '可以在「今日」页面查看每首曲子的老师要求。') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-primary" onclick="closeModal();renderAll()" style="width:100%">✅ 确认</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}