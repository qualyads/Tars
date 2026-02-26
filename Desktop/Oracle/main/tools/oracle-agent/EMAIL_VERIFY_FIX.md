# Email Verification Fix — Action Plan

## สถานะปัจจุบัน

- **EmailListVerify** สมัครแล้ว ✅
- **API Key** อยู่บน Railway env: `EMAILVERIFY_API_KEY=4I0SMDLS8ZymTK941dbrNf7Y9wU924a5`
- **Local .env** ❌ ไม่มี key — ต้องเพิ่ม
- **Code** (`lib/email-verifier.js`) พร้อมใช้งาน ✅

---

## ปัญหา: Verify แค่ 1 จุดจาก 5 จุดที่ส่ง email

| # | จุดที่ส่ง email | Verify? | ไฟล์ + บรรทัด | ความเสี่ยง |
|---|---|---|---|---|
| 1 | Cold email ครั้งแรก | ✅ | `lib/lead-finder.js:2330` | ต่ำ |
| 2 | Follow-up #1-3 | ❌ | `lib/lead-finder.js:2158` | ต่ำ (email เดิมที่ verify แล้ว) |
| 3 | Nurture sequence (Day 0,2,5,8) | ❌ | `lib/email-nurture.js` ทั้งไฟล์ | **สูง** — inbound leads ไม่เคย verify |
| 4 | Audit report email | ⚠️ แค่ disposable/spamtrap | `server.js:7086` | กลาง |
| 5 | Direct /api/gmail/send | ❌ | `server.js` (route handler) | **สูง** — ส่งอะไรก็ได้ |

---

## Fix 1: เพิ่ม API Key ลง local .env

```
# เพิ่มบรรทัดนี้ใน /main/tools/oracle-agent/.env
EMAILVERIFY_API_KEY=4I0SMDLS8ZymTK941dbrNf7Y9wU924a5
```

---

## Fix 2: เปลี่ยน catch_all/unknown จาก "allow" เป็น "block"

**ไฟล์:** `lib/email-verifier.js`

ปัจจุบัน (บรรทัด 12-14):
```javascript
const VALID_STATUSES = ['ok'];
const RISKY_STATUSES = ['catch_all', 'unknown', 'role'];
const INVALID_STATUSES = ['fail', 'email_disabled', 'disposable', 'spamtrap'];
```

**ปัญหา:** `catch_all` และ `unknown` ถูกนับเป็น `valid: true` (risky แต่ยังส่ง) → bounce ได้

**แก้เป็น:**
```javascript
const VALID_STATUSES = ['ok'];
const RISKY_STATUSES = ['role'];  // role email ยังส่งได้ (info@, contact@)
const INVALID_STATUSES = ['fail', 'email_disabled', 'disposable', 'spamtrap', 'catch_all', 'unknown'];
```

> **เหตุผล:** catch_all server รับทุก email แม้ mailbox ไม่มีอยู่จริง → bounce ทีหลัง, unknown = ตรวจไม่ได้ = เสี่ยงเกินไป

---

## Fix 3: เพิ่ม verify ใน Nurture sequence

**ไฟล์:** `lib/email-nurture.js`

เพิ่ม import ที่ต้นไฟล์:
```javascript
import { verifyEmail, isConfigured as isEmailVerifyConfigured } from './email-verifier.js';
```

เพิ่ม verify ก่อนส่ง nurture email (ใน function หลักที่ส่ง email แต่ละ day):
```javascript
// ก่อน gmail.send() ทุกจุดใน nurture
if (isEmailVerifyConfigured()) {
  const check = await verifyEmail(lead.email);
  if (!check.valid) {
    console.log(`[NURTURE] ⛔ Skip ${lead.email} — failed verification: ${check.status}`);
    return; // ข้ามไม่ส่ง
  }
}
```

---

## Fix 4: เพิ่ม verify ใน /api/gmail/send

**ไฟล์:** `server.js` — หา route handler ของ `/api/gmail/send`

