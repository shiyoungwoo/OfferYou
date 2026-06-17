# OfferYou Tauri 桌面壳与本机 CLI Provider 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` task-by-task 执行。所有步骤使用 checkbox 追踪；每个任务完成后先跑指定测试，再进入下一任务。

**Goal:** 把 OfferYou 包装成本机 Tauri 桌面 App，并新增两个本机已授权模型通道：Antigravity CLI 与 Codex CLI。

**Architecture:** 保持「Next.js Web UI + Node 服务层」为业务核心，Tauri 只做桌面壳、启动本地服务、打开窗口和管理本机能力。AI provider 通过统一 `model-gateway` 接入，CLI provider 只负责非交互文本/JSON 生成，不直接改业务数据、不执行任意 shell。

**Tech Stack:** Next.js 15、React 19、better-sqlite3、Tauri v2、Rust、Node `execFile`、Antigravity CLI `agy`、Codex CLI `codex exec`、Vitest、Playwright。

---

## 0. 已确认事实

- OfferYou 真实代码目录：`/Users/wsyoung/Projects/OfferYou/github_release`
- 当前 Web 启动：`pnpm dev`
- 当前 Gemini 通道：`@google/genai` SDK + `GEMINI_API_KEY`
- 当前默认 provider：`.env.local` 中 `DEFAULT_MODEL_PROVIDER=openai_compatible`
- 本机 Codex CLI：`/opt/homebrew/bin/codex`
- 本机 Antigravity CLI：`/Users/wsyoung/.local/bin/agy`
- `agy --help` 支持：`--print`、`--print-timeout`、`--model`、`--log-file`、`--sandbox`
- `codex exec --help` 支持：`exec`、`--model`、`--cd`、`--sandbox`、`--output-last-message`、`--json`
- 项目已有命令执行封装：`lib/services/ingestion/command-runner.ts`

---

## 1. 边界规则

- 不重写 OfferYou 为原生桌面应用；业务仍在 Next.js / Node 服务层。
- Tauri 不承载简历解析、AI 生成、资料库、面试记录等业务逻辑。
- Tauri Rust 层只做：启动本地服务、窗口、App 数据目录、生命周期管理。
- 桌面壳不得修改 `Professional CN` / `ATS Clean` 简历模板视觉。
- CLI provider 只调用本机已授权 CLI 进行模型生成，不允许让 CLI agent 自主修改仓库。
- CLI provider 必须使用 `execFile` 或 `spawn` 参数数组，禁止拼接 shell 字符串。
- Antigravity CLI 必须传 `--model` 和 `--log-file`，失败时读取 log file 做诊断。
- Codex CLI 默认必须用 `--sandbox read-only`，并通过 prompt 明确「只返回文本，不修改文件」。
- 所有 provider 失败必须回到 `deterministic_fallback`，不能把 fallback 内容标成 AI 结果。
- 桌面版数据目录必须与 app bundle 分离，不能继续默认写入只读安装目录。

---

## 2. 文件结构

### Tauri 桌面壳

- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `scripts/desktop/resolve-runtime.mjs`
- Create: `scripts/desktop/start-next-server.mjs`
- Create: `scripts/desktop/wait-for-health.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

### 桌面数据目录

- Create: `lib/runtime/storage-root.ts`
- Modify: `lib/db.ts`
- Modify: `lib/services/export/pdf-export-service.ts`
- Modify: `app/api/uploads/ingest/route.ts`
- Modify: `app/api/drafts/from-profile/route.ts`
- Modify: `app/api/drafts/[draftId]/export/route.ts`
- Modify: `app/api/model-provider/route.ts`
- Modify: `lib/ai/model-provider-config.ts`

### CLI Provider

- Create: `lib/ai/cli/cli-command.ts`
- Create: `lib/ai/cli/antigravity-cli-client.ts`
- Create: `lib/ai/cli/codex-cli-client.ts`
- Create: `lib/ai/cli/cli-diagnostics.ts`
- Modify: `lib/ai/model-provider-config.ts`
- Modify: `lib/ai/model-routing.ts`
- Modify: `lib/ai/model-gateway.ts`
- Modify: `components/me/model-provider-status-card.tsx`
- Modify: `app/api/model-provider/route.ts`

### 测试

- Create: `tests/unit/runtime/storage-root.test.ts`
- Create: `tests/unit/ai/antigravity-cli-client.test.ts`
- Create: `tests/unit/ai/codex-cli-client.test.ts`
- Modify: `tests/unit/ai/model-routing.test.ts`
- Modify: `tests/unit/ai/model-gateway.test.ts`
- Modify: `tests/unit/me/model-provider-status-card.test.tsx`

---

## 3. 阶段 A：稳定当前 Web 基线

- [ ] **Step A1: 检查工作区状态**

Run:

```bash
git status --short
```

Expected:

- 记录已有 dirty 文件。
- 不回滚用户已有改动。
- 后续 `git add` 必须只加本计划相关文件。

- [ ] **Step A2: 跑当前基线测试**

Run:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm run check:vnext
```

