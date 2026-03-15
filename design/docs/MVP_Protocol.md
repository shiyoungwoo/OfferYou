---
title: 简历助手重制-MVP输入输出协议
type: project
created: 2026-03-01
status: active
area: "[[求职]]"
tags: [project, 协议, MVP, 输入输出, 简历]
---
# 简历助手重制-MVP输入输出协议

## 目标与范围
- 目标: 定义“岗位定制助手”在 MVP 阶段的输入、输出、处理流程和错误处理规则，确保可直接开发与验收。
- 核心架构原则（基于 2026-03-09 风暴）:
  1. **输入即解构**: 剥离简历原样式，将输入转化为独立的“事实积木块”存入 Master 祖宗库。
  2. **陪伴式优化与防失真**: 拒绝黑盒“一键全篇重写”，AI 仅提供带理由的局部改写建议，用户逐条勾选确认（左右对照），确保掌控感。
  3. **基于快照的派生 (Snapshot Derivation)**: 针对特定 JD 生成的优化简历，是拉取 Master 库当前快照后的独立分支版本。后续不对派生版与 Master 版进行复杂的数据双向同步，避免污染失真。修改错误直接生成新快照版。
- 范围: 仅覆盖三大核心模块（简历解析、JD 对齐优化、极简排版导出与投递记录）。定制化排版仅提供 2-3 种极其克制的大厂/投行风。
- 不在 MVP 范围: 社区积分、视频 Mock 面试、复杂仪表盘与多角色权限系统。

---

## 1) 输入协议

### 1.1 请求入口
- 入口A: 上传简历文件 + 粘贴/上传 JD。
- 入口B: 手动编辑简历文本 + 粘贴/上传 JD。

### 1.2 输入字段定义
- `candidate_profile` (object, required)
  - `name` (string, required)
  - `phone` (string, optional)
  - `email` (string, optional)
  - `location` (string, optional)
  - `summary` (string, optional)
- `resume_source` (object, required)
  - `mode` (enum, required): `file` | `manual`
  - `file_type` (enum, optional when mode=file): `pdf` | `docx` | `txt` | `image`
  - `content` (string, required): 统一抽取后的简历正文
  - `raw_file_ref` (string, optional): 原文件引用或路径
- `job_description` (object, required)
  - `mode` (enum, required): `text` | `image`
  - `content` (string, required): 统一抽取后的 JD 正文
  - `lang_hint` (enum, optional): `zh` | `en` | `auto` (默认 `auto`)
- `optimize_options` (object, optional)
  - `target_tone` (enum): `professional` | `concise` | `impact`
  - `target_length` (enum): `one_page` | `flexible`
  - `must_keep` (array[string]): 必留关键词/经历

### 1.3 输入校验规则
- 简历正文最小长度: `>= 200` 字符；不足则返回“内容不足”错误。
- JD 正文最小长度: `>= 120` 字符；不足则返回“JD 信息不足”错误。
- 图片类输入必须先过 OCR；OCR 失败时允许用户改为手动文本输入。
- 语言规则: 报告语言默认跟随 JD 主语言；`lang_hint` 可覆盖自动判断。

---

## 2) 输出协议

### 2.1 主输出结构
- `optimization_report` (object)
  - `match_score` (number, 0-100): 简历与 JD 匹配度
  - `strengths` (array[string]): 现有优势点
  - `gaps` (array[string]): 与 JD 的差距点
  - `rewrite_suggestions` (array[object])
    - `section` (string): 如 `summary` / `experience`
    - `before` (string)
    - `after` (string)
    - `reason` (string)
  - `keywords_to_add` (array[string])
  - `risk_notes` (array[string]): 夸大风险、证据不足等
- `refined_resume` (object)
  - `content` (string): 可直接编辑的优化后简历文本
  - `sections` (array[object]): 结构化段落
  - `page_estimate` (number): 预计页数（用于 A4 预览）
- `export_artifacts` (object)
  - `pdf_ref` (string, optional)
  - `docx_ref` (string, optional)
  - `txt_ref` (string, optional)
- `delivery_record` (object)
  - `application_id` (string)
  - `job_title` (string)
  - `company` (string)
  - `created_at` (datetime)

