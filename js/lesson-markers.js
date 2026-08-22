"use strict";

/* ==========================================
   ⏱ 课堂标记 - 背景录音 + 时间戳书签
   ==========================================
   spec v1.1 (5.2): 全程连续后台录音 + 书签标记
   - 顶部：开始/停止录音 + 录音指示器
   - 每首曲目卡片内：标记此刻 + 书签列表
   - 书签只记录时间戳，不再有按标记片段录音
   - 保存课程时自动把有备注的标记转为 FeedbackItem

   集成方式：
     - showLessonForm 渲染表单时调 LessonMarkers.init(lesson)
     - LessonMarkers.render() 渲染顶部录音控制区
     - 每首曲目卡片底部有标记区域，由 renderMarkersForPiece 渲染
     - saveLesson 调 LessonMarkers.getMarkers() + getLessonAudioId()
   ========================================== */

const LessonMarkers = {
  /** @type {AudioMarker[]} */
  _markers: [],
  _startTime: 0,
  _timerId: null,
  _lessonId: null,

  // 背景录音状态（多段）
  _segments: [],            // [{id, startSec, durationSec}] 已保存的录音段
  _lessonAudioId: null,     // 首段 id（向后兼容）
  _audioDurationSec: 0,     // 课程时间轴总时长（= 最后一段 endSec）
  _segmentStartSec: 0,      // 当前正在录的段的起始秒数
  _recordingStartTs: 0,
  _isRecording: false,
  _recordingTimerId: null,

  /**
   * 初始化（每次打开课程表单时调用）
   * @param {Lesson|null} lesson 编辑时传入现有 lesson，新增时传 null
   */
  init(lesson) {
    this._lessonId = lesson ? lesson.id : null;
    // 加载 audioMarkers（v8 迁移后字段名）
    this._markers = (lesson && Array.isArray(lesson.audioMarkers))
      ? lesson.audioMarkers.map(m => ({ ...m }))
      : (lesson && Array.isArray(lesson.videoMarkers))
        ? lesson.videoMarkers.map(m => ({ ...m }))
        : [];
    // 加载多段录音（v9 新字段 lessonAudios，向后兼容旧 lessonAudioId）
    this._segments = (lesson && Array.isArray(lesson.lessonAudios))
      ? lesson.lessonAudios.map(s => ({ ...s }))
      : (lesson && lesson.lessonAudioId)
        ? [{ id: lesson.lessonAudioId, startSec: 0, durationSec: lesson.audioDurationSec || 0 }]
        : [];
    this._lessonAudioId = this._segments.length ? this._segments[0].id : null;
    this._audioDurationSec = this._segments.length
      ? this._segments[this._segments.length - 1].startSec + this._segments[this._segments.length - 1].durationSec
      : 0;
    this._isRecording = false;
    this._recordingStartTs = 0;
    this._segmentStartSec = 0;
    // 新增课程：从现在开始计时；编辑课程：不再计时
    this._startTime = lesson ? 0 : Date.now();
    this._timerId = null;

    // 监听 modal 被清空，自动停录音 + 停计时器
    this._cleanupObserver && this._cleanupObserver.disconnect();
    const container = document.getElementById('modalContainer');
    if (container) {
      this._cleanupObserver = new MutationObserver(() => {
        if (!container.innerHTML.trim()) {
          this.stopTimer();
          if (this._isRecording) this._abortRecording();
          this._cleanupObserver.disconnect();
          this._cleanupObserver = null;
        }
      });
      this._cleanupObserver.observe(container, { childList: true });
    }
  },

  /**
   * 渲染顶部录音控制区域 HTML
   * @returns {string}
   */
  render() {
    // 新增和编辑模式都支持录音（保存=暂存，编辑时可继续追加录音段）
    return `
      <div class="form-group lesson-markers-group">
        <label class="form-label">⏱ 课堂标记</label>
        <div class="marker-tap-area" id="lessonRecordArea">
          <div id="recordControlWrap">
            ${this._renderRecordControl()}
          </div>
          <div class="marker-tap-hint">开始录音后，在下方曲子卡片内点「标记此刻」记录书签</div>
        </div>
      </div>
    `;
  },

  /**
   * 渲染录音控制按钮（根据状态切换）
   * @returns {string}
   */
  _renderRecordControl() {
    if (this._isRecording) {
      var segInfo = this._segments.length ? '（已存 ' + this._segments.length + ' 段）' : '';
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="display:inline-flex;align-items:center;gap:4px;color:#ff5964;font-size:0.85rem;font-weight:600">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#ff5964;animation:pulse-rec 1s infinite"></span>' +
          '录音中 <span id="recordingDuration">' + this._formatTime(this._getRecordingSec()) + '</span>' +
          '<span style="color:var(--text-3);font-weight:400;font-size:0.72rem">' + segInfo + '</span>' +
        '</span>' +
        '<button type="button" class="btn btn-danger btn-sm" onclick="LessonMarkers.stopRecording()" style="font-size:0.75rem;padding:4px 12px">⏹ 停止</button>' +
      '</div>';
    }
    if (this._segments.length) {
      var segCount = this._segments.length > 1 ? '（' + this._segments.length + ' 段）' : '';
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="color:var(--accent-green);font-size:0.8rem">✅ 已录音 ' + this._formatTime(this._audioDurationSec) + segCount + '</span>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="LessonMarkers.startRecording()" style="font-size:0.7rem;padding:3px 10px">继续录音</button>' +
      '</div>';
    }
    return '<button type="button" class="btn btn-primary btn-sm" onclick="LessonMarkers.startRecording()" style="font-size:0.8rem;padding:6px 16px;margin-bottom:8px">🎙 开始录音</button>';
  },

  /**
   * 刷新录音控制区 UI
   */
  _refreshRecordControl() {
    var wrap = document.getElementById('recordControlWrap');
    if (wrap) wrap.innerHTML = this._renderRecordControl();
  },

  /**
   * 渲染指定曲目的标记 HTML（嵌入曲目卡片内）
   * @param {string} pieceName 曲子名称
   * @returns {string}
   */
  renderMarkersForPiece(pieceName) {
    var headerRow =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;margin-bottom:4px;border-top:1px dashed var(--border-2)">' +
        '<span style="font-size:0.7rem;color:var(--text-3);font-weight:600">⏱ 本课标记</span>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<button type="button" title="整理：上传曲谱照片 + 语音图钉"' +
          ' onclick="LessonMarkers._openOrganizerForPiece(this)"' +
          (pieceName ? '' : ' disabled') +
          ' style="font-size:0.7rem;padding:3px 10px;border-radius:6px;border:1px solid rgba(245,160,152,0.35);' +
          'background:rgba(245,160,152,0.1);color:var(--accent-primary);cursor:pointer;' +
          (pieceName ? '' : 'opacity:0.4;cursor:not-allowed') + '">🎼 课堂记录</button>' +
        '</div>' +
      '</div>';

    if (!pieceName) {
      return headerRow + '<p class="text-xs" style="color:var(--text-4);text-align:center;padding:6px 0 2px">先选择曲目后可标记</p>';
    }
    var markers = this._markers.filter(m => m.pieceTitle === pieceName);
    if (markers.length === 0) {
      return headerRow + '<p class="text-xs" style="color:var(--text-4);text-align:center;padding:6px 0 2px">还没有标记，点上方按钮添加</p>';
    }

    var btnStylePlay = 'padding:3px 8px;font-size:0.72rem;border-radius:5px;border:1px solid rgba(94,106,210,0.35);background:rgba(94,106,210,0.1);color:#a5ade8;cursor:pointer';
    var btnStyleDelete = 'padding:3px 8px;font-size:0.72rem;border-radius:5px;border:1px solid rgba(255,89,100,0.3);background:rgba(255,89,100,0.08);color:var(--accent-red);cursor:pointer';

    return headerRow + markers.map((m) => {
      var time = this._formatTime(m.timestamp);
      var labelInput = '<input type="text" class="marker-label-input"' +
        ' value="' + Utils.escape(m.label || '') + '"' +
        ' placeholder="备注（可选）"' +
        ' onchange="LessonMarkers.updateLabel(\'' + m.id + '\', this.value)"' +
        ' style="width:100%;padding:3px 8px;font-size:0.76rem;border:1px solid var(--border-2);border-radius:6px;background:rgba(255,255,255,0.04);color:var(--text-1);margin-bottom:4px">';

      // 播放按钮：有已保存的录音段才显示
      var playBtn = '';
      if (this._segments.length || this._isRecording) {
        playBtn = '<button type="button" class="marker-play-btn" data-marker-id="' + m.id + '"' +
          ' onclick="LessonMarkers._playMarker(\'' + m.id + '\', this)"' +
          ' style="' + btnStylePlay + '">▶ ' + time + '</button>';
      } else {
        playBtn = '<span style="color:var(--text-4);font-family:monospace;font-size:0.72rem;min-width:36px">' + time + '</span>';
      }

      var deleteBtn = '<button type="button" onclick="LessonMarkers.removeMark(\'' + m.id + '\')" title="删除标记" style="' + btnStyleDelete + '">✕</button>';

      return '<div class="marker-item" data-marker-row="' + m.id + '" style="padding:5px 0 6px;border-bottom:1px solid var(--border-2)">' +
        '<div style="display:flex;align-items:flex-start;gap:6px">' +
          '<div style="flex:1;min-width:0">' +
            labelInput +
            '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">' +
              playBtn +
              '<span style="flex:1"></span>' +
              deleteBtn +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  },

  /* ==========================================
     录音控制
     ========================================== */

  /**
   * 开始背景录音（支持多段：每段在课程时间轴上有独立 startSec）
   */
  async startRecording() {
    // 首次录音前知情确认（隐私说明，只弹一次）
    if (typeof window.ensureRecordingConsent === 'function' && !window.ensureRecordingConsent()) return;

    // 计算新段的 startSec = 当前课程已用时
    var segmentStartSec = this._elapsedSec();

    var self = this;
    var success = await LessonAudio.startLessonRecording(
      function(sec) {
        // sec 已包含 segmentStartSec 偏移（课程时间轴）
        var durEl = document.getElementById('recordingDuration');
        if (durEl) durEl.textContent = self._formatTime(sec);
      },
      segmentStartSec,
      // onAutoSave：切后台自动保存回调
      function(segment) {
        self._segments.push(segment);
        self._lessonAudioId = self._segments[0].id;
        self._audioDurationSec = segment.startSec + segment.durationSec;
        self._isRecording = false;
        self._recordingStartTs = 0;
        self._refreshRecordControl();
        self.refreshAllPieceMarkers();
        Utils.showToast('📋 切后台已自动保存录音段（' + self._formatTime(segment.durationSec) + '），可点「继续录音」续上', 'info');
      }
    );

    if (success) {
      this._segmentStartSec = segmentStartSec;
      this._isRecording = true;
      this._recordingStartTs = Date.now();
      this._refreshRecordControl();
      this.refreshAllPieceMarkers();
      Utils.showToast('🎙 录音开始，上课时点「标记此刻」记录书签', 'info');
    }
  },

  /**
   * 停止背景录音（手动停止，保存当前段）
   */
  async stopRecording() {
    if (!this._isRecording) return;

    var result = await LessonAudio.stopLessonRecording();
    this._isRecording = false;
    this._recordingStartTs = 0;

    if (result) {
      // result = {blobId, startSec, durationSec}
      this._segments.push({ id: result.blobId, startSec: result.startSec, durationSec: result.durationSec });
      this._lessonAudioId = this._segments[0].id;
      this._audioDurationSec = result.startSec + result.durationSec;
    }
    this._refreshRecordControl();
    this.refreshAllPieceMarkers();
  },

  /**
   * 放弃录音（modal 关闭时调用）
   */
  _abortRecording() {
    if (this._isRecording) {
      LessonAudio.abortRecording();
      this._isRecording = false;
      this._recordingStartTs = 0;
    }
  },

  /**
   * 从书签时间点回放课堂录音（多段：先定位段，再从段内偏移播放）
   * @param {string} markerId
   * @param {HTMLElement} btn
   */
  _playMarker(markerId, btn) {
    var m = this._markers.find(x => x.id === markerId);
    if (!m) return;
    if (!this._segments.length) {
      Utils.showToast('无课堂录音可回放', 'warning');
      return;
    }

    var playId = 'marker_' + markerId;
    if (LessonAudio.isPlaying(playId)) {
      LessonAudio.stopPlayback();
      btn.textContent = '▶ ' + this._formatTime(m.timestamp);
      return;
    }

    // 多段录音：按 timestamp 定位到正确的段
    var seg = LessonAudio.findSegmentForTimestamp(this._segments, m.timestamp);
    if (!seg) {
      Utils.showToast('该时间点无录音', 'warning');
      return;
    }

    btn.textContent = '⏸ 播放中...';
    var self = this;
    LessonAudio.playFromTimestamp(seg.id, seg.offsetSec, playId, function() {
      var row = document.querySelector('[data-marker-row="' + markerId + '"] .marker-play-btn');
      if (row) row.textContent = '▶ ' + self._formatTime(m.timestamp);
    });
  },

  /* ==========================================
     标记操作
     ========================================== */

  /**
   * 从曲目卡片元素读取曲名
   * @param {HTMLElement} cardEl
   * @returns {string}
   */
  _getPieceNameFromCard(cardEl) {
    if (!cardEl) return '';
    var nameSelect = cardEl.querySelector('.piece-name-select');
    var nameInput = cardEl.querySelector('.piece-name-input');
    if (nameSelect) {
      var opt = nameSelect.options[nameSelect.selectedIndex];
      return (opt && opt.dataset.name) || '';
    } else if (nameInput) {
      return (nameInput.value || '').trim();
    }
    return '';
  },

  /**
   * 「整理曲谱」按钮点击：从曲子卡片进入整理界面（方案B：以曲子为单位）
   * @param {HTMLElement} btn 点击的按钮元素（用于向上找卡片）
   */
  _openOrganizerForPiece(btn) {
    var cardEl = btn.closest('.lesson-piece-card');
    var pieceName = this._getPieceNameFromCard(cardEl);
    if (!pieceName) {
      Utils.showToast('⚠️ 请先选择曲目', 'warning');
      return;
    }
    if (typeof FeedbackOrganizer !== 'undefined' && typeof FeedbackOrganizer.open === 'function') {
      FeedbackOrganizer.open(pieceName, this._lessonId);
    } else {
      Utils.showToast('⚠️ 反馈整理模块未加载', 'warning');
    }
  },

  /**
   * 刷新某张曲目卡片的标记区
   * @param {HTMLElement} cardEl
   */
  refreshPieceMarkersInCard(cardEl) {
    if (!cardEl) return;
    var pieceName = this._getPieceNameFromCard(cardEl);
    var area = cardEl.querySelector('.piece-markers-area');
    if (!area) return;
    area.innerHTML = this.renderMarkersForPiece(pieceName);
  },

  /**
   * 刷新所有曲目卡片的标记区
   */
  refreshAllPieceMarkers() {
    document.querySelectorAll('.lesson-piece-card').forEach(card => {
      this.refreshPieceMarkersInCard(card);
    });
  },

  /**
   * 为指定曲子添加一个书签标记
   * 时间戳基于课程时间轴（统一基准，无论是否在录音）
   * @param {string} pieceName 曲子名称
   */
  addMarkForPiece(pieceName) {
    if (this._lessonId !== null) return; // 编辑模式禁用
    if (!pieceName) {
      Utils.showToast('⚠️ 请先选择这首曲子', 'warning');
      return;
    }

    // 时间戳 = 课程已用时（统一基准）
    var ts = this._elapsedSec();

    var marker = {
      id: 'mk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: ts,
      pieceTitle: pieceName,
      label: '',
      reviewed: false,
      createdAt: Date.now()
    };
    this._markers.push(marker);
    this.refreshAllPieceMarkers();
    Utils.showToast('⏱ 已标记「' + pieceName + '」 ' + this._formatTime(ts), 'success');
  },

  /* ==========================================
     计时器
     ========================================== */

  /**
   * 启动上课计时器（新增课程时）
   */
  startTimer() {
    if (this._lessonId !== null) return;
    this._startTime = this._startTime || Date.now();
    var self = this;
    var update = function() {
      var elapsed = Math.floor((Date.now() - self._startTime) / 1000);
      var el = document.getElementById('markerTimer');
      if (el) el.textContent = self._formatTime(elapsed);
    };
    update();
    this._timerId = setInterval(update, 1000);
  },

  /**
   * 停止计时器
   */
  stopTimer() {
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  },

  /* ==========================================
     数据获取
     ========================================== */

  /**
   * 删除标记
   */
  removeMark(id) {
    this._markers = this._markers.filter(m => m.id !== id);
    this.refreshAllPieceMarkers();
  },

  /**
   * 更新标记的备注
   */
  updateLabel(id, value) {
    var m = this._markers.find(m => m.id === id);
    if (m) m.label = value.trim();
  },

  /**
   * 获取当前 markers（saveLesson 调用）
   * @returns {AudioMarker[]}
   */
  getMarkers() {
    return this._markers.slice();
  },

  /**
   * 获取课堂录音 blob ID（首段，向后兼容）
   * @returns {string|null}
   */
  getLessonAudioId() {
    return this._lessonAudioId;
  },

  /**
   * 获取录音时长（秒，课程时间轴总时长）
   * @returns {number}
   */
  getAudioDurationSec() {
    return this._audioDurationSec;
  },

  /**
   * 获取所有录音段（saveLesson 调用）
   * @returns {Array<{id:string, startSec:number, durationSec:number}>}
   */
  getLessonAudios() {
    return this._segments.slice();
  },

  /* ==========================================
     工具
     ========================================== */

  /**
   * 获取当前课程已用时秒数（课程时间轴基准）
   * 录音中：segmentStartSec + 本段已录秒数
   * 未录音：从开课时间起算
   * @returns {number}
   */
  _elapsedSec() {
    if (this._isRecording && this._recordingStartTs) {
      return this._segmentStartSec + Math.floor((Date.now() - this._recordingStartTs) / 1000);
    }
    // 编辑模式：从已有录音末尾继续（保存=暂存，可继续追加录音段）
    if (this._lessonId !== null) return this._audioDurationSec;
    if (!this._startTime) return 0;
    return Math.floor((Date.now() - this._startTime) / 1000);
  },

  /**
   * 获取当前录音段已录秒数（UI 显示用）
   * @returns {number}
   */
  _getRecordingSec() {
    if (!this._recordingStartTs) return 0;
    return this._segmentStartSec + Math.floor((Date.now() - this._recordingStartTs) / 1000);
  },

  /**
   * 格式化秒数为 HH:MM:SS
   * @param {number} sec
   * @returns {string}
   */
  _formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return h > 0 ? pad(h) + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  }
};

window.LessonMarkers = LessonMarkers;
