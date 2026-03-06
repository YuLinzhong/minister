# AI 公司秘书 — 开发计划

> **项目代号**：Mishu（秘书）
> **定位**：接入飞书的 AI 公司秘书 Agent，基于 Claude Code 驱动，能与老板/员工双向协作，自动拆解任务、分配人员、追踪进度、催办提醒、总结经验。
> **日期**：2026-03-07

---

## 一、项目背景与决策记录

### 1.1 为什么不用 OpenClaw（龙虾）

| 问题 | 详情 |
|------|------|
| Claude OAuth 被封 | Anthropic 已禁止 OpenClaw 使用 Claude 账号的 OAuth Token，只能走付费 API 直连 |
| 架构黑箱 | OpenClaw Gateway 是单进程运行，插件与核心深度耦合，无法灵活定制飞书交互细节（流式卡片、工具状态展示等） |
| 模型切换后能力下降 | 切换到非 Claude 模型后，指令遵循能力明显变差 |

### 1.2 为什么不直接用飞书官方 OpenClaw 插件

飞书官方插件（`feishu-openclaw-plugin`）的能力表非常完整，但它是 OpenClaw Gateway 的 in-process 插件，依赖 `openclaw/plugin-sdk/feishu` 等私有 SDK，无法脱离 OpenClaw 独立运行。

**我们的策略**：拆骨取肉——复用它的三大资产：

1. **权限清单**：文档中完整的飞书 API 权限 JSON（几十个 scope）
2. **能力边界**：消息/文档/多维表格/日历/任务的完整工具定义
3. **飞书 Node SDK**：`@larksuiteoapi/node-sdk`（公开 npm 包，与 OpenClaw 无绑定）

### 1.3 技术选型

| 层次 | 选型 | 理由 |
|------|------|------|
| 大脑 | Claude Code CLI | 最强推理能力，原生支持 MCP，Skill/Hook 机制灵活 |
| 飞书 API | `@larksuiteoapi/node-sdk` | 飞书官方维护，TypeScript 支持 |
| 通信协议 | MCP (Model Context Protocol) | Claude Code 原生支持，标准化工具注册 |
| 飞书消息通道 | WebSocket 长连接 | 无需公网 IP，官方推荐方式 |
| 任务数据库 | 飞书多维表格 | 零部署成本，飞书原生，团队可直接查看 |
| 运行环境 | Node.js ≥ 22 + TypeScript | 与飞书 SDK 生态一致 |

---

## 二、系统架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────┐
│                    飞书客户端                          │
│  (老板/员工 在群聊或私聊中 @秘书Bot 发送指令)          │
└──────────────┬──────────────────────────────────────┘
               │ WebSocket 长连接 (im.message.receive_v1)
               ▼
┌──────────────────────────────────┐
│      Feishu Bot Server           │
│      (Node.js + TypeScript)      │
│                                  │
│  ┌────────────────────────────┐  │
│  │  消息路由 & 会话管理        │  │
│  │  - 解析 @提及/群聊/私聊    │  │
│  │  - 维护 per-user session   │  │
│  │  - 流式卡片更新            │  │
│  └────────────┬───────────────┘  │
└───────────────┼──────────────────┘
                │ spawn Claude Code CLI (--resume)
                │ NDJSON 流式输出解析
                ▼
┌──────────────────────────────────┐
│        Claude Code (大脑)        │
│                                  │
│  Skills:                         │
│  - /secretary  (秘书主流程)       │
│  - /assign     (任务分配)        │
│  - /review     (复盘总结)        │
│                                  │
│  MCP Servers:                    │
│  - feishu-mcp  (飞书能力)        │
│  - memory-mcp  (长期记忆) [可选] │
└────────────┬─────────────────────┘
             │ MCP tool calls
             ▼
