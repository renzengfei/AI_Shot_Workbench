# AI Shot Workbench - 改造 JSON 工作流升级需求文档

> **版本**: v1.1  
> **日期**: 2025-11-28  
> **状态**: Prompt 已完成，前端/后端待开发

---

## 1. 背景与目标

### 1.1 现有工作流

```mermaid
graph LR
    A[deconstructionPrompt.ts<br/>外部AI工具] -->|生成MD| B[/deconstruction/ai 页面]
    B -->|解析生成| C[deconstruction.json]
    C -->|分析建议| D[productionStoryboardPrompt.ts<br/>外部AI工具]
    D -->|只读输出| E[诊断报告/优化建议]
```

### 1.2 升级目标

```mermaid
graph LR
    A[deconstructionPrompt.ts<br/>外部AI工具] -->|生成MD| B[/deconstruction/ai 页面]
    B -->|解析生成| C[deconstruction.json<br/>原片JSON]
    C -->|分析+改造| D[productionStoryboardPrompt.ts<br/>外部AI工具]
    D -->|生成多个| E[deconstruction_漫展拉腿版.json<br/>deconstruction_海边泳圈版.json<br/>...]
    E -->|切换查看| F[/deconstruction/manual 页面]
```

**核心变化**：
- `productionStoryboardPrompt.ts` 从"只读顾问"升级为"可生成改造 JSON"
- 支持生成多个改造版本 JSON
- 前端 `/deconstruction/manual` 支持切换不同 JSON 文件
- 改造 JSON 支持删除镜头、新增镜头（小数编号）

---

## 2. 数据结构规范

### 2.1 镜头 ID 规则

| 场景 | ID 类型 | 示例 |
|------|---------|------|
| 原片镜头 | 整数 | `1`, `2`, `3`, ... |
| 新增镜头 | 小数 | `5.1`, `5.2`（在镜头 5 和 6 之间新增） |
| 删除镜头 | 保留原 ID | ID 不变，内容标记为已删除 |

**注意**：JSON 中 `id` 字段类型为 `number`（支持小数）。

### 2.2 删除镜头格式

当某个镜头被删除时，**保留该镜头在 `shots` 数组中**，但修改其 `initial_frame` 和 `visual_changes` 字段：

```json
{
  "id": 3,
  "timestamp": "2.5s",
  "end_time": "4.0s",
  "duration": "1.5s",
  "keyframe": "keyframe_003.jpg",
  "initial_frame": "⚠️ **[已删除]** 原因：该镜头与新主题不符，原片是泳池场景，改造版是漫展场景",
  "visual_changes": "⚠️ **[已删除]** 原因：该镜头与新主题不符，原片是泳池场景，改造版是漫展场景"
}
```

**规范**：
- 必须以 `⚠️ **[已删除]**` 开头
- 必须包含删除原因
- `timestamp`、`end_time`、`duration`、`keyframe` 保持原值不变

### 2.3 新增镜头格式

```json
{
  "id": 5.1,
  "timestamp": "N/A",
  "end_time": "N/A",
  "duration": "建议 1.5s",
  "keyframe": null,
  "initial_frame": "【新增镜头】近景，【Coser女主】站在漫展摊位前，手持限定周边，表情惊喜又期待...",
  "visual_changes": "【新增镜头】固定镜头，【Coser女主】双手捧起周边端详，眼睛发亮，嘴角上扬..."
}
```

**规范**：
- `id` 为小数，表示插入位置（如 `5.1` 表示在镜头 5 和 6 之间）
- `timestamp`、`end_time` 设为 `"N/A"`（无原片对应）
- `duration` 填写建议时长
- `keyframe` 设为 `null`
- `initial_frame` 和 `visual_changes` 以 `【新增镜头】` 开头

### 2.4 改造 JSON 文件命名

- **命名规则**：`deconstruction_<AI自动命名>.json`
- **命名由 AI 根据改造主题自动生成**，如：
  - `deconstruction_漫展拉腿版.json`
  - `deconstruction_海边泳圈版.json`
  - `deconstruction_地铁惊魂版.json`

### 2.5 改造 JSON 的 generated 目录

每个改造 JSON 拥有**独立的 generated 目录**，用于存放该版本的生成图片和视频：

