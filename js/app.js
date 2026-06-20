"use strict";

/* ==========================================
   🔄 标签页切换
   ========================================== */
window.switchToTab = function(tabName) {
  // 更新标签按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 更新页面显示
  document.querySelectorAll('.page').forEach(page => {
    if (page.id === 'page-' + tabName) {
      page.classList.add('active');
    } else {
      page.classList.remove('active');
    }
  });

  // 重新渲染对应页面
  switch (tabName) {
    case 'today':
      renderToday();
      break;
    case 'lessons':
      renderLessons();
      break;
    case 'calendar':
      renderCalendar();
      break;
    case 'repertoire':
      renderRepertoire();
      break;
    case 'stats':
      renderStats();
      break;
  }
};

/* ==========================================
   🎨 模态框关闭
   ========================================== */
window.closeModal = function() {
  const container = document.getElementById('modalContainer');
  if (container) {
    container.innerHTML = '';
  }
};

/* ==========================================
   📜 滚动优化 - 头部阴影（使用 IntersectionObserver 避免频繁 scroll 监听）
   ========================================== */
function initScrollEffects() {
  const header = document.getElementById('header');
  const mainContent = document.getElementById('mainContent');
  if (!header || !mainContent) return;

  // 创建一个 1px 高的哨兵元素，放在 header 下方
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;visibility:hidden;';
  mainContent.insertBefore(sentinel, mainContent.firstChild);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // 哨兵元素不可见 = 已滚动超过 header 位置
      if (!entry.isIntersecting) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }, {
    root: mainContent,
    rootMargin: '-50px 0px 0px 0px',
    threshold: 0
  });

  observer.observe(sentinel);
}

/* ==========================================
   🎯 全局渲染函数（分批渲染，避免主线程阻塞）
   ========================================== */
function renderAll() {
  // 先更新轻量级 UI（同步，用户立即可见）
  const streak = StreakManager.calculate();
  const streakEl = document.getElementById('streakCount');
  if (streakEl) {
    streakEl.textContent = streak;
  }
  updateSyncButtonState();

  // 重页面分批渲染（requestAnimationFrame 让出主线程，避免一次性阻塞）
  const heavyRenders = [renderToday, renderLessons, renderCalendar, renderRepertoire, renderStats];
  let idx = 0;

  function runNext() {
    if (idx >= heavyRenders.length) return;
    try {
      heavyRenders[idx]();
    } catch (e) {
      console.error('render error:', heavyRenders[idx].name, e);
    }
    idx++;
    if (idx < heavyRenders.length) {
      requestAnimationFrame(runNext);
    }
  }
  requestAnimationFrame(runNext);
}

/* ==========================================
   📅 跨日重置（双保险：visibilitychange + 0 点定时器）
   修复：PWA 挂在后台不关 / 应用一直前台开着，过 0 点不刷新的 Bug
   ========================================== */
const DateWatcher = {
  /** @type {string|null} 上次记录的日期 */
  currentDate: null,

  /**
   * 启动跨日监听（在 initApp 完成 renderAll 后调用一次）
   */
  start() {
    this.currentDate = Utils.today();

    // 保险 1：用户切回应用时检查（应对 PWA 后台被冻结后唤醒）
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.check();
    });

    // 保险 2：精确 0:00:01 定时触发（应对应用一直前台开着的场景）
    this.scheduleNextMidnight();

    console.log('📅 DateWatcher started, currentDate =', this.currentDate);
  },

  /**
   * 检查日期是否变化，变了就清状态 + 重渲染
   * 编辑模式（用户正在改昨天的记录）下跳过，避免打断用户输入
   */
  check() {
    const today = Utils.today();
    if (today === this.currentDate) return;

    // 编辑模式保护：用户正在改昨天的记录，不打断
    if (typeof TodayState !== 'undefined' && TodayState.existingLog) {
      console.log('📅 日期已变（' + this.currentDate + ' → ' + today + '），但用户在编辑模式，跳过自动重渲染');
      return;
    }

    console.log('📅 跨日重置：' + this.currentDate + ' → ' + today);
    this.currentDate = today;

    // 清空 today 临时状态（避免昨天的星星 / 计时器残留到今天）
    if (typeof TodayState !== 'undefined') TodayState.reset();

    renderAll();
  },

  /**
   * 算出距离下个 0:00:01 的毫秒数，setTimeout 触发 check + 递归调度
   * 留 1 秒余量，避免边界时刻 Utils.today() 还没切换
   */
  scheduleNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 1, 0);
    const ms = tomorrow - now;

    setTimeout(() => {
      this.check();
      this.scheduleNextMidnight();
    }, ms);
  }
};

/* ==========================================
   🚀 应用初始化
   ========================================== */

/* ==========================================
   🎉 应用加载完成
   ========================================== */

console.log(`
╔════════════════════════════════════════╗
║   🎹 哆哩的钢琴助手 v3.4_20260620      ║
║   ✅ All modules loaded successfully   ║
╚════════════════════════════════════════╝
`);

// 结束脚本标签
(async function initApp() {
  console.log('🎹 Piano Helper v3.4_20260620 initializing...');

  try {
    RepertoireManager.init();
    LogoManager.load();
    renderAll();

    // 启动跨日监听（修复 0 点不重置 Bug）
    DateWatcher.start();

    const tabBar = document.querySelector('.tab-bar');
    if (tabBar) {
      tabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (btn) switchToTab(btn.dataset.tab);
      });
    }

    initScrollEffects();
    console.log("✅ Startup ready");

    if ('serviceWorker' in navigator) {
      let newWorker = null;

      navigator.serviceWorker.register('sw.js').then(reg => {
        console.log('✅ Service Worker registered');

        // Check if a new version is already waiting
        if (reg.waiting) {
          newWorker = reg.waiting;
          showUpdateToast();
        }

        // Detect when a new version finishes installing
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker = installing;
              showUpdateToast();
            }
          });
        });
      }).catch(err => {
        console.warn('Service Worker registration failed:', err);
      });

      // If the controller changes (user activated new SW), reload
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      function showUpdateToast() {
        // Prevent duplicate toasts
        if (document.querySelector('.update-toast')) return;
        const toast = document.createElement('div');
        toast.className = 'update-toast';
        toast.textContent = '🆕 发现新版本 点击更新';
        toast.addEventListener('click', () => {
          toast.textContent = '更新中...';
          toast.style.pointerEvents = 'none';
          newWorker.postMessage('skipWaiting');
        });
        document.body.appendChild(toast);
      }
    }

    console.log('✅ Piano Helper initialized successfully');
  } catch (error) {
    console.error('❌ App initialization error:', error);
    const page = document.getElementById('page-today');
    if (page) {
      page.innerHTML = '<div class="card" style="border-left:4px solid var(--accent-red)"><h3 style="color:var(--accent-red)">⚠️ 启动错误</h3><p class="text-sm text-2 mt-8" style="line-height:1.6">' + Utils.escape(error.message) + '</p><p class="text-xs text-3 mt-8">请尝试刷新页面</p><button class="btn btn-primary mt-12" onclick="location.reload()">🔄 重新加载</button></div>';
    }
  }
})();