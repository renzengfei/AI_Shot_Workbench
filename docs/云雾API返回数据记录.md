# 云雾 API 返回数据记录

测试时间: 2025-12-03 18:34

## 1. 查询任务 GET /v1/video/query - completed 状态

```json
{
  "id": "grok:5cdad6a7-0730-426f-88ec-d39b863ada15",
  "mode": "custom",
  "type": "create",
  "error": "",
  "model": "grok-3",
  "ratio": "1:1",
  "prompt": "**固定镜头→推镜**，远处传来巨响和尖叫，【格子衬衫男主】猛然抬头...",
  "status": "completed",
  "post_id": "d5f58ca9-c02c-4dd9-b7a1-4f15148811ee",
  "asset_id": "13e29068-0620-45cc-93eb-78f06f697247",
  "progress": 100,
  "trace_id": "fd36b06543396597b5a246f542b37b19",
  "upscaled": true,
  "video_id": "13e29068-0620-45cc-93eb-78f06f697247",
  "video_url": "https://soruxgpt-saas-yimeng.soruxgpt.com/file_download/15e6a163-a8af-441c-bea5-c59dd357657d.mp4",
  "completed_at": 1764745713,
  "thumbnail_url": "https://soruxgpt-saas-yimeng.soruxgpt.com/file_download/29f2d06e-959a-4e05-8c7b-47ebde7fcbba.jpg",
  "video_file_id": "15e6a163-a8af-441c-bea5-c59dd357657d",
  "thumbnail_file_id": "29f2d06e-959a-4e05-8c7b-47ebde7fcbba",
  "status_update_time": 1764745713,
  "upscale_on_complete": true
}
```

## 2. 查询任务 GET /v1/video/query - processing 状态

之前在 18:06 测试时，processing 状态返回：

```json
{
  "id": "grok:18e59915-22b0-4c62-9024-b7e3a0a37821",
  "status": "processing",
  "status_update_time": 1764756435
}
```

**注意：processing 状态时 API 不返回 progress 字段！**

同一个任务完成后返回：

```json
{
  "id": "grok:18e59915-22b0-4c62-9024-b7e3a0a37821",
  "mode": "custom",
  "type": "create",
  "error": "",
  "model": "grok-3",
  "ratio": "1:1",
  "prompt": "A cat walking",
  "status": "completed",
  "post_id": "bb2153c7-4734-401d-87f7-6011237195e2",
  "asset_id": "e16511e6-7865-45f9-abdb-33d410eca378",
  "progress": 100,
  "trace_id": "7a342bb0ac255c85e1f89829d5ff36fe",
  "upscaled": true,
  "video_id": "e16511e6-7865-45f9-abdb-33d410eca378",
  "video_url": "https://soruxgpt-saas-yimeng.soruxgpt.com/file_download/0e4cc150-1219-4263-af1b-8d2f9849f267.mp4",
  "completed_at": 1764756466,
  "thumbnail_url": "https://soruxgpt-saas-yimeng.soruxgpt.com/file_download/1154f194-11da-4ed5-9c8a-d74232170cf0.jpg",
  "video_file_id": "0e4cc150-1219-4263-af1b-8d2f9849f267",
  "thumbnail_file_id": "1154f194-11da-4ed5-9c8a-d74232170cf0",
  "status_update_time": 1764756466,
  "upscale_on_complete": true
}
```

---

## 结论

| 状态 | 是否返回 progress |
|------|-------------------|
| pending | ❌ 不返回 |
| processing | ❌ 不返回 |
| completed | ✅ 返回 100 |

云雾 API 在任务处理过程中**不返回中间进度**，只有完成后才返回 `progress: 100`。
