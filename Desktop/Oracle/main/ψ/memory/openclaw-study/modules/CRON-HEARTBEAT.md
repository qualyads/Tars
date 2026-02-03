# OpenClaw Cron/Heartbeat System - Deep Analysis

> เป้าหมาย: เข้าใจ Heartbeat System เพื่อ upgrade Oracle Autonomy
> Status: ✅ Core understanding complete

## 1. Overview

Cron System ทำให้ AI "ตื่น" ขึ้นมาเองโดยไม่ต้องรอคนสั่ง

```
┌─────────────────────────────────────────────────────────┐
│                     CronService                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌──────────┐  │
│   │  Schedule   │ →  │   Timer     │ →  │ Execute  │  │
│   │  "at"       │    │   armTimer  │    │  Job     │  │
│   │  "every"    │    │   wake      │    │          │  │
│   │  "cron"     │    │             │    │          │  │
│   └─────────────┘    └─────────────┘    └──────────┘  │
│                                                         │
│   Jobs stored in: ~/.openclaw/cron.json                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 2. Schedule Types

```typescript
type CronSchedule =
  | { kind: "at"; atMs: number }           // Run once at specific time
  | { kind: "every"; everyMs: number }     // Run every X milliseconds
  | { kind: "cron"; expr: string; tz?: string };  // Cron expression
```

### Examples

```javascript
// Run every 15 minutes
{ kind: "every", everyMs: 15 * 60 * 1000 }

// Run at specific timestamp
{ kind: "at", atMs: Date.now() + 3600000 }

// Run every day at 9 AM Bangkok time
{ kind: "cron", expr: "0 9 * * *", tz: "Asia/Bangkok" }

// Run every Monday at 10 AM
{ kind: "cron", expr: "0 10 * * 1", tz: "Asia/Bangkok" }
```

## 3. Payload Types

### SystemEvent
```typescript
{
  kind: "systemEvent",
  text: "Time to check bookings"
}
```
Internal event - no AI response generated

### AgentTurn
```typescript
{
  kind: "agentTurn",
  message: "Check today's bookings and notify me if any issues",
  model: "claude-3-5-sonnet",
  thinking: "low",
  deliver: true,           // Send response to user?
  channel: "whatsapp",     // Which channel to deliver
  to: "user_id",          // Who to send to
  bestEffortDeliver: true // Don't fail if delivery fails
}
```
AI generates response and optionally delivers to user

## 4. Session Targets

| Target | Description |
|--------|-------------|
| `main` | Run in main conversation session |
| `isolated` | Run in separate session (doesn't pollute main context) |

### Isolation Options
```typescript
{
  isolation: {
    postToMainPrefix: "[Auto-check]",
    postToMainMode: "summary",  // or "full"
    postToMainMaxChars: 8000
  }
}
```

## 5. CronJob Structure

```typescript
type CronJob = {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;  // One-shot job
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "now" | "next-heartbeat";
  payload: CronPayload;
  isolation?: CronIsolation;
  state: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: "ok" | "error" | "skipped";
    lastError?: string;
    lastDurationMs?: number;
  };
};
```

## 6. CronService API

```typescript
class CronService {
  // Lifecycle
  async start(): Promise<void>;
  stop(): void;
  async status(): Promise<CronStatus>;

  // Job management
  async list(opts?: { includeDisabled?: boolean }): Promise<CronJob[]>;
  async add(input: CronJobCreate): Promise<CronJob>;
  async update(id: string, patch: CronJobPatch): Promise<CronJob>;
  async remove(id: string): Promise<{ ok: boolean; removed: boolean }>;

  // Execution
  async run(id: string, mode?: "due" | "force"): Promise<RunResult>;
  wake(opts: { mode: "now" | "next-heartbeat"; text: string }): void;
}
```

## 7. Implementation for Oracle

### Step 1: Create cron job store
```javascript
// oracle-agent/lib/cron-store.js
class CronStore {
  constructor(storePath) {
    this.storePath = storePath;
    this.jobs = [];
    this.load();
  }

