/*
 * 钢琴练习助手 — Piano Practice Helper
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
  const lessons = DB.lessons().slice().sort((a, b) => b.date.localeCompare(a.date));
  const logs = DB.logs().slice().sort((a, b) => b.date.localeCompare(a.date));
  const bookMeta = DB.bookMeta();
  const rep = DB.repertoire();
  const feedbacks = DB.feedbacks().slice();
  const modal = document.getElementById('modalContainer');

  // 构建课程子级列表
  const lessonItems = lessons.map((l, i) => {
    const pieceNames = (l.pieces || []).map(p => p.name).join('、');
    const label = l.date + (pieceNames ? '：' + pieceNames.slice(0, 20) : '');
    const checked = i === 0 ? 'checked' : '';
    return '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:0.75rem">' +
      '<input type="checkbox" class="sync-chk-lesson" data-idx="' + i + '" ' + checked + ' style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  // 构建日志子级列表
  const logItems = logs.map((l, i) => {
    const entryCount = (l.entries || []).length;
    const label = l.date + ' (' + entryCount + '条)';
    return '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:0.75rem">' +
      '<input type="checkbox" class="sync-chk-log" data-idx="' + i + '" style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  // 构建册名子级列表
  const metaKeys = Object.keys(bookMeta);
  const metaItems = metaKeys.map(k => {
    return '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:0.75rem">' +
      '<input type="checkbox" class="sync-chk-meta" data-key="' + k + '" checked style="width:14px;height:14px">' +
      '<span>' + Utils.escape(bookMeta[k]) + ' (' + k + ')</span></label>';
  }).join('');

  // 构建曲库子级列表（按册分组）
  const bookGroups = {};
  rep.forEach(p => {
    if (!bookGroups[p.book]) bookGroups[p.book] = [];
    bookGroups[p.book].push(p);
  });
  const repItems = Object.keys(bookGroups).sort((a, b) => a - b).map(bookNum => {
    const bookName = RepertoireManager.getBookDisplayName(Number(bookNum));
    const pieces = bookGroups[bookNum];
    const label = bookName + ' (' + pieces.length + '首)';
    return '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:0.75rem">' +
      '<input type="checkbox" class="sync-chk-rep" data-book="' + bookNum + '" style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  // 构建反馈子级列表
  const fbItems = feedbacks.map((f, i) => {
    const cat = Feedback.categoryInfo(f.category);
    const label = (f.pieceTitle || '其他') + ' · ' + cat.label + ' · ' + (f.status === 'resolved' ? '完成' : '待练');
    return '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:0.75rem">' +
      '<input type="checkbox" class="sync-chk-fb" data-idx="' + i + '" checked style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">🔄 数据迁移 / 备份</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">

          <div class="p-12 mb-12" style="background:rgba(245,216,154,0.12);border:1px solid rgba(245,216,154,0.3);border-radius:8px">
            <p class="text-xs" style="color:var(--accent-yellow);line-height:1.5">
              ⚠️ 这不是云同步，也不会自动备份。迁移码仅含结构化数据，<strong>不含课堂录音、曲谱照片、家长语音</strong>；迁移码<strong>未加密</strong>，内含私人学习数据，请勿公开分享。
            </p>
          </div>

          <!-- ─── 卡片 1：搬到新设备 ─── -->
          <div class="sync-card" style="margin-bottom:12px;background:rgba(94,106,210,0.06);border:1px solid rgba(94,106,210,0.2);border-radius:12px;overflow:hidden">
            <div class="sync-card-header" onclick="toggleSyncCard('cardMigrate')" style="padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:10px">
              <span style="font-size:1.3rem">📱</span>
              <div style="flex:1">
                <div style="font-weight:700;font-size:0.9rem;color:var(--text-1)">搬到新设备</div>
                <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px">换手机/平板了？扫码或复制迁移码，在新设备上导入</div>
              </div>
              <span style="font-size:0.65rem;background:var(--accent-primary);color:#fff;padding:2px 8px;border-radius:10px;font-weight:600">推荐</span>
              <span id="syncArrowMigrate" style="color:var(--text-3);font-size:0.8rem">▶</span>
            </div>
            <div id="cardMigrate" style="display:none;padding:0 16px 16px">
              <p class="text-xs text-2 mb-8">当前设备生成迁移码 → 另一台设备扫码或粘贴导入</p>

              <div style="margin-bottom:8px">
                <div onclick="var d=document.getElementById('syncLessonList');d.style.display=d.style.display==='none'?'block':'none'" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 0;font-size:0.85rem;font-weight:600">
                  <span>📚 课程记录</span>
                  <span class="text-xs text-3">(${lessons.length}条)</span>
                  <span style="margin-left:auto" id="syncLessonArrow">▼</span>
                </div>
                <div id="syncLessonList" style="max-height:160px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px">
                  ${lessonItems || '<span class="text-xs text-3">暂无课程</span>'}
                </div>
                <div style="display:flex;gap:4px;margin-top:4px">
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('lesson',1)" style="font-size:0.7rem;padding:2px 8px">仅最近1次</button>
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('lesson',3)" style="font-size:0.7rem;padding:2px 8px">最近3次</button>
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('lesson','all')" style="font-size:0.7rem;padding:2px 8px">全选</button>
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('lesson','none')" style="font-size:0.7rem;padding:2px 8px">清空</button>
                </div>
              </div>

              <div style="margin-bottom:8px">
                <div onclick="var d=document.getElementById('syncLogList');d.style.display=d.style.display==='none'?'block':'none';var a=document.getElementById('syncLogArrow');a.textContent=d.style.display==='none'?'▶':'▼'" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 0;font-size:0.85rem;font-weight:600">
                  <span>📝 练习日志</span>
                  <span class="text-xs text-3">(${logs.length}条)</span>
                  <span style="margin-left:auto" id="syncLogArrow">▶</span>
                </div>
                <div id="syncLogList" style="display:none;max-height:160px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px">
                  ${logItems || '<span class="text-xs text-3">暂无日志</span>'}
                </div>
                <div style="display:flex;gap:4px;margin-top:4px">
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('log','all')" style="font-size:0.7rem;padding:2px 8px">全选</button>
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('log','none')" style="font-size:0.7rem;padding:2px 8px">清空</button>
                </div>
              </div>

              <div style="margin-bottom:8px">
                <div onclick="var d=document.getElementById('syncMetaList');d.style.display=d.style.display==='none'?'block':'none';var a=document.getElementById('syncMetaArrow');a.textContent=d.style.display==='none'?'▶':'▼'" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 0;font-size:0.85rem;font-weight:600">
                  <span>🏷️ 自定义册名</span>
                  <span class="text-xs text-3">(${metaKeys.length}条)</span>
                  <span style="margin-left:auto" id="syncMetaArrow">▶</span>
                </div>
                <div id="syncMetaList" style="display:none;max-height:120px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px">
                  ${metaItems || '<span class="text-xs text-3">暂无自定义册名</span>'}
                </div>
              </div>

              <div style="margin-bottom:8px">
                <div onclick="var d=document.getElementById('syncRepList');d.style.display=d.style.display==='none'?'block':'none';var a=document.getElementById('syncRepArrow');a.textContent=d.style.display==='none'?'▶':'▼'" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 0;font-size:0.85rem;font-weight:600">
                  <span>🎼 曲库进度</span>
                  <span class="text-xs text-3">(${rep.length}首)</span>
                  <span style="margin-left:auto" id="syncRepArrow">▶</span>
                </div>
                <div id="syncRepList" style="display:none;max-height:120px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px">
                  ${repItems || '<span class="text-xs text-3">暂无曲目</span>'}
                </div>
                <div style="display:flex;gap:4px;margin-top:4px">
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('rep','all')" style="font-size:0.7rem;padding:2px 8px">全选</button>
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('rep','none')" style="font-size:0.7rem;padding:2px 8px">清空</button>
                </div>
              </div>

              <div style="margin-bottom:8px">
                <div onclick="var d=document.getElementById('syncFbList');d.style.display=d.style.display==='none'?'block':'none';var a=document.getElementById('syncFbArrow');a.textContent=d.style.display==='none'?'▶':'▼'" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 0;font-size:0.85rem;font-weight:600">
                  <span>📌 老师反馈</span>
                  <span class="text-xs text-3">(${feedbacks.length}条)</span>
                  <span style="margin-left:auto" id="syncFbArrow">▶</span>
                </div>
                <div id="syncFbList" style="display:none;max-height:120px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px">
                  ${fbItems || '<span class="text-xs text-3">暂无反馈</span>'}
                </div>
                <div style="display:flex;gap:4px;margin-top:4px">
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('fb','all')" style="font-size:0.7rem;padding:2px 8px">全选</button>
                  <button class="btn btn-sm btn-secondary" onclick="syncQuickSelect('fb','none')" style="font-size:0.7rem;padding:2px 8px">清空</button>
                </div>
              </div>

              <button class="btn btn-primary btn-sm" id="btnGenSyncCode" style="width:100%;margin-bottom:8px">🔗 生成迁移码</button>

              <div id="syncCodeDisplay" style="display:none">
                <textarea class="form-input" id="syncCodeOutput" readonly
                          style="min-height:100px;font-family:monospace;font-size:0.7rem;word-break:break-all;resize:none"
                          onclick="this.select()"></textarea>
                <div class="flex-row gap-8 mb-8">
                  <button class="btn btn-primary btn-sm" onclick="copySyncCode()" style="flex:1">📋 复制迁移码</button>
                </div>
                <div id="syncQRCode" style="text-align:center;margin:12px 0;display:none">
                  <p class="text-xs text-2 mb-8">📱 用另一台设备扫描二维码</p>
                  <canvas id="syncQRCanvas" style="max-width:200px;border-radius:8px"></canvas>
                </div>
                <p class="text-xs text-3" id="syncCodeInfo"></p>
              </div>
            </div>
          </div>

          <!-- ─── 卡片 2：备份数据 ─── -->
          <div class="sync-card" style="margin-bottom:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-1);border-radius:12px;overflow:hidden">
            <div class="sync-card-header" onclick="toggleSyncCard('cardBackup')" style="padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:10px">
              <span style="font-size:1.3rem">💾</span>
              <div style="flex:1">
                <div style="font-weight:700;font-size:0.9rem;color:var(--text-1)">备份数据</div>
                <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px">下载完整备份文件，含录音、曲谱照片，建议定期备份</div>
              </div>
              <span id="syncArrowBackup" style="color:var(--text-3);font-size:0.8rem">▶</span>
            </div>
            <div id="cardBackup" style="display:none;padding:0 16px 16px">
              <p class="text-xs text-2 mb-8">存储用量：${storageInfo.usedKB} KB<span id="blobUsageInfo2" style="margin-left:8px"></span></p>
              <button class="btn btn-primary btn-sm" onclick="exportFullBackup()" style="width:100%;margin-bottom:8px">
                📦 完整备份（含录音/照片/语音）
              </button>
              <div class="text-xs text-3 mb-12" style="line-height:1.5">
                打包所有数据（课程、日志、曲库、反馈、录音、照片、语音）为一个 JSON 文件，换设备时可恢复。
              </div>
              <div style="border-top:1px dashed var(--border-2);padding-top:8px;margin-bottom:8px">
                <span class="text-xs text-3">每节课互传（勾选课程，含照片/录音，不覆盖目标设备）：</span>
              </div>
              <button class="btn btn-primary btn-sm" onclick="exportCoursePackage()" style="width:100%;margin-bottom:8px">
                📦 导出课程包（含照片/录音）
              </button>
              <div class="text-xs text-3 mb-12" style="line-height:1.5">
                勾选要传的课程，导出为 JSON 文件。在另一台设备用「合并导入课程包」导入，已存在的课程自动跳过。
              </div>
              <div style="border-top:1px dashed var(--border-2);padding-top:8px;margin-bottom:8px">
                <span class="text-xs text-3">仅结构化数据（不含媒体，文件更小）：</span>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="exportDataAsJSON()" style="width:100%">
                📥 导出数据（JSON）
              </button>
            </div>
          </div>

          <!-- ─── 卡片 3：恢复数据 ─── -->
          <div class="sync-card" style="margin-bottom:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-1);border-radius:12px;overflow:hidden">
            <div class="sync-card-header" onclick="toggleSyncCard('cardRestore')" style="padding:14px 16px;cursor:pointer;display:flex;align-items:center;gap:10px">
              <span style="font-size:1.3rem">📥</span>
              <div style="flex:1">
                <div style="font-weight:700;font-size:0.9rem;color:var(--text-1)">恢复数据</div>
                <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px">从备份文件恢复，或粘贴迁移码导入</div>
              </div>
              <span id="syncArrowRestore" style="color:var(--text-3);font-size:0.8rem">▶</span>
            </div>
            <div id="cardRestore" style="display:none;padding:0 16px 16px">
              <button class="btn btn-primary btn-sm" onclick="importFullBackup()" style="width:100%;margin-bottom:12px">
                📤 恢复完整备份
              </button>
              <div class="text-xs text-3 mb-12" style="line-height:1.5">
                选择之前导出的完整备份 JSON 文件，恢复所有数据（含录音、照片）。
              </div>
              <div style="border-top:1px dashed var(--border-2);padding-top:8px;margin-bottom:8px">
                <span class="text-xs text-3">合并导入课程包（不覆盖已有数据）：</span>
              </div>
              <button class="btn btn-primary btn-sm" onclick="importCoursePackage()" style="width:100%;margin-bottom:12px">
                📤 合并导入课程包
              </button>
              <div class="text-xs text-3 mb-12" style="line-height:1.5">
                选择「导出课程包」生成的 JSON 文件，只导入新课程，已存在的课程自动跳过。
              </div>
              <div style="border-top:1px dashed var(--border-2);padding-top:8px;margin-bottom:8px">
                <span class="text-xs text-3">或粘贴迁移码 / 扫码导入：</span>
              </div>
              <textarea class="form-input" id="syncCodeInput"
                        placeholder="在此粘贴迁移码…"
                        style="min-height:80px;font-family:monospace;font-size:0.7rem;word-break:break-all;resize:none"></textarea>
              <div class="flex-row gap-8 mb-16">
                <button class="btn btn-success btn-sm" id="btnImportSync" style="flex:1">📥 导入迁移码</button>
                <button class="btn btn-secondary btn-sm" id="btnScanQR" style="flex:1">📷 扫码导入</button>
              </div>
              <div id="scanQRContainer" style="display:none;margin-bottom:16px"></div>
              <div style="border-top:1px dashed var(--border-2);padding-top:8px;margin-bottom:8px">
                <span class="text-xs text-3">或导入结构化数据 JSON：</span>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="showImportPanel()" style="width:100%">
                📤 导入数据（JSON）
              </button>
            </div>
          </div>

          <hr style="border:none;border-top:1px solid var(--border-1);margin:20px 0">

          <div>
            <h3 class="font-bold mb-8" style="color:var(--accent-red)">⚠️ 危险操作</h3>
            <button class="btn btn-secondary btn-sm" onclick="showStorageManager()" style="width:100%;margin-bottom:8px">
              🗂️ 存储管理（清理）
            </button>
            <button class="btn btn-danger btn-sm" onclick="clearAllData()" style="width:100%">
              🗑 清空所有数据
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 异步统计二进制数据用量（录音/照片/语音）
  if (typeof DB.getBlobUsage === 'function') {
    DB.getBlobUsage().then(function(u) {
      var el = document.getElementById('blobUsageInfo2');
      if (el) el.textContent = '· ' + (u.count || 0) + ' 个媒体 · ' + ((u.bytes || 0) / 1024 / 1024).toFixed(2) + ' MB';
    }).catch(function() {
      var el = document.getElementById('blobUsageInfo2');
      if (el) el.textContent = '';
    });
  }

  // 生成同步码按钮事件
  document.getElementById('btnGenSyncCode').addEventListener('click', async () => {
    const selected = {};

    // 收集选中的课程
    const lessonChecks = document.querySelectorAll('.sync-chk-lesson:checked');
    if (lessonChecks.length) {
      selected.lessons = Array.from(lessonChecks).map(c => lessons[parseInt(c.dataset.idx)]).filter(Boolean);
    }

    // 收集选中的日志
    const logChecks = document.querySelectorAll('.sync-chk-log:checked');
    if (logChecks.length) {
      selected.logs = Array.from(logChecks).map(c => logs[parseInt(c.dataset.idx)]).filter(Boolean);
    }

    // 收集选中的册名
    const metaChecks = document.querySelectorAll('.sync-chk-meta:checked');
    if (metaChecks.length) {
      const metaObj = {};
      metaChecks.forEach(c => { metaObj[c.dataset.key] = bookMeta[c.dataset.key]; });
      selected.bookMeta = metaObj;
    }

    // 收集选中的曲库
    const repChecks = document.querySelectorAll('.sync-chk-rep:checked');
    if (repChecks.length) {
      const selectedBooks = new Set(Array.from(repChecks).map(c => Number(c.dataset.book)));
      selected.repertoire = rep.filter(p => selectedBooks.has(p.book));
    }

    // 收集选中的反馈
    const fbChecks = document.querySelectorAll('.sync-chk-fb:checked');
    if (fbChecks.length) {
      selected.feedbacks = Array.from(fbChecks).map(c => feedbacks[parseInt(c.dataset.idx)]).filter(Boolean);
    }

    // 检查是否至少选了一项
    if (!selected.lessons && !selected.logs && !selected.bookMeta && !selected.repertoire && !selected.feedbacks) {
      Utils.showToast('⚠️ 请至少选择一项数据', 'warning');
      return;
    }

    const syncCode = await SyncCode.generateCode(selected);
    const display = document.getElementById('syncCodeDisplay');
    const output = document.getElementById('syncCodeOutput');
    const info = document.getElementById('syncCodeInfo');

    display.style.display = 'block';
    output.value = syncCode;

    const parts = [];
    if (selected.lessons) parts.push(selected.lessons.length + '条课程');
    if (selected.logs) parts.push(selected.logs.length + '条练习');
    if (selected.bookMeta) parts.push(Object.keys(selected.bookMeta).length + '条册名');
    if (selected.repertoire) parts.push(selected.repertoire.length + '首曲库');
    if (selected.feedbacks) parts.push(selected.feedbacks.length + '条反馈');
    info.textContent = '包含：' + parts.join(' · ') + ' · 迁移码长度 ' + syncCode.length + ' 字符（不含录音/照片等媒体文件）';

    // 生成二维码
    try {
      var qrContainer = document.getElementById('syncQRCode');
      var qrCanvas = document.getElementById('syncQRCanvas');
      if (qrContainer && qrCanvas && typeof qrcode !== 'undefined') {
        var qr = qrcode(0, 'M');  // M 级纠错，更易扫描
        qr.addData(syncCode);
        qr.make();
        var moduleSize = 6;  // 每格 6px，比 4px 更清晰
        qrCanvas.width = qr.getModuleCount() * moduleSize;
        qrCanvas.height = qr.getModuleCount() * moduleSize;
        var ctx = qrCanvas.getContext('2d');
        var size = qr.getModuleCount();
        for (var row = 0; row < size; row++) {
          for (var col = 0; col < size; col++) {
            ctx.fillStyle = qr.isDark(row, col) ? '#000000' : '#ffffff';
            ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
          }
        }
        qrContainer.style.display = 'block';
      }
    } catch (e) {
      console.warn('QR code generation failed:', e);
    }

    Utils.showToast('✅ 迁移码已生成（' + syncCode.length + '字符）', 'success');
  });

  // 导入同步码按钮事件
  document.getElementById('btnImportSync').addEventListener('click', async () => {
    const code = document.getElementById('syncCodeInput').value.trim();
    if (!code) {
      Utils.showToast('⚠️ 请粘贴迁移码', 'warning');
      return;
    }
    const result = await SyncCode.importCodeAsync(code);
    if (result.success) {
      closeModal();
      renderAll();
      Utils.showToast('✅ 迁移完成！' + result.stats.lessons + '课程 ' + result.stats.logs + '练习', 'success', 2500);
    } else {
      Utils.showToast('❌ ' + result.error, 'error');
    }
  });

  // 扫码导入按钮事件
  var scanBtn = document.getElementById('btnScanQR');
  if (scanBtn) {
    scanBtn.addEventListener('click', function() {
      var container = document.getElementById('scanQRContainer');
      if (!container) return;

      // 如果已在扫码，停止
      if (container.style.display === 'block') {
        container.style.display = 'none';
        container.innerHTML = '';
        if (window._html5QrCode) {
          window._html5QrCode.stop().catch(function() {});
          window._html5QrCode = null;
        }
        return;
      }

      container.style.display = 'block';
      container.innerHTML = '<div id="qrReader" style="max-width:300px;margin:0 auto"></div>' +
        '<button class="btn btn-sm btn-secondary" id="btnStopScan" style="width:100%;margin-top:8px">取消扫码</button>';

      // 绑定取消按钮
      setTimeout(function() {
        var stopBtn = document.getElementById('btnStopScan');
        if (stopBtn) {
          stopBtn.addEventListener('click', function() {
            container.style.display = 'none';
            container.innerHTML = '';
            if (window._html5QrCode) {
              window._html5QrCode.stop().catch(function() {});
              window._html5QrCode = null;
            }
          });
        }
      }, 100);

      // 启动扫码
      try {
        if (typeof Html5Qrcode === 'undefined') {
          Utils.showToast('⚠️ 扫码库未加载，请刷新页面', 'warning');
          return;
        }
        var html5QrCode = new Html5Qrcode('qrReader');
        window._html5QrCode = html5QrCode;
        html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          function(decodedText) {
            // 扫码成功
            document.getElementById('syncCodeInput').value = decodedText;
            container.style.display = 'none';
            container.innerHTML = '';
            html5QrCode.stop().catch(function() {});
            window._html5QrCode = null;
            Utils.showToast('✅ 已识别，点击「导入迁移码」完成导入', 'success');
          },
          function() { /* 扫描中，忽略 */ }
        ).catch(function(err) {
          console.error('QR scan error:', err);
          Utils.showToast('⚠️ 无法打开摄像头，请检查权限', 'warning');
          container.style.display = 'none';
          container.innerHTML = '';
        });
      } catch (e) {
        console.error('QR scan init error:', e);
        Utils.showToast('⚠️ 扫码功能不可用', 'warning');
      }
    });
  }
};

