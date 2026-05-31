---
name: piano-helper-dev-doc
description: 钢琴陪练助手 — 开发文档，含架构、数据结构、UI 布局、待改进项
metadata: 
  node_type: memory
  type: reference
  originSessionId: bdf46f74-a706-40b2-88ce-e1f3c019aef6
---

# 钢琴陪练助手 — 开发文档

## 项目概述

为 6 岁学琴孩子和家长设计的单文件 Web 应用，帮助记录钢琴课重点和管理日常练琴。

- **文件**: 
  - `/Users/jinjun/piano-helper.html` — 主应用
  - `/Users/jinjun/piano-sync-server.js` — 局域网同步服务器
- **技术栈**: 纯 HTML/CSS/JS（前端），Node.js 内置模块（同步服务器）
- **数据存储**: 浏览器 localStorage（键前缀 `piano_`），云端通过局域网服务器同步
- **同步方式**: 手机和电脑连同一 WiFi，电脑运行 `node piano-sync-server.js`，手机浏览器打开 `http://192.168.x.x:3456`，保存时自动同步

---

## 数据结构

### 上课记录 (`piano_lessons` → Array)

```js
{
  id: string,           // 唯一 ID (uid())
  date: "YYYY-MM-DD",   // 上课日期
  teacher: string,      // 老师姓名（可选）
  pieces: [
    { name: string, details: string }  // 曲目名称 + 练习细节
  ],
  focusAreas: string[], // 重点练习标签（手型、节奏、音准…）
  notes: string,        // 老师其他叮嘱
  nextLessonDate: "YYYY-MM-DD" // 下节课日期（可选）
}
```

### 每日练琴记录 (`piano_logs` → Array)

```js
{
  id: string,
  date: "YYYY-MM-DD",
  entries: [
    {
      pieceName: string,
      detail: string,       // 来自上课记录
      durationMin: number,  // 练习分钟数
      notes: string,        // 小笔记
      rating: 0-5,          // 星级评分
      done: boolean         // 是否完成打卡
    }
  ],
  totalDurationMin: number,   // 总时长（计时器或各曲目累加）
  mood: "",                   // 心情 emoji（😍😊😐😤😢）
  parentNotes: string,        // 家长笔记
  stickers: string[]          // 选中的贴纸 emoji 数组
}
```

---

## 代码架构

### 模块划分（均为全局作用域）

| 区域 | 行号范围 | 职责 |
|------|----------|------|
| CSS | 7-241 | 全部样式，CSS 变量定义配色 |
| HTML 骨架 | 243-273 | 固定结构（header、tab-bar、3 个 page div、modal 容器） |
| 数据层 DB | 277-287 | localStorage 读写封装 |
| 工具函数 | 290-298 | `esc()`, `today()`, `fmtDate()`, `uid()`, `getLog()`, `latestLesson()`, `calcStreak()` |
| 渲染入口 | 316-321 | `renderAll()` → 渲染全部 3 个 tab |
| Tab1: 今日练琴 | 324-624 | `renderToday()`, `renderTodayDone()`, `renderTodayForm()`, `bindTodayForm()` |
| 练习状态 | 465-477 | `pieceStates`, `todayMood`, `todayStickers`, timer 变量（模块级） |
| Tab2: 上课记录 | 626-757 | `renderLessons()`, `showLessonForm()`, `saveLesson()`, `deleteLesson()` |
| Tab3: 练琴日历 | 760-945 | `renderCalendar()`, `buildCalendarHTML()`, `navCalendar()`, `showDayDetail()` |
| 同步模块 | ~960-1080 | `syncToServer()`, `syncFromServer()`, `showSyncPanel()`, `autoSyncAfterSave()` |
| Tab 切换 | 947-959 | 事件委托监听 `.tab-bar`，切换 `.active` 并重新渲染 |
| 初始化 | ~1090 | `renderAll()` + 自动配置同步 URL |

### 关键设计决策

1. **`pieceStates` 等练习状态是模块级变量而非闭包** — 因为 `addFreePiece()` 需要在 `bindTodayForm()` 外部访问和修改 pieceStates。改为模块级后，`addFreePiece` 只追加 DOM + 初始化状态条目，不重新绑定事件。