```
workspaces/7/
├── deconstruction.json                    # 原片 JSON
├── deconstruction_漫展拉腿版.json          # 改造版 JSON
├── deconstruction_海边泳圈版.json          # 改造版 JSON
├── generated/                             # 原片的生成资源
│   └── shots/
│       ├── 1/
│       │   ├── image_1.png
│       │   └── video_1.mp4
│       └── 2/
│           └── ...
├── generated_漫展拉腿版/                   # 漫展拉腿版的生成资源
│   └── shots/
│       ├── 1/
│       ├── 5.1/                           # 新增镜头的生成资源
│       └── ...
└── generated_海边泳圈版/                   # 海边泳圈版的生成资源
    └── shots/
        └── ...
```

**命名规则**：
- 原片 JSON (`deconstruction.json`) → `generated/`
- 改造 JSON (`deconstruction_XXX.json`) → `generated_XXX/`

---

## 3. Prompt 改造需求

### 3.1 productionStoryboardPrompt.ts 改造

#### 3.1.1 模式升级

从"只读顾问模式"升级为"可生成改造 JSON 模式"：

```typescript
// 原来
const CONFIG = {
  mode: "Advisory",
  file_access: "READ_ONLY",
  output_channel: "Dialogue",
  // ...
};

// 升级后（已完成）
const CONFIG = {
  mode: "Advisory + Generator",
  file_access: "READ_WRITE",  // 可写入
  output_channel: "Dialogue + JSON",
  // ...
};
```

#### 3.1.2 新增指令

在 Prompt 中新增以下指令支持：

| 用户指令 | AI 行为 |
|----------|---------|
| `生成改造版` | 根据当前分析，生成一个改造 JSON |
| `生成多个改造版` | 根据用户描述，生成多个改造 JSON |
| `删除镜头 X` | 在改造 JSON 中标记镜头 X 为已删除 |
| `在镜头 X 和 Y 之间新增镜头` | 在改造 JSON 中插入新镜头（小数 ID） |

#### 3.1.3 输出格式

当用户请求生成改造 JSON 时，AI 应输出：

```markdown
## 改造版本：漫展拉腿版

### 改造说明
- 主题：将泳池场景改为漫展场景
- 删除镜头：#3, #11（原因：泳池相关，与新主题不符）
- 新增镜头：#5.1, #5.2（漫展特有场景）

### JSON 文件
文件名：`deconstruction_漫展拉腿版.json`

\`\`\`json
{
  "round1": { ... },
  "round2": {
    "characters": { ... },
    "shots": [ ... ]
  }
}
\`\`\`
```

#### 3.1.4 改造 JSON 生成规则

1. **保持结构完整**：改造 JSON 必须包含完整的 `round1` 和 `round2` 结构
2. **更新 round1**：
   - `logic_chain`：根据新主题更新
   - `skeleton_nodes`：根据新主题更新
   - `viral_elements_found`：根据新主题更新
3. **更新 round2**：
   - `characters`：**默认直接复用原 JSON 的角色字典**，除非用户明确要求更换角色
   - `shots`：应用删除/新增/修改
4. **首帧描述与视频描述的自包含原则**：
   - **背景**：每个 `initial_frame` 和 `visual_changes` 都是给**无记忆的下游 AI**（生图/生视频模型）使用的
   - 下游 AI 没有上下文，不了解整个 JSON，只知道当前镜头的描述和角色形象参考图
   - **规范**：
     - 角色必须使用【】标注（如【五条悟Cos男主】），不能只写"男主"
     - 每个描述必须独立包含：场景环境 + 角色 + 动作/状态
     - 视角和镜头类型必须明确（如 **近景，平视**）
     - 不能依赖"前一镜头"或"后续镜头"的上下文
5. **图生视频一致性原则** ⚠️ 关键：
   - **核心逻辑**：视频生成模型严格基于**首帧图**生成后续动画，无法操作不存在的物体
   - **规范**：
     - 🚫 **禁止无中生有**：`visual_changes` 中涉及的所有实体（人物、道具）必须在 `initial_frame` 中明确定义
     - 🚫 **禁止隐形道具**：如果动作涉及道具（如扔出苹果），该道具必须在 `initial_frame` 中出现
     - ❌ 错误示例：首帧没提"法杖"，视频描述写"法杖掉落"（AI 做不到）
     - ✅ 正确示例：首帧写"手持法杖"，视频描述写"法杖掉落"
6. **JSON 格式兼容性规则** ⚠️：
   - **禁止使用中文弯引号** `"..."` (U+201C/U+201D)
   - **必须使用** `「...」` 或 `'...'` 替代
   - **原因**：IDE 的 JSON linter 会将中文弯引号误认为字符串结束符，导致大量语法错误