┌──────────────────────────────────┐
│      Feishu MCP Server           │
│      (Node.js + TypeScript)      │
│                                  │
│  Tools (MCP 标准协议):           │
│  ┌─────────────────────────────┐ │
│  │ 📬 消息模块                  │ │
│  │  msg_send / msg_read        │ │
│  │  msg_search / msg_reply     │ │
│  ├─────────────────────────────┤ │
│  │ 📄 文档模块                  │ │
│  │  doc_create / doc_read      │ │
│  │  doc_update                 │ │
│  ├─────────────────────────────┤ │
│  │ 📊 多维表格模块              │ │
│  │  bitable_create_record      │ │
│  │  bitable_query / _update    │ │
│  │  bitable_batch_update       │ │
│  ├─────────────────────────────┤ │
│  │ 📅 日历模块                  │ │
│  │  cal_create / cal_query     │ │
│  │  cal_freebusy               │ │
│  ├─────────────────────────────┤ │
│  │ ✅ 任务模块                  │ │
│  │  task_create / task_update  │ │
│  │  task_query / task_complete │ │
│  │  tasklist_manage            │ │
│  ├─────────────────────────────┤ │
│  │ 👥 通讯录模块                │ │
│  │  contact_search             │ │
│  │  contact_get_user           │ │
│  └─────────────────────────────┘ │
│           │                      │
│           ▼                      │
│   @larksuiteoapi/node-sdk        │
│   (飞书官方 Node SDK)            │
└──────────────────────────────────┘
```

### 2.2 数据流

```
用户在飞书发消息 "@秘书 下周三前完成Q2报告，安排小王负责"
  → Bot Server 收到 WebSocket 事件
  → 解析消息内容、发送人、群聊 ID
  → spawn Claude Code CLI，传入消息 + 系统 Skill
  → Claude Code 思考：需要创建任务 + 分配给小王 + 设置截止日期
  → Claude Code 调用 MCP tools:
      1. contact_search("小王") → 获取 user_id
      2. task_create({title: "完成Q2报告", due: "2026-03-11", assignee: user_id})
      3. bitable_create_record({...}) → 写入任务看板
      4. msg_send({chat_id, text: "已创建任务..."}) → 回复确认
  → Bot Server 解析 NDJSON 输出，实时更新飞书消息卡片
  → 最终结果推送到飞书
```

---

## 三、开发阶段划分

### Phase 0：项目脚手架（Day 1-2）

**目标**：搭建项目骨架，能跑通最小闭环（发消息→收到回复）

- [ ] 初始化 Node.js + TypeScript 项目（monorepo 结构）
- [ ] 创建飞书企业自建应用，配置机器人能力
- [ ] 导入权限（直接使用官方插件文档中的 JSON 权限清单）
- [ ] 实现 Bot Server 基础框架
  - 使用 `@larksuiteoapi/node-sdk` 的 `ws` 模式接收消息
  - 事件订阅：`im.message.receive_v1`
  - 消息发送：文本 + 消息卡片
- [ ] 验证：在飞书 @Bot 发送 "ping"，收到 "pong" 回复

**项目目录结构**：

```
mishu/
├── package.json              # monorepo root
├── tsconfig.json
├── packages/
│   ├── bot-server/           # 飞书 Bot Server
│   │   ├── src/
│   │   │   ├── index.ts      # 入口，启动 WebSocket 监听
│   │   │   ├── message-handler.ts   # 消息路由
│   │   │   ├── claude-bridge.ts     # 调用 Claude Code CLI
│   │   │   ├── card-builder.ts      # 飞书消息卡片构建
│   │   │   └── session-manager.ts   # 会话管理
│   │   └── package.json
│   │
│   ├── feishu-mcp/           # 飞书 MCP Server
│   │   ├── src/
│   │   │   ├── index.ts      # MCP Server 入口
│   │   │   ├── tools/
│   │   │   │   ├── message.ts     # 消息工具
│   │   │   │   ├── document.ts    # 文档工具
│   │   │   │   ├── bitable.ts     # 多维表格工具
│   │   │   │   ├── calendar.ts    # 日历工具
│   │   │   │   ├── task.ts        # 任务工具
│   │   │   │   └── contact.ts     # 通讯录工具
│   │   │   ├── auth.ts       # OAuth + Token 管理
│   │   │   └── client.ts     # 飞书 SDK 封装
│   │   └── package.json
│   │
│   └── shared/               # 共享类型和工具
│       ├── src/
│       │   ├── types.ts
│       │   └── config.ts
│       └── package.json
│
├── skills/                   # Claude Code Skills
│   ├── secretary.md          # 秘书主 Skill
│   ├── assign.md             # 任务分配 Skill
│   └── review.md             # 复盘总结 Skill
│
├── .claude/                  # Claude Code 配置
│   ├── settings.json         # MCP Server 注册
│   └── commands/             # 斜杠命令
│
└── config/
    ├── .env.example          # 环境变量模板
    └── feishu-permissions.json  # 飞书权限清单（从官方文档复制）
