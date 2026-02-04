# Oracle Agent v5.3 - Features Guide (Thinking Levels)

## รอทำ (Pending)

### 1. GitHub Push Protection (ติด block)
ต้อง allow 4 secrets ก่อน push ได้:
1. https://github.com/qualyads/Tars/security/secret-scanning/unblock-secret/39ADPBUXlHabex7OSGLN8rVWkrD (Anthropic)
2. https://github.com/qualyads/Tars/security/secret-scanning/unblock-secret/39ADP7rMO43YqBXTEDklj46CjgT (Groq)
3. https://github.com/qualyads/Tars/security/secret-scanning/unblock-secret/39ADP7agZgEESRUaWZbi6ZBRHzS (OpenAI)
4. https://github.com/qualyads/Tars/security/secret-scanning/unblock-secret/39ADPBNwuzDVFf50VaHLq6XLuIF (Stripe)

หรือ: GitHub repo → Settings → Code security → Push protection → Disable

หลัง allow แล้ว:
```bash
git push origin main
```

---

## วิธีใช้ Features ทั้งหมด

### 1. Heartbeat System (ตื่นเอง)

**มันคืออะไร:** AI ตื่นขึ้นมาเองทุก 30 นาที เช็คว่ามีอะไรต้องทำไหม

**วิธีใช้:**
```bash
# เช็คสถานะ
curl http://localhost:3456/api/heartbeat/status

# สั่งให้ตื่นทันที
curl -X POST http://localhost:3456/api/heartbeat/trigger
```

**Config:** `config.json` → `heartbeat`
```json
{
  "heartbeat": {
    "enabled": true,
    "every": "30m",
    "activeHours": { "start": 8, "end": 22 }
  }
}
```

---

### 2. Sub-Agent Spawn (AI สร้าง AI ลูก)

**มันคืออะไร:** สั่งให้ AI หลักสร้าง AI ลูกไปทำงาน background

**วิธีใช้:**
```bash
# สร้าง sub-agent
curl -X POST http://localhost:3456/api/subagent/spawn \
  -H "Content-Type: application/json" \
  -d '{"task": "วิเคราะห์ราคาทองวันนี้", "label": "gold-analysis"}'

# เช็คสถานะ
curl http://localhost:3456/api/subagent/status

# ดู output ของ run
curl http://localhost:3456/api/subagent/run/{runId}

# ยกเลิก
curl -X POST http://localhost:3456/api/subagent/stop/{runId}
```

**ตัวอย่างใช้งาน:**
- "ช่วยวิเคราะห์คู่แข่ง 5 โรงแรม พร้อมกัน" → spawn 5 sub-agents
- "เช็คราคา Bitcoin ทุก 5 นาที" → spawn monitoring agent

---

### 3. Multi-Channel Gateway (LINE + Telegram)

**มันคืออะไร:** ใช้ AI ตัวเดียว ตอบได้ทั้ง LINE และ Telegram

**Setup Telegram:**
1. คุย @BotFather ใน Telegram
2. สร้าง bot ใหม่ → ได้ token
3. ใส่ใน config.json:
```json
{
  "telegram": {
    "enabled": true,
    "bot_token": "YOUR_BOT_TOKEN",
    "owner_id": "YOUR_TELEGRAM_ID"
  }
}
```

**วิธีใช้:**
```bash
# ส่งข้อความหา owner ทุกช่องทาง
curl -X POST http://localhost:3456/api/gateway/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "มีการจองใหม่!"}'

# ส่งเฉพาะ LINE
curl -X POST http://localhost:3456/api/gateway/notify \
  -d '{"message": "test", "channels": ["line"]}'
```

---

### 4. Trust Levels (ระดับความเชื่อถือ)

**มันคืออะไร:** แบ่งคนใช้เป็น 3 ระดับ - Owner / Customer / Public

| Level | ทำได้ |
|-------|-------|
| Owner | ทุกอย่าง + approve + spawn agents |
| Customer | ดูข้อมูล + booking (ต้อง approve) |
| Public | ดูข้อมูลทั่วไปเท่านั้น |

