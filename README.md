# Minister / 丞相

AI-driven Feishu chatbot framework powered by Claude — your intelligent assistant that lives inside Feishu.

基于 Claude 驱动的飞书 AI 聊天机器人框架，一个住在飞书里的智能助手。

---

**[English](#english)** | **[中文](#中文)**

---

## English

### What is Minister?

Minister is a TypeScript monorepo that connects Claude AI to Feishu (Lark) instant messaging. It listens for messages via WebSocket, routes them to Claude CLI for processing, and streams the results back as interactive Feishu cards.

On top of chat, Minister exposes a set of Feishu API tools through MCP (Model Context Protocol), allowing Claude to take actions directly in your workspace — send messages, create tasks, manage documents, query calendars, and more.

### Architecture

```
packages/
  shared/        Shared types and configuration
  bot-server/    Feishu chatbot server (WebSocket long-connection)
  feishu-mcp/    MCP tool server exposing Feishu APIs to Claude
```

The bot server receives Feishu messages, spawns a Claude CLI subprocess with streaming JSON output, and renders real-time progress through interactive cards. Sessions are managed per user with a 30-minute TTL, supporting conversation continuity via Claude's `--resume` flag.

### MCP Tools

The MCP server provides six tool categories for Claude to interact with Feishu:

| Category | Tools | Description |
|----------|-------|-------------|
| Message | `msg_send`, `msg_reply`, `msg_read_history` | Send, reply, read chat history |
| Task | `task_create`, `task_update`, `task_complete`, `task_query`, `tasklist_create` | Full task lifecycle management |
| Contact | `contact_search`, `contact_get_user` | Search users, get user profiles |
| Bitable | `bitable_create_app`, `bitable_create_record`, `bitable_query`, `bitable_update_record` | Multi-dimensional table operations |
| Document | `doc_create`, `doc_read`, `doc_update` | Document CRUD |
| Calendar | `cal_create_event`, `cal_query_events`, `cal_freebusy` | Calendar events and availability |

### Prerequisites

- [Bun](https://bun.sh/) v1.x
- A Feishu custom app with WebSocket enabled (from [open.feishu.cn](https://open.feishu.cn))
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) installed (automatically installed in Docker)
- An Anthropic API key

### Quick Start

1. Clone and install dependencies:

```bash
git clone <repo-url> minister
cd minister
bun install
```

2. Configure environment:

```bash
cp config/.env.example .env
# Edit .env with your credentials
```

Required variables:

```
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
```

3. Run:

```bash
bun run bot     # Start bot server
bun run mcp     # Start MCP server (used by Claude CLI internally)
```

### Docker Deployment

```bash
docker compose up -d
```

The Docker image is built on `oven/bun:1-alpine`, with Claude CLI installed at build time. Pass your environment variables via `.env` file.

### Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Feishu SDK**: @larksuiteoapi/node-sdk
- **MCP SDK**: @modelcontextprotocol/sdk
- **Validation**: Zod

---

## 中文

### Minister 是什么?

Minister（丞相）是一个 TypeScript 单体仓库项目，它将 Claude AI 连接到飞书即时通讯平台。通过 WebSocket 长连接监听飞书消息，将消息路由到 Claude CLI 进行处理，然后以交互式飞书卡片的形式实时回传结果。

除了对话能力，Minister 还通过 MCP（模型上下文协议）暴露了一整套飞书 API 工具，让 Claude 能够直接在你的工作空间中执行操作——发消息、建任务、管文档、查日历，一应俱全。

### 项目结构

```
packages/
  shared/        共享类型与配置
  bot-server/    飞书机器人服务（WebSocket 长连接）
  feishu-mcp/    MCP 工具服务，向 Claude 暴露飞书 API
```

机器人服务接收飞书消息后，启动 Claude CLI 子进程进行流式 JSON 输出处理，并通过交互式卡片实时展示进度。每个用户的会话独立管理，30 分钟自动过期，通过 Claude 的 `--resume` 参数支持对话延续。

### MCP 工具集

MCP 服务提供六大类工具，供 Claude 与飞书进行交互：

| 类别 | 工具 | 说明 |
|------|------|------|
| 消息 | `msg_send`, `msg_reply`, `msg_read_history` | 发送、回复消息，读取聊天记录 |
| 任务 | `task_create`, `task_update`, `task_complete`, `task_query`, `tasklist_create` | 任务全生命周期管理 |
| 通讯录 | `contact_search`, `contact_get_user` | 搜索用户、获取用户信息 |
| 多维表格 | `bitable_create_app`, `bitable_create_record`, `bitable_query`, `bitable_update_record` | 多维表格数据操作 |
| 文档 | `doc_create`, `doc_read`, `doc_update` | 文档增删改查 |
| 日历 | `cal_create_event`, `cal_query_events`, `cal_freebusy` | 日历事件与空闲查询 |

### 环境要求

- [Bun](https://bun.sh/) v1.x
- 一个开启了 WebSocket 的飞书自建应用（在 [open.feishu.cn](https://open.feishu.cn) 创建）
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code)（Docker 部署时自动安装）
- Anthropic API Key

### 快速开始

1. 克隆并安装依赖：

```bash
git clone <repo-url> minister
cd minister
bun install
```

2. 配置环境变量：

```bash
cp config/.env.example .env
# 编辑 .env 填入你的凭据
```

必填变量：

```
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
```

3. 启动：

```bash
bun run bot     # 启动机器人服务
bun run mcp     # 启动 MCP 服务（由 Claude CLI 内部调用）
```

### Docker 部署

```bash
docker compose up -d
```

Docker 镜像基于 `oven/bun:1-alpine` 构建，Claude CLI 在构建阶段自动安装。通过 `.env` 文件传入环境变量即可。

### 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **飞书 SDK**: @larksuiteoapi/node-sdk
- **MCP SDK**: @modelcontextprotocol/sdk
- **校验**: Zod

---

## License

MIT