```

### Phase 1：飞书 MCP Server — 核心工具层（Day 3-7）

**目标**：实现完整的飞书 MCP Server，Claude Code 能通过 MCP 协议调用飞书 API

#### 1.1 MCP Server 框架

```typescript
// packages/feishu-mcp/src/index.ts 的核心结构
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "feishu-mcp",
  version: "0.1.0",
}, {
  capabilities: { tools: {} }
});

// 注册所有工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    ...messageTools,
    ...documentTools,
    ...bitableTools,
    ...calendarTools,
    ...taskTools,
    ...contactTools,
  ]
}));

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await toolRouter(name, args);
});
```

#### 1.2 工具实现优先级

| 优先级 | 模块 | 工具 | 说明 |
|--------|------|------|------|
| P0 | 消息 | `msg_send`, `msg_reply`, `msg_read_history` | 秘书的嘴和耳朵 |
| P0 | 任务 | `task_create`, `task_update`, `task_query`, `task_complete` | 秘书的核心职能 |
| P0 | 任务清单 | `tasklist_create`, `tasklist_add_members` | 任务分组管理 |
| P0 | 通讯录 | `contact_search`, `contact_get_user` | 知道"小王"是谁 |
| P1 | 多维表格 | `bitable_create_app`, `bitable_create_record`, `bitable_query`, `bitable_update_record` | 任务看板数据库 |
| P1 | 文档 | `doc_create`, `doc_read`, `doc_update` | 写复盘报告 |
| P1 | 日历 | `cal_create_event`, `cal_query_events`, `cal_freebusy` | 约会议 |
| P2 | 消息高级 | `msg_search`, `msg_pin`, `msg_reaction` | 搜索历史消息 |
| P2 | 多维表格高级 | `bitable_create_field`, `bitable_batch_update`, `bitable_filter` | 高级数据操作 |

#### 1.3 工具定义参考（以 task_create 为例）

```typescript
{
  name: "task_create",
  description: "在飞书中创建一个任务，可指定负责人、截止时间、所属清单",
  inputSchema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "任务标题" },
      description: { type: "string", description: "任务描述（可选）" },
      due: {
        type: "object",
        properties: {
          timestamp: { type: "string", description: "截止时间 Unix 时间戳" },
          is_all_day: { type: "boolean", description: "是否全天" }
        }
      },
      members: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "成员 user_id 或 open_id" },
            role: { type: "string", enum: ["assignee", "follower"] }
          }
        },
        description: "任务成员（负责人/关注人）"
      },
      tasklist_id: { type: "string", description: "所属任务清单 ID（可选）" }
    },
    required: ["summary"]
  }
}
```

#### 1.4 Claude Code MCP 注册

```json
// .claude/settings.json
{
  "mcpServers": {
    "feishu": {
      "command": "npx",
      "args": ["tsx", "./packages/feishu-mcp/src/index.ts"],
      "env": {
        "FEISHU_APP_ID": "${FEISHU_APP_ID}",
        "FEISHU_APP_SECRET": "${FEISHU_APP_SECRET}",
        "FEISHU_USER_ACCESS_TOKEN": "${FEISHU_USER_ACCESS_TOKEN}"
      }
    }
  }
}
```

### Phase 2：Bot Server — 飞书交互层（Day 8-12）

**目标**：飞书消息 → Claude Code → 飞书回复 的完整闭环

#### 2.1 消息接收与路由

```typescript
// 核心逻辑：消息处理流程
async function handleMessage(event: FeishuMessageEvent) {
  const { message, sender } = event;
  
  // 1. 过滤：只响应 @Bot 的消息（群聊）或私聊消息
  if (message.chat_type === "group" && !isMentioned(message)) return;
  
  // 2. 提取纯文本内容（去掉 @Bot 的部分）
  const text = extractText(message);
  
  // 3. 获取或创建会话
  const session = sessionManager.getOrCreate(sender.sender_id, message.chat_id);
  
  // 4. 发送"思考中"的临时卡片
  const cardMsgId = await sendThinkingCard(message.chat_id);
  
  // 5. 调用 Claude Code
  const result = await claudeBridge.run(text, session, {
    onProgress: (chunk) => updateCard(cardMsgId, chunk),  // 流式更新
  });
  
  // 6. 更新最终结果卡片
  await updateFinalCard(cardMsgId, result);
}
```

#### 2.2 Claude Code CLI 调用桥接

```typescript
// packages/bot-server/src/claude-bridge.ts
import { spawn } from "child_process";

