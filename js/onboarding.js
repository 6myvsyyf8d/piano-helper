"use strict";

/* ==========================================
   🚀 冷启动引导 - 5 步引导流程
   ==========================================
   spec 5.8：新用户首次打开应用时显示 5 步引导，
   30 秒内理解核心用法，完成后不再显示。

   触发条件：
     localStorage.piano_onboarding_done !== '1' 且
     （repertoire 为空 或 logs 为空）—— 老用户跳过

   气泡提示（spec 5.8.5）：
     关键功能首次使用时显示，每个只显示一次
   ========================================== */

const Onboarding = {
  DONE_KEY: 'piano_onboarding_done',
  BUBBLE_KEY: 'piano_onboarding_bubbles',

  // 5 步引导定义
  STEPS: [
    {
      title: '欢迎使用 🎹',
      body: '这是帮你记录孩子钢琴练习的工具。每天练琴、上课反馈、曲库管理，都在这里。',
      anim: 'welcome',
      btn: '开始 →'
    },
    {
      title: '记录每天的练习',
      body: '在「今日」页面：选曲子 → 点击开始计时 → 练完评分 → 保存。就这么简单。',
      anim: 'practice',
      btn: '下一步 →'
    },
    {
      title: '上课时点「标记此刻」',
      body: '在「课程」页面新增课程时，老师讲反馈的瞬间点一下「标记此刻」，记录时间点。课后整理成语音图钉。',
      anim: 'marker',
      btn: '下一步 →'
    },
    {
      title: '练琴时看曲谱提醒',
      body: '选一首曲子开始练习时，如果有老师的反馈，会自动展示曲谱照片和语音图钉。点图钉就能听到老师的提醒。',
      anim: 'feedback',
      btn: '下一步 →'
    },
    {
      title: '准备好了！',
      body: '先添加一首孩子正在练的曲子吧。后面会自动给你每日练习建议。',
      anim: 'ready',
      btn: '开始使用'
    }
  ],

  _currentStep: 0,
  _overlay: null,

  /**
   * 是否应该启动引导（按 spec 5.8：只看 piano_onboarding_done）
   * @returns {boolean}
   */
  shouldStart() {
    return localStorage.getItem(this.DONE_KEY) !== '1';
  },

  /**
   * 启动引导流程
   */
  start() {
    this._currentStep = 0;
    this._render();
  },

  /**
   * 渲染当前步骤
   */
  _render() {
    const step = this.STEPS[this._currentStep];
    const total = this.STEPS.length;
    const dots = Array.from({ length: total }, (_, i) =>
      `<span class="onboarding-dot ${i === this._currentStep ? 'active' : ''}"></span>`
    ).join('');

    // 移除已有覆盖层（防止重复）
    this._overlay && this._overlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-anim onboarding-anim-${step.anim}">
          ${this._renderAnim(step.anim)}
        </div>
        <div class="onboarding-step-indicator">步骤 ${this._currentStep + 1} / ${total}</div>
        <h2 class="onboarding-title">${step.title}</h2>
        <p class="onboarding-body">${step.body}</p>
        <div class="onboarding-dots">${dots}</div>
        <div class="onboarding-buttons">
          ${this._currentStep > 0 ? '<button class="btn btn-secondary" onclick="Onboarding._prev()">← 上一步</button>' : '<span></span>'}
          <button class="btn btn-primary" onclick="Onboarding._next()">${step.btn}</button>
        </div>
        <button class="onboarding-skip" onclick="Onboarding._skip()">跳过引导</button>
      </div>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;

    // 阻止背景滚动
    document.body.style.overflow = 'hidden';
  },

  /**
   * 渲染步骤动画（纯 CSS + emoji，无图片资源）
   */
  _renderAnim(anim) {
    switch (anim) {
      case 'welcome':
        return '<div class="anim-piano">🎹</div>';
      case 'practice':
        return `
          <div class="anim-flow">
            <span class="anim-flow-item">🎵</span>
            <span class="anim-flow-arrow">→</span>
            <span class="anim-flow-item">⏱</span>
            <span class="anim-flow-arrow">→</span>
            <span class="anim-flow-item">⭐</span>
          </div>
        `;
      case 'marker':
        return '<div class="anim-tap">⏱<span class="anim-tap-ring"></span></div>';
      case 'feedback':
        return `
          <div class="anim-pin-stack">
            <div class="anim-pin red">📌</div>
            <div class="anim-pin yellow">📌</div>
            <div class="anim-pin green">📌</div>
          </div>
        `;
      case 'ready':
        return '<div class="anim-piano">🎉</div>';
      default:
        return '<div class="anim-piano">🎹</div>';
    }
  },

  /**
   * 下一步
   */
  _next() {
    if (this._currentStep < this.STEPS.length - 1) {
      this._currentStep++;
      this._render();
    } else {
      this._finish();
    }
  },

  /**
   * 上一步
   */
  _prev() {
    if (this._currentStep > 0) {
      this._currentStep--;
      this._render();
    }
  },

  /**
   * 跳过
   */
  _skip() {
    this._finish();
  },

  /**
   * 完成引导
   */
  _finish() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
    document.body.style.overflow = '';
    localStorage.setItem(this.DONE_KEY, '1');
    console.log('✅ Onboarding completed');
  },

  // ──────────────────────────────────────────
  // 气泡提示系统（spec 5.8.5）
  // ──────────────────────────────────────────

  /**
   * 读取已展示过的气泡
   * @returns {Object} { bubbleId: true }
   */
  _bubblesShown() {
    try {
      return JSON.parse(localStorage.getItem(this.BUBBLE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  },

  /**
   * 是否已展示过某气泡
   * @param {string} id
   * @returns {boolean}
   */
  isBubbleShown(id) {
    return !!this._bubblesShown()[id];
  },

  /**
   * 显示气泡提示（如果未展示过）
   * @param {string} id 唯一 ID
   * @param {string} text 文案
   * @param {HTMLElement} targetEl 目标元素
   * @param {Object} [opts] { position: 'top'|'bottom'|'left'|'right', timeout: ms }
   */
  showBubble(id, text, targetEl, opts = {}) {
    if (!targetEl || this.isBubbleShown(id)) return;

    const position = opts.position || 'bottom';
    const rect = targetEl.getBoundingClientRect();

    const bubble = document.createElement('div');
    bubble.className = `onboarding-bubble onboarding-bubble-${position}`;
    bubble.innerHTML = `
      <div class="onboarding-bubble-text">${Utils.escape(text)}</div>
      <button class="onboarding-bubble-close" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.appendChild(bubble);

    // 定位
    const bRect = bubble.getBoundingClientRect();
    let top, left;
    switch (position) {
      case 'top':
        top = rect.top - bRect.height - 12;
        left = rect.left + (rect.width - bRect.width) / 2;
        break;
      case 'bottom':
        top = rect.bottom + 12;
        left = rect.left + (rect.width - bRect.width) / 2;
        break;
      case 'left':
        top = rect.top + (rect.height - bRect.height) / 2;
        left = rect.left - bRect.width - 12;
        break;
      case 'right':
        top = rect.top + (rect.height - bRect.height) / 2;
        left = rect.right + 12;
        break;
    }
    // 边界保护
    left = Math.max(8, Math.min(left, window.innerWidth - bRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - bRect.height - 8));
    bubble.style.top = top + 'px';
    bubble.style.left = left + 'px';

    // 标记已展示
    const shown = this._bubblesShown();
    shown[id] = true;
    localStorage.setItem(this.BUBBLE_KEY, JSON.stringify(shown));

    // 自动消失
    if (opts.timeout) {
      setTimeout(() => bubble.remove(), opts.timeout);
    }
  }
};

window.Onboarding = Onboarding;