/**
 * 同步面板卡片展开/折叠
 * @param {string} cardId - 'cardMigrate' | 'cardBackup' | 'cardRestore'
 */
window.toggleSyncCard = function(cardId) {
  var card = document.getElementById(cardId);
  if (!card) return;
  var isOpen = card.style.display === 'block';
  // 关闭所有卡片
  ['cardMigrate', 'cardBackup', 'cardRestore'].forEach(function(id) {
    var c = document.getElementById(id);
    if (c) c.style.display = 'none';
    var arrow = document.getElementById('syncArrow' + id.replace('card', ''));
    if (arrow) arrow.textContent = '▶';
  });
  // 打开当前卡片
  if (!isOpen) {
    card.style.display = 'block';
    var arrow = document.getElementById('syncArrow' + cardId.replace('card', ''));
    if (arrow) arrow.textContent = '▼';
  }
};

/**
 * 同步面板快捷选择
 * @param {string} type - 'lesson' | 'log' | 'rep'
 * @param {number|string} value - 1, 3, 'all', 'none'
 */
window.syncQuickSelect = function(type, value) {
  let selector;
  if (type === 'lesson') selector = '.sync-chk-lesson';
  else if (type === 'log') selector = '.sync-chk-log';
  else if (type === 'rep') selector = '.sync-chk-rep';
  else if (type === 'fb') selector = '.sync-chk-fb';
  else return;

  const checks = document.querySelectorAll(selector);
  if (value === 'all') {
    checks.forEach(c => c.checked = true);
  } else if (value === 'none') {
    checks.forEach(c => c.checked = false);
  } else {
    checks.forEach((c, i) => { c.checked = i < value; });
  }
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
  if (label) label.textContent = '迁移';
}

