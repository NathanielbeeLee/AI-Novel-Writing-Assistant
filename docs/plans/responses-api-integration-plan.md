# Responses API 与 Chat Completions 双协议接入计划

## 1. 目标

在不破坏现有 OpenAI-compatible Chat Completions 和 Anthropic 调用的前提下，为文本模型增加可显式选择的 OpenAI Responses API，并让 CLIProxyAPI 一类网关可以通过一组 `BaseURL + API Key + 模型名` 完成接入。

本计划覆盖普通调用、流式调用、结构化输出、模型目录、连通性探针、厂商配置、任务模型路由、迁移、测试和长期文档。完成后，协议不再由模型名称或 LangChain 内部启发式隐式决定。

## 2. 当前代码事实

- 自定义厂商已经支持保存 BaseURL、API Key、默认模型，并通过 `GET {BaseURL}/models` 自动读取 OpenAI 风格模型目录；接口不提供模型列表时仍可手动填写。
- 任务模型路由已经有 `auto / openai_compatible / anthropic` 协议字段，但 `factory.ts` 最终只会创建 Chat Completions 或 Anthropic 客户端，`auto` 不会尝试 Responses。
- 当前 LangChain `ChatOpenAI` 的 `useResponsesApi: false` 不是强制关闭：部分模型名、工具或 Responses 专用参数仍会触发 Responses。仅在构造参数上增加布尔值无法保证 Chat Completions 兼容。
- 普通调用、流式调用和结构化调用都从统一 LLM 工厂创建客户端；结构化输出另有策略探针和 JSON 修复链。
- CLIProxyAPI 提供 `/v1/models`、`/v1/chat/completions` 与 `/v1/responses`，因此项目 BaseURL 应填写到 `/v1`，模型目录可复用现有实现。

## 3. 设计决策

### 3.1 协议枚举

保留已有持久值并新增：

| 持久值 | 含义 |
| --- | --- |
| `auto` | 继承厂商设置；厂商也为自动时保持旧行为，使用 Chat Completions |
| `openai_responses` | 强制请求 `POST /responses` |
| `openai_compatible` | 强制请求 `POST /chat/completions` |
| `anthropic` | 使用 Anthropic Messages 兼容调用 |

不把 `openai_compatible` 重命名为新持久值，避免破坏已有数据库记录和前后端 contract；界面将明确显示为“Chat Completions（OpenAI 兼容）”。

### 3.2 配置优先级

有效协议按以下优先级解析：

1. 调用方或任务模型路由的显式协议；
2. 厂商级默认协议；
3. 兼容性默认值 Chat Completions。

`auto` 表示继续向下一层继承。这样 CLIProxyAPI 只需在厂商配置中选择一次 Responses，各任务路由保持 `auto` 即可；个别任务仍能单独强制 Chat Completions。

### 3.3 强制路由

新增协议绑定的 OpenAI 客户端适配器，覆盖 LangChain 的协议选择钩子：

- Responses 模式始终返回 `true`；
- Chat Completions 模式始终返回 `false`；
- 不依据模型名、工具类型或 LangChain 默认启发式改变协议。

Responses 请求启用 `store: false` 对应的 LangChain 零数据保留开关。小说项目自己的上下文、章节和运行状态仍由本项目数据库管理，不依赖远端 response id 保存会话。

### 3.4 结构化输出与流式输出

- 继续使用统一的 LangChain message/result 抽象，避免业务服务直接处理两种供应商 JSON。
- Responses 的 `max_output_tokens`、文本 output item、usage 与 SSE 事件由 LangChain 适配层转换。
- 现有 `toText`、流式 content block 提取和 token usage 提取必须用针对 Responses 的测试覆盖。
- 结构化策略仍按 `json_schema -> json_object -> prompt_json` 能力探针降级；协议选择和结构化格式选择是两个独立维度。

### 3.5 自动探针规则

- 用户显式选择某协议时，只测试该协议，失败必须如实显示，不能静默用另一协议冒充成功。
- 任务路由为 `auto` 时，先测试厂商级有效协议；厂商仍为 `auto` 时先保持 Chat Completions 兼容，再尝试 Responses 和 Anthropic。
- 连通性结果必须返回实际协议；任务路由现有的探针结果持久化行为保持可追踪。

## 4. 实施阶段

### Phase A：共享 contract 与持久化