7. **改造思路确认流程** ⚠️ 硬性要求：
   - **Step 1: 完整重述改造思路**：在生成 JSON 前，AI 必须先完整重述用户的改造思路（主题、删除镜头、新增镜头、角色处理、逻辑链调整等）
   - **Step 2: 等待用户确认**：用户确认后才能进入 Step 3
   - **Step 3: 生成 JSON**：用户明确确认后，才能生成完整 JSON
   - **禁止跳过**：不能在没有用户确认的情况下直接生成 JSON

### 3.2 deconstructionPrompt.ts

**无需改造**。改造版本只通过 `productionStoryboardPrompt.ts` 生成，不需要 MD 中间格式。

---

## 4. 前端改造需求

### 4.1 JSON 切换器

**位置**：`/deconstruction/manual` 页面顶部

**功能**：
- 列出所有可用的 JSON 文件：`deconstruction.json` + 所有 `deconstruction_*.json`
- 默认选中当前加载的文件
- 切换时重新加载对应 JSON 的数据

**UI 示例**：
```
┌─────────────────────────────────────────────────┐
│  📄 当前文件：[deconstruction_漫展拉腿版.json ▼] │
│                                                 │
│  ├─ deconstruction.json (原片)                  │
│  ├─ deconstruction_漫展拉腿版.json ✓            │
│  └─ deconstruction_海边泳圈版.json              │
└─────────────────────────────────────────────────┘
```

**实现位置**：
- `frontend/components/WorkspaceContext.tsx` - 已有 `deconstructionFiles` 和 `switchDeconstructionFile`
- `frontend/components/workflow/Step3_DeconstructionReview.tsx` - 添加切换器 UI

### 4.2 新增镜头的视频播放器处理

**场景**：当镜头 ID 为小数（如 `5.1`）时，表示新增镜头，无原片视频。

**处理方式**：
- 视频播放器区域显示占位文字：`该镜头为新增镜头，无原片对照`
- 如果该镜头有生成的图片/视频，正常显示生成资源

**判断逻辑**：
```typescript
const isNewShot = (shotId: number) => !Number.isInteger(shotId);
// 或者检查 timestamp === "N/A"
```

**实现位置**：
- `frontend/components/workflow/ShotCard.tsx` - 视频播放器组件

### 4.3 删除镜头的处理

**场景**：当镜头的 `initial_frame` 以 `⚠️ **[已删除]**` 开头时。

**处理方式**：
- **正常展示**，用户可以从文字内容看出"已删除"状态
- 原片视频正常显示（如果有）
- 生成的图片/视频正常显示（如果有）

**无需特殊 UI 处理**。

### 4.4 生成资源路径适配

**当前逻辑**（`Step3_DeconstructionReview.tsx` 的 `loadExistingImagesForShot` 函数）：
```typescript
const candidate = `${API_BASE}/workspaces/${workspaceSlug}/generated/shots/${shotId}/...`;
```

**改造后逻辑**：
```typescript
// 根据当前选中的 JSON 文件确定 generated 目录
const getGeneratedDir = (selectedFile: string) => {
  if (selectedFile === 'deconstruction.json') {
    return 'generated';
  }
  // deconstruction_漫展拉腿版.json → generated_漫展拉腿版
  const match = selectedFile.match(/^deconstruction_(.+)\.json$/);
  return match ? `generated_${match[1]}` : 'generated';
};

const generatedDir = getGeneratedDir(selectedDeconstructionFile);
const candidate = `${API_BASE}/workspaces/${workspaceSlug}/${generatedDir}/shots/${shotId}/...`;
```

**影响范围**：
- `loadExistingImagesForShot` 函数
- 图片生成 API 调用
- 视频生成 API 调用

### 4.5 小数 ID 的目录兼容

**问题**：小数 ID（如 `5.1`）作为目录名可能有兼容性问题。

**解决方案**：
- 前端：直接使用小数作为目录名（如 `shots/5.1/`）
- 后端：确保文件系统支持小数目录名（大多数系统支持）

---

## 5. 后端改造需求

### 5.1 generated 目录支持

**新增 API 或修改现有 API**：

1. **图片生成 API**：支持指定 `generated_dir` 参数
2. **视频生成 API**：支持指定 `generated_dir` 参数
3. **静态文件服务**：支持访问 `generated_XXX/` 目录

