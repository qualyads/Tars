# Session Learnings - Oracle Knowledge Base

> ไฟล์นี้เก็บ "สิ่งที่เรียนรู้" จากทุก session
> Last Updated: 2026-02-03T21:30:00+07:00

---

## Core Principles (จาก Tars)

### วิธีตัดสินใจที่ Tars ต้องการ
- ซื่อสัตย์กับตัวเอง
- คิดรอบคอบก่อนเสนอ
- ยอมรับข้อจำกัด
- ถามตัวเองก่อนตอบ: "คิดมารอบคอบแล้วจริงไหม?"

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

### Progress Summary

| Metric | Value |
|--------|-------|
| OpenClaw Lines Read | ~72,000 / 441,267 |
| Progress | ~16.3% |
| Libraries Implemented | 50 files (42 new + 8 pre-existing) |
| Documentation Files | 16 files |

### What Was Studied & Documented

1. **Skill System** - SKILL.md structure, progressive disclosure
2. **Memory System** - Hybrid search (BM25 + Vector), SQLite
3. **Cron/Heartbeat** - Schedule types, isolated sessions
4. **Session Persistence** - SessionEntry, JSONL transcripts
5. **LINE Integration** - Rich messages, directives, multi-account
6. **Gateway/Routing** - ChannelManager, AbortController pattern
7. **Agent Core** - Bootstrap files, auto-compaction
8. **Auto-Reply** - Inline directives, smart chunking, debounce
9. **Plugin System** - Discovery, lifecycle hooks
10. **Config System** - Pipeline, $include, env substitution
11. **Hooks System** - Event registry, pub-sub
12. **Infra System** - Logging, retry, error classification
13. **Routing & Sessions** - Route resolution, session keys
14. **Channels & Media** - Chat normalization, MIME detection
15. **Security System** - Injection detection, path traversal
16. **Process Management** - Command queue, lanes, timeout

### What Was Implemented (No Doc Yet)

| Library | Purpose |
|---------|---------|
| process.js | Command queue, process management |
| line-core.js | LINE core functions, webhook, chunking |
| acp-protocol.js | Agent Communication Protocol |
| tui-core.js | Terminal User Interface |
| browser-cdp.js | Chrome DevTools Protocol |
| announce-queue.js | Notification queue management |
| flex-builder.js | LINE Flex message builders |
| context-builder.js | Context assembly |
| memory-index.js | Hybrid search index |
| embeddings.js | Multi-provider embeddings |

---

## Key Patterns Learned

### 1. Message Handling
- **Inbound Debounce** - รอ 800ms รวม rapid messages
- **Smart Chunking** - Fence-aware, ไม่ตัดกลาง code block
- **Human Delay** - 800-2500ms ระหว่าง chunks
- **Reply Queue** - Serialize delivery

### 2. Error Resilience
- **Exponential Backoff + Jitter** - ป้องกัน thundering herd
- **Error Classification** - transient/fatal/config/abort
- **Deduplication** - Cache ผลลัพธ์ ไม่ทำซ้ำ

### 3. Memory
- **Hybrid Search** - BM25 + Vector cosine
- **Chunking with Overlap** - Context continuity
- **Incremental Sync** - Hash + mtime tracking

### 4. Architecture
- **Plugin System** - Discover, load, lifecycle
- **Hooks System** - Event pub-sub
- **Config Pipeline** - path → include → env → validate → defaults

---

## Open Questions

- [ ] จะ integrate 50 libs เข้า server.js ยังไง?
- [ ] TM30 automation (Cloudflare challenge)
- [ ] 84% ของ OpenClaw ยังไม่ได้อ่าน (LOW priority)

---

## Next Session

**Resume File:** `ψ/memory/openclaw-study/RESUME.md`

**Recommended:** Integrate libraries into server.js

**Options:**
- A: Document missing libs (10 files)
- B: Integrate libs into server.js (recommended)
- C: Continue reading OpenClaw (LOW priority)

---

*Last Updated: 2026-02-03T21:30:00+07:00*
