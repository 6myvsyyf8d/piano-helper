/* ==========================================
   🎵 曲库页面
   ========================================== */

"use strict";


let repertoireState = {
  expandedBooks: { 1: false, 2: false },
  expandedPieces: {}
};

/* ------------------------------------------
   页面渲染
   ------------------------------------------ */
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
      title: (function() {
        if (bn <= 2) return '铃木钢琴第' + ['', '一', '二'][bn] + '册';
        const meta = DB.bookMeta();
        return meta[bn] || ('自定义曲库 第' + bn + '册');
      })(),
      subtitle: 'Vol.' + bn + ' · ' + pieces.length + '曲 · 已学' + learned + '首',
      pieces
    };
  });
  
  const booksHtml = books.map(book => {
    const total = book.pieces.length;
    const learned = book.pieces.filter(p => p.status === 'learned').length;
    const learning = book.pieces.filter(p => p.status === 'learning').length;
    const progress = Math.round((learned / total) * 100);
    
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
              <div class="font-bold">${piece.num}. ${Utils.escape(piece.en)}</div>
              <div class="text-xs text-3">${Utils.escape(piece.name)} · ${Utils.escape(piece.composer)}</div>
            </span>
            <span class="flex-row gap-4" onclick="event.stopPropagation()">
              ${statusBtn}
              ${memBtn}
            </span>
          </div>
          
          ${isCardExpanded && (piece.status === 'learned' || piece.status === 'learning') ? `
            <div class="text-xs text-2 mt-8" style="padding-top:8px;border-top:1px solid var(--border-2)">
              ${piece.startedDate ? `📅 开始：${Utils.formatDate(piece.startedDate)}` : ''}
              ${piece.completedDate ? ` · ✅ 完成：${Utils.formatDate(piece.completedDate)}` : ''}
              ${piece.totalMinutes ? ` · ⏱ ${piece.totalMinutes}分钟` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <div class="card mb-16">
        <div class="flex-between" onclick="toggleRepertoireBook(${book.num})" style="cursor:pointer">
          <span style="flex:1">
            <div class="font-bold text-lg">📖 ${book.title}</div>
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
   交互函数
   ------------------------------------------ */

// 展开/收起书籍
window.toggleRepertoireBook = function(bookNum) {
  repertoireState.expandedBooks[bookNum] = !repertoireState.expandedBooks[bookNum];
  renderRepertoire();
};

// 展开/收起曲目详情
window.toggleRepCard = function(pieceId) {
  repertoireState.expandedPieces[pieceId] = !repertoireState.expandedPieces[pieceId];
  renderRepertoire();
};

// 循环切换曲目状态：未学 → 学习中 → 已学会 → 未学
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

// 切换背谱状态
window.toggleRepMemorized = function(pieceId) {
  const newState = RepertoireManager.toggleMemorized(pieceId);
  Utils.showToast(newState ? '🧠 可以背谱了！' : '📖 还需要看谱', 'success');
  renderRepertoire();
};

// 曲库编辑器
window.showRepertoireEditor = function() {
  const repertoire = DB.repertoire();
  const books = RepertoireManager.getBookList();
  const modal = document.getElementById('modalContainer');

  // 按册生成曲目列表
  const bookTables = books.map(bn => {
    const pieces = repertoire.filter(p => p.book === bn).sort((a, b) => a.num - b.num);
    const rows = pieces.map(p => `
      <tr>
        <td style="width:40px;text-align:center">${p.num}</td>
        <td>${Utils.escape(p.name)}</td>
        <td style="color:var(--text-2);font-size:0.8rem">${Utils.escape(p.en)}</td>
        <td style="color:var(--text-3);font-size:0.75rem">${Utils.escape(p.composer)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-secondary" onclick="editRepPiece('${p.id}')" style="font-size:0.65rem;padding:3px 8px">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRepPiece('${p.id}')" style="font-size:0.65rem;padding:3px 8px">✕</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="mb-16">
        <div class="flex-between mb-8" style="padding:0 4px">
          <span class="font-bold text-sm">📖 Book ${bn}（${pieces.length}首）</span>
          <button class="btn btn-sm btn-primary" onclick="addRepPiece(${bn})" style="font-size:0.7rem;padding:4px 10px">＋ 添加曲目</button>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="color:var(--text-3);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.05em">
              <th style="width:40px;padding:6px 4px;text-align:center">#</th>
              <th style="padding:6px 4px;text-align:left">中文名</th>
              <th style="padding:6px 4px;text-align:left">English</th>
              <th style="padding:6px 4px;text-align:left">作曲家</th>
              <th style="width:60px;padding:6px 4px"></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">🔧 编辑曲库</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:16px">
            <button class="btn btn-primary btn-sm" onclick="addRepBook()">📚 新建分册</button>
            <button class="btn btn-primary btn-sm" onclick="showRepImport()" style="margin-left:8px">📥 导入曲目</button>
            <span class="text-xs text-3" style="margin-left:8px">添加空白分册后可向其中添加曲目</span>
          </div>
          ${bookTables}
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="closeModal();renderRepertoire();" style="width:100%">
            ✅ 完成编辑
          </button>
        </div>
      </div>
    </div>
  `;
};

// 编辑单首曲目
window.editRepPiece = function(pieceId) {
  const piece = RepertoireManager.findById(pieceId);
  if (!piece) return;
  const books = RepertoireManager.getBookList();
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">✏️ 编辑曲目</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">分册</label>
            <select class="form-input" id="repEditBook">
              ${books.map(b => '<option value="' + b + '"' + (b === piece.book ? ' selected' : '') + '>Book ' + b + '</option>').join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">编号</label>
            <input type="number" class="form-input" id="repEditNum" value="${piece.num}" min="1">
          </div>
          <div class="form-group">
            <label class="form-label">中文名</label>
            <input type="text" class="form-input" id="repEditName" value="${Utils.escape(piece.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">英文名</label>
            <input type="text" class="form-input" id="repEditEn" value="${Utils.escape(piece.en || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">日文名</label>
            <input type="text" class="form-input" id="repEditJp" value="${Utils.escape(piece.jp || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">作曲家</label>
            <input type="text" class="form-input" id="repEditComposer" value="${Utils.escape(piece.composer || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">难度 (1-5)</label>
            <input type="number" class="form-input" id="repEditDifficulty" value="${piece.difficulty || 1}" min="1" max="5">
          </div>
          <div class="flex-row gap-8">
            <button class="btn btn-primary" onclick="saveRepEdit('${pieceId}')" style="flex:1">💾 保存</button>
            <button class="btn btn-secondary" onclick="showRepertoireEditor()">取消</button>
          </div>
        </div>
      </div>
    </div>
  `;
};

// 保存曲目编辑
window.saveRepEdit = function(pieceId) {
  const updates = {
    book: parseInt(document.getElementById('repEditBook').value) || 1,
    num: parseInt(document.getElementById('repEditNum').value) || 1,
    name: document.getElementById('repEditName').value.trim(),
    en: document.getElementById('repEditEn').value.trim(),
    jp: document.getElementById('repEditJp').value.trim(),
    composer: document.getElementById('repEditComposer').value.trim(),
    difficulty: parseInt(document.getElementById('repEditDifficulty').value) || 1
  };
  if (!updates.name) { Utils.showToast('⚠️ 曲目名称不能为空', 'warning'); return; }
  RepertoireManager.updatePiece(pieceId, updates);
  Utils.showToast('✅ 曲目已更新', 'success');
  showRepertoireEditor();
};

// 删除曲目
window.deleteRepPiece = function(pieceId) {
  const piece = RepertoireManager.findById(pieceId);
  if (!piece) return;
  if (!confirm('确定删除「' + piece.name + '」吗？\n\n此操作不可恢复！')) return;
  RepertoireManager.removePiece(pieceId);
  RepertoireManager.renumberBook(piece.book);
  Utils.showToast('✅ 已删除', 'success');
  showRepertoireEditor();
};

// 添加曲目
window.addRepPiece = function(bookNum) {
  const nextNum = RepertoireManager.getNextNum(bookNum);
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">➕ 添加曲目（Book ${bookNum} #${nextNum}）</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">中文名 *</label>
            <input type="text" class="form-input" id="repAddName" placeholder="例如：G大调小步舞曲">
          </div>
          <div class="form-group">
            <label class="form-label">英文名</label>
            <input type="text" class="form-input" id="repAddEn" placeholder="例如：Minuet in G">
          </div>
          <div class="form-group">
            <label class="form-label">日文名</label>
            <input type="text" class="form-input" id="repAddJp" placeholder="例如：メヌエット">
          </div>
          <div class="form-group">
            <label class="form-label">作曲家</label>
            <input type="text" class="form-input" id="repAddComposer" placeholder="例如：J.S. Bach">
          </div>
          <div class="form-group">
            <label class="form-label">难度 (1-5)</label>
            <input type="number" class="form-input" id="repAddDifficulty" value="3" min="1" max="5">
          </div>
          <button class="btn btn-primary" onclick="saveNewRepPiece(${bookNum})" style="width:100%">💾 添加</button>
        </div>
      </div>
    </div>
  `;
};

// 保存新曲目
window.saveNewRepPiece = function(bookNum) {
  const name = document.getElementById('repAddName').value.trim();
  if (!name) { Utils.showToast('⚠️ 请输入曲目名称', 'warning'); return; }
  const pieceData = {
    book: bookNum,
    num: RepertoireManager.getNextNum(bookNum),
    name: name,
    en: document.getElementById('repAddEn').value.trim(),
    jp: document.getElementById('repAddJp').value.trim(),
    composer: document.getElementById('repAddComposer').value.trim(),
    difficulty: parseInt(document.getElementById('repAddDifficulty').value) || 1,
    duration: 1
  };
  RepertoireManager.addPiece(pieceData);
  Utils.showToast('✅ 曲目已添加', 'success');
  showRepertoireEditor();
};

// 新建分册
window.addRepBook = function() {
  const books = RepertoireManager.getBookList();
  const newBook = (books[books.length - 1] || 0) + 1;
  const title = prompt('请输入曲库名称');
  if (!title || !title.trim()) return;
  const trimmedTitle = title.trim();
  // 保存自定义曲库名称
  const meta = DB.bookMeta();
  meta[newBook] = trimmedTitle;
  DB.saveBookMeta(meta);
  // 添加一首占位曲目，然后删除（让 book 编号生效）
  RepertoireManager.addPiece({
    book: newBook,
    num: 1,
    name: '待编辑曲目',
    en: '',
    jp: '',
    composer: '',
    difficulty: 1,
    duration: 1
  });
  Utils.showToast('✅ ' + trimmedTitle + ' 已创建', 'success');
  showRepertoireEditor();
};

// 导入曲目面板
window.showRepImport = function() {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="max-width:640px">
        <div class="modal-header">
          <h2 class="modal-title">📥 导入曲目</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-sm text-2 mb-12">
            导入 JSON 文件或粘贴 JSON 文本。每条记录需至少包含 <code>name</code> 字段。
          </p>

          <div class="form-group">
            <label class="form-label">选择 JSON 文件</label>
            <input type="file" class="form-input" id="repImportFile" accept=".json"
                   style="padding:10px;cursor:pointer">
          </div>

          <div class="form-group">
            <label class="form-label">或粘贴 JSON 文本</label>
            <textarea class="form-input" id="repImportJSON"
                      placeholder='[
  {"book": 3, "num": 1, "name": "练习曲", "en": "Etude", "composer": "车尔尼", "difficulty": 2},
  {"book": 3, "num": 2, "name": "小步舞曲", "en": "Minuet", "composer": "巴赫", "difficulty": 1}
]'
                      style="min-height:160px;font-family:monospace;font-size:0.75rem"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">默认分册 (当条目未指定 book 时使用)</label>
            <input type="number" class="form-input" id="repImportDefaultBook" value="1" min="1" style="max-width:120px">
          </div>

          <div id="repImportPreview" class="p-12 mb-12" style="background:var(--bg-2);border-radius:var(--r-md);display:none">
            <span class="text-sm font-bold" id="repImportPreviewText"></span>
          </div>

          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" id="btnRepImportPreview" style="flex:1">👁️ 预览</button>
            <button class="btn btn-primary" id="btnRepImportDo" style="flex:1">📥 确认导入</button>
          </div>

          <button class="btn btn-secondary mt-8" onclick="showRepertoireEditor()" style="width:100%">← 返回编辑曲库</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnRepImportPreview').addEventListener('click', handleRepImportPreview);
  document.getElementById('btnRepImportDo').addEventListener('click', handleRepImportDo);
};

// 预览导入：解析 JSON 并显示将添加的曲目数
window.handleRepImportPreview = function() {
  const entries = parseRepImportJSON();
  if (!entries) return;

  const existingIds = new Set(DB.repertoire().map(p => p.id));
  const { toAdd, toSkip } = analyzeRepImport(entries, existingIds);

  const previewEl = document.getElementById('repImportPreview');
  previewEl.style.display = 'block';
  document.getElementById('repImportPreviewText').innerHTML =
    '📊 预览：共 ' + entries.length + ' 条 · <span style="color:var(--accent-green)">新增 ' + toAdd.length + ' 首</span>' +
    (toSkip.length ? ' · <span style="color:var(--accent-yellow)">跳过重复 ' + toSkip.length + ' 首</span>' : '') +
    (toAdd.length ? '<br><span class="text-xs text-3">' + toAdd.map(e => 'Book ' + e.book + ' #' + e.num + ' ' + e.name).join(', ') + '</span>' : '');
};

// 确认导入
window.handleRepImportDo = function() {
  const fileInput = document.getElementById('repImportFile');
  if (fileInput.files.length > 0) {
    handleRepImportFile();
    return;
  }

  const entries = parseRepImportJSON();
  if (!entries) return;

  const existingIds = new Set(DB.repertoire().map(p => p.id));
  const { toAdd, toSkip } = analyzeRepImport(entries, existingIds);

  if (!toAdd.length) {
    Utils.showToast('⚠️ 没有新曲目可导入（全部重复）', 'warning');
    return;
  }

  for (const pieceData of toAdd) {
    RepertoireManager.addPiece(pieceData);
  }

  Utils.showToast('✅ 成功导入 ' + toAdd.length + ' 首曲目' + (toSkip.length ? '，跳过 ' + toSkip.length + ' 首重复' : ''), 'success');
  showRepertoireEditor();
};

// 解析 JSON 输入（从 textarea）
function parseRepImportJSON() {
  const jsonTextarea = document.getElementById('repImportJSON');
  const defaultBook = parseInt(document.getElementById('repImportDefaultBook').value) || 1;

  if (!jsonTextarea.value.trim()) {
    Utils.showToast('⚠️ 请粘贴 JSON 数据或选择文件', 'warning');
    return null;
  }

  return parseRepImportText(jsonTextarea.value.trim(), defaultBook);
}

// 分析导入数据：哪些新增、哪些跳过
function analyzeRepImport(entries, existingIds) {
  const toAdd = [];
  const toSkip = [];

  for (const entry of entries) {
    const id = 's' + entry.book + '-' + String(entry.num).padStart(2, '0');
    if (existingIds.has(id)) {
      toSkip.push(entry);
    } else {
      toAdd.push(entry);
      existingIds.add(id);
    }
  }

  return { toAdd, toSkip };
}

// 异步读取文件并处理导入
window.handleRepImportFile = async function() {
  const fileInput = document.getElementById('repImportFile');
  if (fileInput.files.length === 0) {
    Utils.showToast('⚠️ 请先选择文件', 'warning');
    return;
  }

  try {
    const file = fileInput.files[0];
    const text = await file.text();
    const defaultBook = parseInt(document.getElementById('repImportDefaultBook').value) || 1;
    const entries = parseRepImportText(text, defaultBook);
    if (!entries) return;

    const existingIds = new Set(DB.repertoire().map(p => p.id));
    const { toAdd, toSkip } = analyzeRepImport(entries, existingIds);

    if (!toAdd.length) {
      Utils.showToast('⚠️ 没有新曲目可导入（全部重复）', 'warning');
      return;
    }

    if (!confirm('将从文件中导入 ' + toAdd.length + ' 首曲目' + (toSkip.length ? '（跳过 ' + toSkip.length + ' 首重复）' : '') + '，确定继续？')) return;

    for (const pieceData of toAdd) {
      RepertoireManager.addPiece(pieceData);
    }

    Utils.showToast('✅ 成功导入 ' + toAdd.length + ' 首曲目' + (toSkip.length ? '，跳过 ' + toSkip.length + ' 首重复' : ''), 'success');
    showRepertoireEditor();
  } catch (e) {
    Utils.showToast('❌ 文件读取失败：' + e.message, 'error');
  }
};

// 从文本解析 JSON（不依赖 textarea DOM）
function parseRepImportText(text, defaultBook) {
  defaultBook = defaultBook || 1;

  try {
    let data = JSON.parse(text);
    if (!Array.isArray(data)) {
      if (data.repertoire && Array.isArray(data.repertoire)) {
        data = data.repertoire;
      } else {
        Utils.showToast('❌ JSON 格式不正确：需要数组', 'error');
        return null;
      }
    }

    return data.map((item, idx) => {
      if (!item.name && !item.en) {
        throw new Error('第 ' + (idx + 1) + ' 条缺少 name 字段');
      }
      return {
        book: item.book || defaultBook,
        num: item.num || (RepertoireManager.getNextNum(item.book || defaultBook) + idx),
        name: item.name || item.en,
        en: item.en || '',
        jp: item.jp || '',
        composer: item.composer || '',
        difficulty: item.difficulty || 1,
        duration: item.duration || 1
      };
    });
  } catch (e) {
    Utils.showToast('❌ 文件内容解析失败：' + e.message, 'error');
    return null;
  }
}

console.log('✅ Lessons, Calendar, Repertoire modules loaded');

/* ------------------------------------------
   同步面板
   ------------------------------------------ */
window.showSyncPanel = function() {
  const storageInfo = DB.getStorageInfo();

  // Generate sync code
  const syncCode = SyncCode.generateCode();
  const codeDisplay = syncCode.slice(0, 40) + '…';

  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">🔄 数据同步</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>

        <div class="modal-body">
          <h3 class="font-bold mb-8">📤 生成同步码</h3>
          <p class="text-xs text-2 mb-8">复制下方同步码，发送到另一台设备粘贴即可同步</p>
          <textarea class="form-input" id="syncCodeOutput" readonly
                    style="min-height:100px;font-family:monospace;font-size:0.7rem;word-break:break-all;resize:none"
                    onclick="this.select()">${syncCode}</textarea>
          <div class="flex-row gap-8 mb-16">
            <button class="btn btn-primary btn-sm" onclick="copySyncCode()" style="flex:1">📋 复制同步码</button>
          </div>
          <p class="text-xs text-3">包含：${DB.lessons().length} 条课程 · ${DB.logs().length} 条练习 · ${DB.repertoire().length} 首曲目</p>

          <hr style="border:none;border-top:1px solid var(--border-1);margin:20px 0">

          <h3 class="font-bold mb-8">📥 粘贴同步码</h3>
          <p class="text-xs text-2 mb-8">从另一台设备复制同步码，粘贴到下方并导入</p>
          <textarea class="form-input" id="syncCodeInput"
                    placeholder="在此粘贴同步码…"
                    style="min-height:80px;font-family:monospace;font-size:0.7rem;word-break:break-all;resize:none"></textarea>
          <div class="flex-row gap-8 mb-16">
            <button class="btn btn-success btn-sm" id="btnImportSync" style="flex:1">📥 导入同步码</button>
          </div>

          <hr style="border:none;border-top:1px solid var(--border-1);margin:20px 0">

          <!-- 数据管理 -->
          <h3 class="font-bold mb-8">📦 数据管理</h3>

          <div class="p-12 mb-8" style="background:rgba(255,255,255,0.04);border-radius:var(--r-md);border:1px solid var(--border-1)">
            <div class="flex-between mb-4">
              <span class="text-sm">本地存储使用</span>
              <span class="font-bold text-sm">${storageInfo.usedKB} KB</span>
            </div>
            <div class="flex-between">
              <span class="text-sm">课程记录</span>
              <span class="text-sm text-2">${DB.lessons().length} 条</span>
            </div>
            <div class="flex-between">
              <span class="text-sm">练习日志</span>
              <span class="text-sm text-2">${DB.logs().length} 条</span>
            </div>
          </div>

          <button class="btn btn-secondary btn-sm" onclick="exportDataAsJSON()" style="width:100%;margin-bottom:8px">
            📥 导出数据（JSON）
          </button>

          <button class="btn btn-secondary btn-sm" onclick="showImportPanel()" style="width:100%;margin-bottom:8px">
            📤 导入数据（JSON）
          </button>

          <hr style="border:none;border-top:1px solid var(--border-1);margin:20px 0">

          <div>
            <h3 class="font-bold mb-8" style="color:var(--accent-red)">⚠️ 危险操作</h3>
            <button class="btn btn-danger btn-sm" onclick="clearAllData()" style="width:100%">
              🗑 清空所有数据
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 导入同步码
  document.getElementById('btnImportSync').addEventListener('click', () => {
    const code = document.getElementById('syncCodeInput').value.trim();
    if (!code) { Utils.showToast('⚠️ 请粘贴同步码', 'warning'); return; }
    const result = SyncCode.importCode(code);
    if (result.success) {
      closeModal();
      renderAll();
      Utils.showToast('✅ 同步完成！' + result.stats.lessons + '课程 ' + result.stats.logs + '练习', 'success', 2500);
    } else {
      Utils.showToast('❌ ' + result.error, 'error');
    }
  });
};

// 复制同步码
window.copySyncCode = function() {
  const ta = document.getElementById('syncCodeOutput');
  if (!ta) return;
  ta.select();
  Utils.copyToClipboard(ta.value).then(ok => {
    Utils.showToast(ok ? '✅ 已复制到剪贴板' : '⚠️ 复制失败，请手动选择', ok ? 'success' : 'warning');
  });
};

/* ------------------------------------------
   同步按钮状态
   ------------------------------------------ */
function updateSyncButtonState() {
  const btn = document.getElementById('syncBtn');
  if (!btn) return;
  const icon = btn.querySelector('.sync-icon');
  const label = btn.querySelector('span:last-child');
  btn.classList.add('synced');
  if (icon) icon.textContent = '🔄';
  if (label) label.textContent = '同步';
}

/* ==========================================
   📥📤 数据导入导出
   ========================================== */

/* ------------------------------------------
   导出数据为 JSON
   ------------------------------------------ */
window.exportDataAsJSON = function() {
  const data = {
    lessons: DB.lessons(),
    logs: DB.logs(),
    repertoire: DB.repertoire(),
    config: DB.config(),
    exportDate: new Date().toISOString(),
    version: '3.2'
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `piano-data-${Utils.today()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  
  Utils.showToast('✅ 数据已导出', 'success');
};

/* ------------------------------------------
   显示导入面板
   ------------------------------------------ */
window.showImportPanel = function() {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">📤 导入数据</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">导入模式</label>
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm" id="importModeMerge" style="flex:1;background:var(--accent-green-soft);color:var(--accent-green);border:1px solid rgba(142,212,166,0.3)">🔄 合并模式（推荐）</button>
              <button class="btn btn-sm btn-secondary" id="importModeOverwrite" style="flex:1">⚠️ 覆盖模式</button>
            </div>
            <div class="text-xs text-3 mt-4" id="importModeDesc">合并：新数据合并入现有数据，同日记录替换，不丢失任何数据</div>
          </div>

          <div class="form-group">
            <label class="form-label">选择 JSON 文件</label>
            <input type="file" class="form-input" id="importFile" accept=".json"
                   style="padding:10px;cursor:pointer">
          </div>

          <div class="form-group">
            <label class="form-label">或粘贴 JSON 数据</label>
            <textarea class="form-input" id="importJSON"
                      placeholder='粘贴完整的 JSON 数据...'
                      style="min-height:120px;font-family:monospace;font-size:0.75rem"></textarea>
          </div>

          <div class="p-12" id="importWarningBox" style="background:rgba(142,212,166,0.1);border-radius:var(--r-md);border:1px solid var(--accent-green);margin-bottom:16px">
            <p class="text-xs" style="color:var(--accent-green);line-height:1.5">
              ✅ <strong>合并模式：</strong>现有数据不会被删除。<br>
              同日期的练习记录会替换，课程记录按 ID 去重合并。
            </p>
          </div>

          <button class="btn btn-primary" id="btnImport" style="width:100%">
            📥 确认导入
          </button>
        </div>
      </div>
    </div>
  `;

  let importMode = 'merge';

  document.getElementById('importModeMerge').addEventListener('click', function() {
    importMode = 'merge';
    this.style.background = 'var(--accent-green-soft)';
    this.style.color = 'var(--accent-green)';
    this.style.border = '1px solid rgba(142,212,166,0.3)';
    const ow = document.getElementById('importModeOverwrite');
    ow.style.background = 'var(--surface-1)';
    ow.style.color = 'var(--text-2)';
    ow.style.border = 'none';
    document.getElementById('importWarningBox').style.background = 'rgba(142,212,166,0.1)';
    document.getElementById('importWarningBox').style.border = '1px solid var(--accent-green)';
    document.getElementById('importWarningBox').querySelector('p').style.color = 'var(--accent-green)';
    document.getElementById('importWarningBox').querySelector('p').innerHTML = '✅ <strong>合并模式：</strong>现有数据不会被删除。<br>同日期的练习记录会替换，课程记录按 ID 去重合并。';
    document.getElementById('importModeDesc').textContent = '合并：新数据合并入现有数据，同日记录替换，不丢失任何数据';
  });

  document.getElementById('importModeOverwrite').addEventListener('click', function() {
    importMode = 'overwrite';
    this.style.background = 'rgba(255,107,107,0.15)';
    this.style.color = 'var(--accent-red)';
    this.style.border = '1px solid var(--accent-red)';
    const mg = document.getElementById('importModeMerge');
    mg.style.background = 'var(--surface-1)';
    mg.style.color = 'var(--text-2)';
    mg.style.border = 'none';
    document.getElementById('importWarningBox').style.background = 'rgba(255,107,107,0.1)';
    document.getElementById('importWarningBox').style.border = '1px solid var(--accent-red)';
    document.getElementById('importWarningBox').querySelector('p').style.color = 'var(--accent-red)';
    document.getElementById('importWarningBox').querySelector('p').innerHTML = '⚠️ <strong>覆盖模式：</strong>会完全替换现有数据！<br>建议先导出备份再进行此操作。';
    document.getElementById('importModeDesc').textContent = '覆盖：完全替换现有数据，慎用';
  });

  document.getElementById('btnImport').addEventListener('click', () => handleImport(importMode));
};

/* ------------------------------------------
   处理数据导入
   ------------------------------------------ */
async function handleImport(mode) {
  const fileInput = document.getElementById('importFile');
  const jsonTextarea = document.getElementById('importJSON');

  let jsonData = '';

  // 优先使用文件
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    jsonData = await file.text();
  } else if (jsonTextarea.value.trim()) {
    jsonData = jsonTextarea.value.trim();
  } else {
    Utils.showToast('⚠️ 请选择文件或粘贴数据', 'warning');
    return;
  }

  try {
    const data = JSON.parse(jsonData);

    // 兼容旧版数据格式（piano_lessons / piano_logs 前缀）
    const newLessons = data.lessons || data.piano_lessons || [];
    const newLogs = data.logs || data.piano_logs || [];
    const newRep = data.repertoire || data.piano_repertoire || [];
    const newConfig = data.config || data.piano_config || {};

    if (!newLessons.length && !newLogs.length && !newRep.length) {
      Utils.showToast('❌ 数据格式不正确，未找到课程/练习/曲库数据', 'error');
      return;
    }

    if (mode === 'merge') {
      // ── 合并模式 ──
      const existingLessons = DB.lessons();
      const existingLogs = DB.logs();
      const existingRep = DB.repertoire();

      // 合并课程：按 ID 去重，新数据优先
      const lessonMap = {};
      existingLessons.forEach(l => { lessonMap[l.id] = l; });
      newLessons.forEach(l => { lessonMap[l.id] = l; });
      const mergedLessons = Object.values(lessonMap).sort((a, b) => b.date.localeCompare(a.date));

      // 合并练习日志：按日期去重，新数据优先
      const logMap = {};
      existingLogs.forEach(l => { logMap[l.date] = l; });
      newLogs.forEach(l => { logMap[l.date] = l; });
      const mergedLogs = Object.values(logMap).sort((a, b) => b.date.localeCompare(a.date));

      // 合并曲库：按 ID 去重，新数据优先
      const repMap = {};
      existingRep.forEach(p => { repMap[p.id] = p; });
      newRep.forEach(p => { repMap[p.id] = p; });
      const mergedRep = Object.values(repMap);

      // 合并配置
      const mergedConfig = { ...DB.config(), ...newConfig };

      const addedLessons = newLessons.filter(l => !existingLessons.some(el => el.id === l.id)).length;
      const updatedLessons = newLessons.filter(l => existingLessons.some(el => el.id === l.id)).length;
      const addedLogs = newLogs.filter(l => !existingLogs.some(el => el.date === l.date)).length;
      const updatedLogs = newLogs.filter(l => existingLogs.some(el => el.date === l.date)).length;

      // 确认
      const msg = `确认合并导入？\n\n` +
        `课程：新增 ${addedLessons} 条，更新 ${updatedLessons} 条\n` +
        `练习：新增 ${addedLogs} 天，更新 ${updatedLogs} 天\n` +
        `曲库：共 ${mergedRep.length} 首`;
      if (!confirm(msg)) return;

      DB.saveLessons(mergedLessons);
      DB.saveLogs(mergedLogs);
      DB.saveRepertoire(mergedRep);
      DB.saveConfig(mergedConfig);

      closeModal();
      renderAll();
      Utils.showToast(`✅ 合并成功！课程 +${addedLessons}，练习 +${addedLogs}天`, 'success', 3000);
    } else {
      // ── 覆盖模式 ──
      if (!confirm('确定要覆盖现有数据吗？\n\n这将完全替换当前数据，建议先导出备份。')) return;

      if (newLessons.length) DB.saveLessons(newLessons);
      if (newLogs.length) DB.saveLogs(newLogs);
      if (newRep.length) DB.saveRepertoire(newRep);
      if (Object.keys(newConfig).length) DB.saveConfig(newConfig);

      closeModal();
      renderAll();
      Utils.showToast(`✅ 覆盖导入成功！课程 ${newLessons.length} 条，练习 ${newLogs.length} 天`, 'success', 3000);
    }
  } catch (error) {
    console.error('Import error:', error);
    Utils.showToast('❌ 数据解析失败：' + error.message, 'error');
  }
}

/* ------------------------------------------
   清空所有数据
   ------------------------------------------ */
window.clearAllData = function() {
  const confirmed = confirm(
    '⚠️ 危险操作！\n\n' +
    '确定要清空所有数据吗？\n\n' +
    '这将删除：\n' +
    `- ${DB.lessons().length} 条课程记录\n` +
    `- ${DB.logs().length} 条练习日志\n` +
    '- 所有曲库学习进度\n' +
    '- 同步配置\n\n' +
    '此操作不可恢复！'
  );
  
  if (!confirmed) return;
  
  const doubleConfirm = prompt('请输入 "DELETE" 确认删除：');
  if (doubleConfirm !== 'DELETE') {
    Utils.showToast('❌ 取消删除', 'info');
    return;
  }
  
  // 清空所有数据
  DB.saveLessons([]);
  DB.saveLogs([]);
  DB.saveConfig({});
  localStorage.removeItem('piano_logo');
  localStorage.removeItem('piano_rep_version');
  
  // 重新初始化曲库
  RepertoireManager.init();
  
  closeModal();
  renderAll();
  
  Utils.showToast('✅ 所有数据已清空', 'success');
};

