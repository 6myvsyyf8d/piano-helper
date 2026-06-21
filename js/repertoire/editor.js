/*
 * 哆哩的钢琴助手 — Piano Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   🎵 曲库 - 编辑器（CRUD + 导入）
   ========================================== */
"use strict";

/**
 * 显示曲库编辑器（按册分组的曲目列表 + 操作按钮）
 * @returns {void}
 */
window.showRepertoireEditor = function() {
  const repertoire = DB.repertoire();
  const books = RepertoireManager.getBookList();
  const modal = document.getElementById('modalContainer');

  // 按册生成曲目列表
  const bookTables = books.map(bn => {
    const pieces = repertoire.filter(p => p.book === bn).sort((a, b) => a.num - b.num);
    // ✅ 统一使用 getBookDisplayName 显示册名
    const displayName = RepertoireManager.getBookDisplayName(bn);

    const rows = pieces.map(p => `
      <tr>
        <td style="width:40px;text-align:center">${p.num}</td>
        <td>${Utils.escape(p.name)}</td>
        <td style="color:var(--text-2);font-size:0.8rem">${Utils.escape(p.en || '')}</td>
        <td style="color:var(--text-3);font-size:0.75rem">${Utils.escape(p.composer || '')}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-secondary" onclick="editRepPiece('${p.id}')" style="font-size:0.65rem;padding:3px 8px">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRepPiece('${p.id}')" style="font-size:0.65rem;padding:3px 8px">✕</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="mb-16">
        <div class="flex-between mb-8" style="padding:0 4px">
          <span class="font-bold text-sm">📖 ${Utils.escape(displayName)}（${pieces.length}首）</span>
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

/**
 * 编辑单首曲目（弹出编辑表单）
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
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
              ${books.map(b => {
                const name = RepertoireManager.getBookDisplayName(b);
                return '<option value="' + b + '"' + (b === piece.book ? ' selected' : '') + '>' + Utils.escape(name) + '</option>';
              }).join('')}
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

/**
 * 保存曲目编辑
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
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

  if (!updates.name) {
    Utils.showToast('⚠️ 曲目名称不能为空', 'warning');
    return;
  }

  RepertoireManager.updatePiece(pieceId, updates);
  Utils.showToast('✅ 曲目已更新', 'success');
  showRepertoireEditor();
};

/**
 * 删除曲目（带二次确认）
 * @param {string} pieceId 曲目 ID
 * @returns {void}
 */
window.deleteRepPiece = function(pieceId) {
  const piece = RepertoireManager.findById(pieceId);
  if (!piece) return;

  if (!confirm('确定删除「' + piece.name + '」吗？\n\n此操作不可恢复！')) return;

  RepertoireManager.removePiece(pieceId);
  RepertoireManager.renumberBook(piece.book);
  Utils.showToast('✅ 已删除', 'success');
  showRepertoireEditor();
};

/**
 * 添加曲目（弹出添加表单）
 * @param {number} bookNum 册号
 * @returns {void}
 */
window.addRepPiece = function(bookNum) {
  const nextNum = RepertoireManager.getNextNum(bookNum);
  const displayName = RepertoireManager.getBookDisplayName(bookNum);
  const modal = document.getElementById('modalContainer');

  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">➕ 添加曲目（${Utils.escape(displayName)} #${nextNum}）</h2>
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

/**
 * 保存新曲目
 * @param {number} bookNum 册号
 * @returns {void}
 */
window.saveNewRepPiece = function(bookNum) {
  const name = document.getElementById('repAddName').value.trim();
  if (!name) {
    Utils.showToast('⚠️ 请输入曲目名称', 'warning');
    return;
  }

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

/**
 * 新建分册（弹出 prompt 输入名称）
 * @returns {void}
 */
window.addRepBook = function() {
  const books = RepertoireManager.getBookList();
  const newBook = (books[books.length - 1] || 0) + 1;

  const title = prompt('请输入册名（例如：拜厄、铃木第三册、车尔尼）');
  if (!title || !title.trim()) return;

  const trimmedTitle = title.trim();

  // 保存自定义册名
  const meta = DB.bookMeta();
  meta[newBook] = trimmedTitle;
  DB.saveBookMeta(meta);

  // 添加一首占位曲目（让 book 编号生效）
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

/**
 * 显示导入曲目面板（文件 / JSON 文本）
 * @returns {void}
 */
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

/**
 * 预览导入：解析 JSON 并显示将添加的曲目数
 * @returns {void}
 */
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

/**
 * 确认导入（优先文件，其次文本）
 * @returns {void}
 */
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

/**
 * 异步读取文件并处理导入
 * @returns {Promise<void>}
 */
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

    if (!confirm('将从文件中导入 ' + toAdd.length + ' 首曲目' +
                 (toSkip.length ? '（跳过 ' + toSkip.length + ' 首重复）' : '') +
                 '，确定继续？')) return;

    for (const pieceData of toAdd) {
      RepertoireManager.addPiece(pieceData);
    }

    Utils.showToast('✅ 成功导入 ' + toAdd.length + ' 首曲目' +
                    (toSkip.length ? '，跳过 ' + toSkip.length + ' 首重复' : ''),
                    'success');
    showRepertoireEditor();
  } catch (e) {
    Utils.showToast('❌ 文件读取失败：' + e.message, 'error');
  }
};

/**
 * 解析 JSON 输入（从 textarea）
 * @returns {Array|null} 解析后的曲目数组，失败返回 null
 */
function parseRepImportJSON() {
  const jsonTextarea = document.getElementById('repImportJSON');
  const defaultBook = parseInt(document.getElementById('repImportDefaultBook').value) || 1;

  if (!jsonTextarea.value.trim()) {
    Utils.showToast('⚠️ 请粘贴 JSON 数据或选择文件', 'warning');
    return null;
  }
  return parseRepImportText(jsonTextarea.value.trim(), defaultBook);
}

/**
 * 从文本解析 JSON
 * @param {string} text 原始 JSON 文本
 * @param {number} [defaultBook=1] 当条目未指定 book 时使用的默认册号
 * @returns {Array|null}
 */
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

/**
 * 分析导入数据：哪些是新增、哪些重复
 * @param {Array} entries 待导入曲目
 * @param {Set<string>} existingIds 已存在的曲目 ID 集合
 * @returns {{toAdd: Array, toSkip: Array}}
 */
/**
 * 分析导入数据：哪些是新增、哪些重复
 * @param {Array} entries 待导入曲目
 * @param {Set<string>} existingIds 已存在的曲目 ID 集合
 * @returns {{toAdd: Array, toSkip: Array}}
 */
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