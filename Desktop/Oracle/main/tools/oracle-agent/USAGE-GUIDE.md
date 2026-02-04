# Oracle Agent v5.6.0 - Usage Guide

## สารบัญ

1. [Self-Improvement Features](#self-improvement-features)
2. [Proactive Partner Features](#proactive-partner-features)
3. [API Endpoints](#api-endpoints)
4. [การ Setup](#การ-setup)

---

## Self-Improvement Features

### 1. Sentiment Analysis - วิเคราะห์อารมณ์

**ทำงานอัตโนมัติ** เมื่อมีข้อความเข้ามา

```bash
# ดู status
curl http://localhost:3000/api/sentiment/status

# วิเคราะห์ข้อความ
curl -X POST http://localhost:3000/api/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{"message": "ทำไมยังไม่เสร็จอีก!", "userId": "user123"}'

# Response:
{
  "mood": "frustrated",
  "confidence": 0.85,
  "urgency": "medium",
  "style": {
    "tone": "calm",
    "brevity": "concise",
    "tips": ["Acknowledge frustration", "Focus on solution"]
  }
}

# ดูประวัติอารมณ์ของ user
curl http://localhost:3000/api/sentiment/history/user123

# ดู mood ปัจจุบัน
curl http://localhost:3000/api/sentiment/mood/user123
```

**Moods ที่ตรวจจับได้:**
- `happy`, `excited` - อารมณ์ดี
- `neutral` - ปกติ
- `confused` - สับสน
- `frustrated`, `angry` - หงุดหงิด/โกรธ
- `sad` - เศร้า
- `urgent`, `stressed` - เร่งด่วน/เครียด

---

### 2. Self-Reflection - เช็คคำตอบก่อนส่ง

**ทำงานอัตโนมัติ** ก่อนส่งทุก response

```bash
# ดู status
curl http://localhost:3000/api/reflection/status

# เช็คคำตอบ
curl -X POST http://localhost:3000/api/reflection/check \
  -H "Content-Type: application/json" \
  -d '{"response": "ทำให้เสร็จได้ไหมครับ?", "context": {}}'

# Response:
{
  "ok": false,
  "blocked": false,
  "issues": [
    {
      "type": "permission",
      "severity": "error",
      "message": "กำลังจะถาม permission - Tars ไม่ชอบ!",
      "suggestion": "ทำเลย ไม่ต้องถาม"
    }
  ]
}

# Auto-improve response
curl -X POST http://localhost:3000/api/reflection/improve \
  -H "Content-Type: application/json" \
  -d '{"response": "อย่างไรก็ตาม ผมจะทำให้ได้ไหมครับ?"}'
```

**สิ่งที่ตรวจ:**
- ถาม permission (Tars ไม่ชอบ)
- Overclaiming (อ้างเกินจริง)
- Assumptions (คิดเอาเอง)
- Verbose (พูดมากเกินไป)
- Secrets (expose credentials)

---

### 3. Mistake Tracker - ป้องกันความผิดพลาดซ้ำ

**ทำงานอัตโนมัติ** เช็คก่อนตอบทุกครั้ง

```bash
# ดู status
curl http://localhost:3000/api/mistakes/status

# ดูความผิดพลาดล่าสุด
curl http://localhost:3000/api/mistakes/recent?limit=5

# ดู prevention rules
curl http://localhost:3000/api/mistakes/rules

# บันทึกความผิดพลาดใหม่
curl -X POST http://localhost:3000/api/mistakes/record \
  -H "Content-Type: application/json" \
  -d '{
    "description": "บอกว่า feature ไม่มี ทั้งที่มีอยู่แล้ว",
    "correction": "ต้อง grep หาก่อน",
    "category": "assumption",
    "severity": "high",
    "prevention": "grep -l keyword lib/*.js ก่อนบอกว่าไม่มี"
  }'

# เช็คก่อนตอบ
curl -X POST http://localhost:3000/api/mistakes/check \
  -H "Content-Type: application/json" \
  -d '{"action": "claim", "claiming": "ทำไปแล้ว 100%"}'
```

**Categories:**
- `assumption` - คิดเอาเอง
- `overclaim` - อ้างเกินจริง
- `underclaim` - ประเมินต่ำเกินไป
- `permission` - ถามมากเกินไป
- `verbose` - พูดมากเกินไป

---

### 4. Quality Tracker - วัดคุณภาพคำตอบ

**ทำงานอัตโนมัติ** หลังส่ง response

```bash
# ดู status
curl http://localhost:3000/api/quality/status

# ดู report
curl http://localhost:3000/api/quality/report

# Response:
{
  "summary": {
    "totalResponses": 150,
    "averageScore": 78,
    "trend": "improving"
  },
  "weakAreas": [
    {"dimension": "brevity", "average": 65}
  ],
  "strongAreas": [
    {"dimension": "relevance", "average": 85}
  ],
  "recommendations": [
    "Keep responses concise - avoid unnecessary details"
  ]
}

# ดู trend
curl http://localhost:3000/api/quality/trend?days=7

# ให้คะแนน response
curl -X POST http://localhost:3000/api/quality/score \
  -H "Content-Type: application/json" \
  -d '{
    "response": "โอเค ทำให้เลยครับ",
    "context": {"type": "line_reply", "formal": false}
  }'

# เพิ่ม user feedback
curl -X POST http://localhost:3000/api/quality/feedback \
  -H "Content-Type: application/json" \
  -d '{"recordId": "q_123456", "feedback": {"userRating": 5, "accurate": true}}'
```

**Dimensions ที่วัด:**
- `relevance` - ตรงประเด็น
- `accuracy` - ถูกต้อง
- `completeness` - ครบถ้วน
- `brevity` - กระชับ
- `clarity` - ชัดเจน
- `helpfulness` - มีประโยชน์
- `tone` - น้ำเสียง

---

## Proactive Partner Features

### 5. Reminder System - ตั้งเตือน

```bash
# ดู status
curl http://localhost:3000/api/reminders/status

# ตั้ง reminder
curl -X POST http://localhost:3000/api/reminders/add \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "owner",
    "message": "โทรหาลูกค้า",
    "time": "2026-02-05T17:00:00+07:00",
    "channel": "line",
    "priority": "high"
  }'

# Parse เวลาจากภาษาธรรมชาติ
curl -X POST http://localhost:3000/api/reminders/parse-time \
  -H "Content-Type: application/json" \
  -d '{"text": "พรุ่งนี้ 9 โมงเช้า"}'

# Response:
{
  "text": "พรุ่งนี้ 9 โมงเช้า",
  "parsed": "2026-02-05T09:00:00.000Z",
  "formatted": "5/2/2569 09:00:00"
}

# ดู reminders ที่รอ
curl http://localhost:3000/api/reminders/pending

# ดู upcoming (24 ชั่วโมงข้างหน้า)
curl http://localhost:3000/api/reminders/upcoming?hours=24

# Snooze
curl -X POST http://localhost:3000/api/reminders/snooze/rem_123 \
  -H "Content-Type: application/json" \
  -d '{"minutes": 15}'

# Cancel
curl -X POST http://localhost:3000/api/reminders/cancel/rem_123
```

**รูปแบบเวลาที่รองรับ:**
- `"ใน 5 นาที"`, `"in 5 minutes"`
- `"ใน 2 ชั่วโมง"`, `"in 2 hours"`
- `"พรุ่งนี้ 9 โมง"`, `"tomorrow 9am"`
- `"5 โมงเย็น"`, `"5pm"`
- `"14:30"`, `"2:30 PM"`

**Recurrence:**
- `once` - ครั้งเดียว
- `daily` - ทุกวัน
- `weekly` - ทุกสัปดาห์
- `weekdays` - จันทร์-ศุกร์

---

### 6. Google Calendar - ดูตาราง

**ต้อง setup credentials ก่อน**

```bash
# ดู status
curl http://localhost:3000/api/calendar/status

# ดู events วันนี้
curl http://localhost:3000/api/calendar/today

# ดู events 7 วันข้างหน้า
curl http://localhost:3000/api/calendar/upcoming?days=7

# ดูสรุปวันนี้
curl http://localhost:3000/api/calendar/summary

# หา free slots
curl "http://localhost:3000/api/calendar/free-slots?date=2026-02-05&duration=60"

# สร้าง event
curl -X POST http://localhost:3000/api/calendar/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Meeting with client",
    "startTime": "2026-02-05T14:00:00+07:00",
    "endTime": "2026-02-05T15:00:00+07:00",
    "location": "Zoom"
  }'

# Quick add (natural language)
curl -X POST http://localhost:3000/api/calendar/quick-add \
  -H "Content-Type: application/json" \
  -d '{"text": "Meeting tomorrow at 2pm"}'
```

---

### 7. Daily Digest - สรุปรายวัน

**ทำงานอัตโนมัติ:**
- 07:00 - Morning Briefing
- 18:00 - Evening Summary

```bash
# ดู status
curl http://localhost:3000/api/digest/status

# Generate morning briefing (manual)
curl -X POST http://localhost:3000/api/digest/morning

# Response:
{
  "success": true,
  "digest": {
    "id": "dig_123",
    "type": "morning",
    "output": "☀️ สวัสดีตอนเช้า (วันพุธ)\n\n📅 วันนี้:\n  • 09:00 - Meeting\n  • 14:00 - Call client\n\n🔔 Reminders (2):\n  • 10:00 - Follow up email\n  • 17:00 - Check report"
  }
}

# Generate evening summary (manual)
curl -X POST http://localhost:3000/api/digest/evening

# Custom digest
curl -X POST http://localhost:3000/api/digest/generate \
  -H "Content-Type: application/json" \
  -d '{"sections": ["calendar", "reminders", "approvals"], "format": "markdown"}'

# ดูประวัติ digests
curl http://localhost:3000/api/digest/recent?limit=10
```

---

### 8. Memory Consolidation - จัดการความจำ

**ทำงานอัตโนมัติ:**
- บันทึก short-term ทุกข้อความ
- Consolidate เวลาเที่ยงคืน

```bash
# ดู status
curl http://localhost:3000/api/memory-consolidation/status

# Response:
{
  "shortTerm": 45,
  "longTerm": {
    "learnings": 12,
    "patterns": 5,
    "facts": 23,
    "preferences": 8
  },
  "knowledgeGraph": {
    "entities": 34,
    "relations": 56
  }
}

# Query memories
curl "http://localhost:3000/api/memory-consolidation/query?search=hotel&limit=5"

# ดู preferences
curl http://localhost:3000/api/memory-consolidation/preferences

# ดู related entities
curl http://localhost:3000/api/memory-consolidation/related/Tars

# Get context สำหรับ AI
curl "http://localhost:3000/api/memory-consolidation/context?topic=booking"

# เพิ่ม learning
curl -X POST http://localhost:3000/api/memory-consolidation/add-learning \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Tars preferences",
    "insight": "ไม่ชอบถูกถาม permission",
    "importance": 5
  }'

# เพิ่ม preference
curl -X POST http://localhost:3000/api/memory-consolidation/add-preference \
  -H "Content-Type: application/json" \
  -d '{"key": "response_style", "value": "direct", "confidence": 0.9}'

# Consolidate manually
curl -X POST http://localhost:3000/api/memory-consolidation/consolidate
```

---

## การ Setup

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxx

# LINE (required)
LINE_CHANNEL_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
LINE_OWNER_ID=Uxxx

# Google Calendar (optional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx

# Telegram (optional)
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_OWNER_ID=xxx
```

### Run Server

```bash
cd tools/oracle-agent
npm install
npm start
```

### Test Features

```bash
# Health check
curl http://localhost:3000/health

# Test sentiment
curl -X POST http://localhost:3000/api/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{"message": "สวัสดีครับ"}'

# Test reminder
curl -X POST http://localhost:3000/api/reminders/add \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "message": "Test", "time": "'$(date -v+5M -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

---

## Summary

| Feature | Auto | Manual API | Scheduled |
|---------|------|------------|-----------|
| Sentiment Analysis | ✅ ทุกข้อความ | ✅ | - |
| Self-Reflection | ✅ ก่อนส่ง | ✅ | - |
| Quality Tracker | ✅ หลังส่ง | ✅ | - |
| Mistake Tracker | ✅ ก่อนตอบ | ✅ | - |
| Reminder System | ✅ notify | ✅ | ✅ ทุกนาที |
| Google Calendar | - | ✅ | - |
| Daily Digest | - | ✅ | ✅ 7:00, 18:00 |
| Memory Consolidation | ✅ บันทึก | ✅ | ✅ 00:00 |

---

*Oracle Agent v5.6.0 - Usage Guide*
*Last updated: 2026-02-04*
