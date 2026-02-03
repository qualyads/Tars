# OpenClaw Heartbeat System - Deep Dive

> Heartbeat = Periodic AI "wake-ups" ที่แยกออกจาก Cron
> Status: ✅ Core patterns understood
> Location: `src/auto-reply/heartbeat.ts`, `src/infra/heartbeat-*.ts`

## ⚠️ IMPORTANT: Heartbeat ≠ Cron

| Feature | Heartbeat | Cron |
|---------|-----------|------|
| **Purpose** | AI checks for tasks periodically | Scheduled jobs |
| **Config file** | `HEARTBEAT.md` | Cron config |
| **Token** | `HEARTBEAT_OK` | - |
| **Prompt** | Custom per run | Task-specific |
| **Delivery** | To "last" contact or configured target | Task output |

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Heartbeat Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Timer                   Heartbeat Runner              Delivery │
│  ┌─────────┐            ┌─────────────────┐         ┌────────┐ │
│  │Interval │──trigger──►│ runHeartbeatOnce │──reply──►│Channel │ │
│  │ (30m)   │            │                 │         │(LINE,  │ │
│  └─────────┘            │ 1. Check active │         │Telegram│ │
│       ▲                 │    hours        │         │etc.)   │ │
│       │                 │ 2. Check queue  │         └────────┘ │
│       │                 │ 3. Read HEARTBEAT.md                 │
│  ┌─────────┐            │ 4. Call AI      │                    │
│  │  Wake   │            │ 5. Strip token  │                    │
│  │ Handler │◄──events───│ 6. Route reply  │                    │
│  └─────────┘            └─────────────────┘                    │
│                                ▲                                │
│                                │                                │
│                       ┌────────────────┐                       │
│                       │  HEARTBEAT.md  │                       │
│                       │  (Bootstrap)   │                       │
│                       └────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Core Constants

```typescript
// src/auto-reply/heartbeat.ts

export const HEARTBEAT_PROMPT =
  "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. " +
  "Do not infer or repeat old tasks from prior chats. " +
  "If nothing needs attention, reply HEARTBEAT_OK.";

export const DEFAULT_HEARTBEAT_EVERY = "30m";        // Default: 30 minutes
export const DEFAULT_HEARTBEAT_ACK_MAX_CHARS = 300;  // Max chars for "ok" ack

// HEARTBEAT_OK token - AI replies this when nothing to report
// Token stripped before delivery to avoid sending "nothing" messages
```

## 3. HEARTBEAT.md Bootstrap File

```typescript
// src/agents/workspace.ts
export const DEFAULT_HEARTBEAT_FILENAME = "HEARTBEAT.md";
```

**Purpose:** Workspace instructions for AI during heartbeat runs

**Example HEARTBEAT.md:**
```markdown
# Heartbeat Tasks

## Every Check
- Check calendar for today's events
- Review pending tasks

## Morning (8:00-10:00)
- Send daily briefing
- Check overnight messages

## Nothing to report
If no tasks need attention, reply: HEARTBEAT_OK
```

### Empty File Detection

```typescript
// Checks if HEARTBEAT.md has no actionable content
export function isHeartbeatContentEffectivelyEmpty(content: string): boolean {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip: empty, headers (#), empty checkboxes (- [ ])
    if (!trimmed) continue;
    if (/^#+(\s|$)/.test(trimmed)) continue;
    if (/^[-*+]\s*(\[[\sXx]?\]\s*)?$/.test(trimmed)) continue;

    // Found actionable content
    return false;
  }
  return true;  // All lines were empty/headers/checkboxes
}
```

**Key Insight:** ถ้า HEARTBEAT.md ว่าง → skip API call (ประหยัด cost)

## 4. HEARTBEAT_OK Token System

AI ตอบ `HEARTBEAT_OK` เมื่อไม่มีอะไรต้องรายงาน

