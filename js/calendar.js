"use strict";

/* ==========================================
   📅 日历页面
   ========================================== */

let calendarState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-indexed
  view: 'month',
  weekOffset: 0
};

/* ------------------------------------------
   页面渲染（预建 logsMap 缓存，避免多次遍历）
   ------------------------------------------ */
function renderCalendar() {
  const page = document.getElementById('page-calendar');
  if (!page) return;

  const viewToggle = `
    <div class="calendar-view-toggle">
      <button class="calendar-view-toggle-btn ${calendarState.view === 'week' ? 'active' : ''}" id="viewWeek">📅 周</button>
      <button class="calendar-view-toggle-btn ${calendarState.view === 'month' ? 'active' : ''}" id="viewMonth">📅 月</button>
    </div>
  `;

  // 预建 logsMap（一次遍历，O(n)，供两个视图共享）
  const allLogs = DB.logs();
  const logsMap = new Map();
  for (let i = 0; i < allLogs.length; i++) {
    logsMap.set(allLogs[i].date, allLogs[i]);
  }

  const contentHTML = calendarState.view === 'week'
    ? buildWeekViewHTML(logsMap)
    : buildCalendarHTML(calendarState.year, calendarState.month, logsMap);

  const msStats = computeMilestoneStats();
  const milestonesHTML = buildMilestonesHTML(msStats.maxStarsDay, msStats.maxDurationDay, msStats.currentStreak);

  page.innerHTML = viewToggle + contentHTML + milestonesHTML;
  bindCalendarEvents();
  bindViewToggleEvents();
}

/* ------------------------------------------
   构建日历 HTML（复用预建的 logsMap，避免重复遍历）
   ------------------------------------------ */
function buildCalendarHTML(year, month, logsMap) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const todayStr = Utils.today();
  
  // 月份名称
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];
  
  // 计算统计
  const monthDays = StreakManager.getMonthDays(year, month);
  const monthMinutes = StreakManager.getMonthMinutes(year, month);
  const streak = StreakManager.calculate();
  
  const cells = [];
  
  // 上个月的日期（补齐）
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(`<div class="calendar-day other-month" data-date="${dateStr}">${d}</div>`);
  }
  
  // 本月日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const log = logsMap.get(dateStr);

    const classes = ['calendar-day'];
    if (isToday) classes.push('today');
    if (log) classes.push('has-practice');
    else if (dateStr < todayStr) classes.push('missed');

    let starHtml = '';
    if (log) {
      let starCount = 0;
      const entries = log.entries;
      for (let j = 0; j < entries.length; j++) {
        starCount += entries[j].rating || 0;
      }
      if (starCount > 0) starHtml = `<span class="day-star">${starCount}⭐</span>`;
    }

    cells.push(`<div class="${classes.join(' ')}" data-date="${dateStr}">${d}${starHtml}</div>`);
  }
  
  // 下个月的日期（补齐）
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  for (let d = 1; d <= remaining; d++) {
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(`<div class="calendar-day other-month" data-date="${dateStr}">${d}</div>`);
  }
  
  return `
    <div class="calendar-nav">
      <button class="calendar-nav-btn" id="prevMonth">◀</button>
      <span class="calendar-month">📅 ${year}年 ${monthNames[month]}</span>
      <button class="calendar-nav-btn" id="nextMonth">▶</button>
    </div>
    
    <div class="calendar-grid">
      ${dayHeaders.map(h => `<div class="calendar-weekday">${h}</div>`).join('')}
      ${cells.join('')}
    </div>
    
    <div class="calendar-stats">
      <div class="stat-card">
        <div class="stat-number">${monthDays}</div>
        <div class="stat-label">本月练习</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Math.round(monthMinutes / 60 * 10) / 10}</div>
        <div class="stat-label">本月时长(h)</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${streak}</div>
        <div class="stat-label">连续打卡</div>
      </div>
    </div>
  `;
}

/* ------------------------------------------
   绑定日历事件
   ------------------------------------------ */
function bindCalendarEvents() {
  // 上一个月
  const prevBtn = document.getElementById('prevMonth');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      calendarState.month--;
      if (calendarState.month < 0) {
        calendarState.month = 11;
        calendarState.year--;
      }
      renderCalendar();
    });
  }
  
  // 下一个月
  const nextBtn = document.getElementById('nextMonth');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      calendarState.month++;
      if (calendarState.month > 11) {
        calendarState.month = 0;
        calendarState.year++;
      }
      renderCalendar();
    });
  }
  
  // 点击日期
  document.querySelectorAll('.calendar-day:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => {
      const date = cell.dataset.date;
      showDayDetail(date);
    });
  });
}

