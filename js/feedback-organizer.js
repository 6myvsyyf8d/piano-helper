"use strict";

/* ==========================================
   📝 反馈整理界面 - 曲谱照片 + 语音图钉（方案B：以曲子为单位）
   ==========================================
   spec v1.2 (方案B重构):
   - 入口：曲子卡片的"🎼 整理曲谱"按钮
   - 顶部：曲名
   - 中部：SheetAnnotator 组件（曲谱照片 + 图钉）
   - 下部：已标注反馈列表（试听 / 编辑 / 删除）
   - 图钉编辑面板：位置 / 类型 / 录音时间(选填) / 老师原话 / 按住录音 / 试听重录

   数据流：
   - 进入时按 (lessonId, pieceTitle) 查找已存在的 FeedbackItem 列表
   - 放图钉 → 弹编辑面板 → 保存 → 创建/更新 FeedbackItem
   - 每个图钉有自己的 timestamp（选填，从 marker 列表中选或留空）
   - 全程立即保存（不需要"保存全部"按钮，按钮只是关闭）
   ========================================== */

const FeedbackOrganizer = {
  _open: false,
  _pieceTitle: '',
  _lessonId: '',

  // 当前进入时关联的反馈列表（同 lessonId + 同曲子）
  _currentFeedbacks: [],

  // 课程表单会话内的照片列表（pieceTitle -> blobId[]）
  // 新增课程未保存时没有 lessonId，照片先挂在这里，saveLesson 时写入课程数据
  _sessionPiecePhotos: {},

  // 正在编辑的图钉编辑面板状态
  _editingPin: null,    // {pinX, pinY, id?, ...}
  _editingVoiceId: null,
  _editingVoiceDuration: 0,
  _recordingVoice: false,
  _voiceRecorder: null,
  _voiceChunks: [],
  _voiceRecStartTs: 0,
  _voiceTimerId: null,

  /**
   * 打开反馈整理界面（方案B：以曲子为单位）
   * @param {string} pieceTitle 曲子名称
   * @param {string} lessonId   课程 ID
   */
  open(pieceTitle, lessonId) {
    if (this._open) return;
    this._open = true;
    this._pieceTitle = pieceTitle || '';
    this._lessonId = String(lessonId || '');

    // 查找已存在的反馈（同 lessonId + 同曲子）
    this._currentFeedbacks = Feedback.all().filter(f =>
      f.pieceTitle === this._pieceTitle && f.lessonId === this._lessonId
    );

    // 收集所有已有照片 ID（去重，保持首次出现顺序）
    // 方案A：照片列表不再只靠图钉反馈捎带——
    //   1) 课程曲目数据 sheetPhotoIds（保存过的课程，无图钉也能找回）
    //   2) 本次课程表单会话内存（新增课程未保存期间，退出课堂记录再进不丢）
    //   3) 图钉反馈 sheetPhotoId（旧数据兼容）
    const seenIds = new Set();
    const existingPhotoIds = [];
    [
      this._getLessonPiecePhotoIds(),
      this._sessionPiecePhotos[this._pieceTitle] || [],
      this._currentFeedbacks.map(f => f.sheetPhotoId)
    ].forEach(function(ids) {
      (ids || []).forEach(function(id) {
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          existingPhotoIds.push(id);
        }
      });
    });

    // 初始化 SheetAnnotator
    const self = this;
    SheetAnnotator.init({
      photoBlobIds: existingPhotoIds,
      onPlacePin: function(x, y, photoPage) { self._openEditPanel({ pinX: x, pinY: y, photoPage: photoPage }); },
      onPinClick: function(pinId) { self._onPinClicked(pinId); }
    }).then(function() {
      SheetAnnotator.onPhotoUploaded(function(blobId, pageNum) {
        // 新照片上传：所有当前曲子 feedback 共享照片列表
        // 更新所有 feedback 的 sheetPhotoId（如果还没有的话）
        self._currentFeedbacks.forEach(function(f) {
          if (!f.sheetPhotoId) {
            Feedback.update(f.id, { sheetPhotoId: blobId, photoPage: pageNum || 1 });
          }
        });
        self._refreshFeedbackList();
      });
      SheetAnnotator.onPhotosChanged(function(blobIds) {
        // 照片列表变化（增/删/换）：立即锚定照片
        // - 会话内存（新增课程未保存期间）
        // - 已保存课程直接写回课程数据（与图钉"全程立即保存"一致）
        self._sessionPiecePhotos[self._pieceTitle] = (blobIds || []).slice();
        self._persistLessonPhotos(blobIds || []);
        // 清理引用已删除照片的图钉：防止照片删除后仍从 feedback.sheetPhotoId 复活
        var validIds = new Set((blobIds || []).filter(Boolean));
        self._currentFeedbacks.forEach(function(f) {
          if (f.sheetPhotoId && !validIds.has(f.sheetPhotoId)) {
            Feedback.update(f.id, { sheetPhotoId: null });
          }
        });
        self._refreshFeedbackList();
      });
      SheetAnnotator.onPinMoved(function(pinId, pinX, pinY) {
        // 图钉拖拽移动：更新 FeedbackItem 的 pinX/pinY
        Feedback.update(pinId, { pinX: pinX, pinY: pinY });
        self._currentFeedbacks = Feedback.all().filter(function(f) {
          return f.pieceTitle === self._pieceTitle && f.lessonId === self._lessonId;
        });
        self._refreshFeedbackList();
      });
      self._render();
    });
  },

  /**
   * 读取课程数据中当前曲目的照片列表（已保存课程）
   * @returns {string[]}
   */
  _getLessonPiecePhotoIds() {
    if (!this._lessonId) return [];
    const lesson = DB.lessons().find(l => String(l.id) === this._lessonId);
    if (!lesson || !Array.isArray(lesson.pieces)) return [];
    const piece = lesson.pieces.find(p => p.name === this._pieceTitle);
    return (piece && Array.isArray(piece.sheetPhotoIds)) ? piece.sheetPhotoIds.slice() : [];
  },

  /**
   * 把当前照片列表写回已保存课程的数据（编辑课程时立即保存）
   * @param {string[]} blobIds
   */
  _persistLessonPhotos(blobIds) {
    if (!this._lessonId) return;
    const lessons = DB.lessons();
    const idx = lessons.findIndex(l => String(l.id) === this._lessonId);
    if (idx < 0) return;
    const lesson = lessons[idx];
    if (!Array.isArray(lesson.pieces)) lesson.pieces = [];
    const piece = lesson.pieces.find(p => p.name === this._pieceTitle);
    if (piece) {
      piece.sheetPhotoIds = blobIds.slice();
      lessons[idx] = lesson;
      DB.saveLessons(lessons);
    }
  },

  /**
   * 重置会话照片表（每次打开课程表单时调用，防止上一次表单的残留）
   */
  resetSession() {
    this._sessionPiecePhotos = {};
  },

  /**
   * 获取会话照片表副本（saveLesson 调用，写入课程数据）
   * @returns {Object} pieceTitle -> blobId[]
   */
  getSessionPhotoMap() {
    const copy = {};
    Object.keys(this._sessionPiecePhotos).forEach(k => {
      copy[k] = this._sessionPiecePhotos[k].slice();
    });
    return copy;
  },

  /**
   * 渲染整个界面
   */
  _render() {
    const modal = document.getElementById('modalContainer');
    modal.insertAdjacentHTML('beforeend',
      '<div class="modal-overlay feedback-organizer-overlay" id="feedbackOrganizerOverlay" onclick="if(event.target===this)FeedbackOrganizer.close()">' +
        '<div class="modal feedback-organizer-modal">' +
          '<div class="modal-header">' +
            '<button class="modal-back" onclick="FeedbackOrganizer.close()">←</button>' +
            '<h2 class="modal-title">🎼 课堂记录</h2>' +
            '<button class="modal-close" onclick="FeedbackOrganizer.close()">✕</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div class="organizer-meta">' +
              '<span class="organizer-meta-piece">🎵 ' + Utils.escape(this._pieceTitle) + '</span>' +
            '</div>' +
            '<div id="sheetAnnotatorMount">' + SheetAnnotator.render() + '</div>' +
            '<div class="organizer-feedback-section">' +
              '<h3 class="organizer-section-title">📌 已标注的反馈</h3>' +
              '<div id="organizerFeedbackList"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );

    SheetAnnotator.mount();
    this._refreshFeedbackList();
  },

  /**
   * 刷新已标注反馈列表
   */
  _refreshFeedbackList() {
    this._currentFeedbacks = Feedback.all().filter(f =>
      f.pieceTitle === this._pieceTitle && f.lessonId === this._lessonId
    );

    const listEl = document.getElementById('organizerFeedbackList');
    if (!listEl) return;

    // 同步图钉到 SheetAnnotator
    SheetAnnotator.setPins(this._currentFeedbacks.map(f => ({
      id: f.id,
      pinX: f.pinX,
      pinY: f.pinY,
      photoPage: f.photoPage || 1,
      status: f.status,
      category: f.category,
      locationLabel: f.locationLabel,
      pinNumber: f.pinNumber
    })));

    if (this._currentFeedbacks.length === 0) {
      listEl.innerHTML = '<p class="organizer-empty-hint">还没有标注。点击上方曲谱照片上老师画圈/写字的位置放图钉。</p>';
      return;
    }

    listEl.innerHTML = this._currentFeedbacks.map((f, idx) => {
      const cat = Feedback.CATEGORIES.find(c => c.key === f.category);
      const catIcon = cat ? cat.icon : '📌';
      const catLabel = cat ? cat.label : '其他';
      const statusInfo = this._statusInfo(f.status);
      const voiceBtn = f.parentVoiceId
        ? '<button type="button" class="organizer-fb-play" data-fb-id="' + f.id + '"' +
          ' onclick="FeedbackOrganizer._playVoice(\'' + f.id + '\', this)">▶ 试听</button>'
        : '<span class="organizer-fb-no-voice">无语音</span>';
      const locLabel = f.locationLabel ? Utils.escape(f.locationLabel) : '<span class="text-xs" style="color:var(--text-4)">未填位置</span>';
      const teacherNote = f.teacherNote ? '<div class="organizer-fb-note">"' + Utils.escape(f.teacherNote) + '"</div>' : '';
      return (
        '<div class="organizer-feedback-item" data-fb-id="' + f.id + '">' +
          '<div class="organizer-fb-head">' +
            '<span class="organizer-fb-pin">📌 #' + (f.pinNumber || (idx + 1)) + '</span>' +
            '<span class="organizer-fb-loc">' + locLabel + '</span>' +
            '<span class="organizer-fb-cat">' + catIcon + ' ' + catLabel + '</span>' +
          '</div>' +
          teacherNote +
          '<div class="organizer-fb-actions">' +
            voiceBtn +
            '<button type="button" class="organizer-fb-edit" onclick="FeedbackOrganizer._editFeedback(\'' + f.id + '\')">编辑</button>' +
            '<button type="button" class="organizer-fb-del" onclick="FeedbackOrganizer._deleteFeedback(\'' + f.id + '\')">删除</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  },

  _statusInfo(status) {
    if (status === 'resolved') return { cls: 'st-resolved', icon: '🟢', label: '已完成' };
    return { cls: 'st-new', icon: '🔵', label: '未完成' };
  },

  /**
   * 点击已有图钉 → 打开编辑面板
   */
  _onPinClicked(feedbackId) {
    this._editFeedback(feedbackId);
  },

  /**
   * 打开图钉编辑面板（新建或编辑）
   * @param {Object} opts {pinX, pinY, id?}
   */
  _openEditPanel(opts) {
    let existing = null;
    if (opts.id) {
      existing = Feedback.find(opts.id);
      if (!existing) {
        Utils.showToast('⚠️ 反馈不存在', 'warning');
        return;
      }
    }
    this._editingPin = {
      id: existing ? existing.id : null,
      pinX: existing ? existing.pinX : opts.pinX,
      pinY: existing ? existing.pinY : opts.pinY,
      photoPage: existing ? (existing.photoPage || 1) : (opts.photoPage || 1),
      pieceTitle: existing ? existing.pieceTitle : this._pieceTitle,
      locationLabel: existing ? existing.locationLabel : '',
      category: existing ? existing.category : 'technique',
      teacherNote: existing ? existing.teacherNote : '',
      parentVoiceId: existing ? existing.parentVoiceId : null,
      timestamp: existing ? (existing.timestamp || null) : (this._getCurrentLessonTimestamp()),
      markerId: existing ? (existing.markerId || null) : null
    };
    this._editingVoiceId = this._editingPin.parentVoiceId;
    this._renderEditPanel();
  },

  /**
   * 编辑现有反馈
   */
  _editFeedback(feedbackId) {
    this._openEditPanel({ id: feedbackId });
  },

  /**
   * 渲染图钉编辑面板（弹出层）
   */
  _renderEditPanel() {
    // 移除已有面板
    const old = document.getElementById('pinEditPanel');
    if (old) old.remove();

    const p = this._editingPin;
    const catButtonsHtml = Feedback.CATEGORIES.map(c => {
      const active = c.key === p.category;
      return '<button type="button" class="cat-btn' + (active ? ' active' : '') + '"' +
        ' onclick="FeedbackOrganizer._setCategory(\'' + c.key + '\')">' + c.icon + ' ' + c.label + '</button>';
    }).join('');

    const voiceSectionHtml = this._renderVoiceSection();

    const overlay = document.createElement('div');
    overlay.id = 'pinEditPanel';
    overlay.className = 'pin-edit-overlay';
    overlay.style.background = 'rgba(0,0,0,0.2)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.innerHTML =
      '<div class="pin-edit-panel" onclick="event.stopPropagation()" style="background:rgba(20,25,52,0.78)">' +
        '<div class="pin-edit-header" style="background:rgba(20,25,52,0.78)">' +
          '<span class="pin-edit-title">' + (p.id ? '编辑图钉' : '新建图钉') + '</span>' +
          '<button type="button" class="pin-edit-close" onclick="FeedbackOrganizer._closeEditPanel()">✕</button>' +
        '</div>' +
        '<div class="pin-edit-body">' +
          '<div class="form-group">' +
            '<label class="form-label">🎵 曲名</label>' +
            '<input type="text" class="form-input" id="pinEditPiece" value="' + Utils.escape(p.pieceTitle) + '" placeholder="曲名">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">📍 位置描述（可选）</label>' +
            '<input type="text" class="form-input" id="pinEditLocation" value="' + Utils.escape(p.locationLabel) + '" placeholder="如：第5小节左手 / B段">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">🏷 类型</label>' +
            '<div class="cat-btn-row">' + catButtonsHtml + '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">💬 老师原话（可选）</label>' +
            '<textarea class="form-textarea" id="pinEditNote" placeholder="老师在这里说了什么" rows="2">' + Utils.escape(p.teacherNote) + '</textarea>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">🎤 家长语音解释（按住录音）</label>' +
            voiceSectionHtml +
          '</div>' +
        '</div>' +
        '<div class="pin-edit-footer">' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="FeedbackOrganizer._closeEditPanel()">取消</button>' +
          (p.id ? '<button type="button" class="btn btn-danger btn-sm" style="background:#e74c3c;color:#fff;border:none" onclick="FeedbackOrganizer._deletePinFromEdit()">🗑 删除</button>' : '') +
          '<button type="button" class="btn btn-primary btn-sm" onclick="FeedbackOrganizer._savePin()">保存图钉</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) FeedbackOrganizer._closeEditPanel();
    });
    document.body.appendChild(overlay);
  },

  _renderVoiceSection() {
    if (this._editingVoiceId) {
      return (
        '<div class="voice-section">' +
          '<div class="voice-recorder" id="voiceRecorder">' +
            '<button type="button" class="voice-rec-btn has-voice" id="voiceRecBtn">🎤 按住重录</button>' +
            '<span class="voice-rec-status">已录语音</span>' +
            '<button type="button" class="voice-play-btn" onclick="FeedbackOrganizer._playEditingVoice(this)">▶ 试听</button>' +
            '<button type="button" class="voice-del-btn" onclick="FeedbackOrganizer._deleteEditingVoice()">删除</button>' +
          '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="voice-section">' +
        '<div class="voice-recorder" id="voiceRecorder">' +
          '<button type="button" class="voice-rec-btn" id="voiceRecBtn">🎤 按住录音</button>' +
          '<span class="voice-rec-status" id="voiceRecStatus">录一段给孩子听的解释</span>' +
        '</div>' +
      '</div>'
    );
  },

  /**
   * 设置类型 - 只切高亮，不重渲染（避免清空用户输入）
   */
  _setCategory(key) {
    if (!this._editingPin) return;
    this._editingPin.category = key;
    const btns = document.querySelectorAll('.cat-btn');
    btns.forEach(b => {
      const txt = b.textContent.trim();
      const cat = Feedback.CATEGORIES.find(c => (c.icon + ' ' + c.label) === txt);
      b.classList.toggle('active', cat && cat.key === key);
    });
  },

  /**
   * 设置录音时间（从 marker 下拉框选择）
   * @param {string} markerId 选中的 marker ID，空字符串=不关联
   */
  _setTimestamp(markerId) {
    if (!this._editingPin) return;
    if (!markerId) {
      this._editingPin.timestamp = null;
      this._editingPin.markerId = null;
      return;
    }
    var markers = this._getMarkersForPiece();
    var m = markers.find(function(mk) { return mk.id === markerId; });
    if (m) {
      this._editingPin.timestamp = m.timestamp;
      this._editingPin.markerId = m.id;
    }
  },

  /**
   * 获取这首曲子在当前课程中的所有 marker（用于时间戳下拉框）
   * @returns {Array<{id,timestamp,label,timeLabel}>}
   */
  _getMarkersForPiece() {
    var lesson = DB.lessons().find(l => String(l.id) === this._lessonId);
    if (!lesson || !Array.isArray(lesson.audioMarkers)) return [];
    var self = this;
    return lesson.audioMarkers
      .filter(m => m.pieceTitle === self._pieceTitle)
      .map(m => ({
        id: m.id,
        timestamp: m.timestamp,
        label: m.label || '',
        timeLabel: self._formatTime(m.timestamp)
      }));
  },

  /**
   * 按住录音相关
   */
  _bindVoiceRecorder() {
    const btn = document.getElementById('voiceRecBtn');
    if (!btn) return;
    const self = this;
    // 防止文本选中
    btn.addEventListener('selectstart', e => e.preventDefault());
    // 按下
    const start = function(e) {
      e.preventDefault();
      self._startVoiceRecording();
    };
    // 松开
    const stop = function(e) {
      e.preventDefault();
      self._stopVoiceRecording();
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
  },

  async _startVoiceRecording() {
    if (this._recordingVoice) return;
    if (typeof window.ensureRecordingConsent === 'function' && !window.ensureRecordingConsent()) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Utils.showToast('⚠️ 浏览器不支持录音', 'warning');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._voiceStream = stream;
      this._voiceChunks = [];
      let mime = '';
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      for (const c of candidates) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) { mime = c; break; }
      }
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) this._voiceChunks.push(e.data); };
      rec.start(500);
      this._voiceRecorder = rec;
      this._recordingVoice = true;
      this._voiceRecStartTs = Date.now();
      const statusEl = document.getElementById('voiceRecStatus');
      const btnEl = document.getElementById('voiceRecBtn');
      if (btnEl) { btnEl.classList.add('recording'); btnEl.textContent = '🔴 录音中...'; }
      // 计时
      this._voiceTimerId = setInterval(() => {
        const sec = Math.floor((Date.now() - this._voiceRecStartTs) / 1000);
        if (statusEl) statusEl.textContent = '录音中 ' + this._formatTime(sec);
      }, 500);
    } catch (err) {
      const msg = (err.name === 'NotAllowedError' || err.name === 'SecurityError')
        ? '无法访问麦克风，请在浏览器设置里开启权限'
        : ('录音失败：' + (err.message || err));
      Utils.showToast(msg, 'error');
    }
  },

  _stopVoiceRecording() {
    if (!this._recordingVoice) return;
    this._recordingVoice = false;
    if (this._voiceTimerId) { clearInterval(this._voiceTimerId); this._voiceTimerId = null; }
    const rec = this._voiceRecorder;
    if (!rec || rec.state === 'inactive') {
      this._cleanupVoiceStream();
      return;
    }
    const self = this;
    rec.onstop = async function() {
      const durationSec = Math.max(1, Math.floor((Date.now() - self._voiceRecStartTs) / 1000));
      if (self._voiceChunks.length === 0) {
        Utils.showToast('⚠️ 录音为空，请重试', 'warning');
        self._cleanupVoiceStream();
        self._renderEditPanel();
        return;
      }
      const blob = new Blob(self._voiceChunks, { type: rec.mimeType || 'audio/webm' });
      // 删除旧语音
      if (self._editingVoiceId) {
        try { await StorageAdapter.remove(self._editingVoiceId); } catch (e) {}
      }
      const voiceId = 'voice_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      try {
        await StorageAdapter.set(voiceId, blob, 'parent_voice');
        self._editingVoiceId = voiceId;
        self._editingVoiceDuration = durationSec;
        Utils.showToast('✅ 语音已录（' + self._formatTime(durationSec) + '）', 'success');
        self._renderEditPanel();
      } catch (e) {
        Utils.showToast('❌ 语音保存失败', 'error');
      }
      self._cleanupVoiceStream();
    };
    try { rec.stop(); } catch (e) { self._cleanupVoiceStream(); }
  },

  _cleanupVoiceStream() {
    if (this._voiceStream) {
      try { this._voiceStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    this._voiceStream = null;
    this._voiceRecorder = null;
    this._voiceChunks = [];
  },

  /**
   * 试听编辑中的语音
   */
  async _playEditingVoice(btnEl) {
    if (!this._editingVoiceId) {
      Utils.showToast('⚠️ 还没有录语音', 'warning');
      return;
    }
    if (btnEl) {
      const original = btnEl.innerHTML;
      btnEl.innerHTML = '⏸ 播放中...';
      btnEl.disabled = true;
      try {
        await LessonAudio.playFromTimestamp(this._editingVoiceId, 0, 'edit_voice_' + this._editingVoiceId, function() {
          btnEl.innerHTML = original;
          btnEl.disabled = false;
        });
      } catch (e) {
        btnEl.innerHTML = original;
        btnEl.disabled = false;
      }
    } else {
      await LessonAudio.playFromTimestamp(this._editingVoiceId, 0);
    }
  },

  /**
   * 删除编辑中的语音
   */
  async _deleteEditingVoice() {
    if (!this._editingVoiceId) return;
    try { await StorageAdapter.remove(this._editingVoiceId); } catch (e) {}
    this._editingVoiceId = null;
    this._editingVoiceDuration = 0;
    if (this._editingPin) this._editingPin.parentVoiceId = null;
    this._renderEditPanel();
    Utils.showToast('已删除语音', 'info');
  },

  /**
   * 试听列表中的语音
   */
  async _playVoice(feedbackId, btnEl) {
    const f = Feedback.find(feedbackId);
    if (!f || !f.parentVoiceId) {
      Utils.showToast('⚠️ 无语音', 'warning');
      return;
    }
    const original = btnEl.innerHTML;
    btnEl.innerHTML = '⏸ 播放中...';
    btnEl.disabled = true;
    try {
      await LessonAudio.playFromTimestamp(f.parentVoiceId, 0, 'fb_voice_' + f.id, function() {
        btnEl.innerHTML = original;
        btnEl.disabled = false;
      });
    } catch (e) {
      btnEl.innerHTML = original;
      btnEl.disabled = false;
    }
  },

  /**
   * 保存图钉
   */
  _savePin() {
    if (!this._editingPin) return;
    const pieceEl = document.getElementById('pinEditPiece');
    const locEl = document.getElementById('pinEditLocation');
    const noteEl = document.getElementById('pinEditNote');
    const piece = pieceEl ? pieceEl.value.trim() : this._editingPin.pieceTitle;
    const loc = locEl ? locEl.value.trim() : '';
    const note = noteEl ? noteEl.value.trim() : '';
    if (!piece) {
      Utils.showToast('⚠️ 请填曲子名', 'warning');
      return;
    }
    // 获取图钉所在页的照片 ID
    const photoPage = this._editingPin.photoPage || 1;
    const allPhotoIds = SheetAnnotator.getPhotoBlobIds();
    const pageIdx = photoPage - 1;
    const photoId = (allPhotoIds.length > pageIdx) ? allPhotoIds[pageIdx] : (allPhotoIds.length > 0 ? allPhotoIds[0] : null);
    const payload = {
      lessonId: this._lessonId,
      timestamp: this._editingPin.timestamp,
      pieceTitle: piece,
      sheetPhotoId: photoId,
      photoPage: photoPage,
      pinX: this._editingPin.pinX,
      pinY: this._editingPin.pinY,
      locationLabel: loc,
      category: this._editingPin.category,
      teacherNote: note,
      parentVoiceId: this._editingVoiceId
    };
    if (this._editingPin.id) {
      Feedback.update(this._editingPin.id, payload);
      Utils.showToast('✅ 已更新', 'success');
    } else {
      Feedback.create(payload);
      Utils.showToast('✅ 已添加图钉', 'success');
    }
    this._editingPin = null;
    this._editingVoiceId = null;
    this._closeEditPanel();
    this._refreshFeedbackList();
  },

  /**
   * 从编辑面板中删除图钉
   */
  async _deletePinFromEdit() {
    if (!this._editingPin || !this._editingPin.id) return;
    if (!confirm('确定删除这个图钉？')) return;
    var fbId = this._editingPin.id;
    var f = Feedback.find(fbId);
    if (f && f.parentVoiceId) {
      try { await StorageAdapter.remove(f.parentVoiceId); } catch (e) {}
    }
    Feedback.remove(fbId);
    this._editingPin = null;
    this._editingVoiceId = null;
    this._closeEditPanel();
    this._refreshFeedbackList();
    Utils.showToast('已删除图钉', 'info');
  },

  _closeEditPanel() {
    // 如果正在录音，先停
    if (this._recordingVoice) this._stopVoiceRecording();
    const panel = document.getElementById('pinEditPanel');
    if (panel) panel.remove();
    this._editingPin = null;
    // 注意：不清理 _editingVoiceId，因为下次打开同一图钉时会从 feedback 重新读
  },

  /**
   * 删除反馈
   */
  async _deleteFeedback(feedbackId) {
    const f = Feedback.find(feedbackId);
    if (!f) return;
    if (!confirm('确定删除这条反馈？图钉和语音都会一起删除。')) return;
    // 删除关联语音
    if (f.parentVoiceId) {
      try { await StorageAdapter.remove(f.parentVoiceId); } catch (e) {}
    }
    Feedback.remove(feedbackId);

    // 标记关联 marker 为已整理（reviewed=true），防止 saveLesson 的自动生成逻辑
    // 在下一次保存课程时把这条已删除的图钉重新创建出来
    if (f.markerId && this._lessonId) {
      const lessons = DB.lessons();
      const li = lessons.findIndex(l => String(l.id) === String(this._lessonId));
      if (li >= 0) {
        const marker = (lessons[li].audioMarkers || []).find(m => m.id === f.markerId);
        if (marker && !marker.reviewed) {
          marker.reviewed = true;
          DB.saveLessons(lessons);
        }
      }
    }

    // 照片清理：删除图钉后，如果该照片不再被任何 feedback / 会话引用，
    // 则从课程曲目的 sheetPhotoIds 中移除该引用（否则照片会残留并在重新打开时复活）
    if (f.sheetPhotoId) {
      const otherFbs = Feedback.all().filter(x => x.sheetPhotoId === f.sheetPhotoId && x.id !== feedbackId);
      const anchoredInSession = (this._sessionPiecePhotos[this._pieceTitle] || []).indexOf(f.sheetPhotoId) >= 0;
      if (otherFbs.length === 0 && !anchoredInSession) {
        const lessons = DB.lessons();
        let changed = false;
        lessons.forEach(l => {
          (l.pieces || []).forEach(p => {
            const ids = p.sheetPhotoIds || [];
            const idx = ids.indexOf(f.sheetPhotoId);
            if (idx >= 0) { ids.splice(idx, 1); changed = true; }
          });
        });
        if (changed) DB.saveLessons(lessons);
      }
      // 全部清理后再判断是否还挂在任何课程/会话上，若无则删除 blob
      const stillAnchored = DB.lessons().some(l =>
        (l.pieces || []).some(p => (p.sheetPhotoIds || []).indexOf(f.sheetPhotoId) >= 0)
      );
      if (otherFbs.length === 0 && !anchoredInSession && !stillAnchored) {
        try { await StorageAdapter.remove(f.sheetPhotoId); } catch (e) {}
      }
    }
    this._refreshFeedbackList();
    Utils.showToast('已删除', 'info');
  },

  /**
   * 关闭整个整理界面
   */
  close() {
    if (!this._open) return;
    // 先关编辑面板
    this._closeEditPanel();
    // 释放 SheetAnnotator
    SheetAnnotator.destroy();
    const overlay = document.getElementById('feedbackOrganizerOverlay');
    if (overlay) overlay.remove();
    this._open = false;
    this._pieceTitle = '';
    this._lessonId = '';
    this._currentFeedbacks = [];
    // 触发今日页刷新（如果用户切到今日页能看到新反馈）
    Events.emit('feedback:updated');
  },

  /**
   * 获取当前课程已过时间（秒），用于新建图钉时自动记录时间戳
   * 录音中取录音时间，未录音取课程开始时间
   * @returns {number|null}
   */
  _getCurrentLessonTimestamp() {
    if (typeof LessonMarkers !== 'undefined' && typeof LessonMarkers._elapsedSec === 'function') {
      var sec = LessonMarkers._elapsedSec();
      return sec > 0 ? sec : null;
    }
    return null;
  },

  _formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }
};

window.FeedbackOrganizer = FeedbackOrganizer;

// 编辑面板渲染后自动绑定录音按钮
const _origRenderEditPanel = FeedbackOrganizer._renderEditPanel.bind(FeedbackOrganizer);
FeedbackOrganizer._renderEditPanel = function() {
  _origRenderEditPanel();
  // 等 DOM 挂载
  setTimeout(() => {
    FeedbackOrganizer._bindVoiceRecorder && FeedbackOrganizer._bindVoiceRecorder();
  }, 0);
};