/* ==========================================
   📥📤 数据导入导出
   ========================================== */

/**
 * 显示导出选择面板，让用户选择要导出的数据类型和具体项目
 * @returns {void}
 */
window.exportDataAsJSON = function() {
  const modal = document.getElementById('modalContainer');
  const lessons = DB.lessons().slice().sort((a, b) => b.date.localeCompare(a.date));
  const logs = DB.logs().slice().sort((a, b) => b.date.localeCompare(a.date));
  const bookMeta = DB.bookMeta();
  const metaKeys = Object.keys(bookMeta);
  const rep = DB.repertoire();

  // 课程子级列表
  const lessonItems = lessons.map((l, i) => {
    const pieceNames = (l.pieces || []).map(p => p.name).join('、');
    const label = l.date + (pieceNames ? '：' + pieceNames.slice(0, 20) : '');
    return '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:0.72rem">' +
      '<input type="checkbox" class="export-chk-lesson" data-idx="' + i + '" checked style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  // 日志子级列表
  const logItems = logs.map((l, i) => {
    const label = l.date + ' (' + (l.entries || []).length + '条)';
    return '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:0.72rem">' +
      '<input type="checkbox" class="export-chk-log" data-idx="' + i + '" checked style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  // 册名子级列表
  const metaItems = metaKeys.map(k => {
    return '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:0.72rem">' +
      '<input type="checkbox" class="export-chk-meta" data-key="' + k + '" checked style="width:14px;height:14px">' +
      '<span>' + Utils.escape(bookMeta[k]) + ' (' + k + ')</span></label>';
  }).join('');

  // 曲库子级列表（按册分组）
  const bookGroups = {};
  rep.forEach(p => { if (!bookGroups[p.book]) bookGroups[p.book] = []; bookGroups[p.book].push(p); });
  const repItems = Object.keys(bookGroups).sort((a, b) => a - b).map(bookNum => {
    const bookName = RepertoireManager.getBookDisplayName(Number(bookNum));
    const count = bookGroups[bookNum].length;
    return '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:0.72rem">' +
      '<input type="checkbox" class="export-chk-rep" data-book="' + bookNum + '" checked style="width:14px;height:14px">' +
      '<span>' + Utils.escape(bookName) + ' (' + count + '首)</span></label>';
  }).join('');

  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">📥 导出数据</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-2 mb-8">勾选要导出的数据类型，展开可选择性导出具体项目</p>

          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="exportLessons" checked style="width:16px;height:16px" onchange="var d=document.getElementById('exportLessonList');d.style.display=this.checked?'block':'none'">
              <span>📚 课程记录</span>
              <span class="text-xs text-3" style="margin-left:auto">${lessons.length} 条</span>
            </label>
            <div id="exportLessonList" style="max-height:140px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px;margin-top:4px">
              ${lessonItems || '<span class="text-xs text-3">暂无课程</span>'}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="exportLogs" checked style="width:16px;height:16px" onchange="var d=document.getElementById('exportLogList');d.style.display=this.checked?'block':'none'">
              <span>📝 练习日志</span>
              <span class="text-xs text-3" style="margin-left:auto">${logs.length} 条</span>
            </label>
            <div id="exportLogList" style="max-height:140px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px;margin-top:4px">
              ${logItems || '<span class="text-xs text-3">暂无日志</span>'}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="exportBookMeta" checked style="width:16px;height:16px" onchange="var d=document.getElementById('exportMetaList');d.style.display=this.checked?'block':'none'">
              <span>🏷️ 自定义册名</span>
              <span class="text-xs text-3" style="margin-left:auto">${metaKeys.length} 条</span>
            </label>
            <div id="exportMetaList" style="max-height:100px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px;margin-top:4px">
              ${metaItems || '<span class="text-xs text-3">暂无自定义册名</span>'}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="exportRepertoire" style="width:16px;height:16px" onchange="var d=document.getElementById('exportRepList');d.style.display=this.checked?'block':'none'">
              <span>🎼 曲库进度（含背谱、状态等）</span>
              <span class="text-xs text-3" style="margin-left:auto">${rep.length} 首</span>
            </label>
            <div id="exportRepList" style="display:none;max-height:100px;overflow-y:auto;padding-left:12px;border-left:2px solid var(--border-1);margin-left:4px;margin-top:4px">
              ${repItems || '<span class="text-xs text-3">暂无曲目</span>'}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="exportConfig" style="width:16px;height:16px">
              <span>⚙️ 应用配置</span>
            </label>
          </div>

          <button class="btn btn-primary" id="btnConfirmExport" style="width:100%;margin-top:8px">
            📥 确认导出
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnConfirmExport').addEventListener('click', function() {
    const includeLessons = document.getElementById('exportLessons').checked;
    const includeLogs = document.getElementById('exportLogs').checked;
    const includeBookMeta = document.getElementById('exportBookMeta').checked;
    const includeRepertoire = document.getElementById('exportRepertoire').checked;
    const includeConfig = document.getElementById('exportConfig').checked;

    if (!includeLessons && !includeLogs && !includeBookMeta && !includeRepertoire && !includeConfig) {
      Utils.showToast('⚠️ 请至少选择一项数据', 'warning');
      return;
    }

    const data = {
      exportDate: new Date().toISOString(),
      version: RepertoireManager.VERSION
    };

    if (includeLessons) {
      const checked = document.querySelectorAll('.export-chk-lesson:checked');
      data.lessons = Array.from(checked).map(c => lessons[parseInt(c.dataset.idx)]).filter(Boolean);
    }
    if (includeLogs) {
      const checked = document.querySelectorAll('.export-chk-log:checked');
      data.logs = Array.from(checked).map(c => logs[parseInt(c.dataset.idx)]).filter(Boolean);
    }
    if (includeBookMeta) {
      const checked = document.querySelectorAll('.export-chk-meta:checked');
      const metaObj = {};
      checked.forEach(c => { metaObj[c.dataset.key] = bookMeta[c.dataset.key]; });
      data.bookMeta = metaObj;
    }
    if (includeRepertoire) {
      const checked = document.querySelectorAll('.export-chk-rep:checked');
      const selectedBooks = new Set(Array.from(checked).map(c => Number(c.dataset.book)));
      data.repertoire = rep.filter(p => selectedBooks.has(p.book));
    }
    if (includeConfig) data.config = DB.config();

    // 始终导出老师反馈（纯文本元数据，体积小，是完整备份的一部分）
    data.feedbacks = DB.feedbacks();

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    // 用 _saveFile（iOS 用分享面板，桌面/Android 用 <a download>）
    _saveFile(blob, 'piano-data-' + Utils.today() + '.json').then(function(r) {
      closeModal();
      Utils.showToast(r.ok ? '✅ 数据已导出' : '已取消导出', r.ok ? 'success' : 'info');
    });
  });
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

  // 优先使用文件（兼容旧版 Safari，不使用 file.text()）
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    jsonData = await new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.onerror = function(e) { reject(e); };
      reader.readAsText(file, 'UTF-8');
    });
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
    const newBookMeta = data.bookMeta || {};
    const newFeedbacks = Array.isArray(data.feedbacks) ? data.feedbacks : [];

    if (!newLessons.length && !newLogs.length && !newRep.length && !newFeedbacks.length && !Object.keys(newBookMeta).length && !Object.keys(newConfig).length) {
      Utils.showToast('❌ 数据格式不正确，未找到任何可导入的数据', 'error');
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

      // 合并 bookMeta：新数据优先
      const mergedBookMeta = { ...DB.bookMeta(), ...newBookMeta };

      // 合并配置
      const mergedConfig = { ...DB.config(), ...newConfig };

      // 合并反馈：按 id 去重，新数据优先
      const fbMap = {};
      DB.feedbacks().forEach(f => { fbMap[f.id] = f; });
      newFeedbacks.forEach(f => { fbMap[f.id] = f; });
      const mergedFeedbacks = Object.values(fbMap);

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
      DB.saveBookMeta(mergedBookMeta);
      DB.saveConfig(mergedConfig);
      DB.saveFeedbacks(mergedFeedbacks);

      closeModal();
      renderAll();
      Utils.showToast(`✅ 合并成功！课程 +${addedLessons}，练习 +${addedLogs}天`, 'success', 3000);
    } else {
      // ── 覆盖模式 ──
      if (!confirm('确定要覆盖现有数据吗？\n\n这将完全替换当前数据，建议先导出备份。')) return;

      // 修复：真正“覆盖”——即使导入文件里某类数据为空，也要清空对应旧数据，
      // 而不是只替换非空部分（否则旧数据残留，与“完全替换”承诺不符）
      DB.saveLessons(newLessons);
      DB.saveLogs(newLogs);
      DB.saveRepertoire(newRep);
      DB.saveBookMeta(newBookMeta);
      DB.saveConfig(newConfig);
      // 反馈：仅当导入文件确实包含 feedbacks 字段时才覆盖（兼容旧导出文件）
      if (Array.isArray(data.feedbacks)) DB.saveFeedbacks(newFeedbacks);

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
    `- ${DB.feedbacks().length} 条老师反馈\n` +
    '- 所有曲库学习进度\n' +
    '- 课堂录音、曲谱照片、家长语音\n' +
    '- 同步配置\n\n' +
    '此操作不可恢复！'
  );
  if (!confirmed) return;

  const doubleConfirm = prompt('请输入 "DELETE" 确认删除：');
  if (doubleConfirm !== 'DELETE') {
    Utils.showToast('❌ 取消删除', 'info');
    return;
  }

  // 清空所有结构化数据
  DB.saveLessons([]);
  DB.saveLogs([]);
  DB.saveConfig({});
  DB.saveFeedbacks([]);
  DB.saveBookMeta({});
  localStorage.removeItem('piano_logo');
  localStorage.removeItem('piano_rep_version');
  localStorage.removeItem('piano_review_range');
  // 清理按日期存的翻卡跳过次数（key 前缀 piano_review_skip_count_）
  for (let k in localStorage) {
    if (k.indexOf('piano_review_skip_count_') === 0) localStorage.removeItem(k);
  }

  // 清空 IndexedDB 中的全部二进制数据（课堂录音、曲谱照片、家长语音）
  if (typeof StorageAdapter !== 'undefined' && typeof StorageAdapter.list === 'function') {
    StorageAdapter.list().then(function(keys) {
      (keys || []).forEach(function(id) {
        StorageAdapter.remove(id).catch(function() {});
      });
    }).catch(function() {});
  }

  // 重新初始化曲库
  RepertoireManager.init();

  closeModal();
  renderAll();
  Utils.showToast('✅ 所有数据已清空（含录音/照片/语音）', 'success');
};