**วิธีใช้:**
```bash
# เช็ค trust level ของ user
curl http://localhost:3456/api/trust/check?userId=Uxxxxx

# ดู permissions
curl http://localhost:3456/api/trust/permissions?level=customer

# เพิ่ม trusted user
curl -X POST http://localhost:3456/api/trust/add \
  -d '{"userId": "Uxxxxx", "level": "customer", "name": "คุณสมชาย"}'
```

---

### 5. Tool Policy / Auto-Run (รันเองไม่ต้องถาม)

**มันคืออะไร:** กำหนดว่า AI รันคำสั่งอะไรได้เอง อะไรต้องถาม

**Safe Bins (รันได้เลย):**
`jq, grep, cut, sort, uniq, head, tail, tr, wc, cat, echo`

**วิธีใช้:**
```bash
# เช็ค policy ปัจจุบัน
curl http://localhost:3456/api/tools/policy

# เช็คว่าคำสั่งนี้รันได้ไหม
curl http://localhost:3456/api/tools/check \
  -d '{"command": "rm -rf /", "trustLevel": "customer"}'
# → { "allowed": false, "reason": "dangerous command" }

# อัพเดท policy
curl -X POST http://localhost:3456/api/tools/policy \
  -d '{"level": "customer", "allow": ["read", "search"], "deny": ["exec", "write"]}'
```

---

### 6. Voice TTS/STT (พูด + ฟัง)

**มันคืออะไร:** แปลงข้อความเป็นเสียง / แปลงเสียงเป็นข้อความ

**ต้องมี:** OpenAI API Key หรือ ElevenLabs API Key

**วิธีใช้:**
```bash
# Text to Speech (ได้ไฟล์ MP3)
curl -X POST http://localhost:3456/api/voice/tts \
  -d '{"text": "สวัสดีครับ วันนี้อากาศดีมาก"}' \
  --output speech.mp3

# Speech to Text (ส่งไฟล์เสียง)
curl -X POST http://localhost:3456/api/voice/stt \
  -F "audio=@recording.mp3"
# → { "text": "สวัสดีครับ..." }

# เช็คสถานะ
curl http://localhost:3456/api/voice/status
```

**Config:**
```json
{
  "voice": {
    "enabled": true,
    "ttsProvider": "openai",
    "ttsVoice": "nova",
    "sttModel": "whisper-1"
  }
}
```

---

### 7. Broadcast Groups (หลาย AI ตอบพร้อมกัน)

**มันคืออะไร:** ถามคำถามเดียว ได้คำตอบจากหลาย AI persona

**Groups ที่มี:**
- `decision-panel` - Analyst + Creative + Critic (ตัดสินใจ)
- `code-review` - Analyst + Critic (review code)
- `debate` - Creative + Critic + Advisor (ถกเถียง)

**วิธีใช้:**
```bash
# ถาม decision panel
curl -X POST http://localhost:3456/api/broadcast/send \
  -d '{"group": "decision-panel", "message": "ควรขึ้นราคาห้องพักช่วงปีใหม่ไหม?"}'

# ผลลัพธ์:
# [Analyst]: ดูจากข้อมูล demand ปีที่แล้ว...
# [Creative]: ลองทำ package พิเศษแทนการขึ้นราคาตรงๆ...
# [Critic]: ระวังคู่แข่งไม่ขึ้นราคา แล้วเราเสียลูกค้า...

# ดู groups ทั้งหมด
curl http://localhost:3456/api/broadcast/groups

# ดู agents ทั้งหมด
curl http://localhost:3456/api/broadcast/agents
```

---

### 8. Coding Orchestrator (สั่ง AI เขียนโค้ด)

**มันคืออะไร:** สั่งให้ Codex หรือ Claude Code ไปเขียนโค้ดให้

**ต้องมี:** `codex` หรือ `claude` CLI ติดตั้งไว้

