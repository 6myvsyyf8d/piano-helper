/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
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
      const dateStr = Utils.dateStr(checkDate);
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

  // 使用更精确的百分比计算，确保总和为100%
  var rawLearned = totalRep ? learned / totalRep * 100 : 0;
  var rawLearning = totalRep ? learning / totalRep * 100 : 0;
  var rawUntouched = totalRep ? untouched / totalRep * 100 : 0;
  var learnedPct = Math.round(rawLearned);
  var learningPct = Math.round(rawLearning);
  var untouchedPct = Math.round(rawUntouched);
  // 修正四舍五入误差，确保总和为100
  var diff = 100 - (learnedPct + learningPct + untouchedPct);
  if (diff !== 0 && totalRep > 0) {
    // 将误差加到最大的一段上
    if (learned >= learning && learned >= untouched) learnedPct += diff;
    else if (learning >= untouched) learningPct += diff;
    else untouchedPct += diff;
  }

  var barLabels = [
    { label: '已学会', count: learned, pct: learnedPct, color: 'var(--accent-green)' },
    { label: '学习中', count: learning, pct: learningPct, color: 'var(--accent-yellow)' },
    { label: '未学', count: untouched, pct: untouchedPct, color: 'var(--border-2)' }
  ];
  // 过滤掉数量为0的项，进度条和标签保持一致
  var activeLabels = barLabels.filter(function(b) { return b.count > 0; });

  const progressHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">📖 曲目进度</h3></div>
      <div style="display:flex;height:24px;border-radius:12px;overflow:hidden;margin-bottom:12px;gap:2px">
        ${activeLabels.map(b =>
          '<div style="height:100%;width:' + b.pct + '%;background:' + b.color + ';border-radius:12px;transition:width 0.5s var(--ease-out)"></div>'
        ).join('')}
      </div>
      <div style="display:flex;gap:20px;font-size:0.78rem;color:var(--text-2);flex-wrap:wrap">
        ${activeLabels.map(b => '<span>● ' + b.label + ' <strong style="color:var(--text-1)">' + b.count + '</strong> 首</span>').join('')}
      </div>
      <div style="margin-top:8px;font-size:0.7rem;color:var(--text-4)">共 ${totalRep} 首曲目</div>
    </div>
  `;

  // ── Card 3: 曲目练习排名（曲库范围） ──
  // 先从日志中统计每首曲目的练习数据
  var pieceStats = {};
  for (var i = 0; i < logs.length; i++) {
    var log = logs[i];
    var entries = log.entries;
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (!e.repId) continue;
      var stat = pieceStats[e.repId];
      if (!stat) {
        stat = { repId: e.repId, days: 0, count: 0, totalMin: 0, lastDate: '' };
        pieceStats[e.repId] = stat;
      }
      stat.count++;
      stat.totalMin += e.durationMin || 0;
      if (e.durationMin > 0 || e.rating > 0) stat.days++;
      if (log.date > (stat.lastDate || '')) stat.lastDate = log.date;
    }
  }

  // 遍历曲库，为每个曲目生成统计条目（未练过的显示为0）
  var pieceList = rep.map(function(piece) {
    var stat = pieceStats[piece.id];
    return {
      name: piece.name,
      bookInfo: piece.book ? RepertoireManager.getBookDisplayName(piece.book) : '',
      status: piece.status,
      count: stat ? stat.count : 0,
      days: stat ? stat.days : 0,
      totalMin: stat ? stat.totalMin : 0,
      lastDate: stat ? stat.lastDate : ''
    };
  }).sort(function(a, b) {
    // 优先按练习次数降序，次数相同按曲名排序
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  function daysSince(dateStr) {
    if (!dateStr) return '—';
    var diff = Math.floor((now - new Date(dateStr + 'T00:00:00')) / 86400000);
    return diff === 0 ? '今天' : diff + '天前';
  }

  var statusLabel = function(status) {
    if (status === 'learned') return '<span style="font-size:0.6rem;color:var(--accent-green);background:rgba(142,212,166,0.15);padding:1px 5px;border-radius:4px">已学会</span>';
    if (status === 'learning') return '<span style="font-size:0.6rem;color:var(--accent-yellow);background:rgba(245,216,154,0.15);padding:1px 5px;border-radius:4px">学习中</span>';
    return '<span style="font-size:0.6rem;color:var(--text-4);background:rgba(255,255,255,0.05);padding:1px 5px;border-radius:4px">未学</span>';
  };

  var rankingHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🎵 曲目练习排名</h3></div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
          <thead>
            <tr style="color:var(--text-3);font-size:0.68rem;text-align:left;border-bottom:1px solid var(--border-2)">
              <th style="padding:8px 4px;width:24px">#</th>
              <th style="padding:8px 4px">曲名</th>
              <th style="padding:8px 4px">册名</th>
              <th style="padding:8px 4px;text-align:center">状态</th>
              <th style="padding:8px 4px;text-align:center">次数</th>
              <th style="padding:8px 4px;text-align:center">天数</th>
              <th style="padding:8px 4px;text-align:center">分钟</th>
              <th style="padding:8px 4px;text-align:right">最近</th>
            </tr>
          </thead>
          <tbody>
            ${pieceList.map((p, i) => `
              <tr style="border-bottom:1px solid var(--border-2);opacity:${p.count > 0 ? '1' : '0.5'}">
                <td style="padding:8px 4px;color:var(--text-4)">${i + 1}</td>
                <td style="padding:8px 4px;font-weight:600">${Utils.escape(p.name)}</td>
                <td style="padding:8px 4px;color:var(--text-3);font-size:0.72rem">${Utils.escape(p.bookInfo) || '—'}</td>
                <td style="padding:8px 4px;text-align:center">${statusLabel(p.status)}</td>
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

  // ── Card 4: 注意事项雷达图 ──
  var focusKeywords = ['手型', '节奏', '音准', '指法', '力度', '速度', '乐感', '视奏', '背谱', '踏板', '手腕', '手臂', '触键', '表情', '呼吸'];
  var concernMap = {};
  var lessonFound = new Set();

  for (var i = 0; i < lessons.length; i++) {
    var lesson = lessons[i];
    var lessonDate = lesson.date;
    lessonFound.clear();

    var pieces = lesson.pieces;
    for (var j = 0; j < pieces.length; j++) {
      var focusAreas = pieces[j].focusAreas;
      if (!focusAreas || !focusAreas.length) continue;
      for (var k = 0; k < focusAreas.length; k++) {
        var key = DataCleaner.standardizeFocusArea(focusAreas[k].trim());
        var c = concernMap[key];
        if (!c) {
          concernMap[key] = c = { minDate: lessonDate, maxDate: lessonDate, count: 0 };
        }
        if (!lessonFound.has(key)) {
          lessonFound.add(key);
          c.count++;
          if (lessonDate < c.minDate) c.minDate = lessonDate;
          if (lessonDate > c.maxDate) c.maxDate = lessonDate;
        }
      }
    }

    var textBuf = lesson.notes || '';
    for (var j = 0; j < pieces.length; j++) {
      textBuf += ' ' + (pieces[j].details || '');
    }
    for (var k = 0; k < focusKeywords.length; k++) {
      var kw = focusKeywords[k];
      if (!lessonFound.has(kw) && textBuf.includes(kw)) {
        var c = concernMap[kw];
        if (!c) {
          concernMap[kw] = c = { minDate: lessonDate, maxDate: lessonDate, count: 0 };
        }
        if (lessonDate < c.minDate) c.minDate = lessonDate;
        if (lessonDate > c.maxDate) c.maxDate = lessonDate;
        c.count++;
      }
    }
  }

  // 分大类计算得分
  var categories = [
    { key: 'tech', label: '技术基础', keywords: ['手型', '指法', '手腕', '手臂', '触键'], color: '#8ED4A6' },
    { key: 'music', label: '音乐表现', keywords: ['节奏', '音准', '乐感', '表情', '呼吸'], color: '#9BB9DC' },
    { key: 'skill', label: '演奏技巧', keywords: ['力度', '速度', '视奏'], color: '#F5D89A' },
    { key: 'mem', label: '记忆熟练', keywords: ['背谱', '踏板'], color: '#BAB8E0' }
  ];

  var catScores = categories.map(function(cat) {
    var score = 0;
    var keywordsFound = [];
    cat.keywords.forEach(function(kw) {
      var data = concernMap[kw];
      if (data) {
        var spanDays = Math.floor((new Date(data.maxDate + 'T00:00:00') - new Date(data.minDate + 'T00:00:00')) / 86400000);
        score += data.count * (spanDays + 1);
        keywordsFound.push(kw + ' (' + data.count + '次)');
      }
    });
    return { label: cat.label, color: cat.color, score: score, details: keywordsFound };
  });

  var maxScore = Math.max.apply(null, catScores.map(function(c) { return c.score; })) || 1;
  catScores.forEach(function(c) { c.normalized = Math.round(c.score / maxScore * 100); });

  // 生成雷达图 SVG
  function renderRadarChart(cats) {
    var size = 200;
    var center = size / 2;
    var radius = 70;
    var count = cats.length;
    var angleStep = (Math.PI * 2) / count;

    // 网格圆
    var gridCircles = [0.25, 0.5, 0.75, 1].map(function(ratio) {
      var r = radius * ratio;
      return '<circle cx="' + center + '" cy="' + center + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>';
    }).join('');

    // 轴线
    var axisLines = cats.map(function(_, i) {
      var angle = i * angleStep - Math.PI / 2;
      var x = center + radius * Math.cos(angle);
      var y = center + radius * Math.sin(angle);
      return '<line x1="' + center + '" y1="' + center + '" x2="' + x + '" y2="' + y + '" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>';
    }).join('');

    // 数据多边形
    var dataPoints = cats.map(function(cat, i) {
      var angle = i * angleStep - Math.PI / 2;
      var r = radius * (cat.normalized / 100);
      return (center + r * Math.cos(angle)) + ',' + (center + r * Math.sin(angle));
    }).join(' ');

    // 标签
    var labels = cats.map(function(cat, i) {
      var angle = i * angleStep - Math.PI / 2;
      var labelR = radius + 22;
      var x = center + labelR * Math.cos(angle);
      var y = center + labelR * Math.sin(angle);
      var anchor = Math.abs(Math.cos(angle)) < 0.3 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end');
      return '<text x="' + x + '" y="' + y + '" text-anchor="' + anchor + '" fill="var(--text-2)" font-size="11" font-weight="600">' + cat.label + '</text>' +
             '<text x="' + x + '" y="' + (y + 13) + '" text-anchor="' + anchor + '" fill="' + cat.color + '" font-size="10">' + cat.normalized + '</text>';
    }).join('');

    // 数据点
    var dots = cats.map(function(cat, i) {
      var angle = i * angleStep - Math.PI / 2;
      var r = radius * (cat.normalized / 100);
      var x = center + r * Math.cos(angle);
      var y = center + r * Math.sin(angle);
      return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + cat.color + '" stroke="var(--bg-primary)" stroke-width="2"/>';
    }).join('');

    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block;margin:0 auto">' +
      gridCircles + axisLines +
      '<polygon points="' + dataPoints + '" fill="rgba(245,160,152,0.12)" stroke="var(--accent-primary)" stroke-width="2" stroke-linejoin="round"/>' +
      dots + labels +
      '</svg>';
  }

  // 详细列表（按大类分组）
  var detailHtml = catScores.map(function(cat) {
    if (cat.details.length === 0) return '';
    return '<div style="margin-bottom:12px">' +
      '<div style="font-size:0.78rem;font-weight:600;color:' + cat.color + ';margin-bottom:4px">' + cat.label + '</div>' +
      '<div style="font-size:0.7rem;color:var(--text-3);line-height:1.6">' + cat.details.join('、') + '</div>' +
      '</div>';
  }).join('');

  var concernsHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">⚠️ 注意事项分析</h3></div>
      ${catScores.every(function(c) { return c.score === 0; }) ?
        '<div style="text-align:center;color:var(--text-3);padding:20px">暂无课程记录</div>' :
        '<div style="padding:8px 0">' +
          renderRadarChart(catScores) +
          '<div style="margin-top:16px">' + detailHtml + '</div>' +
        '</div>'
      }
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

  // ── Card 9: 数据清洗工具 ──
  const cleanToolHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🧹 数据清洗</h3></div>
      <div style="font-size:0.78rem;color:var(--text-2);margin-bottom:12px">
        统一曲目名称（中英文）、基本功写法，修复历史数据不一致问题。
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="previewDataClean()" style="flex:1">👁 预览</button>
        <button class="btn btn-primary btn-sm" onclick="runDataClean()" style="flex:1">🧹 执行清洗</button>
      </div>
      <div id="cleanResult" style="margin-top:12px;font-size:0.75rem;color:var(--text-3)"></div>
    </div>
  `;

  page.innerHTML = overviewHTML + starsHTML + streakHTML + progressHTML + milestonesHTML + rankingHTML + concernsHTML + cleanToolHTML;
}

// ── 数据清洗预览 ──
window.previewDataClean = function() {
  const resultEl = document.getElementById('cleanResult');
  resultEl.innerHTML = '⏳ 正在分析...';
  
  setTimeout(function() {
    const stats = DataCleaner.preview();
    if (stats.piecesAffected === 0 && stats.entriesAffected === 0) {
      resultEl.innerHTML = '✅ 数据已经是最新格式，无需清洗';
    } else {
      let html = '<div style="background:rgba(255,200,100,0.1);padding:10px;border-radius:8px;border:1px solid rgba(255,200,100,0.3)">';
      html += '<div style="font-weight:600;margin-bottom:8px">📋 发现以下数据需要标准化：</div>';
      if (stats.piecesAffected > 0) {
        html += '<div>• 课程曲目：<strong>' + stats.piecesAffected + '</strong> 条</div>';
      }
      if (stats.entriesAffected > 0) {
        html += '<div>• 练习日志：<strong>' + stats.entriesAffected + '</strong> 条</div>';
      }
      html += '</div>';
      resultEl.innerHTML = html;
    }
  }, 100);
};

// ── 执行数据清洗 ──
window.runDataClean = function() {
  if (!confirm('确定要清洗数据吗？\n\n此操作将统一曲目名称和基本功写法，修改后不可撤销。')) return;
  
  const resultEl = document.getElementById('cleanResult');
  resultEl.innerHTML = '⏳ 正在清洗...';
  
  setTimeout(function() {
    const report = DataCleaner.cleanAll();
    let html = '<div style="background:rgba(100,200,100,0.1);padding:10px;border-radius:8px;border:1px solid rgba(100,200,100,0.3)">';
    html += '<div style="font-weight:600;margin-bottom:8px">✅ 清洗完成</div>';
    html += '<div>• 课程曲目修正：<strong>' + report.pieces + '</strong> 条</div>';
    html += '<div>• 练习日志修正：<strong>' + report.entries + '</strong> 条</div>';
    html += '</div>';
    resultEl.innerHTML = html;
    
    // 刷新页面显示
    setTimeout(function() {
      renderStats();
    }, 1500);
  }, 100);
};

console.log('✅ Stats module loaded');