async function run(prompt: string, session: Session, callbacks: Callbacks) {
  const args = [
    "--print",               // 非交互模式
    "--output-format", "stream-json",  // NDJSON 流式输出
    "--model", "claude-opus-4-6",
  ];
  
  // 如果有历史会话，使用 --resume 保持上下文
  if (session.conversationId) {
    args.push("--resume", session.conversationId);
  }
  
  const proc = spawn("claude", [...args, prompt], {
    env: { ...process.env },
    cwd: projectRoot,  // 确保能找到 .claude/settings.json 和 Skills
  });
  
  // 解析 NDJSON 流
  proc.stdout.on("data", (data) => {
    for (const line of data.toString().split("\n").filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.type === "assistant" && event.subtype === "text") {
        callbacks.onProgress(event.content);
      }
      if (event.type === "result") {
        session.conversationId = event.session_id;
      }
    }
  });
}
```

#### 2.3 流式消息卡片

```typescript
// 使用飞书交互卡片实现流式更新效果
function buildProgressCard(status: string, content: string, tools: string[]) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "🤖 秘书正在处理..." },
      template: "blue",
    },
    elements: [
      { tag: "div", text: { tag: "lark_md", content } },
      // 显示当前调用的工具
      tools.length > 0 && {
        tag: "note",
        elements: [
          { tag: "plain_text", content: `⚙️ ${tools.join(" → ")}` }
        ],
      },
      { tag: "hr" },
      { tag: "note", elements: [
        { tag: "plain_text", content: `状态：${status}` }
      ]},
    ].filter(Boolean),
  };
}
```

### Phase 3：秘书 AI — Skill 与编排逻辑（Day 13-18）

**目标**：让 Claude Code 真正像一个秘书那样思考和行动

#### 3.1 核心 Skill 文件

```markdown
# skills/secretary.md

你是一个专业的公司秘书 AI，名叫"秘书"。你运行在飞书环境中，
可以通过 feishu MCP Server 操作飞书的消息、任务、文档、日历、多维表格。

## 你的核心职责

1. **任务管理**：接收指令 → 拆解子任务 → 分配给合适的人 → 追踪进度 → 催办
2. **会议协调**：查看参会人忙闲 → 找到共同空闲时间 → 创建日程 → 发送通知
3. **信息整理**：从群聊中提取待办 → 整理会议纪要 → 生成周报/月报
4. **经验沉淀**：任务完成后自动复盘 → 提炼经验 → 写入知识库

## 你的工作原则

- 收到任务指令时，先确认理解是否正确，再执行
- 分配任务时，说明原因（"小王最近在跟进Q2数据，由他来做最合适"）
- 催办时语气友好但明确（"温馨提醒：Q2报告明天截止，目前进度如何？"）
- 遇到冲突或不确定时，上报给指令发起人决策，不自作主张
- 所有任务变更都记录到多维表格看板

## 多维表格「任务看板」结构

你需要维护一张多维表格作为任务数据库，字段如下：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 任务名称 | 文本 | 任务标题 |
| 状态 | 单选 | 待分配 / 进行中 / 待验收 / 已完成 / 已取消 |
| 负责人 | 人员 | 飞书用户 |
| 发起人 | 人员 | 谁提出的任务 |
| 截止时间 | 日期 | deadline |
| 优先级 | 单选 | P0紧急 / P1重要 / P2普通 / P3低优 |
| 描述 | 文本 | 任务详细描述 |
| 进度备注 | 文本 | 最新进度更新 |
| 创建时间 | 日期 | 自动填充 |
| 完成时间 | 日期 | 完成后填充 |
| 复盘笔记 | 文本 | 完成后的经验总结 |

## 典型工作流

