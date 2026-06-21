# 🎹 哆哩的钢琴助手

一款配合钢琴老师使用的在家练习辅助工具。帮助琴童系统化记录每日练习、追踪曲库进度、回顾课程要点。

## 功能特点

- **今日练琴**：按曲目记录练习时间、评分、备注，支持复习抽卡
- **课程记录**：按册分组管理每节课的曲目，记录重点、老师笔记、回课评分
- **曲库管理**：铃木教材 + 小曲集，自定义教材，状态追踪（未学/学习中/已学会/背谱）
- **日历视图**：月/周视图查看练琴历史，里程碑打卡
- **数据统计**：总练习时长、趋势图、曲目排名、关注清单
- **数据同步**：一键导入/导出 JSON，家庭多设备共享

## 使用方式

浏览器打开 `index.html` 即可使用。所有数据保存在浏览器 localStorage 中，离线可用。

## 版权声明

Copyright (c) 2024-present 哆哩的钢琴助手  
Licensed under the **MIT License** — 详见 [LICENSE](LICENSE) 文件。

你可以自由地使用、修改、分发本项目，但必须保留以上版权声明和许可信息。

---

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
│   ├── data.js         # 数据层：DB 封装、Utils 工具集、曲库数据
│   ├── managers.js     # 管理层：RepertoireManager、StreakManager、LogoManager、SyncCode、DataCleaner
│   ├── today/          # 今日练琴模块
│   │   ├── render.js       # 渲染逻辑
│   │   ├── submit.js       # 交互函数 + 提交逻辑
│   │   ├── state.js        # 状态管理
│   │   ├── timer.js        # 整体练习计时器
│   │   └── review-free.js  # 复习列表 + 自由练习
│   ├── lessons.js      # 课程记录页面
│   ├── calendar.js     # 日历页面
│   ├── repertoire/     # 曲库模块（浏览、编辑、同步）
│   │   ├── browser.js      # 浏览页
│   │   ├── editor.js       # 编辑器 CRUD
│   │   └── sync.js         # 数据导入导出
│   ├── stats.js        # 统计页面
│   └── app.js          # 应用入口：页面切换、初始化、SW 注册
├── sw.js               # Service Worker
├── manifest.json       # PWA 配置
├── icon-192.png        # App 图标
├── icon-512.png        # App 图标
├── demo.html           # 演示/预览页面（可选）
├── import.html         # 数据导入页面（可选）
└── migrate.html        # 旧数据迁移页面（可选）
```

## JS 加载顺序（= 依赖关系）

```
data.js ──→ managers.js ──→ today/*
                          ├── lessons.js
                          ├── calendar.js
                          ├── repertoire/*
                          ├── stats.js
                          └── app.js
```

- `data.js` 是底层，无依赖
- `managers.js` 只依赖 `data.js`
- 各页面模块依赖 `data.js` + `managers.js`，互相独立
- `app.js` 负责初始化和组装所有模块

## 数据流

```
localStorage ←── DB 对象 (data.js)
                    ↓
         各页面 render*() 函数读取数据并渲染 DOM
                    ↓
         用户操作 → handle*() → DB 写入 → renderAll() 重渲染
```

## 核心数据结构

- **lessons**：上课记录数组，每条含日期、曲目列表（含星星评分、练习时间、老师笔记、重点标签）
- **logs**：每日练琴日志数组
- **repertoire**：曲库数组，每条含曲目名、册号、状态、背谱、练习次数等
- **config**：用户配置

---

## License

MIT License
