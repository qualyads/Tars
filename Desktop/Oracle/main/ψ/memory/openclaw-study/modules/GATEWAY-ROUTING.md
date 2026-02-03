# OpenClaw Gateway & Routing System

> ศึกษาวิธีที่ OpenClaw route messages ระหว่าง channels
> Status: ✅ Core patterns understood
> Location: `src/gateway/`, `src/auto-reply/reply/`, `src/line/`

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Gateway Architecture                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Inbound                    Gateway                   Outbound  │
│  ┌───────┐                 ┌─────────────────┐      ┌───────┐  │
│  │ LINE  │──webhook──►     │                 │ ──►  │ LINE  │  │
│  │Webhook│                 │  ChannelManager │      │ Push  │  │
│  └───────┘                 │  + RouteReply   │      └───────┘  │
│  ┌───────┐                 │                 │      ┌───────┐  │
│  │Telegram──polling──►     │  Session State  │ ──►  │Telegram  │
│  │  Bot  │                 │  + Run Queue    │      │  Bot  │  │
│  └───────┘                 │                 │      └───────┘  │
│  ┌───────┐                 │  Agent Handler  │      ┌───────┐  │
│  │Discord│──gateway──►     │  + Broadcasts   │ ──►  │Discord│  │
│  │  Bot  │                 │                 │      │  Bot  │  │
│  └───────┘                 └─────────────────┘      └───────┘  │
│                                    ▲                           │
│                                    │                           │
│                            ┌───────────────┐                   │
│                            │   AI Agent    │                   │
│                            │   (Claude)    │                   │
│                            └───────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2. ChannelManager - Core Component

จัดการ lifecycle ของทุก channel (start/stop/status)

```typescript
// src/gateway/server-channels.ts

export type ChannelManager = {
  getRuntimeSnapshot: () => ChannelRuntimeSnapshot;
  startChannels: () => Promise<void>;
  startChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  stopChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  markChannelLoggedOut: (channelId: ChannelId, cleared: boolean, accountId?: string) => void;
};

export function createChannelManager(opts: ChannelManagerOptions): ChannelManager {
  const channelStores = new Map<ChannelId, ChannelRuntimeStore>();

  const startChannel = async (channelId: ChannelId, accountId?: string) => {
    const plugin = getChannelPlugin(channelId);
    const startAccount = plugin?.gateway?.startAccount;
    if (!startAccount) return;

    const cfg = loadConfig();
    const accountIds = accountId ? [accountId] : plugin.config.listAccountIds(cfg);

    await Promise.all(
      accountIds.map(async (id) => {
        // 1. Check if already running
        if (store.tasks.has(id)) return;

        // 2. Resolve account config
        const account = plugin.config.resolveAccount(cfg, id);

        // 3. Check enabled/configured
        const enabled = plugin.config.isEnabled(account, cfg);
        if (!enabled) {
          setRuntime(channelId, id, { running: false, lastError: "disabled" });
          return;
        }

        // 4. Create abort controller for graceful shutdown
        const abort = new AbortController();
        store.aborts.set(id, abort);

        // 5. Start the channel provider
        const task = startAccount({
          cfg,
          accountId: id,
          account,
          runtime: channelRuntimeEnvs[channelId],
          abortSignal: abort.signal,
          log,
          getStatus: () => getRuntime(channelId, id),
          setStatus: (next) => setRuntime(channelId, id, next),
        });

        store.tasks.set(id, tracked);
      }),
    );
  };
}
```

**Key Insight:** แต่ละ account มี AbortController แยก → สามารถ stop แค่บาง account ได้

## 3. Route Reply - Message Routing

```typescript
// src/auto-reply/reply/route-reply.ts

export async function routeReply(params: RouteReplyParams): Promise<RouteReplyResult> {
  const { payload, channel, to, accountId, threadId, cfg, abortSignal } = params;

  // 1. Normalize the payload
  const normalized = normalizeReplyPayload(payload, { responsePrefix });
  if (!normalized) return { ok: true };

  // 2. Skip empty replies
  if (!text.trim() && mediaUrls.length === 0) return { ok: true };

  // 3. Validate channel
  const channelId = normalizeChannelId(channel);
  if (!channelId) return { ok: false, error: `Unknown channel: ${channel}` };

  // 4. Check abort signal
  if (abortSignal?.aborted) return { ok: false, error: "Reply routing aborted" };

  try {
    // 5. Deliver to channel (lazy import for performance)
    const { deliverOutboundPayloads } = await import("../../infra/outbound/deliver.js");
    const results = await deliverOutboundPayloads({
      cfg,
      channel: channelId,
      to,
      accountId,
      payloads: [normalized],
      replyToId,
      threadId,
      abortSignal,
      // 6. Mirror to transcript if session exists
      mirror: params.sessionKey ? { sessionKey, agentId, text, mediaUrls } : undefined,
    });

    return { ok: true, messageId: results.at(-1)?.messageId };
  } catch (err) {
    return { ok: false, error: `Failed to route reply: ${err.message}` };
  }
}
```

**Key Patterns:**
1. **Originating Channel** - Reply กลับไป channel เดิมที่ message มา
2. **Lazy Import** - โหลด outbound module ตอน runtime เท่านั้น
3. **Transcript Mirror** - บันทึก reply ลง session transcript

## 4. LINE Bot Handler Flow

