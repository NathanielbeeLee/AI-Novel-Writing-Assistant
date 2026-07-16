# LLM 请求协议、厂商配置与探针规则

## 背景

本项目既要连接 OpenAI，也要连接 Qwen、Kimi、DeepSeek、Ollama、CLIProxyAPI 等 OpenAI-compatible 服务。它们可能只实现 Chat Completions，也可能同时实现 Responses API。模型名称不能可靠说明服务端支持哪个端点；同一个模型名还可能经过不同网关。

因此，请求协议是显式配置，不由模型名猜测。业务服务仍使用统一的 LangChain 消息接口，协议选择集中在 LLM 工厂和协议适配层。

## 协议值

| 持久值 | 最终请求 | 适用情况 |
| --- | --- | --- |
| `auto` | 继续继承；没有更明确设置时使用 Chat Completions | 兼容旧配置，或让任务路由继承厂商设置 |
| `openai_responses` | `POST {BaseURL}/responses` | OpenAI Responses API 或实现该接口的网关 |
| `openai_compatible` | `POST {BaseURL}/chat/completions` | OpenAI-compatible Chat Completions |
| `anthropic` | Anthropic Messages 调用 | Anthropic 官方或兼容服务 |

BaseURL 通常应包含版本根路径，例如 `https://api.openai.com/v1`。因此界面常把最终路径写成 `/v1/responses` 或 `/v1/chat/completions`。

## 解析优先级

有效协议按以下顺序确定：

1. 单次调用或任务模型路由的显式协议；
2. 厂商保存的默认协议；
3. Chat Completions 兼容默认值。

`auto` 的含义是“继续向下一层继承”，不是每个正式请求都先失败再换协议。正式生成不能在错误后盲目跨协议重试，因为一次昂贵的写作请求可能已经在远端执行；自动重放会产生重复正文、重复工具副作用或额外费用。

例如：

- 厂商选择 Responses，`writer` 路由保持 `auto`：正文走 Responses。
- 厂商选择 Responses，`repair` 路由显式选择 Chat Completions：修复走 Chat。
- 厂商和路由都为 `auto`：保持旧行为，走 Chat Completions。

## 为什么需要“强制协议”客户端

当前 `@langchain/openai` 会根据模型、工具和调用参数判断是否偏向 Responses。仅传入 `useResponsesApi: false` 不能在所有情况下保证 Chat Completions。

`ProtocolBoundChatOpenAI` 覆盖协议选择钩子：

- `openai_responses` 永远使用 Responses；
- `openai_compatible` 永远使用 Chat Completions；
- 不因模型名、工具或 LangChain 启发式临时切换。

这样用户测试和配置的是哪个端点，真实写作就使用哪个端点。

## Responses 的会话与存储边界

Responses 客户端启用零数据保留选项，最终请求携带 `store: false`。项目不依赖远端 `response_id` 或远端会话存储维持小说记忆。

长期事实源仍是本项目自己的数据库与 RAG：

- 小说、章节、世界与角色资产；
- 书契约、卷规划、章节任务单；
- 状态快照、事实账本、伏笔账本；
- 审核、质量债务、任务与导演运行记录。

更换协议不会丢失这些本地资产，也不会自动把 Chat Completions 的历史迁成远端 Responses 会话。

## 普通、流式和结构化输出

业务层不直接解析两套供应商响应。LangChain 适配层负责把 Responses output item、SSE 事件、usage 和 Chat completion 统一成消息/分块结果。

本项目要求协议实现同时覆盖：

- 普通非流式调用；
- 流式正文输出；
- JSON Schema、JSON Object 或 prompt JSON 结构化输出；
- prompt、completion 与 total token 用量提取。

Responses 的结构化格式由 SDK 映射到 `text.format`；Chat Completions 使用相应的 `response_format`。如果网关不完整实现原生结构化格式，现有策略会按能力在 `json_schema`、`json_object`、`prompt_json` 之间选择或降级。

协议与结构化格式是两个不同维度：端点可用不等于 JSON Schema 一定可用。

## 自动探针

连接测试与正式调用的规则不同。探针可以安全地测试候选协议，因为请求内容只是极短的 `ok` 与结构化对象。

规则如下：

- 显式选择协议时只测试该协议，失败不跨协议伪装成功。
- `auto` 先测试厂商有效协议；厂商也为 `auto` 时按 Chat、Responses、Anthropic 顺序尝试。
- `both` 模式要求普通和结构化探针在同一个协议上成功，不能把“Chat 普通成功 + Responses 结构化成功”拼成完整成功。
- 结果返回真实协议和真实结构化策略。
- 厂商配置弹窗在 `auto` 探测到完整可用协议后，会把该协议选入表单；仍需点击保存才会成为正式配置。
- 厂商卡片对 `auto` 配置检查其正式兼容默认值 Chat，不把一次探测结果偷偷写入配置。
- 任务路由保留原有的探针结果持久化机制，实际落库的协议和结构化策略会在路由界面显示。

## 模型列表

自定义厂商使用 OpenAI 风格模型目录：

```text
GET {BaseURL}/models
Authorization: Bearer <API Key>
```