function buildWeekViewHTML(logsMap) {
  const todayStr = Utils.today();
  const today = new Date(todayStr + 'T00:00:00');
  const dayOfWeek = today.getDay();

  // Start from Sunday of week (offset by weekOffset)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek + (calendarState.weekOffset * 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  const cells = [];
  let totalDays = 0;
  let totalMin = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const log = logsMap.get(dateStr);

    let duration = 0;
    let stars = 0;
    if (log) {
      duration = log.totalDurationMin || 0;
      const entries = log.entries;
      for (let j = 0; j < entries.length; j++) {
        stars += entries[j].rating || 0;
      }
      totalDays++;
      totalMin += duration;
    }

    cells.push('<div class="calendar-week-cell ' + (isToday ? 'today ' : '') + (!log ? 'no-practice ' : '') + '" data-date="' + dateStr + '" onclick="showDayDetail(\'' + dateStr + '\')"><div class="week-day-name">' + dayHeaders[d.getDay()] + '</div><div class="week-date">' + d.getDate() + '</div>' + (duration > 0 ? '<div class="week-duration">⏱ ' + duration + '分</div>' : '') + (stars > 0 ? '<div class="week-stars">' + stars + '⭐</div>' : '') + '</div>');
  }

  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  return `
    <div class="calendar-nav" style="margin-bottom:10px">
      <span class="calendar-nav-btn" id="prevWeek" style="cursor:pointer;padding:4px 10px;color:var(--text-2);font-size:0.85rem">◀</span>
      <span class="calendar-month" style="font-size:0.95rem">${monthNames[weekStart.getMonth()]}${weekStart.getDate()}日 — ${monthNames[weekEnd.getMonth()]}${weekEnd.getDate()}日</span>
      <span class="calendar-nav-btn" id="nextWeek" style="cursor:pointer;padding:4px 10px;color:var(--text-2);font-size:0.85rem">▶</span>
    </div>

    <div class="calendar-week-grid">
      ${cells.join('')}
    </div>

    <div class="calendar-stats">
      <div class="stat-card">
        <div class="stat-number">${totalDays}</div>
        <div class="stat-label">本周练习天数</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${totalMin}</div>
        <div class="stat-label">本周练习分钟</div>
      </div>
    </div>

    <div class="text-xs text-3 text-center mt-16">
      点击日期查看详情
    </div>
  `;
}

function bindViewToggleEvents() {
  const weekBtn = document.getElementById('viewWeek');
  const monthBtn = document.getElementById('viewMonth');
  if (weekBtn) weekBtn.addEventListener('click', () => {
    calendarState.view = 'week';
    calendarState.weekOffset = 0;
    renderCalendar();
  });
  if (monthBtn) monthBtn.addEventListener('click', () => {
    calendarState.view = 'month';
    renderCalendar();
  });

  // Week navigation
  const prevWeek = document.getElementById('prevWeek');
  const nextWeek = document.getElementById('nextWeek');
  if (prevWeek) prevWeek.addEventListener('click', () => {
    calendarState.weekOffset--;
    renderCalendar();
  });
  if (nextWeek) nextWeek.addEventListener('click', () => {
    calendarState.weekOffset++;
    renderCalendar();
  });
}

/* ------------------------------------------
   显示某一天的详情
   ------------------------------------------ */
function showDayDetail(date) {
  const log = DB.logs().find(l => l.date === date);
  
  const modal = document.getElementById('modalContainer');
  
  if (!log) {
    modal.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">📅 ${Utils.formatDateFull(date)}</h2>
            <button class="modal-close" onclick="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="empty-state">
              <div class="empty-icon">😴</div>
              <div class="empty-title">这天没有练琴</div>
              <div class="empty-description">继续保持每日练习的好习惯吧！</div>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  // 统计
  const totalStars = log.entries.reduce((s, e) => s + (e.rating || 0), 0);
  const totalMin = log.totalDurationMin || 0;
  
  // 按分类分组
  const grouped = {};
  const categoryLabels = {
    suzuki: '🎻 铃木',
    beyer: '🎼 拜厄',
    pieces: '🎵 小曲集',
    free: '🎹 自由练习',
    review: '🎲 复习'
  };

  log.entries.forEach(entry => {
    const cat = entry.category || 'pieces';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  });
  
  const categoryBlocks = Object.entries(grouped).map(([cat, entries]) => {
    const catMin = entries.reduce((s, e) => s + (e.durationMin || 0), 0);
    const catStars = entries.reduce((s, e) => s + (e.rating || 0), 0);
    
    const piecesList = entries.map(entry => `
      <div class="p-12 mb-8" style="background:rgba(255,255,255,0.04);border-radius:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <span class="font-bold">${Utils.escape(entry.pieceName)}</span>
          ${entry.rating ? '<span style="white-space:nowrap;flex-shrink:0">' + '⭐'.repeat(entry.rating) + '</span>' : ''}
        </div>
        ${entry.durationMin ? '<div class="text-xs text-3 mt-4">⏱ ' + entry.durationMin + '分钟</div>' : ''}
      </div>
    `).join('');
    
    return `
      <div class="mb-16">
        <div class="flex-between mb-8">
          <span class="font-bold text-sm">${categoryLabels[cat]}</span>
          <span class="text-xs text-2">${catMin}分钟 · ${catStars}⭐</span>
        </div>
        ${piecesList}
      </div>
    `;
  }).join('');
  
  modal.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">📅 ${Utils.formatDateFull(date)}</h2>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        
        <div class="modal-body">
          <div class="calendar-stats mb-16">
            <div class="stat-card">
              <div class="stat-number">${totalStars}</div>
              <div class="stat-label">获得星星</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${totalMin}</div>
              <div class="stat-label">练琴分钟</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${log.entries.length}</div>
              <div class="stat-label">练习曲目</div>
            </div>
          </div>
          
          ${categoryBlocks}
          
          ${log.parentNotes ? `
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">
                  <span class="card-title-icon">📝</span>
                  家长笔记
                </h3>
              </div>
              <p style="font-size:0.9rem;line-height:1.6;color:var(--text-2)">
                ${Utils.escape(log.parentNotes)}
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

