"use strict";

/* ==========================================
   📌 反馈管理 - FeedbackItem CRUD + 状态流转
   ==========================================
   FeedbackItem 数据结构见 spec 5.3.3：
     - 锚定到曲谱照片的具体位置（pinX/pinY 相对坐标 0-1）
     - 关联课程记录和课堂标记
     - 包含家长语音（Phase 1 第二批接入 IndexedDB blob）
     - 生命周期: new → resolved（两态，一键切换）

   状态流转规则（简化版）：
     new     → resolved  点击"✅ 完成"
     resolved → new      点击"↩️ 撤销"
   ========================================== */

/**
 * @typedef {Object} FeedbackItem
 * @property {string} id                       UUID
 * @property {string} lessonId                 关联课程的 createdAt（字符串）
 * @property {string} [markerId]               关联的 AudioMarker ID（可选，方案B后不再强绑）
 * @property {number} [timestamp]              图钉自己的录音时间戳（秒，可选，用于练习时跳转录音）
 * @property {string} pieceTitle               曲子名称
 * @property {string} [book]                   教材名称
 * @property {string} [sheetPhotoId]           曲谱照片 blob ID（Phase 1 第二批）
 * @property {number} [photoPage]              照片页码
 * @property {number} [pinX]                   图钉 X 坐标 0-1
 * @property {number} [pinY]                   图钉 Y 坐标 0-1
 * @property {string} [locationLabel]          位置描述 "第5小节左手"
 * @property {string} category                 technique|dynamics|rhythm|notes|expression|other
 * @property {string} [teacherNote]            老师原话简述
 * @property {string} [parentVoiceId]          家长语音 blob ID（Phase 1 第二批）
 * @property {string} [parentTranscript]       家长语音文字版
 * @property {'new'|'resolved'} status         两态：未完成 / 已完成
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number|null} resolvedAt
 * @property {string|null} resolvedBy          self|parent|teacher
 */

