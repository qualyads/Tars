# Oracle Agent v5.2 - วิธีใช้ & ทำงานยังไง

## สารบัญ

1. [Model Failover](#1-model-failover) - ไม่ล่มแม้ AI provider down
2. [Webhook Ingress](#2-webhook-ingress) - ระบบภายนอกสั่ง AI ได้
3. [Heartbeat](#3-heartbeat) - AI ตื่นเอง
4. [Sub-Agent Spawn](#4-sub-agent-spawn) - AI สร้าง AI ลูก
5. [Multi-Channel Gateway](#5-multi-channel-gateway) - LINE + Telegram
6. [Trust Levels](#6-trust-levels) - ระดับสิทธิ์
7. [Tool Policy](#7-tool-policy) - Auto-run
8. [Voice TTS/STT](#8-voice-ttsstt) - พูด/ฟัง
9. [Broadcast Groups](#9-broadcast-groups) - หลาย AI ตอบ
10. [Coding Orchestrator](#10-coding-orchestrator) - สั่ง AI เขียนโค้ด
11. [Gmail Pub/Sub](#11-gmail-pubsub) - Email real-time
12. [Queue Management](#12-queue-management) - จัดการข้อความพร้อมกัน

---

## 1. Model Failover

### ทำงานยังไง?

```
ปกติ:
User → Claude → Response ✅

Claude ล่ม:
User → Claude ❌ → GPT → Response ✅

GPT ล่มด้วย:
User → Claude ❌ → GPT ❌ → Groq → Response ✅
```

### ดียังไง?

| ปัญหาเดิม | แก้ได้ยังไง |
|-----------|------------|
| Claude ล่ม = ระบบหยุด | สลับไป GPT อัตโนมัติ |
| Rate limit = รอนาน | สลับ provider ทันที |
| ลูกค้าส่งข้อความ ไม่มีใครตอบ | มี backup เสมอ |

### วิธีใช้

```bash
# เช็คสถานะ providers ทั้งหมด
curl http://localhost:3456/api/models/status

# ส่งข้อความ (failover อัตโนมัติ)
curl -X POST http://localhost:3456/api/models/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "วิเคราะห์ยอดขายเดือนนี้",
    "system": "คุณเป็น AI ที่ช่วยวิเคราะห์ธุรกิจ"
  }'

# Response:
{
  "success": true,
  "text": "ยอดขายเดือนนี้...",
  "provider": "anthropic",      // ใช้ provider ไหน
  "failoverAttempts": 0,        // ต้อง switch กี่ครั้ง
  "model": "claude-sonnet-4",
  "usage": {
    "inputTokens": 50,
    "outputTokens": 200
  }
}

# ถ้า Claude ล่ม จะได้:
{
  "provider": "openai",
  "failoverAttempts": 1         // switch 1 ครั้ง
}
```

### ตั้งค่า

**Environment Variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-...    # Claude (primary)
OPENAI_API_KEY=sk-...           # GPT (fallback 1)
GROQ_API_KEY=gsk_...            # Groq (fallback 2)
GOOGLE_API_KEY=AIza...          # Gemini (fallback 3)
```

**config.json:**
```json
{
  "modelFailover": {
    "enabled": true,
    "fallbackChain": ["anthropic", "openai", "groq", "google"],
    "stickySession": true,
    "timeout": 30000
  }
}
```

---

## 2. Webhook Ingress

### ทำงานยังไง?

```
ปกติ (ไม่มี webhook):
1. ลูกค้าจ่ายเงิน Stripe
2. คุณต้องเปิด Stripe dashboard ดูเอง
3. อาจพลาดการแจ้งเตือน

มี Webhook:
1. ลูกค้าจ่ายเงิน Stripe
2. Stripe ส่ง webhook → Oracle
3. Oracle แจ้ง LINE ทันที: "💰 ชำระเงิน 2,500 บาท!"
4. คุณรู้ทันที ไม่พลาด
```

### ดียังไง?

| ปัญหาเดิม | แก้ได้ยังไง |
|-----------|------------|
| ต้องเปิดดู dashboard ตลอด | ระบบแจ้งมาเอง |
| พลาด notification สำคัญ | Real-time alert |
| ต้อง manual check ทุกระบบ | Automate ทั้งหมด |

### วิธีใช้

**1. ตั้งค่า Webhook URL ใน Stripe:**
```
URL: https://your-railway-domain.com/webhook/stripe
Events: payment_intent.succeeded, charge.refunded
```

**2. ตั้งค่า Webhook URL ใน Beds24:**
```
URL: https://your-railway-domain.com/webhook/beds24
Events: New booking, Modified booking, Cancelled
```

**3. ตั้งค่า Webhook URL ใน GitHub:**
```
URL: https://your-railway-domain.com/webhook/github
Events: push, pull_request, workflow_run
```

**ดู Webhook History:**
```bash
# ดูทั้งหมด
curl http://localhost:3456/api/webhooks/history

# ดูเฉพาะ Stripe
curl "http://localhost:3456/api/webhooks/history?source=stripe"

# Response:
{
  "history": [
    {
      "id": "wh_1234567890_abc",
      "source": "stripe",
      "eventType": "payment_intent.succeeded",
      "timestamp": "2026-02-04T15:30:00Z",
      "status": "processed",
      "result": {
        "notified": true,
        "message": "💰 ชำระเงินสำเร็จ! 2,500 THB"
      }
    }
  ]
}
```

### ตัวอย่างการใช้งานจริง

**Scenario: ลูกค้าจองผ่าน Booking.com**
```
1. ลูกค้าจอง → Booking.com sync to Beds24
2. Beds24 ส่ง webhook → POST /webhook/beds24
3. Oracle ประมวลผล:
   - ดึงข้อมูล: Guest name, Check-in, Check-out
   - แจ้ง LINE: "🎉 การจองใหม่! John Smith, 15-17 Feb, Deluxe Room"
4. คุณเห็นทันที ไม่ต้องเปิด Beds24 เช็ค
```

**Scenario: ลูกค้าชำระเงินผ่าน Stripe**
```
1. ลูกค้ากด Pay → Stripe charge
2. Stripe ส่ง webhook → POST /webhook/stripe
3. Oracle ประมวลผล:
   - ดึงข้อมูล: Amount, Currency, Customer
   - แจ้ง LINE: "💰 ชำระเงินสำเร็จ! 2,500 THB จาก John"
4. Optional: Oracle อัพเดท booking status อัตโนมัติ
```

---

## 3. Heartbeat

### ทำงานยังไง?

```
ทุก 30 นาที (08:00-22:00):
1. Oracle ตื่นขึ้นมาเอง
2. เช็ค checklist: มีอะไรต้องทำไหม?
3. ถ้ามี → ทำเลย หรือ แจ้งเตือน
4. ถ้าไม่มี → HEARTBEAT_OK แล้วนอนต่อ
```

### ดียังไง?

- AI ไม่ต้องรอคำสั่ง - คิดเองทำเอง
- ไม่พลาดงานสำคัญ
- ประหยัด cost (~$1/เดือน ใช้ Haiku)

### วิธีใช้

```bash
# เช็คสถานะ
curl http://localhost:3456/api/heartbeat/status

# สั่งให้ตื่นทันที (manual trigger)
curl -X POST http://localhost:3456/api/heartbeat/trigger
```

---

## 4. Sub-Agent Spawn

### ทำงานยังไง?

```
คุณ: "วิเคราะห์คู่แข่ง 5 โรงแรม"

ปกติ: ทำทีละอัน = 5 นาที

มี Sub-Agent:
Oracle สร้าง 5 AI ลูก → ทำพร้อมกัน = 1 นาที

  ┌─ AI ลูก 1 → วิเคราะห์โรงแรม A
  ├─ AI ลูก 2 → วิเคราะห์โรงแรม B
  ├─ AI ลูก 3 → วิเคราะห์โรงแรม C
  ├─ AI ลูก 4 → วิเคราะห์โรงแรม D
  └─ AI ลูก 5 → วิเคราะห์โรงแรม E
                    ↓
              รวมผลลัพธ์ส่งกลับ
```

### ดียังไง?

- เร็วขึ้น 5x (parallel processing)
- Non-blocking - ทำงานอื่นระหว่างรอได้
- ประหยัด cost - ใช้ Haiku model

### วิธีใช้

```bash
# Spawn sub-agent
curl -X POST http://localhost:3456/api/subagent/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "task": "วิเคราะห์ราคาทองวันนี้ สรุปสั้นๆ",
    "label": "gold-analysis"
  }'

# Response:
{
  "status": "accepted",
  "runId": "abc123",
  "message": "Sub-agent spawned"
}

# เช็คผลลัพธ์
curl http://localhost:3456/api/subagent/runs/abc123
```

---

## 5. Multi-Channel Gateway

### ทำงานยังไง?

```
┌─────────────┐
│   Oracle    │  ← สมองเดียวกัน
└─────────────┘
       │
   ┌───┴───┐
   ▼       ▼
 LINE   Telegram  ← หลายช่องทาง
```

### ดียังไง?

- ลูกค้าติดต่อช่องทางไหนก็ได้
- AI ตอบเหมือนกัน (consistent)
- ไม่ต้อง manage หลายระบบ

### วิธีใช้

```bash
# ส่งข้อความหา owner ทุกช่องทาง
curl -X POST http://localhost:3456/api/gateway/notify \
  -d '{"message": "มีการจองใหม่!"}'

# ส่งเฉพาะ LINE
curl -X POST http://localhost:3456/api/gateway/notify \
  -d '{"message": "test", "channels": ["line"]}'
```

---

## 6. Trust Levels

### ทำงานยังไง?

```
┌──────────────────────────────────────────┐
│  OWNER (คุณ)                              │
│  ✅ ทำได้ทุกอย่าง                          │
│  ✅ Approve actions                       │
│  ✅ Spawn agents                          │
├──────────────────────────────────────────┤
│  CUSTOMER (ลูกค้า)                        │
│  ✅ ถามข้อมูลได้                           │
│  ⏳ จอง (ต้อง approve)                    │
│  ❌ ดูข้อมูลส่วนตัว                        │
├──────────────────────────────────────────┤
│  PUBLIC (คนทั่วไป)                        │
│  ✅ ดูข้อมูลทั่วไป                         │
│  ❌ จอง                                   │
│  ❌ ดูข้อมูลส่วนตัว                        │
└──────────────────────────────────────────┘
```

### ดียังไง?

- ปลอดภัย - คนนอกทำอะไรไม่ได้
- ยืดหยุ่น - กำหนดสิทธิ์ได้ละเอียด
- Audit - รู้ว่าใครทำอะไร

---

## 7. Tool Policy

### ทำงานยังไง?

```
AI ต้องการรัน command:

Safe commands (รันได้เลย):
✅ jq, grep, cat, echo, head, tail

Dangerous commands (ต้องถาม):
⏳ rm, mv, git push, npm publish

Blocked commands (ห้ามเด็ดขาด):
❌ rm -rf /, sudo, curl | bash
```

### ดียังไง?

- AI ทำงานเร็วขึ้น (ไม่ต้องถามทุกครั้ง)
- ปลอดภัย (block คำสั่งอันตราย)
- Customizable (เพิ่ม/ลด allow list ได้)

---

## 8. Voice TTS/STT

### ทำงานยังไง?

```
Text-to-Speech (TTS):
"สวัสดีครับ" → 🔊 [ไฟล์เสียง MP3]

Speech-to-Text (STT):
🎤 [ไฟล์เสียง] → "สวัสดีครับ วันนี้อากาศดี"
```

### วิธีใช้

```bash
# Text to Speech
curl -X POST http://localhost:3456/api/voice/tts \
  -d '{"text": "สวัสดีครับ"}' \
  --output speech.mp3

# Speech to Text
curl -X POST http://localhost:3456/api/voice/stt \
  -F "audio=@recording.mp3"
```

---

## 9. Broadcast Groups

### ทำงานยังไง?

```
คุณ: "ควรขึ้นราคาห้องพักไหม?"

┌─────────────┐
│  Question   │
└─────────────┘
       │
   ┌───┼───┐
   ▼   ▼   ▼
 ┌───┐┌───┐┌───┐
 │ A ││ B ││ C │  ← 3 AI personas
 └───┘└───┘└───┘
   │   │   │
   ▼   ▼   ▼

[Analyst]: "ดูจากข้อมูล demand สูง ขึ้นได้ 10%"
[Creative]: "ลองทำ package แทน ดูดีกว่าขึ้นราคาตรงๆ"
[Critic]: "ระวัง คู่แข่งอาจไม่ขึ้น แล้วเสียลูกค้า"
```

### ดียังไง?

- ได้มุมมองหลากหลาย
- ตัดสินใจดีขึ้น
- เหมือนมีทีมที่ปรึกษา

### วิธีใช้

```bash
curl -X POST http://localhost:3456/api/broadcast \
  -d '{
    "groupId": "decision-panel",
    "message": "ควรขึ้นราคาห้องพักช่วงปีใหม่ไหม?"
  }'
```

---

## 10. Coding Orchestrator

### ทำงานยังไง?

```
คุณ: "สร้าง API endpoint สำหรับ booking"

Oracle → spawn Claude Code
         ↓
Claude Code:
  - อ่าน codebase
  - เขียน code
  - รัน tests
  - commit
         ↓
Oracle: "เสร็จแล้วครับ สร้าง /api/booking"
```

### ดียังไง?

- ไม่ต้องเขียน code เอง
- AI เขียนให้ตาม spec
- รองรับ Claude Code และ Codex

### วิธีใช้

```bash
curl -X POST http://localhost:3456/api/coding/spawn \
  -d '{
    "agent": "claude",
    "task": "สร้าง API endpoint สำหรับดึงข้อมูลการจอง",
    "workdir": "/path/to/project"
  }'
```

---

## 11. Gmail Pub/Sub

### ทำงานยังไง?

```
ปกติ (ไม่มี Gmail integration):
08:00 - ลูกค้าส่ง email ถามราคา
08:30 - คุณยังไม่เห็น (ยังไม่เปิด email)
09:00 - ลูกค้ารอนาน → จองที่อื่น
         ❌ เสียลูกค้า

มี Gmail Pub/Sub:
08:00 - ลูกค้าส่ง email
08:00 - Gmail push → Oracle รู้ทันที
08:01 - Oracle แจ้ง LINE: "📧 Email ใหม่!"
08:02 - Oracle draft ตอบให้
08:05 - คุณ approve → ส่ง
         ✅ ปิดการขาย!
```

### ดียังไง?

| ปัญหาเดิม | แก้ได้ยังไง |
|-----------|------------|
| Response time 1-2 ชม. | **< 5 นาที** |
| พลาด inquiry 10-20% | **< 2%** |
| ต้องเปิด email ดูตลอด | AI แจ้งมาเอง |

### วิธีใช้

```bash
# เช็คสถานะ
curl http://localhost:3456/api/gmail/status

# Test process email
curl -X POST http://localhost:3456/api/gmail/process \
  -d '{
    "from": "customer@example.com",
    "subject": "ขอราคาห้องพัก",
    "body": "สนใจห้อง Deluxe วันที่ 15-17"
  }'
```

### Email Categories (จัดหมวดอัตโนมัติ)

| Category | ตัวอย่าง |
|----------|---------|
| `booking_inquiry` | ลูกค้าถามราคา |
| `ota_notification` | แจ้งเตือนจาก Booking.com |
| `payment` | การชำระเงิน |
| `urgent` | Email ด่วน |

---

## 12. Queue Management

### ทำงานยังไง?

```
ลูกค้าพิมพ์เร็วๆ 5 ข้อความ:
┌──────────────────────┐
│ msg1: "สวัสดี"       │
│ msg2: "มีห้องว่างไหม" │
│ msg3: "วันที่ 15-17" │
│ msg4: "2 คน"         │
│ msg5: "ขอราคาด้วย"   │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│   QUEUE MANAGER      │
│   (Steer Mode)       │
│                      │
│   รอ 3 วินาที...     │
│   รวมเป็น 1 request  │
└──────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ AI เห็น:                             │
│ "User ส่ง 5 ข้อความ                  │
│  Previous: สวัสดี, ห้องว่าง, 15-17, 2คน│
│  Latest: ขอราคาด้วย"                 │
│                                      │
│ AI ตอบรวม 1 ข้อความ:                 │
│ "สวัสดีค่ะ! วันที่ 15-17 (2 คน)      │
│  มี Deluxe ว่าง 2,500/คืน"           │
└──────────────────────────────────────┘
```

### ดียังไง?

| ปัญหาเดิม | แก้ได้ยังไง |
|-----------|------------|
| ตอบ 5 ข้อความ = รก | ตอบ 1 ข้อความ = สะอาด |
| ค่า API 5x | ค่า API **1x** |
| ลูกค้างง | UX ดี |

### Queue Modes

| Mode | ทำงานยังไง | ใช้เมื่อไหร่ |
|------|-----------|-------------|
| `steer` | ใช้ข้อความล่าสุดเป็นหลัก | User chat |
| `collect` | รวมทุกข้อความเข้าด้วยกัน | Batch processing |
| `fifo` | First in, first out | Background tasks |

### วิธีใช้

```bash
# เช็คสถานะ
curl http://localhost:3456/api/queue/status

# ดู lane เฉพาะ
curl http://localhost:3456/api/queue/lane/main

# Config lane
curl -X POST http://localhost:3456/api/queue/lane/main/config \
  -d '{"collectWindow": 5000, "maxBatchSize": 15}'
```

---

## Quick Start หลัง Deploy

### 1. ตั้งค่า Environment Variables (Railway)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
LINE_CHANNEL_TOKEN=...
LINE_CHANNEL_SECRET=...

# Optional (สำหรับ failover)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Optional (สำหรับ voice)
OPENAI_API_KEY=sk-...  # ใช้ตัวเดียวกับ failover ได้
```

### 2. ตั้งค่า Webhooks

**Stripe:**
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.up.railway.app/webhook/stripe`
3. Select events: `payment_intent.succeeded`
4. Copy signing secret → ใส่ใน Railway ENV: `STRIPE_WEBHOOK_SECRET`

**Beds24:**
1. Beds24 → Settings → Webhooks
2. Add URL: `https://your-domain.up.railway.app/webhook/beds24`
3. Select events: New booking, Modified, Cancelled

### 3. ทดสอบ

```bash
# Health check
curl https://your-domain.up.railway.app/health

# Model failover status
curl https://your-domain.up.railway.app/api/models/status

# Webhook status
curl https://your-domain.up.railway.app/api/webhooks/status
```

---

## Summary: ทำไมต้องใช้?

| Feature | ปัญหาที่แก้ | ประโยชน์ |
|---------|-----------|---------|
| Model Failover | AI ล่ม = ธุรกิจหยุด | Uptime 99.9% |
| Webhook Ingress | ต้อง manual check | Real-time alerts |
| Heartbeat | AI รอคำสั่ง | AI คิดเอง |
| Sub-Agent | ทำทีละอัน | เร็วขึ้น 5x |
| Multi-Channel | Manage หลายที่ | จุดเดียว |
| Trust Levels | ใครก็ทำได้ | ปลอดภัย |
| Tool Policy | ต้องถามทุกครั้ง | อัตโนมัติ |
| Voice | พิมพ์อย่างเดียว | พูดได้ |
| Broadcast | ความเห็นเดียว | หลายมุมมอง |
| Coding | เขียน code เอง | AI เขียนให้ |
| **Gmail Pub/Sub** | **ตอบ email ช้า** | **Real-time < 5 นาที** |
| **Queue Manager** | **ตอบ 5 ข้อความ รก** | **ตอบรวม 1 ข้อความ** |

---

*Oracle Agent v5.2.0 - Last updated: 2026-02-04*
