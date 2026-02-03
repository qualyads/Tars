---
name: message-logger
description: บันทึก log ทุกข้อความที่เข้ามา
events: ["message:receive", "message:send"]
---

# Message Logger Hook

ตัวอย่าง hook ที่บันทึก log ข้อความทั้งขาเข้าและขาออก

## Events ที่ฟัง

- `message:receive` - เมื่อได้รับข้อความ
- `message:send` - เมื่อส่งข้อความออก

## วิธีใช้

Hook นี้จะถูกโหลดอัตโนมัติเมื่อเรียก `loadHooks('./hooks')`

```javascript
import { loadHooks } from './lib/hooks-system.js';

await loadHooks('./hooks');
```
