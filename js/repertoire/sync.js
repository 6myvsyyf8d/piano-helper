/*
 * 哆哩的钢琴助手 — Piano Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   🎵 曲库 - 同步面板 + 数据导入导出
   ========================================== */
"use strict";

/**
 * 显示同步面板（生成同步码 + 导入同步码 + 数据管理 + 清空）
 * @returns {void}
 */
window.showSyncPanel = function() {
  const storageInfo = DB.getStorageInfo();
  const syncCode = SyncCode.generateCode();
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

  // 导入同步码按钮事件
  document.getElementById('btnImportSync').addEventListener('click', () => {
    const code = document.getElementById('syncCodeInput').value.trim();
    if (!code) {
      Utils.showToast('⚠️ 请粘贴同步码', 'warning');
      return;
    }
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

/**
 * 复制同步码到剪贴板
 * @returns {void}
 */
window.copySyncCode = function() {
  const ta = document.getElementById('syncCodeOutput');
  if (!ta) return;
  ta.select();
  Utils.copyToClipboard(ta.value).then(ok => {
    Utils.showToast(ok ? '✅ 已复制到剪贴板' : '⚠️ 复制失败，请手动选择', ok ? 'success' : 'warning');
  });
};

/**
 * 更新同步按钮状态（顶栏显示）
 * @returns {void}
 */
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

/**
 * 导出所有数据为 JSON 文件（自动下载）
 * @returns {void}
 */
window.exportDataAsJSON = function() {
  const data = {
    lessons: DB.lessons(),
    logs: DB.logs(),
    repertoire: DB.repertoire(),
    config: DB.config(),
    exportDate: new Date().toISOString(),
    version: '3.4_20260620'
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

/**
 * 显示数据导入面板（合并 / 覆盖两种模式）
 * @returns {void}
 */
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

  // 合并模式按钮
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

  // 覆盖模式按钮
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

/**
 * 处理数据导入（合并 / 覆盖两种模式）
 * @param {'merge'|'overwrite'} mode 导入模式
 * @returns {Promise<void>}
 */
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

      // 统计变化
      const addedLessons = newLessons.filter(l => !existingLessons.some(el => el.id === l.id)).length;
      const updatedLessons = newLessons.filter(l => existingLessons.some(el => el.id === l.id)).length;
      const addedLogs = newLogs.filter(l => !existingLogs.some(el => el.date === l.date)).length;
      const updatedLogs = newLogs.filter(l => existingLogs.some(el => el.date === l.date)).length;

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

/**
 * 清空所有数据（双重确认 + 重新初始化曲库）
 * @returns {void}
 */
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

console.log('✅ Lessons, Calendar, Repertoire modules loaded');