```typescript
// src/auto-reply/tokens.ts
export const HEARTBEAT_TOKEN = "HEARTBEAT_OK";

// src/auto-reply/heartbeat.ts
export function stripHeartbeatToken(raw?: string, opts = {}) {
  // 1. Empty text → skip
  if (!raw?.trim()) return { shouldSkip: true, text: "", didStrip: false };

  // 2. No token → keep original
  const hasToken = raw.includes(HEARTBEAT_TOKEN);
  if (!hasToken) return { shouldSkip: false, text: raw.trim(), didStrip: false };

  // 3. Strip token from edges
  let text = raw.trim();
  if (text.startsWith(HEARTBEAT_TOKEN)) {
    text = text.slice(HEARTBEAT_TOKEN.length).trimStart();
  }
  if (text.endsWith(HEARTBEAT_TOKEN)) {
    text = text.slice(0, -HEARTBEAT_TOKEN.length).trimEnd();
  }

  // 4. If nothing left → skip
  if (!text) return { shouldSkip: true, text: "", didStrip: true };

  // 5. If text is short "ack" (< maxAckChars) → skip
  if (opts.mode === "heartbeat" && text.length <= opts.maxAckChars) {
    return { shouldSkip: true, text: "", didStrip: true };
  }

  // 6. Keep remaining text
  return { shouldSkip: false, text, didStrip: true };
}
```

**Use Cases:**
- `"HEARTBEAT_OK"` → skip (nothing to send)
- `"HEARTBEAT_OK All good!"` → skip (short ack)
- `"HEARTBEAT_OK Check-in at 3pm today."` → send "Check-in at 3pm today."

## 5. Active Hours

Heartbeat สามารถ configure ให้ทำงานเฉพาะเวลาที่กำหนด

```typescript
// Config
heartbeat:
  every: "30m"
  activeHours:
    start: "08:00"     # Start time
    end: "22:00"       # End time
    timezone: "user"   # "user" | "local" | IANA timezone

// Logic
function isWithinActiveHours(cfg, heartbeat, nowMs) {
  const active = heartbeat?.activeHours;
  if (!active) return true;  // No config = always active

  const startMin = parseTime(active.start);  // e.g., 8:00 = 480
  const endMin = parseTime(active.end);       // e.g., 22:00 = 1320

  const timeZone = resolveActiveHoursTimezone(cfg, active.timezone);
  const currentMin = resolveMinutesInTimeZone(nowMs, timeZone);

  // Support overnight ranges (e.g., 22:00 - 06:00)
  if (endMin > startMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  return currentMin >= startMin || currentMin < endMin;
}
```

## 6. Visibility Controls

```typescript
// src/infra/heartbeat-visibility.ts

export type ResolvedHeartbeatVisibility = {
  showOk: boolean;      // Show "HEARTBEAT_OK" messages
  showAlerts: boolean;  // Show content messages
  useIndicator: boolean; // Emit indicator events for UI
};

const DEFAULT_VISIBILITY = {
  showOk: false,       // Silent by default
  showAlerts: true,    // Show content messages
  useIndicator: true,  // Emit events for UI
};

// Precedence: per-account > per-channel > channel-defaults > global defaults
```

**Config Example:**
```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
  line:
    heartbeat:
      showAlerts: false  # Disable LINE heartbeat alerts
    accounts:
      hotel:
        heartbeat:
          showAlerts: true  # But enable for hotel account
```

## 7. Wake Handler System

External events สามารถ trigger heartbeat ได้

```typescript
// src/infra/heartbeat-wake.ts

const DEFAULT_COALESCE_MS = 250;   // Debounce interval
const DEFAULT_RETRY_MS = 1_000;    // Retry after busy

// Request immediate heartbeat
export function requestHeartbeatNow(opts?: { reason?: string; coalesceMs?: number }) {
  pendingReason = opts?.reason ?? "requested";
  schedule(opts?.coalesceMs ?? DEFAULT_COALESCE_MS);
}

// Check if wake handler is set
export function hasHeartbeatWakeHandler() {
  return handler !== null;
}
```