/* ==========================================
   📦 完整备份 / 恢复（含录音/照片/语音二进制数据）
   ========================================== */

/**
 * ArrayBuffer → base64（分块，避免大文件栈溢出）
 */
function _arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * base64 → ArrayBuffer
 */
function _base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * 保存/分享一个 Blob 文件。
 * iOS Safari 用系统分享面板（可存到"文件"），桌面/Android 用 <a download>。
 * @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<{ok:boolean, cancelled?:boolean}>}
 */
async function _saveFile(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/json' });
  // 优先用系统分享（iOS 15+，可"存储到文件"）
  try {
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return { ok: true };
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, cancelled: true };
    // 其它分享错误 → 继续尝试 <a download>
  }
  // 桌面 / Android：<a download>
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
  return { ok: true };
}

/**
 * 导出完整备份：结构化数据 + 全部二进制（录音/照片/语音）打包成一个 JSON 文件
 */
window.exportFullBackup = async function() {
  Utils.showToast('📦 正在打包备份...', 'info', 6000);
  try {
    const data = {
      format: 'piano-full-backup-v1',
      exportDate: new Date().toISOString(),
      version: RepertoireManager.VERSION,
      lessons: DB.lessons(),
      logs: DB.logs(),
      bookMeta: DB.bookMeta(),
      repertoire: DB.repertoire(),
      config: DB.config(),
      feedbacks: DB.feedbacks(),
      blobs: []
    };

    // 收集所有二进制数据
    const blobIds = await StorageAdapter.list();
    for (const id of blobIds) {
      try {
        const rec = await StorageAdapter.get(id);
        if (!rec || !rec.blob) continue;
        const buf = await rec.blob.arrayBuffer();
        data.blobs.push({
          id: rec.id,
          kind: rec.type || '',
          mime: rec.blob.type || '',
          data: _arrayBufferToBase64(buf)
        });
      } catch (e) {
        console.warn('导出媒体失败:', id, e);
      }
    }

    // 打包完成后，弹窗让用户再点一次「保存文件」（保证 iOS 分享/下载在用户手势内）
    const json = JSON.stringify(data);
    const fileBlob = new Blob([json], { type: 'application/json' });
    const filename = 'piano-full-backup-' + Utils.today() + '.json';
    const totalMB = (fileBlob.size / 1024 / 1024).toFixed(2);
    _showBackupSaveDialog(fileBlob, filename, data.blobs.length, totalMB);
  } catch (e) {
    console.error('完整备份导出失败:', e);
    Utils.showToast('❌ 备份导出失败：' + (e && e.message ? e.message : e), 'error', 4000);
  }
};