**วิธีใช้:**
```bash
# สั่ง Claude Code ทำงาน
curl -X POST http://localhost:3456/api/coding/spawn \
  -d '{
    "agent": "claude",
    "task": "สร้าง API endpoint สำหรับดึงข้อมูลการจอง",
    "workdir": "/path/to/project"
  }'

# สั่ง Codex
curl -X POST http://localhost:3456/api/coding/spawn \
  -d '{"agent": "codex", "task": "fix the login bug"}'

# เช็คสถานะ
curl http://localhost:3456/api/coding/status

# ดู output
curl http://localhost:3456/api/coding/output/{runId}

# หยุด
curl -X POST http://localhost:3456/api/coding/stop/{runId}
```

---

### 9. Model Failover + Thinking Levels (Auto-switch + Smart reasoning)

**มันคืออะไร:** ถ้า Claude ล่ม → สลับไป GPT/Gemini/Groq อัตโนมัติ + ควบคุมระดับการคิด

**วิธีใช้:**
```bash
# เช็คสถานะ providers
curl http://localhost:3456/api/models/status

# ส่งข้อความ (จะ failover + auto-detect thinking level)
curl -X POST http://localhost:3456/api/models/send \
  -H "Content-Type: application/json" \
  -d '{"message": "วิเคราะห์แนวโน้มตลาดที่พักปีหน้า", "system": "You are a helpful assistant"}'

# ระบุ thinking level เอง (off/minimal/low/medium/high/xhigh)
curl -X POST http://localhost:3456/api/models/send \
  -d '{"message": "วิเคราะห์แนวโน้มตลาด", "thinkingLevel": "high"}'

# ปิด auto thinking (ประหยัด cost)
curl -X POST http://localhost:3456/api/models/send \
  -d '{"message": "สวัสดี", "autoThinking": false}'

# เลือก provider ที่ต้องการ (ถ้ามี)
curl -X POST http://localhost:3456/api/models/send \
  -d '{"message": "test", "preferProvider": "openai", "thinkingLevel": "medium"}'

# Health check ทุก providers
curl -X POST http://localhost:3456/api/models/health-check

# Combined status (Model Failover + Thinking Levels)
curl http://localhost:3456/api/models/combined-status
```

**Response จะมี thinking info:**
```json
{
  "success": true,
  "text": "วิเคราะห์แนวโน้มตลาด...",
  "provider": "anthropic",
  "failoverAttempts": 0,
  "thinking": {
    "level": "high",
    "budget": 4000
  }
}
```

**Fallback Chain:**
```
Claude → GPT → Groq → Gemini
```

**Config:**
```json
{
  "modelFailover": {
    "enabled": true,
    "fallbackChain": ["anthropic", "openai", "groq"],
    "stickySession": true,
    "timeout": 30000
  }
}
```

**Environment Variables ที่ต้องตั้ง:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GOOGLE_API_KEY=AIza...  # Optional
```

---

### 13. Thinking Levels (ควบคุมความลึกการคิด)

**มันคืออะไร:** AI คิดน้อย-มาก ตามความซับซ้อนของคำถาม = ประหยัด 40-50%

**Thinking Levels:**
| Level | Budget | ใช้เมื่อ | ตัวอย่าง |
|-------|--------|---------|---------|
| off | 0 | ไม่ต้องคิด | "สวัสดี", "ใช่/ไม่" |
| minimal | 500 | คิดนิดหน่อย | "ราคาเท่าไหร่" |
| low | 1000 | คิดเบาๆ | "แนะนำห้อง" |
| medium | 2000 | คิดปานกลาง (default) | "ทำไมถึง...", "อธิบาย..." |
| high | 4000 | คิดลึก | "วิเคราะห์...", "strategy" |
| xhigh | 8000 | คิดลึกมาก | "วิจัย...", "comprehensive" |

**วิธีใช้:**
```bash
# เช็คสถานะ Thinking
curl http://localhost:3456/api/thinking/status

# ดู levels ทั้งหมด
curl http://localhost:3456/api/thinking/levels

