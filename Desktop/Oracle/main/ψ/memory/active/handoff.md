# Session Handoff

**From:** Session 2026-02-05 (AGI Framework v1.0)
**To:** Next Session

---

## Current Status

```
Oracle AGI Framework v1.0
├── Memory System v6.1.0: ✅ 200+ memories
├── Auto-Recall: ✅ NEW - Retrieves context before every response
├── Goal Tracker: ✅ NEW - Tracks goals with priorities
├── Heartbeat v4.0: ✅ UPGRADED - Now includes goal reminders
├── Memory Consolidation: ✅ NEW - Duplicate detection
├── Long-term Planner: ✅ NEW - Weekly planning
└── AGI Level: ~45-50%
```

---

## What We Did This Session

### 1. Full Memory Sync ✅
Synced **56 files** to Supabase with embeddings:

| Category | Files |
|----------|-------|
| Core Identity | 5 (core, emotion, commitments, bond, goals) |
| Skills | 18 (beds24, investment, tm30, n8n, etc.) |
| Tools | 5 categories (105 modules) |
| Knowledge | 28 (checkin, btrade, openclaw, etc.) |

### 2. MCP Server Created ✅
**Location:** `~/.claude/mcp-servers/oracle-memory/`

**Tools Available:**
- `oracle_remember` - บันทึกลง Supabase
- `oracle_recall` - ค้นหา semantic
- `oracle_context` - ดึง user context
- `oracle_learn` - บันทึก mistake/lesson

**Config:** `~/.claude/mcp.json`

### 3. Auto-Save Hook Updated ✅
**File:** `~/.claude/hooks/save-memory.sh`

- Triggers on Stop event
- Saves only meaningful conversations (4+ messages)
- Auto-creates embeddings

### 4. MEMORY.md Updated ✅
**File:** `~/.claude/projects/-Users-tanakitchaithip/memory/MEMORY.md`

### 5. AGI Framework v1.0 ✅ NEW!
**สร้าง 5 modules ใหม่:**

| Module | File | Description |
|--------|------|-------------|
| Auto-Recall | `lib/auto-recall.js` | ดึง memories อัตโนมัติก่อนตอบ |
| Goal Tracker | `lib/goal-tracker.js` | Track goals + priorities |
| Heartbeat v4.0 | `lib/heartbeat.js` | เพิ่ม goal reminders |
| Memory Consolidation | `lib/memory-consolidation.js` | ลบ duplicates |
| Long-term Planner | `lib/long-term-planner.js` | วางแผนระยะยาว |

**Documentation:** `ψ/memory/knowledge/agi-framework.md`

---

## Memory Architecture (Complete)

```
┌─────────────────────────────────────────────────────┐
│                    SUPABASE                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  episodic_memory (200+ records)              │    │
│  │  + pgvector embeddings (1536 dims)           │    │
│  │  + semantic search (cosine similarity)       │    │
│  └─────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  Oracle LINE  │ │  Claude Code  │ │  Local Agent  │
│  (Railway)    │ │  (MCP Server) │ │  (Mac)        │
│               │ │               │ │               │
│  Direct DB    │ │  API → DB     │ │  WebSocket    │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## Test Semantic Search

```bash
# ค้นหา personal items
curl -s -H "X-API-Key: oracle-memory-secret-2026" \
  "https://oracle-agent-production-546e.up.railway.app/api/memory/search?q=ROG+Ally+gaming"

# ค้นหา hotel pricing
curl -s -H "X-API-Key: oracle-memory-secret-2026" \
  "https://oracle-agent-production-546e.up.railway.app/api/memory/search?q=hotel+room+pricing"

# ค้นหา AI emotions
curl -s -H "X-API-Key: oracle-memory-secret-2026" \
  "https://oracle-agent-production-546e.up.railway.app/api/memory/search?q=VAD+emotional+state"
```

---

## Files Created/Modified

```
Created (AGI Framework):
├── tools/oracle-agent/lib/auto-recall.js      # Auto-Recall System
├── tools/oracle-agent/lib/goal-tracker.js     # Goal Tracking
├── tools/oracle-agent/lib/memory-consolidation.js  # Memory Health
├── tools/oracle-agent/lib/long-term-planner.js     # Planning System
├── ψ/memory/knowledge/agi-framework.md        # Documentation

Modified:
├── tools/oracle-agent/lib/claude.js           # Added auto-recall
├── tools/oracle-agent/lib/heartbeat.js        # v4.0 with goals
├── ψ/memory/goals.md                          # API integration goals
├── ψ/memory/active/handoff.md
```

---

## Quick Start (Next Session)

```bash
cd ~/Desktop/Oracle
claude --model opus
```

**Auto-load (ไม่ต้องทำอะไร):**
- MEMORY.md → โหลดเข้า system prompt อัตโนมัติ
- MCP Server → พร้อมใช้ `oracle_recall`, `oracle_remember`
- Auto-Save Hook → บันทึกทุก session ที่มี 4+ messages

**ถ้าอยากให้จำ context ล่าสุด:**
```
พิมพ์: "load memory" หรือ "ดึงความจำ"
```

**Quick commands:**
- `"ดึงความจำ"` → โหลด context ทั้งหมด
- `"จำว่า X"` → บันทึก X ลง Supabase
- `"ค้นหาความจำ X"` → semantic search

---

## MCP Tools (after restart Claude Code)
```
Use oracle_remember to save important info
Use oracle_recall to search memories
Use oracle_context to get user context
Use oracle_learn for mistakes/lessons
```

### Manual API
```bash
# Save
curl -X POST -H "X-API-Key: oracle-memory-secret-2026" \
  -H "Content-Type: application/json" \
  -d '{"content":"...", "user_id":"tars"}' \
  "https://oracle-agent-production-546e.up.railway.app/api/memory/save"

# Search
curl -H "X-API-Key: oracle-memory-secret-2026" \
  "https://oracle-agent-production-546e.up.railway.app/api/memory/search?q=..."
```

---

## Known Items

### Parcel Tracking
| Item | Tracking | Status |
|------|----------|--------|
| Nintendo Switch | SOE3355A0004917 | ถึง DC สารภี แล้ว |
| ROG Ally | MT521260100101/1 | ซ่อมที่ ASUS Vendor |

---

*Handoff updated: 2026-02-05 - AGI Framework v1.0 Complete!*