**Wake Reasons:**
- `"interval"` - Regular scheduled run
- `"requested"` - Manual trigger
- `"exec-event"` - Async command completed
- `"retry"` - Previous run was busy

## 8. Event System

```typescript
// src/infra/heartbeat-events.ts

export type HeartbeatEventPayload = {
  ts: number;
  status: "sent" | "ok-empty" | "ok-token" | "skipped" | "failed";
  to?: string;
  preview?: string;
  durationMs?: number;
  hasMedia?: boolean;
  reason?: string;
  channel?: string;
  silent?: boolean;
  indicatorType?: "ok" | "alert" | "error";
};

// Emit event
export function emitHeartbeatEvent(evt: Omit<HeartbeatEventPayload, "ts">) {
  const enriched = { ts: Date.now(), ...evt };
  lastHeartbeat = enriched;
  for (const listener of listeners) {
    listener(enriched);
  }
}

// Subscribe to events
export function onHeartbeatEvent(listener: (evt: HeartbeatEventPayload) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

## 9. Heartbeat Runner Flow

```typescript
// src/infra/heartbeat-runner.ts

export async function runHeartbeatOnce(opts) {
  // 1. Check enabled
  if (!heartbeatsEnabled) return { status: "skipped", reason: "disabled" };
  if (!isHeartbeatEnabledForAgent(cfg, agentId)) return { status: "skipped", reason: "disabled" };

  // 2. Check active hours
  if (!isWithinActiveHours(cfg, heartbeat, startedAt)) {
    return { status: "skipped", reason: "quiet-hours" };
  }

  // 3. Check queue (don't interrupt active conversations)
  if (getQueueSize() > 0) {
    return { status: "skipped", reason: "requests-in-flight" };
  }

  // 4. Check HEARTBEAT.md content
  const content = await fs.readFile(heartbeatFilePath, "utf-8");
  if (isHeartbeatContentEffectivelyEmpty(content)) {
    return { status: "skipped", reason: "empty-heartbeat-file" };
  }

  // 5. Resolve session and delivery target
  const { sessionKey, storePath } = resolveHeartbeatSession(cfg, agentId, heartbeat);
  const delivery = resolveHeartbeatDeliveryTarget({ cfg, entry, heartbeat });

  // 6. Run AI with heartbeat prompt
  const replyResult = await getReplyFromConfig(ctx, { isHeartbeat: true }, cfg);

  // 7. Process reply
  const replyPayload = resolveHeartbeatReplyPayload(replyResult);
  const stripped = stripHeartbeatToken(replyPayload?.text, { mode: "heartbeat", maxAckChars });

  // 8. Skip if just "HEARTBEAT_OK"
  if (stripped.shouldSkip && !hasMedia) {
    emitHeartbeatEvent({ status: "ok-token", ... });
    return { status: "ran", durationMs };
  }

  // 9. Check duplicate (same message within 24h)
  if (stripped.text === entry?.lastHeartbeatText) {
    return { status: "ran", durationMs }; // Don't nag
  }

  // 10. Deliver reply
  await deliverOutboundPayloads({
    cfg,
    channel: delivery.channel,
    to: delivery.to,
    accountId: delivery.accountId,
    payloads: [{ text: stripped.text, mediaUrls }],
  });

  // 11. Record for dedup
  store[sessionKey] = {
    ...current,
    lastHeartbeatText: stripped.text,
    lastHeartbeatSentAt: startedAt,
  };

  emitHeartbeatEvent({ status: "sent", preview: stripped.text.slice(0, 200) });
  return { status: "ran", durationMs };
}
```

## 10. Configuration

### Agent-Level Config
```yaml
agents:
  defaults:
    heartbeat:
      every: "30m"                    # Interval
      prompt: "Custom prompt..."      # Override default prompt
      target: "last"                  # "last" | specific target
      model: "claude-3-haiku"         # Override model
      ackMaxChars: 300                # Max chars for "ok" ack
      session: "main"                 # Session to use
      includeReasoning: false         # Include reasoning in reply
      activeHours:
        start: "08:00"
        end: "22:00"
        timezone: "user"

  list:
    - id: support-agent
      heartbeat:
        every: "15m"                  # More frequent for support
        activeHours:
          start: "09:00"
          end: "18:00"
