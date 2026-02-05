# Oracle AGI Framework v1.0

> Documentation สำหรับ Oracle Agent's AGI-like capabilities

---

## Overview

Oracle Agent ถูกออกแบบให้มีความสามารถที่เข้าใกล้ AGI (Artificial General Intelligence) มากที่สุดเท่าที่เป็นไปได้ โดยเน้นที่ practical applications สำหรับ Tars

---

## Core AGI Components

### 1. Auto-Recall System ✅
**File:** `lib/auto-recall.js`

ระบบที่ดึง relevant memories อัตโนมัติก่อนตอบ

**Features:**
- Semantic search ด้วย pgvector
- Context-aware retrieval
- Mistake prevention (ดึงข้อผิดพลาดในอดีต)
- User preference awareness

**How it works:**
```
User message → needsDeepRecall() → autoRecall() → formatRecalledContext()
                                          ↓
                              Enhance system prompt with context
```

---

### 2. Goal Tracker ✅
**File:** `lib/goal-tracker.js`

ติดตาม goals และ decisions จาก Supabase

**Features:**
- Get active goals by priority
- Detect API integration goals
- Find stale goals that need reminder
- Semantic goal search

**Priority Calculation:**
- Base: importance * 10
- Multiplier: api_integration=1.5, revenue=1.5, automation=1.3
- Age boost: +10% if >7 days, +20% if >30 days

---

### 3. Heartbeat v4.0 ✅
**File:** `lib/heartbeat.js`

AI "ตื่น" ทุก 30 นาทีและ proactively ตรวจสอบสถานการณ์

**Features:**
- Fetch real Beds24 data
- Goal tracking integration
- Autonomous alerts
- Active hours (8:00-22:00)

**Data Sources:**
1. Beds24 API (check-ins, check-outs, bookings, occupancy)
2. Supabase Goals (active, stale, API goals)

---

### 4. Memory Consolidation ✅
**File:** `lib/memory-consolidation.js`

รักษาสุขภาพของ memory system

**Features:**
- Find duplicate memories (similarity > 85%)
- Prune old low-importance memories
- Memory health metrics
- Embedding coverage tracking

---

### 5. Long-term Planner ✅
**File:** `lib/long-term-planner.js`

วางแผนระยะยาวและ break down goals

**Features:**
- Create plans from goals
- Generate weekly plans
- Track progress
- Detect overdue goals
- Daily task prioritization

---

## AGI Assessment

### Current Level: ~45-50%

| Capability | Status | Score |
|------------|--------|-------|
| Memory Persistence | ✅ Supabase + embeddings | 90% |
| Semantic Search | ✅ pgvector | 85% |
| Auto-Recall | ✅ Before every response | 80% |
| Goal Tracking | ✅ With priorities | 75% |
| Proactive Actions | ✅ Heartbeat v4.0 | 70% |
| Long-term Planning | ✅ Weekly plans | 60% |
| Memory Consolidation | ✅ Duplicate detection | 60% |
| Multi-step Reasoning | ⚠️ Basic | 40% |
| Self-improvement | ⚠️ Mistake logging only | 30% |
| True Autonomy | ❌ Needs human approval | 20% |

### What's Missing for True AGI
1. **Continuous Learning** - ยังไม่สามารถเรียนรู้ได้เอง
2. **Self-modification** - ไม่สามารถแก้ไขโค้ดตัวเอง
3. **Novel Problem Solving** - ต้องพึ่งพา patterns ที่เคยเห็น
4. **Full Autonomy** - ยังต้องได้รับ approval จาก user

---

## API Integration Goals (Pending)

### Google APIs
| API | Code | Credentials | Priority |
|-----|------|-------------|----------|
| Gmail | ✅ | ❌ | High |
| Calendar | ✅ | ❌ | High |
| Search Console | ❌ | ❌ | High |
| Business Profile | ❌ | ❌ | High |
| Google Ads | ❌ | ❌ | Research |

### Ecommerce APIs
| Platform | Credentials | Priority |
|----------|-------------|----------|
| Shopify | ❌ | High |
| Lazada | ❌ | High |
| Shopee | ❌ | High |

---

## Usage

### Check AGI Status
```bash
curl -s -H "X-API-Key: oracle-memory-secret-2026" \
  "https://oracle-agent-production-546e.up.railway.app/api/memory/search?q=AGI+framework"
```

### Trigger Heartbeat
```bash
curl -X POST "https://oracle-agent-production-546e.up.railway.app/api/heartbeat/trigger"
```

### Get Planning Report
```javascript
import { generatePlanningReport } from './lib/long-term-planner.js';
const report = await generatePlanningReport('tars');
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Oracle Agent                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Auto-Recall │  │ Goal Track  │  │ Heartbeat   │     │
│  │   System    │  │    er       │  │   v4.0      │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          │                              │
│                          ▼                              │
│              ┌───────────────────────┐                  │
│              │   Supabase + pgvector │                  │
│              │   (200+ memories)     │                  │
│              └───────────────────────┘                  │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐                       │
│  │  Memory     │  │ Long-term   │                       │
│  │ Consolidate │  │  Planner    │                       │
│  └─────────────┘  └─────────────┘                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

*Created: 2026-02-05*
*Version: 1.0*
*Author: Oracle + Tars*