# Auto-detect level จากข้อความ
curl -X POST http://localhost:3456/api/thinking/detect \
  -H "Content-Type: application/json" \
  -d '{"message": "วิเคราะห์แนวโน้มราคาทอง"}'
# → { "level": "high", "budget": 4000 }

# Process message (detect + track stats)
curl -X POST http://localhost:3456/api/thinking/process \
  -d '{"message": "สวัสดี", "level": "minimal"}'

# ประเมิน cost
curl -X POST http://localhost:3456/api/thinking/estimate-cost \
  -d '{"message": "วิเคราะห์คู่แข่ง", "model": "claude-sonnet-4"}'

# Toggle แสดง reasoning
curl -X POST http://localhost:3456/api/thinking/toggle-reasoning

# Reset stats
curl -X POST http://localhost:3456/api/thinking/reset-stats
```

**Auto-Detection (ตรวจจับอัตโนมัติ):**
```
"สวัสดี" → off
"ห้องว่างไหม" → minimal
"ราคาเท่าไหร่" → low
"ทำไมถึง...", "อธิบาย..." → medium
"วิเคราะห์...", "strategy" → high
"วิจัย...", "comprehensive" → xhigh
```

**Config:**
```json
{
  "thinking": {
    "enabled": true,
    "defaultLevel": "medium",
    "autoDetect": true,
    "showReasoning": false,
    "costTracking": true
  }
}
```

**ประหยัดเงิน:**
```
ก่อน: ทุก message ใช้ 2000 tokens คิด
หลัง: "สวัสดี" = 0, "ราคา?" = 1000, "วิเคราะห์" = 4000

Average savings: 40-50% ต่อเดือน
```

---

### 10. Webhook Ingress (External triggers)

**มันคืออะไร:** รับ webhook จากระบบภายนอก → AI ทำงานทันที

**Supported Sources:**
- Beds24 (booking system)
- Stripe (payments)
- GitHub (repository events)
- Generic (any webhook)

**วิธีใช้:**
```bash
# เช็คสถานะ
curl http://localhost:3456/api/webhooks/status

# ดู history
curl http://localhost:3456/api/webhooks/history

# ดู history เฉพาะ stripe
curl "http://localhost:3456/api/webhooks/history?source=stripe&limit=10"
```

**Webhook URLs สำหรับตั้งค่าในระบบอื่น:**
```
Beds24:  https://your-domain.com/webhook/beds24
Stripe:  https://your-domain.com/webhook/stripe
GitHub:  https://your-domain.com/webhook/github
Generic: https://your-domain.com/webhook/:source
```

**ตัวอย่าง: Stripe ส่ง webhook มาเมื่อจ่ายเงินสำเร็จ**
```
1. Customer จ่ายเงินผ่าน Stripe
2. Stripe ส่ง webhook → /webhook/stripe
3. Oracle รับ event "payment_intent.succeeded"
4. Oracle แจ้ง LINE: "💰 ชำระเงินสำเร็จ! 2,500 THB"
5. (Optional) Oracle อัพเดท booking status
```

**ตัวอย่าง: Beds24 ส่ง webhook มาเมื่อมีการจองใหม่**
```
1. ลูกค้าจองผ่าน Booking.com
2. Beds24 sync การจอง
3. Beds24 ส่ง webhook → /webhook/beds24
4. Oracle รับ event "booking.new"
5. Oracle แจ้ง LINE: "🎉 การจองใหม่! Guest: John, 15-17 Feb"
```

**Config:**
```json
{
  "webhooks": {
    "enabled": true,
    "secrets": {
      "beds24": "",
      "stripe": "whsec_...",
      "github": "your-webhook-secret"
    }
  }
}
```

---

### 11. Gmail Pub/Sub (Email Real-time)

**มันคืออะไร:** รับแจ้งเตือน email ทันทีที่มาถึง ไม่ต้อง poll

**วิธีใช้:**
```bash
# เช็คสถานะ
curl http://localhost:3456/api/gmail/status