- 在 shared 协议枚举中加入 `openai_responses`。
- 在 PostgreSQL、SQLite Prisma schema 的 `APIKey` 增加 `requestProtocol`，默认 `auto`。
- 新增两个数据库的纯加列迁移，不执行重置、删表或数据重写。
- 扩展 SecretStore、ProviderSecret、设置 API 状态与写入 payload。

验收：旧记录自动得到 `auto`；现有配置无需手工迁移即可继续使用 Chat Completions。

### Phase B：LLM 工厂与协议适配

- 把协议解析拆成可测试的纯函数。
- 新增协议绑定客户端，强制区分 `/responses` 与 `/chat/completions`。
- Responses 设置 `store: false`；Chat 和 Anthropic 保持现有参数与限流、日志、用量统计装饰链。
- 日志元数据增加实际请求协议，方便排查网关路径。

验收：即使模型名会触发 LangChain Responses 偏好，显式 Chat 仍只请求 Chat Completions。

### Phase C：探针、模型目录与服务端接口

- 连通性接口接受并返回新增协议。
- 显式协议测试不再跨协议回退；自动模式遵循厂商设置和兼容顺序。
- 保留现有 `/models` 自动获取与手动模型名兜底，并为 CLIProxyAPI 响应格式增加 contract 测试。
- 自定义厂商创建、编辑和卡片测试都传递实际协议。

验收：CLIProxyAPI 的 BaseURL、Key、模型列表、普通探针和结构化探针形成完整闭环。

### Phase D：设置界面与任务路由

- 厂商配置弹窗新增请求协议选择，说明 Responses、Chat Completions 与自动模式的差异。
- 模型路由协议列表新增 Responses，并保留每任务覆盖能力。
- 连接测试结果显示实际协议，避免只显示“成功”却不知道走了哪个端点。
- 卡片高级信息显示当前厂商协议。

验收：用户不需要编辑环境变量或数据库即可切换协议，且能够看见当前有效选择。

### Phase E：验证

- 纯函数测试：枚举归一化、路由优先级、旧配置默认值。
- mock HTTP 集成测试：断言 Responses 请求命中 `/v1/responses`，Chat 请求命中 `/v1/chat/completions`，模型目录命中 `/v1/models`。
- 覆盖普通非流式、流式、结构化输出及 usage 提取。
- 运行 Prisma generate、shared/server/client typecheck、目标测试和生产构建中与改动相称的最小集合。
- UI 交互验收按仓库规则交给用户本地执行，并提供 CLIProxyAPI 检查步骤。

### Phase F：文档与交付

- 新增一份面向未来开发者和 AI Agent 的整体项目手册，覆盖产品主链、代码地图、配置、运行、数据、常见问题与安全边界。
- 新增协议架构 Wiki，记录协议优先级、强制路由原因、探针和排障规则。
- 更新公开系统设置 / 模型路由文档、文档入口、发布说明和 README 最新更新。
- 提交并推送 `feature/responses-api`，创建目标为 `novel-custom` 的 PR。

## 5. 明确不做

- 不改写小说生产、自动导演、Creative Hub 或 Prompt 业务逻辑。
- 不把 Responses 的远端会话存储作为小说长期记忆；长期状态仍以本项目数据库和 RAG 为事实源。
- 不删除 Chat Completions、Anthropic 或现有自定义厂商配置。
- 不根据模型名称猜协议，也不为特定 CLIProxyAPI 模型写硬编码分支。
- 不执行 `prisma migrate reset`、数据库重置或其他破坏性操作。

## 6. 完成标准

- [ ] 厂商可保存 BaseURL、Key、模型名与默认请求协议。
- [ ] 可从 CLIProxyAPI `/v1/models` 自动读取模型，失败时可手动填写。
- [ ] Responses 普通、流式、结构化请求走统一适配，并发送 `store: false`。
- [ ] 显式 Chat Completions 通过协议绑定客户端禁止 LangChain 自动切换。
- [ ] 任务路由可继承厂商协议，也可按任务覆盖。
- [ ] 旧数据通过默认值 `auto` 保持 Chat Completions 行为。
- [ ] 测试可直接断言实际 HTTP 路径和关键请求字段。
- [ ] 整体项目手册、协议 Wiki、用户配置文档和发布说明均有入口。

## 7. 验证状态

尚未开始实现验证。完成各阶段后在此记录已执行命令、通过结果与无法在当前环境执行的检查，避免把“测试已编写”表述为“测试已运行通过”。