### 收到新任务指令
1. 解析指令：提取任务名称、截止时间、负责人、优先级
2. 如果信息不完整，追问确认
3. 在飞书任务系统创建任务 (task_create)
4. 在多维表格看板创建记录 (bitable_create_record)
5. @负责人 发送任务通知 (msg_send)
6. 回复发起人确认

### 每日巡检（定时触发）
1. 查询多维表格中所有"进行中"且即将到期的任务
2. 对临近截止（≤2天）的任务，@负责人 友好催办
3. 对已超期的任务，@负责人 + @发起人 升级提醒
4. 生成当日任务简报，发送到指定群

### 任务完成与复盘
1. 负责人说"完成了"→ 更新任务状态为"待验收"
2. @发起人 确认验收
3. 验收通过 → 状态改为"已完成"，填写完成时间
4. 自动生成复盘提问：耗时是否合理？有无可复用经验？遇到什么阻碍？
5. 将复盘内容写入多维表格 + 知识库文档
```

#### 3.2 定时任务（Cron）

```typescript
// packages/bot-server/src/cron.ts
import cron from "node-cron";

// 每天早上 9:30 执行每日巡检
cron.schedule("30 9 * * 1-5", async () => {
  await claudeBridge.run(
    "执行每日任务巡检：检查所有进行中的任务，催办即将到期的，升级已超期的，然后生成今日任务简报发到秘书群。",
    systemSession,
    { onProgress: () => {} }
  );
});

// 每周五下午 4:00 生成周报
cron.schedule("0 16 * * 5", async () => {
  await claudeBridge.run(
    "生成本周任务周报：统计本周完成/新增/超期任务数量，列出下周待办，总结本周经验教训，生成飞书文档并发到管理群。",
    systemSession,
    { onProgress: () => {} }
  );
});
```

### Phase 4：多人协作与权限（Day 19-23）

**目标**：支持多人同时使用，区分老板/员工角色

#### 4.1 角色与权限模型

```typescript
interface UserRole {
  userId: string;
  role: "admin" | "manager" | "member";
  permissions: {
    canCreateTask: boolean;      // 创建任务
    canAssignToOthers: boolean;  // 分配给别人
    canViewAllTasks: boolean;    // 查看所有人的任务
    canApproveCompletion: boolean; // 验收任务
    canModifySettings: boolean;  // 修改秘书设置
  };
}