# Process email manually (for testing)
curl -X POST http://localhost:3456/api/gmail/process \
  -H "Content-Type: application/json" \
  -d '{
    "from": "customer@example.com",
    "subject": "ขอราคาห้องพัก",
    "body": "สนใจห้อง Deluxe วันที่ 15-17 ก.พ. ราคาเท่าไหร่ครับ"
  }'

# Response:
{
  "success": true,
  "email": {
    "id": "email_123",
    "category": "booking_inquiry",
    "priority": 2,
    "ota": null
  }
}
```

**Webhook URL สำหรับ Gmail:**
```
POST https://your-domain.com/webhook/gmail
```

**Email Categories (จัดหมวดอัตโนมัติ):**
- `booking_inquiry` - ลูกค้าสอบถาม
- `booking_confirmation` - ยืนยันการจอง
- `ota_notification` - แจ้งเตือนจาก Booking.com/Agoda
- `payment` - การชำระเงิน
- `urgent` - ด่วน
- `spam` - Spam (skip)

**Config:**
```json
{
  "gmail": {
    "enabled": true,
    "autoProcess": true,
    "autoDraft": false,
    "notifyOwner": true
  }
}
```

---

### 12. Queue Management (จัดการข้อความ)

**มันคืออะไร:** รวมข้อความหลายอันเป็นหนึ่งเดียว ไม่ต้องตอบทีละอัน

**วิธีใช้:**
```bash
# เช็คสถานะ queue
curl http://localhost:3456/api/queue/status

# ดู lane เฉพาะ
curl http://localhost:3456/api/queue/lane/main

# Enqueue message
curl -X POST http://localhost:3456/api/queue/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "สวัสดี",
    "lane": "main",
    "sessionId": "user123"
  }'
```

**Queue Modes:**
- `steer` - ใช้ข้อความล่าสุดเป็นหลัก (default)
- `collect` - รวมทุกข้อความเข้าด้วยกัน
- `fifo` - First in, first out

**ตัวอย่าง Steer Mode:**
```
User ส่ง 5 ข้อความ:
  "สวัสดี"
  "มีห้องว่างไหม"
  "วันที่ 15-17"
  "2 คน"
  "ขอราคาด้วย"
        ↓
Queue รวมเป็น:
{
  "mode": "steer",
  "current": "ขอราคาด้วย",
  "previous": ["สวัสดี", "มีห้องว่างไหม", "วันที่ 15-17", "2 คน"],
  "count": 5
}
        ↓