```typescript
// src/line/bot.ts

export function createLineBot(opts: LineBotOptions): LineBot {
  const account = resolveLineAccount({ cfg, accountId: opts.accountId });
  const mediaMaxBytes = (opts.mediaMaxMb ?? 10) * 1024 * 1024;

  const handleWebhook = async (body: WebhookRequestBody): Promise<void> => {
    if (!body.events || body.events.length === 0) return;

    // Delegate to event handlers
    await handleLineWebhookEvents(body.events, {
      cfg,
      account,
      runtime,
      mediaMaxBytes,
      processMessage,
    });
  };

  return { handleWebhook, account };
}
```

### LINE Webhook Flow
```
1. LINE Platform sends webhook → /line/webhook
2. Express middleware validates signature (channelSecret)
3. handleWebhook() parses events
4. handleLineWebhookEvents() routes by event type:
   - message → handleMessageEvent() → processMessage()
   - postback → handlePostbackEvent() → processMessage()
   - follow/unfollow → handleFollowEvent()
5. processMessage() → AI Agent → routeReply() → LINE Push API
```

## 5. Chat Run State

Gateway tracks active AI conversations:

```typescript
// src/gateway/server-chat.ts

export type ChatRunRegistry = {
  add: (sessionId: string, entry: ChatRunEntry) => void;
  peek: (sessionId: string) => ChatRunEntry | undefined;
  shift: (sessionId: string) => ChatRunEntry | undefined;
  remove: (sessionId: string, clientRunId: string) => ChatRunEntry | undefined;
  clear: () => void;
};

export type ChatRunState = {
  registry: ChatRunRegistry;
  buffers: Map<string, string>;         // Streaming text buffer
  deltaSentAt: Map<string, number>;     // Throttle delta broadcasts
  abortedRuns: Map<string, number>;     // Track cancelled runs
  clear: () => void;
};
```

### Streaming Delta Pattern
```typescript
const emitChatDelta = (sessionKey, clientRunId, seq, text) => {
  // 1. Buffer the text
  chatRunState.buffers.set(clientRunId, text);

  // 2. Throttle broadcasts (150ms)
  const now = Date.now();
  const last = chatRunState.deltaSentAt.get(clientRunId) ?? 0;
  if (now - last < 150) return;
  chatRunState.deltaSentAt.set(clientRunId, now);

  // 3. Broadcast to connected clients
  broadcast("chat", {
    runId: clientRunId,
    sessionKey,
    seq,
    state: "delta",
    message: { role: "assistant", content: [{ type: "text", text }] },
  });
};
```

**Key Insight:** LINE ใช้ `blockStreaming: true` → ไม่ stream แต่รอจบก่อนส่ง

## 6. Boot System

Gateway สามารถรัน "boot" task ตอน startup:

```typescript
// src/gateway/boot.ts

export async function runBootOnce(params: {
  cfg: OpenClawConfig;
  deps: CliDeps;
  workspaceDir: string;
}): Promise<BootRunResult> {
  // 1. Load BOOT.md file
  const result = await loadBootFile(params.workspaceDir);
  if (result.status === "missing" || result.status === "empty") {
    return { status: "skipped", reason: result.status };
  }

  // 2. Build boot prompt
  const message = buildBootPrompt(result.content);

  // 3. Run agent with boot instructions
  await agentCommand({
    message,
    sessionKey,
    deliver: false,  // Don't send reply anywhere
  }, bootRuntime, params.deps);

  return { status: "ran" };
}
```

**Use Case:** ส่ง morning briefing, health checks, etc.

## 7. Key Insights for Oracle

### What OpenClaw Does Well
1. **Multi-account per channel** - Oracle มีแค่ 1 LINE account
2. **Streaming throttle** - 150ms interval ป้องกัน flood
3. **Lazy loading** - Import outbound modules เฉพาะเมื่อใช้
4. **Abort signals** - Graceful shutdown ทุก level
5. **Transcript mirroring** - ทุก reply บันทึกลง session

### What to Copy
1. **AbortController pattern** - ใส่ใน Oracle server
2. **Boot system** - BOOT.md สำหรับ startup tasks
3. **Delta throttling** - ถ้าจะทำ streaming ในอนาคต

### Oracle's Current Advantage
1. **Simpler architecture** - ไม่ต้อง manage หลาย accounts
2. **Direct Claude Max** - ไม่ผ่าน API ราคาแพง
3. **Tars-specific** - customize ได้เต็มที่

## 8. Flow Comparison

### OpenClaw Flow
```
LINE Webhook
    ↓
Gateway Server (Express)
    ↓
ChannelManager.startChannel()
    ↓
handleLineWebhookEvents()
    ↓
processMessage() → AI Agent
    ↓
routeReply() → deliverOutboundPayloads()
    ↓
LINE Push API
```

### Oracle Flow (Current)
```
LINE Webhook
    ↓
Express Server (server.js)
    ↓
handleLineMessage()
    ↓
Claude API / Claude Max
    ↓
sendReply()
    ↓
LINE Push API
```

**Difference:** OpenClaw มี abstraction layers มากกว่า (ChannelManager, RouteReply, Plugin system) ในขณะที่ Oracle ตรงและง่ายกว่า

---
*Analyzed: 2026-02-03*
*Files: server-channels.ts (~250 lines), route-reply.ts (~160 lines), bot.ts (~84 lines), server-chat.ts (~200 lines), boot.ts (~95 lines)*
