---
description: 添加新功能的标准流程
---

# 添加新功能

这个工作流定义了在项目中添加新功能的标准步骤。

## 前端功能

1. **创建组件** (如果需要)
   - 在 `frontend/components/` 创建新组件
   - 使用 TypeScript + TailwindCSS

2. **更新主页面**
   - 编辑 `frontend/app/page.tsx`
   - 集成新组件

3. **测试界面**
   - 在浏览器中验证
   - 检查响应式布局

## 后端功能

1. **添加 API 端点**
   - 在 `backend/main.py` 添加路由
   - 或在 `backend/services/` 创建新服务

2. **测试 API**
   - 访问 http://localhost:8000/docs
   - 使用 Swagger UI 测试

3. **前后端联调**
   - 确保前端正确调用 API
   - 处理错误情况

## 文档更新

1. 更新 `README.md`
2. 如有必要,更新待实现功能清单
