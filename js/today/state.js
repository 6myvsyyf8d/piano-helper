/* ==========================================
   🏠 今日练琴 - 状态管理
   ========================================== */

"use strict";

/**
 * Today 页面的全局状态对象
 * @namespace TodayState
 */
const TodayState = {
  /** @type {Object<string, TodayPieceState>} 当前曲目状态（索引 → 状态对象） */
  pieces: {},

  /** @type {string} 心情选择 */
  mood: '',

  /** @type {string} 贴纸选择 */
  sticker: '',

  /** @type {Log|null} 编辑模式：保留原日志用于预填 */
  existingLog: null,

  /**
   * 重置所有状态
   * @returns {void}
   */
  reset() {
    this.pieces = {};
    this.mood = '';
    this.sticker = '';
    this.existingLog = null;
    if (typeof freePieceCount !== 'undefined') freePieceCount = 0;
  },

  /**
   * 初始化曲目状态（如已存在则直接返回）
   * @param {string} index    曲目索引（如 "0"、"r0"、"f0"）
   * @param {string} pieceName 曲目名称
   * @returns {TodayPieceState}
   */
  initPiece(index, pieceName, focusAreas, details) {
    if (!this.pieces[index]) {
      this.pieces[index] = {
        pieceName: pieceName || '',
        rating: 0,
        durationMin: 0,
        notes: '',
        focusAreas: focusAreas || [],
        details: details || '',
        repId: null,
        category: 'pieces',
        book: null,
        speed: 0,
        memorized: false,
        handsTogether: true
      };
    }
    return this.pieces[index];
  },

  /**
   * 获取已完成的曲目（有评分或时长）
   * @returns {TodayPieceState[]}
   */
  getCompleted() {
    return Object.values(this.pieces).filter(p => p.rating > 0 || p.durationMin > 0);
  }
};

/** @type {number} 自由练习曲目计数（全局） */
let freePieceCount = 0;