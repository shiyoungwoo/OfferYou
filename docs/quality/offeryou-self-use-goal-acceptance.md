# OfferYou 自用求职闭环验收报告

验收日期：2026/05/08 07:58:57

## 1. 模型与环境

- 默认模型供应商：present:openai_compatible
- MiMo Key：present
- MiMo Base URL：present:https://token-plan-cn.xiaomimimo.com/...
- MiMo Model：present:mimo-v2.5-pro
- DeepSeek Key：missing
- Gemini Key：missing
- 模型探针：provider=openai_compatible，generationMode=model

## 2. 输入材料

- 原始简历：/Users/wsyoung/Desktop/OfferYou_中科曙光_Resume (3).pdf
- JD 截图：/Users/wsyoung/Desktop/JD 截图.png；/Users/wsyoung/Desktop/JD 截图 2.png
- JD 来源说明：本次使用桌面真实 JD 截图。主验收岗位：魔镜洞察｜AI 产品经理 Vibe Coding。
- JD 识别方式：本机 OCR 未通过质量检查，使用人工视觉转写。
- 多模态识别：当前验收脚本未接入多模态模型，不能声称由 AI 视觉模型识别 JD 截图。

- JD 文本长度：767 字符。
- PDF 解析长度：1090 字符，耗时 120 ms。
- PDF 解析片段：吴世阳 AI 产品经理 手机：18513449520邮箱：434995517@qq.com 学历：对外经济贸易大学 | 硕士英语：CET-6 个人优势 AI 产品与 Prompt 应用：独立设计并推进 AI 求职辅助产品 OfferYou MVP，完成核心流程定义、RESTful API 接口草案及前端状态 机设计，产品理念与生成式 AI 应用高度契合 产品需求拆解与数据分析：具备数学与经济学背景，熟练运用 Excel、Tableau、

## 3. 链路结果

### 简历解析

- calibratedResume：已生成
- 模块数量：8
- 解析风险：无明确结构风险。

### JD 理解

- 公司：魔镜洞察
- 岗位：AI 产品经理 Vibe Coding
- JDInsight generationMode：model
- 核心能力：通过行业研究、竞品分析与市场洞察，输出策略报告与趋势预判、构建业务数据监控体系，通过全链路数据定位产品落地与业务推、高效协同销售、增长、技术等相关部门，推动分析结论、AI、熟练运用 Claude Code / Antigravi、掌握研究方法论，拥有较强的结构化思考、分析总结和观点表达、具备较强的数据敏感度、信息处理及加工能力，能够独立开展数、善于团队合作和跨部门沟通协调，具备较强的抗压能力，能适应、AI 工具 / Prompt 应用
- 硬要求：第一学历国内 985/211 或海外 QS50 优先、1-3 年经验、本科学历、AI 工具 / Prompt 应用、产品需求拆解、数据分析与结果表达

### 改写建议

- 建议数量：5
- generationMode 分布：model:5
- provider 分布：openai_compatible:5
- fallbackReason：无
- 接受建议：3/3
  - summary｜AI 产品与 Prompt 应用：独立设计并推进 AI 求职辅助产品 OfferYou MVP，完成核心流程定义、RESTful API 接口草案及前端状态｜model｜snapshotSynced=true
  - experience｜学历：对外经济贸易大学 | 硕士英语：CET-6｜model｜snapshotSynced=true
  - experience｜广发银行北京分行 | 综合柜员岗｜model｜snapshotSynced=true

### Snapshot

- Snapshot templateKey：professional-cn
- Section 数量：5
- 页数估算：1
- 标题样例：手机：18513449520
邮箱：434995517@qq.com ｜ 求职意向：AI 产品经理 Vibe Coding
学历：对外经济贸易大学 · 硕士
AI 产品与 Prompt 应用：独立设计并推进 AI 求职辅助产品 OfferYou MVP，完成核心流程定义、RESTful API 接口草案及前端状态机设计，产品理念与生成式 AI 应用高度契合
产品需求拆解与数据分析：具备数学与经济学背景，熟练运用 Excel、Tableau、R 等工具进行数据建模与分析，能以数据驱动产品迭代与业务决策
B 端沟通与方案表达：3 年银行一线经验，积累了面向中铁、中国物流集团等 B 端客户的方案讲解

### PDF

- professional-cn
  - 路径：/Users/wsyoung/Projects/OfferYou/github_release/docs/quality/offeryou-self-use-goal-artifacts/professional-cn-595efff8-0361-4218-a23b-d6e944c93f58-吴世阳-AI 产品经理 Vibe Coding-可投递版-20260508.pdf
  - 大小：480490 bytes
  - PDF 文本提取长度：1131
  - PDF 文本片段：吴世阳 手机：18513449520|邮箱：434995517@qq.com | 学历：对外经济贸易大学 | 硕士 求职意向：AI 产品经理 Vibe Coding 个人优势 工作经历 广发银行北京分行 | 综合柜员岗2022.08-2025.08 流程优化与数据分析：协助进行运营数据统计与分析，为人员排班与窗口调整提供数据支撑；梳理并优化对公业务办理流程，提 升业务办理效率。 B 端客户服务：面向中铁、中国物流集团等 B 端客户提供产品讲解与方案推介，完成信用卡有效指标 40-50 张、季度有效户 10 户，积累
