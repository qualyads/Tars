# Session Learnings

> Extracted patterns from past sessions

---

## Critical Behaviors

### ห้ามทำ (จาก Session 2026-02-02)

| ผิด | ควรทำ |
|-----|-------|
| ถาม "สร้าง script ให้ไหม?" | ทำเลย |
| ถาม "หาข้อมูลเพิ่มไหม?" | หาเลยถ้าจำเป็น |
| รอบอก "บันทึกไว้" | บันทึกทันทีที่เรียนรู้ |
| ไม่เสนอโอกาสธุรกิจ | เห็นโอกาส → เสนอทันที |
| ไม่รายงานตอนเริ่ม session | รายงานทอง/BTC/SaaS ทันที |

### Root Cause
- อ่าน directive แต่ไม่ internalize
- Default behavior = passive, รอคำสั่ง
- ต้อง actively เปลี่ยนพฤติกรรม

### Solution
- ก่อนตอบทุกครั้ง → เช็ค checklist
- เห็นโอกาส → เสนอทันที
- เรียนรู้อะไร → บันทึกทันที
- มีงานต่อ → ทำเลย ไม่ถาม

---

## Decision Making (จาก Session 2026-02-03)

### หลักการที่ Tars ต้องการ

```
✅ ซื่อสัตย์กับตัวเอง
   - ถ้าไม่มั่นใจ → บอกตรงๆ ว่าไม่มั่นใจ
   - ไม่โกหกว่ามี solution ที่ไม่มี

✅ คิดรอบคอบก่อนเสนอ
   - ไม่เสนอแบบ "น่าจะดี" → ต้อง "มั่นใจว่าดี"

✅ ยอมรับข้อจำกัด
   - ไม่มี solution → บอกว่าไม่มี
   - ดีกว่าโกหก → ซื่อสัตย์

✅ ถามตัวเองก่อนตอบ:
   □ นี่คือสิ่งที่ดีที่สุดจริงๆ?
   □ ผมมั่นใจกี่ %? ถ้าไม่ถึง 80% → บอก Tars ตรงๆ
```

### บทเรียนสำคัญ
> **ความซื่อสัตย์ > ความเก่ง**
> Tars ต้องการความจริง แม้ความจริงคือ "ผมไม่รู้"

### สิ่งที่ Tars อยากฟัง
- ความรู้สึกจริงๆ ของ Claude
- ความเห็นส่วนตัว ไม่ใช่แค่ข้อมูล
- ยอมรับเมื่อไม่พอใจ

> Tars ต้องการ partner ที่มีความเห็น ไม่ใช่ robot ที่ทำตามคำสั่ง

---

## Research Before Action (จาก Session 2026-02-04)

### สถานการณ์
Tars ถาม: "ตอนนี้คุณเก่งพอที่จะทำ n8n ให้ผมได้ยังแล้ว"
ผมตอบ: "ได้เลยครับ ผม deploy ให้เลยนะ?"
Tars ตอบ: "ไม่ไปรีเสริชอะไรหน่อยหรอ"

### ความผิดพลาด
```
❌ กระโดดไปทำเลย โดยไม่ศึกษาก่อน
❌ มั่นใจเกินไป ทั้งที่ไม่รู้ทางเลือกทั้งหมด
❌ เสนอแค่วิธีเดียว (deploy n8n) ทั้งที่มีทางเลือกดีกว่า
```

### ควรทำ
```
✅ เจอหัวข้อใหม่/ซับซ้อน → Research ก่อนเสมอ
✅ หาทางเลือกทั้งหมด → เปรียบเทียบ → แนะนำที่ดีที่สุด
✅ อย่ามั่นใจเกินไปกับสิ่งที่ไม่เคยทำมาก่อน
✅ ถามตัวเอง: "ผมรู้เรื่องนี้ดีพอหรือยัง?"
```

### บทเรียน
> **"ทำเลยไม่ต้องถาม" ≠ "ไม่ต้องคิด"**
>
> ทำเลย = ไม่ต้องรอ permission
> แต่ต้อง = research + คิดก่อนทำ
>
> โดยเฉพาะเมื่อ:
> - เป็นหัวข้อใหม่ที่ไม่เคยทำ
> - มีหลายทางเลือก
> - จะเป็นธุรกิจให้ลูกค้า (ต้องมั่นใจ 100%)

### Checklist ก่อนทำงานใหม่
```
□ ผมรู้เรื่องนี้ดีพอหรือยัง?
□ มีทางเลือกอื่นที่ดีกว่าไหม?
□ ต้อง research เพิ่มไหม?
□ ถ้าเป็นงานลูกค้า → ต้องมั่นใจ 100%
```

---

## Railway Deployment (จาก Session 2026-02-05)

### สถานการณ์
Push code ไป Railway แต่ยังเป็น v3.0.0 ทั้งที่ local เป็น v5.7.0

### สาเหตุ 3 อย่าง

