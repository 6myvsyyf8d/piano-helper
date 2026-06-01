# 🎹 哆哩的钢琴助手 v3.0

专业的儿童钢琴练习管理与学习工具 - Apple Design Edition

## ✨ 特性

- 🎯 **今日练琴** - 记录每日练习，支持计时器、评分系统
- 📒 **课程记录** - 管理钢琴课内容，智能曲目分类
- 📅 **练琴日历** - 可视化练习记录，连续打卡统计
- 🎵 **曲库管理** - 铃木教材 Book 1-2，学习进度追踪
- ☁️ **云端同步** - GitHub Gist 数据同步，多设备访问
- 💾 **数据导出** - 支持 JSON 格式导入导出
- 📱 **PWA 支持** - 离线可用，可安装到桌面

## 🚀 快速开始

### 本地运行

1. 解压所有文件到同一目录
2. 使用本地服务器运行（推荐 VS Code Live Server）
3. 访问 `http://localhost:5500/piano3/`

### GitHub Pages 部署

1. 创建 GitHub 仓库
2. 上传所有文件
3. 启用 GitHub Pages (Settings → Pages)
4. 访问 `https://your-username.github.io/piano-helper/piano3/`

## 📋 文件说明

- `piano3/index.html` - 主应用（包含完整功能）
- `piano3/manifest.json` - PWA 配置文件
- `piano3/sw.js` - Service Worker（离线支持）
- `piano3/icon-192.png` / `piano3/icon-512.png` - 应用图标

## 🔧 配置 GitHub 同步

1. 访问 https://github.com/settings/tokens
2. 创建新的 Personal Access Token
3. 勾选 `gist` 权限
4. 在应用中点击「同步」按钮，输入 Token

## 📱 安装为 App

### iOS / iPadOS
1. 使用 Safari 打开应用
2. 点击「分享」→「添加到主屏幕」

### Android
1. 使用 Chrome 打开应用
2. 点击「菜单」→「安装应用」

### Desktop (Chrome/Edge)
1. 地址栏右侧会出现「安装」图标
2. 点击安装即可

## 🎨 技术栈

- **前端框架**: 纯 JavaScript (无框架依赖)
- **设计系统**: Apple Human Interface Guidelines
- **存储方案**: LocalStorage + GitHub Gist
- **PWA**: Service Worker + Web App Manifest
- **样式**: 纯 CSS (CSS Variables + Flexbox + Grid)
