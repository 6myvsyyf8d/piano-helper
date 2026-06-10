/* ==========================================
   📒 课程记录页面
   ========================================== */

"use strict";


/* ------------------------------------------
   页面渲染
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
window.showLessonForm = function(lessonId) {
  const lesson = lessonId ? DB.lessons().find(l => l.id === lessonId) : null;
  const isEdit = !!lesson;
  const pieces = lesson ? lesson.pieces : [{ name: '', details: '', category: 'suzuki', score: '', focusAreas: [] }];

  const categoryLabels = { suzuki: '🎻 铃木', beyer: '🎼 拜厄', pieces: '🎵 小曲集' };
  const categoryOrder = ['suzuki', 'beyer', 'pieces'];
  const focusOptions = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏'];

  // 按分类分组
  const grouped = {};
  pieces.forEach((piece, i) => {
    const cat = piece.category || 'suzuki';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...piece, originalIndex: i });
  });

  // 生成单个曲目卡片 HTML
  function lessonPieceCardHTML(piece, idx, cat) {
    const repOptions = cat === 'suzuki'
      ? RepertoireManager.getByBook(1).concat(RepertoireManager.getByBook(2))
      : [];
    const scoreStars = (piece.score || '').length;
    const pieceFocusAreas = piece.focusAreas || [];

    // 从 repId 解析曲目所在 book（如 "s2-01" → 2），新曲目默认 Book 2
    let pieceBook = null;
    if (piece.repId) {
      var m = piece.repId.match(/^s(\d+)-/);
      if (m) pieceBook = parseInt(m[1]);
    }
    if (!pieceBook) pieceBook = 2;

    return `
      <div class="card mb-8" style="background:rgba(255,255,255,0.03);border-left:3px solid var(--accent-primary);padding:12px">
        <div class="flex-between mb-8">
          <span class="font-bold text-sm">#${idx + 1}</span>
          <button class="btn btn-sm btn-danger" onclick="removeLessonPiece(this)" style="font-size:0.65rem;padding:3px 8px">✕</button>
        </div>

        ${cat === 'suzuki' ? `
          <div class="form-group" style="margin-bottom:10px">
            ${SuzukiSelectHelper.buildBookSelect(pieceBook, cat, idx)}
            ${SuzukiSelectHelper.buildPieceSelect(pieceBook, cat, idx, piece.repId, piece.name)}
          </div>
        ` : `
          <div class="form-group" style="margin-bottom:10px">
            <input class="form-input piece-name-input" placeholder="曲目名称" value="${Utils.escape(piece.name || '')}" style="padding:10px 12px;font-size:0.85rem">
          </div>
        `}

        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label" style="font-size:0.75rem;margin-bottom:5px">🏷 本曲练习重点</label>
          <div class="tag-row piece-focus-tags" data-piece-idx="${idx}" data-cat="${cat}">
            ${focusOptions.map(tag => {
              const sel = pieceFocusAreas.includes(tag);
              return `<span class="tag${sel ? ' selected' : ''}" onclick="this.classList.toggle('selected')">${tag}</span>`;
            }).join('')}
          </div>
          <input type="text" class="form-input mt-4 piece-focus-custom" placeholder="自定义重点..." value="${Utils.escape((pieceFocusAreas.filter(t => !focusOptions.includes(t))).join('、'))}" style="font-size:0.8rem;padding:8px 10px">
        </div>

        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label" style="font-size:0.75rem;margin-bottom:5px">📝 老师要求</label>
          <textarea class="form-input piece-details" placeholder="例如：注意手型、节奏要稳..." style="min-height:90px;font-size:0.85rem">${Utils.escape(piece.details || '')}</textarea>
        </div>

        <div class="form-group" style="margin-bottom:4px">
          <label class="form-label" style="font-size:0.75rem;margin-bottom:5px">⭐ 回课评分</label>
          <div class="star-rating" data-piece-idx="${idx}" data-cat="${cat}">
            ${[1,2,3,4,5].map(s => `
              <button type="button" class="star-btn${s <= scoreStars ? ' active' : ''}" data-star="${s}" onclick="setLessonPieceStar('${cat}', ${idx}, ${s})">⭐</button>
            `).join('')}
          </div>
        </div>

        <input type="hidden" class="piece-category" value="${cat}">
        <input type="hidden" class="piece-repid" value="${piece.repId || ''}">
        <input type="hidden" class="piece-score" value="${piece.score || ''}">
      </div>
    `;
  }

  // 按分类生成折叠区块
  const categoryBlocks = categoryOrder.map(cat => {
    const categoryPieces = grouped[cat] || [];

    const pieceCards = categoryPieces.map((piece, idx) => lessonPieceCardHTML(piece, idx, cat)).join('');

    const hasPieces = categoryPieces.length > 0;
    return `
      <div class="practice-category mb-8${hasPieces ? ' open' : ''}" data-cat="lesson-${cat}">
        <div class="practice-category-header" onclick="toggleCategory('lesson-${cat}')" style="padding:10px 14px">
          <span class="font-bold text-sm">${categoryLabels[cat]}</span>
          <span class="cat-info">
            <span class="text-xs text-2">${categoryPieces.length}首</span>
            <button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation();addLessonPiece('${cat}')" style="font-size:0.65rem;padding:3px 8px;margin-left:6px">＋</button>
            <span class="cat-toggle-icon">▸</span>
          </span>
        </div>
        <div class="practice-category-body" data-cat-body="lesson-${cat}"${hasPieces ? '' : ' style="display:none"'}>
          ${pieceCards || '<p class="text-xs text-3 text-center p-8">暂无曲目</p>'}
        </div>
      </div>
    `;
  }).join('');

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
              <div id="lessonPiecesContainer">
                ${categoryBlocks}
              </div>
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
   课程表单交互
   ------------------------------------------ */

