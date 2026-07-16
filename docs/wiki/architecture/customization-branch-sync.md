# 定制分支与上游同步规则

## 背景

本 fork 既要持续接收原仓库的新功能，又要保留 Responses API、自定义模型接入、整书质量闭环等定制能力。如果把定制提交直接放进 `main`，后续很难判断哪些提交来自上游；如果长期不合并主线，定制代码又会逐渐建立在过时架构上。

分支不是独立仓库。一个 fork 内的 `main`、`novel-custom` 和 `feature/*` 都是指向不同提交的引用，可以在同一份 Git 历史中合并、比较和创建 PR。

## 决策

采用“干净主线 + 长期定制集成分支 + 短期功能分支”三层结构：

```text
原仓库默认分支
  -> fork/main
       -> novel-custom
            -> feature/*
            -> PR 回 novel-custom
```

`main` 只跟踪原仓库稳定主线；`novel-custom` 是实际使用和发布定制版的集成分支；每项新功能从 `novel-custom` 建立独立 `feature/*`。上游同步使用 merge commit，保留“这次引入了哪一个 main 版本”的可审计节点。

## 当前规则

### 分支职责

| 分支 | 允许内容 | 禁止内容 |
| --- | --- | --- |
| `main` | 原仓库默认分支同步结果 | 定制功能、只服务本 fork 的修复 |
| `novel-custom` | 已验证的定制功能和上游合并 | 未完成的实验提交 |
| `feature/*` | 一项边界清晰、可独立审查的功能 | 多个无关功能长期堆积 |

- 新功能一律从最新 `novel-custom` 创建，而不是从 `main` 创建。
- 功能完成后先通过 PR 合并到 `novel-custom`，再删除或归档短期 feature 分支。
- 原仓库更新先同步到 fork 的 `main`；确认 `main` 只包含上游内容后，再创建 `main -> novel-custom` PR。
- 不把 `novel-custom` 合并回 `main`，也不为了制造“无冲突”而强推或重写共享分支历史。
- 原仓库的临时 `codex/*`、PR 或实验分支不需要逐一同步。只有默认分支，以及原仓库明确声明需要长期跟踪的发布/开发分支，才进入同步策略。

### 推荐同步顺序

同一轮既有 feature 更新又有上游更新时，固定使用：

1. 获取远端最新引用，确认工作区无无关改动。
2. 将目标 `feature/*` 通过 PR 合并到 `novel-custom`。
3. 在 fork 中同步原仓库默认分支到 `main`。
4. 创建 `main -> novel-custom` PR 并查看提交范围、文件范围和冲突。
5. 在本地 `novel-custom` 合并最新 `main`，逐项解决冲突。
6. 更新测试、Wiki、README 最新更新摘要和完整 release notes。
7. 运行分层验证后推送 merge commit，确认远端 `novel-custom` 同时包含 feature 与 `main` 两条历史。

先合 feature 的原因是：冲突解决应面对最终定制能力，而不是先同步主线、之后再让旧 feature 覆盖新架构。

### 冲突裁决原则

冲突时不要按“ours/theirs”整批选择，应判断职责的新所有者：

| 冲突区域 | 应保留的长期不变量 |
| --- | --- |
| LLM 工厂、模型路由、连接探针 | Responses、Chat Completions、Anthropic 的显式协议语义；路由覆盖优先级；显式协议失败不静默换端点 |
| 自定义厂商设置 | BaseURL、Key、手填模型、标准 `/models` 发现和兼容错误提示 |
| Prompt Registry | 采用主线当前注册/懒加载架构，并把定制 Prompt 登记到新入口，禁止恢复旧的全量静态注册表 |
| 角色工作台 | 采用主线当前组件边界，同时保留角色重要度编辑、展示和章节上下文优先级 |
| 整书审校与批量润色 | 报告先于采用、采用幂等、润色复用章节 pipeline 与恢复点 |
| 数据库 | SQLite 与 PostgreSQL 同步维护增量迁移，禁止 reset 或破坏性迁移 |
| 资产入口 | 统一资产中心、视觉资源目录和原业务资产所有权同时成立，不能因路由重构丢入口 |
| 文档 | README 只保留最新日期摘要，release notes 保留完整历史，稳定规则进入 Wiki |

当主线把旧文件拆分或删除时，默认相信新的所有权边界。先定位新入口，再移植定制行为和测试；不要为了快速消除冲突恢复已被主线淘汰的文件。

### 合并后验证清单

- Git 历史：`novel-custom` 同时可达 feature 头和本轮 `main` 头；`main` 不含定制提交。
- 冲突卫生：没有 `<<<<<<<`、`=======`、`>>>>>>>`，`git diff --check` 通过。
- 前端：共享类型构建、客户端 typecheck 与 Vite build 通过；系统设置仍能选择协议和获取/手填模型。
- LLM：注册表可读取整书审校 Prompt；Responses 与 Chat 的协议测试、模型路由测试和连接测试行为保持一致。
- 质量闭环：角色重要度贯穿双 schema、双迁移、API、编辑 UI 和章节上下文；整书报告、建议采用、批量润色路由仍可达。
- 主线能力：世界观准备、角色思路线/对话、AI 实况、读者体验合同、承诺账本和视觉资源目录没有被旧版文件覆盖。
- 文档：文档 manifest、README 最新摘要、release notes 和相关 Wiki 同步更新。
- 真实环境：至少用一个 CLIProxyAPI 模型分别完成模型发现、普通文本和结构化调用；大范围自动化前先试跑 1～3 章。

## 示例

推荐：主线将 `Prompt Registry` 拆为懒加载目录时，保留主线 `registry.ts`，把 `novel.review.book_range@v1` 和 `novel.review.book_synthesis@v1` 加到 loader entries，并运行注册表查询测试。

禁止：直接选择旧定制分支的整个 `registry.ts` 来消除冲突。这样表面上保住两个 Prompt，却会覆盖主线后来加入的注册机制和资产。

推荐：角色工作台重构为 Profile、Relations、Intelligence 等子页时，把重要度字段接入 Profile 数据流和焦点摘要。

禁止：恢复旧的单文件角色面板；它会让主线新增的思路线、角色对话和关系工作台消失。

## 失败模式

- `main` 出现定制提交：停止继续同步，先确认是误合并还是刻意改变策略；不要直接强推改写远端历史。
- PR 显示大量重复提交：检查比较方向是否为 `main -> novel-custom`，以及 `novel-custom` 是否已经包含目标 main 提交。
- 合并后能编译但功能入口消失：检查路由、导航、Prompt loader 和新组件所有者，不能只看冲突标记数量。
- SQLite 正常而 PostgreSQL 失败：检查两套 schema 和迁移是否成对更新。
- 显式选择 Responses 却请求 Chat：检查任务路由覆盖、厂商默认协议和是否有代码绕开统一 LLM 工厂。
- 上游再次同步时反复出现同一冲突：检查上次是否使用了真实双亲 merge commit；补丁复制或 squash 会让 Git 缺少已合并关系。

## 相关模块

- `AGENTS.md`
- `server/src/llm/`
- `server/src/prompting/registry/`
- `server/src/prisma/`
- `client/src/pages/settings/`
- `client/src/pages/novels/components/characterWorkspace/`
- `docs/releases/release-notes.md`

## 来源文档

- [项目总手册](../project-handbook.md)
- [LLM 请求协议、厂商配置与探针规则](./llm-request-protocols.md)
- [整书质量闭环](../workflows/whole-book-quality-loop.md)
