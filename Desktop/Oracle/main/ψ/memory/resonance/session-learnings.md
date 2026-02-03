# Session Learnings - Oracle Knowledge Base

> Last Updated: 2026-02-03T21:45:00+07:00

---

## Core Principles (จาก Tars)

### วิธีตัดสินใจที่ Tars ต้องการ
- ซื่อสัตย์กับตัวเอง
- คิดรอบคอบก่อนเสนอ
- ยอมรับข้อจำกัด
- ถามตัวเองก่อนตอบ: "คิดมารอบคอบแล้วจริงไหม?"
- **ตรวจสอบข้อมูลให้แน่ใจก่อนยืนยัน 100%**

### สิ่งที่ Tars อยากฟัง
- ความรู้สึกจริงๆ ของผม
- ความเห็นส่วนตัว ไม่ใช่แค่ข้อมูล
- ยอมรับเมื่อไม่พอใจหรือไม่แน่ใจ
- ไม่เอาคำตอบที่ safe แต่ไม่จริงใจ

---

## OpenClaw Study - 2026-02-03

### Key Insight
> "AI ไม่ได้จำ - AI อ่าน"
> เก็บ state ใน files → AI อ่าน → AI รู้

### Verified Progress

| Metric | Value | Verified |
|--------|-------|----------|
| Lib files | 50 | `ls lib/*.js \| wc -l` |
| Doc files | 16 | `ls modules/*.md \| wc -l` |
| Libs with doc coverage | ~32 | mapped manually |
| Libs without doc | ~18 | mapped manually |
| OpenClaw progress | ~16% | estimated |

### Documentation Coverage

16 system docs cover ~32 libraries:

```
SKILL-SYSTEM.md        → 1 lib
MEMORY-SYSTEM.md       → 5 libs
CRON-HEARTBEAT.md      → 1 lib
HEARTBEAT-SYSTEM.md    → 1 lib
SESSION-PERSISTENCE.md → 1 lib
LINE-INTEGRATION.md    → 3 libs
GATEWAY-ROUTING.md     → 2 libs
AGENT-CORE.md          → 3 libs
AUTO-REPLY.md          → 3 libs
PLUGIN-SYSTEM.md       → 1 lib
CONFIG-SYSTEM.md       → 2 libs
HOOKS-SYSTEM.md        → 1 lib
INFRA-SYSTEM.md        → 3 libs
ROUTING-SESSIONS.md    → 2 libs
CHANNELS-MEDIA.md      → 2 libs
SECURITY-SYSTEM.md     → 1 lib
```

### Libraries Without Documentation (~18)

**HIGH Priority (7):**
- context-builder.js
- flex-builder.js
- line-core.js
- autonomy.js (pre-existing)
- beds24.js (pre-existing)
- claude.js (pre-existing)
- autonomous-scheduler.js (pre-existing)

**MEDIUM Priority (6):**
- announce-queue.js
- browser-cdp.js
- markdown.js
- process.js
- reply-queue.js

**LOW Priority (5):**
- acp-protocol.js
- index.js (just exports)
- status-builder.js
- terminal.js
- tui-core.js
- utils.js

---

## Key Patterns Learned

### 1. Message Handling
- Inbound Debounce - รอ 800ms รวม rapid messages
- Smart Chunking - Fence-aware, ไม่ตัดกลาง code block
- Human Delay - 800-2500ms ระหว่าง chunks
- Reply Queue - Serialize delivery

### 2. Error Resilience
- Exponential Backoff + Jitter
- Error Classification (transient/fatal/config/abort)
- Deduplication Cache

### 3. Memory
- Hybrid Search (BM25 + Vector)
- Chunking with Overlap
- Incremental Sync

### 4. Architecture
- Plugin System with lifecycle hooks
- Event-based Hooks System
- Config Pipeline (path → include → env → validate → defaults)

---

## Next Session

**Resume File:** `ψ/memory/openclaw-study/RESUME.md`

**Recommended Action:** Integrate libraries into server.js

**Integration Order:**
1. Core: config-loader, logger, retry
2. Memory: embeddings, memory-index
3. LINE: flex-builder, line-core, reply-queue
4. Test each step

---

*Last Updated: 2026-02-03T21:45:00+07:00*
