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

  // ── Card 1: 练习总览 ──
  const now = new Date(today + 'T00:00:00');
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const logsThisMonth = logs.filter(l => {
    const d = new Date(l.date + 'T00:00:00');
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  });
  const logsLastMonth = logs.filter(l => {
    const d = new Date(l.date + 'T00:00:00');
    return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
  });

  const daysThisMonth = logsThisMonth.length;
  const daysLastMonth = logsLastMonth.length;
  const minThisMonth = logsThisMonth.reduce((s, l) => s + (l.totalDurationMin || 0), 0);
  const minLastMonth = logsLastMonth.reduce((s, l) => s + (l.totalDurationMin || 0), 0);
  const totalDays = logs.length;
  const totalMin = logs.reduce((s, l) => s + (l.totalDurationMin || 0), 0);
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
  function buildTrendBars(days) {
    const maxMin = Math.max(1, ...Array.from({length: days}, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const log = logs.find(l => l.date === ds);
      return log ? (log.totalDurationMin || 0) : 0;
    }));
    return Array.from({length: days}, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (days - 1 - i));
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const log = logs.find(l => l.date === ds);
      const min = log ? (log.totalDurationMin || 0) : 0;
      const h = maxMin > 0 ? Math.max(4, Math.round(min / maxMin * 100)) : 4;
      const dayLabel = (d.getMonth()+1) + '/' + d.getDate();
      const isToday = ds === today;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0">' +
        '<span style="font-size:0.65rem;color:var(--text-3)">' + min + '分</span>' +
        '<div style="width:100%;max-width:32px;height:' + h + 'px;background:' + (isToday ? 'var(--accent-primary)' : 'rgba(245,160,152,0.3)') + ';border-radius:6px 6px 0 0;transition:height 0.4s var(--ease-out)"></div>' +
        '<span style="font-size:0.6rem;color:var(--text-4)">' + dayLabel + '</span>' +
      '</div>';
    }).join('');
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
  logs.forEach(log => {
    log.entries.forEach(e => {
      const key = e.pieceName;
      if (!pieceStats[key]) {
        pieceStats[key] = { name: key, days: 0, count: 0, totalMin: 0, lastDate: '' };
      }
      pieceStats[key].count++;
      pieceStats[key].totalMin += e.durationMin || 0;
      if (e.durationMin > 0 || e.rating > 0) {
        pieceStats[key].days++;
      }
      if (log.date > (pieceStats[key].lastDate || '')) {
        pieceStats[key].lastDate = log.date;
      }
    });
  });
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
  lessons.forEach(lesson => {
    const lessonDate = lesson.date;
    const foundInLesson = new Set();

    // 从 focusAreas 收集
    lesson.pieces.forEach(piece => {
      (piece.focusAreas || []).forEach(tag => {
        const key = tag.trim();
        if (!concernMap[key]) concernMap[key] = { dates: new Set(), count: 0 };
        if (!concernMap[key].dates.has(lessonDate)) {
          concernMap[key].dates.add(lessonDate);
          concernMap[key].count++;
        }
        foundInLesson.add(key);
      });
    });

    // 从 details 和 notes 文本中匹配关键词
    const allText = [
      lesson.notes || '',
      ...lesson.pieces.map(p => p.details || '')
    ].join(' ');
    focusKeywords.forEach(kw => {
      if (allText.includes(kw) && !foundInLesson.has(kw)) {
        if (!concernMap[kw]) concernMap[kw] = { dates: new Set(), count: 0 };
        if (!concernMap[kw].dates.has(lessonDate)) {
          concernMap[kw].dates.add(lessonDate);
          concernMap[kw].count++;
        }
      }
    });
  });

  const concerns = Object.entries(concernMap)
    .map(([tag, data]) => {
      const dates = [...data.dates].sort();
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];
      const spanDays = Math.floor((new Date(lastDate + 'T00:00:00') - new Date(firstDate + 'T00:00:00')) / 86400000);
      return { tag, count: data.count, firstDate, lastDate, spanDays };
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

  page.innerHTML = overviewHTML + progressHTML + trendHTML + rankingHTML + concernsHTML;
}

console.log('✅ Stats module loaded');
