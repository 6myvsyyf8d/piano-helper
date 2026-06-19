/* ==========================================
   📊 统计页面
   ========================================== */

"use strict";

function renderStats() {
  const page = document.getElementById('page-stats');
  if (!page) return;

  const logs = DB.logs();
  const lessons = DB.lessons();
  const rep = DB.repertoire();
  const today = Utils.today();

  // ── 预建数据索引（O(n)，供后续所有逻辑复用） ──
  const now = new Date(today + 'T00:00:00');
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  // 单次遍历，同时计算本月/上月/总计
  let daysThisMonth = 0;
  let daysLastMonth = 0;
  let minThisMonth = 0;
  let minLastMonth = 0;
  let totalMin = 0;
  let totalStars = 0;
  let maxStarsDay = 0;
  let maxStarsDayDate = '';
  let maxDurationDay = 0;
  let maxDurationDayDate = '';

  const logsByDate = new Map();
  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    logsByDate.set(l.date, l);
    const min = l.totalDurationMin || 0;
    totalMin += min;

    // 计算单日星星数
    let dayStars = 0;
    if (l.entries) {
      for (const e of l.entries) {
        dayStars += (e.rating || 0);
      }
    }
    totalStars += dayStars;

    // 记录最高星星日
    if (dayStars > maxStarsDay) {
      maxStarsDay = dayStars;
      maxStarsDayDate = l.date;
    }

    // 记录最高时长日
    if (min > maxDurationDay) {
      maxDurationDay = min;
      maxDurationDayDate = l.date;
    }

    const d = new Date(l.date + 'T00:00:00');
    if (d.getFullYear() === thisYear && d.getMonth() === thisMonth) {
      daysThisMonth++;
      minThisMonth += min;
    } else if (d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth) {
      daysLastMonth++;
      minLastMonth += min;
    }
  }

  // 计算连续练琴天数
  let currentStreak = 0;
  const sortedDates = [...logsByDate.keys()].sort().reverse();
  if (sortedDates.length > 0) {
    let checkDate = new Date(today + 'T00:00:00');
    // 如果今天没有练习，从昨天开始计算
    if (!logsByDate.has(today)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (logsByDate.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const totalDays = logs.length;
  const totalHours = (totalMin / 60).toFixed(1);

  const dayDelta = daysThisMonth - daysLastMonth;
  const minDelta = minThisMonth - minLastMonth;
  const deltaArrow = (v) => v > 0 ? '↑' : v < 0 ? '↓' : '→';
  const deltaColor = (v) => v > 0 ? 'var(--accent-green)' : v < 0 ? 'var(--accent-red)' : 'var(--text-3)';

  const overviewHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">📋 练习总览</h3></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">本月天数</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--text-1)">${daysThisMonth}<span style="font-size:0.8rem;font-weight:400;color:var(--text-3)"> 天</span></div>
          <div style="font-size:0.7rem;color:${deltaColor(dayDelta)};margin-top:2px">${deltaArrow(dayDelta)} ${Math.abs(dayDelta)} 天 vs 上月 (${daysLastMonth}天)</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">本月时长</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--text-1)">${Math.round(minThisMonth / 60 * 10) / 10}<span style="font-size:0.8rem;font-weight:400;color:var(--text-3)"> h</span></div>
          <div style="font-size:0.7rem;color:${deltaColor(minDelta)};margin-top:2px">${deltaArrow(minDelta)} ${Math.round(Math.abs(minDelta) / 60 * 10) / 10}h vs 上月</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">累计天数</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--text-1)">${totalDays}<span style="font-size:0.8rem;font-weight:400;color:var(--text-3)"> 天</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">累计时长</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--text-1)">${totalHours}<span style="font-size:0.8rem;font-weight:400;color:var(--text-3)"> h</span></div>
        </div>
      </div>
    </div>
  `;

  // ── Card 2: 曲目进度 ──
  const learned = rep.filter(p => p.status === 'learned').length;
  const learning = rep.filter(p => p.status === 'learning').length;
  const untouched = rep.filter(p => p.status === 'untouched').length;
  const totalRep = rep.length;
  const learnedPct = totalRep ? Math.round(learned / totalRep * 100) : 0;
  const learningPct = totalRep ? Math.round(learning / totalRep * 100) : 0;
  const barColors = ['--accent-green', '--accent-yellow', '--border-2'];
  const barLabels = [
    { label: '已学会', count: learned, pct: learnedPct, color: 'var(--accent-green)' },
    { label: '学习中', count: learning, pct: learningPct, color: 'var(--accent-yellow)' },
    { label: '未学', count: untouched, pct: totalRep ? 100 - learnedPct - learningPct : 0, color: 'var(--border-2)' }
  ];

  const progressHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">📖 曲目进度</h3></div>
      <div style="display:flex;height:24px;border-radius:12px;overflow:hidden;margin-bottom:12px;gap:2px">
        ${barLabels.filter(b => b.count > 0).map(b =>
          '<div style="height:100%;width:' + b.pct + '%;background:' + b.color + ';border-radius:12px;transition:width 0.5s var(--ease-out)"></div>'
        ).join('')}
      </div>
      <div style="display:flex;gap:20px;font-size:0.78rem;color:var(--text-2)">
        ${barLabels.map(b => '<span>● ' + b.label + ' <strong style="color:var(--text-1)">' + b.count + '</strong> 首</span>').join('')}
      </div>
    </div>
  `;

  // ── Card 3: 7天 + 30天趋势 ──
  // 使用预建的 logsByDate Map，O(1) 查找
  function buildTrendBars(days) {
    let maxMin = 1;
    const barData = new Array(days);
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - (days - 1 - i));
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const log = logsByDate.get(ds);
      const min = log ? (log.totalDurationMin || 0) : 0;
      if (min > maxMin) maxMin = min;
      barData[i] = { min, month: d.getMonth() + 1, day: d.getDate(), isToday: ds === today };
    }

    const parts = [];
    for (let i = 0; i < days; i++) {
      const b = barData[i];
      const h = maxMin > 0 ? Math.max(4, Math.round(b.min / maxMin * 100)) : 4;
      const barColor = b.isToday ? 'var(--accent-primary)' : 'rgba(245,160,152,0.3)';
      parts.push(
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0">' +
          '<span style="font-size:0.65rem;color:var(--text-3)">' + b.min + '分</span>' +
          '<div style="width:100%;max-width:32px;height:' + h + 'px;background:' + barColor + ';border-radius:6px 6px 0 0;transition:height 0.4s var(--ease-out)"></div>' +
          '<span style="font-size:0.6rem;color:var(--text-4)">' + b.month + '/' + b.day + '</span>' +
        '</div>'
      );
    }
    return parts.join('');
  }

  const trendHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">📈 练习趋势</h3></div>
      <div style="margin-bottom:16px">
        <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:8px">最近 7 天（分钟）</div>
        <div style="display:flex;align-items:flex-end;gap:4px;min-height:120px">
          ${buildTrendBars(7)}
        </div>
      </div>
      <div>
        <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:8px">最近 30 天（分钟）</div>
        <div style="display:flex;align-items:flex-end;gap:2px;min-height:80px">
          ${buildTrendBars(30)}
        </div>
      </div>
    </div>
  `;

  // ── Card 4: 曲目练习排名 ──
  const pieceStats = {};
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const entries = log.entries;
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j];
      const key = e.pieceName;
      let stat = pieceStats[key];
      if (!stat) {
        stat = { name: key, days: 0, count: 0, totalMin: 0, lastDate: '' };
        pieceStats[key] = stat;
      }
      stat.count++;
      stat.totalMin += e.durationMin || 0;
      if (e.durationMin > 0 || e.rating > 0) stat.days++;
      if (log.date > (stat.lastDate || '')) stat.lastDate = log.date;
    }
  }
  const pieceList = Object.values(pieceStats).sort((a, b) => b.count - a.count);

  function daysSince(dateStr) {
    if (!dateStr) return '—';
    const diff = Math.floor((now - new Date(dateStr + 'T00:00:00')) / 86400000);
    return diff === 0 ? '今天' : diff + '天前';
  }

  const rankingHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🎵 曲目练习排名</h3></div>
      ${pieceList.length === 0 ? '<div style="text-align:center;color:var(--text-3);padding:20px">暂无练习记录</div>' : ''}
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
          <thead>
            <tr style="color:var(--text-3);font-size:0.68rem;text-align:left;border-bottom:1px solid var(--border-2)">
              <th style="padding:8px 4px;width:24px">#</th>
              <th style="padding:8px 4px">曲名</th>
              <th style="padding:8px 4px;text-align:center">次数</th>
              <th style="padding:8px 4px;text-align:center">天数</th>
              <th style="padding:8px 4px;text-align:center">分钟</th>
              <th style="padding:8px 4px;text-align:right">最近</th>
            </tr>
          </thead>
          <tbody>
            ${pieceList.map((p, i) => `
              <tr style="border-bottom:1px solid var(--border-2)">
                <td style="padding:8px 4px;color:var(--text-4)">${i + 1}</td>
                <td style="padding:8px 4px;font-weight:600">${Utils.escape(p.name)}</td>
                <td style="padding:8px 4px;text-align:center;color:var(--text-2)">${p.count}</td>
                <td style="padding:8px 4px;text-align:center;color:var(--text-2)">${p.days}</td>
                <td style="padding:8px 4px;text-align:center;color:var(--text-2)">${Math.round(p.totalMin * 10) / 10}</td>
                <td style="padding:8px 4px;text-align:right;color:var(--text-3);font-size:0.7rem">${daysSince(p.lastDate)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // ── Card 5: 注意事项追踪 ──
  const focusKeywords = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏', '背谱', '踏板', '手腕', '手臂', '触键', '表情', '呼吸'];
  const concernMap = {};
  const lessonFound = new Set();  // 复用一个 Set，避免每次循环创建

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const lessonDate = lesson.date;
    lessonFound.clear();

    // 从 focusAreas 收集
    const pieces = lesson.pieces;
    for (let j = 0; j < pieces.length; j++) {
      const focusAreas = pieces[j].focusAreas;
      if (!focusAreas || !focusAreas.length) continue;
      for (let k = 0; k < focusAreas.length; k++) {
        const key = focusAreas[k].trim();
        let c = concernMap[key];
        if (!c) {
          concernMap[key] = c = { minDate: lessonDate, maxDate: lessonDate, count: 0 };
        } else {
          if (lessonDate < c.minDate) c.minDate = lessonDate;
          if (lessonDate > c.maxDate) c.maxDate = lessonDate;
        }
        if (!lessonFound.has(key)) {
          lessonFound.add(key);
          c.count++;
          if (lessonDate < c.minDate) c.minDate = lessonDate;
          if (lessonDate > c.maxDate) c.maxDate = lessonDate;
        }
      }
    }

    // 从 details 和 notes 文本中匹配关键词（用数组 join，避免中间数组创建）
    let textBuf = lesson.notes || '';
    for (let j = 0; j < pieces.length; j++) {
      textBuf += ' ' + (pieces[j].details || '');
    }
    for (let k = 0; k < focusKeywords.length; k++) {
      const kw = focusKeywords[k];
      if (!lessonFound.has(kw) && textBuf.includes(kw)) {
        let c = concernMap[kw];
        if (!c) {
          concernMap[kw] = c = { minDate: lessonDate, maxDate: lessonDate, count: 0 };
        }
        if (lessonDate < c.minDate) c.minDate = lessonDate;
        if (lessonDate > c.maxDate) c.maxDate = lessonDate;
        c.count++;
      }
    }
  }

  const concerns = Object.entries(concernMap)
    .map(([tag, data]) => {
      const spanDays = Math.floor((new Date(data.maxDate + 'T00:00:00') - new Date(data.minDate + 'T00:00:00')) / 86400000);
      return { tag, count: data.count, firstDate: data.minDate, lastDate: data.maxDate, spanDays };
    })
    .sort((a, b) => (b.spanDays * b.count) - (a.spanDays * a.count));

  const concernsHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">⚠️ 注意事项追踪</h3></div>
      ${concerns.length === 0 ? '<div style="text-align:center;color:var(--text-3);padding:20px">暂无课程记录</div>' : ''}
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
          <thead>
            <tr style="color:var(--text-3);font-size:0.68rem;text-align:left;border-bottom:1px solid var(--border-2)">
              <th style="padding:8px 4px">问题</th>
              <th style="padding:8px 4px;text-align:center">出现次数</th>
              <th style="padding:8px 4px;text-align:center">持续天数</th>
              <th style="padding:8px 4px;text-align:right">日期范围</th>
            </tr>
          </thead>
          <tbody>
            ${concerns.map(c => {
              const severityColor = c.spanDays > 60 ? 'var(--accent-red)' : c.spanDays > 30 ? 'var(--accent-yellow)' : 'var(--accent-green)';
              return `
              <tr style="border-bottom:1px solid var(--border-2)">
                <td style="padding:8px 4px;font-weight:700;color:${severityColor}">${Utils.escape(c.tag)}</td>
                <td style="padding:8px 4px;text-align:center;color:var(--text-2)">${c.count} 次</td>
                <td style="padding:8px 4px;text-align:center;color:var(--text-2)">${c.spanDays} 天</td>
                <td style="padding:8px 4px;text-align:right;color:var(--text-3);font-size:0.7rem">${Utils.formatDate(c.firstDate)} → ${Utils.formatDate(c.lastDate)}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;font-size:0.65rem;color:var(--text-4)">
        按「次数 × 持续时间」综合排序。红色 = 持续超过 60 天，需重点注意。
      </div>
    </div>
  `;

  // ── Card 6: 星星统计 ──
  const todayStars = logsByDate.has(today) ?
    (logsByDate.get(today).entries || []).reduce((sum, e) => sum + (e.rating || 0), 0) : 0;
  const avgStarsPerDay = totalDays > 0 ? (totalStars / totalDays).toFixed(1) : 0;

  const starsHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">⭐ 星星统计</h3></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,165,0,0.1));border-radius:12px;padding:14px;border:1px solid rgba(255,215,0,0.2)">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">今日星星</div>
          <div style="font-size:1.8rem;font-weight:700;color:#FFD700">${todayStars}<span style="font-size:0.9rem;font-weight:400;color:var(--text-3)"> ⭐</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">累计星星</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--text-1)">${totalStars}<span style="font-size:0.8rem;font-weight:400;color:var(--text-3)"> ⭐</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">日均星星</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--text-1)">${avgStarsPerDay}</div>
        </div>
        <div style="background:linear-gradient(135deg,rgba(255,100,100,0.15),rgba(255,50,50,0.1));border-radius:12px;padding:14px;border:1px solid rgba(255,100,100,0.2)">
          <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:4px">最高记录</div>
          <div style="font-size:1.4rem;font-weight:700;color:#FF6B6B">${maxStarsDay}<span style="font-size:0.75rem;font-weight:400;color:var(--text-3)"> ⭐</span></div>
          <div style="font-size:0.65rem;color:var(--text-4);margin-top:2px">${maxStarsDayDate || '—'}</div>
        </div>
      </div>
    </div>
  `;

  // ── Card 7: 连续练琴 ──
  const streakHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🔥 连续练琴</h3></div>
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:3rem;margin-bottom:8px">${currentStreak > 0 ? '🔥' : '💤'}</div>
        <div style="font-size:2.5rem;font-weight:700;color:${currentStreak > 0 ? 'var(--accent-primary)' : 'var(--text-3)'}">${currentStreak}<span style="font-size:1rem;font-weight:400;color:var(--text-3)"> 天</span></div>
        <div style="font-size:0.75rem;color:var(--text-3);margin-top:8px">
          ${currentStreak === 0 ? '今天开始新的连续记录吧！' :
            currentStreak < 3 ? '继续加油！' :
            currentStreak < 7 ? '🏃 习惯正在养成中...' :
            currentStreak < 30 ? '💪 棒极了！保持下去！' :
            currentStreak < 100 ? '🌟 你是最棒的！' : '👑 传奇钢琴家！'}
        </div>
      </div>
    </div>
  `;

  // ── Card 8: 里程碑（悦跑圈风格） ──
  function renderMilestoneBadge(achieved, icon, label, desc, type) {
    const borderColor = achieved ? 'var(--accent-primary)' : 'var(--border-2)';
    const bgColor = achieved ? 'rgba(245,160,152,0.1)' : 'rgba(255,255,255,0.02)';
    const opacity = achieved ? '1' : '0.4';
    const badgeStyle = achieved ? 'box-shadow:0 0 12px rgba(245,160,152,0.3)' : '';
    return `
      <div style="display:inline-flex;flex-direction:column;align-items:center;padding:12px 8px;border-radius:12px;background:${bgColor};border:1px solid ${borderColor};min-width:70px;opacity:${opacity};${badgeStyle}">
        <span style="font-size:1.5rem">${icon}</span>
        <span style="font-size:0.7rem;font-weight:600;color:var(--text-1);margin-top:4px">${label}</span>
        <span style="font-size:0.6rem;color:var(--text-3);margin-top:2px">${desc}</span>
        ${achieved ? '<span style="font-size:0.55rem;color:var(--accent-primary);margin-top:4px">✓ 已达成</span>' : ''}
      </div>
    `;
  }

  // 计算已解锁的里程碑
  const achievedStarMilestones = STAR_MILESTONES.filter(m => maxStarsDay >= m.stars);
  const achievedStreakMilestones = STREAK_MILESTONES.filter(m => currentStreak >= m.days);
  const achievedDurationMilestones = DURATION_MILESTONES.filter(m => maxDurationDay >= m.minutes);

  const milestonesHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">🏅 成就里程碑</h3>
        <span style="font-size:0.65rem;color:var(--text-3)">悦跑圈风格</span>
      </div>

      ${maxStarsDay > 0 || currentStreak > 0 || maxDurationDay > 0 ? '' : '<div style="text-align:center;color:var(--text-3);padding:20px">开始练习后解锁成就</div>'}

      ${maxStarsDay > 0 || currentStreak > 0 || maxDurationDay > 0 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:10px">🌟 星星成就</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${STAR_MILESTONES.map(m => renderMilestoneBadge(maxStarsDay >= m.stars, m.icon, m.label, m.desc, 'star')).join('')}
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:10px">🔥 连续成就</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${STREAK_MILESTONES.map(m => renderMilestoneBadge(currentStreak >= m.days, m.icon, m.label, m.desc, 'streak')).join('')}
        </div>
      </div>

      <div>
        <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:10px">⏱️ 时长成就</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${DURATION_MILESTONES.map(m => renderMilestoneBadge(maxDurationDay >= m.minutes, m.icon, m.label, m.desc, 'duration')).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;

  page.innerHTML = overviewHTML + starsHTML + streakHTML + progressHTML + trendHTML + milestonesHTML + rankingHTML + concernsHTML;
}

console.log('✅ Stats module loaded');