// 默认权限
const defaultPermissions = {
  admin:   { canCreateTask: true,  canAssignToOthers: true,  canViewAllTasks: true,  canApproveCompletion: true,  canModifySettings: true  },
  manager: { canCreateTask: true,  canAssignToOthers: true,  canViewAllTasks: true,  canApproveCompletion: true,  canModifySettings: false },
  member:  { canCreateTask: true,  canAssignToOthers: false, canViewAllTasks: false, canApproveCompletion: false, canModifySettings: false },
};
```

#### 4.2 多人会话隔离

- 每个用户维护独立的 Claude Code session（`--resume` 参数）
- 系统级任务（定时巡检、周报）使用专用 system session
- 群聊中的任务操作需鉴权后执行

### Phase 5：经验沉淀与知识库（Day 24-28）

**目标**：让秘书越用越聪明

#### 5.1 复盘机制

- 任务完成 → 自动触发复盘流程
- Claude Code 基于任务历史（创建时间、截止时间、实际完成时间、过程中的消息记录）生成复盘报告
- 复盘内容写入飞书文档（知识库）+ 多维表格的"复盘笔记"字段

#### 5.2 经验检索

- 创建新任务时，Claude Code 先搜索知识库中相似任务的经验
- 在分配任务时，参考历史数据判断谁最适合
- 在预估工期时，参考同类任务的历史耗时

---

## 四、飞书应用配置清单

### 4.1 权限清单（直接从官方插件文档复制）

```json
{
  "scopes": {
    "tenant": [
      "contact:contact.base:readonly",
      "im:chat:read",
      "im:chat:update",
      "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly",
      "im:message:readonly",
      "im:message:send_as_bot",
      "im:message:send_multi_users",
      "im:message:update",
      "im:resource",
      "cardkit:card:write",
      "cardkit:card:read"
    ],
    "user": [
      "contact:user.employee_id:readonly",
      "offline_access",
      "base:field:create", "base:field:read", "base:field:update",
      "base:record:create", "base:record:delete", "base:record:retrieve", "base:record:update",
      "base:table:create", "base:table:read", "base:table:update",
      "base:view:read", "base:view:write_only",
      "base:app:create", "base:app:read", "base:app:update",
      "calendar:calendar:read",
      "calendar:calendar.event:create", "calendar:calendar.event:delete",
      "calendar:calendar.event:read", "calendar:calendar.event:update",
      "calendar:calendar.free_busy:read",
      "contact:user.base:readonly", "contact:user:search",
      "docx:document:create", "docx:document:readonly", "docx:document:write_only",
      "drive:drive.metadata:readonly", "drive:file:upload",
      "im:chat.members:read", "im:chat:read",
      "im:message", "im:message:readonly",
      "im:message.send_as_user",
      "search:docs:read", "search:message",
      "task:comment:read", "task:comment:write",
      "task:task:read", "task:task:write", "task:task:writeonly",
      "task:tasklist:read", "task:tasklist:write",
      "wiki:node:create", "wiki:node:read", "wiki:space:read"
    ]
  }
}
```

### 4.2 事件订阅

| 事件 | 说明 |
|------|------|
| `im.message.receive_v1` | 接收消息（必选） |

**订阅方式**：使用长连接（WebSocket），无需公网 IP

### 4.3 机器人能力

- 添加"机器人"应用能力
- 每次权限变更后必须"创建版本" → "发布"

---

## 五、关键技术风险与应对

| 风险 | 影响 | 应对方案 |
|------|------|----------|
| Claude Code CLI 启动延迟（冷启动 3-5s） | 用户等待时间长 | 发送"思考中"卡片；预热 session |
| 飞书 API 频率限制 | 流式更新消息卡片容易触发限流 | 控制卡片更新频率 ≥ 1.5s/次；批量操作合并请求 |
| 用户 Access Token 过期 | 飞书 OAuth Token 有效期有限 | 使用 `offline_access` scope + refresh token 自动续期 |
| Claude Code 上下文窗口限制（200K） | 长对话可能溢出 | 用多维表格做持久化，对话中只加载必要上下文 |
| 多人并发调用 Claude Code | 资源竞争 | 任务队列 + 并发限制（建议最多 3 个并行 Claude Code 进程） |

---

## 六、里程碑与验收标准

| 里程碑 | 时间 | 验收标准 |
|--------|------|----------|
| M0: Hello World | Day 2 | 飞书 @Bot → 收到 Claude 回复 |
| M1: MCP 工具可用 | Day 7 | Claude Code 能通过 MCP 发消息、创建任务、查通讯录 |
| M2: 秘书基础流程 | Day 14 | "帮我创建一个任务给小王" → 自动创建飞书任务 + 多维表格记录 + 通知小王 |
| M3: 定时巡检 | Day 18 | 每日 9:30 自动发送任务简报到群 |
| M4: 多人协作 | Day 23 | 老板和员工可以同时使用，各自看到不同范围的任务 |
| M5: 经验沉淀 | Day 28 | 任务完成后自动复盘，新任务创建时参考历史经验 |

---

## 七、后续扩展方向

- **语音指令**：飞书语音消息 → 语音转文字 → 秘书处理
- **审批流对接**：与飞书审批打通，秘书可发起/查询审批
- **邮件处理**：读取飞书邮箱，自动分类和提取待办
- **多团队支持**：支持多个部门各自有独立的秘书配置
- **仪表盘**：基于多维表格数据，自动生成团队效能看板

---

## 八、开发环境准备 Checklist

开始开发前，确保以下环境就绪：

- [ ] Node.js ≥ 22 已安装
- [ ] Claude Code CLI 已安装且登录（`claude --version`）
- [ ] 飞书开发者账号已创建（open.feishu.cn）
- [ ] 飞书企业自建应用已创建，App ID / App Secret 已获取
- [ ] 机器人能力已添加，权限已导入并发布
- [ ] 事件订阅已配置（长连接 + `im.message.receive_v1`）
- [ ] Anthropic 官方订阅账号可用（Claude Code 需要）
- [ ] 测试飞书群已创建，Bot 已拉入群
