# 来源与定制边界

## 核对基线

2026-07-20 核对结果：

| 对象 | 证据 | 当前结论 |
| --- | --- | --- |
| 官方公开文档 | <https://explosivecoderflome.github.io/AI-Novel-Writing-Assistant/docs> | 公开站点包含 33 篇文档，目录与当前仓库 `docs/public/`、`site` 文档清单一致 |
| 官方仓库默认分支 | `ExplosiveCoderflome/AI-Novel-Writing-Assistant` 的 HEAD | `main` 指向 `4f4def1d` |
| 当前 fork 官方镜像 | 当前仓库 `origin/main` | 同样指向 `4f4def1d`，可作为本轮官方基线 |
| 定制业务基线 | 知识图谱提交前的 `novel-custom` | `31ca22c2`，已合并官方基线 |
| 业务定制差异 | `git diff origin/main...31ca22c2` | 15 个提交、102 个文件、3495 行新增、93 行删除；不包含知识图谱自身文档提交 |

因此，本轮不需要凭网页文案猜测“官方有什么”。官方主线 commit、当前分支的共同祖先和三点 diff 可以直接给出可审计边界。

## 当前可确认的定制能力

### 1. 文本请求协议扩展

相关提交：

- `194fd59f`：增加 Responses API 协议支持。
- `132eba6e`：统一自动探针行为。
- `6dd525b4`：归一化缩减版 Responses 流事件。
- `b29a4382`：兼容 BaseURL 根路径与 `/v1` 路径。
- `0a16ab70`：隔离模型路由连接错误。

当前能力包括：

- 显式选择 `openai_responses`、`openai_compatible` 或 `anthropic`；
- 厂商默认协议、任务路由覆盖和调用级协议的优先级；
- Responses 普通、流式和结构化输出适配；
- 兼容只返回 delta 或缺少 `annotations` 的网关；
- `/models`、`/responses`、`/chat/completions` 对版本根路径的有限兼容；
- 显式协议失败时不自动跨协议重放正式写作请求。

稳定规则见[LLM 请求协议](../architecture/llm-request-protocols.md)。

### 2. 整书质量闭环

核心提交：`0b595767`。

当前能力包括：

- lead / major / named / extra 角色重要度；
- 按章节证据生成书级质量报告；
- 报告与运行时事实分离；
- 用户采用建议后通过 Creative Decision 进入后续上下文；
- 批量润色复用现有章节 pipeline、快照、恢复和质量债务边界；
- 统一资产中心入口的定制导航与聚合页。

稳定规则见[整书质量闭环](../workflows/whole-book-quality-loop.md)。

### 3. 定制版维护知识

定制分支新增了以下长期维护文档：

- [定制分支与上游同步规则](../architecture/customization-branch-sync.md)
- [LLM 请求协议](../architecture/llm-request-protocols.md)
- [项目总手册](../project-handbook.md)
- [整书质量闭环](../workflows/whole-book-quality-loop.md)

这些文档不是独立产品功能，但它们定义了定制版继续接收官方更新时必须保留的行为。

## 官方主线中已存在的能力

以下重要能力已经存在于核对时的官方主线，因此在当前分支中不能标成“本 fork 新增”：

- 自动导演、checkpoint、auto-approval、恢复和导演跟进；
- Creative Hub、Planner、Tool Registry 和 Agent Runtime；
- 章节生成、审核、修复、质量债务和状态回灌；
- 世界、角色、卷规划、节奏板、章节任务单和伏笔账本；
- RAG、拆书、写法引擎、反 AI 规则和 Prompt 工作台；
- 角色思路线、角色对话、影响提案和视觉资产目录；
- 短剧和漫画衍生工坊；
- SQLite / PostgreSQL 双 schema、Windows 桌面版和公开文档站。

即使其中某些能力在更早历史里曾从其他分支或仓库移植，只要当前可验证官方主线已经包含它们，本知识图谱首先把它们标为“当前官方基线”。“最初是谁写的、来自哪个仓库”是另一类来源问题，需要独立证据。

## 历史移植记录的证据边界

仓库存在 `docs/superpowers/plans/2026-04-25-lucky-beta-selective-port.md`，其中计划从 `lucky` 分支选择性移植：

- SQLite / PostgreSQL 双数据库支持；
- 企业微信 / 钉钉导演跟进通道；
- 仍适用的修复。

但这份文件不能单独证明外部来源，原因是：

- 它只写了 `lucky` 分支名，没有外部仓库 URL、版本、commit 或许可证；
- 除分支盘点外，主要实现步骤仍是未勾选状态；
- 当前本地 Git 引用中已经没有 `lucky`、`beta` 或 `lucky-beta`，无法仅凭现有 refs 复原完整移植链；
- `NOTICE` 只记录本项目的 AGPL-3.0-only 与商业授权说明，没有列出这些能力的第三方来源。

所以当前只可记录为“历史移植候选，来源待核实”，不能写成“确定来自某开源仓库”。如果后续找到原仓库或保留的分支，应补齐：

| 必填证据 | 说明 |
| --- | --- |
| 仓库 URL | 可公开访问或内部可审计的来源地址 |
| commit/tag | 精确到被移植的版本 |
| 许可证 | 许可证名称、文件和是否要求署名/披露修改 |
| 落地范围 | 对应本仓库模块、文件或能力家族 |
| 改造说明 | 保留了什么、替换了什么、当前维护者是谁 |
| Git 关系 | cherry-pick、merge、文件级重构或重新实现 |

## 判断来源的固定流程

1. 先确认当前官方主线 commit，不用网页发布时间代替 Git 基线。
2. 用三点 diff 比较 `origin/main...novel-custom`，识别当前定制差异。
3. 查看相关提交、merge 双亲和文件历史，确认功能是新增、同步还是冲突重建。
4. 查看 `NOTICE`、`LICENSE`、PR 和设计文档中的来源记录。
5. 只有计划没有实现证据时，标记“计划过/待核实”。
6. 只有代码相似但没有来源证据时，不推断抄录或移植关系。
7. 上游后来吸收同类能力时，分别记录“当前官方基线”和“历史最初来源”，不要混为一谈。

## 上游同步后的刷新检查

每次把新 `main` 合并进 `novel-custom` 后：

1. 更新本页的官方主线和定制分支 HEAD。
2. 重跑定制提交数、文件数和增删行统计。
3. 检查本页“定制能力”是否已经被官方主线吸收。
4. 检查冲突解决是否保留协议、整书质量、角色重要度和资产入口。
5. 更新[能力目录](./capability-catalog.md)的来源标签。
6. 如果引入第三方能力，补齐 URL、commit、许可证和落地范围。
