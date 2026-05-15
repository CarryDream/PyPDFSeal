# PyPDFSeal

本地 PDF 批量盖章工具，基于 Rust + Tauri + React。文件在本机处理，不上传服务端。

## 功能

- 批量选择 PDF 文件，或扫描目录中的 PDF。
- 支持印章图片盖章，图片格式包括 PNG/JPG/JPEG/BMP。
- 支持固定位置、页面坐标、关键字定位。
- 支持文本水印，包含字体、字号、颜色、透明度、旋转和布局设置。
- 支持 `.p12` / `.pfx` 证书进行 PDF 数字签名。
- 支持批处理开始、暂停、恢复、取消。
- 默认输出到原 PDF 所在目录的 `sealed` 子目录，也可选择输出目录。

## 技术栈

- 前端：React 19、TypeScript、Vite、Zustand、pdf.js
- 桌面：Tauri 2
- 后端：Rust 2024
- PDF：lopdf、image、OpenSSL

## 环境

- Node.js + npm
- Rust 工具链
- Windows 运行需要 WebView2 Runtime
- Linux 构建/运行需要 WebKitGTK 相关依赖

安装依赖：

```bash
npm install
```

项目已使用 `@tauri-apps/cli`，通常不需要全局安装 Tauri CLI。

## 开发

启动桌面应用：

```bash
npm run tauri:dev
```

仅启动前端：

```bash
npm run dev
```

前端构建：

```bash
npm run build
```

Rust 检查：

```bash
cd src-tauri
cargo test
cargo clippy --all-targets -- -D warnings
```

## 打包

项目只生成可执行文件，不生成安装包。

本机生成当前平台可执行文件：

```bash
npm run tauri:build:exe
```

产物路径：

```text
src-tauri/target/release/pydfseal.exe   # Windows
src-tauri/target/release/pydfseal       # Linux/macOS
```

Windows 本机构建只会生成 `pydfseal.exe` 和 `pydfseal.pdb`。Linux/macOS 产物需要在对应系统上构建。

调试构建：

```bash
npm run tauri:build:exe -- --debug --ci
```

## 多平台构建

使用 GitHub Actions 的 `Build Executables` workflow 生成多平台产物：

```text
PyPDFSeal-windows-x64.exe
PyPDFSeal-linux-x64
PyPDFSeal-macos-arm64
PyPDFSeal-macos-x64
```

手动执行：GitHub 仓库 -> Actions -> Build Executables -> Run workflow。

推送 tag 自动构建 draft release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 注意事项

- 已签名 PDF 会跳过处理，避免重写后破坏原签名。
- 盖章和水印会生成新 PDF，不覆盖原文件。
- `.pdb` 是 Windows 调试符号文件，不是 Linux/macOS 可执行文件。
- Vite 可能提示 pdf.js chunk 超过 500 KB，这是构建警告，不影响运行。
