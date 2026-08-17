"use strict";

/* ==========================================
   🎙 课堂背景录音 + 播放
   ==========================================
   spec v1.1 (5.2): 全程连续后台录音 + 时间戳书签
   流程：开始录音 → 持续录制整节课 → 停止录音 →
         存入 IndexedDB（一个 blob）→ 从书签时间点回放

   也提供通用播放功能（今日页反馈播放复用）
   ========================================== */

const LessonAudio = {
  // ── 背景录音状态 ──
  _activeStream: null,
  _recorder: null,
  _chunks: [],
  _recordingStartTs: 0,
  _segmentStartSec: 0, // 当前段在课程时间轴上的起始秒数（多段录音用）
  _timerId: null,
  _onTickCallback: null,
  _onAutoSaveCallback: null, // 切后台自动保存后的回调（通知 LessonMarkers 刷新 UI）

  // ── 播放状态 ──
  _audioEl: null,
  _playingId: null,

  /* ==========================================
     背景录音
     ========================================== */

  /**
   * 开始全程背景录音
   * @param {(seconds:number)=>void} [onTick] 每秒回调，用于更新 UI 时长显示
   * @param {number} [startSec=0] 本段在课程时间轴上的起始秒数（多段录音用）
   * @param {Function} [onAutoSave] 切后台自动保存后的回调 (segment)=>void
   * @returns {Promise<boolean>} 是否成功开始
   */
  async startLessonRecording(onTick, startSec, onAutoSave) {
    if (this._recorder && this._recorder.state === 'recording') return false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Utils.showToast('您的浏览器不支持录音功能', 'error');
      return false;
    }

    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._activeStream = stream;
      this._chunks = [];

      var mime = '';
      var candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];
      for (var i = 0; i < candidates.length; i++) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) {
          mime = candidates[i];
          break;
        }
      }

      var recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this._chunks.push(e.data); };

      recorder.start(1000); // timeslice 1s（后台录音，减少回调频率）
      this._recorder = recorder;
      this._recordingStartTs = Date.now();
      this._segmentStartSec = startSec || 0;
      this._onTickCallback = onTick || null;
      this._onAutoSaveCallback = onAutoSave || null;

      // 计时器
      this._timerId = setInterval(() => {
        var sec = this._segmentStartSec + Math.floor((Date.now() - this._recordingStartTs) / 1000);
        if (typeof this._onTickCallback === 'function') this._onTickCallback(sec);
      }, 500);

      // 绑定切后台自动保存（只绑一次）
      this._bindVisibilityHandler();

      return true;
    } catch (err) {
      console.error('麦克风授权失败:', err);
      var msg = (err.name === 'NotAllowedError' || err.name === 'SecurityError')
        ? '无法访问麦克风，请在浏览器设置里开启权限'
        : ('录音失败：' + (err.message || err));
      Utils.showToast(msg, 'error');
      this._cleanupStream();
      return false;
    }
  },

  /**
   * 停止背景录音，保存到 IndexedDB
   * @returns {Promise<{blobId:string, startSec:number, durationSec:number}|null>}
   */
  async stopLessonRecording() {
    if (!this._recorder || this._recorder.state !== 'recording') return null;

    var segmentStartSec = this._segmentStartSec;

    return new Promise((resolve) => {
      var durationSec = Math.floor((Date.now() - this._recordingStartTs) / 1000);

      this._recorder.onstop = async () => {
        var mime = this._recorder && this._recorder.mimeType ? this._recorder.mimeType : 'audio/webm';
        var blob = new Blob(this._chunks, { type: mime });

        // 时长太短不保存
        if (blob.size < 1000 || durationSec < 1) {
          this._cleanupStream();
          this._clearTimer();
          Utils.showToast('录音时间太短，未保存', 'warning');
          resolve(null);
          return;
        }

        try {
          var blobId = 'lesson_audio_' + Date.now();
          await DB.saveBlob(blobId, blob, 'lesson_recording');
          this._cleanupStream();
          this._clearTimer();
          Utils.showToast('🎙 录音已保存（' + durationSec + ' 秒）', 'success');
          resolve({ blobId: blobId, startSec: segmentStartSec, durationSec: durationSec });
        } catch (err) {
          console.error('录音保存失败:', err);
          Utils.showToast('保存失败：' + (err.message || err), 'error');
          this._cleanupStream();
          this._clearTimer();
          resolve(null);
        }
      };

      try { this._recorder.stop(); } catch (_) {}
    });
  },

  /**
   * 是否正在录音
   * @returns {boolean}
   */
  isRecording() {
    return !!(this._recorder && this._recorder.state === 'recording');
  },

  /**
   * 获取当前录音时长（秒）
   * @returns {number}
   */
  getRecordingDuration() {
    if (!this._recordingStartTs) return 0;
    return Math.floor((Date.now() - this._recordingStartTs) / 1000);
  },

  /**
   * 放弃录音（不保存，直接清理）
   */
  abortRecording() {
    if (this._recorder) {
      try { this._recorder.stop(); } catch (_) {}
    }
    this._cleanupStream();
    this._clearTimer();
  },

  _cleanupStream() {
    if (this._activeStream) {
      this._activeStream.getTracks().forEach(t => { try { t.stop(); } catch(_){} });
      this._activeStream = null;
    }
    this._recorder = null;
    this._chunks = [];
  },

  _clearTimer() {
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
    this._onTickCallback = null;
  },

  /* ==========================================
     切后台自动保存（方案 A：不丢录音数据）
     ========================================== */

  _visibilityBound: false,

  /**
   * 绑定 visibilitychange 监听（只绑一次）
   * 页面切到后台时，如果正在录音，立即停止并保存当前段
   */
  _bindVisibilityHandler() {
    if (this._visibilityBound) return;
    this._visibilityBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRecording()) {
        // 切到后台：自动保存当前录音段
        this._autoSaveForBackground();
      }
    });

    // iOS Safari 的 pagehide（页面被系统挂起）
    window.addEventListener('pagehide', () => {
      if (this.isRecording()) {
        this._autoSaveForBackground();
      }
    });
  },

  /**
   * 切后台自动保存当前录音段
   * 异步保存，保存成功后通过回调通知 LessonMarkers 刷新 UI
   */
  async _autoSaveForBackground() {
    if (!this._recorder || this._recorder.state !== 'recording') return;
    var segmentStartSec = this._segmentStartSec;
    var durationSec = Math.floor((Date.now() - this._recordingStartTs) / 1000);

    // 同步创建 Blob（趁页面还没完全挂起）
    var mime = this._recorder.mimeType || 'audio/webm';
    var blob = new Blob(this._chunks, { type: mime });

    // 停止 recorder 并清理
    try { this._recorder.stop(); } catch (_) {}
    this._cleanupStream();
    this._clearTimer();

    // 太短不保存
    if (blob.size < 1000 || durationSec < 1) return;

    try {
      var blobId = 'lesson_audio_' + Date.now();
      await DB.saveBlob(blobId, blob, 'lesson_recording');
      var segment = { id: blobId, startSec: segmentStartSec, durationSec: durationSec };
      console.log('📋 切后台自动保存录音段:', segment);
      // 通知 LessonMarkers 刷新 UI
      if (typeof this._onAutoSaveCallback === 'function') {
        this._onAutoSaveCallback(segment);
      }
    } catch (err) {
      console.error('切后台自动保存失败:', err);
    }
  },

  /* ==========================================
     多段录音：按时间戳定位段
     ========================================== */

  /**
   * 从多段录音中找到包含指定时间戳的那一段
   * @param {Array<{id:string, startSec:number, durationSec:number}>} segments
   * @param {number} timestamp 书签时间戳（课程时间轴上的秒数）
   * @returns {{id:string, startSec:number, durationSec:number, offsetSec:number}|null}
   *   offsetSec = 在该段内的偏移秒数（用于 seek）
   */
  findSegmentForTimestamp(segments, timestamp) {
    if (!Array.isArray(segments) || !segments.length) return null;
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var endSec = seg.startSec + seg.durationSec;
      if (timestamp >= seg.startSec && timestamp < endSec) {
        return { id: seg.id, startSec: seg.startSec, durationSec: seg.durationSec, offsetSec: timestamp - seg.startSec };
      }
    }
    // 时间戳超出所有段：返回最后一段的末尾（或第一段从头）
    var last = segments[segments.length - 1];
    if (timestamp >= last.startSec + last.durationSec) {
      return { id: last.id, startSec: last.startSec, durationSec: last.durationSec, offsetSec: last.durationSec };
    }
    return { id: segments[0].id, startSec: segments[0].startSec, durationSec: segments[0].durationSec, offsetSec: 0 };
  },

  /* ==========================================
     播放（通用，课堂书签回放 + 今日页反馈播放共用）
     ========================================== */

  /**
   * 从指定时间点开始播放音频
   * 说明：不等 loadedmetadata 事件，设置 src 后立即 play，
   *       尽量靠近用户点击手势上下文，减少浏览器自动播放拦截。
   * @param {string} blobId 音频 blob ID
   * @param {number} [startTimestamp=0] 开始播放的时间点（秒）
   * @param {string} [playId] 播放标识（用于 isPlaying 判断）
   * @param {Function} [onEnd] 播放结束回调（播放出错/被拦截时也会调用，便于调用方恢复 UI）
   */
  async playFromTimestamp(blobId, startTimestamp, playId, onEnd) {
    this.stopPlayback();
    try {
      // StorageAdapter.get 返回 {id, blob, type, createdAt}，真正的 Blob 在 .blob 字段里
      var result = await DB.getBlob(blobId);
      if (!result || !result.blob) {
        Utils.showToast('音频已删除或不存在', 'error');
        if (typeof onEnd === 'function') onEnd();
        return;
      }
      var url = URL.createObjectURL(result.blob);
      var a = new Audio();
      this._audioEl = a;
      this._playingId = playId || blobId;

      // 统一的清理函数，成功/失败/出错都会走到这里
      var cleaned = false;
      var cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        try { URL.revokeObjectURL(url); } catch (_) {}
        this._audioEl = null;
        this._playingId = null;
        if (typeof onEnd === 'function') onEnd();
      };

      a.onended = cleanup;
      a.onerror = () => {
        console.error('音频播放 onerror:', a.error);
        Utils.showToast('播放失败：音频解码错误', 'error');
        cleanup();
      };

      a.src = url;

      // 立即 play，不等 loadedmetadata —— 尽量保持在用户手势上下文中
      var playPromise = a.play();

      // 尝试 seek 到标记时间点（浏览器可能不允许 seek 到未缓冲位置，忽略异常）
      try {
        if (startTimestamp && startTimestamp > 0) {
          a.currentTime = startTimestamp;
        }
      } catch (_) { /* ignore */ }

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(err => {
          console.error('播放被拒绝:', err);
          var msg;
          if (err.name === 'NotAllowedError') {
            msg = '浏览器阻止自动播放，请再点一次试试';
          } else if (err.name === 'NotSupportedError') {
            msg = '浏览器不支持此音频格式';
          } else {
            msg = '播放失败：' + (err.message || err);
          }
          Utils.showToast(msg, 'error');
          cleanup();
        });
      }
    } catch (err) {
      console.error('读取音频失败:', err);
      Utils.showToast('读取失败：' + (err.message || err), 'error');
      if (typeof onEnd === 'function') onEnd();
    }
  },

  /**
   * 简单播放（从头开始），向后兼容今日页反馈播放
   * @param {string} blobId
   * @param {string} [markerId] 播放标识
   * @param {Function} [onEnd]
   */
  async play(blobId, markerId, onEnd) {
    this.playFromTimestamp(blobId, 0, markerId, onEnd);
  },

  /**
   * 停止播放
   */
  stopPlayback() {
    if (this._audioEl) {
      try { this._audioEl.pause(); } catch(_) {}
      this._audioEl = null;
      this._playingId = null;
    }
  },

  /**
   * 是否正在播放某个 ID
   * @param {string} id
   * @returns {boolean}
   */
  isPlaying(id) { return this._playingId === id; }
};

/**
 * 首次录音前的知情确认（隐私说明）
 * 只弹一次；确认后写入 localStorage。课堂录音与家长语音共用此确认。
 * @returns {boolean} 是否已同意
 */
window.ensureRecordingConsent = function() {
  try {
    if (localStorage.getItem('piano_recording_consent') === '1') return true;
  } catch (e) { /* ignore */ }

  var ok = confirm(
    '🎙 开始录音前请确认：\n\n' +
    '· 录音仅用于家庭复习，保存在本设备，不会上传。\n' +
    '· 请确认已获得授课老师及相关人员同意。\n' +
    '· 请勿录制与学习无关的私人内容。\n\n' +
    '继续即表示你已知晓并同意上述说明。'
  );
  if (ok) {
    try { localStorage.setItem('piano_recording_consent', '1'); } catch (e) { /* ignore */ }
  }
  return ok;
};

window.LessonAudio = LessonAudio;