Expected:

- 全部通过后再开始改动。
- 如果失败，先判断是否和桌面化无关；无关则记录，不顺手修。

---

## 4. 阶段 B：抽象本地存储根目录

### 目标

桌面 App 运行时不能把 SQLite、PDF、上传文件写进 app bundle 或安装目录。统一使用 `OFFERYOU_STORAGE_DIR`，没有配置时仍回退到当前 `process.cwd()/storage`。

- [ ] **Step B1: 写失败测试**

Create: `tests/unit/runtime/storage-root.test.ts`

测试点：

- `OFFERYOU_STORAGE_DIR=/tmp/offeryou-data` 时返回该目录。
- 未配置时返回 `path.join(process.cwd(), "storage")`。
- 返回路径必须是绝对路径。

Run:

```bash
pnpm exec vitest run tests/unit/runtime/storage-root.test.ts
```

Expected: FAIL，提示模块不存在。

- [ ] **Step B2: 实现 storage root**

Create: `lib/runtime/storage-root.ts`

要求：

```ts
import path from "node:path";

export function getStorageRoot() {
  const configured = process.env.OFFERYOU_STORAGE_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), "storage");
}
```

- [ ] **Step B3: 替换硬编码 storage**

Modify:

- `lib/db.ts`
- `lib/services/export/pdf-export-service.ts`
- `app/api/uploads/ingest/route.ts`
- `app/api/drafts/from-profile/route.ts`
- `app/api/drafts/[draftId]/export/route.ts`
- `app/api/model-provider/route.ts`
- `lib/ai/model-provider-config.ts`

替换规则：

- `path.join(process.cwd(), "storage")` 改为 `getStorageRoot()`。
- 数据库路径改为 `path.join(getStorageRoot(), "offeryou.sqlite")`。
- 创建目录时创建 `getStorageRoot()`。

- [ ] **Step B4: 验证**

Run:

```bash
pnpm exec vitest run tests/unit/runtime/storage-root.test.ts tests/unit/db.test.ts tests/integration/storage/local-storage-adapter.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS。

Commit:

```bash
git add lib/runtime/storage-root.ts lib/db.ts lib/services/export/pdf-export-service.ts app/api/uploads/ingest/route.ts app/api/drafts/from-profile/route.ts app/api/drafts/[draftId]/export/route.ts app/api/model-provider/route.ts lib/ai/model-provider-config.ts tests/unit/runtime/storage-root.test.ts
git commit -m "refactor: centralize OfferYou storage root"
```

---

## 5. 阶段 C：新增 Antigravity CLI Provider

### 目标

新增 `antigravity_cli` provider，复用本机已授权 `agy`，供桌面版优先使用 Gemini 系列模型。

- [ ] **Step C1: 扩展类型测试**

Modify: `tests/unit/ai/model-routing.test.ts`

新增断言：

- `OPENAI_COMPATIBLE_FLAVOR` 不影响 `antigravity_cli`。
- `ANTIGRAVITY_CLI_BIN=/Users/wsyoung/.local/bin/agy` 时 provider 可配置。
- 默认模型为 `Gemini 3.5 Flash (Medium)`。
- complex tier 可用 `ANTIGRAVITY_CLI_MODEL_COMPLEX` 覆盖。

Run:

```bash
pnpm exec vitest run tests/unit/ai/model-routing.test.ts
```

Expected: FAIL。

- [ ] **Step C2: 扩展 provider key**

Modify:

- `lib/ai/model-provider-config.ts`
- `lib/ai/model-routing.ts`

要求：

```ts
export type ModelProviderKey =
  | "gemini"
  | "openai_compatible"
  | "antigravity_cli"
  | "codex_cli"
  | "deterministic_fallback";
