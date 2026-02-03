# Hooks System - สรุปจาก OpenClaw

> **สถานะ:** ✅ Implement แล้ว
> **ไฟล์ที่อ่าน:** ~15 files ใน `src/hooks/`
> **Patterns หลัก:** Event Registry, Pub-Sub, Discovery, Eligibility

## สรุปเข้าใจง่าย

Hooks System คือระบบ **event-driven** ที่ให้ code อื่นๆ "แทรกตัว" เข้ามาทำงานได้
เหมือน plugin แต่เน้นเรื่อง **events**

### เปรียบเทียบ

| Plugin System | Hooks System |
|--------------|--------------|
| ลงทะเบียน commands/tools | ฟัง events |
| เรียกตรงๆ | ถูกเรียกอัตโนมัติ |
| ต้อง export register() | ต้อง export handler() |

## หลักการทำงาน

```
                    ┌─────────────────┐
                    │  Event เกิดขึ้น  │
                    │ (message:receive)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Hook Registry  │
                    │  Map<event, []> │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
   │Handler 1│          │Handler 2│         │Handler 3│
   │(logger) │          │(counter)│         │(filter) │
   └─────────┘          └─────────┘         └─────────┘
```

## Event Types ที่มี

| Type | Action | ตอนไหน |
|------|--------|--------|
| `message` | receive | ได้รับข้อความ |
| `message` | send | ส่งข้อความ |
| `session` | start | เริ่ม session |
| `session` | end | จบ session |
| `agent` | boot | Oracle เริ่มทำงาน |
| `agent` | shutdown | Oracle ปิด |
| `tool` | call | AI เรียก tool |
| `autonomy` | trigger | Autonomy ทำงาน |

## วิธีใช้งาน

### 1. Register Hook แบบ Manual

```javascript
import { registerHook, emit } from './lib/hooks-system.js';

// ลงทะเบียน
registerHook('message:receive', async (event) => {
  console.log('ได้รับข้อความ:', event.context.text);
});

// Trigger event
await emit('message', 'receive', {
  userId: 'U123',
  text: 'สวัสดี'
});
```

### 2. ใช้ Convenience Functions

```javascript
import { onMessageReceive, onSessionStart } from './lib/hooks-system.js';

onMessageReceive(async (event) => {
  console.log('ข้อความ:', event.context.text);
});

onSessionStart(async (event) => {
  console.log('Session เริ่ม!');
});
```

### 3. Load จาก Directory (HOOK.md)

```javascript
import { loadHooks } from './lib/hooks-system.js';

// โหลด hooks ทั้งหมดจาก ./hooks/
await loadHooks('./hooks');
```

## สร้าง Hook ใหม่

### โครงสร้างไฟล์

```
hooks/
└── my-hook/
    ├── HOOK.md      ← Metadata
    └── handler.js   ← Logic
```

### HOOK.md

```markdown
---
name: my-hook
description: ทำอะไรก็ว่าไป
events: ["message:receive"]
---

# My Hook

...documentation...
```

### handler.js

```javascript
export default async function handler(event) {
  const { type, action, context } = event;

  // ทำอะไรก็ว่าไป
  console.log(`${type}:${action}`, context);

  // Push message กลับ (optional)
  event.messages.push('Processed!');

  // Cancel event (optional)
  // event.cancelled = true;
}
```

## Features สำคัญ

### 1. Error Resilient

```javascript
// Hook error ไม่หยุด hooks อื่น
for (const handler of handlers) {
  try {
    await handler(event);
  } catch (err) {
    console.error(err); // Log แล้วไปต่อ
  }
}
```

### 2. Priority

```javascript
registerHook('message:receive', handler, {
  name: 'important-hook',
  priority: 10  // สูงกว่าถูกเรียกก่อน
});
```

### 3. Unregister

```javascript
const unregister = registerHook('message:receive', handler);

// Later...
unregister();
```

### 4. Event Cancellation

```javascript
registerHook('message:receive', async (event) => {
  if (event.context.text.includes('spam')) {
    event.cancelled = true; // หยุด handlers ถัดไป
  }
});
```

## ไฟล์ที่ Implement

| ไฟล์ | หน้าที่ |
|------|--------|
| `lib/hooks-system.js` | Core hooks system |
| `hooks/message-logger/` | ตัวอย่าง hook |

---
*สรุป: 2026-02-03*
