# Infrastructure System - สรุปจาก OpenClaw

> **สถานะ:** ✅ Implement แล้ว
> **ไฟล์ที่อ่าน:** ~30 files ใน `src/infra/`, `src/logging/`
> **Patterns หลัก:** Structured Logging, Retry, Dedupe, Error Classification

## สรุปเข้าใจง่าย

Infrastructure คือ **ระบบพื้นฐาน** ที่ทุก module ใช้ร่วมกัน:
- Logging - บันทึก log
- Retry - ลองใหม่เมื่อ error
- Dedupe - ป้องกันทำซ้ำ
- Error classification - แยกประเภท error

## 1. Structured Logging

### Subsystem Prefixes

```javascript
// ❌ ไม่ดี
console.log('เริ่มทำงาน');

// ✅ ดี
info('gateway: เริ่มทำงาน');
info('line: ได้รับ webhook');
info('autonomy: trigger morning briefing');
```

### Log Levels

| Level | ใช้เมื่อ | ตัวอย่าง |
|-------|---------|---------|
| `fatal` | พังหมด ต้องปิด | Out of memory |
| `error` | ผิดพลาด แต่ทำงานต่อได้ | API error |
| `warn` | น่าสงสัย แต่ไม่พัง | Config deprecated |
| `info` | ข้อมูลปกติ | Server started |
| `debug` | สำหรับ debug | Request details |
| `trace` | ละเอียดมาก | Every step |

### วิธีใช้

```javascript
import { info, warn, error, createSubsystemLogger } from './lib/logger.js';

// แบบง่าย
info('gateway: server started on port 3456');
error('line: webhook failed', { error: err.message });

// แบบ subsystem logger
const log = createSubsystemLogger('autonomy');
log.info('morning briefing sent');
log.warn('trigger delayed');
```

## 2. Retry with Exponential Backoff

### หลักการ

```
Attempt 1: รอ 300ms
Attempt 2: รอ 600ms  (300 × 2)
Attempt 3: รอ 1200ms (300 × 4)
...
+ Jitter (สุ่มเพิ่ม/ลด) เพื่อไม่ให้ทุกคน retry พร้อมกัน
```

### Error Classification

| ประเภท | Retry? | ตัวอย่าง |
|--------|--------|---------|
| Transient | ✅ ได้ | Timeout, Connection reset |
| Fatal | ❌ ไม่ได้ | Out of memory |
| Config | ❌ ไม่ได้ | Missing API key |
| Abort | ❌ ไม่ได้ | User cancelled |

### วิธีใช้

```javascript
import { retryAsync, withRetry, isTransientError } from './lib/retry.js';

// แบบ retryAsync
const result = await retryAsync(
  () => callAPI(),
  {
    attempts: 3,
    minDelayMs: 500,
    maxDelayMs: 30000,
    jitter: 0.1,
    onRetry: (info) => {
      console.log(`Retry ${info.attempt}/${info.maxAttempts}`);
    }
  }
);

// แบบ withRetry (wrap function)
const safeCall = withRetry(callAPI, { attempts: 3 });
const result = await safeCall();
```

### Platform Configs

```javascript
import { LINE_RETRY_CONFIG, ANTHROPIC_RETRY_CONFIG } from './lib/retry.js';

// LINE API
await retryAsync(() => lineClient.pushMessage(...), LINE_RETRY_CONFIG);

// Anthropic API
await retryAsync(() => claude.messages.create(...), ANTHROPIC_RETRY_CONFIG);
```

## 3. Deduplication Cache

### หลักการ

```
Message A เข้ามา → เช็ค → ไม่เคยเห็น → ประมวลผล + บันทึก
Message A เข้ามาอีก (ภายใน TTL) → เช็ค → เคยเห็น → ข้าม
```

### วิธีใช้

```javascript
import { createDedupeCache, createMessageDedupeCache } from './lib/dedupe.js';

// สร้าง cache
const dedupe = createMessageDedupeCache();

// เช็คก่อนประมวลผล
if (dedupe.check(messageId)) {
  return; // duplicate, skip
}

// ประมวลผลข้อความ
await processMessage(message);
```

### Specialized Caches

```javascript
// Message dedupe (TTL 10s)
const msgDedupe = createMessageDedupeCache();

// Webhook dedupe (TTL 1 min)
const webhookDedupe = createWebhookDedupeCache();

// Session dedupe (TTL 5 min)
const sessionDedupe = createSessionDedupeCache();
```

### withDedupe Decorator

```javascript
import { withDedupe } from './lib/dedupe.js';

// Wrap function
const safeProcess = withDedupe(
  processMessage,
  { ttlMs: 10000 },
  (msg) => msg.id  // key function
);

// ใช้งาน - จะข้าม duplicate อัตโนมัติ
await safeProcess(message);
```

## 4. Error Classification

### ตรวจสอบประเภท Error

```javascript
import { isTransientError, isFatalError, isConfigError, isAbortError } from './lib/retry.js';

try {
  await doSomething();
} catch (err) {
  if (isAbortError(err)) {
    // User cancelled - ไม่ต้องทำอะไร
    return;
  }

  if (isConfigError(err)) {
    // Config ผิด - แจ้งเตือนแล้วหยุด
    error('config: ' + err.message);
    process.exit(1);
  }

  if (isTransientError(err)) {
    // Network issue - retry ได้
    await retryAsync(() => doSomething());
  }

  if (isFatalError(err)) {
    // พังหมด - crash
    throw err;
  }
}
```

## ไฟล์ที่ Implement

| ไฟล์ | หน้าที่ |
|------|--------|
| `lib/logger.js` | Structured logging, subsystems |
| `lib/retry.js` | Retry, backoff, error classification |
| `lib/dedupe.js` | Deduplication cache |

## ตัวอย่างใช้งานรวม

```javascript
import {
  info, error, createSubsystemLogger,
  retryAsync, LINE_RETRY_CONFIG,
  createMessageDedupeCache
} from './lib/index.js';

const log = createSubsystemLogger('line');
const dedupe = createMessageDedupeCache();

async function handleWebhook(event) {
  // 1. Dedupe
  if (dedupe.check(event.webhookEventId)) {
    log.debug('duplicate webhook, skipping');
    return;
  }

  // 2. Process with retry
  try {
    const result = await retryAsync(
      () => processEvent(event),
      {
        ...LINE_RETRY_CONFIG,
        onRetry: (info) => log.warn(`retry ${info.attempt}`)
      }
    );

    log.info('webhook processed', { eventId: event.webhookEventId });
    return result;
  } catch (err) {
    log.error('webhook failed', { error: err.message });
    throw err;
  }
}
```

---
*สรุป: 2026-02-03*