```

Antigravity 环境变量：

- `ANTIGRAVITY_CLI_BIN`，默认 `agy`
- `AGY_BIN`，兼容别名
- `ANTIGRAVITY_CLI_MODEL`
- `ANTIGRAVITY_CLI_MODEL_SIMPLE`
- `ANTIGRAVITY_CLI_MODEL_COMPLEX`
- `ANTIGRAVITY_CLI_MODEL_VISION`
- `ANTIGRAVITY_CLI_TIMEOUT_MS`

默认模型：

- simple：`Gemini 3.5 Flash (Medium)`
- complex：`Gemini 3.5 Flash (Medium)`，先不默认 Pro，避免成本和可用性问题
- vision：第一期不支持，标记为 `text_only`

- [ ] **Step C3: 实现 CLI 命令基础工具**

Create: `lib/ai/cli/cli-command.ts`

要求：

- 使用 `execFile` 或 `spawn`。
- 支持 timeout。
- 支持 maxBuffer。
- 不使用 shell。
- 返回 `{ stdout, stderr, exitCode }`。
- 支持读取诊断日志文件。

- [ ] **Step C4: 实现 Antigravity 客户端**

Create: `lib/ai/cli/antigravity-cli-client.ts`

命令格式：

```bash
agy --print "<prompt>" --print-timeout 60s --model "Gemini 3.5 Flash (Medium)" --log-file /tmp/offeryou-agy-xxx/agy.log --sandbox
```

实现要求：

- prompt 必须合并 systemPrompt 和 userPrompt。
- jsonMode 时 system prompt 加：`只返回合法 JSON，不要 Markdown，不要解释。`
- cwd 使用 `process.cwd()` 或 `OFFERYOU_CLI_CWD`。
- 不传 `--dangerously-skip-permissions`。
- 读取 `--log-file` 内容做诊断。
- 如果 stdout 为空，使用 stderr + log 生成失败原因。

诊断映射：

- auth required / not logged in：`auth_required`
- PlanModel / RequestedModel / valid model：`model_missing`
- bind operation not permitted：`local_port_blocked`
- EOF / failed to get model config：`network_or_model_config`
- timeout：`timeout`

- [ ] **Step C5: 写 Antigravity 单测**

Create: `tests/unit/ai/antigravity-cli-client.test.ts`

测试点：

- 参数数组包含 `--print`、`--model`、`--log-file`、`--sandbox`。
- 不包含 `--dangerously-skip-permissions`。
- 模型名可由 env 覆盖。
- log 中 auth 失败能返回明确错误。
- jsonMode 会加入 JSON-only 约束。

Run:

```bash
pnpm exec vitest run tests/unit/ai/antigravity-cli-client.test.ts
```

Expected: PASS。

- [ ] **Step C6: 接入 model-gateway**

Modify: `lib/ai/model-gateway.ts`

要求：

- `callProviderText("antigravity_cli", ...)` 调用 `callAntigravityCli(...)`。
- JSON 修复逻辑可以复用同一 provider。
- provider trace 中记录 `provider: "antigravity_cli"`。
- provider 失败时回到 deterministic fallback。

Run:

```bash
pnpm exec vitest run tests/unit/ai/model-gateway.test.ts tests/unit/ai/model-routing.test.ts tests/unit/ai/antigravity-cli-client.test.ts
```

Expected: PASS。

Commit:

```bash
git add lib/ai/model-provider-config.ts lib/ai/model-routing.ts lib/ai/model-gateway.ts lib/ai/cli/cli-command.ts lib/ai/cli/antigravity-cli-client.ts lib/ai/cli/cli-diagnostics.ts tests/unit/ai/model-routing.test.ts tests/unit/ai/model-gateway.test.ts tests/unit/ai/antigravity-cli-client.test.ts
git commit -m "feat: add Antigravity CLI model provider"
```

---

## 6. 阶段 D：新增 Codex CLI Provider

### 目标

新增 `codex_cli` provider，复用本机已授权 Codex CLI。第一期只作为高质量文本/结构化生成通道，不允许修改仓库。

- [ ] **Step D1: 写失败测试**

Create: `tests/unit/ai/codex-cli-client.test.ts`

测试点：

- 命令为 `codex exec`。
- 参数包含 `--sandbox read-only`。
- 参数包含 `--cd <workspace>`。
- 不包含 `--dangerously-bypass-approvals-and-sandbox`。
- 支持 `CODEX_CLI_MODEL_SIMPLE`、`CODEX_CLI_MODEL_COMPLEX`。
- 使用临时 `--output-last-message` 文件读取最终回答。

Run:

```bash
pnpm exec vitest run tests/unit/ai/codex-cli-client.test.ts
```

Expected: FAIL。

- [ ] **Step D2: 实现 Codex CLI 客户端**

Create: `lib/ai/cli/codex-cli-client.ts`

命令格式：

```bash
codex exec --cd /Users/wsyoung/Projects/OfferYou/github_release --sandbox read-only --model gpt-5.4-mini --output-last-message /tmp/offeryou-codex-xxx/last.txt "<prompt>"
```

实现要求：

- 默认 bin：`codex`，可由 `CODEX_CLI_BIN=/opt/homebrew/bin/codex` 覆盖。
- 默认 simple model：`gpt-5.4-mini`。
- 默认 complex model：`gpt-5.5`。
- prompt 必须明确：`只返回模型生成结果，不要修改文件，不要运行命令，不要给计划。`
- jsonMode 时要求合法 JSON。
- 优先读取 `--output-last-message` 文件；为空时回退 stdout。
- stderr 只作为诊断，不直接展示给用户。

- [ ] **Step D3: 扩展 routing/config**

Modify:

- `lib/ai/model-routing.ts`
- `lib/ai/model-provider-config.ts`
- `lib/ai/model-gateway.ts`

环境变量：

- `CODEX_CLI_BIN`
- `CODEX_CLI_MODEL`
- `CODEX_CLI_MODEL_SIMPLE`
- `CODEX_CLI_MODEL_COMPLEX`
- `CODEX_CLI_TIMEOUT_MS`

UI label：

- `Codex CLI`

Capability：

- `text_only`
- bestFor：`简历改写`、`面试回答优化`、`职业规划文本组织`
- limitations：`不直接读取图片`、`不允许在 provider 模式修改文件`

- [ ] **Step D4: 验证**

Run:

```bash
pnpm exec vitest run tests/unit/ai/codex-cli-client.test.ts tests/unit/ai/model-gateway.test.ts tests/unit/ai/model-routing.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS。

