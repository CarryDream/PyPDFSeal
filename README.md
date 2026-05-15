# PyPDFSeal

PyPDFSeal 是一个基于 **Rust + Tauri + React** 的本地 PDF 批量盖章工具。它面向桌面客户端使用场景：用户在自己的电脑上选择 PDF、印章图片、输出目录和相关配置，程序在本地完成处理，不依赖服务端上传文件。

## 功能

- 批量选择 PDF 文件，或扫描目录中的 PDF 文件。
- 选择本地印章图片，支持 PNG/JPG/JPEG/BMP 等常见格式。
- 设置印章宽高、透明度和定位方式。
- 支持固定锚点、页面坐标、关键字定位。
- 支持文本水印，可设置字体、字号、颜色、透明度、旋转角度、居中或平铺。
- 支持 PKCS#12 证书文件（`.p12` / `.pfx`）进行 PDF 数字签名。
- 批处理支持开始、暂停、恢复、取消。
- 执行日志显示成功、失败、跳过、耗时和统计信息。
- 默认输出到原 PDF 所在目录下的 `sealed` 子目录，也可以选择自定义输出目录。

## 重要行为

- 如果输入 PDF 已经包含数字签名，程序会跳过该文件，避免重写 PDF 后破坏原有签名。
- 盖章和水印会生成新的 PDF 文件，不会覆盖原文件。
- 如果只启用水印或只启用证书签名，也可以执行批处理，不强制必须选择印章图片。

## 技术栈

- 前端：React 19、TypeScript、Vite、Zustand、pdf.js
- 桌面框架：Tauri 2
- 后端：Rust 2024 edition
- PDF 处理：lopdf、image、OpenSSL

## 环境要求

- Node.js 和 npm
- Rust 工具链
- 项目内已安装 Tauri CLI（`@tauri-apps/cli`）
- Windows 环境需要 WebView2 Runtime

安装依赖：

```bash
npm install
```

通常不需要全局安装 Tauri CLI。项目命令会使用 `node_modules` 中的 CLI。

如果要直接执行 `cargo tauri ...`，才需要额外安装 `tauri-cli`。

## 开发启动

推荐在项目根目录执行：

```bash
npm run tauri:dev
```

也可以在 `src-tauri` 目录执行：

```bash
cd src-tauri
cargo tauri dev
```

Tauri 会自动启动 Vite 开发服务，并打开桌面窗口。

## 前端命令

仅启动 Vite：

```bash
npm run dev
```

前端类型检查和构建：

```bash
npm run build
```

预览前端构建产物：

```bash
npm run preview
```

## Rust 后端测试

在 `src-tauri` 目录执行：

```bash
cargo test
```

严格 Clippy 检查：

```bash
cargo clippy --all-targets -- -D warnings
```

格式化 Rust 代码：

```bash
cargo fmt
```

## 打包

当前项目配置为 **只生成可执行文件**，不生成 NSIS/MSI、dmg、deb、AppImage 等安装包。

在项目根目录执行：

```bash
npm run tauri:build:exe
```

或在 `src-tauri` 目录执行：

```bash
cargo tauri build --no-bundle --ci
```

本机命令只会生成当前平台的可执行文件：

```text
src-tauri/target/release/pydfseal.exe   # Windows
src-tauri/target/release/pydfseal       # Linux/macOS
```

如果你是在 Windows 上执行构建，只会看到 `pydfseal.exe` 和 `pydfseal.pdb`，不会生成 Linux/macOS 的可执行文件。

调试构建：

```bash
npm run tauri:build:exe -- --debug --ci
```

如果指定 Rust target，产物在对应 target 目录下：

```text
src-tauri/target/<target>/release/pydfseal.exe
src-tauri/target/<target>/release/pydfseal
```

### 生成多平台可执行文件

不要指望在 Windows 本机一条命令直接生成 Windows、Linux、macOS 三个平台的可执行文件。Tauri 桌面应用依赖平台 WebView 和系统 SDK，特别是 macOS 产物必须在 macOS runner 上构建。

推荐使用 GitHub Actions：

1. 在 GitHub 仓库中打开 `Actions`。
2. 选择 `Build Executables` workflow。
3. 点击 `Run workflow` 手动构建，或推送 `v*` tag 自动构建。

workflow 会分别在 Windows、Linux、macOS runner 上生成这些 artifact：

```text
PyPDFSeal-windows-x64.exe
PyPDFSeal-linux-x64
PyPDFSeal-macos-arm64
PyPDFSeal-macos-x64
```

推送 tag 时，例如：

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会创建 draft release，并把上述可执行文件上传为 release assets。

### 平台运行要求

这些产物是“单可执行文件”，不是完全静态二进制：

- Windows 需要 WebView2 Runtime。
- Linux 运行环境需要 WebKitGTK 等桌面运行库。
- macOS 未签名可执行文件可能被 Gatekeeper 拦截，首次运行可能需要用户手动允许。

## 推荐验证流程

每次提交前建议执行：

```bash
npm run build
cd src-tauri
cargo test
cargo clippy --all-targets -- -D warnings
```

如果修改了 UI 或 PDF 预览逻辑，再运行：

```bash
npm run tauri:dev
```

手动验证以下场景：

- 添加单个 PDF 文件。
- 添加目录中的多个 PDF 文件。
- 选择印章图片后预览正常显示。
- 执行只盖章、只水印、盖章加水印。
- 遇到已签名 PDF 时显示跳过，而不是失败。
- 输出目录中生成 `_sealed.pdf` 文件。

## 常见问题

### 印章图片加载失败

程序按文件内容识别图片格式，不依赖扩展名。若仍失败，通常是图片文件损坏或格式不受 `image` 库支持。

### PDF 已签名文件被跳过

这是有意设计。普通盖章/水印会重写 PDF，可能导致原有数字签名失效。当前版本选择跳过已签名 PDF，而不是静默破坏签名。

### 为什么没有安装包

当前 `src-tauri/tauri.conf.json` 中 `bundle.active` 为 `false`，打包命令使用 `--no-bundle`。这是有意设计：只产出可执行文件，不产出安装器或系统安装包。

### 前端构建提示 chunk 超过 500 KB

主要来自 pdf.js worker 体积较大。它是构建警告，不影响当前功能。
