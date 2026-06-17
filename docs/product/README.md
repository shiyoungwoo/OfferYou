# OfferYou 产品文档索引

本目录保存 OfferYou 的产品与架构基线文档。后续 Agent 进入项目时，应先阅读主文档，再阅读阶段计划。

## 主文档

- [OfferYou PRD](./OfferYou-PRD.md)
- [OfferYou Architecture](./OfferYou-Architecture.md)
- [OfferYou UI 信息架构与改版方向](./OfferYou-UI-Information-Architecture.md)

## 架构决策

- [ADR 0001：以 JobApplyRun 作为系统主线](./decisions/0001-agent-run-as-core.md)
- [ADR 0002：FinalResumeDraft 是唯一输出源](./decisions/0002-final-resume-draft-as-output-source.md)
- [ADR 0003：模型失败必须可见](./decisions/0003-model-failure-must-be-visible.md)
- [ADR 0004：冻结 Professional CN 与 ATS Clean 模板](./decisions/0004-template-freeze.md)

## 历史归档

`archive/` 保存阶段性文档。归档文档用于追溯，不再作为后续执行的最高优先级依据。

## 执行规则

- 产品判断优先对齐 `OfferYou-PRD.md`。
- 技术实现优先对齐 `OfferYou-Architecture.md`。
- 页面入口、工作台结构和原型设计优先对齐 `OfferYou-UI-Information-Architecture.md`。
- 涉及长期架构取舍时，补充或更新 `decisions/`。
- 阶段计划不能覆盖主文档的产品原则和架构约束。