Commit:

```bash
git add lib/ai/cli/codex-cli-client.ts lib/ai/model-routing.ts lib/ai/model-provider-config.ts lib/ai/model-gateway.ts tests/unit/ai/codex-cli-client.test.ts tests/unit/ai/model-routing.test.ts tests/unit/ai/model-gateway.test.ts
git commit -m "feat: add Codex CLI model provider"
```

---

## 7. 阶段 E：Provider Center UI 同步

### 目标

个人中心和当前模型切换区能显示并选择 MiMo、Gemini API、Antigravity CLI、Codex CLI。

- [ ] **Step E1: 更新 API**

Modify: `app/api/model-provider/route.ts`

要求：

- 接受 provider：`openai_compatible`、`gemini`、`antigravity_cli`、`codex_cli`。
- 保存到 `model-provider-pref.json`。
- 不允许保存不可用 provider；返回明确原因。

- [ ] **Step E2: 更新 UI**

Modify:

- `components/me/model-provider-status-card.tsx`
- `components/layout/main-layout.tsx`，如果顶部模型切换只写死 MiMo/Gemini，需要改为配置驱动。

展示要求：

- MiMo
- Gemini API
- Antigravity CLI
- Codex CLI
- Fallback 只显示状态，不作为普通推荐选择。

- [ ] **Step E3: 测试**