### 2.2 展示层最小要求
- 报告区: 匹配分、优势、差距、可执行改写建议。
- 编辑区: 支持“一键导入建议”和手动二次编辑。
- 预览区: A4 多页展示，不允许超页内容丢失。
- 导出区: 至少支持 PDF 与 TXT；DOCX 可选。

---

## 3) 处理流程协议

1. **输入标准化**
   - 文件解析/OCR -> 剥离样式，统一提取为独立文本积木块存入/对比 Master 库 -> 语言识别。
2. **信息抽取**
   - 提取简历关键字段（教育、经历、技能、项目）。
3. **JD 对齐分析**
   - 计算匹配度 -> 差距分析 -> 关键词建议。
4. **带有理由的改写建议生成**
   - 生成针对现有积木块的局部优化建议与理由（不直接覆盖）。
5. **人工确认与派生组装 (Mentor Mode)**
   - UI 左右对照：左侧显示用户原块数据（不被修改），右侧显示建议。用户逐一点击采纳。
   - 采纳时，系统在后台基于 Master 块拉取“草稿快照”，所有操作仅在快照层生效，实现防污染。
6. **防爆管预览与导出**
   - 提供 2-3 套极致克制定制模板选择。
   - 实时判断排版水位：如果因修改导致内容超出一页，触发水位预警，AI 提出裁剪弱相关经历的建议（或人工确认进入次页）。
   - 导出后锁死当前派生快照文档并写下投递记录（若后续发现快照有误，修改 Master 库后再生成新快照投递）。

---

## 4) 错误码与降级策略（MVP）
- `E_RESUME_PARSE_FAILED`: 简历解析失败 -> 提示切换为手动粘贴。
- `E_JD_PARSE_FAILED`: JD 解析失败 -> 提示改为文本输入。
- `E_CONTENT_TOO_SHORT`: 输入内容过短 -> 高亮最小要求。
- `E_LANG_DETECT_FAILED`: 语言判定失败 -> 默认中文并允许手动切换。
- `E_EXPORT_FAILED`: 导出失败 -> 保底提供纯文本下载。

降级原则:
- 优先保证“可编辑文本”与“可导出文本”可用，不因高级能力失败阻断主流程。

---

## 5) 验收标准（Definition of Done）
- [ ] 能接收 `pdf/docx/txt` 简历与文本 JD，并完成一次优化输出。
- [ ] 报告语言可跟随 JD（中/英），且支持手动切换。
- [ ] 一键导入改写建议后，预览支持多页 A4。
- [ ] 可导出至少 1 种文件格式（建议 PDF）并写入投递记录。
- [ ] 出错时提供明确错误提示与可执行下一步。

---

## 6) 与后续版本接口预留
- 面试日程联动预留字段: `application_id`, `company`, `job_title`。
- Interview Prep 预留字段: `question_bank_ref`, `self_intro_ref`。
- 社区积分预留字段: `contribution_score`（MVP 不启用）。

---

## 7) 后端接口草案（MVP）

### 7.1 创建优化任务
- Method: `POST /api/v1/resume/optimize`
- 用途: 提交简历与 JD，返回任务 ID（异步）

请求示例:
```json
{
  "candidate_profile": {
    "name": "张三",
    "phone": "13800000000",
    "email": "zhangsan@example.com",
    "location": "上海",
    "summary": "3年后端开发经验，关注AI应用落地"
  },
  "resume_source": {
    "mode": "file",
    "file_type": "pdf",
    "content": "...OCR/解析后的简历正文...",
    "raw_file_ref": "upload://resume/2026-03-01-001"
  },
  "job_description": {
    "mode": "text",
    "content": "...JD正文...",
    "lang_hint": "auto"
  },
  "optimize_options": {
    "target_tone": "professional",
    "target_length": "one_page",
    "must_keep": ["LLM", "RAG", "微服务"]
  }
}
```

响应示例:
```json
{
  "task_id": "opt_20260301_0001",
  "status": "queued",
  "estimated_seconds": 25
}
```

### 7.2 查询优化结果
- Method: `GET /api/v1/resume/optimize/{task_id}`
- 用途: 轮询任务状态与结果

