# PyPDFSeal 🖋️

> PDF 批量电子盖章工具 - 支持印章、水印、数字签名

<div align="center">

  <p>
    <a href="https://github.com/CarryDream/PyPDFSeal">
      <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square" alt="Version">
    </a>
    <img src="https://img.shields.io/badge/Tauri-v2-orange?style=flat-square" alt="Tauri">
    <img src="https://img.shields.io/badge/Backend-Rust-red?style=flat-square" alt="Rust">
    <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square" alt="React">
    <img src="https://img.shields.io/badge/UI-HeroUI-purple?style=flat-square" alt="HeroUI">
    <img src="https://img.shields.io/badge/License-CC--BY--NC--SA--4.0-lightgrey?style=flat-square" alt="License">
  </p>

  <p>
    <a href="#核心功能">核心功能</a> • 
    <a href="#安装指南">安装指南</a> • 
    <a href="#使用说明">使用说明</a> • 
    <a href="#构建指南">构建指南</a>
  </p>

</div>

---

**PyPDFSeal** 是一款专业的 PDF 批量处理工具，专注于电子盖章、数字水印和 PDF 数字签名。支持批量处理、多种定位方式、证书签名、自动更新等功能，适合企业和个人用户日常 PDF 文件的标准化处理需求。

## ✨ 核心功能

### 🖼️ 印章管理与批量盖章
- 支持 PNG 透明印章图片
- 多种定位方式：固定位置、关键字定位、坐标定位
- 批量处理多个 PDF 文件
- 支持自定义印章大小、透明度
- PDF 预览区拖拽定位印章

### 💧 高级水印功能
- 文本水印
- 支持系统字体加载
- 多种布局方式（平铺、居中）
- 可调节水印透明度、旋转角度、颜色、字号
- 蜂窝式颜色选择器，快速选取常用颜色

### ✍️ 数字签名
- 支持 PKCS#12 (.p12 / .pfx) 证书
- 生成符合标准的 PKCS#7 数字签名
- 自动在 PDF 中注入签名域（ByteRange）
- 支持签名原因、位置、联系方式等信息

### ⚙️ 实用功能
- 实时 PDF 预览与缩放（Ctrl+滚轮）
- 自定义输出文件名规则（前缀/后缀/不添加）
- 输出目录结构选择（平铺/按来源文件夹分组）
- 文件列表分页浏览
- 批量处理进度条与实时日志
- 处理完成摘要报告
- 导出处理记录为 Excel
- 自动检查更新
- 系统托盘支持

### 🎨 界面特性
- 基于 HeroUI v2 组件库，现代化界面设计
- 浅色 / 深色 / 跟随系统三种主题模式
- 可折叠侧栏面板
- 可调节底部日志面板高度
- Toast 通知反馈

### 🖥️ 跨平台支持
- Windows (x64)
- macOS (Intel / Apple Silicon)
- Linux (x64 / ARM64)

## 📦 安装指南

### 方式一：一键安装脚本（推荐）

**Linux / macOS**
```bash
curl -fsSL https://raw.githubusercontent.com/CarryDream/PyPDFSeal/main/install.sh | bash
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/CarryDream/PyPDFSeal/main/install.ps1 | iex
```

支持指定版本：
```bash
curl -fsSL https://raw.githubusercontent.com/CarryDream/PyPDFSeal/main/install.sh | VERSION=1.0.0 bash
```

### 方式二：手动下载

前往 [GitHub Releases](https://github.com/CarryDream/PyPDFSeal/releases) 下载对应平台的安装包：

- **Windows**: `PyPDFSeal_版本号_x64-setup.exe`
- **macOS**: `.dmg` 文件（支持 Intel 和 Apple Silicon）
- **Linux**: `.deb` 或 `.AppImage`

### 方式三：从源码构建

请参考下方「构建指南」。

## 🚀 使用说明

1. 启动应用后，点击「添加文件」或「添加目录」导入 PDF 文件
2. 在左侧「印章」面板选择印章图片、设置尺寸和透明度
3. 在 PDF 预览区拖拽印章到目标位置，或在「位置」面板精确设置
4. 在「水印」面板配置水印内容（可选）
5. 在「证书」面板导入数字证书并配置签名信息（可选）
6. 在右侧「设置」面板配置输出目录和文件名规则
7. 点击「开始处理」即可批量生成已盖章/签名的 PDF
8. 处理完成后查看日志面板的摘要报告

## 🛠️ 构建指南

### 环境要求

- Node.js >= 20
- Rust (最新稳定版)
- npm

### 系统依赖 (Linux)

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf \
  pkg-config libsoup-3.0-dev javascriptcoregtk-4.1 \
  libjavascriptcoregtk-4.1-dev libnm-dev xdg-utils
```

### 开发

```bash
# 安装依赖
npm install

# 启动开发环境
npm run tauri dev
```

### 生产构建

```bash
# 构建安装包
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录下。

---

## 📄 许可证

本项目采用 **CC-BY-NC-SA-4.0** 许可证。

- 允许：分享、修改
- 限制：**仅限非商业用途**、需署名、衍生作品必须采用相同许可证

完整许可证请查看 [LICENSE](./LICENSE) 文件。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**Copyright © 2026 CarryDream**

> PyPDFSeal - 让 PDF 处理更简单、更专业。
