/*
 * 钢琴练习助手 — Piano Practice Helper
 * Copyright (c) 2024-present
 * Licensed under the MIT License
 */
/* ==========================================
   📊 统计页面
   ========================================== */

"use strict";

// 曲目进度筛选状态
let _statsPieceFilter = 'all';

// 阶段样式配置
const STAGE_STYLE = {
  'separate':   { color: '#8ED4A6', label: '分手', icon: '🖐️' },
  'together':   { color: '#9BB9DC', label: '合手', icon: '🤝' },
  'memorize':   { color: '#BAB8E0', label: '背谱', icon: '🧠' },
  'proficient': { color: '#FFD700', label: '熟练', icon: '🌟' }
};

// 计算各阶段花费天数
function _computeStageDurations(piece) {
  const history = piece.stageHistory || [];
  if (history.length === 0) return [];
  const today = Utils.today();
  const durations = [];
  for (let i = 0; i < history.length; i++) {
    const startDate = history[i].date;
    const endDate = (i < history.length - 1) ? history[i + 1].date : today;
    const days = Math.floor((new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')) / 86400000);
    durations.push({
      stage: history[i].stage,
      days: Math.max(0, days),
      isCurrent: (i === history.length - 1) && piece.stage !== 'proficient'
    });
  }
  return durations;
}

// 渲染曲目进度比较图
function _renderPieceProgress(rep, logs) {
  const pieceDays = {};
  for (const log of logs) {
    if (!log.entries) continue;
    for (const e of log.entries) {
      if (!e.repId) continue;
      if (!pieceDays[e.repId]) pieceDays[e.repId] = new Set();
      pieceDays[e.repId].add(log.date);
    }
  }

  const allPieces = rep.map(piece => {
    const stageDurations = _computeStageDurations(piece);
    const totalStageDays = stageDurations.reduce((sum, d) => sum + d.days, 0);
    return {
      id: piece.id,
      name: piece.name,
      book: piece.book,
      bookName: RepertoireManager.getBookDisplayName(piece.book),
      stage: piece.stage || 'untouched',
      stageDurations,
      hasHistory: stageDurations.length > 0,
      practiceDays: pieceDays[piece.id] ? pieceDays[piece.id].size : 0,
      totalMinutes: piece.totalMinutes || 0,
      lastPracticeDate: piece.lastPracticeDate || '',
      totalStageDays
    };
  });

  const bookGroups = {};
  for (const p of allPieces) {
    if (!bookGroups[p.book]) bookGroups[p.book] = [];
    bookGroups[p.book].push(p);
  }
  const bookNums = Object.keys(bookGroups).map(Number).sort((a, b) => a - b);

  const filter = _statsPieceFilter;
  const filteredBooks = filter === 'all' ? bookNums : [Number(filter)];

  const stageStats = {};
  for (const p of allPieces) {
    if (!p.hasHistory) continue;
    for (const d of p.stageDurations) {
      if (!stageStats[d.stage]) stageStats[d.stage] = { totalDays: 0, count: 0 };
      stageStats[d.stage].totalDays += d.days;
      stageStats[d.stage].count++;
    }
  }

  let longestStage = null;
  let longestAvg = 0;
  for (const stage in stageStats) {
    const avg = stageStats[stage].totalDays / stageStats[stage].count;
    if (avg > longestAvg) { longestAvg = avg; longestStage = stage; }
  }

  const longPieces = [];
  for (const p of allPieces) {
    if (!p.hasHistory) continue;
    for (const d of p.stageDurations) {
      if (d.isCurrent && stageStats[d.stage]) {
        const avg = stageStats[d.stage].totalDays / stageStats[d.stage].count;
        if (d.days > avg * 1.5 && d.days > 3) longPieces.push({ name: p.name, stage: d.stage });
      }
    }
  }

  let totalLearned = 0;
  for (const p of allPieces) { if (p.stage === 'proficient') totalLearned++; }

  // 筛选标签
  let filterTags = '<span class="stats-filter-tag' + (filter === 'all' ? ' active' : '') + '" onclick="switchPieceFilter(\'all\')">📋 全部</span>';
  for (const b of bookNums) {
    filterTags += '<span class="stats-filter-tag' + (filter == b ? ' active' : '') + '" onclick="switchPieceFilter(' + b + ')">📖 ' + Utils.escape(RepertoireManager.getBookDisplayName(b)) + '</span>';
  }

  // 图例
  const legendHTML = '<div style="display:flex;gap:14px;margin-bottom:16px;flex-wrap:wrap">' +
    Object.keys(STAGE_STYLE).map(key => {
      const s = STAGE_STYLE[key];
      return '<span style="font-size:0.6rem;color:' + s.color + ';display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:' + s.color + ';display:inline-block"></span>' + s.label + '</span>';
    }).join('') + '</div>';

  // 横条
  let barsHTML = '';
  for (const b of filteredBooks) {
    const group = bookGroups[b];
    if (!group) continue;
    barsHTML += '<div style="font-size:0.65rem;color:var(--text-3);margin:14px 0 10px;font-weight:600;padding-left:2px">📖 ' + Utils.escape(RepertoireManager.getBookDisplayName(b)) + ' · ' + group.length + '首</div>';
    for (const p of group) {
      barsHTML += _renderPieceBar(p, longPieces);
    }
  }

  // 趋势洞察
  let insightHTML = '';
  if (longestStage || longPieces.length > 0 || rep.length > 0) {
    insightHTML = '<div style="margin-top:16px;padding:12px 14px;background:linear-gradient(135deg,rgba(94,106,210,0.08),rgba(94,106,210,0.03));border-radius:12px;border:1px solid rgba(94,106,210,0.15)">' +
      '<div style="font-size:0.68rem;color:var(--accent-primary);font-weight:700;margin-bottom:6px">💡 趋势洞察</div>' +
      '<div style="font-size:0.62rem;color:var(--text-3);line-height:1.7">';
    if (longestStage) {
      const si = STAGE_STYLE[longestStage];
      insightHTML += '<div>• ' + (si ? si.icon + ' ' + si.label : longestStage) + '阶段平均花费 <span style="color:var(--text-2);font-weight:600">' + (Math.round(longestAvg * 10) / 10) + '天</span>，是各阶段中耗时最长的</div>';
    }
    if (longPieces.length > 0) {
      const si = STAGE_STYLE[longPieces[0].stage];
      insightHTML += '<div>• <span style="color:var(--accent-red)">' + Utils.escape(longPieces.map(p => p.name).join('、')) + '</span> 在' + (si ? si.label : '') + '阶段偏长，可能需要老师指导</div>';
    }
    if (rep.length > 0) {
      const rate = Math.round(totalLearned / rep.length * 100);
      insightHTML += '<div>• 总完成率 <span style="color:var(--accent-green);font-weight:600">' + rate + '%</span>（' + totalLearned + '/' + rep.length + '首熟练）</div>';
    }
    insightHTML += '</div></div>';
  }

  return '<div class="card">' +
    '<div class="card-header"><h3 class="card-title">🎵 曲目进度</h3></div>' +
    '<div style="display:flex;gap:7px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px">' + filterTags + '</div>' +
    legendHTML + barsHTML + insightHTML +
    '</div>';
}

// 渲染单首曲子横条
function _renderPieceBar(p, longPieces) {
  const stageInfo = PIECE_STAGES.find(s => s.key === p.stage) || PIECE_STAGES[0];
  const totalDays = p.totalStageDays || p.practiceDays || 0;
  const isLong = longPieces.some(lp => lp.name === p.name);
  const stageColor = STAGE_STYLE[p.stage] ? STAGE_STYLE[p.stage].color : 'var(--text-3)';

  let barHTML;
  if (!p.hasHistory) {
    barHTML = '<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;gap:1px">' +
      '<div style="width:12%;background:rgba(255,255,255,0.08);border-radius:6px 0 0 6px"></div>' +
      '<div style="flex:1;background:rgba(255,255,255,0.04);border-radius:0 6px 6px 0;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(255,255,255,0.08)"><span style="font-size:0.5rem;color:var(--text-4);opacity:0.5">无阶段记录</span></div>' +
      '</div>';
  } else {
    const maxDays = Math.max(p.totalStageDays, 1);
    const segments = p.stageDurations.map(d => {
      const style = STAGE_STYLE[d.stage];
      if (!style) return '';
      const width = Math.max(4, (d.days / maxDays) * 88);
      const isCurrent = d.isCurrent;
      const isComplete = d.stage === 'proficient';
      let content = '';
      if (isCurrent) content = '<span style="font-size:0.5rem;color:#fff">↑</span>';
      else if (isComplete) content = '<span style="font-size:0.45rem;color:#050506;font-weight:700">✓</span>';
      const extra = isCurrent ? 'box-shadow:inset 0 0 0 1px ' + style.color + ';border-radius:0 6px 6px 0' : '';
      return '<div style="width:' + width + '%;background:' + style.color + ';' + extra + ';display:flex;align-items:center;justify-content:center;opacity:0.85">' + content + '</div>';
    }).join('');
    barHTML = '<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;gap:1px">' +
      '<div style="width:12%;background:rgba(255,255,255,0.08);border-radius:6px 0 0 6px"></div>' + segments + '</div>';
  }

  let daysLabel = '';
  if (p.hasHistory) {
    daysLabel = p.stageDurations.map(d => {
      const style = STAGE_STYLE[d.stage];
      if (!style) return '';
      const label = style.icon + ' ' + style.label;
      if (d.isCurrent) return label + d.days + '天↑' + (isLong ? ' <span style="color:var(--accent-red)">⏰</span>' : '');
      return label + d.days + '天';
    }).filter(s => s).join('  ');
  }

  return '<div style="margin-bottom:10px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">' +
      '<span style="font-size:0.75rem;color:var(--text-1);font-weight:500">' + Utils.escape(p.name) + '</span>' +
      '<span style="font-size:0.58rem;color:' + stageColor + ';font-weight:600">' + stageInfo.icon + ' ' + stageInfo.label + ' · ' + totalDays + '天</span>' +
    '</div>' + barHTML +
    (daysLabel ? '<div style="font-size:0.5rem;color:var(--text-3);margin-top:3px;padding:0 2px;text-align:right">' + daysLabel + '</div>' : '') +
  '</div>';
}

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

  // ── Card 2: 曲目进度比较图（替换原进度条+排名表格）──
  const pieceProgressHTML = _renderPieceProgress(rep, logs);

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

  page.innerHTML = overviewHTML + pieceProgressHTML + starsHTML + streakHTML + milestonesHTML + concernsHTML + cleanToolHTML;
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

// ── 曲目进度筛选切换 ──
window.switchPieceFilter = function(book) {
  _statsPieceFilter = book;
  renderStats();
};

console.log('✅ Stats module loaded');
