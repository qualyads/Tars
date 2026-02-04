# User Profiles System

**Created:** 2026-02-05
**Version:** 5.7.0
**File:** `tools/oracle-agent/lib/user-profiles.js`

---

## Purpose

ระบบจำแนก user และให้ข้อมูลตาม permission level

**ปัญหาเดิม:**
- Oracle ไม่รู้ว่ากำลังคุยกับใคร
- ตอบทุกคนเหมือนกัน (รวมถึงเรื่อง business/investment)
- นิวใช้ LINE Bot แต่ไม่ต้องการข้อมูลเท่า Tars

**แก้ได้:**
- รู้จัก user แต่ละคน
- ให้ข้อมูลตาม permission
- Onboarding ถาม user ใหม่ว่าต้องการอะไร

---

## Permission Levels

| Level | Access | Daily Briefing | Investment | Business |
|-------|--------|----------------|------------|----------|
| **owner** (Tars) | ทุกอย่าง | ✅ | ✅ | ✅ |
| **partner** (นิว) | bookings, general | ❌ | ❌ | ❌ |
| **staff** | bookings, checkin | ❌ | ❌ | ❌ |
| **guest** | general only | ❌ | ❌ | ❌ |

---

## Flow

```
LINE Message เข้ามา
       ↓
เช็ค User ID
       ↓
┌─────────────────────────────────────────────┐
│ Owner?         → Full access               │
│ Known user?    → Use saved preferences     │
│ Unknown user?  → Start onboarding          │
└─────────────────────────────────────────────┘
       ↓
AI ตอบตาม permission level
```

---

## Owner Commands

Tars สามารถพิมพ์ผ่าน LINE:

```
ลงทะเบียน นิว เป็น partner    → Pre-register นิว
ลงทะเบียน แจ็ค เป็น staff     → Pre-register staff
รายชื่อ                       → List all users
```

---

## API Endpoints

```bash
# Get all profiles
GET /api/profiles

# Get single profile
GET /api/profiles/:userId

# Update profile
POST /api/profiles/:userId
Body: { name, role, preferences }

# Set as partner
POST /api/profiles/:userId/partner
Body: { name, preferences }

# Get AI context
GET /api/profiles/:userId/context

# Delete profile
DELETE /api/profiles/:userId
```

---

## Data Storage

**File:** `tools/oracle-agent/data/user-profiles.json`

```json
{
  "Uba2ae89ff...": {
    "userId": "Uba2ae89ff...",
    "name": "Tars",
    "role": "owner",
    "permissions": { "level": 100, "access": ["all"] },
    "preferences": {
      "language": "th",
      "dailyBriefing": true,
      "investmentAlerts": true
    },
    "onboarded": true
  }
}
```

---

## Integration Points

1. **LINE Webhook** - Check user before processing
2. **Context Builder** - Add user context to AI prompt
3. **Content Filter** - Hide sensitive info from non-owners

---

## Future Improvements

- [ ] Auto-detect นิว from LINE display name
- [ ] Telegram user profiles
- [ ] Per-user notification preferences
- [ ] Usage analytics per user

---

*Last updated: 2026-02-05*
