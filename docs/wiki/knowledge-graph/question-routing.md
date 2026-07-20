# 项目问题路由

这份路由表用于把自然语言问题快速落到正确证据。它不是产品里的关键词路由，也不参与用户意图判断；它只帮助开发者和 AI Agent 在回答问题时减少无关文件搜索。

## 先判断问题层级

| 用户实际在问 | 第一站 | 第二站 | 常见误区 |
| --- | --- | --- | --- |
| “我应该怎么操作？” | `docs/public/` 对应页面 | 前端路由和当前 UI | 直接拿内部 service 名解释给用户 |
| “它到底支不支持？” | [能力目录](./capability-catalog.md) | 当前代码、schema、路由 | 把计划、截图或 release note 当实现证据 |
| “为什么卡住/失败？” | 任务中心、导演跟进、运行日志 | workflow + debugging Wiki | 页面没更新就认定后台已停止 |
| “为什么要这样设计？” | 对应 Wiki | 设计文档、AGENTS 最高优先级规则 | 只描述当前代码，没有解释决策原因 |
| “数据保存在哪？” | Prisma schema 和服务端写入链 | 对应 runtime/state Wiki | 把聊天上下文当长期事实 |
| “该改哪个文件？” | 能力目录里的所有者 | facade、HTTP 入口、调用方 | 从旧 route 或深层内部文件复制另一套逻辑 |
| “这是官方还是我们加的？” | [来源与定制边界](./provenance.md) | Git diff、commit、NOTICE | 凭功能名称或记忆猜来源 |

## 创作和产品问题

| 示例问题 | 读取顺序 | 回答必须包含 |
| --- | --- | --- |
| 第一次怎么从灵感写到第一章？ | `public/playbook/first-novel-walkthrough.md` → 端到端生产链 → 自动导演 | 推荐模式、关键确认点、可恢复位置 |
| Creative Hub 和自动导演有什么区别？ | Creative Hub 边界 → 自动导演 Runtime | 中枢/控制入口与重型生产事实源的边界 |
| 为什么聊天里说过的设定后文没遵守？ | 项目总手册第 5 节 → RAG/上下文组装 | 对话不是长期事实；要落到书契约、世界、角色或 Creative Decision |
| 怎么修改第 N 章的一段？ | 项目总手册第 4 节 → 章节编辑器代码 | 选区/整章、候选 diff、快照、影响分析 |
| 能不能自动写几十或几百章？ | 项目总手册第 7 节 → 自动导演 → 章节生产链 | 分层规划、逐章提交、恢复点、模型/额度边界 |
| 局部质量问题会不会让整本任务停掉？ | 章节生产链 → Auto-Director Quality Gate Rules | 质量债务继续与明确 replan 停止的区别 |
| 整书审校会自动改正文吗？ | 整书质量闭环 | 报告、用户采用、Creative Decision、批量润色四个边界 |
| 世界库、本书世界和世界切片有什么区别？ | 世界上下文 Gateway → 新手优先产品原则 | 可复用样本、本书事实副本、按任务裁剪的运行上下文 |
| 基础角色库和本书角色有什么区别？ | 角色相关 Wiki → 项目总手册第 5 节 | 跨书模板与当前小说正史事实的边界 |

## 自动导演与恢复问题

| 现象 | 先看 | 再查 | 不应做 |
| --- | --- | --- | --- |
| 页面刷新后进度像丢了 | 任务中心、导演跟进 | `NovelWorkflowTask`、runtime snapshot、URL 中 director task id | 用 `workspaceTaskId` 冒充导演任务 id |
| 任务显示等待 | checkpoint 类型和 payload | auto-approval、follow-up action | 把正常确认点当失败 |
| 服务重启后没有继续 | `DirectorRunCommand` 状态与租约 | stale lease recovery、worker 日志 | 直接重跑整本造成重复写入 |
| 一章修复失败后整本停了 | structured action/recommendedAction | 质量债务投影与 pipeline 状态 | 把所有审核问题都映射成 replan |
| 正文已存在但同步失败 | 章节 runtime package、artifact sync checkpoint | side-effect job 和回灌服务 | 先重写正文再说 |
| URL 没有 directorTaskId 时任务入口消失 | 最新书级任务投影 | AI cockpit、task drawer、recovery selector | 只按 URL 参数过滤失败/阻塞任务 |

首选文档：

- [自动导演 Runtime 与恢复边界](../workflows/auto-director-runtime.md)
- [自动导演阶段检查清单](../workflows/auto-director-stage-checklist.md)
- [按阶段恢复手册](../../public/playbook/recovery-by-phase.md)
- [重复故障模式](../debugging/recurring-failure-modes.md)

## 章节生产与一致性问题