// 添加曲目
window.addLessonPiece = function(category) {
  const body = document.querySelector('.practice-category-body[data-cat-body="lesson-' + category + '"]');
  if (!body) return;

  // Count existing cards in this category body
  const existingCards = body.querySelectorAll('.card');
  const idx = existingCards.length;

  const repOptions = category === 'suzuki'
    ? RepertoireManager.getByBook(1).concat(RepertoireManager.getByBook(2))
    : [];
  const focusOptions = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏'];

  // Ensure body is visible
  body.style.display = 'block';
  const catEl = document.querySelector('.practice-category[data-cat="lesson-' + category + '"]');
  if (catEl) catEl.classList.add('open');

  // Remove "暂无曲目" placeholder
  const placeholder = body.querySelector('p');
  if (placeholder) placeholder.remove();

  const card = document.createElement('div');
  card.className = 'card mb-8';
  card.style.cssText = 'background:rgba(255,255,255,0.03);border-left:3px solid var(--accent-primary);padding:12px';

  card.innerHTML = `
    <div class="flex-between mb-8">
      <span class="font-bold text-sm">#${idx + 1}</span>
      <button class="btn btn-sm btn-danger" onclick="removeLessonPiece(this)" style="font-size:0.65rem;padding:3px 8px">✕</button>
    </div>
    ${category === 'suzuki' ? `
      <div class="form-group" style="margin-bottom:10px">
        ${SuzukiSelectHelper.buildBookSelect(null, category, idx)}
        ${SuzukiSelectHelper.buildPieceSelect(null, category, idx, '', '')}
      </div>
    ` : `
      <div class="form-group" style="margin-bottom:10px">
        <input class="form-input piece-name-input" placeholder="曲目名称" style="padding:10px 12px;font-size:0.85rem">
      </div>
    `}
    <div class="form-group" style="margin-bottom:10px">
      <label class="form-label" style="font-size:0.75rem;margin-bottom:5px">🏷 本曲练习重点</label>
      <div class="tag-row piece-focus-tags" data-piece-idx="${idx}" data-cat="${category}">
        ${focusOptions.map(tag => '<span class="tag" onclick="this.classList.toggle(\'selected\')">' + tag + '</span>').join('')}
      </div>
      <input type="text" class="form-input mt-4 piece-focus-custom" placeholder="自定义重点..." style="font-size:0.8rem;padding:8px 10px">
    </div>
    <div class="form-group" style="margin-bottom:10px">
      <label class="form-label" style="font-size:0.75rem;margin-bottom:5px">📝 老师要求</label>
      <textarea class="form-input piece-details" placeholder="例如：注意手型、节奏要稳..." style="min-height:90px;font-size:0.85rem"></textarea>
    </div>
    <div class="form-group" style="margin-bottom:4px">
      <label class="form-label" style="font-size:0.75rem;margin-bottom:5px">⭐ 回课评分</label>
      <div class="star-rating" data-piece-idx="${idx}" data-cat="${category}">
        ${[1,2,3,4,5].map(s => '<button type="button" class="star-btn" data-star="' + s + '" onclick="setLessonPieceStar(\'' + category + '\', ' + idx + ', ' + s + ')">⭐</button>').join('')}
      </div>
    </div>
    <input type="hidden" class="piece-category" value="${category}">
    <input type="hidden" class="piece-repid" value="">
    <input type="hidden" class="piece-score" value="">
  `;

  body.appendChild(card);

  // Update count in header
  const headerCount = catEl.querySelector('.text-xs.text-2');
  if (headerCount) headerCount.textContent = (idx + 1) + '首';
};

