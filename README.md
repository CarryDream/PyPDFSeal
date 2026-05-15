# PyPDFSeal 🖋️

> PDF 批量电子盖章工具 - 支持印章、水印、数字签名

<div align="center">

  <p>
    <a href="https://github.com/CarryDream/PyPDFSeal">
      <img src="https://img.shields.io/badge/Version-0.1.3-blue?style=flat-square" alt="Version">
    </a>
    <img src="https://img.shields.io/badge/Tauri-v2-orange?style=flat-square" alt="Tauri">
    <img src="https://img.shields.io/badge/Backend-Rust-red?style=flat-square" alt="Rust">
    <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square" alt="React">
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
- 支持自定义印章大小、透明度、旋转角度

### 💧 高级水印功能
- 文本水印与图片水印
- 支持系统字体加载
- 多种布局方式（平铺、居中）
- 可调节水印透明度、旋转角度、颜色、字号

### ✍️ 数字签名
- 支持 PKCS#12 (.p12 / .pfx) 证书
- 生成符合标准的 PKCS#7 数字签名
- 自动在 PDF 中注入签名域（ByteRange）
- 支持签名原因、位置、联系方式等信息

### ⚙️ 实用功能
- 实时预览效果
- 自定义输出文件名规则
- 自动检查更新
- 系统托盘支持
- 跨平台支持（Windows / macOS / Linux）

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
curl -fsSL https://raw.githubusercontent.com/CarryDream/PyPDFSeal/main/install.sh | VERSION=0.1.3 bash
```

### 方式二：手动下载

前往 [GitHub Releases](https://github.com/CarryDream/PyPDFSeal/releases) 下载对应平台的安装包：

- **Windows**: `PyPDFSeal_版本号_x64-setup.exe`
- **macOS**: `.dmg` 文件
- **Linux**: `.deb` 或 `.AppImage`

### 方式三：从源码构建

请参考下方「构建指南」。

## 🚀 使用说明

1. 启动应用后，添加需要处理的 PDF 文件
2. 在「印章」面板选择印章图片并设置位置参数
3. 在「水印」面板配置水印内容（可选）
4. 在「证书」面板导入数字证书并配置签名信息（可选）
5. 点击「开始处理」即可批量生成已盖章/签名的 PDF

详细操作可参考应用内界面提示。

## 🛠️ 构建指南

### 环境要求

- Node.js >= 20
- Rust (最新稳定版)
- pnpm / npm / yarn

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