| 现象 | 先查资产 | 再查实现 | 相关文档 |
| --- | --- | --- | --- |
| 本章偏离任务单 | 章节目标、场景卡、mustAdvance/mustPreserve | writer context、审核 obligations | [章节生产链](../workflows/chapter-production-chain.md) |
| 人物突然知道不该知道的信息 | `InformationState`、角色硬事实、章节参与者 | Generation Context Assembler | [角色硬事实排查](../debugging/character-continuity-hard-facts.md) |
| 物品/能力凭空出现 | 角色资源账本与待确认提案 | resource ledger context 与审核 | [角色资源账本](../workflows/character-resource-ledger.md) |
| 伏笔被忘或提前揭露 | `PayoffLedgerItem`、本章 operation | payoff context、artifact delta | [Payoff Ledger](../workflows/payoff-ledger-contract.md) |
| 时间顺序错误 | timeline event、chapter anchor、constraint report | timeline 模块 | [时间线约束层](../workflows/timeline-constraint-layer.md) |
| 小问题被当成全局失败 | audit action、quality debt、replan flag | acceptance/repair/finalization projection | [质量债务归因](../workflows/quality-debt-attribution.md) |
| 章节已写完但下一章仍拿到旧状态 | artifact sync checkpoint、side-effect job | chapter aftermath、state sync | [章节 Runtime 边界](../architecture/chapter-runtime-boundaries.md) |

## 模型、协议和 Prompt 问题

| 现象 | 第一检查 | 第二检查 | 规则 |
| --- | --- | --- | --- |
| 模型列表获取失败 | BaseURL、`/models` 与 `/v1/models`、权限 | 是否允许手填模型 id | 模型目录失败不等于正文端点失败 |
| 普通调用成功，结构化失败 | probe 的结构化策略和错误分类 | Prompt schema、模型能力 | 不能显示成全部正常 |
| 选 Responses 却请求 Chat | 任务路由显式覆盖 | 厂商默认协议、统一 LLM 工厂 | 显式协议失败不跨端点偷换 |
| Responses 流报 `undefined.map` | 是否缺 `output`/`annotations` | compatibility normalizer | 只修响应外形，不伪造丢失内容 |
| Prompt 输出漏字段 | promptId/version、schema、上下文块 | repair/semantic retry telemetry | 修 AI schema/上下文，不加关键词兜底 |
| 新业务 prompt 散落在 service | Prompt Registry 是否登记 | PromptAsset、contextPolicy、outputSchema | 新产品 Prompt 只能从 `server/src/prompting/` 进入 |
| 意图识别漏判 | planner intent Prompt 与工具目录 | structured output 和输入上下文 | 禁止加正则/关键词路由隐藏问题 |

首选文档：

- [LLM 请求协议](../architecture/llm-request-protocols.md)
- [Prompt Registry 与结构化输出](../prompts/prompt-registry-and-structured-output.md)
- `server/src/prompting/README.md`

## RAG、拆书和写法问题

| 现象 | 先看 | 再看 |
| --- | --- | --- |
| 文档上传了但没有召回 | 文档状态、索引任务、binding | Qdrant、facet、retrieval trace |
| 拆书结论没有影响正文 | 是否发布为知识文档/写法资产 | 绑定、召回阶段、context group |
| 同一文档重复向量 | chunk hash、索引版本 | Qdrant 写入与重建任务 |
| 写法绑定了但正文不像 | StyleBinding、启用特征、编译结果 | writer context 与 style review |
| RAG 内容覆盖本书事实 | 资料来源分层和优先级 | Context Broker 组装顺序 |

首选文档：

- [知识库与上下文组装](../rag/knowledge-and-context-assembly.md)
- [知识与 RAG 召回链](../../public/flow/knowledge-and-rag.md)
- [拆书工作流](../workflows/book-analysis-workflow.md)

## 数据、桌面和环境问题

| 问题 | 第一站 | 关键边界 |
| --- | --- | --- |
| SQLite 与 PostgreSQL 行为不一致 | 两套 schema 和同名迁移 | 所有字段/迁移必须成对维护 |
| 想重置数据库 | 数据保护规则 | 未明确批准、未备份和未验证备份时禁止执行 |
| 桌面版找不到旧数据 | desktop import/runtime path | 只读识别后备份、复制、验证，不能删除原库 |
| 桌面包如何发布 | desktop package version、tag、workflow | `desktop/package.json` 与 `vX.Y.Z` 必须严格一致 |
| API Key 是否会暴露 | secret store、settings response、日志 | 客户端只看是否已配置，日志不得出现明文 Key |

## 回答模板

面对一般项目疑问，回答尽量包含四部分：

1. 结论：当前是否支持、真实状态或最可能原因。
2. 证据：对应资产、任务状态、源码入口或稳定 Wiki。
3. 边界：哪些情况不成立，是否需要用户确认、模型能力或运行数据。
4. 下一步：用户应该打开哪个入口，或开发者应该检查哪个所有者。

如果问题涉及当前数据库、日志或任务状态，应先检查实际环境再回答；知识图谱只能告诉我们去哪里查，不能替代现场事实。
