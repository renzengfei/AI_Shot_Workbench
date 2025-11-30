# Repository Guidelines

## 项目结构
- `frontend/` — Next.js 14 (App Router)；UI 在 `components/`，工作流在 `components/workflow/`，状态在 `lib/stores/`，样式在 `app/timeline.css`。
- `backend/` — FastAPI；路由在 `main.py`，业务在 `services/`（场景检测、YouTube 下载、帧/资产生成、工作区管理）。
- `workspaces/` — 每个项目的数据（`segmentation.json`、`deconstruction.json`、assets/frames/videos）。
- `backend/uploads/` 原始/YouTube 视频；`backend/transcodes/` 编辑版视频（GOP=1）与帧缓存。
- 辅助：`STARTUP.md`、`start_dev.sh`。

## 启动与开发命令
- 前端：`cd frontend && npm install && npm run dev`（http://localhost:3000）。
- 后端：`cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`（http://127.0.0.1:8000）。
- 一键启动：`./start_dev.sh`（仓库根目录）。
- 前端 Lint：`cd frontend && npm run lint`。
- 后端语法检查：`cd backend && source .venv/bin/activate && python -m py_compile main.py services/*.py`。

## 代码风格与命名
- TypeScript/React：函数式组件 + hooks；状态用 Zustand；Tailwind 类 + `timeline.css`；组件保持小而清晰。
- Python：FastAPI/Pydantic 风格，小型 service 拆分，snake_case，避免超长路由函数。
- 命名：JS/TS 使用 camelCase，组件 PascalCase；Python 使用 snake_case。

## 测试规范
- 前端：当前以 Lint 为主（`npm run lint`）。如补充测试，放在 `frontend/__tests__`，命名 `*.test.tsx`。
- 后端：基础检查用 `python -m py_compile ...`，API 手测靠 uvicorn + 浏览器/`curl`。如补充测试，放在 `backend/tests/`，命名 `test_*.py`。

## 提交与 PR
- 提交信息：使用 Conventional Commits（如 `feat: add youtube asset generation`，`fix: pause at cut points precisely`）。
- 每次改动代码后必须提交 git，保持工作区干净，避免堆积未提交的修改。
- 进行任何 git 回退（如 reset/revert/cherry-pick 等导致历史或工作区回滚）前必须征得用户明确同意。
- PR：简述变更范围、复现/修复步骤，UI 变更附截图/GIF；关联相关任务/Issue。

## 安全与配置
- 后端需安装 `ffmpeg`、`yt-dlp`、`scenedetect`。
- 不要提交 cookies/token。YouTube cookies 可通过环境变量或 `backend/cookies.txt` 注入。

## UI 设计规范 (Apple Glass Design System)

本项目采用 "Apple Glass" 设计风格，旨在打造高端、通透、富有层次感的现代化界面。

### 1. 核心原则 (Core Principles)
- **Clarity (清晰)**：内容优先，文字清晰易读，图标语义明确。
- **Deference (顺从)**：界面服务于内容，使用半透明材质（Glassmorphism）让背景与内容融合。
- **Depth (层次)**：通过阴影、模糊和层级关系构建空间感。

### 2. 视觉基础 (Visual Foundation)
- **字体**：优先使用 SF Pro (macOS) 或 Inter (Google Fonts)。
- **圆角**：统一使用大圆角（`rounded-xl`, `rounded-2xl`），营造亲和力。
- **动效**：使用 `transition-all duration-300` 配合 `cubic-bezier` 打造丝滑交互。

### 3. 核心变量 (CSS Variables)
所有样式定义在 `app/apple-design.css` 中，核心变量如下：

| 类别 | 变量名 | 说明 |
| --- | --- | --- |
| **背景** | `--color-bg-primary` | 主背景（纯白/纯黑） |
| | `--color-bg-secondary` | 次级背景（浅灰/深灰） |
| **玻璃材质** | `--glass-bg-light` | 浅色玻璃（高透明度） |
| | `--glass-border` | 玻璃边框（极细微白/黑） |
| | `--glass-shadow` | 玻璃投影（弥散光） |
| **强调色** | `--color-blue-500` | Apple Blue (主操作) |
| | `--color-text-primary` | 主要文本 |
| | `--color-text-secondary` | 次要文本 |

### 4. 常用组件类 (Utility Classes)
直接使用以下类名构建 UI：

- **卡片**: `.glass-card` (标准玻璃卡片), `.glass-card-strong` (深色玻璃)
- **标题**: `.apple-title` (32px), `.apple-headline` (24px)
- **正文**: `.apple-body` (17px), `.apple-caption` (13px)
- **按钮**: `.apple-button-primary` (主按钮), `.apple-button-secondary` (次按钮)
- **输入**: `.apple-input` (带聚焦光晕的输入框)

### 5. 开发建议
1.  **布局**：多用 `flex` 和 `grid`，保持 `gap-4` 或 `gap-6` 的呼吸感。
2.  **图标**：使用 `lucide-react`，大小通常为 16px-20px，颜色配合文本层级。
3.  **深色模式**：系统已内置 Dark Mode 支持，使用 CSS 变量即可自动适配。

## Git 变更范围（提交清单）

**需要提交（源代码与配置）**
- 前端：`app/`、`components/`、`lib/`、`data/*.ts`、样式文件（如 `globals.css`、`timeline.css`），以及配置文件（`package.json`、`tsconfig.json`、`.eslintrc` 等）。
- 后端：`main.py`、`services/*.py`、`requirements.txt` 及其他源码/配置。
- 脚本/文档：`start_dev.sh`、`README`/`AGENTS`/`STARTUP` 等说明文件。

**不提交（生成物/缓存/数据）**
- 构建与缓存：`node_modules`、`.next`、`.turbo`、`__pycache__/`、`*.pyc`。
- 运行产物/视频帧：`backend/uploads/`、`backend/transcodes/`、`workspaces/*/assets/`（frames/videos/report）、`workspaces/*/export/`。
- 工作空间元数据：`workspaces/*/project.json`、`workspaces/*/segmentation.json`、`workspaces/*/deconstruction.json`（除非明确需要提交示例数据）。
- 其他：`.env*`、`.DS_Store`、`.agent/`。