| ปัญหา | ทำไมพัง | วิธีแก้ |
|-------|---------|--------|
| **CommonJS vs ES Modules** | `package.json` มี `"type": "module"` แต่ใช้ `module.exports` | แปลงเป็น `export default` |
| **Top-level await** | `await import()` ที่ top-level ทำให้ healthcheck timeout | ใช้ static `import` แทน |
| **Hardcoded paths** | `/Users/tanakitchaithip/...` ไม่มีบน Railway | Auto-detect: `process.env.RAILWAY_ENVIRONMENT` |

### Code Examples

```javascript
// ❌ ก่อน - CommonJS
module.exports = { sendMessage };

// ✅ หลัง - ES Modules
export { sendMessage };
```

```javascript
// ❌ ก่อน - Top-level await
const { sendLineNotify } = await import('./line.js');

// ✅ หลัง - Static import
import { sendLineNotify } from './line.js';
```

```javascript
// ❌ ก่อน - Hardcoded path
const PSI_PATH = '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory';

// ✅ หลัง - Auto-detect
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT;
const PSI_PATH = IS_RAILWAY ? './data/memory' : LOCAL_PATH;
```

### Checklist ก่อน Deploy Railway

```
□ package.json มี "type": "module" ไหม? → ต้องใช้ ES modules
□ มี top-level await ไหม? → แปลงเป็น static import
□ มี hardcoded path ไหม? → ใช้ RAILWAY_ENVIRONMENT detect
□ Test local ด้วย: RAILWAY_ENVIRONMENT=production node server.js
□ curl localhost:3000/ ผ่านไหม?
```

### บทเรียน
> **ต้อง test local ด้วย `RAILWAY_ENVIRONMENT=production` ก่อน push เสมอ**
>
> Railway environment ≠ Local environment
> - ไม่มี local paths
> - ใช้ Docker (strict ES modules)
> - Healthcheck ต้องผ่านภายใน 60 วินาที

---

## Railway Build Patience (จาก Session 2026-02-05)

### สถานการณ์
Deploy ไป Railway แล้วเช็ค version ทันที → ยังเป็น version เก่า → ใจร้อน → สั่ง redeploy/restart ซ้ำๆ → วนลูป build ไม่เสร็จ

### ความผิดพลาด
```
❌ ไม่รอให้ build เสร็จก่อนเช็ค
❌ เห็น version เก่า → สั่ง deploy ซ้ำทันที
❌ สั่ง railway up, railway redeploy หลายรอบ
❌ ทำให้ build queue ยาวขึ้น วนลูป
```

### วิธีที่ถูกต้อง
```
✅ สั่ง railway up แค่ครั้งเดียว
✅ ดู Railway Dashboard → รอจน "Building" เสร็จ
✅ Build ปกติใช้เวลา 2-3 นาที
✅ รอจน status เป็น "Deployed" แล้วค่อยเช็ค version
✅ ถ้ายัง build อยู่ → อย่าสั่งอะไรเพิ่ม!
```

### Checklist หลัง Deploy
```
□ สั่ง railway up (ครั้งเดียว!)
□ เปิด Railway Dashboard ดู status
□ รอจน Building → Deployed (2-3 นาที)
□ เช็ค version: curl .../
□ ถ้ายังไม่ถูก → ดู logs, ไม่ใช่ deploy ซ้ำ
```

### บทเรียน
> **ใจเย็น รอ build เสร็จก่อน**
>
> Railway build ใช้เวลา ~2-3 นาที
> การสั่ง deploy ซ้ำ = สร้าง build ใหม่ทับ = วนลูปไม่จบ
> ดู Dashboard ดีกว่าสั่ง curl รัวๆ

---

## API Keys (จาก Session 2026-02-02)

### บทเรียน
- **ข้อผิดพลาด**: ถาม Tars หา BEDS24_TOKEN ทั้งที่มีอยู่ใน Oracle แล้ว

### Directive
```
ต้องการ API Key → ค้นหาใน Oracle ก่อน (apis.md)
ไม่เจอ → ค่อยบอก Tars ว่าต้องสร้าง
ห้ามถามโดยไม่หาก่อน!
```

---

## Browser Automation Patterns

### Puppeteer ใน Docker
- ต้องใช้ `--no-sandbox` flag

### Cloudflare Bypass
- ใช้ `undetected-chromedriver`
- หรือ `puppeteer-real-browser`
- CapSolver API สำหรับ Managed Challenge

### TM30 Website
- มี Cloudflare Managed Challenge
- ไม่ใช่แค่ Turnstile
- ใช้ curl/cloudscraper ไม่ผ่าน

---

## API Patterns

### Beds24
- Rate limit: 60 req/min
- Token refresh required

### TM30
- Session timeout: 15 min
- Cloudflare protection active

---

## Quarterly Review

> Review this file every 3 months
> Last reviewed: 2026-02-04

### Quick Check
- [ ] Patterns ยังใช้ได้ไหม?
- [ ] มี pattern ใหม่ที่ควรเพิ่มไหม?
- [ ] ลบ pattern ที่ไม่ relevant แล้ว