```

### Channel-Level Config
```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true

  line:
    heartbeat:
      showOk: true                    # Show OK messages on LINE
```

## 11. Key Insights for Oracle

### What OpenClaw Does Right

1. **Separate from Cron** - Heartbeat is "AI check-in", Cron is "scheduled task"
2. **HEARTBEAT_OK Token** - ประหยัด messages เมื่อไม่มีอะไรรายงาน
3. **Active Hours** - ไม่รบกวนตอนกลางคืน
4. **Dedup Protection** - ไม่ส่งซ้ำภายใน 24h
5. **Queue Check** - ไม่ interrupt active conversations
6. **Visibility Controls** - Fine-grained control per channel/account

### Implementation Priority for Oracle

| Priority | Feature | Oracle Status |
|----------|---------|---------------|
| HIGH | Basic heartbeat (interval check) | ✅ Has autonomy engine |
| HIGH | HEARTBEAT_OK token | ❌ Not yet |
| MEDIUM | Active hours | ❌ Not yet |
| MEDIUM | Dedup protection | ❌ Not yet |
| LOW | Per-channel visibility | ❌ Not yet |

### Oracle vs OpenClaw

| Feature | Oracle | OpenClaw |
|---------|--------|----------|
| Check-in system | Autonomy Engine | Heartbeat |
| Config file | autonomy-config.json | HEARTBEAT.md |
| Token | - | HEARTBEAT_OK |
| Active hours | - | ✅ Built-in |
| Dedup | - | ✅ 24h window |

### What Oracle Should Add

1. **HEARTBEAT_OK Pattern**
```javascript
// Oracle implementation
const HEARTBEAT_OK = "HEARTBEAT_OK";

function processHeartbeatReply(reply) {
  if (!reply) return { skip: true };
  if (reply.trim() === HEARTBEAT_OK) return { skip: true };
  if (reply.startsWith(HEARTBEAT_OK)) {
    const rest = reply.slice(HEARTBEAT_OK.length).trim();
    if (rest.length < 300) return { skip: true };  // Short ack
    return { skip: false, text: rest };
  }
  return { skip: false, text: reply };
}
```

2. **Active Hours**
```javascript
function isActiveHours(config) {
  const { start, end, timezone } = config.activeHours || {};
  if (!start || !end) return true;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const [hour, minute] = formatter.format(now).split(':').map(Number);
  const currentMin = hour * 60 + minute;

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  if (endMin > startMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  return currentMin >= startMin || currentMin < endMin;
}
```

3. **Dedup Protection**
```javascript
// In autonomy engine
async function shouldSendHeartbeat(message) {
  const state = await loadAutonomousState();
  const lastHeartbeat = state.lastHeartbeatText;
  const lastSentAt = state.lastHeartbeatSentAt;

  // Skip duplicate within 24h
  if (message === lastHeartbeat) {
    const hoursSince = (Date.now() - lastSentAt) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      console.log('Skipping duplicate heartbeat');
      return false;
    }
  }

  // Record for dedup
  state.lastHeartbeatText = message;
  state.lastHeartbeatSentAt = Date.now();
  await saveAutonomousState(state);

  return true;
}
```

---
*Analyzed: 2026-02-03*
*Files: heartbeat.ts (158 lines), heartbeat-runner.ts (970 lines), heartbeat-visibility.ts (73 lines), heartbeat-wake.ts (77 lines), heartbeat-events.ts (58 lines)*
*Total: ~1,336 lines*
