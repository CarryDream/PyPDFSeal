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
- Tauri CLI
- Windows 环境需要 WebView2 Runtime

安装依赖：

```bash
npm install
```

如果没有安装 Tauri CLI，可以使用：

```bash
cargo install tauri-cli
```

## 开发启动

推荐在项目根目录执行：

```bash
npm run tauri -- dev
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

在项目根目录执行：

```bash
npm run tauri -- build
```

或在 `src-tauri` 目录执行：

```bash
cargo tauri build
```

生成的安装包/可执行文件位于：

```text
src-tauri/target/release/bundle/
```

只做调试构建、不生成安装包：

```bash
cd src-tauri
cargo tauri build --debug --no-bundle --ci
```

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
npm run tauri -- dev
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

### 打包时提示 bundle identifier 以 `.app` 结尾

当前配置使用 `com.pydfseal.app`。这在 Windows 下不影响使用，但如果未来要发布 macOS 版本，建议把 identifier 改成不以 `.app` 结尾的值。

### 前端构建提示 chunk 超过 500 KB

主要来自 pdf.js worker 体积较大。它是构建警告，不影响当前功能。
