# Session Learnings - Oracle Knowledge Base

> ไฟล์นี้เก็บ "สิ่งที่เรียนรู้" จากทุก session
> อัปเดตอัตโนมัติหลัง session สำคัญ
> ผม (Oracle) อ่านไฟล์นี้ทุก session ใหม่

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

## OpenClaw Study Progress

### Summary
| Metric | Value |
|--------|-------|
| Total Sessions | 19 |
| Modules Documented | 29 |
| Lines Read | ~72,000 / 441,267 |
| Progress | ~16.3% |
| Libraries Implemented | 37 files |

### Key Insight
> "AI ไม่ได้จำ - AI อ่าน"
> เก็บ state ใน files → AI อ่าน → AI รู้

---

## Session Logs

### Session 1: Entry Points & Skill System
- Read entry points (index.ts, entry.ts)
- Deep dive: Skill System
  - SKILL.md structure
  - Progressive disclosure
  - Slash command routing

### Session 2: Memory & Cron
- Deep dive: Memory System
  - Hybrid search (BM25 + Vector)
  - Multi-provider embeddings
- Deep dive: Cron/Heartbeat
  - Schedule types (at/every/cron)
  - Isolated sessions

### Session 3: Session Persistence
- SessionEntry (sticky preferences)
- JSONL transcripts (full history)
- Bootstrap files (always loaded)
- Auto-summarize (extracted patterns)

### Session 4: LINE Integration
- Rich messages, multi-account, directives
- `[[quick_replies: Option1, Option2]]` syntax
- Flex message auto-conversion

### Session 5: Gateway/Routing
- ChannelManager, RouteReply
- AbortController pattern
- Streaming delta throttle (150ms)
- Lazy module loading

### Session 6: Agent Core
- 7 standard bootstrap files
- Auto-compaction เมื่อ context > 80%
- "Preserve decisions, TODOs, open questions"

### Session 7: Heartbeat System (แยกจาก Cron)
- HEARTBEAT.md = คำสั่งสำหรับ periodic check-in
- HEARTBEAT_OK token
- Active Hours (ไม่รบกวนตอนกลางคืน)
- Dedup Protection (24h window)
- Queue Check (ไม่ interrupt active conversations)

### Session 8: Auto-Reply System
- Inline directives (/think, /verbose, /model)
- Smart chunking (fence-aware, paragraph-aware)
- Inbound debounce (batch rapid messages)
- Status builder
- Thinking levels (off/minimal/low/medium/high)

### Session 9: Plugin System
- Plugin discovery (bundled, global, workspace)
- 15 lifecycle hook types
- Tool/Command/Service registration
- Config validation

### Session 10: Config System
- Config loading pipeline (path → include → env → validate → defaults)
- Multi-layer defaults (non-mutating)
- Environment variable substitution (${VAR})
- $include directive (deep merge)
- Config caching (200ms) & backup (5 versions)

### Session 11: Hooks System
- Event registry (Map-based pub-sub)
- Event types: message, session, agent, tool, autonomy
- HOOK.md discovery + handler.js loading
- Priority ordering + event cancellation

### Session 12: Infrastructure System
- Structured logging (subsystem prefixes, levels, file output)
- Retry with exponential backoff + jitter
- Error classification (transient, fatal, config, abort)
- Deduplication cache (TTL-based, size-limited)
- Platform-specific retry configs

### Session 13: Routing & Sessions
- Route resolution priority (peer → guild → team → account → channel → default)
- Session key generation (agent:id:scope format)
- Send policies (allow/deny per session/channel)
- Model overrides per session

### Session 14: Channels & Media
- Chat type normalization (direct, group, channel)
- Sender label resolution
- Command gating (multi-layer authorization)
- Ack reactions, Media token parsing
- MIME detection, Filename sanitization

### Session 15: Security System
- Suspicious pattern detection (prompt injection)
- External content boundary markers
- Permission checks (0o700/0o600)
- Path traversal prevention
- Auto-fix permissions

### Session 16: Markdown & Utils
- Code fence detection (state machine)
- Frontmatter parsing
- Safe split points (fence-aware)
- Directive tags ([[audio_as_voice]], [[reply_to:]])

### Session 17: Terminal Utilities
- Table rendering (flex columns, ANSI-aware)
- Color palette/theme
- Progress/spinner, Box/note formatting

### Session 18: Process Management
- Command Queue (Pump Pattern - FIFO with per-lane concurrency)
- Command Lanes (Main, Cron, Subagent, Nested)
- Timeout Management (SIGTERM → SIGKILL)
- Spawn with Fallback, Process Pool

### Session 19: LINE Core Functions
- Webhook Signature Validation (HMAC-SHA256)
- Immediate 200 Response
- Message Chunking (5 per reply, then push)
- User Profile Caching (5-min TTL)
- Quick Reply Helpers (max 13 items)
- Flex Message Builders
- Markdown → Flex conversion

