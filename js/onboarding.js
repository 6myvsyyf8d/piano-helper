"use strict";

/* ==========================================
   🚀 冷启动引导 - 全屏沉浸式引导
   ==========================================
   新用户首次打开时，显示实际应用界面 +
   半透明遮罩 + 指向真实 UI 元素的引导卡片。
   完成后不再显示。
   ========================================== */

const Onboarding = {
  DONE_KEY: 'piano_onboarding_done',
  BUBBLE_KEY: 'piano_onboarding_bubbles',

  STEPS: [
    {
      title: '欢迎使用钢琴练习助手 🎹',
      body: '一站式管理孩子的钢琴练习：记录每日练习、上课标注反馈、查看曲谱提醒。',
      tab: null,       // 不切换 tab，居中显示
      target: null,    // 无特定目标元素
      position: 'center',
      btn: '开始 →'
    },
    {
      title: '📋 记录每天的练习',
      body: '在「今日」页面：选曲子 → 设速度 → 开始计时 → 练完评分保存。',
      tab: 'today',
      target: '#page-today .practice-category:first-of-type',
      targetLabel: '在这里选择曲子开始练习',
      position: 'top',
      btn: '下一步 →'
    },
    {
      title: '🎼 上课时记录反馈',
      body: '在「课程」页面新建课程，点击曲子旁的「🎼 课堂记录」按钮：上传曲谱照片 → 在照片上点击放置图钉 → 填写反馈内容。',
      tab: 'lessons',
      target: '#page-lessons',
      targetLabel: '课程页面 → 点击「🎼 课堂记录」',
      position: 'center',
      btn: '下一步 →'
    },
    {
      title: '🔍 练习时查看提醒',
      body: '在「今日」页面点击「🎼 课堂记录」按钮查看曲谱照片，点击图钉查看详情。',
      tab: 'today',
      target: '#page-today',
      targetLabel: '今日页面 → 找到「🎼 课堂记录」按钮',
      position: 'center',
      btn: '下一步 →'
    },
    {
      title: '准备好了！',
      body: '先添加一首孩子正在练的曲子，开始记录吧。',
      tab: null,
      target: null,
      position: 'center',
      btn: '开始使用'
    }
  ],

  _currentStep: 0,
  _overlay: null,
  _card: null,
  _spotlight: null,

  shouldStart() {
    return localStorage.getItem(this.DONE_KEY) !== '1';
  },

  start() {
    this._currentStep = 0;
    this._render();
  },

  _render() {
    this._cleanup();
    var step = this.STEPS[this._currentStep];
    var total = this.STEPS.length;
    var self = this;

    // 切换 tab
    if (step.tab) {
      this._switchTab(step.tab);
    }

    // 创建遮罩
    var overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;pointer-events:auto';
    document.body.appendChild(overlay);
    this._overlay = overlay;

    // 创建聚光灯层（遮罩挖洞）
    var spotlight = document.createElement('div');
    spotlight.id = 'onboarding-spotlight';
    spotlight.style.cssText = 'position:fixed;inset:0;z-index:10001;pointer-events:none;transition:all 0.4s ease';
    document.body.appendChild(spotlight);
    this._spotlight = spotlight;

    // 创建引导卡片
    var dots = Array.from({ length: total }, function(_, i) {
      return '<span class="onboarding-dot' + (i === self._currentStep ? ' active' : '') + '"></span>';
    }).join('');

    var card = document.createElement('div');
    card.className = 'onboarding-guide-card';
    card.style.cssText = 'position:fixed;z-index:10002;background:rgba(20,25,52,0.95);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px 24px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:auto;transition:all 0.4s ease';
    card.innerHTML =
      '<div class="onboarding-step-indicator" style="font-size:0.7rem;color:var(--text-4);margin-bottom:6px">步骤 ' + (self._currentStep + 1) + ' / ' + total + '</div>' +
      '<h2 style="font-size:1.1rem;font-weight:700;color:var(--text-1);margin:0 0 8px 0">' + step.title + '</h2>' +
      '<p style="font-size:0.85rem;color:var(--text-2);line-height:1.5;margin:0 0 16px 0">' + step.body + '</p>' +
      '<div class="onboarding-dots" style="display:flex;gap:6px;justify-content:center;margin-bottom:14px">' + dots + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        (self._currentStep > 0
          ? '<button class="btn btn-secondary btn-sm" onclick="Onboarding._prev()" style="font-size:0.8rem">← 上一步</button>'
          : '<span></span>') +
        '<button class="btn btn-primary btn-sm" onclick="Onboarding._next()" style="font-size:0.8rem;min-width:80px">' + step.btn + '</button>' +
      '</div>' +
      '<button onclick="Onboarding._skip()" style="display:block;margin:12px auto 0;background:none;border:none;color:var(--text-4);font-size:0.72rem;cursor:pointer;padding:4px 8px">跳过引导</button>';
    document.body.appendChild(card);
    this._card = card;

    // 定位
    this._positionCard(step);

    document.body.style.overflow = 'hidden';
  },

  _switchTab(tab) {
    // 尝试通过点击 tab 按钮切换页面
    var tabMap = {
      'today': 'tab-today',
      'lessons': 'tab-lessons',
      'calendar': 'tab-calendar',
      'repertoire': 'tab-repertoire',
      'stats': 'tab-stats'
    };
    var tabId = tabMap[tab];
    if (tabId) {
      var btn = document.getElementById(tabId);
      if (btn) btn.click();
    }
    // 如果 app 有 switchPage 函数
    if (typeof window.switchPage === 'function') {
      window.switchPage(tab);
    }
  },

  _positionCard(step) {
    var self = this;
    // 等待一帧让 DOM 渲染
    requestAnimationFrame(function() {
      var card = self._card;
      var spotlight = self._spotlight;
      if (!card) return;

      var vw = document.documentElement.clientWidth;
      var vh = document.documentElement.clientHeight;
      var cardRect = card.getBoundingClientRect();
      var cardW = cardRect.width;
      var cardH = cardRect.height;

      var targetEl = null;
      var targetRect = null;

      if (step.target) {
        targetEl = document.querySelector(step.target);
        if (targetEl) {
          targetRect = targetEl.getBoundingClientRect();
        }
      }

      if (step.position === 'center' || !targetRect) {
        // 居中显示
        card.style.left = Math.floor((vw - cardW) / 2) + 'px';
        card.style.top = Math.floor((vh - cardH) / 2) + 'px';

        // 聚光灯：全屏半透明遮罩
        if (spotlight) {
          spotlight.style.background = 'rgba(0,0,0,0.6)';
          spotlight.style.boxShadow = 'none';
        }
      } else {
        // 指向目标元素
        var pad = 16;
        var sx = Math.max(0, targetRect.left - pad);
        var sy = Math.max(0, targetRect.top - pad);
        var sw = Math.min(vw - sx, targetRect.width + pad * 2);
        var sh = Math.min(vh - sy, targetRect.height + pad * 2);

        // 引导卡片放在目标下方或上方
        var cardTop = targetRect.bottom + 20;
        var cardLeft = Math.max(16, Math.min(vw - cardW - 16, targetRect.left + targetRect.width / 2 - cardW / 2));

        if (cardTop + cardH > vh - 16) {
          cardTop = targetRect.top - cardH - 20;
        }
        if (cardTop < 16) {
          cardTop = 16;
        }

        card.style.left = Math.floor(cardLeft) + 'px';
        card.style.top = Math.floor(cardTop) + 'px';

        // 聚光灯：挖洞效果
        if (spotlight) {
          spotlight.style.background =
            'radial-gradient(ellipse at ' + (sx + sw/2) + 'px ' + (sy + sh/2) + 'px, ' +
            'transparent ' + (Math.max(sw, sh)/2) + 'px, ' +
            'rgba(0,0,0,0.6) ' + (Math.max(sw, sh)/2 + 2) + 'px)';
          spotlight.style.boxShadow = 'none';
        }
      }
    });
  },

  _next() {
    if (this._currentStep < this.STEPS.length - 1) {
      this._currentStep++;
      this._render();
    } else {
      this._finish();
    }
  },

  _prev() {
    if (this._currentStep > 0) {
      this._currentStep--;
      this._render();
    }
  },

  _skip() {
    this._finish();
  },

  _finish() {
    this._cleanup();
    document.body.style.overflow = '';
    localStorage.setItem(this.DONE_KEY, '1');
    console.log('✅ Onboarding completed');
  },

  _cleanup() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    if (this._spotlight) { this._spotlight.remove(); this._spotlight = null; }
    if (this._card) { this._card.remove(); this._card = null; }
  },

  // ──────────────────────────────────────────
  // 气泡提示系统
  // ──────────────────────────────────────────

  _bubblesShown() {
    try {
      return JSON.parse(localStorage.getItem(this.BUBBLE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  },

  isBubbleShown(id) {
    return !!this._bubblesShown()[id];
  },

  showBubble(id, text, targetEl, opts) {
    opts = opts || {};
    if (!targetEl || this.isBubbleShown(id)) return;

    var position = opts.position || 'bottom';
    var rect = targetEl.getBoundingClientRect();

    var bubble = document.createElement('div');
    bubble.className = 'onboarding-bubble onboarding-bubble-' + position;
    bubble.innerHTML =
      '<div class="onboarding-bubble-text">' + Utils.escape(text) + '</div>' +
      '<button class="onboarding-bubble-close" onclick="this.parentElement.remove()">✕</button>';
    document.body.appendChild(bubble);

    var bRect = bubble.getBoundingClientRect();
    var top, left;
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
    left = Math.max(8, Math.min(left, window.innerWidth - bRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - bRect.height - 8));
    bubble.style.top = top + 'px';
    bubble.style.left = left + 'px';

    var shown = this._bubblesShown();
    shown[id] = true;
    localStorage.setItem(this.BUBBLE_KEY, JSON.stringify(shown));

    if (opts.timeout) {
      setTimeout(function() { bubble.remove(); }, opts.timeout);
    }
  }
};

window.Onboarding = Onboarding;