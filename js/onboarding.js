"use strict";

/* ==========================================
   🚀 冷启动引导 - 交互式逐步引导
   ==========================================
   新用户首次打开时，分 10 步引导用户了解核心功能：
   1. 课程 - 新建课程
   2. 课程 - 添加曲目（自动打开表单）
   3. 课程 - 课堂记录
   4. 今日 - 自动出现曲目
   5. 今日 - 查看课堂笔记
   6. 今日 - 复习与自由练习
   7. 曲库 - 添加曲子
   8. 同步 - 设备同步
   9. 完成
   ========================================== */

const Onboarding = {
  DONE_KEY: 'piano_onboarding_done',
  BUBBLE_KEY: 'piano_onboarding_bubbles',

  STEPS: [
    // ── Step 1: 欢迎 ──
    {
      title: '欢迎使用钢琴练习助手 🎹',
      body: '接下来将逐步引导你了解四个核心功能：\n📒 课程记录 → 🏠 每日练习 → 🎵 曲库管理 → 🔄 设备同步',
      tab: null,
      target: null,
      position: 'center',
      btn: '开始 →',
      action: null
    },
    // ── Step 2: 新建课程 ──
    {
      title: '📒 第一步：新建课程',
      body: '在「课程」页面，点击「➕ 新课程」按钮，开始记录一节钢琴课。',
      tab: 'lessons',
      target: '#page-lessons .btn-primary',
      fallbackTarget: '#page-lessons .empty-state .btn-primary',
      position: 'bottom',
      btn: '下一步 →',
      action: null
    },
    // ── Step 3: 添加曲目（自动打开表单） ──
    {
      title: '📝 添加曲目',
      body: '表单已打开。点击「➕ 添加册」选择教材，再点击「＋ 添加这册的曲目」逐一添加曲子。\n也可以点击「📋 复制上节课曲目」快速导入。',
      tab: 'lessons',
      target: 'button[onclick*="showLessonAddBookPicker"]',
      fallbackTarget: '#modalContainer .modal-lesson',
      position: 'bottom',
      btn: '下一步 →',
      action: 'openForm'
    },
    // ── Step 4: 课堂记录（表单内） ──
    {
      title: '🎼 课堂记录（上传曲谱 + 图钉）',
      body: '添加曲目后，每首曲子下方会出现「🎼 课堂记录」按钮。\n点击它 → 上传曲谱照片 → 在照片上点击放置图钉 → 填写老师反馈。\n图钉会自动记录时间戳并关联课堂录音。',
      tab: null,
      target: null,
      fallbackTarget: '#modalContainer .modal-lesson',
      position: 'center',
      btn: '下一步 →',
      action: null
    },
    // ── Step 5: 今日 - 自动出现曲目 ──
    {
      title: '🏠 第二步：每日练习',
      body: '切换到「今日」页面，最近一次课程的曲目会自动出现在这里，按教材分册排列。',
      tab: 'today',
      target: '#page-today .practice-category:first-of-type',
      fallbackTarget: '#page-today',
      position: 'top',
      btn: '下一步 →',
      action: 'closeForm'
    },
    // ── Step 6: 查看课堂笔记 ──
    {
      title: '📌 查看课堂笔记',
      body: '在曲目卡片中，点击「🎼 课堂记录」按钮查看曲谱照片和老师标注的图钉。\n点击图钉查看详情，可播放对应时间点的课堂录音。\n每条反馈可点击圆圈标记「✅ 完成」。',
      tab: 'today',
      target: null,
      fallbackTarget: '#page-today',
      position: 'center',
      btn: '下一步 →',
      action: null
    },
    // ── Step 7: 复习与自由练习 ──
    {
      title: '🔁 复习与自由练习',
      body: '「复习」区域：根据历史练习记录，自动推荐需要复习的曲目。点击「⚙️ 范围」可自定义复习范围。\n「自由练习」：添加曲库中任意曲目进行练习。',
      tab: 'today',
      target: '#page-today .practice-category[data-cat="review"]',
      fallbackTarget: '#page-today',
      position: 'top',
      btn: '下一步 →',
      action: null
    },
    // ── Step 8: 曲库 ──
    {
      title: '🎵 第三步：曲库管理',
      body: '在「曲库」页面，点击「🔧 编辑曲库」→「📚 新建分册」添加教材，再点击「＋ 添加曲目」逐一录入。\n也支持「📥 导入曲目」批量导入。',
      tab: 'repertoire',
      target: '#page-repertoire',
      fallbackTarget: '#page-repertoire',
      position: 'center',
      btn: '下一步 →',
      action: null
    },
    // ── Step 9: 同步 ──
    {
      title: '🔄 第四步：设备同步',
      body: '点击顶栏的「🔄 同步」按钮，生成同步码 → 在另一台设备粘贴导入。\n支持选择性同步课程、练习日志、曲库进度。',
      tab: null,
      target: '#syncBtn',
      fallbackTarget: '#header',
      position: 'bottom',
      btn: '下一步 →',
      action: null
    },
    // ── Step 10: 完成 ──
    {
      title: '准备好了！',
      body: '现在从「课程」开始，记录第一节课吧！\n\n💡 提示：顶栏「📖 使用方法」可随时重新查看本引导。',
      tab: 'lessons',
      target: null,
      position: 'center',
      btn: '开始使用',
      action: null
    }
  ],

  _currentStep: 0,
  _overlay: null,
  _card: null,
  _spotlight: null,
  _formWasOpened: false,  // 是否由引导打开了课程表单

  shouldStart() {
    return localStorage.getItem(this.DONE_KEY) !== '1';
  },

  start() {
    this._currentStep = 0;
    this._formWasOpened = false;
    this._render();
  },

  // ──────────────────────────────────────
  //  主渲染入口
  // ──────────────────────────────────────

  _render() {
    this._cleanup();
    var step = this.STEPS[this._currentStep];
    var self = this;

    // ── 处理上一步的清理 ──
    if (this._currentStep > 0) {
      var prevStep = this.STEPS[this._currentStep - 1];
      // 如果上一步打开了表单，且当前步不是表单内步骤 → 关闭表单
      if (prevStep.action === 'openForm' && step.action !== 'openForm' && !this._isFormStep(step)) {
        this._closeFormIfNeeded();
      }
    }

    // ── 执行当前步的动作 ──
    if (step.action === 'openForm') {
      // 打开课程表单
      this._formWasOpened = true;
      if (step.tab) {
        window.switchToTab(step.tab);
      }
      // 等页面渲染后打开表单，再等表单渲染后显示引导
      setTimeout(function() {
        window.showLessonForm();
        setTimeout(function() {
          self._renderOverlay(step);
        }, 400);
      }, 200);
      return;
    }

    if (step.action === 'closeForm') {
      this._closeFormIfNeeded();
    }

    // ── 切换 tab ──
    if (step.tab) {
      window.switchToTab(step.tab);
    }

    // ── 等待 DOM 渲染后显示引导 ──
    setTimeout(function() {
      self._renderOverlay(step);
    }, 300);
  },

  /**
   * 判断当前步骤是否在课程表单内（Step 3 或 Step 4）
   */
  _isFormStep(step) {
    return step.action === 'openForm' ||
      (this._formWasOpened && this._currentStep === 3); // Step 4 (index 3)
  },

  _closeFormIfNeeded() {
    if (this._formWasOpened) {
      this._formWasOpened = false;
      if (typeof window.closeModal === 'function') {
        window.closeModal();
      }
    }
  },

  // ──────────────────────────────────────
  //  渲染遮罩 + 聚光灯 + 引导卡片
  // ──────────────────────────────────────

  _renderOverlay(step) {
    var total = this.STEPS.length;
    var self = this;
    var idx = this._currentStep;

    // 创建遮罩
    var overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;pointer-events:auto';
    document.body.appendChild(overlay);
    this._overlay = overlay;

    // 创建聚光灯层
    var spotlight = document.createElement('div');
    spotlight.id = 'onboarding-spotlight';
    spotlight.style.cssText = 'position:fixed;inset:0;z-index:10001;pointer-events:none;transition:all 0.4s ease';
    document.body.appendChild(spotlight);
    this._spotlight = spotlight;

    // 查找目标元素
    var targetEl = null;
    if (step.target) {
      targetEl = document.querySelector(step.target);
    }
    if (!targetEl && step.fallbackTarget) {
      targetEl = document.querySelector(step.fallbackTarget);
    }

    // 创建引导卡片
    var dots = Array.from({ length: total }, function(_, i) {
      return '<span class="onboarding-dot' + (i === idx ? ' active' : '') + '"></span>';
    }).join('');

    // body 中的换行符转为 <br>
    var bodyHtml = Utils.escape(step.body).replace(/\n/g, '<br>');

    var card = document.createElement('div');
    card.className = 'onboarding-guide-card';
    card.style.cssText = 'position:fixed;z-index:10002;background:rgba(20,25,52,0.96);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px 24px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:auto;transition:all 0.4s ease';
    card.innerHTML =
      '<div class="onboarding-step-indicator" style="font-size:0.7rem;color:var(--text-4);margin-bottom:6px">步骤 ' + (idx + 1) + ' / ' + total + '</div>' +
      '<h2 style="font-size:1.1rem;font-weight:700;color:var(--text-1);margin:0 0 8px 0">' + step.title + '</h2>' +
      '<p style="font-size:0.85rem;color:var(--text-2);line-height:1.6;margin:0 0 16px 0">' + bodyHtml + '</p>' +
      '<div class="onboarding-dots" style="display:flex;gap:6px;justify-content:center;margin-bottom:14px">' + dots + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        (idx > 0
          ? '<button class="btn btn-secondary btn-sm" onclick="Onboarding._prev()" style="font-size:0.8rem">← 上一步</button>'
          : '<span></span>') +
        '<button class="btn btn-primary btn-sm" onclick="Onboarding._next()" style="font-size:0.8rem;min-width:80px">' + step.btn + '</button>' +
      '</div>' +
      '<button onclick="Onboarding._skip()" style="display:block;margin:12px auto 0;background:none;border:none;color:var(--text-4);font-size:0.72rem;cursor:pointer;padding:4px 8px">跳过引导</button>';
    document.body.appendChild(card);
    this._card = card;

    // 定位卡片和聚光灯
    this._positionCard(step, targetEl);

    document.body.style.overflow = 'hidden';
  },

  // ──────────────────────────────────────
  //  定位
  // ──────────────────────────────────────

  _positionCard(step, targetEl) {
    var self = this;
    requestAnimationFrame(function() {
      var card = self._card;
      var spotlight = self._spotlight;
      if (!card) return;

      var vw = document.documentElement.clientWidth;
      var vh = document.documentElement.clientHeight;
      var cardRect = card.getBoundingClientRect();
      var cardW = cardRect.width || 320;
      var cardH = cardRect.height || 200;

      var targetRect = targetEl ? targetEl.getBoundingClientRect() : null;

      if (step.position === 'center' || !targetRect) {
        // 居中显示
        card.style.left = Math.floor((vw - cardW) / 2) + 'px';
        card.style.top = Math.floor((vh - cardH) / 2) + 'px';

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

        // 引导卡片放在目标下方
        var cardTop = targetRect.bottom + 20;
        var cardLeft = Math.max(16, Math.min(vw - cardW - 16, targetRect.left + targetRect.width / 2 - cardW / 2));

        // 如果下方不够放，放上方
        if (cardTop + cardH > vh - 16) {
          cardTop = targetRect.top - cardH - 20;
        }
        // 如果上方也不够，贴近顶部
        if (cardTop < 16) {
          cardTop = 16;
        }

        card.style.left = Math.floor(cardLeft) + 'px';
        card.style.top = Math.floor(cardTop) + 'px';

        // 聚光灯：挖洞效果
        if (spotlight) {
          var cx = sx + sw / 2;
          var cy = sy + sh / 2;
          var radius = Math.max(sw, sh) / 2;
          spotlight.style.background =
            'radial-gradient(ellipse at ' + cx + 'px ' + cy + 'px, ' +
            'transparent ' + radius + 'px, ' +
            'rgba(0,0,0,0.6) ' + (radius + 2) + 'px)';
          spotlight.style.boxShadow = 'none';
        }
      }
    });
  },

  // ──────────────────────────────────────
  //  导航
  // ──────────────────────────────────────

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
      // 如果当前在表单步骤，且回退到表单外的步骤，需要关闭表单
      var currentStep = this.STEPS[this._currentStep];
      if (this._isFormStep(currentStep)) {
        this._closeFormIfNeeded();
      }
      this._currentStep--;
      this._render();
    }
  },

  _skip() {
    this._closeFormIfNeeded();
    this._finish();
  },

  _finish() {
    this._closeFormIfNeeded();
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
  //  气泡提示系统（保留，供后续功能扩展使用）
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