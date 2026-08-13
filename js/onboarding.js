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
      title: '欢迎使用钢琴练习助手 🎹',
      body: '一站式管理孩子的钢琴练习：记录每日练习、上课标注反馈、查看曲谱提醒。',
      anim: 'welcome',
      btn: '开始 →'
    },
    {
      title: '📋 记录每天的练习',
      body: '在「今日」页面：选曲子 → 设速度 → 开始计时 → 练完评分保存。',
      anim: 'practice',
      btn: '下一步 →'
    },
    {
      title: '🎼 上课时记录反馈',
      body: '在「课程」页面新建课程，点击曲子旁的「课堂记录」按钮：上传曲谱照片 → 在照片上点击放置图钉 → 填写老师反馈内容。',
      anim: 'lesson',
      btn: '下一步 →'
    },
    {
      title: '🔍 练习时查看提醒',
      body: '在「今日」页面点击「课堂记录」按钮查看曲谱照片，图钉标记了老师反馈的位置，点击图钉查看详情或播放录音回听。',
      anim: 'feedback',
      btn: '下一步 →'
    },
    {
      title: '准备好了！',
      body: '先添加一首孩子正在练的曲子，开始记录吧。',
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
        return '<div class="anim-piano" style="font-size:3rem">🎹</div>';
      case 'practice':
        return `
          <div class="anim-flow" style="display:flex;align-items:center;justify-content:center;gap:12px;font-size:1.5rem;padding:12px 0">
            <span style="background:rgba(94,106,210,0.15);border:1px solid rgba(94,106,210,0.3);padding:8px 14px;border-radius:8px;font-size:0.85rem;color:#a5ade8">🎵 选曲</span>
            <span style="color:var(--text-4)">→</span>
            <span style="background:rgba(94,106,210,0.15);border:1px solid rgba(94,106,210,0.3);padding:8px 14px;border-radius:8px;font-size:0.85rem;color:#a5ade8">⏱ 计时</span>
            <span style="color:var(--text-4)">→</span>
            <span style="background:rgba(94,106,210,0.15);border:1px solid rgba(94,106,210,0.3);padding:8px 14px;border-radius:8px;font-size:0.85rem;color:#a5ade8">⭐ 评分</span>
          </div>
        `;
      case 'lesson':
        return `
          <div class="anim-flow" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0">
            <div style="background:rgba(245,160,152,0.12);border:1px solid rgba(245,160,152,0.25);padding:6px 16px;border-radius:6px;font-size:0.8rem;color:var(--accent-primary)">🎼 课堂记录</div>
            <span style="color:var(--text-4);font-size:0.7rem">↓</span>
            <div style="border:1px dashed rgba(255,255,255,0.12);border-radius:8px;padding:12px 20px;position:relative;min-width:120px">
              <span style="font-size:0.75rem;color:var(--text-3)">📷 曲谱照片</span>
              <span style="position:absolute;top:50%;left:60%;transform:translate(-50%,-50%);width:14px;height:14px;background:#5E6AD2;border:2px solid #fff;border-radius:50%;display:inline-block"></span>
            </div>
            <span style="color:var(--text-4);font-size:0.7rem">↓</span>
            <div style="background:rgba(94,106,210,0.1);border:1px solid rgba(94,106,210,0.2);padding:5px 12px;border-radius:6px;font-size:0.72rem;color:#a5ade8">📝 填写反馈内容</div>
          </div>
        `;
      case 'feedback':
        return `
          <div class="anim-flow" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0">
            <div style="background:rgba(94,106,210,0.08);border:1px solid rgba(94,106,210,0.3);padding:4px 12px;border-radius:6px;font-size:0.72rem;color:#a5ade8">🎼 课堂记录 ·2</div>
            <span style="color:var(--text-4);font-size:0.7rem">↓</span>
            <div style="border:1px dashed rgba(255,255,255,0.12);border-radius:8px;padding:16px 24px;position:relative;min-width:140px">
              <span style="font-size:0.7rem;color:var(--text-3)">曲谱照片</span>
              <span style="position:absolute;top:30%;left:55%;transform:translate(-50%,-50%);width:16px;height:16px;background:#5E6AD2;border:2px solid #fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.5rem;color:#fff;font-weight:700">1</span>
              <span style="position:absolute;top:60%;left:45%;transform:translate(-50%,-50%);width:16px;height:16px;background:#4caf7d;border:2px solid #fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.5rem;color:#fff;font-weight:700">2</span>
            </div>
            <span style="color:var(--text-4);font-size:0.7rem">↓</span>
            <div style="background:rgba(255,236,165,0.3);border:1px solid rgba(120,100,30,0.2);padding:6px 12px;border-radius:6px;font-size:0.7rem;color:#0a0a0a;font-weight:700;text-align:left;max-width:200px">
              <div style="display:flex;align-items:center;gap:4px">
                <span style="width:12px;height:12px;border-radius:50%;border:2px solid #5E6AD2;background:rgba(94,106,210,0.2);display:inline-block"></span>
                <span style="font-size:0.65rem">未完成</span>
                <span style="font-size:0.65rem;margin-left:auto">🎹指法</span>
              </div>
              <div style="font-size:0.62rem;margin-top:2px">📍 第5小节左手</div>
              <div style="font-size:0.62rem;color:#333;background:rgba(255,248,215,0.7);padding:2px 4px;border-radius:3px;margin-top:2px">💬 左手要轻</div>
              <div style="margin-top:3px">
                <span style="background:#5E6AD2;color:#fff;padding:1px 6px;border-radius:3px;font-size:0.55rem">▶️ 从00:11播</span>
              </div>
            </div>
          </div>
        `;
      case 'ready':
        return '<div class="anim-piano" style="font-size:3rem">🎉</div>';
      default:
        return '<div class="anim-piano" style="font-size:3rem">🎹</div>';
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
