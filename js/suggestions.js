"use strict";

/* ==========================================
   💡 每日建议引擎 - 规则驱动
   ==========================================
   spec 5.7：基于练习数据、反馈状态、连续天数，
   生成一条最高优先级的可执行建议。

   规则优先级（数字越小越优先）：
     P0 - 未练反馈 / 陈旧反馈（紧急）
     P1 - 多天未练 / 连续多天（提醒/鼓励）
     P2 - 连续天数里程碑 / 今天未练习
     P3 - 背谱挑战
   ========================================== */

const Suggestions = {
  /**
   * 生成今日建议（只返回最高优先级的一条）
   * @returns {Object|null} { priority, type, icon, title, detail, action }
   */
  generate() {
    const rules = [
      this._ruleUnresolvedNewFeedback,    // P0
      this._ruleStaleWorkingFeedback,     // P0
      this._ruleNotPracticedRecently,     // P1
      this._ruleConsecutiveDays,          // P1
      this._ruleStreakMilestone,          // P2
      this._ruleNoPracticeToday,          // P2
      this._ruleMemorizationChallenge     // P3
    ];

    const all = rules
      .map(rule => rule.call(this))
      .filter(s => s !== null)
      .sort((a, b) => a.priority - b.priority);

    return all[0] || null;
  },

  /**
   * 生成多条建议（备用，比如未来要做"建议卡片堆"）
   * @returns {Object[]}
   */
  generateAll() {
    const rules = [
      this._ruleUnresolvedNewFeedback,
      this._ruleStaleWorkingFeedback,
      this._ruleNotPracticedRecently,
      this._ruleConsecutiveDays,
      this._ruleStreakMilestone,
      this._ruleNoPracticeToday,
      this._ruleMemorizationChallenge
    ];
    return rules
      .map(rule => rule.call(this))
      .filter(s => s !== null)
      .sort((a, b) => a.priority - b.priority);
  },

  // ──────────────────────────────────────────
  // P0：未练反馈（老师新给的提醒还没练）
  // ──────────────────────────────────────────
  _ruleUnresolvedNewFeedback() {
    const items = Feedback.byStatus(Feedback.STATUS_NEW);
    if (items.length === 0) return null;

    const pieces = [...new Set(items.map(f => f.pieceTitle).filter(Boolean))];
    return {
      priority: 0,
      type: 'urgent',
      tone: 'red',
      icon: '📌',
      title: `老师上次说的 ${items.length} 个提醒还没练`,
      detail: pieces.length ? pieces.join('、') : '',
      action: { label: '去看看', target: 'feedback' }
    };
  },

  // ──────────────────────────────────────────
  // P0：未完成反馈（new 状态超过 3 天）
  // ──────────────────────────────────────────
  _ruleStaleWorkingFeedback() {
    const THREE_DAYS = 3 * 86400000;
    const now = Date.now();
    const items = Feedback.byStatus(Feedback.STATUS_NEW)
      .filter(f => (now - (f.updatedAt || f.createdAt)) > THREE_DAYS);
    if (items.length === 0) return null;

    const pieces = [...new Set(items.map(f => f.pieceTitle).filter(Boolean))];
    return {
      priority: 0,
      type: 'urgent',
      tone: 'yellow',
      icon: '⏰',
      title: `${items.length} 个反馈还没完成`,
      detail: pieces.length ? pieces.join('、') : '继续加油',
      action: { label: '去练习', target: 'feedback' }
    };
  },

  // ──────────────────────────────────────────
  // P1：某曲子 3 天没练
  // ──────────────────────────────────────────
  _ruleNotPracticedRecently() {
    const today = Utils.today();
    const rep = DB.repertoire().filter(r => r.status === 'learning' || r.status === 'learned');
    if (rep.length === 0) return null;

    // 曲目对象字段为 name / lastPracticeDate（此前误用 title / addedAt，导致该规则永不触发）
    const stale = [];
    for (const r of rep) {
      let days;
      if (!r.lastPracticeDate) {
        // 从未练习过：以开始学习日期为基准，超过 3 天才提示
        if (!r.startedDate) continue;
        days = Math.floor((new Date(today + 'T00:00:00') - new Date(r.startedDate + 'T00:00:00')) / 86400000);
      } else {
        days = Math.floor((new Date(today + 'T00:00:00') - new Date(r.lastPracticeDate + 'T00:00:00')) / 86400000);
      }
      if (days >= 3) {
        stale.push({ name: r.name, days });
      }
    }

    if (stale.length === 0) return null;
    stale.sort((a, b) => b.days - a.days);
    const top = stale[0];
    return {
      priority: 1,
      type: 'reminder',
      tone: 'blue',
      icon: '📅',
      title: `${top.name} 已经 ${top.days} 天没练`,
      detail: stale.length > 1 ? `还有 ${stale.length - 1} 首也需要回顾` : '',
      action: { label: '练这首', target: 'today', pieceName: top.name }
    };
  },

  // ──────────────────────────────────────────
  // P1：某曲子连续 5 天练习（鼓励录音检查）
  // ──────────────────────────────────────────
  _ruleConsecutiveDays() {
    const FIVE_DAYS = 5;
    const today = Utils.today();

    // 从今天往回数，统计每首曲子连续练习天数
    const pieceDayMap = {}; // piece -> Set(date)
    DB.logs().forEach(log => {
      (log.entries || []).forEach(e => {
        if (!e.pieceName) return;
        if (!pieceDayMap[e.pieceName]) pieceDayMap[e.pieceName] = new Set();
        pieceDayMap[e.pieceName].add(log.date);
      });
    });

    let hot = null;
    for (const [piece, days] of Object.entries(pieceDayMap)) {
      let streak = 0;
      const cursor = new Date(today + 'T00:00:00');
      // 用本地时区日期做 key，避免 toISOString() 在 UTC+8 等时区差一天
      while (days.has(Utils.dateStr(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      if (streak >= FIVE_DAYS && (!hot || streak > hot.streak)) {
        hot = { piece, streak };
      }
    }

    if (!hot) return null;
    return {
      priority: 1,
      type: 'encourage',
      tone: 'green',
      icon: '🌟',
      title: `${hot.piece} 连续练了 ${hot.streak} 天`,
      detail: '试试录音检查一下效果？',
      action: { label: '去录音', target: 'today', pieceName: hot.piece }
    };
  },

  // ──────────────────────────────────────────
  // P2：连续天数里程碑（7 的倍数）
  // ──────────────────────────────────────────
  _ruleStreakMilestone() {
    const streak = StreakManager.calculate();
    if (streak === 0 || streak % 7 !== 0) return null;
    return {
      priority: 2,
      type: 'celebrate',
      tone: 'gold',
      icon: '🎉',
      title: `已经坚持 ${streak} 天了！`,
      detail: '来选一首曲子庆祝一下',
      action: { label: '去练习', target: 'today' }
    };
  },

  // ──────────────────────────────────────────
  // P2：今天还没练习
  // ──────────────────────────────────────────
  _ruleNoPracticeToday() {
    const today = Utils.today();
    const hasToday = DB.logs().some(l => l.date === today);
    if (hasToday) return null;
    return {
      priority: 2,
      type: 'gentle',
      tone: 'blue',
      icon: '🎵',
      title: '今天还没开始练习哦',
      detail: '从哪首曲子开始？',
      action: { label: '去练习', target: 'today' }
    };
  },

  // ──────────────────────────────────────────
  // P3：背谱挑战（练习超 10 次且未背谱）
  // ──────────────────────────────────────────
  _ruleMemorizationChallenge() {
    const candidates = DB.repertoire()
      .filter(r => r.status === 'learned'
        && r.stage !== 'memorize' && r.stage !== 'proficient'
        && (r.practiceCount || 0) >= 10);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.practiceCount || 0) - (a.practiceCount || 0));
    const top = candidates[0];
    return {
      priority: 3,
      type: 'challenge',
      tone: 'purple',
      icon: '🧠',
      title: `${top.name} 练了 ${top.practiceCount} 次了`,
      detail: '试试背谱？',
      action: { label: '接受挑战', target: 'today', pieceName: top.name }
    };
  },

  /**
   * 根据 tone 获取颜色类名
   * @param {string} tone
   * @returns {string}
   */
  toneClass(tone) {
    return {
      red: 'suggestion-red',
      yellow: 'suggestion-yellow',
      blue: 'suggestion-blue',
      green: 'suggestion-green',
      gold: 'suggestion-gold',
      purple: 'suggestion-purple'
    }[tone] || 'suggestion-blue';
  }
};

window.Suggestions = Suggestions;
