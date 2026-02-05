# Oracle Heartbeat v3.0 - Real Data System

> ระบบนี้ดึงข้อมูลจริงจาก Beds24 API ไม่ได้ใช้ข้อมูลจากไฟล์นี้
> ไฟล์นี้เป็น reference เท่านั้น

---

## How It Works (v3.0)

```
1. Heartbeat triggers (ทุก 30 นาที)
2. Fetch REAL data from Beds24 API:
   - getCheckInsToday()
   - getCheckOutsToday()
   - getAllActiveBookings()
   - getOccupancyForDate()
3. If no actionable data → HEARTBEAT_OK (skip AI call)
4. If has data → Send to Claude with REAL data
5. Claude analyzes and creates alert (or HEARTBEAT_OK)
```

---

## Data Sources (Beds24 API)

| Check | API Function | Description |
|-------|--------------|-------------|
| New Bookings | `getAllActiveBookings()` | Filter last 30 minutes |
| Today Check-ins | `getCheckInsToday()` | Arrivals today |
| Today Check-outs | `getCheckOutsToday()` | Departures today |
| Occupancy | `getOccupancyForDate()` | Room status |

---

## Alert Conditions

### Urgent (แจ้งทันที)
- Booking ใหม่ในช่วง 30 นาที
- Check-in วันนี้ที่ต้องเตรียม
- Overbooking (ถ้าตรวจพบ)

### Low Priority (ไม่แจ้ง)
- ไม่มี booking ใหม่
- ไม่มี check-in/check-out
- ข้อมูลซ้ำที่แจ้งไปแล้ว

---

## Response Protocol

### ถ้ามีเรื่องสำคัญ (real data):
```
🔔 Oracle Alert

[สรุปจากข้อมูลจริง]

รายละเอียด:
- Booking ID: [จาก API]
- Guest: [จาก API]
- Room: [จาก API]

แนะนำ:
- [action ที่ควรทำ]
```

### ถ้าไม่มีอะไร:
```
HEARTBEAT_OK
```

---

## Key Improvements (v3.0)

| Before (v2.0) | After (v3.0) |
|---------------|--------------|
| Read template file | Fetch real API data |
| Claude hallucinated data | Only real data allowed |
| Always called AI | Skip AI if no data |
| Fake IDs (12345) | Real booking IDs |
| Fake names (John Doe) | Real guest names |

---

## Config (config.json)

```json
{
  "heartbeat": {
    "enabled": true,
    "every": "30m",
    "model": "claude-3-haiku-20240307",
    "activeHours": { "start": 8, "end": 22 },
    "skipIfBusy": true
  }
}
```

---

## Testing

```bash
# Trigger manual heartbeat
curl -X POST https://oracle-agent-production-546e.up.railway.app/api/heartbeat/trigger

# Check status
curl https://oracle-agent-production-546e.up.railway.app/api/heartbeat/status
```

---

*Last updated: 2026-02-05*
*Version: 3.0 (Real Data System)*