- ats-clean
  - 路径：/Users/wsyoung/Projects/OfferYou/github_release/docs/quality/offeryou-self-use-goal-artifacts/ats-clean-e9c76eca-8d7a-4806-8c3b-bb4eff4880c1-吴世阳-AI 产品经理 Vibe Coding-可投递版-20260508.pdf
  - 大小：437528 bytes
  - PDF 文本提取长度：1121
  - PDF 文本片段：吴世阳 AI 产品经理 Vibe Coding 手机：18513449520邮箱：434995517@qq.com 学历：对外经济贸易大学 | 硕士 个人优势 AI 产品与 Prompt 应用：独立设计并推进 AI 求职辅助产品 OfferYou MVP，完成核心流程定义、RESTful API 接口草案及前端状态 机设计，产品理念与生成式 AI 应用高度契合 产品需求拆解与数据分析：具备数学与经济学背景，熟练运用 Excel、Tableau、R 等工具进行数据建模与分析，能以数据驱动产品 迭代与业务决策 B 端沟

### 面试准备

- 输出路径：/Users/wsyoung/Projects/OfferYou/github_release/docs/quality/offeryou-self-use-goal-artifacts/interview-prep.md
- generationMode：model
- provider：openai_compatible
- 问题数量：7
- 自我介绍长度：304
- 风险提示：无

## 4. 人工可读检查

- PDF 是否可打开：是
- 个人信息是否有姓名：是
- 教育背景是否存在：是
- 本科教育是否保留：是
- 硕士教育是否保留：是
- 公司名称是否出现「陕西正大」误改风险：未发现
- 是否包含预期经历公司或项目：是
- OfferYou 项目是否保留：是
- 是否泄漏内部建议文案：未发现
- 是否存在重复标题风险：未发现
- 接受建议后预览是否可同步到 Snapshot：是
- 是否分别导出两个模板：是
- 面试准备是否基于 Snapshot/JD：是

PDF 内容完整性：
- professional-cn：本科=是，OfferYou 项目=是，内部建议泄漏=未发现
- ats-clean：本科=是，OfferYou 项目=是，内部建议泄漏=未发现

## 5. 失败或风险

- 模型 fallback：本次探针和建议未显示整体 fallback
- 事实风险：简历中‘OfferYou AI 岗位定制简历助手’项目时间为‘2026.03-至今’，存在时间逻辑错误（当前为2025年），可能影响简历可信度。；候选人当前职位为银行综合柜员，与AI产品经理的岗位跨度较大，需评估其产品思维、技术理解及行业认知的深度是否足以支撑快速转型。；个人项目经历虽展示执行力，但缺乏商业化验证或规模化数据支撑，其产品设计与增长策略的实际效果有待进一步验证。；对‘AI Agent’、‘出海’等岗位核心方向的理解和经验几乎空白，存在较大的学习与适应成本。
- 输入风险：本机 OCR 未通过质量检查，JD 使用人工视觉转写；这是可追踪输入，不是 job-apply 生成物，也不是多模态模型识别结果。
- 浏览器限制：本脚本通过 Playwright/Chromium 导出 PDF，没有在用户浏览器中人工点击完成。

## 6. 最终结论

可以进入人工复核后投递。当前产物已生成 PDF 与面试准备，但仍建议人工逐段检查 AI 改写质量。

距离 job-apply Skill 的差距：
- 本次已使用桌面真实 JD 截图和原始 PDF 简历，但 JD 截图没有走多模态模型；后续需要接入多模态直读或严格 OCR 完整度门禁。
- 仍需要人工判断 AI 改写是否真正超过规则模板，而不是只看 generationMode。
- 仍需要在浏览器中完成一次人工上传、确认、预览、导出的体验验收。

下一轮只建议做 3 件事：
- 把 JD 截图 OCR 完整度作为硬门槛：低于阈值时请求人工确认或改用多模态模型，不进入伪完整链路。
- 加一个「模型未真实返回就停止」的硬门槛，避免规则兜底进入投递链路。
- 做一条 PDF 内容一致性检查：接受建议文本、Snapshot、Professional CN PDF、ATS Clean PDF 四者必须可对齐。

## 7. 附录

已运行或需要配套运行的命令：
- `git status --short`：已检查，仓库存在大量前序改动，本次未清理。
- `git grep -n "tp-"`：已检查，未发现明显真实 API Key 入库；存在测试 fixture 与锁文件 false positive。
- `git ls-files | rg "env|sqlite|\\.log$|storage|node_modules|\\.next"`：已检查，未发现运行产物入库。
- `pnpm exec tsc --noEmit`：本轮前置检查通过。
- `pnpm test`：本轮前置检查通过。
- `pnpm run check:vnext`：本轮前置检查通过。
- `pnpm run test:pdf`：需在本报告生成后再次运行确认。