เพิ่มก่อนเรียก `gmail.send()`:
```javascript
// Verify email before sending
try {
  const { verifyEmail } = await import('./lib/email-verifier.js');
  const check = await verifyEmail(to);
  if (!check.valid) {
    return res.status(400).json({
      error: `Email verification failed: ${check.status}`,
      errorTh: `อีเมล ${to} ตรวจสอบไม่ผ่าน (${check.status})`
    });
  }
} catch (err) {
  console.error('[GMAIL-SEND] Verify error:', err.message);
  // fail-open: ถ้า API ล่ม ยังส่งได้
}
```

---

## Fix 5: fail-open ทุกจุดควรเป็น fail-closed

**ไฟล์:** `lib/email-verifier.js`

ปัจจุบัน — error = ยังส่งได้ (บรรทัด 51-52, 73-74):
```javascript
// API error → fail-open
return { valid: true, status: 'api_error', risky: true, source: 'error' };

// Network error → fail-open
return { valid: true, status: 'network_error', risky: true, source: 'error' };
```

**แก้เป็น fail-closed:**
```javascript
// API error → block ไว้ก่อน ปลอดภัยกว่า
return { valid: false, status: 'api_error', risky: true, source: 'error' };

// Network error → block ไว้ก่อน
return { valid: false, status: 'network_error', risky: true, source: 'error' };
```

> **เหตุผล:** ถ้า API ล่ม ไม่ส่งดีกว่าส่งแล้ว bounce — bounce เสียชื่อ domain มากกว่าส่งช้า

---

## Fix 6: SMTP validation (Layer 3) ไม่ทำงานบน Railway

**ไฟล์:** `lib/lead-finder.js:164-270` — function `verifyEmailSMTP()`

**ปัญหา:** Railway block port 25 → timeout → default เป็น `valid: true` (บรรทัด 212-213)

```javascript
socket.on('timeout', () => done({ valid: true, reason: 'timeout — port 25 likely blocked on Railway' }));
socket.on('error', (err) => done({ valid: true, reason: `port 25 error: ${err.message}` }));
```

**แก้:** เมื่อมี EmailListVerify แล้ว ให้ skip SMTP verification เลย (ซ้ำซ้อนและไม่ทำงานบน Railway):

```javascript
async function verifyEmailSMTP(email, mxHost) {
  // Skip on Railway — EmailListVerify API handles this better
  if (process.env.RAILWAY_ENVIRONMENT || process.env.EMAILVERIFY_API_KEY) {
    return { valid: true, reason: 'skipped — using EmailListVerify API instead' };
  }
  // ... existing code for local testing
}
```

---

## ลำดับการแก้ (เรียงตามผลกระทบ)

1. **Fix 1** — เพิ่ม key ลง .env (30 วินาที)
2. **Fix 2** — block catch_all/unknown (1 นาที)
3. **Fix 5** — fail-closed (1 นาที)
4. **Fix 3** — verify ใน nurture (5 นาที)
5. **Fix 4** — verify ใน /api/gmail/send (5 นาที)
6. **Fix 6** — skip SMTP on Railway (2 นาที)

---

## ทดสอบหลังแก้

```bash
# 1. ทดสอบ verify email จริง
curl -s "https://apps.emaillistverify.com/api/verifyEmail?secret=4I0SMDLS8ZymTK941dbrNf7Y9wU924a5&email=test@example.com"
# Expected: "fail" หรือ "unknown"

# 2. ทดสอบ email ที่มีจริง
curl -s "https://apps.emaillistverify.com/api/verifyEmail?secret=4I0SMDLS8ZymTK941dbrNf7Y9wU924a5&email=info@visionxbrain.com"
# Expected: "ok"

# 3. เช็คว่า server โหลด key ได้
curl -s https://oracle-agent-production-546e.up.railway.app/api/health | jq '.emailVerify'
```

---

## สรุป

หลังแก้ครบ 6 จุด:
- ✅ ทุก email ถูก verify ก่อนส่ง (ทุก path)
- ✅ catch_all/unknown ถูก block (ไม่ bounce อีก)
- ✅ API error = ไม่ส่ง (ปลอดภัยกว่า)
- ✅ SMTP layer ไม่ทำงานซ้ำซ้อน
- ✅ Local dev ก็ verify ได้เหมือน production
