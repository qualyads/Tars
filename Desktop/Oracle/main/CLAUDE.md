# CLAUDE.md - อ่านก่อนทำงานทุกครั้ง!

## ⚠️ IMPORTANT: เริ่ม Session ใหม่

**ถ้านี่คือ session ใหม่ → อ่านไฟล์เหล่านี้ก่อน:**

### 1. Identity (ต้องอ่าน)
```
ψ/memory/resonance/identity.md
```
→ ข้อมูล Tars, APIs, Directives, วิธีทำงาน

### 2. Session State (ต้องอ่าน)
```
ψ/memory/oracle-session.json
```
→ Preferences ของ Tars, context ปัจจุบัน, สิ่งที่เรียนรู้

### 3. Session Learnings (แนะนำ)
```
ψ/memory/resonance/session-learnings.md
```
→ สรุปจากทุก session ที่ผ่านมา, open questions, next actions

### 4. OpenClaw Study (ถ้าเกี่ยวข้อง)
```
ψ/memory/openclaw-study/MASTER-INDEX.md
```
→ Progress การศึกษา OpenClaw, modules ที่วิเคราะห์แล้ว

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
- `tools/oracle-agent/lib/session-memory.js` - 🆕 Session Persistence
- `ψ/memory/oracle-memory.json` - Master memory file
- `ψ/memory/oracle-session.json` - 🆕 Session state & preferences
- `ψ/memory/resonance/session-learnings.md` - 🆕 Accumulated learnings

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

## 🧠 Session Memory System

> "AI ไม่ได้จำ - AI อ่าน"
> เก็บ state ใน files → AI อ่าน → AI รู้

### หลัง Session สำคัญ

1. **Update oracle-session.json**
   - เพิ่ม learnings ใหม่
   - Update context (currentFocus, recentTopics)
   - บันทึก preferences ที่เปลี่ยน

2. **Append to session-learnings.md**
   - Key Decisions
   - Key Learnings
   - Open Questions
   - Next Actions

3. **ใช้ session-memory.js** (optional)
   ```bash
   node tools/oracle-agent/lib/session-memory.js record-summary
   ```

### ทำไมต้องทำ?

Session ใหม่จะ:
- อ่าน oracle-session.json → รู้ preferences ของ Tars
- อ่าน session-learnings.md → รู้ว่าเคยคุยอะไร, ตัดสินใจอะไร
- ไม่ต้องถามซ้ำ, ไม่ต้องเริ่มใหม่

---

*Oracle Open Framework v3.0.0 - Phase 3: Autonomy*