Modify: `tests/unit/me/model-provider-status-card.test.tsx`

Run:

```bash
pnpm exec vitest run tests/unit/me/model-provider-status-card.test.tsx
```

Expected: PASS。

Commit:

```bash
git add app/api/model-provider/route.ts components/me/model-provider-status-card.tsx components/layout/main-layout.tsx tests/unit/me/model-provider-status-card.test.tsx
git commit -m "feat: expose desktop CLI providers in model center"
```

---

## 8. 阶段 F：Tauri 自用桌面壳

### 目标

第一期先做「本机自用桌面壳」：依赖本机 Node/pnpm，不追求离线可分发。点击 OfferYou.app 后启动本地 Next.js 服务并打开 Tauri 窗口。

- [ ] **Step F1: 安装 Tauri CLI**

Run:

```bash
pnpm add -D @tauri-apps/cli
```

Expected:

- `package.json` 和 `pnpm-lock.yaml` 更新。

- [ ] **Step F2: 新增 package scripts**

Modify: `package.json`

新增：

```json
{
  "desktop:dev": "tauri dev",
  "desktop:build": "tauri build",
  "desktop:check": "node scripts/desktop/wait-for-health.mjs"
}
```

- [ ] **Step F3: 新增 Tauri 配置**

Create: `src-tauri/tauri.conf.json`

要求：

- app name：`OfferYou`
- identifier：`com.offeryou.desktop`
- window title：`OfferYou`
- default URL：`http://127.0.0.1:3000`
- dev command：`pnpm dev --hostname 127.0.0.1 --port 3000`
- before build command：`pnpm build`
- icon 使用现有 OfferYou logo 资源，禁止白边放大。

- [ ] **Step F4: Rust 主进程启动本地服务**

Create: `src-tauri/src/main.rs`

要求：

- App 启动时检查 `http://127.0.0.1:3000` 是否可用。
- 不可用时启动 `scripts/desktop/start-next-server.mjs`。
- 设置环境变量：
  - `OFFERYOU_DESKTOP=1`
  - `OFFERYOU_STORAGE_DIR=<app data dir>/storage`
  - `OFFERYOU_CLI_CWD=/Users/wsyoung/Projects/OfferYou/github_release`
- 退出 App 时停止子进程。
- 日志写到 `<app data dir>/logs/offeryou-desktop.log`。

第一期允许依赖本机：

- `/opt/homebrew/bin/node`
- `/opt/homebrew/bin/pnpm`
- `/Users/wsyoung/.local/bin/agy`
- `/opt/homebrew/bin/codex`

但必须允许环境变量覆盖：

- `OFFERYOU_NODE_BIN`
- `OFFERYOU_PNPM_BIN`
- `ANTIGRAVITY_CLI_BIN`
- `CODEX_CLI_BIN`

- [ ] **Step F5: Node 启动脚本**

Create: `scripts/desktop/start-next-server.mjs`

要求：

- 使用 `child_process.spawn`。
- 命令：`pnpm dev --hostname 127.0.0.1 --port 3000`。
- 继承必要 env。
- 写日志。
- 不使用 shell。

Create: `scripts/desktop/wait-for-health.mjs`

要求：

- 轮询 `http://127.0.0.1:3000/me`。
- 30 秒超时。
- 成功打印 `OfferYou desktop server ready`。

- [ ] **Step F6: 验证开发桌面壳**

Run:

```bash
pnpm desktop:dev
```

Manual Expected:

- 打开 OfferYou 桌面窗口。
- 页面能进入 `/me`、`/master`、`/applications/new`。
- 保存/导出简历能写入桌面 storage。
- 关闭窗口后本地服务进程退出。

Commit:

```bash
git add package.json pnpm-lock.yaml src-tauri scripts/desktop
git commit -m "feat: add Tauri desktop shell"
```

---

## 9. 阶段 G：桌面 CLI Provider 真实 smoke test

### 目标

验证桌面环境下 Antigravity CLI 和 Codex CLI 都能通过 OfferYou provider gateway 返回结果。

- [ ] **Step G1: 新增 smoke 脚本**