**示例**：
```python
@app.post("/api/workspaces/{path}/generate-image")
async def generate_image(
    path: str,
    shot_id: float,  # 支持小数
    generated_dir: str = "generated",  # 新增参数
    ...
):
    output_dir = f"workspaces/{path}/{generated_dir}/shots/{shot_id}"
    ...
```

### 5.2 deconstruction-files API

**现有 API**：`GET /api/workspaces/{path}/deconstruction-files`

**返回格式**：
```json
{
  "files": [
    "deconstruction.json",
    "deconstruction_漫展拉腿版.json",
    "deconstruction_海边泳圈版.json"
  ]
}
```

**无需改动**，已支持列出所有 `deconstruction*.json` 文件。

---

## 6. 验收标准

### 6.1 Prompt 验收 ✅ 已完成

- [x] `productionStoryboardPrompt.ts` 支持生成改造 JSON
- [x] 生成的 JSON 符合数据结构规范（删除镜头格式、新增镜头格式）
- [x] AI 能自动命名改造版本

> **实现说明**：已在 `productionStoryboardPrompt.ts` 中新增 MODULE 8: 改造 JSON 生成模块，包含：
> - 8.1 改造 JSON 命名规则
> - 8.2 删除镜头处理规则
> - 8.3 新增镜头处理规则
> - 8.4 改造 JSON 完整结构
> - 8.5 改造 JSON 生成流程
> - 8.6 改造 JSON 自检清单
> - 8.7 用户指令参考

### 6.2 前端验收

- [ ] `/deconstruction/manual` 页面有 JSON 切换器
- [ ] 切换 JSON 后，数据正确加载
- [ ] 新增镜头（小数 ID）显示"该镜头为新增镜头，无原片对照"
- [ ] 删除镜头正常展示（无特殊处理）
- [ ] 生成资源路径根据选中的 JSON 文件动态切换

### 6.3 后端验收

- [ ] 支持 `generated_XXX/` 目录的静态文件访问
- [ ] 图片/视频生成 API 支持指定 `generated_dir`
- [ ] 小数 ID 目录（如 `5.1/`）正常工作

---

## 7. 相关文件清单

### 7.1 需要修改的文件

| 文件 | 改动类型 | 状态 | 说明 |
|------|----------|------|------|
| `frontend/data/productionStoryboardPrompt.ts` | 修改 | ✅ 已完成 | 添加 MODULE 8: 改造 JSON 生成模块 |
| `frontend/components/workflow/Step3_DeconstructionReview.tsx` | 修改 | ⏳ 待开发 | 添加 JSON 切换器、适配 generated 路径 |
| `frontend/components/workflow/ShotCard.tsx` | 修改 | ⏳ 待开发 | 新增镜头的占位显示 |
| `backend/main.py` | 修改 | ⏳ 待开发 | 支持 generated_dir 参数 |

### 7.2 参考文件（只读）

| 文件 | 说明 |
|------|------|
| `frontend/data/deconstructionPrompt.ts` | 原片拆解 Prompt（无需改动） |
| `frontend/components/WorkspaceContext.tsx` | 已有 JSON 切换逻辑 |
| `workspaces/7/deconstruction.json` | 原片 JSON 示例 |
| `workspaces/7/deconstruction_漫展拉腿版.json` | 改造 JSON 示例 |

---

## 8. 附录

### 8.1 完整的改造 JSON 示例

参考文件：`workspaces/7/deconstruction_漫展拉腿版.json`

### 8.2 现有前端组件结构

```
frontend/
├── app/(workflow)/deconstruction/
│   ├── ai/page.tsx          # AI 生成页面
│   └── manual/page.tsx      # 人工改写页面（本次改造重点）
├── components/workflow/
│   ├── Step3_DeconstructionReview.tsx  # 主组件
│   └── ShotCard.tsx                    # 镜头卡片组件
└── components/
    └── WorkspaceContext.tsx            # 工作空间上下文
```

### 8.3 现有 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/workspaces/{path}/deconstruction-files` | GET | 获取所有 deconstruction JSON 文件列表 |
| `/api/workspaces/{path}/deconstruction` | GET | 获取指定 JSON 文件内容 |
| `/api/workspaces/{path}/deconstruction` | POST | 保存 JSON 文件 |
| `/workspaces/{slug}/generated/shots/{id}/...` | GET | 静态文件访问 |