2. **`pieceList` 使用事件委托** — 监听 `click` 和 `input` 事件在 `#pieceList` 上，通过 `data-action` / `data-idx` 属性定位目标条目。这样动态添加的曲目自动生效。

3. **Modal 使用 innerHTML 替换** — 每次打开 modal 直接替换 `#modalContainer` 的 innerHTML，关闭时清空。简单且无状态残留。

4. **日历跨月日期计算** — `buildCalendarHTML` 对 prev/next month padding 分别计算正确的年月（处理 1 月和 12 月的边界情况）。

5. **连续天数计算** — `calcStreak()` 从今天开始倒推计数，今天没练就是 0（制造紧迫感）。

---

## UI 布局

```
┌──────────────────────────┐
│  🎹 钢琴陪练助手          │  ← Header（渐变橙）
│  让练琴变成快乐的习惯      │
│                    🔥 0天 │  ← 连续天数 badge
├──────────────────────────┤
│ 🏠今日  📒上课  📅日历   │  ← Tab Bar
├──────────────────────────┤
│                          │
│  (各 tab 内容)           │  ← Main（可滚动）
│                          │
└──────────────────────────┘
```

### 配色方案（CSS 变量）
- `--c1` ~ `--c5`: 暖橙色系（#FFF8E7 → #FF9800）
- `--accent`: #FF6F00（深橙强调）
- `--green`: #66BB6A（完成/打卡）
- `--red`: #EF5350（删除/取消）
- `--radius`: 16px（全局圆角）
- `--shadow`: 柔和卡片阴影

### 手机适配
- `max-width: 480px`，居中布局
- `min-height: 100dvh`（移动端动态视口高度）
- `user-scalable=no`（防止双击缩放）
- 大按钮 + 宽松间距，适合手指点击

---

## 功能清单

- [x] 上课记录 CRUD（日期、老师、曲目列表、重点标签、备注、下节课日期）
- [x] 今日练琴：根据最近上课记录自动填充曲目
- [x] 自由练习模式（无上课记录时）
- [x] 逐曲目打卡 + ⭐1-5 评分
- [x] 练琴计时器（开始/暂停/重置）
- [x] 心情选择（😍😊😐😤😢）
- [x] 贴纸奖励（12 种可选，多选）
- [x] 家长笔记
- [x] 练习完成后的总结页 + 修改按钮
- [x] 月历视图（绿色/灰色圆点标记练习情况）
- [x] 月度统计（天数、小时、连续天数）
- [x] 点击日历天查看详情
- [x] 连续练琴天数（streak）
- [x] 数据持久化（localStorage）
- [x] 局域网同步（Node.js 服务器 + 自动/手动同步 + 冲突合并）

### 同步服务器 (`piano-sync-server.js`)

零依赖，仅需 Node.js。端点：
- `GET /` — 提供 HTML 应用
- `GET /ping` — 连通性检查
- `GET /data` — 获取服务器存储的全部数据
- `POST /merge` — 将本地数据合并到服务器（本地优先）
- 数据文件：`~/.piano-sync/data.json`

同步逻辑：
- 打开 HTML 时自动检测服务器地址（若从服务器打开）
- 保存练习或上课记录后自动同步（可关闭）
- 同步面板：手动上传/下载 + 服务器地址配置

---

## 待改进项（未来开发）

1. **贴纸收集总览** — 展示历史获得的所有贴纸及数量
2. **音阶/基本功条目模板** — 快速添加哈农、音阶等常规练习
3. **数据导出/导入** — JSON 备份 & 恢复
4. **练习提醒** — 配合 Notification API 做每日定时提醒
5. **成就系统** — 连续 7 天、累计 100 小时等里程碑
6. **多孩子支持** — 切换不同练习者的数据
7. **Service Worker** — 升级为 PWA，可添加到手机主屏幕
8. **节拍器嵌入** — 内嵌简单节拍器
9. **练琴录音** — 配合 Web Audio API 录制片段

---

## 验证方式

1. `open /Users/jinjun/piano-helper.html` 在浏览器中打开
2. 测试添加上课记录 → 切到"今日练琴"确认曲目自动填充
3. 测试打卡、评分、计时器、贴纸选择
4. 保存练习 → 检查日历视图的绿点
5. 关闭浏览器重新打开 → 确认数据仍在（localStorage）
6. 手机浏览器访问同一文件确认响应式布局
