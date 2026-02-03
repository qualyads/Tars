# Plugin System - สรุปจาก OpenClaw

> **สถานะ:** ✅ Implement แล้ว
> **ไฟล์ที่อ่าน:** ~30 files ใน `src/plugins/`
> **Patterns หลัก:** Plugin Discovery, Hooks, Tool Registration, Command Registration

## สรุปเข้าใจง่าย

Plugin System คือระบบ "ปลั๊กอิน" ที่ช่วยให้ Oracle **เพิ่มความสามารถใหม่ได้** โดยไม่ต้องแก้ core code

### เปรียบเทียบให้เห็นภาพ

| สิ่งที่ต้องการ | ก่อนมี Plugin | หลังมี Plugin |
|---------------|--------------|---------------|
| เพิ่ม command ใหม่ | แก้ไฟล์หลัก | สร้าง plugin แยก |
| เพิ่ม tool ให้ AI | แก้ไฟล์หลัก | registerTool() |
| ดัก event ต่างๆ | if-else เต็มไปหมด | registerHook() |

## หลักการทำงาน

```
                    ┌─────────────────┐
                    │   Oracle Core   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Plugin Loader  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐         ┌────▼────┐
   │Plugin A │          │Plugin B │         │Plugin C │
   │(ทักทาย) │          │(โรงแรม) │         │(ลงทุน)  │
   └─────────┘          └─────────┘         └─────────┘
```

## ส่วนประกอบหลัก

### 1. Manifest (บอก Oracle ว่า plugin นี้คืออะไร)

```json
// plugins/my-plugin/oracle.plugin.json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "ทำอะไรก็ว่าไป",
  "version": "1.0.0"
}
```

### 2. Entry Point (code หลักของ plugin)

```javascript
// plugins/my-plugin/index.js
export function register(api) {
  // api คือตัวที่ให้ plugin เข้าถึง Oracle

  // ลงทะเบียน hook
  api.registerHook('before_message', async (event) => {
    console.log('มีข้อความเข้ามา!');
  });

  // ลงทะเบียน command
  api.registerCommand({
    name: 'hello',
    handler: async () => ({ text: 'สวัสดี!' })
  });
}
```

### 3. Hooks (จุดที่ให้ plugin แทรกตัว)

| Hook | เมื่อไหร่ | ใช้ทำอะไร |
|------|---------|----------|
| `before_message` | ก่อนประมวลผลข้อความ | ดักข้อความ, แก้ไข |
| `after_reply` | หลังส่งข้อความ | บันทึก log |
| `on_startup` | ตอน server start | เตรียมของ |
| `before_tool_call` | ก่อน AI เรียก tool | ตรวจสอบ, แก้ไข |

## ตัวอย่างการใช้งาน

### ตัวอย่าง 1: Plugin ทักทาย

```javascript
export function register(api) {
  api.registerHook('before_message', async (event) => {
    if (event.body?.includes('สวัสดี')) {
      return { ...event, is_greeting: true };
    }
  });
}
```

### ตัวอย่าง 2: Plugin Command

```javascript
export function register(api) {
  api.registerCommand({
    name: 'price',
    description: 'เช็คราคาห้อง',
    handler: async ({ args }) => {
      const roomType = args || 'standard';
      const price = await checkPrice(roomType);
      return { text: `ห้อง ${roomType}: ${price} บาท` };
    }
  });
}
```

### ตัวอย่าง 3: Plugin Tool (ให้ AI เรียกใช้)

```javascript
export function register(api) {
  api.registerTool({
    name: 'check_booking',
    description: 'เช็คการจอง',
    parameters: { bookingId: 'string' },
    execute: async ({ bookingId }) => {
      const booking = await getBooking(bookingId);
      return JSON.stringify(booking);
    }
  });
}
```

## โครงสร้างไฟล์

```
tools/oracle-agent/
├── lib/
│   └── plugin-system.js    ← ระบบ plugin
└── plugins/
    └── hello-world/        ← ตัวอย่าง plugin
        ├── oracle.plugin.json
        └── index.js
```

## วิธีใช้งาน

```javascript
import { loadAllPlugins, runHook } from './lib/plugin-system.js';

// โหลด plugins ทั้งหมด
await loadAllPlugins(config);

// เรียกใช้ hook
await runHook('before_message', { body: 'สวัสดี' });
```

## ข้อดีของ Plugin System

1. **แยกส่วน** - แต่ละ feature อยู่คนละที่
2. **ปิด-เปิดได้** - ไม่ใช้ก็ disable
3. **ทดสอบง่าย** - test plugin เดียว
4. **Reusable** - เอาไปใช้ที่อื่นได้

---
*สรุป: 2026-02-03*
