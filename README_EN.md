# Minister

> Plug Claude Code into Feishu. Give your team a capable colleague that actually does things.

**[中文](./README.md)**

---

Minister is a Feishu AI assistant framework built on Claude Code, designed for teams. It's not another chatbot — it's a colleague that lives inside Feishu, capable of sending messages, creating tasks, writing documents, scheduling events, and operating Bitable on your behalf. You say it, it does it.

Works for a ten-person team splitting the busywork, or a solo founder who needs a capable partner. Either way, it fits.

Minister maintains dedicated memory for each team member. Tell it "I like my weekly reports in three sections", and it remembers — just for you. Everyone's preferences stay separate, persisting across sessions and restarts.

Under the hood, Minister exposes Feishu APIs to the AI engine via MCP (Model Context Protocol), giving it real execution power beyond text generation. It supports dual engines — Claude Code and OpenAI Codex — switchable with a single environment variable. Written in TypeScript, powered by Bun, deployable with a single Docker command.

---

### What is Minister?

Minister is an open-source Feishu AI assistant framework. Mention it in a group chat or DM, and the Claude behind it understands your intent and acts: sends messages, creates tasks, writes docs, schedules events, queries Bitable. Not a wall of text for you to act on — it handles things for you.

Technically, Minister exposes Feishu APIs to the AI engine (supporting both Claude Code and OpenAI Codex as switchable backends) via MCP, receives messages over a WebSocket long-connection, and displays real-time progress through streaming cards. The project is organized as a TypeScript monorepo, powered by Bun, and deployable with a single Docker command.

### Why Minister?

| | Minister | OpenClaw | Feishu Built-in AI |
|---|----------|----------|--------------------|
| **Feishu tool coverage** | 6 categories, 20 native tools — messaging, tasks, docs, calendar, Bitable, and contacts | Feishu added recently as a new channel; tooling limited to basic messaging | Constrained by platform policies |
| **Execution model** | Calls Feishu APIs directly — does the work for you | General-purpose task execution, not Feishu-native | Generates text and suggestions; you still have to act on it |
| **Reasoning engine** | Dual-engine: Claude Code CLI (Anthropic's production-grade agentic loop) or OpenAI Codex CLI — switchable via one env var | LLM API + community-built ReAct loop | Conversational text generation, no persistent reasoning loop |
| **Image understanding** | Native multimodal input — analyze screenshots, diagrams, and design files; mixed text+image messages auto-combined | Depends on the underlying LLM's vision capability; integration depth limited | Basic image recognition, constrained by platform |
| **Per-user isolation** | Each user gets a fully isolated workspace (`CLAUDE.md` memory + personal MCP config); can add custom skills and third-party MCPs; filesystem-level access controls | Shared memory store, no per-user isolation | Cleared at session end; no persistent memory |
| **Feishu focus** | Purpose-built for Feishu teams; every detail optimized for the Feishu ecosystem | General-purpose platform; Feishu is one of many supported channels | — |

### Architecture

```
packages/
  shared/        Shared types and configuration
  bot-server/    Feishu chatbot server (WebSocket long-connection)
  feishu-mcp/    MCP tool server exposing Feishu APIs to Claude
```

The bot server receives Feishu messages, spawns an AI engine subprocess (Claude Code or Codex CLI, determined by the `ENGINE_TYPE` env var) with streaming JSON output, and renders real-time progress through interactive cards. Sessions are managed per user with a 30-minute TTL, supporting conversation continuity.

### Personal Workspace

Every user gets a fully isolated workspace at `data/worktrees/{open_id}/`, containing two core files:

```
data/worktrees/{open_id}/
├── CLAUDE.md              # Personal memory — persists across sessions and restarts
└── .claude/
    └── settings.json      # Personal config — custom MCP servers, permissions, etc.
```

**Persistent memory**: When a user expresses preferences, habits, or standing instructions (e.g. "remember I like three-section weekly reports"), Claude writes them to `CLAUDE.md`. On every subsequent session — even after expiry or service restarts — Claude reads this file natively and applies it automatically.

**Personal MCP and skills**: Each user has their own `.claude/settings.json` and can extend their own Claude experience through natural language:

- Connect third-party MCP servers (GitHub, Jira, internal tools, etc.)
- Define personal skills in `CLAUDE.md` (report templates, workflow shortcuts, prompt libraries)
- Adjust permission policies for your own use case

For example, you can tell Minister:

> "Add GitHub MCP to my settings.json. My token is xxx."

Minister will directly update your `settings.json`. The GitHub tools become available to you from the next conversation — with zero impact on any other user.

**Security isolation**: Workspace directories are protected by filesystem-level permission deny rules and multi-layer system prompt guardrails that prohibit any cross-user read or write operations.

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
- A Feishu custom app (from [open.feishu.cn](https://open.feishu.cn))
- One of the following AI engines:
  - [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) + Anthropic API key (default)
  - [Codex CLI](https://codex.openai.com/) + OpenAI API key

### Feishu App Setup

Create a custom app on the [Feishu Open Platform](https://open.feishu.cn), then configure it in the Events & Callbacks page:

1. **Subscription mode**: Select "Receive events through persistent connection" (WebSocket). Do NOT use HTTP callback.
2. **Subscribe to events**: Add `im.message.receive_v1` (Receive messages).
3. **Permissions**: Grant the API scopes required by the MCP tools (messaging, tasks, contacts, calendar, docs, bitable). A full list is in `config/feishu-permissions.json`.

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
cp config/claude.env.example config/claude.env
# Edit both files with your credentials
```

`.env` holds Feishu credentials:

```
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
```

`config/claude.env` holds all Claude Code settings — API key, base URL, model, proxy, and `settings.json` overrides. See `config/claude.env.example` for the full list.

To use the Codex engine instead, add to `.env`:

```
ENGINE_TYPE=codex
OPENAI_API_KEY=your_openai_api_key
```

Then edit `config/config.toml` to configure the model and provider (see comments in that file).

3. Generate `.claude/settings.json` (optional for local, automatic in Docker):

```bash
bun run generate-settings
```

4. Run:

```bash
bun run bot     # Start bot server
bun run mcp     # Start MCP server (used by Claude CLI internally)
```

### Docker Deployment

```bash
docker compose up -d
```

The Docker image is built on `oven/bun:1-debian`, with Claude CLI installed at build time. On container startup, configuration is auto-generated based on `ENGINE_TYPE` — for Claude, `.claude/settings.json` is created from `config/claude.env`; for Codex, `config/config.toml` is copied to `~/.codex/config.toml` with MCP server definitions appended. All engine behavior can be controlled purely through environment variables.

### Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Feishu SDK**: @larksuiteoapi/node-sdk
- **MCP SDK**: @modelcontextprotocol/sdk
- **Validation**: Zod

---

## License

Licensed under [Apache License 2.0](./LICENSE). Commercial use is permitted, provided that original copyright notices and attribution are retained.