系统读取 `data[].id`，填入可搜索模型列表，并默认选择第一个模型。服务不提供 `/models`、返回非标准格式或权限不足时，用户仍可手动填写模型名称。

模型列表成功只证明目录端点可用，不证明该模型支持 Responses、结构化输出或长文本。保存前仍应运行连接测试。

## CLIProxyAPI 配置范例

在“系统设置 → 新增自定义厂商”中填写：

```text
厂商名称：本地 CLIProxyAPI
API 地址：http://127.0.0.1:8317/v1
API Key：CLIProxyAPI 配置的 Key
默认模型：先点击“获取模型列表”，或手动填写实际模型 id
文本请求协议：先选“自动”并测试；测试后确认系统选择了 Responses 或 Chat
```

推荐验证顺序：

1. 启动 CLIProxyAPI，确认端口和 Key。
2. 在应用中获取模型列表。
3. 选择模型，协议暂用 `auto`，点击“测试连接”。
4. 确认普通与结构化能力均正常，并查看检测到的协议。
5. 点击保存。
6. 进入“模型路由”，确认正文、规划、审核、修复路由继承或覆盖关系。
7. 用测试小说生成短章节，再开始大范围自动化。

如果浏览器版运行在另一台机器上，`127.0.0.1` 指向后端所在机器，不一定是你正在操作浏览器的电脑。桌面版则指向当前桌面应用所在机器。

## Responses 与 Chat 是否影响小说质量

协议本身通常不直接决定文笔。主要质量变量是：

- 实际模型及模型版本；
- Prompt、章节任务单与约束质量；
- 上下文召回和长篇状态是否完整；
- 采样参数、输出上限与结构化遵循能力；
- 网关是否完整、正确地转发参数。

同一模型通过两个端点可能因供应商实现、参数映射或可用能力不同而产生差异，但不能笼统认为 Responses 一定“写得更好”。Responses 的价值主要是使用新接口能力、统一 output item/工具语义并匹配只开放该端点的网关；Chat Completions 的价值是生态兼容面更广。

## 故障排查

### `/responses` 返回 404

- 确认 BaseURL 是否已经以 `/v1` 结尾。
- 确认网关版本是否真正提供 Responses。
- 明确切换到 Chat Completions 后重新测试；不要只改模型名。

### `/chat/completions` 返回 404

- 网关可能只开放 Responses。
- 在厂商弹窗选择 `auto` 测试，让系统检测后把 Responses 选入表单并保存。

### 模型列表为空

- 用相同 BaseURL 和 Key 检查 `GET /models`。
- 检查 Key 是否有列举模型权限。
- 如果服务不实现模型目录，直接手动填写模型 id。

### 普通调用成功、结构化失败

- 查看测试结果里的结构化策略和错误分类。
- 在模型路由固定 `prompt_json`，或改用结构化遵循更稳定的模型。
- 这不应被显示为“全部正常”；规划、审核等结构化任务仍可能失败。

### 流式正文失败但普通测试成功

- 确认网关正确转发 SSE，且不会缓冲或改写 Responses 事件。
- 用短章验证真实流式路径。连接探针不能覆盖所有长文本代理超时。

### 明明选 Chat 却请求了 Responses

- 检查任务路由是否有显式覆盖。
- 查看 LLM 调试日志中的 `requestProtocol`。
- 如果仍发生，优先检查是否绕过了统一 `getLLM` / `resolveLLMClientOptions` 工厂。

## 安全边界

- API Key 只由服务端保存和使用；客户端状态只暴露是否已配置，不回传完整 Key。
- 调试日志记录厂商、模型、BaseURL 和协议，不应记录明文 Key。
- 不要把来自不可信来源的 BaseURL 配置成可访问内网敏感服务的地址。
- PR、Issue、截图和日志中不要提交真实 Key。
- Responses 使用 `store: false` 不等于第三方网关一定不留存数据；仍需阅读实际服务商政策。

## 代码地图

- 协议解析：`server/src/llm/protocols/requestProtocol.ts`
- 强制 OpenAI 协议客户端：`server/src/llm/protocols/OpenAIProtocolClient.ts`
- 厂商/路由/调用优先级：`server/src/llm/factory.ts`
- 连接与结构化探针：`server/src/llm/connectivity.ts`
- 模型路由：`server/src/llm/modelRouter.ts`
- 厂商设置 API：`server/src/routes/settings.ts`、`server/src/routes/settings/customProviderRoutes.ts`
- 模型测试 API：`server/src/routes/llm.ts`
- 前端厂商配置：`client/src/pages/settings/SettingsPage.tsx`
- 前端路由配置：`client/src/pages/settings/ModelRoutesPage.tsx`
- 协议 contract 测试：`server/tests/llmRequestProtocols.test.js`

数据库字段 `APIKey.requestProtocol` 同时存在于 PostgreSQL 和 SQLite schema；任何后续修改都必须同步维护两套迁移。

## 外部依据

- [OpenAI：从 Chat Completions 迁移到 Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [OpenAI：Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [LangChain JS：ChatOpenAI 集成](https://docs.langchain.com/oss/javascript/integrations/chat/openai)

外部文档会演进；本页描述的是当前仓库的持久化语义和安全边界，修改依赖版本后应重新运行协议 contract 测试。