/**
 * 备份生成后的保存弹窗（iOS 上点击「保存文件」是新的用户手势，分享面板能正常弹出）
 * @param {Blob} fileBlob
 * @param {string} filename
 * @param {number} blobCount
 * @param {string} totalMB
 */
function _showBackupSaveDialog(fileBlob, filename, blobCount, totalMB) {
  const overlay = document.createElement('div');
  overlay.id = 'backupSaveOverlay';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:14px';
  overlay.innerHTML =
    '<div class="modal" style="max-width:440px">' +
      '<div class="modal-header"><h2 class="modal-title">📦 备份已生成</h2><button class="modal-close" onclick="window._closeBackupSave()">✕</button></div>' +
      '<div class="modal-body">' +
        '<p class="text-sm text-2" style="margin-bottom:8px">备份包含 <strong>' + blobCount + '</strong> 个媒体文件，共 <strong>' + totalMB + '</strong> MB。</p>' +
        '<p class="text-xs text-3" style="margin-bottom:16px;line-height:1.5">点击下方「保存文件」下载。在 iPhone 上会弹出分享面板，请选择「存储到文件」。</p>' +
        '<button class="btn btn-primary" id="btnSaveBackup" style="width:100%">💾 保存文件</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  window._closeBackupSave = function() {
    const el = document.getElementById('backupSaveOverlay');
    if (el) el.remove();
  };

  document.getElementById('btnSaveBackup').addEventListener('click', async function() {
    const r = await _saveFile(fileBlob, filename);
    if (r.ok) {
      overlay.remove();
      Utils.showToast('✅ 完整备份已保存（' + blobCount + ' 个媒体，' + totalMB + ' MB）', 'success', 5000);
    }
  });
}