Create: `scripts/desktop/smoke-cli-providers.mjs`

要求：

- 加载 `.env.local`。
- 依次调用：
  - `callModelText({ provider: "antigravity_cli", task: "interview", ... })`
  - `callModelText({ provider: "codex_cli", task: "rewrite", ... })`
- prompt 使用无敏感信息的短任务：
  - `请用一句中文回答：OfferYou 桌面版模型通道已连通。`
- 输出 provider、generationMode、前 80 字。
- 不打印 token、key、完整 env。

- [ ] **Step G2: 运行 smoke**

Run:

```bash
node --experimental-transform-types --import ./scripts/register-alias.mjs scripts/desktop/smoke-cli-providers.mjs
```

Expected:

- Antigravity CLI 返回中文短句。
- Codex CLI 返回中文短句。
- 若失败，错误必须明确到 auth、model、timeout、local_port、network_or_model_config。

- [ ] **Step G3: 桌面 UI 切换验证**

Manual:

- 打开 `http://localhost:3000/me` 或 Tauri 窗口。
- 切到 Antigravity CLI。
- 在面试准备或天赋发掘触发一次轻量生成。
- 切到 Codex CLI。
- 触发一次简短文本优化。

Expected:

- UI 不显示「模型不可用」的空泛错误。
- 失败时显示具体原因。
- fallback 不冒充 AI 输出。

Commit:

```bash
git add scripts/desktop/smoke-cli-providers.mjs
git commit -m "test: add desktop CLI provider smoke test"
```

---

## 10. 阶段 H：可分发桌面包，第二期再做

第一期完成后不要立刻强行做可分发包。第二期再处理：

- Next.js `output: "standalone"`。
- 打包 `.next/standalone`。
- 打包 Node runtime 为 Tauri sidecar。
- 不依赖用户机器安装 pnpm。
- macOS 签名、公证、自动更新。
- 数据迁移与备份。

第二期验收命令：

```bash
pnpm build
pnpm desktop:build
open src-tauri/target/release/bundle/macos/OfferYou.app
```

---

## 11. 总体验证清单

每个阶段后至少运行：

```bash
pnpm exec tsc --noEmit
pnpm run check:vnext
```

最终运行：

```bash
pnpm test
pnpm exec vitest run tests/integration/export/resume-export-service.test.ts --pool forks --maxWorkers 1
pnpm run test:pdf
```

浏览器 / 桌面手动验收：

- `/` 首页可打开。
- `/me` 个人中心可打开，简历版本可查看、可继续修改。
- `/master` 资料库可打开，成品简历可查看。
- `/applications/new` 能创建/上传/优化简历。
- `/prep` 能查看和新增面试准备。
- `/talent` 能进入天赋发掘。
- 切换 MiMo / Gemini API / Antigravity CLI / Codex CLI 后，Provider Center 状态真实。
- 桌面 App 关闭后不遗留 Next.js 子进程。

---

## 12. 回滚策略

- Provider 层出问题：把 `DEFAULT_MODEL_PROVIDER` 改回 `openai_compatible`。
- Antigravity CLI 出问题：隐藏 `antigravity_cli` provider，不影响 MiMo/Gemini。
- Codex CLI 出问题：隐藏 `codex_cli` provider，不影响 MiMo/Gemini。
- Tauri 壳出问题：继续用 `pnpm dev` + 浏览器，不影响 Web 产品。
- 存储路径出问题：恢复 `OFFERYOU_STORAGE_DIR` 为空，回到项目 `storage/`。

---

## 13. 禁止事项

- 禁止使用 `--dangerously-bypass-approvals-and-sandbox` 接入 Codex provider。
- 禁止使用 `--dangerously-skip-permissions` 接入 Antigravity provider。
- 禁止让 CLI provider 直接修改仓库文件。
- 禁止把用户简历、面试记录、API key 打进日志。
- 禁止提交 `.env.local`、`storage/`、`.next/`、`node_modules/`、导出 PDF、SQLite 数据库。
- 禁止改动 `components/preview/template-professional-cn.tsx` 和 `components/preview/template-ats-clean.tsx` 的视觉。
