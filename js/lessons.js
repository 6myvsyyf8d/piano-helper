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

  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
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

            <div class="form-group">
              <div id="lessonBookCardsContainer">
                ${bookCardsHtml || '<p class="text-xs text-3 text-center p-12" id="lessonEmptyHint">还没有添加曲目，点击下方按钮添加</p>'}
              </div>
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

    // 老数据兼容：从 repId 反推（如 "s2-01" → 2）
    if (!bookNum && piece.repId) {
      const m = piece.repId.match(/^s(\d+)-/);
      if (m) bookNum = parseInt(m[1]);
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
  const isDeleted = !allBooks.includes(bookNum);
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

  // 添加曲目按钮（已删除册不允许加新曲目）
  const addPieceBtn = isDeleted
    ? ''
    : `<button type="button" class="btn btn-sm btn-secondary" onclick="addLessonPiece(${bookNum})" style="font-size:0.7rem;padding:4px 10px;width:100%;margin-top:6px">＋ 添加这册的曲目</button>`;

  return `
    <div class="lesson-book-card mb-12" data-book-num="${bookNum}" style="${cardStyle};padding:12px;border-radius:8px">
      <div class="flex-between mb-8">
        <span class="font-bold text-sm">📖 ${Utils.escape(displayName)}${deletedBadge}</span>
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
  const focusOptions = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏'];
  const scoreStars = (piece.score || '').length;
  const pieceFocusAreas = piece.focusAreas || [];

  // 曲目选择器：用 SuzukiSelectHelper 的 piece-select（基于 bookNum）
  // 已删除册不让选，显示纯文本
  const nameField = isDeleted
    ? `<input class="form-input piece-name-input" value="${Utils.escape(piece.name || '')}" disabled style="padding:8px 10px;font-size:0.85rem;opacity:0.7">`
    : SuzukiSelectHelper.buildPieceSelect(bookNum, 'book' + bookNum, idx, piece.repId, piece.name);

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
        <label class="form-label" style="font-size:0.7rem;margin-bottom:4px">🏷 本曲练习重点</label>
        <div class="tag-row piece-focus-tags" data-piece-idx="${idx}" data-book="${bookNum}">
          ${focusOptions.map(tag => {
            const sel = pieceFocusAreas.includes(tag);
            return `<span class="tag${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')">${tag}</span>`;
          }).join('')}
        </div>
        <input type="text" class="form-input mt-4 piece-focus-custom" placeholder="自定义重点..." value="${Utils.escape((pieceFocusAreas.filter(t => !focusOptions.includes(t))).join('、'))}" style="font-size:0.75rem;padding:6px 8px">
      </div>

      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label" style="font-size:0.7rem;margin-bottom:4px">📝 老师要求</label>
        <textarea class="form-input piece-details" placeholder="例如：注意手型、节奏要稳..." style="min-height:60px;font-size:0.8rem">${Utils.escape(piece.details || '')}</textarea>
      </div>

      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" style="font-size:0.7rem;margin-bottom:4px">⭐ 回课评分</label>
        <div class="star-rating" data-piece-idx="${idx}" data-book="${bookNum}">
          ${[1,2,3,4,5].map(s => `
            <button type="button" class="star-btn${s <= scoreStars ? ' active' : ''}" data-star="${s}" onclick="setLessonPieceStar(${bookNum}, ${idx}, ${s})">⭐</button>
          `).join('')}
        </div>
      </div>

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

  if (!allBooks.length) {
    Utils.showToast('⚠️ 请先在「曲库」页面添加分册', 'warning');
    return;
  }

  // 找出当前已添加的 book，避免重复
  const existingBooks = new Set();
  document.querySelectorAll('.lesson-book-card').forEach(card => {
    existingBooks.add(parseInt(card.dataset.bookNum));
  });

  // 可选的册（去掉已添加的）
  const availableBooks = allBooks.filter(b => !existingBooks.has(b));

  if (!availableBooks.length) {
    Utils.showToast('ℹ️ 曲库的所有册都已添加', 'info');
    return;
  }

  const modal = document.getElementById('modalContainer');

  // 保留当前模态框（不能 closeModal，否则丢失编辑中的数据）
  // 改用临时 picker 浮层
  const pickerHtml = `
    <div class="modal-overlay" id="lessonBookPicker" onclick="if(event.target===this)closeLessonBookPicker()" style="z-index:1100">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <h2 class="modal-title">📖 选择册</h2>
          <button class="modal-close" onclick="closeLessonBookPicker()">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-2 mb-12">从曲库中选择本次课要练的册：</p>
          ${availableBooks.map(bn => {
            const name = RepertoireManager.getBookDisplayName(bn);
            return `
              <button type="button" class="btn btn-secondary mb-8" onclick="addLessonBookCard(${bn})" style="width:100%;text-align:left;padding:12px">
                📖 ${Utils.escape(name)}
              </button>
            `;
          }).join('')}
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
  if (container.querySelector(`.lesson-book-card[data-book-num="${bookNum}"]`)) {
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
        name = nameSelect.value.trim();
        const selectedOption = nameSelect.options[nameSelect.selectedIndex];
        repId = selectedOption ? (selectedOption.dataset.repid || '') : '';
      } else if (nameInput) {
        // 已删除册的纯文本输入框（disabled），保留原值
        name = nameInput.value.trim();
        const repPiece = RepertoireManager.findByName(name);
        if (repPiece) repId = repPiece.id;
      }

      if (!name) return; // 跳过空曲目

      // 收集本曲练习重点
      const focusAreas = [];
      const focusTagsEl = pieceCard.querySelector('.piece-focus-tags');
      if (focusTagsEl) {
        focusTagsEl.querySelectorAll('.tag.selected').forEach(tag => {
          focusAreas.push(tag.textContent);
        });
      }
      const customFocus = pieceCard.querySelector('.piece-focus-custom');
      if (customFocus && customFocus.value.trim()) {
        customFocus.value.trim().split(/[、,，]/).forEach(t => {
          const tt = t.trim();
          if (tt) focusAreas.push(tt);
        });
      }

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

  // 构建课程对象
  const lesson = {
    id: lessonId || Utils.uid(),
    date,
    pieces,
    focusAreas: [],  // 保留向后兼容
    notes
  };

  // 保存到数据库
  let lessons = DB.lessons();
  if (lessonId) {
    lessons = lessons.map(l => l.id === lessonId ? lesson : l);
  } else {
    lessons.push(lesson);
  }
  DB.saveLessons(lessons);

  closeModal();
  renderAll();
  Utils.showToast('✅ 课程已保存', 'success');
};

/**
 * 删除课程（带二次确认）
 * @param {string} lessonId 课程 ID
 * @returns {void}
 */
window.deleteLesson = function(lessonId) {
  if (!confirm('确定要删除这条课程记录吗？\n\n此操作不可恢复！')) return;

  const lessons = DB.lessons().filter(l => l.id !== lessonId);
  DB.saveLessons(lessons);

  closeModal();
  renderAll();
  Utils.showToast('✅ 课程已删除', 'success');
};

console.log('✅ Lessons module (book-grouped version) loaded');