# AI Shot Workbench - 启动指南

## 📋 前置要求

1. **Python 3.8+** 已安装
2. **Node.js 16+** 已安装
3. **FFmpeg** 已安装 (用于视频处理)

验证 FFmpeg:
```bash
ffmpeg -version
```

如果没安装,运行:
```bash
brew install ffmpeg
```

---

## 🚀 首次启动

### 1. 安装后端依赖

```bash
cd /Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/backend

# 创建虚拟环境 (如果还没创建)
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 安装前端依赖

```bash
cd /Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/frontend

# 安装 npm 包
npm install
```

---

## ▶️ 启动项目

### 方法 1: 使用两个终端窗口

**终端 1 - 启动后端 (FastAPI)**
```bash
cd /Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

看到以下输出表示成功:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

**终端 2 - 启动前端 (Next.js)**
```bash
cd /Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/frontend
npm run dev
```

看到以下输出表示成功:
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

### 方法 2: 使用后台运行

```bash
# 启动后端 (后台)
cd /Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/backend
source .venv/bin/activate
nohup uvicorn main:app --reload --port 8000 > backend.log 2>&1 &

# 启动前端 (后台)
cd /Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/frontend
nohup npm run dev > frontend.log 2>&1 &
```

### 方法 3: 一键启动脚本 start_dev.sh

脚本位置: `/Users/renzengfei/资料/youtube文章/AI_Shot_Workbench/start_dev.sh`

用法:
```bash
cd /Users/renzengfei/资料/youtube文章/AI_Shot_Workbench
./start_dev.sh
```

脚本会自动:
1) 检查后端虚拟环境和 uvicorn 是否存在（缺失会提示安装命令）。  
2) 检查前端 `node_modules`，缺失会提示先 `npm install`。  
3) 并行启动后端 `uvicorn main:app --reload --port 8000` 和前端 `npm run dev`。  
4) 显示进程 PID，并在你按 Ctrl+C 时一次性关闭前后端。

依赖准备:
- 后端：已创建 `.venv` 且安装 `requirements.txt`  
  ```bash
  cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
  ```
- 前端：已执行 `npm install`

停止服务:
- 在运行脚本的终端按 Ctrl+C 即会触发脚本内的 `cleanup`，同时结束前后端进程。

---

## 🌐 访问应用

打开浏览器访问:
- **前端界面**: http://localhost:3000
- **后端 API 文档**: http://localhost:8000/docs

---

## 🛑 停止项目

### 如果使用前台运行 (方法 1)
在每个终端按 `Ctrl + C`

### 如果使用后台运行 (方法 2)
```bash
# 查找进程
lsof -i :8000 -i :3000

# 停止进程
kill <PID>
```

或者一键停止:
```bash
# 停止后端
pkill -f "uvicorn main:app"

# 停止前端
pkill -f "next-server"
```

---

## ✅ 验证运行状态

### 检查后端
```bash
curl http://localhost:8000/
```

预期输出:
```json
{"status": "AI Shot Workbench API is running"}
```

### 检查前端
在浏览器打开 http://localhost:3000,应该看到:
- 标题: "AI Shot Workbench"
- "上传视频" 和 "导入项目" 按钮

---

## 🐛 常见问题

### 1. 端口被占用
```bash
# 查看占用端口的进程
lsof -i :8000
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

### 2. Python 依赖错误
```bash
# 重新安装
cd backend
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. FFmpeg 未找到
```bash
# 安装 FFmpeg
brew install ffmpeg

# 验证安装
ffmpeg -version
```

### 4. 前端编译错误
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run dev
```

### 5. YouTube 下载提示“Sign in to confirm you’re not a bot”
- 方案 A: 在启动后端前设置浏览器 cookies 提取 (推荐)
  ```bash
  cd backend
  export YTDLP_COOKIES_FROM_BROWSER=chrome   # 或 safari / edge / firefox
  source .venv/bin/activate
  uvicorn main:app --reload --port 8000
  ```
- 方案 B: 提供 cookies.txt (Netscape 格式)
  1) 使用浏览器扩展（如 Get cookies.txt）导出 Netscape 格式 cookies  
  2) 将文件保存为 `backend/cookies.txt` (系统会自动使用)

缺少有效 cookies 会导致部分视频下载失败。

---

## 📂 项目结构

```
AI_Shot_Workbench/
├── backend/
│   ├── .venv/           # Python 虚拟环境
│   ├── main.py          # FastAPI 入口
│   ├── services/        # 业务逻辑
│   ├── uploads/         # 上传的视频
│   └── outputs/         # 导出的项目
└── frontend/
    ├── app/             # Next.js 页面
    ├── components/      # React 组件
    └── lib/             # 工具和状态管理
```

---

## 🎯 下一步

启动成功后,你可以:
1. 上传测试视频
2. 查看 AI 自动检测的切点
3. 使用键盘 `A` 添加切点,`D` 删除切点
4. 隐藏不需要的镜头
5. 导出项目报告

详细使用说明请查看 `walkthrough.md`!
