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
- 默认自动执行 git 提交，提交消息由助手按上述规范定义。
- PR：简述变更范围、复现/修复步骤，UI 变更附截图/GIF；关联相关任务/Issue。

## 安全与配置
- 后端需安装 `ffmpeg`、`yt-dlp`、`scenedetect`。
- 不要提交 cookies/token。YouTube cookies 可通过环境变量或 `backend/cookies.txt` 注入。

## 网页自动化开发规范

开发 Selenium/Playwright 等网页自动化程序时，**必须遵循以下规则**：

1. **禁止猜测选择器**：不要自行编写 CSS 选择器或 XPath，必须让用户提供目标元素的 HTML 代码片段。
2. **用户提供网页代码**：需要定位某个元素时，要求用户在浏览器中复制该元素的 HTML（右键 → 检查 → 复制 element），然后根据实际 HTML 编写选择器。
3. **保守点击策略**：关闭弹窗等操作只使用精确选择器（如 `data-testid`、`aria-label`），禁止使用模糊选择器（如 `[class*="close"]`）或随机位置点击。
4. **网页结构易变**：第三方网站的 DOM 结构随时可能变化，不要假设之前的选择器仍然有效。

## UI 设计规范

本项目采用 **Liquid Glass** 设计风格（基于 Apple iOS 26 HIG）。

开发 UI 组件时，参考 `frontend/app/liquid-glass-demo-v2/page.tsx` 获取完整设计规范与代码示例。

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
