/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
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

/* ==========================================
   📝 今日练习草稿自动保存/恢复
   防止切后台/切 tab 后未保存的练习记录丢失
   ========================================== */

const TODAY_DRAFT_KEY = 'piano_today_draft';

/**
 * 把当前今日页的练习状态保存为草稿
 * 包括：TodayState.pieces、mood、sticker、总计时秒数、家长笔记、自由练习数量
 */
function saveTodayDraft() {
  // 只在练习表单存在时保存（已完成视图不需要草稿）
  if (!document.getElementById('todayPracticeForm')) return;

  var pieces = JSON.parse(JSON.stringify(TodayState.pieces || {}));
  var totalTimerSecs = (typeof totalTimerSeconds !== 'undefined') ? totalTimerSeconds : 0;
  var parentNotesVal = (function() {
    var el = document.getElementById('parentNotes');
    return el ? el.value : '';
  })();

  // 没有任何有意义的数据就不保存（避免空草稿覆盖）
  var hasData = totalTimerSecs > 0 || !!parentNotesVal;
  if (!hasData) {
    for (var k in pieces) {
      var p = pieces[k];
      if (p && (p.rating > 0 || p.durationMin > 0 || (p.notes && p.notes.trim()))) {
        hasData = true;
        break;
      }
    }
  }
  if (!hasData) return;

  const draft = {
    date: Utils.today(),
    pieces: pieces,
    mood: TodayState.mood || '',
    sticker: TodayState.sticker || '',
    totalTimerSeconds: totalTimerSecs,
    parentNotes: parentNotesVal,
    freePieceCount: (typeof freePieceCount !== 'undefined') ? freePieceCount : 0,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(TODAY_DRAFT_KEY, JSON.stringify(draft));
  } catch(e) {
    console.warn('saveTodayDraft failed:', e);
  }
}

/**
 * 读取今日草稿（如存在且日期匹配）
 * @returns {Object|null}
 */
function getTodayDraft() {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(TODAY_DRAFT_KEY) || 'null');
  } catch(e) {}
  if (!draft) return null;
  // 日期不匹配（跨天了）则丢弃
  if (draft.date !== Utils.today()) {
    localStorage.removeItem(TODAY_DRAFT_KEY);
    return null;
  }
  // 超过 24 小时也丢弃
  if (draft.savedAt && Date.now() - draft.savedAt > 24 * 3600 * 1000) {
    localStorage.removeItem(TODAY_DRAFT_KEY);
    return null;
  }
  return draft;
}

/**
 * 清除今日草稿
 */
function clearTodayDraft() {
  localStorage.removeItem(TODAY_DRAFT_KEY);
}

/**
 * 从草稿恢复今日练习状态到 TodayState 和 DOM
 * 必须在 bindTodayEvents 之后调用（此时表单、默认自由练习、复习卡已就绪）
 * @returns {boolean} 是否恢复了草稿
 */
function restoreTodayDraft() {
  const draft = getTodayDraft();
  if (!draft) return false;

  // ── 1. 恢复课程曲目（数字索引 "0","1"...）──
  for (var key in draft.pieces) {
    if (key.charAt(0) === 'f' || key.charAt(0) === 'r') continue; // 自由/复习稍后处理
    var dp = draft.pieces[key];
    if (!dp || !TodayState.pieces[key]) continue;

    TodayState.pieces[key].rating = dp.rating || 0;
    TodayState.pieces[key].speed = dp.speed || 0;
    TodayState.pieces[key].notes = dp.notes || '';
    TodayState.pieces[key].durationMin = dp.durationMin || 0;

    if (typeof updateStarDisplay === 'function') updateStarDisplay(key);
    var speedInput = document.querySelector('.piece-speed[data-index="' + key + '"]');
    if (speedInput && dp.speed) speedInput.value = dp.speed;
  }

  // ── 2. 恢复自由练习（"f0","f1"...）──
  // 注意：addFreePiece 会触发 generateReviewList 重建复习卡 DOM，
  // 所以复习卡的评分恢复必须放在这之后
  var freeDrafts = [];
  for (var fkey in draft.pieces) {
    if (fkey.charAt(0) === 'f') {
      var num = parseInt(fkey.slice(1), 10);
      if (!isNaN(num)) freeDrafts.push({ num: num, data: draft.pieces[fkey] });
    }
  }
  freeDrafts.sort(function(a, b) { return a.num - b.num; });

  // 清空当前所有自由练习卡片
  var freeList = document.getElementById('freeList');
  if (freeList) {
    freeList.querySelectorAll('.piece-card').forEach(function(c) { c.remove(); });
    if (freeDrafts.length === 0) {
      freeList.innerHTML = '<p class="text-xs text-3 text-center p-12">点击下方按钮添加练习曲目</p>';
    }
  }
  for (var k in TodayState.pieces) {
    if (k.charAt(0) === 'f') delete TodayState.pieces[k];
  }
  freePieceCount = 0;

  // 按草稿顺序重建自由练习
  freeDrafts.forEach(function(fd) {
    if (typeof window.addFreePiece === 'function') {
      window.addFreePiece(fd.data.pieceName || '');
      var idx = 'f' + (freePieceCount - 1);
      if (TodayState.pieces[idx]) {
        TodayState.pieces[idx].rating = fd.data.rating || 0;
        TodayState.pieces[idx].notes = fd.data.notes || '';
        TodayState.pieces[idx].durationMin = fd.data.durationMin || 0;
        if (typeof updateStarDisplay === 'function') updateStarDisplay(idx);
        var notesEl = document.querySelector('.free-piece-notes[data-index="' + idx + '"]');
        if (notesEl && fd.data.notes) notesEl.value = fd.data.notes;
      }
    }
  });

  var countEl = document.getElementById('freeCount');
  if (countEl) countEl.textContent = freePieceCount + '首';

  // ── 3. 恢复复习曲目（"r0","r1"...）—— 必须在自由练习重建之后 ──
  for (var rkey in draft.pieces) {
    if (rkey.charAt(0) !== 'r') continue;
    var rdp = draft.pieces[rkey];
    if (!rdp || !TodayState.pieces[rkey]) continue;

    TodayState.pieces[rkey].rating = rdp.rating || 0;
    TodayState.pieces[rkey].durationMin = rdp.durationMin || 0;
    if (typeof updateStarDisplay === 'function') updateStarDisplay(rkey);
  }

  // ── 4. 恢复心情和贴纸 ──
  TodayState.mood = draft.mood || '';
  TodayState.sticker = draft.sticker || '';

  // ── 5. 恢复总计时器 ──
  if (draft.totalTimerSeconds && typeof totalTimerSeconds !== 'undefined') {
    totalTimerSeconds = draft.totalTimerSeconds;
    if (typeof updateTotalTimerDisplay === 'function') updateTotalTimerDisplay();
  }

  // ── 6. 恢复家长笔记 ──
  var pNotesEl = document.getElementById('parentNotes');
  if (pNotesEl && draft.parentNotes != null) pNotesEl.value = draft.parentNotes;

  Utils.showToast('📝 已恢复未保存的练习记录', 'info');
  return true;
}