/**
 * 触发完整备份恢复：弹出文件选择器
 */
window.importFullBackup = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(input);
  input.onchange = async function() {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    try {
      const text = await new Promise(function(resolve, reject) {
        const r = new FileReader();
        r.onload = function() { resolve(r.result); };
        r.onerror = function() { reject(new Error('文件读取失败')); };
        r.readAsText(file, 'UTF-8');
      });
      const data = JSON.parse(text);
      await _restoreFullBackup(data);
    } catch (e) {
      console.error('恢复完整备份失败:', e);
      Utils.showToast('❌ 恢复失败：' + (e && e.message ? e.message : e), 'error', 5000);
    }
  };
  input.click();
};

/**
 * 执行完整备份恢复（覆盖）
 * @param {Object} data 备份数据
 */
async function _restoreFullBackup(data) {
  if (!data || data.format !== 'piano-full-backup-v1') {
    Utils.showToast('❌ 这不是有效的完整备份文件', 'error');
    return;
  }

  const blobCount = (data.blobs || []).length;
  const msg = '确定要恢复这个完整备份吗？\n\n' +
    '当前所有数据将被替换为备份内容：\n' +
    '- ' + (data.lessons || []).length + ' 条课程\n' +
    '- ' + (data.logs || []).length + ' 条练习日志\n' +
    '- ' + (data.feedbacks || []).length + ' 条反馈\n' +
    '- ' + blobCount + ' 个录音/照片/语音\n\n' +
    '此操作不可恢复，建议先导出当前数据备份。';
  if (!confirm(msg)) return;

  Utils.showToast('📦 正在恢复...', 'info', 6000);

  try {
    // 1. 恢复结构化数据（覆盖）
    DB.saveLessons(data.lessons || []);
    DB.saveLogs(data.logs || []);
    DB.saveRepertoire(data.repertoire || []);
    DB.saveBookMeta(data.bookMeta || {});
    DB.saveConfig(data.config || {});
    DB.saveFeedbacks(data.feedbacks || []);

    // 2. 同步曲库版本号，避免下次启动触发重新初始化
    localStorage.setItem('piano_rep_version', RepertoireManager.VERSION);

    // 3. 清空现有二进制，再恢复备份中的
    const existingIds = await StorageAdapter.list();
    for (const id of existingIds) {
      try { await StorageAdapter.remove(id); } catch (e) { /* ignore */ }
    }
    for (const b of (data.blobs || [])) {
      if (!b.id || !b.data) continue;
      const buf = _base64ToArrayBuffer(b.data);
      const blob = new Blob([buf], { type: b.mime || '' });
      try {
        await StorageAdapter.set(b.id, blob, b.kind || '');
      } catch (e) {
        console.warn('恢复媒体失败:', b.id, e);
      }
    }

    closeModal();
    renderAll();
    Utils.showToast('✅ 完整备份已恢复（' + blobCount + ' 个媒体文件）', 'success', 5000);
  } catch (e) {
    console.error('恢复完整备份失败:', e);
    Utils.showToast('❌ 恢复失败：' + (e && e.message ? e.message : e), 'error', 5000);
  }
}

/**
 * 导出课程包（含媒体）：勾选课程 → 关联反馈 + 关联照片/录音/语音打包成一个 JSON 文件
 */
window.exportCoursePackage = function() {
  const modal = document.getElementById('modalContainer');
  const lessons = DB.lessons().slice().sort((a, b) => b.date.localeCompare(a.date));
  const fbs = DB.feedbacks();
  const fbCountByLesson = {};
  fbs.forEach(f => { const k = String(f.lessonId); fbCountByLesson[k] = (fbCountByLesson[k] || 0) + 1; });

  const lessonItems = lessons.map((l, i) => {
    const pieceNames = (l.pieces || []).map(p => p.name).join('、');
    const fbCount = fbCountByLesson[String(l.id)] || 0;
    const label = l.date + (pieceNames ? '：' + pieceNames.slice(0, 20) : '') + (fbCount ? '（' + fbCount + ' 条反馈）' : '');
    return '<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;font-size:0.72rem">' +
      '<input type="checkbox" class="coursepkg-chk-lesson" data-idx="' + i + '" style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  modal.innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h2 class="modal-title">📦 导出课程包</h2>' +
          '<button class="modal-close" onclick="closeModal()">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p class="text-xs text-2 mb-8">勾选要传的课程，导出为含照片/录音/语音的 JSON 文件（不覆盖目标设备）。</p>' +
          '<div class="form-group">' +
            '<div style="max-height:280px;overflow-y:auto;border:1px solid var(--border-1);border-radius:8px;padding:8px 10px">' +
              (lessonItems || '<span class="text-xs text-3">暂无课程</span>') +
            '</div>' +
          '</div>' +
          '<button class="btn btn-primary" id="btnConfirmCoursePkg" style="width:100%;margin-top:8px">📦 导出所选课程</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('btnConfirmCoursePkg').addEventListener('click', function() {
    const checked = document.querySelectorAll('.coursepkg-chk-lesson:checked');
    const selected = Array.from(checked).map(c => lessons[parseInt(c.dataset.idx)]).filter(Boolean);
    if (!selected.length) {
      Utils.showToast('⚠️ 请至少勾选一节课程', 'warning');
      return;
    }
    _doExportCoursePackage(selected);
  });
};

/**
 * 打包勾选的课程（+ 关联反馈 + 关联二进制）并保存文件
 * @param {Array} selectedLessons
 */
