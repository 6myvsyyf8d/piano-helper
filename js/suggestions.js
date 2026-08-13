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
    const logs = DB.logs();
    const today = Utils.today();
    const rep = DB.repertoire().filter(r => r.status === 'learning' || r.status === 'learned');
    if (rep.length === 0) return null;

    // 计算每首 learning/learned 曲子的最后练习日期
    const lastPracticed = {};
    logs.forEach(log => {
      (log.entries || []).forEach(e => {
        if (!e.pieceName) return;
        if (!lastPracticed[e.pieceName] || log.date > lastPracticed[e.pieceName]) {
          lastPracticed[e.pieceName] = log.date;
        }
      });
    });

    const stale = [];
    for (const r of rep) {
      const last = lastPracticed[r.title];
      if (!last) {
        // 从未练习过——如果加入曲库超过 3 天才算
        if (r.addedAt && (Date.now() - r.addedAt) > 3 * 86400000) {
          stale.push({ title: r.title, days: 'never' });
        }
        continue;
      }
      const days = Math.floor((new Date(today + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000);
      if (days >= 3) {
        stale.push({ title: r.title, days });
      }
    }

    if (stale.length === 0) return null;
    stale.sort((a, b) => {
      if (a.days === 'never') return -1;
      if (b.days === 'never') return 1;
      return b.days - a.days;
    });
    const top = stale[0];
    const daysText = top.days === 'never' ? '从未练习' : `${top.days} 天没练`;
    return {
      priority: 1,
      type: 'reminder',
      tone: 'blue',
      icon: '📅',
      title: `${top.title} 已经 ${daysText}`,
      detail: stale.length > 1 ? `还有 ${stale.length - 1} 首也需要回顾` : '',
      action: { label: '练这首', target: 'today', pieceName: top.title }
    };
  },

  // ──────────────────────────────────────────
  // P1：某曲子连续 5 天练习（鼓励录音检查）
  // ──────────────────────────────────────────
  _ruleConsecutiveDays() {
    const FIVE_DAYS = 5;
    const today = Utils.today();
    const dateSet = new Set(DB.logs().map(l => l.date));

    // 统计每首曲子最近连续练习天数
    const pieceStreaks = {};
    const logs = DB.logs().sort((a, b) => a.date < b.date ? -1 : 1);
    logs.forEach(log => {
      (log.entries || []).forEach(e => {
        if (!e.pieceName) return;
        if (!pieceStreaks[e.pieceName]) pieceStreaks[e.pieceName] = { count: 0, lastDate: null };
        // 简化：只要这首曲子在过去 5 天内练习过 5 次就触发
      });
    });

    // 更准确的算法：从今天往回数，统计每首曲子连续练习天数
    const pieceDayMap = {}; // piece -> Set(date)
    logs.forEach(log => {
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
      while (days.has(cursor.toISOString().slice(0, 10))) {
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
      .filter(r => r.status === 'learned' && !r.memorized && (r.practiceCount || 0) >= 10);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.practiceCount || 0) - (a.practiceCount || 0));
    const top = candidates[0];
    return {
      priority: 3,
      type: 'challenge',
      tone: 'purple',
      icon: '🧠',
      title: `${top.title} 练了 ${top.practiceCount} 次了`,
      detail: '试试背谱？',
      action: { label: '接受挑战', target: 'today', pieceName: top.title }
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
