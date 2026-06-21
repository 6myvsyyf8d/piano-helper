# 钢琴陪练助手  — 项目说明

## 技术栈

- 纯前端单页应用，无框架，无构建工具
- HTML + CSS + 原生 JavaScript (ES6)
- localStorage 存储全部数据
- Service Worker 离线缓存 + 更新检测
- PWA 可安装到桌面 (manifest.json + icons)

## 目录结构

```
piano3-refactor/
├── index.html          # 入口：HTML 结构 + <script> 引用
├── css/
│   └── style.css       # 全局样式：变量、组件、布局、响应式
├── js/
│   ├── data.js         # 数据层：DB 封装、Utils 工具集、SUZUKI_DATA 曲库
│   ├── managers.js     # 管理层：RepertoireManager、StreakManager、LogoManager、SyncCode
│   ├── today.js        # 今日练琴页：练习表单、单曲计时器、复习列表、自由练习、提交
│   ├── lessons.js      # 课程记录页：课程列表、新增/编辑/删除课程
│   ├── calendar.js     # 日历页：月视图、周视图、日期详情
│   ├── repertoire.js   # 曲库页：曲目浏览、数据导入/导出/合并、同步面板
│   ├── stats.js        # 统计页：总览、趋势图、曲目排名、关注清单
│   └── app.js          # 应用入口：页面切换、模态框、滚动效果、SW 注册、初始化
├── sw.js               # Service Worker（独立文件）
├── manifest.json       # PWA 配置文件
├── icon-192.png        # App 图标 192×192
├── icon-512.png        # App 图标 512×512
├── demo.html           # 演示/预览页面（可选）
├── import.html         # 数据导入页面（可选）
└── migrate.html        # 旧数据迁移页面（可选）
```

## JS 加载顺序（= 依赖关系）

```
data.js ──→ managers.js ──→ today.js
                          ├── lessons.js
                          ├── calendar.js
                          ├── repertoire.js
                          ├── stats.js
                          └── app.js
```

- `data.js` 是底层，无依赖
- `managers.js` 只依赖 `data.js`
- `today.js` ~ `stats.js` 依赖 `data.js` + `managers.js`，互相独立
- `app.js` 负责初始化和组装所有模块

## 数据流

```
localStorage ←── DB 对象 (data.js)
                    ↓
         各页面 render*() 函数读取数据并渲染 DOM
                    ↓
         用户操作 → bind*() / handle*() → DB 写入 → renderAll() 重渲染
```

## 核心数据结构

- **lessons**: 上课记录数组，每条含日期、曲目列表（含星星评分、练习时间、老师笔记）
- **logs**: 每日练琴日志数组
- **repertoire**: 曲库数组，每条含曲目名、铃木编号、难度等
- **config**: 用户配置（头像、连续打卡等）

## 给接手工程师的建议

1. **先读 `data.js`**，理解 DB + Utils + SUZUKI_DATA，这是地基
2. **再读 `app.js`**，理解初始化流程和页面切换机制
3. 每个页面模块是独立的 `render*()` 函数，按需阅读
4. 全局函数用 `window.xxx` 暴露（HTML onclick 回调需要），后续可改为事件委托
5. `repertoire.js` (981 行) 和 `today.js` (1175 行) 是最长的两个模块