async function _doExportCoursePackage(selectedLessons) {
  Utils.showToast('📦 正在打包课程...', 'info', 6000);
  try {
    const selectedIds = new Set(selectedLessons.map(l => String(l.id)));
    const feedbacks = DB.feedbacks().filter(f => selectedIds.has(String(f.lessonId)));

    // 收集引用的二进制 id（照片/录音/语音）
    const blobIds = new Set();
    selectedLessons.forEach(l => {
      (l.pieces || []).forEach(p => (p.sheetPhotoIds || []).forEach(id => { if (id) blobIds.add(id); }));
      if (l.lessonAudioId) blobIds.add(l.lessonAudioId);
      (l.lessonAudios || []).forEach(s => { if (s && s.id) blobIds.add(s.id); });
    });
    feedbacks.forEach(f => {
      if (f.sheetPhotoId) blobIds.add(f.sheetPhotoId);
      if (f.parentVoiceId) blobIds.add(f.parentVoiceId);
    });

    const blobs = [];
    for (const id of blobIds) {
      try {
        const rec = await StorageAdapter.get(id);
        if (!rec || !rec.blob) continue;
        const buf = await rec.blob.arrayBuffer();
        blobs.push({ id: rec.id, kind: rec.type || '', mime: rec.blob.type || '', data: _arrayBufferToBase64(buf) });
      } catch (e) {
        console.warn('导出媒体失败:', id, e);
      }
    }

    const data = {
      format: 'piano-course-package-v1',
      exportDate: new Date().toISOString(),
      version: RepertoireManager.VERSION,
      lessons: selectedLessons,
      feedbacks: feedbacks,
      blobs: blobs
    };
    const json = JSON.stringify(data);
    const fileBlob = new Blob([json], { type: 'application/json' });
    const filename = 'piano-course-' + Utils.today() + '.json';
    _saveFile(fileBlob, filename).then(function(r) {
      closeModal();
      Utils.showToast(r.ok
        ? '✅ 课程包已导出（' + selectedLessons.length + ' 节，' + blobs.length + ' 个媒体）'
        : '已取消导出', r.ok ? 'success' : 'info');
    });
  } catch (e) {
    console.error('课程包导出失败:', e);
    Utils.showToast('❌ 导出失败：' + (e && e.message ? e.message : e), 'error', 4000);
  }
}

/**
 * 合并导入课程包：选择 JSON 文件 → 只导入新课程（已存在跳过）
 */
window.importCoursePackage = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(input);
  input.onchange = async function() {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    try {
      const text = await new Promise(function(resolve, reject) {
        const r = new FileReader();
        r.onload = function() { resolve(r.result); };
        r.onerror = function() { reject(new Error('文件读取失败')); };
        r.readAsText(file, 'UTF-8');
      });
      const data = JSON.parse(text);
      await _mergeCoursePackage(data);
    } catch (e) {
      console.error('合并导入课程包失败:', e);
      Utils.showToast('❌ 导入失败：' + (e && e.message ? e.message : e), 'error', 5000);
    }
  };
  input.click();
};

/**
 * 执行课程包合并导入（跳过已存在的课程，追加新媒体）
 * @param {Object} data
 */
async function _mergeCoursePackage(data) {
  if (!data || data.format !== 'piano-course-package-v1') {
    Utils.showToast('❌ 这不是有效的课程包文件', 'error');
    return;
  }

  const existingLessonIds = new Set(DB.lessons().map(l => String(l.id)));
  const existingFbIds = new Set(DB.feedbacks().map(f => String(f.id)));

  const newLessons = (data.lessons || []).filter(l => !existingLessonIds.has(String(l.id)));
  const skippedLessons = (data.lessons || []).length - newLessons.length;
  const newLessonIds = new Set(newLessons.map(l => String(l.id)));
  const newFeedbacks = (data.feedbacks || []).filter(f =>
    newLessonIds.has(String(f.lessonId)) && !existingFbIds.has(String(f.id))
  );

  if (!newLessons.length) {
    Utils.showToast('ℹ️ 课程包内课程都已存在，无需导入（跳过 ' + skippedLessons + ' 节）', 'info');
    return;
  }

  const msg = '确定合并导入课程包吗？\n\n' +
    '- 新增 ' + newLessons.length + ' 节课程\n' +
    '- 新增 ' + newFeedbacks.length + ' 条反馈\n' +
    '- 媒体文件 ' + (data.blobs || []).length + ' 个（已存在的自动跳过）\n' +
    (skippedLessons ? '- 跳过 ' + skippedLessons + ' 节已存在课程\n' : '') +
    '\n已存在的课程不会被覆盖。';
  if (!confirm(msg)) return;

  Utils.showToast('📦 正在合并导入...', 'info', 6000);
  try {
    if (newLessons.length) {
      const lessons = DB.lessons();
      newLessons.forEach(l => lessons.push(l));
      DB.saveLessons(lessons);
    }
    if (newFeedbacks.length) {
      const fbs = DB.feedbacks();
      newFeedbacks.forEach(f => fbs.push(f));
      DB.saveFeedbacks(fbs);
    }
    const existingBlobIds = new Set(await StorageAdapter.list());
    let addedBlob = 0;
    for (const b of (data.blobs || [])) {
      if (!b.id || !b.data) continue;
      if (existingBlobIds.has(b.id)) continue;
      const buf = _base64ToArrayBuffer(b.data);
      const blob = new Blob([buf], { type: b.mime || '' });
      try {
        await StorageAdapter.set(b.id, blob, b.kind || '');
        addedBlob++;
      } catch (e) {
        console.warn('恢复媒体失败:', b.id, e);
      }
    }

    closeModal();
    renderAll();
    Utils.showToast('✅ 已合并导入 ' + newLessons.length + ' 节课程（' + addedBlob + ' 个新媒体）', 'success', 5000);
  } catch (e) {
    console.error('合并导入课程包失败:', e);
    Utils.showToast('❌ 导入失败：' + (e && e.message ? e.message : e), 'error', 5000);
  }
}

/**
 * 收集所有被课程/反馈引用的 blob id（照片/录音/语音）
 * @returns {Set<string>}
 */
function _collectReferencedBlobIds() {
  const referenced = new Set();
  DB.lessons().forEach(l => {
    if (l.lessonAudioId) referenced.add(l.lessonAudioId);
    (l.lessonAudios || []).forEach(s => { if (s && s.id) referenced.add(s.id); });
    (l.pieces || []).forEach(p => (p.sheetPhotoIds || []).forEach(id => { if (id) referenced.add(id); }));
  });
  DB.feedbacks().forEach(f => {
    if (f.sheetPhotoId) referenced.add(f.sheetPhotoId);
    if (f.parentVoiceId) referenced.add(f.parentVoiceId);
  });
  return referenced;
}

/**
 * 清理孤儿 blob（不被任何课程/反馈引用的照片/录音/语音）
 * @returns {Promise<number>} 删除数量
 */
async function _cleanupOrphanBlobs() {
  const referenced = _collectReferencedBlobIds();
  const allIds = await StorageAdapter.list();
  let removed = 0;
  for (const id of allIds) {
    if (!referenced.has(id)) {
      try { await StorageAdapter.remove(id); removed++; } catch (e) { /* ignore */ }
    }
  }
  return removed;
}

/**
 * 孤儿文件类型的中文标签
 */
const ORPHAN_TYPE_LABELS = {
  'sheet_photo': { icon: '📷', label: '曲谱照片' },
  'parent_voice': { icon: '🎤', label: '家长语音' },
  'lesson_recording': { icon: '🎙', label: '课堂录音' }
};

