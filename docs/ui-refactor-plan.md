# UI 改造计划：Liquid Glass Design System

## 概述

本文档描述将 AI Shot Workbench 的 **人工改写界面**（`Step3_DeconstructionReview`）改造为 Liquid Glass 设计风格的详细计划。

## 设计参考

- **设计规范文档**: `frontend/app/liquid-glass-demo-v2/page.tsx`
- **可复用样式**: `frontend/styles/liquid-glass.css`
- **预览地址**: http://localhost:3000/liquid-glass-demo-v2

---

## 1. 核心设计原则

### 1.1 Liquid Glass 核心特征

| 特征 | 实现方式 |
|------|----------|
| **透明玻璃质感** | `backdrop-filter: blur(20px) saturate(180%)` |
| **半透明背景** | `background: rgba(255, 255, 255, 0.25)` |
| **边框高光** | `border: 1px solid rgba(255, 255, 255, 0.3)` |
| **内发光阴影** | `box-shadow: inset 1px 1px 0 0 rgba(255, 255, 255, 0.5)` |

### 1.2 系统色彩

| 颜色 | 色值 | 用途 |
|------|------|------|
| Blue | `#007AFF` | 主操作、链接 |
| Green | `#34C759` | 成功、确认 |
| Orange | `#FF9500` | 警告 |
| Red | `#FF3B30` | 错误、删除 |
| Purple | `#AF52DE` | 强调 |
| Teal | `#5AC8FA` | 信息 |

---

## 2. 改造范围

### 2.1 Phase 1: 人工改写界面 (Step3_DeconstructionReview) - 优先级最高

#### 2.1.1 顶部工具栏
- [ ] 应用 `.lg-card` 样式替换现有 `bg-slate-*` 背景
- [ ] 按钮统一使用 `.lg-btn-primary` / `.lg-btn-secondary`
- [ ] 模式切换器使用玻璃风格 Tab

#### 2.1.2 镜头卡片 (ShotCard)
- [ ] 卡片容器应用 `.lg-card` 样式
- [ ] 内部分区使用半透明分隔
- [ ] 操作按钮统一风格

#### 2.1.3 模态框
- [ ] 参考图库模态框
- [ ] 生图设定模态框
- [ ] Provider 配置模态框
- [ ] 视频配置模态框

#### 2.1.4 表单元素
- [ ] 输入框使用 `.lg-input` 样式
- [ ] 下拉选择框统一风格
- [ ] 开关组件使用 `.lg-switch`

### 2.2 Phase 2: 其他工作流步骤 (后续)
- Step1_Segmentation
- Step2_Deconstruction
- StepNavigation

---

## 3. 具体改造清单

### 3.1 CSS 变量迁移

```css
/* 旧样式 → 新样式 */
bg-slate-100 → var(--lg-glass-bg)
bg-white → var(--lg-glass-bg-strong)
text-slate-700 → var(--lg-text-primary)
text-slate-500 → var(--lg-text-secondary)
border-slate-200 → var(--lg-glass-border)
```

### 3.2 按钮样式迁移

```tsx
// 旧样式
className="px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600"

// 新样式
className="lg-btn lg-btn-primary"
```

### 3.3 卡片样式迁移

```tsx
// 旧样式
className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm"

// 新样式
className="lg-card p-4"
```

### 3.4 输入框样式迁移

```tsx
// 旧样式
className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"

// 新样式
className="lg-input"
```

---

## 4. 背景装饰

添加模糊渐变背景球，增强视觉层次：

```tsx
{/* 背景装饰球 */}
<div className="lg-blur-orb" style={{ 
  top: '-200px', 
  right: '-100px', 
  width: '600px', 
  height: '600px', 
  background: 'linear-gradient(135deg, #FF9500, #FF2D55)' 
}} />
<div className="lg-blur-orb" style={{ 
  bottom: '-200px', 
  left: '-100px', 
  width: '500px', 
  height: '500px', 
  background: 'linear-gradient(135deg, #5AC8FA, #007AFF)' 
}} />
```

---

## 5. 实施顺序

1. **导入 CSS** - 在组件中导入 `@/styles/liquid-glass.css`
2. **背景层** - 添加渐变模糊背景装饰
3. **顶部工具栏** - 改造为玻璃卡片风格
4. **模态框** - 统一应用 Liquid Glass 模态框样式
5. **按钮** - 批量替换为 lg-btn 类
6. **输入框** - 批量替换为 lg-input 类
7. **微调** - 调整间距、颜色、阴影细节

---

## 6. 验收标准

- [ ] 所有卡片具有玻璃透明质感
- [ ] 颜色使用系统色彩变量
- [ ] 按钮、输入框风格统一
- [ ] 模态框带有 backdrop-blur 效果
- [ ] 深色模式兼容（如适用）
- [ ] 无明显性能问题

---

## 更新日志

| 日期 | 内容 |
|------|------|
| 2025-12-05 | 创建改造计划文档 |
