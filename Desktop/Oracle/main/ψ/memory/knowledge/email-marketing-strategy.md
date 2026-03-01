# Email Marketing Strategy — VisionXBrain

> สร้าง: 2026-02-07 | สถานะ: Planning

---

## แนวทางหลัก: Lead Magnet + Nurture Sequence

### Flow
```
คนเข้าเว็บ VXB (จาก SEO)
  → เห็น "ดาวน์โหลด Checklist ฟรี"
  → กรอก email
  → Brevo ส่ง email อัตโนมัติ 5 ฉบับ
  → ฉบับสุดท้าย: นัดปรึกษาฟรี
  → ลูกค้าใหม่
```

### Tech Stack
- **Email:** Brevo (free 300/วัน)
- **Automation:** n8n webhook
- **Form:** Webflow native form → webhook → n8n → Brevo API
- **Domain:** ใช้ subdomain `outreach.visionxbrain.com` สำหรับ cold outreach (ถ้าทำ)

### Email Sequence (5 ฉบับ)
| วัน | หัวข้อ | เป้าหมาย |
|-----|--------|----------|
| 0 | ส่ง Checklist PDF | ให้ value ทันที |
| 2 | Case Study: เว็บที่ Conversion เพิ่ม 3x | แสดงฝีมือ |
| 5 | 3 ผิดพลาดที่ทำให้เว็บไม่ติด Google | Pain point |
| 8 | ลูกค้าพูดถึงเราว่าอะไร | Social proof |
| 12 | นัดปรึกษาฟรี 30 นาที | CTA |

### Lead Magnet Ideas
1. **"10 สิ่งที่ต้องเตรียมก่อนทำเว็บ 2026"** ← เลือกอันนี้
2. Website ROI Calculator
3. SEO Checklist สำหรับ SME

---

## แนวทางเสริม: LinkedIn DM Outreach

### ทำไม LinkedIn ดีกว่า Cold Email
- ไม่เสี่ยง domain blacklist
- ไม่ผิด PDPA (เป็น social platform)
- เห็นหน้า เห็นตำแหน่ง → personalize ง่าย
- Reply rate สูงกว่า cold email 3-5 เท่า

### Target
- เจ้าของธุรกิจ SME ที่เว็บเก่า/ไม่มีเว็บ
- Marketing Manager ที่กำลังหา agency
- Startup founders

### วิธีทำ (research ต่อ)
- ต้อง research: LinkedIn Sales Navigator, automation tools (Dripify, Expandi)
- Message template: value-first ไม่ใช่ขายตรง

---

## Cold Email จาก DBD — ไม่แนะนำเป็นหลัก

### เหตุผล
1. DBD ไม่มี email → ต้องขุดเอง เสียเวลา
2. เสี่ยง domain blacklist + PDPA
3. Tar ไม่มีเวลา → ต้อง automate ได้

### ถ้าจะทำ
- ใช้ subdomain แยก
- ส่งวันละ 20-30 ไม่ blast
- Personalize ทุกฉบับ
- ให้ value ก่อน (link ไป lead magnet)

---

## Real-time Lead Reply Handler (2026-02-12)

### Architecture
```
Gmail watch() → Google Pub/Sub → POST /webhook/gmail (Railway)
  → listHistory() → ดึง messages ใหม่
  → Match sender → leads.json
  → Claude Haiku intent: interested / declined / unclear
  → interested: auto-reply + calendar slots + notify
  → declined: status → closed + notify
  → unclear: notify only (Tar reply เอง)
```

### Key Files
- `lib/lead-reply-handler.js` — core handler (NEW)
- `lib/gmail.js` — watchInbox(), listHistory(), stripQuotedText() (ADDED)
- `server.js` — webhook wiring, boot setup, cron renewal

### New Lead Fields
```
lead.replyMessageId    — Gmail message ID ของ reply
lead.replyThreadId     — Thread ID
lead.replySnippet      — 500 chars แรกของ reply
lead.replyIntent       — interested | declined | unclear
lead.autoRepliedAt     — เวลาที่ส่ง auto-reply (max 1/lead)
lead.autoReplyMessageId — Gmail message ID ของ auto-reply
```

### Endpoints
- `GET /api/lead-reply/status` — watch state + stats
- `POST /api/lead-reply/test` — manual test ด้วย messageId
- `POST /api/lead-reply/setup-watch` — force re-watch

### Google Cloud Setup (ทำครั้งเดียว)
1. เปิด Pub/Sub API ใน project `oracle-agent-486604`
2. สร้าง topic: `gmail-notifications`
3. สร้าง push subscription → `https://oracle-agent-production-546e.up.railway.app/webhook/gmail`
4. Grant `gmail-api-push@system.gserviceaccount.com` Publisher role
5. Deploy → เช็ค `/api/lead-reply/status` ว่า watch active

### Safety Guards
- Max 1 auto-reply per lead (autoRepliedAt check)
- Skip: visionxbrain, mailer-daemon, noreply, postmaster
- Calendar fail → fallback text "จะแจ้งเวลาว่างให้ภายหลัง"
- Cron polling เดิม (ทุก 3 ชม.) ยังทำงานเป็น safety net

---

## Bounce Rate Fix (2026-03-01)

### ปัญหา
Bounce rate แสดง 55% — เป็นตัวเลขปลอม เพราะ Gmail SENT sync (email เก่า) ปนเข้ามา
- Overall: 617 emailed, 338 bounced = 55%
- Gmail sync: 398 emailed, 322 bounced = 81% (email เก่าที่ bounce)
- Real lead finder: 219 emailed, 16 bounced = **7%** (ตัวเลขจริง)

### แก้ไข (commit `0334d61`)
1. **Stats API** (`/api/email/stats`) — เพิ่ม `realLeadFinder` + `gmailSynced` breakdown
2. **Lead Stats** (`/api/leads/stats`) — เพิ่ม `breakdown.real` vs `breakdown.gmailSynced`
3. **Gmail Sync** — ใส่ `source: 'gmail_sync'` ทั้ง manual + auto-sync path
4. **Dashboard** — KPI + ActionItems ใช้ real bounce rate, ไม่ trigger false alarm

### Filter Logic
```js
const isGmailSync = l => l.source === 'gmail_sync' || l.reason === 'synced from Gmail SENT';
```
- `source` = field ใหม่สำหรับ record หลัง fix
- `reason` = fallback สำหรับ record เก่า

---

*Last updated: 2026-03-01*