### Session 20: Advanced Auto-Reply
- MsgContext Schema (multi-body types)
- Template Interpolation ({{variable}})
- Envelope Formatting
- Human Delay (800-2500ms between blocks)
- Serialized Reply Queue
- Dispatch Kinds (tool, block, final)

### Session 21: Memory System Deep Dive
- Dual-Backend (QMD + SQLite)
- Hybrid Search (BM25 + Vector cosine)
- Multi-Provider Embeddings (OpenAI, Gemini, Local)
- Batch Processing (8000 tokens, 4x concurrency)
- Embedding Cache (hash-based, LRU)
- Chunking with Overlap
- Incremental Sync

### Session 22: Gateway System
- Hierarchical Routing
- Session Key Encoding
- DM Scopes
- WebSocket Device Auth (RSA)
- Backpressure Detection
- Channel Lifecycle
- Broadcast with Sequence Numbers

### Session 23: ACP Protocol
- Frame Types (Request/Response/Event)
- Session Store (AbortController)
- Delta Streaming
- Tool Call Phases (start → result)
- Tool Kind Inference
- IDE ↔ Agent ↔ Gateway bridge

### Session 24: TUI Core
- Slash Command Parser
- Input Type Detection
- Activity/Connection Status
- Stream Assembler
- Waiting Animation
- Searchable Filtering (4-tier)
- Input History

### Session 25: Browser CDP
- CDP WebSocket Connection
- Screenshot Capture (full page, viewport, clip)
- Screenshot Optimization (resize + JPEG quality ladder)
- Navigation with Waiting
- Content Extraction
- Multi-Browser Detection
- Browser Launch/Stop

---

## Libraries Implemented for Oracle

Total: **37 files** in `tools/oracle-agent/lib/`

### Core Systems
| File | Purpose |
|------|---------|
| index.js | Main exports |
| config-loader.js | Config loading pipeline |
| config-defaults.js | Multi-layer defaults |
| logger.js | Structured logging |
| utils.js | Utility functions |

### Memory & Context
| File | Purpose |
|------|---------|
| memory-sync.js | Dual master memory |
| memory-db.js | SQLite memory backend |
| memory-index.js | Hybrid search index |
| embeddings.js | Multi-provider embeddings |
| context-builder.js | Context assembly |
| context-guard.js | Context window protection |
| compaction.js | Auto-compaction |
| session-memory.js | Session persistence |

### Messaging & Routing
| File | Purpose |
|------|---------|
| message-router.js | Message routing |
| routing.js | Route resolution |
| session-manager.js | Session management |
| channels.js | Channel abstraction |
| channel-manager.js | Channel lifecycle |
| reply-queue.js | Serialized delivery |
| announce-queue.js | Announcement queue |

### LINE Integration
| File | Purpose |
|------|---------|
| line-core.js | LINE core functions |
| line-directives.js | Rich directives |
| line-multi-account.js | Multi-account support |
| flex-builder.js | Flex message builders |

### Processing
| File | Purpose |
|------|---------|
| smart-chunking.js | Fence-aware chunking |
| inbound-debounce.js | Message batching |
| inline-directives.js | /think, /verbose, /model |
| markdown.js | Markdown processing |
| media.js | Media handling |

### Infrastructure
| File | Purpose |
|------|---------|
| retry.js | Exponential backoff |
| dedupe.js | Deduplication cache |
| security.js | Security audit |
| process.js | Process management |
| terminal.js | Terminal UI helpers |
| hooks-system.js | Event hooks |

### Skills & Plugins
| File | Purpose |
|------|---------|
| skill-system.js | Skill loader |
| plugin-system.js | Plugin architecture |
| boot-system.js | BOOT.md loading |
| cron-patterns.js | Schedule parsing |

### Autonomy
| File | Purpose |
|------|---------|
| autonomy.js | Autonomy engine |
| status-builder.js | Status reporting |

### Advanced
| File | Purpose |
|------|---------|
| acp-protocol.js | Agent Communication Protocol |
| tui-core.js | Terminal User Interface |
| browser-cdp.js | Chrome DevTools Protocol |

---

## Open Questions

- [ ] Implement `[[quick_replies:]]` directive
- [ ] TM30 automation (Cloudflare challenge)
- [ ] ~84% ของ OpenClaw ยังไม่ได้อ่าน

## Next Actions

- [ ] Continue OpenClaw study (telegram, discord, cli, infra)
- [ ] Integrate all 37 libs into server.js
- [ ] Test end-to-end flow
- [ ] Deploy to Railway

---

*Last Updated: 2026-02-03T21:15:00+07:00*
