# Minister

> Plug Claude Code into Feishu. Give your team a capable colleague that actually does things.

**[中文](./README.md)**

---

Minister is a Feishu AI assistant framework built on Claude Code, designed for teams. It's not another chatbot — it's a colleague that lives inside Feishu, capable of sending messages, creating tasks, writing documents, scheduling events, and operating Bitable on your behalf. You say it, it does it.

Works for a ten-person team splitting the busywork, or a solo founder who needs a capable partner.

Minister maintains dedicated memory for each team member. Tell it "I like my weekly reports in three sections", and it remembers — just for you. Everyone's preferences stay separate, persisting across sessions and restarts.

Under the hood, Minister exposes Feishu APIs to the AI engine via MCP (Model Context Protocol), giving it real execution power beyond text generation. It supports dual engines — Claude Code and OpenAI Codex — switchable with a single environment variable. Written in TypeScript, powered by Bun, deployable with a single Docker command.

---

## Table of Contents

- [Features](#features)
- [Why Minister](#why-minister)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Step 1: Clone the Repository](#step-1-clone-the-repository)
  - [Step 2: Create a Feishu Custom App](#step-2-create-a-feishu-custom-app)
  - [Step 3: Enable Bot and Subscribe to Events](#step-3-enable-bot-and-subscribe-to-events)
  - [Step 4: Grant API Permissions](#step-4-grant-api-permissions)
  - [Step 5: Configure OAuth Redirect URL](#step-5-configure-oauth-redirect-url)
  - [Step 6: Configure Environment Variables](#step-6-configure-environment-variables)
  - [Step 7: Install Claude Code](#step-7-install-claude-code)
  - [Step 8: Start the Service](#step-8-start-the-service)
- [Docker Deployment](#docker-deployment)
- [Admin Dashboard](#admin-dashboard)
- [MCP Tools](#mcp-tools)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Features

- **Real execution**: Calls Feishu APIs directly — sends messages, creates tasks, writes docs, instead of giving you text to act on yourself
- **Dual engine**: Claude Code CLI (default) or OpenAI Codex CLI — switchable with one env var
- **Persistent memory**: Each user has a dedicated `CLAUDE.md` that survives sessions and restarts
- **User isolation**: Fully isolated workspace per user — configs and memories never mix
- **Web admin dashboard**: Manage system prompts, MCP servers, and Skills via Feishu OAuth login
- **Image understanding**: Native multimodal input — analyze screenshots, designs, and diagrams
- **Streaming responses**: Interactive cards show real-time AI progress

## Why Minister

| | Minister | OpenClaw | Feishu Built-in AI |
|---|----------|----------|--------------------|
| **Feishu tool coverage** | 6 categories, 20 native tools — messaging, tasks, docs, calendar, Bitable, and contacts | Feishu added recently as a new channel; tooling limited to basic messaging | Constrained by platform policies |
| **Execution model** | Calls Feishu APIs directly — does the work for you | General-purpose task execution, not Feishu-native | Generates text and suggestions; you still have to act on it |
| **Reasoning engine** | Dual-engine: Claude Code CLI (Anthropic's production-grade agentic loop) or OpenAI Codex CLI — switchable via one env var | LLM API + community-built ReAct loop | Conversational text generation, no persistent reasoning loop |
| **Image understanding** | Native multimodal input — analyze screenshots, diagrams, and design files; mixed text+image messages auto-combined | Depends on the underlying LLM's vision capability; integration depth limited | Basic image recognition, constrained by platform |
| **Per-user isolation** | Each user gets a fully isolated workspace (`CLAUDE.md` memory + personal MCP config); can add custom skills and third-party MCPs; filesystem-level access controls | Shared memory store, no per-user isolation | Cleared at session end; no persistent memory |
| **Feishu focus** | Purpose-built for Feishu teams; every detail optimized for the Feishu ecosystem | General-purpose platform; Feishu is one of many supported channels | — |

## Architecture

```
packages/
  shared/        Shared types and configuration
  bot-server/    Feishu chatbot server (WebSocket long-connection + Admin HTTP API)
  feishu-mcp/    MCP tool server exposing Feishu APIs to Claude
  admin-ui/      Admin dashboard frontend (React + Vite SPA)
config/
  .env.example             Environment variable template
  claude.env.example       Claude configuration template
  feishu-permissions.json  Required Feishu permission scopes
```

The bot server receives Feishu messages, spawns an AI engine subprocess (Claude Code or Codex CLI, determined by `ENGINE_TYPE`) with streaming JSON output, and renders real-time progress through interactive cards. Sessions are managed per user with a 30-minute TTL, supporting conversation continuity.

---

## Getting Started

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/minister.git minister
cd minister
bun install
```

> **Prerequisite**: [Bun](https://bun.sh/) v1.x must be installed.

---

### Step 2: Create a Feishu Custom App

1. Go to the [Feishu Open Platform](https://open.feishu.cn) and log in with your enterprise admin account (a personal Feishu account works too).

2. Click **"Developer Console"** in the top left → **"Create App"** → **"Custom App"**.

3. Fill in the app name (e.g., "Minister"), description, and upload an icon. Click **"Confirm"**.

4. After creation, go to the app detail page. Under **"Credentials & Basic Info"**, you'll find:
   - **App ID** (looks like `cli_xxxxxxxxxxxxxxxxx`)
   - **App Secret** (click "View" to reveal)

   Save both values — you'll need them for environment variable configuration.

---

### Step 3: Enable Bot and Subscribe to Events

1. In the left menu of the app detail page, click **"App Features"** → **"Bot"**.

2. Click **"Enable Bot"** to activate the bot feature.

3. In the left menu, click **"Events & Callbacks"** → **"Event Configuration"**.

4. Under **"Subscription Method"**, select **"Receive events via persistent connection"** (WebSocket mode).

   > ⚠️ Important: Minister uses WebSocket long-connections. Do NOT select "HTTP Callback".

5. Click **"Add Event"** and search for + add:
   - `im.message.receive_v1` (Receive messages)

6. Save the configuration.

---

### Step 4: Grant API Permissions

Minister uses MCP tools to operate various Feishu features, which require corresponding API permissions.

1. In the left menu, click **"Permission Management"**.

2. Search for and add the following permissions (recommend granting all for full functionality):

**Messaging**
| Permission | Description |
|-----------|-------------|
| `im:message` | Send and retrieve messages |
| `im:message:send_as_bot` | Send messages as the bot |
| `im:message.group_at_msg` | Receive @ mentions in group chats |
| `im:message.p2p_msg` | Receive direct messages |
| `im:chat` | Get group chat information |
| `im:chat.members:read` | Read group members |

**Tasks**
| Permission | Description |
|-----------|-------------|
| `task:task` | Read and write tasks |
| `task:task:write` | Create and update tasks |

**Contacts**
| Permission | Description |
|-----------|-------------|
| `contact:user.base:readonly` | Read basic user information |
| `contact:contact.base:readonly` | Read contact information |

**Documents**
| Permission | Description |
|-----------|-------------|
| `docs:doc` | Read and write documents |
| `docs:document.content:read` | Read document content |

**Calendar**
| Permission | Description |
|-----------|-------------|
| `calendar:calendar` | Read and write calendars |
| `calendar:calendar.event:create` | Create calendar events |
| `calendar:calendar.event:read` | Read calendar events |
| `calendar:calendar.free_busy:read` | Query free/busy status |

**Bitable**
| Permission | Description |
|-----------|-------------|
| `bitable:app` | Read and write Bitable apps |

> See `config/feishu-permissions.json` for the complete list of permission scopes.

3. If your Feishu organization requires admin approval for permissions, contact your enterprise admin to approve them.

4. The app must be **published** (or you must add yourself as a test user during development) for permissions to take effect.

---

### Step 5: Configure OAuth Redirect URL

The admin dashboard uses Feishu OAuth for login and requires a redirect URL to be registered.

1. In the left menu, click **"Security Settings"**.

2. Under **"Redirect URLs"**, add the admin dashboard's OAuth callback URL:
   - Local development: `http://localhost:3000/api/v1/auth/callback`
   - Production: `https://your-domain.com/api/v1/auth/callback`

   > This URL must exactly match `{ADMIN_BASE_URL}/api/v1/auth/callback`, where `ADMIN_BASE_URL` is the value you'll set in `.env` (including protocol and port).

3. Save the configuration.

---

### Step 6: Configure Environment Variables

1. Copy the template files:

```bash
cp config/.env.example .env
cp config/claude.env.example config/claude.env
```

2. Edit `.env` with your Feishu credentials:

```bash
# Feishu app credentials (from Step 2)
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxxx          # Replace with your App ID
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx   # Replace with your App Secret

# Admin dashboard base URL (keep default for local dev; change for production)
ADMIN_BASE_URL=http://localhost:3000

# Admin dashboard port (optional, default: 3000)
# ADMIN_PORT=3000

# JWT signing secret (REQUIRED in production — set to a random string)
# ADMIN_JWT_SECRET=your_random_secret_here

# Engine selection: "claude" (default) or "codex"
# ENGINE_TYPE=claude

# Required when ENGINE_TYPE=codex
# OPENAI_API_KEY=your_openai_api_key
```

3. Edit `config/claude.env` with your Claude configuration:

```bash
# Authentication — choose one:
#
# Option A: Local OAuth (recommended for personal/local use)
#   Run `claude auth login` in your terminal once. No API key needed.
#
# Option B: API Key (required for server/Docker deployments)
ANTHROPIC_API_KEY=your_anthropic_api_key   # Replace with your Anthropic API key

# Optional: Custom API base URL (useful for proxy setups)
# ANTHROPIC_BASE_URL=https://api.anthropic.com

# Optional: Specify model
# CLAUDE_MODEL=claude-sonnet-4-20250514
```

> See `config/claude.env.example` for all available options.

---

### Step 7: Install Claude Code

Minister uses Claude Code CLI as the default AI engine.

**Option A: Local OAuth (recommended for local development)**

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Log in (completes OAuth authorization in your browser)
claude auth login
```

Once logged in, credentials are stored in `~/.claude/` and reused automatically — no API key needed.

**Option B: API Key (recommended for server/Docker deployment)**

Set `ANTHROPIC_API_KEY` in `config/claude.env`. No manual login required.

---

### Step 8: Start the Service

1. Generate `.claude/settings.json` (Docker handles this automatically; run manually for local development):

```bash
bun run generate-settings
```

2. Start the bot server:

```bash
bun run bot
```

You should see output like:

```
[bot-server] Admin UI: http://localhost:3000
[bot-server] Feishu WebSocket connected
[bot-server] Ready to receive messages
```

3. Open the admin dashboard:

Visit `http://localhost:3000` in your browser, click "Feishu Login", and authorize with your Feishu account.

4. Test in Feishu:

Open Feishu, find the bot you created, and send a message.

> **Note**: If your app is still in development mode, you must add your account as a "Test User" on the Feishu Open Platform before the bot can receive messages from you.

---

## Docker Deployment

Recommended for production or environments where running Claude Code locally isn't practical.

1. Ensure `.env` and `config/claude.env` are configured (use the API Key method).

2. Start the containers:

```bash
docker compose up -d
```

The Docker image is built on `oven/bun:1-debian`, with Claude CLI installed at build time. On container startup, configuration is auto-generated based on `ENGINE_TYPE`:
- Claude engine: generates `.claude/settings.json` from `config/claude.env`
- Codex engine: copies `config/config.toml` to `~/.codex/config.toml` with MCP server definitions appended

View logs:

```bash
docker compose logs -f
```

---

## Admin Dashboard

Minister includes a built-in web admin dashboard. It shares a process with the bot server — no separate deployment needed.

Access at: `{ADMIN_BASE_URL}` (default: `http://localhost:3000`)

**Personal Settings**
- Customize system prompt (overrides global default)
- Manage MCP servers (stdio / SSE / HTTP types, with live connection testing)
- Manage Skills (create, edit, enable/disable, or create from built-in templates)
- Edit your `CLAUDE.md` personal memory

**Group Settings**
- Set a distinct AI persona and behavior strategy per group chat
- Each group can have its own system prompt, MCP servers, and Skills
- Behavior controls: require @mention to trigger, allow auto tool execution, member allowlist

**Config Inheritance**
Three-tier priority: System defaults < Personal config < Group config. The dashboard visualizes which layer each setting comes from.

---

## MCP Tools

The MCP server provides six tool categories for Claude to interact with Feishu:

| Category | Tools | Description |
|----------|-------|-------------|
| Message | `msg_send`, `msg_reply`, `msg_read_history` | Send, reply, read chat history |
| Task | `task_create`, `task_update`, `task_complete`, `task_query`, `tasklist_create` | Full task lifecycle management |
| Contact | `contact_search`, `contact_get_user` | Search users, get user profiles |
| Bitable | `bitable_create_app`, `bitable_create_record`, `bitable_query`, `bitable_update_record` | Multi-dimensional table operations |
| Document | `doc_create`, `doc_read`, `doc_update` | Document CRUD |
| Calendar | `cal_create_event`, `cal_query_events`, `cal_freebusy` | Calendar events and availability |

---

## Personal Workspace

Every user gets a fully isolated workspace at `data/worktrees/{open_id}/`:

```
data/worktrees/{open_id}/
├── CLAUDE.md              # Personal memory — persists across sessions and restarts
└── .claude/
    └── settings.json      # Personal config — custom MCP servers, permissions, etc.
```

**Persistent memory**: When a user expresses preferences (e.g., "remember I like three-section weekly reports"), Claude writes them to `CLAUDE.md` and reads this file automatically on every subsequent session.

**Extend your workspace**: Use natural language to extend Claude's capabilities, for example:

> "Add GitHub MCP to my settings.json. My token is xxx."

Minister will directly update your `settings.json`. The GitHub tools become available to you from the next conversation — with zero impact on any other user.

---

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Feishu SDK**: @larksuiteoapi/node-sdk
- **MCP SDK**: @modelcontextprotocol/sdk
- **Validation**: Zod
- **Backend Framework**: Hono (Admin API + static serving)
- **Frontend**: React + Vite + React Router

---

## License

Licensed under [Apache License 2.0](./LICENSE). Commercial use is permitted, provided that original copyright notices and attribution are retained.
