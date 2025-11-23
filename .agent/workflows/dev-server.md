---
description: 启动开发服务器(前端+后端)
---

# 启动开发服务器

这个工作流用于同时启动前端和后端开发服务器。

## 步骤

1. 确认当前在项目根目录

// turbo
2. 启动后端服务器
```bash
cd backend && .venv/bin/uvicorn main:app --reload --port 8000
```

// turbo
3. 启动前端服务器(新终端)
```bash
cd frontend && npm run dev
```

4. 访问应用
   - 前端: http://localhost:3000
   - 后端 API: http://localhost:8000/docs