// 删除曲目
window.removeLessonPiece = function(btn) {
  if (!confirm('确定删除这首曲目吗？')) return;
  const card = btn.closest('.card');
  if (card) card.remove();
};

// 设置曲目星星评分
window.setLessonPieceStar = function(category, pieceIdx, star) {
  const container = document.querySelector(`.star-rating[data-cat="${category}"][data-piece-idx="${pieceIdx}"]`);
  if (!container) return;
  
  const card = container.closest('.card');
  const scoreInput = card.querySelector('.piece-score');
  const buttons = container.querySelectorAll('.star-btn');
  
  // 当前分数
  const currentScore = scoreInput.value.length;
  
  // 如果点击的是已选中的，则取消
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

// 保存课程
window.saveLesson = function(lessonId) {
  const date = document.getElementById('lessonDate').value;
  const notes = document.getElementById('lessonNotes').value.trim();
  
  if (!date) {
    Utils.showToast('⚠️ 请选择上课日期', 'warning');
    return;
  }
  
  const focusOptions = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏'];
  
  // 收集曲目
  const pieces = [];
  document.querySelectorAll('#lessonPiecesContainer .card').forEach(card => {
    const nameSelect = card.querySelector('.piece-name-select');
    const nameInput = card.querySelector('.piece-name-input');
    const details = card.querySelector('.piece-details').value.trim();
    const category = card.querySelector('.piece-category').value;
    const repIdInput = card.querySelector('.piece-repid');
    const scoreInput = card.querySelector('.piece-score');
    
    let name = '';
    let repId = '';
    
    if (nameSelect) {
      name = nameSelect.value.trim();
      // 两级选择器（suzuki 系列用 piece-select class）
      if (nameSelect.classList.contains('suzuki-piece-select')) {
        const selectedOption = nameSelect.options[nameSelect.selectedIndex];
        repId = selectedOption ? selectedOption.dataset.repid : '';
      } else {
        const selectedOption = nameSelect.options[nameSelect.selectedIndex];
        repId = selectedOption ? selectedOption.dataset.repid : '';
      }
    } else if (nameInput) {
      name = nameInput.value.trim();
      const repPiece = RepertoireManager.findByName(name);
      if (repPiece) repId = repPiece.id;
    }
    
    if (name) {
      // Collect per-piece focus areas
      const focusAreas = [];
      const focusTagsEl = card.querySelector('.piece-focus-tags');
      if (focusTagsEl) {
        focusTagsEl.querySelectorAll('.tag.selected').forEach(tag => {
          focusAreas.push(tag.textContent);
        });
      }
      const customFocus = card.querySelector('.piece-focus-custom');
      if (customFocus && customFocus.value.trim()) {
        customFocus.value.trim().split(/[、,，]/).forEach(t => {
          const tt = t.trim();
          if (tt) focusAreas.push(tt);
        });
      }
      
      pieces.push({
        name,
        details,
        category,
        repId: repId || repIdInput.value,
        score: scoreInput.value,
        focusAreas: focusAreas
      });
    }
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
  
  // 保存
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
  // sync now manual via sync code
};

// 删除课程
window.deleteLesson = function(lessonId) {
  if (!confirm('确定要删除这条课程记录吗？\n\n此操作不可恢复！')) return;
  
  const lessons = DB.lessons().filter(l => l.id !== lessonId);
  DB.saveLessons(lessons);
  
  closeModal();
  renderAll();
  
  Utils.showToast('✅ 课程已删除', 'success');
  // sync now manual via sync code
};