function _orphanTypeInfo(type) {
  return ORPHAN_TYPE_LABELS[type] || { icon: '📁', label: '其他文件' };
}

function _formatBytes(bytes) {
  bytes = bytes || 0;
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/**
 * 列出所有孤儿 blob（不被任何课程/反馈引用）
 * @returns {Promise<Array<{id:string,type:string,bytes:number}>>}
 */
async function _listOrphanBlobs() {
  const referenced = _collectReferencedBlobIds();
  const allIds = await StorageAdapter.list();
  const orphans = [];
  for (const id of allIds) {
    if (referenced.has(id)) continue;
    try {
      const rec = await StorageAdapter.get(id);
      if (rec) {
        const bytes = (rec.blob && rec.blob.size) ? rec.blob.size : 0;
        orphans.push({ id: id, type: rec.type || 'other', bytes: bytes });
      }
    } catch (e) { /* ignore */ }
  }
  return orphans;
}

/**
 * 弹出孤儿文件清单，确认后删除
 * @param {Array} orphans
 */
function _showOrphanConfirmDialog(orphans) {
  const totalBytes = orphans.reduce(function(s, o) { return s + o.bytes; }, 0);
  const rows = orphans.map(function(o) {
    const info = _orphanTypeInfo(o.type);
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border-2);font-size:0.72rem">' +
      '<span>' + info.icon + '</span>' +
      '<span style="color:var(--text-2)">' + info.label + '</span>' +
      '<span style="flex:1"></span>' +
      '<span style="color:var(--text-3)">' + _formatBytes(o.bytes) + '</span>' +
    '</div>';
  }).join('');

  const modal = document.getElementById('modalContainer');
  modal.innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
      '<div class="modal" style="max-width:400px">' +
        '<div class="modal-header"><h2 class="modal-title">🧹 清理孤儿文件</h2><button class="modal-close" onclick="closeModal()">✕</button></div>' +
        '<div class="modal-body">' +
          '<div class="text-xs text-2 mb-8">以下 ' + orphans.length + ' 个文件不再被任何课程/反馈引用，共 ' + _formatBytes(totalBytes) + '：</div>' +
          '<div style="max-height:260px;overflow-y:auto;margin-bottom:12px">' + rows + '</div>' +
          '<button class="btn btn-danger" id="btnConfirmOrphanDelete" style="width:100%">🗑 删除这 ' + orphans.length + ' 个文件</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('btnConfirmOrphanDelete').addEventListener('click', async function() {
    const removed = await _cleanupOrphanBlobs();
    Utils.showToast('✅ 已清理 ' + removed + ' 个孤儿文件', 'success');
    closeModal();
    showStorageManager();
  });
}

/**
 * 存储管理面板：用量概览 + 孤儿清理 + 按课程勾选删除
 */
window.showStorageManager = function() {
  const modal = document.getElementById('modalContainer');
  const lessons = DB.lessons().slice().sort((a, b) => b.date.localeCompare(a.date));

  const lessonItems = lessons.map(l => {
    const pieceNames = (l.pieces || []).map(p => p.name).join('、');
    const fbCount = Feedback.byLesson(l.id).length;
    const label = l.date + (pieceNames ? '：' + pieceNames.slice(0, 18) : '') + (fbCount ? '（' + fbCount + ' 反馈）' : '');
    return '<label style="display:flex;align-items:center;gap:6px;padding:5px 0;cursor:pointer;font-size:0.72rem;border-bottom:1px solid var(--border-2)">' +
      '<input type="checkbox" class="storage-chk-lesson" data-id="' + Utils.escape(l.id) + '" style="width:14px;height:14px">' +
      '<span>' + Utils.escape(label) + '</span></label>';
  }).join('');

  modal.innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
      '<div class="modal">' +
        '<div class="modal-header"><h2 class="modal-title">🗂️ 存储管理</h2><button class="modal-close" onclick="closeModal()">✕</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label class="form-label">📊 存储用量</label>' +
            '<div id="storageUsageBox" style="font-size:0.78rem;color:var(--text-2);line-height:1.8">' +
              '<span class="text-xs text-3">加载中…</span>' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<button class="btn btn-secondary btn-sm" id="btnCleanupOrphans" style="width:100%">🧹 清理孤儿文件</button>' +
            '<div class="text-xs text-3 mt-4" style="line-height:1.5">删除不再被任何课程或反馈引用的照片、录音、语音文件。</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">📚 按课程清理（勾选删除，含录音/照片/图钉）</label>' +
            '<div style="max-height:220px;overflow-y:auto;border:1px solid var(--border-1);border-radius:8px;padding:6px 10px">' +
              (lessonItems || '<span class="text-xs text-3">暂无课程</span>') +
            '</div>' +
            '<button class="btn btn-danger btn-sm" id="btnDeleteSelectedLessons" style="width:100%;margin-top:8px">🗑 删除所选课程</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  // 异步加载用量（分类统计）
  StorageAdapter.usageByType().then(function(u) {
    const box = document.getElementById('storageUsageBox');
    if (!box) return;
    const mb = function(bytes) { return ((bytes || 0) / 1024 / 1024).toFixed(2) + ' MB'; };
    const t = u.byType || {};
    const photo = t['sheet_photo'] || { count: 0, bytes: 0 };
    const voice = t['parent_voice'] || { count: 0, bytes: 0 };
    const rec = t['lesson_recording'] || { count: 0, bytes: 0 };
    box.innerHTML =
      '<div>总计：<strong>' + mb(u.totalBytes) + '</strong></div>' +
      '<div>📷 曲谱照片：' + photo.count + ' 个 · ' + mb(photo.bytes) + '</div>' +
      '<div>🎤 家长语音：' + voice.count + ' 个 · ' + mb(voice.bytes) + '</div>' +
      '<div>🎙 课堂录音：' + rec.count + ' 个 · ' + mb(rec.bytes) + '</div>';
  }).catch(function() {
    const box = document.getElementById('storageUsageBox');
    if (box) box.textContent = '用量统计失败';
  });

  document.getElementById('btnCleanupOrphans').addEventListener('click', async function() {
    const orphans = await _listOrphanBlobs();
    if (!orphans.length) {
      Utils.showToast('✅ 没有孤儿文件，无需清理', 'info');
      return;
    }
    _showOrphanConfirmDialog(orphans);
  });

  document.getElementById('btnDeleteSelectedLessons').addEventListener('click', async function() {
    const checked = document.querySelectorAll('.storage-chk-lesson:checked');
    const ids = Array.from(checked).map(c => c.dataset.id);
    if (!ids.length) {
      Utils.showToast('⚠️ 请先勾选要删除的课程', 'warning');
      return;
    }
    if (!confirm('确定删除所选 ' + ids.length + ' 节课程吗？\n\n将同时删除关联的课堂录音、曲谱照片、家长语音和图钉反馈。\n此操作不可恢复！')) return;
    const lessonsNow = DB.lessons();
    const toDelete = lessonsNow.filter(l => ids.indexOf(l.id) >= 0);
    DB.saveLessons(lessonsNow.filter(l => ids.indexOf(l.id) < 0));
    for (const l of toDelete) {
      await cleanupLessonMedia(l);
    }
    closeModal();
    renderAll();
    Utils.showToast('✅ 已删除 ' + toDelete.length + ' 节课程', 'success');
  });
};

console.log('✅ Lessons, Calendar, Repertoire modules loaded');