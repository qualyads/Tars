# VXB Email System — Full Production Audit

> Audited: 2026-02-26 | Files: 5 | Lines scanned: 13,000+ | By: Oracle (Opus)
> Files: server.js (8,781), lead-finder.js (3,268), email-nurture.js (466), lead-reply-handler.js (437), gmail.js + google-oauth.js

---

## สารบัญ

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Lead Lifecycle — สถานะทั้งหมด](#3-lead-lifecycle)
4. [Critical Bugs — ต้องแก้ก่อน](#4-critical-bugs)
5. [Dead Ends — จุดที่ Lead หายไป](#5-dead-ends)
6. [Security Issues](#6-security-issues)
7. [Race Conditions](#7-race-conditions)
8. [Error Handling Gaps](#8-error-handling-gaps)
9. [Rate Limiting Problems](#9-rate-limiting)
10. [Dead Code](#10-dead-code)
11. [Hardcoded Values](#11-hardcoded-values)
12. [Edge Cases Not Handled](#12-edge-cases)
13. [Missing Features — สิ่งที่ขาดแล้วเสียเงิน](#13-missing-features)
14. [Recommendations — จัดลำดับแก้](#14-recommendations)

---

## 1. Executive Summary

### ระบบทำอะไรได้ดี
- Cold outreach อัตโนมัติ: ค้นหา → วิเคราะห์ → เขียน email (24 กฎ) → ส่ง → follow-up
- Email validation 3 ชั้น: bounce blacklist → MX → SMTP
- Reply detection: Gmail Pub/Sub real-time + cron polling ทุก 3 ชม.
- Audit report อัตโนมัติเมื่อ lead สนใจ
- Nurture sequence สำหรับ SEO audit leads (Day 0, 2, 5, 8)
- Tracking: pixel + click tracking + Telegram notification

### ปัญหาใหญ่ที่ต้องแก้
| Priority | ปัญหา | ผลกระทบ |
|:--------:|--------|---------|
| 🔴 P0 | `audit_sent` = dead end — ไม่มี follow-up หลังส่ง audit | **Lead ที่สนใจที่สุดหลุดมือ** |
| 🔴 P0 | Reply ครั้งที่ 2+ ถูก ignore เงียบ | **Lead ถามเพิ่มแล้ว Tar ไม่รู้** |
| 🔴 P0 | Nurture ไม่เช็ค reply status → ส่งซ้ำคนที่คุยอยู่ | **ดูไม่ professional** |
| 🔴 P0 | lead-reply-handler ไม่ sync Postgres | **Deploy ใหม่ = reply data หาย** |
| 🟡 P1 | RapidAPI key hardcoded ใน source code | **Security risk** |
| 🟡 P1 | ไม่มี auth บน API endpoints ทุกตัว | **ใครก็ส่ง email ได้** |
| 🟡 P1 | Race conditions บน leads.json — 6+ จุดเขียนพร้อมกัน | **Data loss** |
| 🟡 P1 | Unsubscribe ไม่ทำงานจริง | **บอก "ตอบ ยกเลิก" แต่ไม่มีโค้ดรับ** |
| 🟢 P2 | ไม่มี conversion tracking | **วัด ROI ไม่ได้** |
| 🟢 P2 | ไม่มี win-back flow ลูกค้าเก่า | **เสียโอกาส upsell** |

---

## 2. System Architecture

### ไฟล์หลัก
```
server.js (8,781 lines)
  ├─ 65+ API routes
  ├─ 8 cron jobs
  ├─ Gmail webhook handler
  └─ Static file serving (dashboards)

lib/lead-finder.js (3,268 lines)
  ├─ Lead discovery (Google Places API)
  ├─ Email validation (3 layers)
  ├─ Cold outreach email generation
  ├─ Follow-up system
  ├─ Reply detection (cron-based)
  ├─ Audit report generation
  └─ Lead enrichment engine

lib/email-nurture.js (466 lines)
  ├─ Nurture sequence (Day 0, 2, 5, 8)
  ├─ Queue processor (daily 11:00)
  └─ Unsubscribe handler

lib/lead-reply-handler.js (437 lines)
  ├─ Gmail Pub/Sub webhook
  ├─ Intent classification (Claude Haiku)
  ├─ Auto-reply with calendar slots
  └─ Owner notification

lib/gmail.js
  ├─ OAuth token management
  ├─ Email send (with attachments)
  ├─ Gmail API wrapper
  └─ Watch/History management
```

### Data Flow
```
                    ┌─────────────────────────────────────────────────┐
                    │              INBOUND (SEO Audit Tool)           │
                    │  User submits URL → Audit → Capture email      │
                    │  → emailNurture.sendDay0() → Drip Day 2,5,8   │
                    └─────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    OUTBOUND (Cold Outreach)                         │
│                                                                      │
│  Cron 10:00 + 15:00                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │ Lead     │→ │ Validate │→ │ AI Gen   │→ │ Gmail    │        │
│  │ Finder   │   │ Email    │   │ Email    │   │ Send     │        │
│  │ (Places) │   │ (3 layer)│   │ (24 กฎ) │   │ (+PDF)   │        │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘        │
│                                                                      │
│  Follow-ups: Day 3 + Day 7 อัตโนมัติ                                │
│  Reply Check: ทุก 3 ชม. (9, 12, 15, 18)                            │
│  Reply Handler: Gmail Pub/Sub real-time                              │
│                                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                        │
│  │ Reply    │→ │ Classify │→ │ Audit    │→  💀 DEAD END           │
│  │ Detected │   │ Intent   │   │ Report   │                        │
│  └──────────┘   └──────────┘   └──────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Cron Jobs
| เวลา | Feature Flag | ทำอะไร | ไฟล์:บรรทัด |
|------|-------------|--------|------------|
| 09:00 | — | Check overdue bills | server.js:5920 |
| 09,12,15,18:00 | `leadReplyCheck` | Check replies (Gmail SENT search) | server.js:5846 |
| 10:00 | `leadFinder` | Morning lead search + send | server.js:5822 |
| 11:00 | — | **Nurture queue** (Day 2,5,8 emails) | server.js:5649 |
| 15:00 | `leadFinder` | Afternoon lead search + send | server.js:5834 |
| 03:00 ทุก 6 วัน | — | Renew Gmail watch | server.js:8447 |

### API Endpoints (Email-related)
| Route | Method | Purpose | ไฟล์:บรรทัด |
|-------|--------|---------|------------|
| `/api/gmail/send` | POST | ส่ง email (generic) | server.js:3611 |
| `/api/gmail/inbox` | GET | List inbox | server.js:3566 |
| `/api/gmail/search` | GET | Search emails | server.js:3577 |
| `/webhook/gmail` | POST | Pub/Sub push webhook | server.js:3478 |
| `/api/lead-reply/status` | GET | Reply handler status | server.js:3525 |
| `/api/lead-reply/setup-watch` | POST | Force re-watch | server.js:3542 |
| `/api/leads` | GET | List leads (filterable) | server.js:6038 |
| `/api/leads/stats` | GET | Pipeline stats | server.js:5965 |
| `/api/leads/run` | POST | Manual lead finder run | server.js:6086 |
| `/api/leads/update` | POST | Update lead by domain/email | server.js:6047 |
| `/api/leads/test-email` | POST | Send outreach email | server.js:6319 |
| `/api/leads/test-audit` | POST | Send audit report | server.js:6292 |
| `/api/leads/replies` | GET | All replied leads | server.js:5976 |
| `/api/leads/export` | GET | Export all leads | server.js:6117 |
| `/api/leads/import` | POST | Import/merge leads | server.js:6135 |
| `/api/leads/reset` | POST | ⚠️ WIPE all leads | server.js:7032 |
| `/api/leads/clean` | POST | Remove junk leads | server.js:7794 |
| `/api/email/track/:id.png` | GET | Pixel tracking | server.js:6925 |
| `/api/email/click/:id` | GET | Click tracking + redirect | server.js:6968 |
| `/api/email/stats` | GET | Email tracking stats | server.js:7002 |
| `/api/email/sync-history` | POST | Sync from Gmail SENT | server.js:7646 |
| `/api/nurture/stats` | GET | Nurture queue stats | server.js:7599 |
| `/api/nurture/unsubscribe` | POST | Unsubscribe email | server.js:7603 |
| `/api/dgp/generate` | POST | AI generate DGP proposal | server.js:6705 |
| `/api/dgp/send` | POST | Send DGP proposal email | server.js:6845 |
| `/api/audit/analyze` | POST | SEO audit (captures lead) | server.js:7070 |

---

## 3. Lead Lifecycle

### Status ทั้งหมดที่มีในระบบ
```
new                → Lead ใหม่ ยังไม่ติดต่อ
emailed            → ส่ง cold email แล้ว
followed_up        → ส่ง follow-up แล้ว (Day 3/7)
replied            → Lead ตอบกลับ
audit_sent         → ส่ง audit report แล้ว (interested)
closed             → ปฏิเสธ/จบการสนทนา
bounced            → Email ตีกลับ
already_contacted  → Gmail dedup พบว่าเคยติดต่อแล้ว
audit-lead         → Inbound จาก SEO audit tool
```

### Transition Graph
```
                        ┌─────────────────────┐
                        │        new          │
                        └──────┬──────┬───────┘
                               │      │
                    ┌──────────┘      └──────────┐
                    ▼                             ▼
            ┌──────────────┐              ┌──────────────┐
            │   emailed    │              │already_contacted│
            └──────┬───────┘              └──────────────┘
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
   ┌──────────┐ ┌──────┐ ┌──────────┐
   │followed_ │ │bounced│ │ replied  │
   │   up     │ └──────┘ └────┬─────┘
   └────┬─────┘               │
        │               ┌─────┼──────┐
        │               ▼     ▼      ▼
        │        ┌──────────┐ ┌────┐ ┌──────────┐
        │        │audit_sent│ │closed│ │(revert to│
        │        └──────────┘ └────┘ │ emailed) │
        │             │               └──────────┘
        │             ▼                auto_reply
        │         💀 DEAD END          misclassified
        │         ไม่มี automation
        │         ไม่เช็ค reply
        │         ไม่มี follow-up
        │
        └──► (same as emailed: replied/bounced/closed)


  Inbound Path (SEO Audit Tool):
  ┌──────────┐    ┌──────┐    ┌──────┐    ┌──────┐
  │audit-lead│ → │Day 0 │ → │Day 2 │ → │Day 5 │ → Day 8
  └──────────┘    └──────┘    └──────┘    └──────┘
       ⚠️ ไม่เช็ค reply status → ส่งต่อแม้ lead ตอบแล้ว
```

### สิ่งที่ขาด (ไม่มีใน status)
```
❌ converted       — กลายเป็นลูกค้า
❌ client          — ปิดดีล
❌ proposal_sent   — ส่ง proposal แล้ว
❌ meeting_booked  — นัดประชุมแล้ว
❌ nurturing       — อยู่ใน nurture sequence
❌ re_engaged      — ลูกค้าเก่ากลับมา
```

---

## 4. Critical Bugs

### 🔴 BUG-01: `audit_sent` = Dead End (ร้ายแรงที่สุด)

**ไฟล์:** lead-finder.js:1879, 2072
**ปัญหา:** เมื่อ lead ตอบว่าสนใจ → ระบบส่ง audit report → status เปลี่ยนเป็น `audit_sent` → **ไม่มี automation อีกเลย**

```javascript
// lead-finder.js:2072 — processFollowUps()
// audit_sent ถูก skip อย่างชัดเจน
if (['replied', 'closed', 'bounced', 'audit_sent'].includes(lead.status)) continue;
```

```javascript
// lead-finder.js:1807 — checkReplies()
// เช็คเฉพาะ emailed/followed_up — ไม่เช็ค audit_sent
const leadsToCheck = leadsData.leads.filter(l =>
  l.email && (l.status === 'emailed' || l.status === 'followed_up')
);
```

**ผลกระทบ:**
- Lead ที่สนใจที่สุด (ตอบกลับ + ได้รับ audit) ไม่ได้รับ follow-up
- ถ้า lead ตอบ audit report → ระบบไม่เห็น reply → Tar ไม่รู้
- Lead เย็นลงแล้วหายไป

**ควรเป็น:**
- หลัง audit_sent 48 ชม. → ส่ง gentle follow-up: "ได้ดู report แล้วไหมครับ?"
- หลัง 5 วัน → ส่ง value-add: "มีอัพเดท 2 ข้อเพิ่มเติมจาก report..."
- เช็ค reply จาก audit_sent leads ด้วย

---

### 🔴 BUG-02: Reply ครั้งที่ 2+ ถูก Ignore

**ไฟล์:** lead-reply-handler.js:179-185
**ปัญหา:** Match filter เช็คแค่ `status === 'emailed' || status === 'followed_up'`

```javascript
// lead-reply-handler.js:179-181
const lead = leadsData.leads.find(l =>
  l.email && senderEmail.includes(l.email.toLowerCase())
  && (l.status === 'emailed' || l.status === 'followed_up')
);
// ถ้า status = 'replied' หรือ 'audit_sent' → find() return undefined
// → return { status: 'skipped', reason: 'not_a_lead' }
```

**ผลกระทบ:**
- Lead ตอบว่าสนใจ → status เปลี่ยนเป็น `replied`
- Lead ถามคำถามเพิ่ม → **ระบบ ignore เงียบ ไม่แจ้ง Tar**
- Lead ส่ง email ตอบ audit report → **ไม่มีใครเห็น**

**ควรเป็น:**
- Match ทุก status ยกเว้น `bounced` กับ `closed`
- Notify Tar ทุกครั้งที่ lead ตอบ ไม่ว่า status จะเป็นอะไร

---

### 🔴 BUG-03: Nurture ไม่หยุดเมื่อ Lead ตอบ

**ไฟล์:** email-nurture.js:338-420
**ปัญหา:** `processNurtureQueue()` ไม่เช็ค `lead.status` เลย

```javascript
// email-nurture.js:351-355 — เงื่อนไข skip
if (lead.source !== 'seo-audit') continue;     // ✅
if (!lead.email) continue;                      // ✅
if (!lead.nurture) continue;                    // ✅
if (lead.nurture.unsubscribed) continue;        // ✅
if (lead.nurture.step >= 4) continue;           // ✅
// ❌ ไม่เช็ค lead.status === 'replied'
// ❌ ไม่เช็ค lead.status === 'closed'
// ❌ ไม่เช็ค lead.replyIntent
```

**ผลกระทบ:**
- Lead ตอบ "สนใจ" → Tar เริ่มคุยด้วย
- Day 5: ระบบส่ง automated nurture email ซ้อน → ดูไม่ professional
- Lead ตอบ "ยกเลิก" → ระบบยังส่ง nurture ต่อ

---

### 🔴 BUG-04: lead-reply-handler ไม่ Sync Postgres

**ไฟล์:** lead-reply-handler.js:43-57
**ปัญหา:** มี `loadLeads()`/`saveLeads()` ของตัวเอง เขียนแค่ `leads.json` ไม่แตะ DB

```javascript
// lead-reply-handler.js:51-57 — เขียนแค่ไฟล์
function saveLeads(data) {
  const fd = fs.openSync(LEADS_FILE, 'w');
  fs.writeSync(fd, JSON.stringify(data, null, 2));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  // ❌ ไม่มี dbLeads.saveLeads(data)
}
```

ในขณะที่ `lead-finder.js:456-469` ทำครบทั้ง file + DB:
```javascript
// lead-finder.js:465-469
if (dbLeads.isDBReady()) {
  dbLeads.saveLeads(data).catch(err => console.error('DB backup error:', err));
}
```

**ผลกระทบ:**
- Reply status (`replied`, `closed`, `autoRepliedAt`) เขียนแค่ JSON
- Railway redeploy → `db-leads.js` restore จาก Postgres → **overwrite reply data**
- Lead ที่ตอบแล้วกลับเป็น `emailed` → ระบบส่ง follow-up ซ้ำ

---

### 🔴 BUG-05: Unsubscribe ไม่ทำงานจริง

**ไฟล์:** email-nurture.js:81, 424-441
**ปัญหา:** Email บอก "ตอบกลับว่า 'ยกเลิก'" แต่ไม่มีโค้ดจับคำนี้

```html
<!-- email-nurture.js:81 — ข้อความท้าย email -->
<p>ถ้าไม่อยากได้รับ email → ตอบกลับว่า "ยกเลิก"</p>
```

```javascript
// lead-reply-handler.js — ไม่มีบรรทัดไหนเช็ค "ยกเลิก"
// ไม่มี import emailNurture
// ไม่มี call emailNurture.unsubscribe()
```

**ผลกระทบ:**
- Lead ตอบ "ยกเลิก" → AI classify เป็น `declined` → status = `closed`
- แต่ `email-nurture.js` ไม่เช็ค `lead.status` → **ยังส่ง nurture ต่อ**
- ไม่มี `List-Unsubscribe` header → Gmail/Yahoo deliverability risk

---

### 🔴 BUG-06: classifyReply() Default เป็น `interested` เมื่อ Error

**ไฟล์:** lead-finder.js:1529
**ปัญหา:** ถ้า AI classification พัง → default เป็น `interested` → ส่ง audit report อัตโนมัติ

```javascript
// lead-finder.js:1529
} catch (err) {
  console.error('classifyReply error:', err);
  return 'interested'; // ❌ ส่ง audit report ให้คนที่ไม่ได้สนใจ
}
```

เทียบกับ `lead-reply-handler.js:269` ที่ทำถูก:
```javascript
} catch (err) {
  return 'unclear'; // ✅ ส่งให้ Tar ดูเอง
}
```

**ผลกระทบ:**
- API error → Lead ไม่ได้สนใจ แต่ได้รับ audit report → spam → เสีย reputation

---

## 5. Dead Ends — จุดที่ Lead หายไป

### Dead End 1: หลัง Audit Report (Cold Outreach)
```
Lead ตอบ "สนใจ" → Audit report ส่ง → status = audit_sent → 💀
  ไม่มี follow-up
  ไม่เช็ค reply อีก
  ไม่มี reminder
  Tar ต้อง manually follow → ลืมได้ง่าย
```

### Dead End 2: หลัง Auto-Reply + Calendar (Inbound)
```
Lead ตอบ "สนใจ" → Auto-reply + calendar slots → 💀
  Lead ไม่จอง → ไม่มี reminder
  48 ชม. ผ่านไป → ไม่มี follow-up
  Lead เย็นลง → หายไป
```

### Dead End 3: Nurture Day 8 จบ → ไม่มี Long-term
```
Day 8 email (case study + CTA) → nurture completedAt set → 💀
  Lead ไม่ตอบ Day 8 → จบ
  ไม่มี Day 14, 21, 30
  ไม่มี monthly check-in
  ไม่มี re-engagement
```

### Dead End 4: ลูกค้าเก่า → ไม่มี Touchpoint
```
จบโปรเจกต์ → ส่งมอบเว็บ → 💀
  ไม่มี check-in เดือนละครั้ง
  ไม่มี SEO health report
  ไม่มี upsell email
  ไม่มี referral request
  80+ ลูกค้าเก่า = potential ที่ทิ้งไว้
```

### Dead End 5: Lead ตอบ `unclear` → Tar Only
```
Reply classified as "unclear" → Notify Tar → 💀
  Tar ไม่เห็น notification → lead หายไป
  ไม่มี queue/reminder สำหรับ unclear leads
  ไม่มี escalation ถ้า Tar ไม่ตอบใน 24 ชม.
```

---

## 6. Security Issues

### 🔴 SEC-01: RapidAPI Key Hardcoded
**ไฟล์:** lead-finder.js:488
```javascript
const RAPIDAPI_KEY = '014d445a38msh0645e22d930fd07p17eea5jsn5c8866bfbb22';
// ❌ ไม่ได้อ่านจาก process.env
```
**ยังมีใน:** backlink-engine.js:26 (เป็น fallback)
**ความเสี่ยง:** ถ้า repo ถูก leak → API key ถูกใช้ → ค่าใช้จ่ายพุ่ง

### 🔴 SEC-02: ไม่มี Authentication บน API Endpoints
```
POST /api/gmail/send         → ใครก็ส่ง email ได้
POST /api/leads/reset        → ใครก็ลบ leads ทั้งหมดได้
POST /api/leads/run          → ใครก็ trigger lead finder ได้
POST /api/leads/test-email   → ใครก็ส่ง outreach email ได้
```
**ทุก endpoint ไม่มี auth middleware** — Railway URL เป็น public

### 🟡 SEC-03: google-token.json เป็น Plaintext
```
data/google-token.json → refresh_token + access_token ในไฟล์เปล่าบน disk
```
ถ้าไฟล์หลุด → Google account ทั้งหมดถูก compromise

### 🟡 SEC-04: /api/leads/reset ไม่มี Protection
**ไฟล์:** server.js:7032
```javascript
app.post('/api/leads/reset', (req, res) => {
  fs.writeFileSync(leadsPath, JSON.stringify({ leads: [], processedDomains: [] }));
  // ❌ ไม่มี auth, ไม่มี confirmation, ไม่มี backup ก่อนลบ
});
```

---

## 7. Race Conditions

### RACE-01: leads.json มี 6+ จุดที่เขียนพร้อมกัน

**จุดที่อ่าน/เขียน leads.json โดยตรง (ใน server.js):**

| บรรทัด | Operation | Context |
|--------|-----------|---------|
| 6124 | READ | `/api/leads/export` |
| 6151 | WRITE | `/api/leads/import` (replace) |
| 6208 | WRITE | `/api/leads/import` (merge) |
| 7038 | WRITE | `/api/leads/reset` |
| 7779 | WRITE | `/api/email/sync-history` |
| 7820 | WRITE | `/api/leads/clean` |
| 8567 | WRITE | AUTO-SYNC startup |
| 8607 | WRITE | AUTO-SYNC (reply fix) |

**ผ่าน module:**
- `leadFinder.saveLeads()` — lead-finder.js:456
- `leadFinder.updateLead()` — lead-finder.js:3207
- `lead-reply-handler.saveLeads()` — lead-reply-handler.js:51 (คนละฟังก์ชัน!)
- `emailNurture.processNurtureQueue()` → saves via lead-finder

**ไม่มี file lock, mutex, หรือ atomic rename pattern ใดๆ**

### RACE-02: processFollowUps() save ระหว่าง loop
```javascript
// lead-finder.js:2086, 2098, 2113, 2142
// saveLeads() ถูกเรียก 4 ครั้งระหว่าง loop iteration
// ถ้า API call trigger updateLead() ระหว่างนี้ → data ถูก overwrite
```

### RACE-03: Daily Email Counter
```javascript
// lead-finder.js:111 — read-modify-write ไม่มี lock
// 2 emails ส่งพร้อมกัน → count อาจผิด
```

---

## 8. Error Handling Gaps

| ไฟล์:บรรทัด | ปัญหา | ผลกระทบ |
|------------|--------|---------|
| lead-finder.js:1529 | `classifyReply` error → default `interested` | ส่ง audit report ให้คนที่ไม่สนใจ |
| lead-reply-handler.js:46 | `catch {}` เงียบ — JSON parse error ไม่ log | leads.json พัง → return empty → data loss |
| lead-reply-handler.js:169 | ไม่เช็ค `msg.from === null` | TypeError crash ถ้า Gmail ส่ง message ไม่มี From |
| server.js:3478 | Gmail webhook always return 200 | ถ้า handler fail → Pub/Sub ไม่ retry → message หาย |
| server.js:6845 | DGP send success + saveDgpSent fail | Email ถูกส่ง แต่ duplicate protection ไม่ save → ส่งซ้ำ |
| server.js:8634 | `catch {}` empty ใน AUTO-SYNC | Error ถูกกลืนเงียบ |
| gmail.js:72-91 | `request()` ไม่มี retry | Gmail 500 transient error → fail ทันที |
| email-nurture.js:404 | Send fail → log only | Failed email ไม่ retry, ไม่มี dead-letter queue |
| lead-finder.js:2301 | Gmail dedup throw → fail-open | อาจส่ง duplicate email |

---

## 9. Rate Limiting

### ปัญหา: Rate limit แยกกันทุก module

| Module | Limit | Counter Type |
|--------|-------|-------------|
| lead-finder.js | 30/วัน | File-based (reset on restart ❌) |
| email-nurture.js | 20/วัน | In-memory (reset on restart ❌) |
| backlink-engine.js | 3/cycle | In-memory |

**ไม่มี global coordinator** — ทั้ง 3 ระบบส่ง email อิสระจากกัน

**Worst case 1 วัน:**
```
lead-finder:     30 emails
email-nurture:   20 emails
backlink-engine: 3 × N cycles
= 50+ emails/วัน จาก account เดียว
```

### ปัญหา: Server restart = counter reset
```javascript
// email-nurture.js:23 — in-memory
let sentToday = 0; // reset เมื่อ server restart

// lead-finder.js:102 — file-based แต่
// getDailyEmailCount() อ่านจาก JSON → ถ้า deploy ใหม่ file อาจ reset
```

### ปัญหา: ไม่มี rate limit บน public endpoints
```
POST /api/gmail/send      → unlimited
POST /api/leads/test-email → unlimited
POST /api/audit/analyze    → 5/IP/hr (มี แต่ paid bypass)
```

### ปัญหา: Memory leak ใน audit rate limiter
**ไฟล์:** server.js:7058
```javascript
const auditRateLimit = new Map();
// ❌ Map entries ไม่เคยถูก cleanup → memory โตเรื่อยๆ
```

---

## 10. Dead Code

| ไฟล์:บรรทัด | Code | เหตุผล |
|------------|------|--------|
| lead-finder.js:1352 | `generateAuditEmail(lead)` | Legacy wrapper ไม่ถูกเรียกจากที่ไหน |
| lead-finder.js:1359 | `sendOutreachEmail(lead, emailContent)` | Legacy ไม่ถูกเรียก |
| lead-finder.js:331 | `OUTREACH_SUBJECT_KEYWORDS` | Define แล้วไม่ใช้ |
| lead-finder.js:764 | `analysis.businessNameEn = ''` | Set เป็น empty string เสมอ |
| email-nurture.js:98 | `buildDay0()` function (42 lines) | Dead code — Day 0 ใช้ sendFullOutreachEmail แทน |
| server.js:5416 | Rank Check Cron | `skipped - not implemented` |
| server.js:4657 | `/api/memory-consolidation/status` | Returns `not_implemented` |
| server.js:6319 | `/api/leads/test-email` (230 lines) | Duplicate logic จาก `sendFullOutreachEmail()` |

**Template duplication:** email template HTML (~170 lines) ถูก copy-paste ใน server.js:6341-6507 แทนที่จะ call `leadFinder.sendFullOutreachEmail()`

---

## 11. Hardcoded Values

### ค่าที่ต้องเป็น Environment Variables

| ค่า | ไฟล์:บรรทัด | ปัจจุบัน |
|-----|------------|---------|
| RapidAPI Key | lead-finder.js:488 | **Hardcoded ใน source** |
| Railway URL | lead-finder.js:1267 (4 ที่) | `oracle-agent-production-546e.up.railway.app` |
| Railway URL | email-nurture.js:21 | เดียวกัน |
| AI Model | lead-finder.js:1221,1414,1668 | `claude-haiku-4-5-20251001` |
| Max emails/day | lead-finder.js:100 | `30` |
| Nurture daily cap | email-nurture.js:22 | `20` |
| Phone number | lead-finder.js:885+ (หลายที่) | `097-153-6565` |
| Email | lead-finder.js:1736 | `info@visionxbrain.com` |
| Company reg | lead-finder.js:1302 | `0585564000175` |
| GCP Project | lead-reply-handler.js:26 | `oracle-agent-486604` |
| Service URLs | lead-finder.js:788-801 | 14 URLs hardcoded |
| Gmail dedup window | lead-finder.js:350 | `60d` |
| Bounce search window | lead-finder.js:1924 | `7d` |

### ค่าที่ hardcode แต่อาจ OK
| ค่า | เหตุผล |
|-----|--------|
| Thailand bounding box | lead-finder.js:530 — business logic ที่ไม่เปลี่ยน |
| SMTP timeout 10s | lead-finder.js:166 — reasonable default |
| Follow-up days [3,7] | Configurable จาก lead-targets.json |

---

## 12. Edge Cases Not Handled

### EDGE-01: Nonsensical `info@` Check on Domain
**ไฟล์:** lead-finder.js:1174
```javascript
if (!/^info@/i.test(domain))  // domain = "example.com" → test info@ = ALWAYS true
// เงื่อนไขนี้ไม่มีประโยชน์ — domain ไม่มีวัน match info@
```

### EDGE-02: Calendar Slots บน Friday
**ไฟล์:** lead-reply-handler.js:355-361
```javascript
for (let i = 0; i < days; i++) { // days=3, loop 3 calendar days
  if (day === 0 || day === 6) continue; // skip weekend
}
// Friday → check Fri, Sat(skip), Sun(skip) = แค่ 1 วัน business day
// ควรเป็น: loop จนได้ 3 BUSINESS days
```

### EDGE-03: Duplicate Audit Submission
**ไฟล์:** email-nurture.js:316
```javascript
lead.nurture = { step: 1, nextSendAt: ... }; // overwrite ถ้ามีอยู่แล้ว
// Lead ทำ audit ซ้ำ → nurture reset → ได้รับ Day 2,5,8 ซ้ำ
```

### EDGE-04: auto_reply Misclassification Revert
**ไฟล์:** lead-finder.js:1908
```javascript
if (intent === 'auto_reply') {
  lead.status = lead.followUps > 0 ? 'followed_up' : 'emailed'; // revert
}
// ถ้า AI classify ผิด (จริงๆ เป็น real reply) → status revert → ส่ง follow-up ซ้ำ
```

### EDGE-05: verifyWebsiteExists ผ่าน 403
**ไฟล์:** lead-finder.js:1126
```javascript
// HEAD request return 403 → domain อาจเป็น parked domain
// แต่ระบบถือว่า "มีเว็บ" → เลือก website template → email ไม่ตรง
```

### EDGE-06: processedDomains Array โตไม่หยุด
**ไฟล์:** lead-finder.js:2440, 2537
```javascript
leadsData.processedDomains.push(place.place_id);
// ไม่มี cleanup → array โตทุก run → includes() ช้าลงเรื่อยๆ
```

### EDGE-07: In-Reply-To Header ผิด Format
**ไฟล์:** lead-reply-handler.js:336
```javascript
inReplyTo: `<${originalMsg.id}@mail.gmail.com>`
// originalMsg.id = Gmail API message ID (hex string)
// ไม่ใช่ RFC 2822 Message-ID header
// Outlook/non-Gmail clients จะไม่เห็นเป็น thread เดียวกัน
```

### EDGE-08: Gmail Watch Expires Silently
**ไฟล์:** gmail.js:279, lead-reply-handler.js:29
```javascript
// Gmail watch expires ใน 7 วัน
// watchState เก็บใน memory เท่านั้น
// Server restart → historyId = null → webhook แรกถูก skip
// ถ้าไม่มี email เข้า 7+ วัน → watch ตาย → ไม่มี re-watch
```

### EDGE-09: Bounce Blacklist False Positive
**ไฟล์:** lead-finder.js:1949
```javascript
// Regex extract ALL emails จาก bounce message body
// อาจจับ email ที่ไม่เกี่ยว (เช่น footer, system emails)
// → blacklist email ผิดตัว
```

### EDGE-10: DDG Search Fails สำหรับชื่อไทยล้วน
**ไฟล์:** lead-finder.js:2804
```javascript
const cleanEn = businessName.replace(/[\u0E00-\u0E7F...]/g, '');
// ชื่อไทยล้วน → cleanEn = "" → cleanEn.length >= 3 = false
// → ไม่ search DDG → enrichment fail สำหรับธุรกิจไทย
```

---

## 13. Missing Features

### MISS-01: Post-Audit Follow-up Sequence
**Impact: สูงมาก**
หลังส่ง audit report ไม่มี follow-up → lead ที่สนใจหลุดมือ

ควรมี:
```
audit_sent + 2 วัน → "ได้ดู report แล้วไหมครับ? มีข้อไหนสงสัยบอกได้เลย"
audit_sent + 5 วัน → "มี 2 ข้อเพิ่มเติมที่เจอหลังดูลึกขึ้น..." (value-add)
audit_sent + 10 วัน → "ผมจัดโปร package แก้ปัญหาที่เจอใน report..." (soft CTA)
audit_sent + 20 วัน → "เช็คเว็บอีกครั้ง พบว่า [issue] ส่งผลกระทบ..." (urgency)
```

### MISS-02: Conversion Tracking
**Impact: สูง**
ไม่มี status `converted` / `client` / `revenue` → วัด ROI ไม่ได้

ควรมี:
```javascript
lead.convertedAt = '2026-02-20T...'
lead.dealValue = 50000
lead.service = 'DGP Lite'
lead.source = 'cold_outreach' // วัดว่าช่องทางไหนได้ลูกค้า
```

### MISS-03: Win-Back Flow (ลูกค้าเก่า)
**Impact: สูง**
80+ ลูกค้าเก่าไม่ได้รับ touchpoint ใดๆ

ควรมี:
```
จบโปรเจกต์ + 30 วัน → "เว็บทำงานดีไหมครับ? มีอะไรช่วยได้บอก"
+ 90 วัน → Oracle scan เว็บ → ส่ง mini SEO report
+ 180 วัน → "มีบริการใหม่ที่น่าจะเหมาะกับธุรกิจคุณ..."
+ 365 วัน → "ครบ 1 ปี! เว็บคุณเปลี่ยนไปยังไงบ้าง [stats]"
+ ทุกเดือน → SEO Guardian (automated health check)
```

### MISS-04: Global Email Coordinator
**Impact: กลาง**
3 ระบบส่ง email แยกกัน ไม่รู้จักกัน

ควรมี:
```javascript
// emailCoordinator.canSend(module, priority)
// Track global daily total across all modules
// Prevent over-sending from single account
// Priority queue: reply > nurture > outreach > backlink
```

### MISS-05: Unclear Reply Queue
**Impact: กลาง**
`unclear` reply → notify Tar → ถ้า Tar ไม่เห็น → lead หาย

ควรมี:
```
unclear reply → queue → dashboard แสดง "ต้องตอบ 3 leads"
ถ้า Tar ไม่ตอบใน 24 ชม. → Telegram reminder
ถ้ายังไม่ตอบ 48 ชม. → ส่ง generic "ขอบคุณที่ตอบกลับ จะติดต่อเร็วๆ นี้"
```

### MISS-06: A/B Testing Framework
**Impact: ต่ำ (แต่สำคัญระยะยาว)**
ไม่มีทาง test ว่า subject line / email template ไหนดีกว่า

### MISS-07: List-Unsubscribe Header
**Impact: กลาง**
Gmail/Yahoo 2024 sender requirements ต้องการ `List-Unsubscribe` header สำหรับ bulk sender

---

## 14. Recommendations — จัดลำดับแก้

### Sprint 1: แก้ Dead Ends (1-2 วัน)
**เป้าหมาย: ไม่ให้ lead ที่สนใจหลุดมือ**

| # | งาน | ไฟล์ | ความยาก |
|---|------|------|:-------:|
| 1 | แก้ `checkReplies()` ให้เช็ค `audit_sent` leads ด้วย | lead-finder.js:1807 | ง่าย |
| 2 | แก้ `processIncomingMessage()` match ทุก status ยกเว้น bounced/closed | lead-reply-handler.js:179 | ง่าย |
| 3 | เพิ่ม post-audit follow-up (Day 2, 5, 10) | lead-finder.js (ใหม่) | กลาง |
| 4 | เพิ่ม reminder ถ้า lead ไม่จอง calendar หลัง auto-reply 48 ชม. | lead-reply-handler.js | กลาง |

### Sprint 2: แก้ Nurture + Reply Integration (1 วัน)
**เป้าหมาย: Nurture หยุดเมื่อ lead ตอบ + unsubscribe ทำงาน**

| # | งาน | ไฟล์ | ความยาก |
|---|------|------|:-------:|
| 5 | เพิ่ม status check ใน `processNurtureQueue()` | email-nurture.js:351 | ง่าย |
| 6 | เชื่อม reply handler กับ nurture unsubscribe | lead-reply-handler.js | ง่าย |
| 7 | เพิ่ม `List-Unsubscribe` header ใน email | gmail.js, email-nurture.js | ง่าย |
| 8 | แก้ `classifyReply()` default เป็น `unclear` แทน `interested` | lead-finder.js:1529 | ง่าย |

### Sprint 3: แก้ Data Integrity (1 วัน)
**เป้าหมาย: Data ไม่หายเมื่อ deploy**

| # | งาน | ไฟล์ | ความยาก |
|---|------|------|:-------:|
| 9 | เพิ่ม `dbLeads.saveLeads()` ใน lead-reply-handler.js | lead-reply-handler.js:51 | ง่าย |
| 10 | ย้าย RapidAPI key ไป env variable | lead-finder.js:488 | ง่าย |
| 11 | เพิ่ม API key auth middleware | server.js | กลาง |
| 12 | ลบ/protect `/api/leads/reset` | server.js:7032 | ง่าย |

### Sprint 4: Conversion Tracking + Win-Back (3-5 วัน)
**เป้าหมาย: วัด ROI ได้ + monetize ลูกค้าเก่า**

| # | งาน | ไฟล์ | ความยาก |
|---|------|------|:-------:|
| 13 | เพิ่ม `converted`, `client`, `dealValue` fields | lead-finder.js, server.js | กลาง |
| 14 | Dashboard แสดง conversion funnel | dashboard-email/ | กลาง |
| 15 | Old client database + monthly SEO scan | ใหม่ | กลาง |
| 16 | Win-back email sequence | ใหม่ | กลาง |

### Sprint 5: Reliability (2-3 วัน)
**เป้าหมาย: ระบบไม่พัง ไม่ส่งซ้ำ ไม่ leak data**

| # | งาน | ไฟล์ | ความยาก |
|---|------|------|:-------:|
| 17 | Implement file lock / migrate to DB-first | lead-finder.js, server.js | ยาก |
| 18 | Global email coordinator | ใหม่ | กลาง |
| 19 | Gmail send retry with exponential backoff | gmail.js:72 | กลาง |
| 20 | Fix calendar slot logic for Fridays | lead-reply-handler.js:355 | ง่าย |
| 21 | Cleanup rate limiter Map | server.js:7058 | ง่าย |
| 22 | Fix In-Reply-To header | lead-reply-handler.js:336 | ง่าย |
| 23 | Persist watchState to file/DB | lead-reply-handler.js:29 | กลาง |

### Backlog: ทำทีหลังได้
| # | งาน | ความยาก |
|---|------|:-------:|
| 24 | ลบ dead code (generateAuditEmail, sendOutreachEmail, buildDay0) | ง่าย |
| 25 | Deduplicate email template ใน server.js:6341 | กลาง |
| 26 | A/B testing framework | ยาก |
| 27 | Unclear reply queue + escalation | กลาง |
| 28 | listHistory() pagination | กลาง |
| 29 | processedDomains cleanup | ง่าย |
| 30 | OAuth concurrent refresh lock | กลาง |

---

## Appendix: ทุกไฟล์ที่เกี่ยวข้อง

```
main/tools/oracle-agent/
├── server.js                          # Main server (8,781 lines)
├── google-oauth.js                    # OAuth setup script
├── lib/
│   ├── gmail.js                       # Gmail API client
│   ├── lead-finder.js                 # Lead discovery + outreach (3,268 lines)
│   ├── lead-reply-handler.js          # Real-time reply handler (437 lines)
│   ├── email-nurture.js               # Drip campaign (466 lines)
│   ├── gmail-pubsub.js                # Legacy push notification
│   ├── backlink-engine.js             # Backlink outreach emails
│   ├── billing.js                     # Invoice/billing (email)
│   ├── seo-subscription.js            # SEO subscription emails
│   └── db-leads.js                    # Postgres backup for leads
├── data/
│   ├── leads.json                     # Primary lead store
│   ├── lead-targets.json              # Search config (queries, cities)
│   ├── google-token.json              # OAuth tokens (sensitive!)
│   ├── bounce-blacklist.json          # Bounced emails/domains
│   ├── daily-email-count.json         # Daily send counter
│   ├── lead-sheet-id.txt              # Google Sheet ID
│   └── VisionXBrain-Portfolio.pdf     # Attachment
└── data-source/                       # Seed data (baked in Docker)
    ├── leads.json
    ├── google-token.json
    └── VisionXBrain-Portfolio.pdf
```

---

*Report generated by Oracle | 2026-02-26 | 13,000+ lines audited across 5 files*