const Feedback = {
  // 状态常量
  STATUS_NEW: 'new',
  STATUS_RESOLVED: 'resolved',

  // 类别常量
  CATEGORIES: [
    { key: 'technique', label: '指法', icon: '🎹' },
    { key: 'dynamics',  label: '力度', icon: '🔊' },
    { key: 'rhythm',    label: '节奏', icon: '🥁' },
    { key: 'notes',     label: '音符', icon: '🎵' },
    { key: 'expression',label: '表情', icon: '😊' },
    { key: 'other',     label: '其他', icon: '📌' }
  ],

  /**
   * 生成 UUID（兼容性最佳的写法）
   * @returns {string}
   */
  _uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  },

  /**
   * 获取所有反馈
   * @returns {FeedbackItem[]}
   */
  all() {
    return DB.feedbacks();
  },

  /**
   * 按 ID 查找
   * @param {string} id
   * @returns {FeedbackItem|null}
   */
  find(id) {
    return this.all().find(f => f.id === id) || null;
  },

  /**
   * 按曲子查找所有反馈
   * @param {string} pieceTitle
   * @returns {FeedbackItem[]}
   */
  byPiece(pieceTitle) {
    if (!pieceTitle) return [];
    return this.all().filter(f => f.pieceTitle === pieceTitle);
  },

  /**
   * 按课程查找所有反馈
   * @param {string} lessonId
   * @returns {FeedbackItem[]}
   */
  byLesson(lessonId) {
    return this.all().filter(f => f.lessonId === String(lessonId));
  },

  /**
   * 按状态筛选
   * @param {'new'|'resolved'} status
   * @returns {FeedbackItem[]}
   */
  byStatus(status) {
    return this.all().filter(f => f.status === status);
  },

  /**
   * 创建新反馈
   * @param {Object} payload 必填: lessonId, pieceTitle; 可选: markerId, timestamp, category, locationLabel, teacherNote
   * @returns {FeedbackItem}
   */
  create(payload) {
    const now = Date.now();
    const lessonId = String(payload.lessonId || '');
    const pieceTitle = payload.pieceTitle || '';
    // 固定图钉编号：同 lessonId + 同 pieceTitle 内最大 + 1，创建后永不改变
    const maxNum = this.all()
      .filter(f => f.pieceTitle === pieceTitle && String(f.lessonId) === lessonId)
      .reduce(function(m, f) { return Math.max(m, (f.pinNumber || 0)); }, 0);

    /** @type {FeedbackItem} */
    const item = {
      id: this._uuid(),
      lessonId: lessonId,
      markerId: payload.markerId || null,
      timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : null,
      pieceTitle: pieceTitle,
      book: payload.book || '',
      sheetPhotoId: payload.sheetPhotoId || null,
      photoPage: payload.photoPage || 1,
      pinX: typeof payload.pinX === 'number' ? payload.pinX : null,
      pinY: typeof payload.pinY === 'number' ? payload.pinY : null,
      pinNumber: maxNum + 1,
      locationLabel: payload.locationLabel || '',
      category: this.CATEGORIES.some(c => c.key === payload.category) ? payload.category : 'other',
      teacherNote: payload.teacherNote || '',
      parentVoiceId: payload.parentVoiceId || null,
      parentTranscript: payload.parentTranscript || '',
      status: this.STATUS_NEW,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolvedBy: null
    };

    const list = this.all();
    list.push(item);
    DB.saveFeedbacks(list);
    Events.emit('feedback:added', { feedbackId: item.id, pieceTitle: item.pieceTitle, lessonId: item.lessonId });
    return item;
  },

  /**
   * 迁移：给旧 feedback 补齐固定图钉编号 pinNumber（同 lessonId + pieceTitle 内递增）
   * 已有 pinNumber 的记录保持不变，缺失的按 createdAt 升序补号
   * @returns {boolean} 是否有数据变更
   */
  migratePinNumbers() {
    const list = this.all();
    let changed = false;
    const groups = {};
    list.forEach(f => {
      const key = String(f.lessonId || '') + '\u0000' + (f.pieceTitle || '');
      (groups[key] = groups[key] || []).push(f);
    });
    Object.keys(groups).forEach(function(key) {
      const group = groups[key];
      let n = group.reduce(function(m, f) { return Math.max(m, (f.pinNumber || 0)); }, 0);
      group
        .filter(f => !f.pinNumber)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .forEach(function(f) {
          n++;
          f.pinNumber = n;
          changed = true;
        });
    });
    if (changed) DB.saveFeedbacks(list);
    return changed;
  },

  /**
   * 更新反馈字段（局部更新）
   * @param {string} id
   * @param {Object} patch
   * @returns {FeedbackItem|null}
   */
  update(id, patch) {
    const list = this.all();
    const idx = list.findIndex(f => f.id === id);
    if (idx === -1) return null;

    list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
    DB.saveFeedbacks(list);
    return list[idx];
  },

  /**
   * 删除反馈
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const list = this.all();
    const next = list.filter(f => f.id !== id);
    if (next.length === list.length) return false;
    DB.saveFeedbacks(next);
    return true;
  },

  /**
   * 标记完成：new → resolved
   * @param {string} id
   * @returns {FeedbackItem|null}
   */
  markProgress(id) {
    const item = this.find(id);
    if (!item || item.status === this.STATUS_RESOLVED) return item;

    const patch = { status: this.STATUS_RESOLVED, resolvedAt: Date.now(), resolvedBy: 'self' };
    const updated = this.update(id, patch);
    Events.emit('feedback:resolved', { feedbackId: id, pieceTitle: item.pieceTitle });
    return updated;
  },

  /**
   * 撤销完成：resolved → new
   * @param {string} id
   * @param {string} [by='self']
   * @returns {FeedbackItem|null}
   */
  markRegress(id, by = 'self') {
    const item = this.find(id);
    if (!item || item.status === this.STATUS_NEW) return item;

    const patch = { status: this.STATUS_NEW, resolvedAt: null, resolvedBy: null };
    const updated = this.update(id, patch);
    return updated;
  },

  /**
   * 添加自评记录
   * @param {string} id
   * @param {'good'|'okay'|'bad'} rating
   * @param {string} [note]
   * @returns {FeedbackItem|null}
   */
  addSelfAssessment(id, rating, note) {
    const item = this.find(id);
    if (!item) return null;

    const assessments = (item.selfAssessments || []).slice();
    assessments.push({
      date: Utils.today(),
      rating,
      note: note || ''
    });

    return this.update(id, { selfAssessments: assessments });
  },

  /**
   * 标记某个课堂标记已整理为反馈
   * @param {string} lessonId
   * @param {string} markerId
   */
  markMarkerReviewed(lessonId, markerId) {
    const lessons = DB.lessons();
    const idx = lessons.findIndex(l => String(l.createdAt) === String(lessonId));
    if (idx === -1) return;
    const markers = lessons[idx].audioMarkers || [];
    const m = markers.find(m => m.id === markerId);
    if (m) {
      m.reviewed = true;
      DB.saveLessons(lessons);
    }
  },

  /**
   * 获取某曲子的反馈摘要（练习时使用）
   * @param {string} pieceTitle
   * @returns {{total:number, new:number, resolved:number}}
   */
  summaryForPiece(pieceTitle) {
    const list = this.byPiece(pieceTitle);
    return {
      total: list.length,
      new: list.filter(f => f.status === this.STATUS_NEW).length,
      resolved: list.filter(f => f.status === this.STATUS_RESOLVED).length
    };
  },

  /**
   * 类别信息
   * @param {string} key
   * @returns {{key:string,label:string,icon:string}}
   */
  categoryInfo(key) {
    return this.CATEGORIES.find(c => c.key === key) || this.CATEGORIES[this.CATEGORIES.length - 1];
  }
};

window.Feedback = Feedback;
