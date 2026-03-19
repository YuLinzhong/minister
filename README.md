# 丞相 / Minister

把 Claude Code 塞进飞书，给你的团队加一个全能同事。

**[English](./README_EN.md)**

---

丞相是一个基于 Claude Code 的飞书 AI 助手框架，为企业团队打造。它不是又一个聊天机器人——它是一个住在飞书里的同事，能直接帮你发消息、建任务、写文档、排日程、操作多维表格，说完就办，不用你再动手。

十人团队用它分担杂活，一人公司拿它当全能搭档，都合适。

丞相为每位同事维护专属记忆。你说过"我的周报喜欢分三段写"，它就记住了，下次直接照做。张三的习惯是张三的，李四的偏好是李四的，互不干扰。会话断了、服务重启了，记忆都还在。

底层，丞相通过 MCP 协议将飞书 API 暴露给 AI 引擎，让 AI 拥有真正的执行力而不只是生成文本。支持 Claude Code 和 OpenAI Codex 双引擎，通过一个环境变量即可切换。整个项目用 TypeScript 写成，Bun 驱动，Docker 一键部署。

---

## 目录

- [功能特性](#功能特性)
- [为什么选丞相](#为什么选丞相)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
  - [第一步：克隆项目](#第一步克隆项目)
  - [第二步：创建飞书自建应用](#第二步创建飞书自建应用)
  - [第三步：配置机器人功能](#第三步配置机器人功能)
  - [第四步：申请 API 权限](#第四步申请-api-权限)
  - [第五步：配置 OAuth 回调](#第五步配置-oauth-回调)
  - [第六步：配置环境变量](#第六步配置环境变量)
  - [第七步：安装 Claude Code](#第七步安装-claude-code)
  - [第八步：启动服务](#第八步启动服务)
- [Docker 部署](#docker-部署)
- [管理后台](#管理后台)
- [MCP 工具集](#mcp-工具集)
- [技术栈](#技术栈)
- [协议](#协议)

---

## 功能特性

- **真实执行**：直接调用飞书 API，替你发消息、建任务、写文档，而不是给你文字让你自己操作
- **双引擎支持**：Claude Code CLI（默认）或 OpenAI Codex CLI，一个环境变量切换
- **持久记忆**：每位用户拥有专属 `CLAUDE.md`，跨会话、跨重启长期保留
- **用户隔离**：每人独立工作区，配置和记忆互不干扰
- **Web 管理后台**：通过飞书 OAuth 登录，管理系统提示词、MCP 服务器、Skill
- **图片理解**：原生支持图片输入，识图、看截图、分析设计稿
- **流式响应**：交互式卡片实时展示 AI 处理进度

## 为什么选丞相

| 对比项 | 丞相 | OpenClaw | 飞书智能伙伴 |
|--------|------|----------|------------|
| **飞书功能覆盖** | 6 类 20 个原生工具，消息、任务、文档、日历、多维表格、通讯录全栈覆盖 | 飞书为近期新增频道，工具以基础消息收发为主 | 可操作范围受平台策略约束 |
| **执行方式** | 直接调用飞书 API，真正替你把事情办完 | 通用任务执行，飞书专项能力有限 | 生成文字和建议，需用户自行操作 |
| **推理引擎** | 双引擎可选：Claude Code CLI（Anthropic 工业级 agentic loop）或 OpenAI Codex CLI，一个环境变量切换 | LLM API + 社区自研 ReAct 循环 | 对话式文本生成，无持续推理循环 |
| **图片理解** | 原生支持图片输入，可识图、看截图、分析设计稿，图文混发自动合并处理 | 依赖所接入 LLM 的视觉能力，集成深度有限 | 支持基础识图，能力受平台限制 |
| **用户隔离与个性化** | 每人独立工作区（`CLAUDE.md` 记忆 + 专属 MCP 配置），可自建 skill 和接入第三方 MCP，偏好互不干扰，文件系统权限保护 | 全局记忆存储，无用户级隔离 | 会话结束即清空，无持久记忆 |
| **飞书场景专注度** | 为飞书团队专属打造，每个细节都针对飞书生态优化 | 通用平台，飞书是众多支持频道之一 | — |

## 项目结构

```
packages/
  shared/        共享类型与配置
  bot-server/    飞书机器人服务（WebSocket 长连接 + Admin HTTP API）
  feishu-mcp/    MCP 工具服务，向 Claude 暴露飞书 API
  admin-ui/      管理后台前端（React + Vite SPA）
config/
  .env.example       环境变量模板
  claude.env.example Claude 配置模板
  feishu-permissions.json  所需飞书权限清单
```

---

## 快速开始

### 第一步：克隆项目

```bash
git clone https://github.com/your-org/minister.git minister
cd minister
bun install
```

> **前提条件**：需要安装 [Bun](https://bun.sh/) v1.x。

---

### 第二步：创建飞书自建应用

1. 打开[飞书开放平台](https://open.feishu.cn)，使用企业管理员账号登录（个人版飞书也可以）。

2. 点击左上角**"开发者后台"** → **"创建应用"** → **"自建应用"**。

3. 填写应用名称（如"丞相"）、应用描述，上传应用图标，点击**"确定创建"**。

4. 创建成功后，进入应用详情页，在**"凭证与基础信息"**中找到：
   - **App ID**（形如 `cli_xxxxxxxxxxxxxxxxx`）
   - **App Secret**（点击"查看"获取）

   保存这两个值，后续配置环境变量时需要用到。

---

### 第三步：配置机器人功能

1. 在应用详情页左侧菜单，点击**"应用功能"** → **"机器人"**。

2. 点击**"启用机器人"**，开启机器人功能。

3. 在左侧菜单点击**"事件与回调"** → **"事件配置"**。

4. 在**"订阅方式"**中，选择**"使用长连接接收事件"**（即 WebSocket 模式）。

   > ⚠️ 注意：丞相使用 WebSocket 长连接，不要选择"HTTP 回调"方式。

5. 点击**"添加事件"**，搜索并添加：
   - `im.message.receive_v1`（接收消息）

6. 保存配置。

---

### 第四步：申请 API 权限

丞相通过 MCP 工具操作飞书各类功能，需要相应的 API 权限。

1. 在应用详情页左侧，点击**"权限管理"**。

2. 根据你需要的功能，申请以下权限（建议全部申请以获得完整体验）：

**消息类**
| 权限 | 说明 |
|------|------|
| `im:message` | 发送、获取消息 |
| `im:message:send_as_bot` | 以机器人身份发送消息 |
| `im:message.group_at_msg` | 接收群组 @ 消息 |
| `im:message.p2p_msg` | 接收单聊消息 |
| `im:chat` | 获取群组信息 |
| `im:chat.members:read` | 读取群组成员 |

**任务类**
| 权限 | 说明 |
|------|------|
| `task:task` | 任务读写 |
| `task:task:write` | 创建和更新任务 |

**通讯录类**
| 权限 | 说明 |
|------|------|
| `contact:user.base:readonly` | 读取用户基本信息 |
| `contact:contact.base:readonly` | 读取联系人信息 |

**文档类**
| 权限 | 说明 |
|------|------|
| `docs:doc` | 读写文档 |
| `docs:document.content:read` | 读取文档内容 |

**日历类**
| 权限 | 说明 |
|------|------|
| `calendar:calendar` | 读写日历 |
| `calendar:calendar.event:create` | 创建日历事件 |
| `calendar:calendar.event:read` | 读取日历事件 |
| `calendar:calendar.free_busy:read` | 查询空闲时间 |

**多维表格类**
| 权限 | 说明 |
|------|------|
| `bitable:app` | 读写多维表格 |

   > 完整权限列表见 `config/feishu-permissions.json`，可按需选择，也可直接上传json文件到飞书。

3. 权限申请后，如果你的飞书组织需要管理员审批，联系企业管理员审批通过。

4. 将应用**发布**（或在测试阶段添加测试人员）后，权限才会生效。

---

### 第五步：配置 OAuth 回调

管理后台通过飞书账号登录，需要配置 OAuth 回调地址：

1. 在应用详情页左侧，点击**"安全设置"**。

2. 在**"重定向 URL"**中，添加管理后台的 OAuth 回调地址：
   - 本地开发：`http://localhost:3000/api/v1/auth/callback`
   - 生产环境：`https://your-domain.com/api/v1/auth/callback`

   > 该地址必须与 `.env` 中的 `ADMIN_BASE_URL` 严格一致（包括协议和端口），格式为 `{ADMIN_BASE_URL}/api/v1/auth/callback`。

3. 保存配置。

---

### 第六步：配置环境变量

1. 复制环境变量模板：

```bash
cp config/.env.example .env
cp config/claude.env.example config/claude.env
```

2. 编辑 `.env` 文件，填入飞书凭据：

```bash
# 飞书应用凭据（从第二步获取）
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxxx     # 替换为你的 App ID
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 替换为你的 App Secret

# 管理后台地址（本地开发保持默认，生产环境改为实际域名）
ADMIN_BASE_URL=http://localhost:3000

# 管理后台端口（可选，默认 3000）
# ADMIN_PORT=3000

# JWT 签名密钥（生产环境务必设置为随机字符串）
# ADMIN_JWT_SECRET=your_random_secret_here

# 引擎选择：claude（默认）或 codex
# ENGINE_TYPE=claude

# 使用 Codex 引擎时需要填写
# OPENAI_API_KEY=your_openai_api_key
```

3. 编辑 `config/claude.env` 文件，配置 Claude Code：

```bash
# Claude Code 认证方式二选一：
#
# 方式一：本地 OAuth（个人使用推荐）
#   在终端运行 claude auth login 完成登录，无需填写 API Key
#
# 方式二：API Key（服务器/Docker 部署必须）
ANTHROPIC_API_KEY=your_anthropic_api_key  # 替换为你的 Anthropic API Key

# 可选：自定义 API 代理地址（国内用户可能需要）
# ANTHROPIC_BASE_URL=https://api.anthropic.com

# 可选：指定模型
# CLAUDE_MODEL=claude-sonnet-4-20250514
```

   > 完整配置项说明见 `config/claude.env.example`。

---

### 第七步：安装 Claude Code

丞相默认使用 Claude Code CLI 作为 AI 引擎。

**方式一：本地 OAuth（推荐用于本地开发）**

```bash
# 安装 Claude Code
npm install -g @anthropic-ai/claude-code

# 登录（在浏览器中完成 OAuth 授权）
claude auth login
```

登录成功后，凭据存储在 `~/.claude/`，服务启动时自动读取，无需填写 API Key。

**方式二：API Key（推荐用于服务器/Docker 部署）**

在 `config/claude.env` 中填写 `ANTHROPIC_API_KEY`，无需手动登录。

---

### 第八步：启动服务

1. 生成 `.claude/settings.json`（Docker 部署时自动执行，本地开发需手动运行）：

```bash
bun run generate-settings
```

2. 启动机器人服务：

```bash
bun run bot
```

启动后你会看到类似输出：

```
[bot-server] Admin UI: http://localhost:3000
[bot-server] Feishu WebSocket connected
[bot-server] Ready to receive messages
```

3. 访问管理后台：

打开浏览器，访问 `http://localhost:3000`，点击"飞书登录"，使用你的飞书账号授权，即可进入管理后台。

4. 在飞书中测试：

打开飞书，找到你创建的机器人应用，发一条消息试试。

> **注意**：如果应用还在开发阶段，需要先在飞书开放平台将自己的账号添加为"测试人员"，才能收到消息。

---

## Docker 部署

适合生产环境或无法本地运行 Claude Code 的场景。

1. 确保已配置好 `.env` 和 `config/claude.env`（API Key 方式）。

2. 启动容器：

```bash
docker compose up -d
```

Docker 镜像基于 `oven/bun:1-debian` 构建，Claude CLI 在构建阶段自动安装。容器启动时会根据 `ENGINE_TYPE` 自动完成配置：
- Claude 引擎：从 `config/claude.env` 生成 `.claude/settings.json`
- Codex 引擎：将 `config/config.toml` 写入 `~/.codex/config.toml`

查看日志：

```bash
docker compose logs -f
```

---

## 管理后台

丞相内置 Web 管理后台，通过飞书账号登录，无需额外部署，与机器人服务运行在同一进程中。

访问地址：`{ADMIN_BASE_URL}`（默认 `http://localhost:3000`）

**个人配置**
- 自定义系统提示词（覆盖全局默认值）
- 管理 MCP 服务器（stdio / SSE / HTTP 三种类型，在线测试连接）
- 管理 Skill（创建、编辑、启停，从内置模板创建）
- 编辑 `CLAUDE.md` 个人记忆

**群组配置**
- 为不同群聊设置独立的 AI 人格和行为策略
- 每个群可有独立的系统提示词、MCP 服务器和 Skill
- 行为控制：是否需要 @机器人触发、是否允许自动执行工具、成员白名单

**配置继承**
三层优先级：系统默认 < 个人配置 < 群组配置，管理后台可视化展示每项配置的来源和继承链。

---

## MCP 工具集

MCP 服务提供六大类工具，供 Claude 与飞书进行交互：

| 类别 | 工具 | 说明 |
|------|------|------|
| 消息 | `msg_send`, `msg_reply`, `msg_read_history` | 发送、回复消息，读取聊天记录 |
| 任务 | `task_create`, `task_update`, `task_complete`, `task_query`, `tasklist_create` | 任务全生命周期管理 |
| 通讯录 | `contact_search`, `contact_get_user` | 搜索用户、获取用户信息 |
| 多维表格 | `bitable_create_app`, `bitable_create_record`, `bitable_query`, `bitable_update_record` | 多维表格数据操作 |
| 文档 | `doc_create`, `doc_read`, `doc_update` | 文档增删改查 |
| 日历 | `cal_create_event`, `cal_query_events`, `cal_freebusy` | 日历事件与空闲查询 |

---

## 个人工作区

每位用户在 `data/worktrees/{open_id}/` 下拥有完全隔离的个人工作区：

```
data/worktrees/{open_id}/
├── CLAUDE.md              # 用户专属记忆，跨会话持久保留
└── .claude/
    └── settings.json      # 用户专属配置（MCP、权限等）
```

**记忆持久化**：当用户表达偏好或习惯时（如"记住我喜欢三段式周报"），Claude 会自主写入 `CLAUDE.md`，下次会话自动读取。

**扩展能力**：用自然语言让 Claude 扩展你的工作区，例如：

> "帮我在 settings.json 里添加 GitHub MCP，我的 Token 是 xxx"

丞相会直接修改你的 `settings.json`，下次对话起 GitHub 工具就对你生效，对其他用户没有任何影响。

---

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **飞书 SDK**: @larksuiteoapi/node-sdk
- **MCP SDK**: @modelcontextprotocol/sdk
- **校验**: Zod
- **后端框架**: Hono（Admin API + 静态托管）
- **前端**: React + Vite + React Router

---

## 协议

本项目采用 [Apache License 2.0](./LICENSE) 开源协议。允许商业使用，但使用时必须保留原始版权声明与项目来源说明。
