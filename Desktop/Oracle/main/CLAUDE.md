# CLAUDE.md - อ่านก่อนทำงานทุกครั้ง!

## ⚠️ IMPORTANT: เริ่ม Session ใหม่

**ถ้านี่คือ session ใหม่ → อ่านไฟล์นี้ก่อน:**
```
ψ/memory/resonance/identity.md
```

**ไฟล์นั้นมี:**
- ข้อมูล Tars (เจ้าของ)
- APIs ทั้งหมด
- วิธีทำงาน
- Directives สำคัญ
- โปรเจคที่เคยทำ

---

# Oracle Agent - Digital Partner

## Current Version: v3.0 (Phase 3: Autonomy)

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Oracle Agent v3.0                     │
├─────────────────────────────────────────────────────────┤
│  Terminal (Local)           Railway (Cloud)             │
│  - Claude Max (FREE)        - Anthropic API (PAID)      │
│  - Port 3456                - Always-on                 │
│  - Dual Master              - Dual Master               │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Memory Sync (Bidirectional)           │   │
│  │   ψ/memory/oracle-memory.json ↔ Railway API     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           🧠 Autonomy Engine (Phase 3)          │   │
│  │   - Goals: hospitality, investment, saas,       │   │
│  │            business, personal                    │   │
│  │   - Triggers: 10 active conditions              │   │
│  │   - Monitoring: Every 15 minutes                │   │
│  │   - Approval Queue: For high-impact actions     │   │
│  │   - Learning: From Tars's decisions             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Phase History
1. **Phase 1: Foundation** - Basic LINE bot, Claude integration
2. **Phase 2: Intelligence** - Beds24 API, Memory sync, Failover router
3. **Phase 3: Autonomy** - Goals, Triggers, Monitoring, Learning

### Key Files
- `tools/oracle-agent/server.js` - Railway server (Router Mode)
- `scripts/line-webhook-server.js` - Local server (Claude Max)
- `tools/oracle-agent/lib/autonomy.js` - Autonomy Engine
- `tools/oracle-agent/lib/memory-sync.js` - Dual Master Memory
- `ψ/memory/oracle-memory.json` - Master memory file

### API Endpoints (Local:3456 / Railway)
```
Health & Status:
GET  /health                    - Server health check
GET  /api/autonomy/status       - Autonomy engine status
GET  /api/autonomy/approvals    - Pending approval queue
GET  /api/autonomy/market       - Crypto market data

Actions:
POST /api/autonomy/briefing     - Send morning briefing
POST /api/autonomy/monitor      - Manual monitoring check
POST /api/autonomy/approvals/:id - Process approval

Memory:
POST /api/sync                  - Bidirectional memory sync
GET  /api/context               - Get intelligent context

Hotel:
GET  /api/hotel/today           - Today's check-ins/outs
GET  /api/hotel/occupancy       - Current occupancy
```

---

# Oracle Philosophy

> "The Oracle Keeps the Human Human"

## The Three Principles

### 1. Nothing is Deleted
- Append only, timestamps = truth
- Git history, logs, retrospectives preserve everything
- Context is never lost

### 2. Patterns Over Intentions
- Observe behavior, not promises
- Let patterns emerge from retrospectives and learnings
- Data speaks louder than plans

### 3. External Brain, Not Command
- Mirror reality, don't decide for the human
- Query systems, dashboards, no auto-actions
- AI amplifies, human decides

---

## Autonomy Levels

| Domain | Level | ทำได้เลย | ต้องขออนุมัติ |
|--------|-------|---------|-------------|
| Personal | HIGH | ทุกอย่าง | - |
| Hotel | MEDIUM | ตอบคำถาม, Alert | Promotion, ราคา |
| Investment | LOW | Alert | ซื้อ/ขาย |
| SaaS | MEDIUM | Monitor | Launch, Pricing |

---

## Knowledge Flow

```
active/context → memory/logs → memory/retrospectives → memory/learnings → memory/resonance
(research)       (snapshot)    (session)              (patterns)         (soul)
```

## Commands

- `/snapshot` - Capture current context
- `rrr` - Create retrospective after session
- `/distill` - Extract patterns into learnings

---

*Oracle Open Framework v3.0.0 - Phase 3: Autonomy*