响应示例（成功）:
```json
{
  "task_id": "opt_20260301_0001",
  "status": "succeeded",
  "optimization_report": {
    "match_score": 82,
    "strengths": ["项目经验贴近JD", "技术关键词覆盖较好"],
    "gaps": ["业务指标描述不足", "英文摘要不够精炼"],
    "rewrite_suggestions": [
      {
        "section": "summary",
        "before": "负责后端开发",
        "after": "主导高并发后端服务设计，支撑日均10万请求",
        "reason": "增强结果导向表达"
      }
    ],
    "keywords_to_add": ["A/B测试", "成本优化"],
    "risk_notes": ["部分成果缺少量化证据"]
  },
  "refined_resume": {
    "content": "...优化后简历全文...",
    "sections": [
      { "name": "summary", "text": "..." },
      { "name": "experience", "text": "..." }
    ],
    "page_estimate": 2
  }
}
```

响应示例（处理中）:
```json
{
  "task_id": "opt_20260301_0001",
  "status": "running",
  "progress": 60
}
```

### 7.3 导出简历
- Method: `POST /api/v1/resume/export`
- 用途: 将优化后内容导出为文件并返回下载地址

请求示例:
```json
{
  "task_id": "opt_20260301_0001",
  "format": "pdf",
  "content": "...优化后简历全文..."
}
```

响应示例:
```json
{
  "export_id": "exp_20260301_0007",
  "status": "ready",
  "download_url": "/api/v1/files/exp_20260301_0007"
}
```

### 7.4 记录投递
- Method: `POST /api/v1/applications`
- 用途: 保存本次优化对应的岗位投递记录，供后续日程与面试联动

请求示例:
```json
{
  "task_id": "opt_20260301_0001",
  "company": "示例科技",
  "job_title": "AI 产品经理",
  "resume_export_id": "exp_20260301_0007",
  "applied_at": "2026-03-01T14:30:00+08:00"
}
```

响应示例:
```json
{
  "application_id": "app_20260301_0021",
  "status": "created"
}
```

---

## 8) 前端页面状态机（MVP）

### 8.1 页面A：简历与JD输入页
- `idle`: 初始态，显示上传/粘贴入口
- `validating`: 本地校验中（长度、格式）
- `invalid`: 校验失败，展示字段级错误
- `submitting`: 提交中，禁用按钮
- `submitted`: 提交成功，跳转结果页
- `submit_error`: 提交失败，保留用户输入并允许重试

状态迁移:
- `idle -> validating -> invalid|submitting`
- `submitting -> submitted|submit_error`
- `submit_error -> submitting`

### 8.2 页面B：优化结果页
- `loading`: 轮询任务状态（queued/running）
- `ready`: 成功拿到 `optimization_report` 与 `refined_resume`
- `empty`: 返回成功但内容为空（极端降级）
- `error`: 查询失败/超时

状态迁移:
- `loading -> ready|empty|error`
- `error -> loading`（重试）

### 8.3 页面C：编辑与预览页
- `editing`: 用户编辑优化后简历
- `preview_loading`: 生成预览中
- `preview_ready`: 多页 A4 预览可见
- `preview_error`: 预览失败，提示降级为文本预览

状态迁移:
- `editing -> preview_loading -> preview_ready|preview_error`
- `preview_error -> preview_loading`

### 8.4 页面D：导出与投递记录页
- `export_idle`: 选择导出格式
- `exporting`: 导出处理中
- `export_ready`: 可下载
- `export_error`: 导出失败
- `recording_application`: 写投递记录中
- `done`: 导出+记录完成

状态迁移:
- `export_idle -> exporting -> export_ready|export_error`
- `export_ready -> recording_application -> done|export_error`

### 8.5 全局错误处理约定
- 任一页面遇到 `E_CONTENT_TOO_SHORT` / `E_PARSE_FAILED`：
  - 保留用户输入
  - 高亮错误字段
  - 提供“手动输入继续”按钮
- 任一页面超时：
  - 展示“稍后重试”与“复制当前内容”选项

---

## 9) OpenAPI 草案
- API 定义文件: [[简历助手重制-MVP-openapi.yaml]]
- 说明: 可直接用于生成后端路由骨架与前端类型（后续再补鉴权、分页、幂等键）。
