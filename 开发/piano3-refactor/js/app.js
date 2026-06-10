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
   📜 滚动优化 - 头部阴影
   ========================================== */

function initScrollEffects() {
  const mainContent = document.getElementById('mainContent');
  const header = document.getElementById('header');
  
  if (!mainContent || !header) return;
  
  mainContent.addEventListener('scroll', Utils.throttle((e) => {
    const scrollTop = e.target.scrollTop;
    
    if (scrollTop > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, 100));
}

/* ==========================================
   🎯 全局渲染函数
   ========================================== */

function renderAll() {
  // 更新连续打卡
  const streak = StreakManager.calculate();
  const streakEl = document.getElementById('streakCount');
  if (streakEl) {
    streakEl.textContent = streak;
  }
  
  // 更新同步按钮
  updateSyncButtonState();

  // 渲染各个页面  // 渲染各个页面
  renderToday();
  renderLessons();
  renderCalendar();
  renderRepertoire();
  renderStats();
}

/* ==========================================
   🚀 应用初始化
   ========================================== */

/* ==========================================
   🎉 应用加载完成
   ========================================== */

console.log(`
╔════════════════════════════════════════╗
║   🎹 哆哩的钢琴助手 v3.1               ║
║   ✅ All modules loaded successfully   ║
╚════════════════════════════════════════╝
`);

// 结束脚本标签

(async function initApp() {
  console.log('🎹 Piano Helper v3.1 initializing...');

  try {
    RepertoireManager.init();
    LogoManager.load();
    renderAll();

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