  load() {
    if (fs.existsSync(this.storePath)) {
      const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      this.jobs = data.jobs || [];
    }
  }

  save() {
    fs.writeFileSync(this.storePath, JSON.stringify({
      version: 1,
      jobs: this.jobs
    }, null, 2));
  }

  addJob(job) {
    job.id = randomUUID();
    job.createdAtMs = Date.now();
    job.updatedAtMs = Date.now();
    job.state = { nextRunAtMs: this.computeNextRun(job) };
    this.jobs.push(job);
    this.save();
    return job;
  }

  computeNextRun(job) {
    const now = Date.now();
    if (job.schedule.kind === 'at') {
      return job.schedule.atMs;
    }
    if (job.schedule.kind === 'every') {
      return now + job.schedule.everyMs;
    }
    // For cron expressions, use cron-parser library
    return now + 60000; // placeholder
  }
}
```

### Step 2: Create cron service
```javascript
// oracle-agent/lib/cron-service.js
class OracleCronService {
  constructor(store, executor) {
    this.store = store;
    this.executor = executor;
    this.timer = null;
  }

  start() {
    this.scheduleNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleNext() {
    const nextJob = this.getNextDueJob();
    if (!nextJob) return;

    const delay = Math.max(0, nextJob.state.nextRunAtMs - Date.now());
    this.timer = setTimeout(() => this.executeJob(nextJob), delay);
  }

  async executeJob(job) {
    console.log(`[CRON] Executing: ${job.name}`);

    try {
      if (job.payload.kind === 'agentTurn') {
        const response = await this.executor.run(job.payload.message);

        if (job.payload.deliver) {
          await this.deliver(job.payload.channel, job.payload.to, response);
        }
      }

      job.state.lastStatus = 'ok';
      job.state.lastRunAtMs = Date.now();
    } catch (error) {
      job.state.lastStatus = 'error';
      job.state.lastError = error.message;
    }

    // Compute next run
    job.state.nextRunAtMs = this.store.computeNextRun(job);
    this.store.save();

    // Schedule next
    this.scheduleNext();
  }
}
```

### Step 3: Define Oracle jobs
```javascript
// Example jobs for Oracle
const oracleJobs = [
  {
    name: "morning-briefing",
    description: "Send morning briefing to Tars",
    enabled: true,
    schedule: { kind: "cron", expr: "0 7 * * *", tz: "Asia/Bangkok" },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message: "Generate morning briefing: today's check-ins, check-outs, occupancy, any alerts",
      deliver: true,
      channel: "line",
      to: "Tars"
    }
  },
  {
    name: "booking-monitor",
    description: "Check for new bookings every 15 minutes",
    enabled: true,
    schedule: { kind: "every", everyMs: 15 * 60 * 1000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message: "Check Beds24 for new bookings since last check. Alert if any important.",
      deliver: false  // Only alert if needed
    }
  },
  {
    name: "crypto-check",
    description: "Check crypto prices every hour",
    enabled: true,
    schedule: { kind: "every", everyMs: 60 * 60 * 1000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message: "Check BTC and ETH prices. Alert if changed more than 5%.",
      deliver: false
    }
  }
];
```

## 8. Comparison: Oracle vs OpenClaw

| Feature | Oracle (Current) | OpenClaw | Oracle (Upgraded) |
|---------|-----------------|----------|-------------------|
| Interval | Fixed 15 min | Configurable | Configurable |
| Schedule types | Every only | at/every/cron | at/every/cron |
| Job management | Hardcoded | CRUD API | CRUD API |
| Session isolation | No | Yes | Yes |
| Delivery options | LINE only | Multi-channel | LINE + configurable |

## 9. Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/cron/service.ts` | Main service class | 49 |
| `src/cron/service/ops.ts` | CRUD operations | 147 |
| `src/cron/types.ts` | Type definitions | 95 |
| `src/cron/schedule.ts` | Schedule computation | ~50 |

---
*Analyzed: 2026-02-03*