AI ตอบรวม 1 ข้อความ:
"สวัสดีค่ะ! วันที่ 15-17 (2 คน) มีห้อง Deluxe ว่าง ราคา 2,500/คืน"
```

**Lanes (ช่องทาง):**
| Lane | Concurrency | Mode | ใช้ทำอะไร |
|------|------------|------|----------|
| main | 1 | steer | User messages |
| subagent | 8 | fifo | Background workers |
| webhook | 4 | fifo | External triggers |

**Config:**
```json
{
  "queue": {
    "enabled": true,
    "lanes": {
      "main": {
        "concurrency": 1,
        "mode": "steer",
        "collectWindow": 3000,
        "maxBatchSize": 10
      }
    }
  }
}
```

---

## Quick Reference

| Feature | Endpoint | ใช้ทำอะไร |
|---------|----------|----------|
| Heartbeat | `/api/heartbeat/*` | AI ตื่นเอง |
| Sub-Agent | `/api/subagent/*` | สร้าง AI ลูก |
| Gateway | `/api/gateway/*` | ส่งข้อความหลายช่อง |
| Trust | `/api/trust/*` | จัดการสิทธิ์ |
| Tools | `/api/tools/*` | Auto-run policy |
| Voice | `/api/voice/*` | พูด/ฟัง |
| Broadcast | `/api/broadcast/*` | หลาย AI ตอบ |
| Coding | `/api/coding/*` | สั่ง AI เขียนโค้ด |
| **Model Failover** | `/api/models/*` | **สลับ AI provider + thinking** |
| **Webhooks** | `/api/webhooks/*`, `/webhook/*` | **รับ triggers ภายนอก** |
| **Gmail** | `/api/gmail/*`, `/webhook/gmail` | **Email real-time** |
| **Queue** | `/api/queue/*` | **จัดการข้อความ** |
| **Thinking** | `/api/thinking/*` | **ควบคุมความลึกการคิด** |

---

## ตัวอย่างการใช้งานจริง

### Scenario 1: ตัดสินใจธุรกิจ
```bash
# ถาม 3 AI พร้อมกัน
curl -X POST http://localhost:3456/api/broadcast/send \
  -d '{"group": "decision-panel", "message": "ควรเปิดโรงแรมสาขาใหม่ที่เชียงใหม่ไหม?"}'
```

### Scenario 2: วิเคราะห์คู่แข่ง parallel
```bash
# spawn 3 sub-agents พร้อมกัน
for hotel in "hotel-a" "hotel-b" "hotel-c"; do
  curl -X POST http://localhost:3456/api/subagent/spawn \
    -d "{\"task\": \"วิเคราะห์ $hotel\", \"label\": \"$hotel\"}"
done
```

### Scenario 3: แจ้งเตือนทุกช่องทาง
```bash
# มีการจองใหม่ → แจ้ง LINE + Telegram
curl -X POST http://localhost:3456/api/gateway/notify \
  -d '{"message": "🎉 การจองใหม่! ห้อง Deluxe 2 คืน"}'
```

### Scenario 4: ระบบไม่ล่มแม้ Claude down
```bash
# ส่งข้อความ - ถ้า Claude ล่ม จะสลับไป GPT อัตโนมัติ
curl -X POST http://localhost:3456/api/models/send \
  -d '{"message": "วิเคราะห์ยอดขายเดือนนี้"}'

# Response จะบอกว่าใช้ provider ไหน
# { "text": "...", "provider": "openai", "failoverAttempts": 1 }
```

### Scenario 5: Stripe webhook → AI แจ้งเตือนทันที
```bash
# Stripe จะส่ง webhook มาที่ URL นี้:
# POST https://your-domain.com/webhook/stripe

# เมื่อลูกค้าจ่ายเงิน:
# → AI ได้รับ notification ทันที
# → AI ส่ง LINE: "💰 ชำระเงินสำเร็จ! 2,500 THB"
# → AI อัพเดทระบบ (optional)
```

### Scenario 6: Beds24 booking → AI prepare ห้อง
```bash
# Beds24 จะส่ง webhook มาที่:
# POST https://your-domain.com/webhook/beds24

# เมื่อมีการจองใหม่:
# → AI แจ้ง: "🎉 การจองใหม่! John Smith, 15-17 Feb"
# → AI สามารถ trigger งานอื่นต่อได้
```

### Scenario 7: คำถามง่าย vs ซับซ้อน (Thinking Levels)
```bash
# คำถามง่าย → thinking off → ตอบเร็ว ประหยัด
curl -X POST http://localhost:3456/api/models/send \
  -d '{"message": "สวัสดี"}'
# → thinking: { level: "off", budget: 0 }

# คำถามซับซ้อน → thinking high → คิดลึก
curl -X POST http://localhost:3456/api/models/send \
  -d '{"message": "วิเคราะห์แนวโน้มตลาดที่พักปี 2026 พร้อมคู่แข่ง"}'
# → thinking: { level: "high", budget: 4000 }
```

### Scenario 8: ระบุ thinking level เอง
```bash
# บังคับให้คิดลึกแม้คำถามสั้น
curl -X POST http://localhost:3456/api/models/send \
  -d '{
    "message": "ราคาทอง",
    "thinkingLevel": "xhigh"
  }'
# → AI วิเคราะห์ราคาทองอย่างละเอียด แม้ถามสั้น
```

---

*Last updated: 2026-02-04 (v5.3.0 - Thinking Levels integrated)*
