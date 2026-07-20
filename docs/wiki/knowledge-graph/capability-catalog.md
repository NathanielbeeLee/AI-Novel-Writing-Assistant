# 能力目录

本表把“用户能做什么”映射到页面入口、服务端所有者、长期资产和说明文档。来源标签只描述相对当前官方主线的关系：

- `官方`：存在于核对时的官方主线 `4f4def1d`。
- `定制`：只存在于 `novel-custom` 相对官方主线的差异中。
- `混合`：官方能力仍是主体，但当前分支增加了定制行为。
- `历史来源待核实`：仓库出现移植计划，但缺少可验证的外部仓库与完成证据。

## 创作主链

| 能力 | 用户用途 | 前端入口 | 服务端/资产所有者 | 来源 | 深入阅读 |
| --- | --- | --- | --- | --- | --- |
| 自动导演开书 | 从一句灵感得到方向候选、标题、书级规划并继续执行 | `/novels/auto-director` | `services/novel/director/`、`NovelWorkflowTask`、`DirectorRunCommand` | 官方 | [自动导演阶段全景](../../public/flow/auto-director-pipeline.md) |
| 创作中枢 | 讨论创意、理解进度、调用受控工具推进主链 | `/creative-hub` | `creativeHub/`、`agents/`、`graphs/` | 官方 | [Creative Hub 边界](../workflows/creative-hub-boundary.md) |
| 项目设定与书契约 | 固化受众、卖点、前 30 章承诺和硬边界 | `/novels/:id/edit` | novel setup/planning、`BookContract`、`StoryMacroPlan` | 官方 | [端到端生产链](../../public/flow/end-to-end-production.md) |
| 本书世界 | 导入、生成或维护当前小说实际使用的世界副本 | 小说编辑页、本书世界工作区 | `modules/setup/world/`、`NovelWorld`、`WorldContextGateway` | 官方 | [世界上下文 Gateway](../architecture/world-context-gateway.md) |
| 角色准备 | 生成阵容、关系和角色职责 | 小说编辑页角色准备 | `modules/novel/characters/`、`Character`、候选与关系模型 | 混合 | [角色工作流目录](../README.md#workflows) |
| 角色重要度 | 区分 lead、major、named、extra，控制长篇上下文优先级 | 角色档案/焦点摘要 | `characterImportance.ts`、`Character.importanceTier` | 定制 | [整书质量闭环](../workflows/whole-book-quality-loop.md) |
| 卷战略与卷骨架 | 把全书拆为可持续推进的卷级任务 | 小说编辑页卷工作区 | novel planning/volume、`VolumePlanVersion` | 官方 | [分卷规划](../workflows/volume-planning.md) |
| 节奏板与拆章 | 从节奏节点得到章节清单和任务单 | 小说编辑页节奏/拆章 | novel planning、`PlotBeat`、`VolumeChapterPlan`、`StoryPlan` | 官方 | [端到端生产链](../../public/flow/end-to-end-production.md) |
| 章节执行 | 生成正文、审核、修复、保存并回灌 | `/novels/:id/edit` 章节执行区 | novel production/runtime、`Chapter`、`GenerationJob` | 官方 | [章节执行链](../../public/flow/chapter-execution.md) |
| 章节编辑器 | 对整章或选区生成候选、比较 diff、应用并留快照 | `/novels/:id/chapters/:chapterId` | chapter editor、`NovelSnapshot` | 官方 | [项目总手册第 4 节](../project-handbook.md#4-如何指定某章或某段让-ai-修改) |
| 自动质量循环 | 审核、局部修复、降级完成、质量债务和重规划 | 章节执行、任务中心、导演跟进 | novel quality/runtime、`QualityReport`、`AuditReport` | 官方 | [章节生产链](../workflows/chapter-production-chain.md) |
| 整书审校与批量润色 | 找跨章节人设、因果、节奏和伏笔问题，确认后回灌并按范围润色 | 小说编辑页整书审校 | `modules/novel/quality/`、书级 `QualityReport`、`CreativeDecision` | 定制 | [整书质量闭环](../workflows/whole-book-quality-loop.md) |

## 长篇一致性与角色系统

| 能力 | 用户用途 | 关键资产/所有者 | 来源 | 深入阅读 |
| --- | --- | --- | --- | --- |
| 状态回灌 | 把正文中的事实、角色、关系和信息边界带到后文 | `StoryStateSnapshot`、`CharacterState`、`RelationState`、`InformationState` | 官方 | [章节执行链](../../public/flow/chapter-execution.md) |
| 伏笔与兑现账本 | 跟踪铺设、触达、部分揭示、兑现、逾期和禁止提前揭露 | `ForeshadowState`、`PayoffLedgerItem`、`services/payoff/` | 官方 | [Payoff Ledger](../workflows/payoff-ledger-contract.md) |
| 时间线约束 | 约束事件顺序、章节时间锚点和时间冲突 | `StoryTimelineEvent`、`ChapterTimeAnchor`、`TimelineConstraint` | 官方 | [时间线约束层](../workflows/timeline-constraint-layer.md) |
| 角色资源账本 | 管理角色持有物、能力、代价和待确认变化 | `CharacterResourceLedgerItem`、`CharacterResourceEvent` | 官方 | [角色资源账本](../workflows/character-resource-ledger.md) |
| 角色思路线 | 保存角色当前理解、意图与可能误判，辅助后文 | `CharacterMindSnapshot` | 官方 | [角色智能层](../workflows/character-intelligence-layer.md) |
| 角色对话与影响提案 | 让作者试探角色；确认后的影响作为有限范围软引导 | 对话、影响提案相关模型与服务 | 官方 | [角色对话层](../workflows/character-dialogue-layer.md) |
| 事实账本 | 固化不可被后文随意改写的小说事实 | `NovelFactEntry`、hard facts 服务 | 官方 | [角色硬事实排查](../debugging/character-continuity-hard-facts.md) |

## 知识、写法与资产

| 能力 | 用户用途 | 前端入口 | 服务端/资产所有者 | 来源 | 深入阅读 |
| --- | --- | --- | --- | --- | --- |
| 知识库与 RAG | 上传、索引、绑定和检索外部资料 | `/knowledge` | knowledge/rag、`KnowledgeDocument`、`KnowledgeChunk`、Qdrant | 官方 | [知识与 RAG 召回链](../../public/flow/knowledge-and-rag.md) |
| 拆书 | 从参考作品提取结构、人物、写法和证据并发布为资产 | `/book-analysis` | `services/bookAnalysis/`、`BookAnalysis*` | 官方 | [拆书工作流](../workflows/book-analysis-workflow.md) |
| 写法引擎 | 提取、组合、绑定和试写风格资产 | `/style-engine` | style engine、`WritingFormula`、`StyleProfile`、`StyleBinding` | 官方 | [写法引擎公开说明](../../public/modules/style-engine.md) |
| 反 AI 规则 | 约束模板感、解释感和空泛表达 | `/anti-ai-rules` | `AntiAiRule`、style binding | 官方 | [反 AI 规则](../../public/modules/anti-ai-rules.md) |
| Prompt 工作台 | 查看和维护产品级 Prompt、上下文槽位与模板 | `/prompt-workbench` | `server/src/prompting/`、Prompt override 模型 | 官方 | [Prompt Registry](../prompts/prompt-registry-and-structured-output.md) |
| 统一资产中心 | 聚合文字资产和视觉资源入口，不改变各业务资产所有权 | `/assets` | `AssetCenterPage`、`VisualAssetProjection` | 混合 | [视觉资源目录](../architecture/visual-asset-catalog.md) |
| 图像生成确认 | 在消耗图片额度前显示明确确认，并统一保存任务和资产 | 多个视觉生成入口 | image runtime、`ImageGenerationTask`、`ImageAsset` | 官方 | [图片生成确认](../workflows/image-generation-confirmation-runtime.md) |

## 自动化、模型和运行基础

| 能力 | 用户用途 | 关键所有者 | 来源 | 深入阅读 |
| --- | --- | --- | --- | --- |
| 任务中心 | 查看排队、执行、失败、恢复和归档状态 | `/tasks`、`services/task/`、`TaskCenterArchive` | 官方 | [任务中心职责](../product/task-center-role.md) |
| 导演跟进 | 查看 checkpoint、暂停原因、自动审批、通知和恢复动作 | `/auto-director/follow-ups` | follow-up routes/services/logs | 官方；历史来源待核实 | [导演跟进公开说明](../../public/modules/director-follow-up.md) |
| AI 实况 | 展示当前模型调用、校验和修复过程，但不替代正式任务状态 | llm live、前端 live execution | 官方 | [LLM 实况](../workflows/llm-live-execution.md) |
| 模型路由 | 按规划、正文、审核、修复等任务选择模型 | `/settings/model-routes`、`llm/modelRouter.ts` | 混合 | [模型选择](../architecture/model-selection.md) |
| Responses / Chat / Anthropic 协议 | 显式选择文本请求协议，兼容标准和缩减 Responses 流 | `server/src/llm/protocols/`、厂商设置 | 定制 | [LLM 请求协议](../architecture/llm-request-protocols.md) |
| SQLite / PostgreSQL | 本地默认 SQLite，服务部署可用 PostgreSQL，双 schema 同步维护 | Prisma 双 schema、database config | 官方；历史来源待核实 | [配置约定](../architecture/configuration-conventions.md) |
| Windows 桌面版 | 本地启动服务、客户端、数据库、升级和打包 | `desktop/` | 官方 | [桌面版本规则](../workflows/desktop-release-versioning.md) |

## 衍生工坊

| 能力 | 用户用途 | 关键所有者 | 来源 | 深入阅读 |
| --- | --- | --- | --- | --- |
| 短剧工作台 | 把小说或导入素材整理成短剧、分集、镜头、音频和视频任务 | `/drama`、`services/drama/`、`Drama*` 模型 | 官方 | [短剧工作台](../workflows/short-drama-workspace.md) |
| 漫画工作台 | 从小说资产生成漫画项目、角色视觉资产、场景和分镜 | `/comic`、`services/comic/`、`Comic*` 模型 | 官方 | [漫画场景一致性](../workflows/comic-scene-consistency.md) |

## 读表原则

- “有页面”不等于“任务已完成”；运行事实以服务端任务、checkpoint 和持久化产物为准。
- “存在模型字段”不等于该模型适合所有任务；协议可用、结构化输出稳定和长文本质量要分别验证。
- “报告已生成”不等于建议已进入后续上下文；整书审校建议必须经用户采用。
- “历史计划写了移植”不等于可以确认外部来源或完成状态；来源判断必须回到 Git、许可证和当前代码。
