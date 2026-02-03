# OpenClaw Study - Master Index

> เป้าหมาย: อ่าน + เข้าใจ + ก้าวข้าม OpenClaw
> เริ่ม: 2026-02-03
> Total Lines: 441,267 lines TypeScript

## Progress Tracker

| Module | Lines | Status | Priority | Notes |
|--------|-------|--------|----------|-------|
| src/index.ts | 94 | ✅ Done | - | Entry point |
| src/entry.ts | 163 | ✅ Done | - | CLI bootstrap |
| src/agents/skills/ | ~13 files | ✅ Done | HIGH | **[SKILL-SYSTEM.md](modules/SKILL-SYSTEM.md)** |
| src/memory/ | ~41 files | ✅ Done | HIGH | **[MEMORY-SYSTEM.md](modules/MEMORY-SYSTEM.md)** (Deep Dive Session 15) |
| src/cron/ | ~23 files | ✅ Done | HIGH | **[CRON-HEARTBEAT.md](modules/CRON-HEARTBEAT.md)** |
| Heartbeat System | ~1,336 lines | ✅ Done | HIGH | **[HEARTBEAT-SYSTEM.md](modules/HEARTBEAT-SYSTEM.md)** |
| Session Persistence | - | ✅ Done | HIGH | **[SESSION-PERSISTENCE.md](modules/SESSION-PERSISTENCE.md)** |
| extensions/line/ | ~4 files | ✅ Done | HIGH | **[LINE-INTEGRATION.md](modules/LINE-INTEGRATION.md)** |
| src/gateway/ | ~127 files | ✅ Done | MEDIUM | **[GATEWAY-ROUTING.md](modules/GATEWAY-ROUTING.md)** (Deep Dive Session 16) |
| src/agents/ (core) | ~289 files | ✅ Done | HIGH | **[AGENT-CORE.md](modules/AGENT-CORE.md)** |
| src/line/ (core) | ~36 files | ✅ Done | MEDIUM | **[LINE-CORE.md](modules/LINE-CORE.md)** |
| src/auto-reply/ | ~73 files | ✅ Done | HIGH | **[AUTO-REPLY.md](modules/AUTO-REPLY.md)** (Deep Dive Session 14) |
| src/plugins/ | ~30 files | ✅ Done | MEDIUM | **[PLUGIN-SYSTEM.md](modules/PLUGIN-SYSTEM.md)** |
| src/config/ | ~124 files | ✅ Done | MEDIUM | **[CONFIG-SYSTEM.md](modules/CONFIG-SYSTEM.md)** |
| src/hooks/ | ~15 files | ✅ Done | HIGH | **[HOOKS-SYSTEM.md](modules/HOOKS-SYSTEM.md)** |
| src/infra/ | ~152 files | ✅ Done | HIGH | **[INFRA-SYSTEM.md](modules/INFRA-SYSTEM.md)** |
| src/routing/ | ~5 files | ✅ Done | HIGH | **[ROUTING-SESSIONS.md](modules/ROUTING-SESSIONS.md)** |
| src/sessions/ | ~10 files | ✅ Done | HIGH | **[ROUTING-SESSIONS.md](modules/ROUTING-SESSIONS.md)** |
| src/channels/ | ~10 files | ✅ Done | HIGH | **[CHANNELS-MEDIA.md](modules/CHANNELS-MEDIA.md)** |
| src/media/ | ~10 files | ✅ Done | HIGH | **[CHANNELS-MEDIA.md](modules/CHANNELS-MEDIA.md)** |
| src/security/ | ~5 files | ✅ Done | HIGH | **[SECURITY-SYSTEM.md](modules/SECURITY-SYSTEM.md)** |
| src/markdown/ | ~6 files | ✅ Done | MEDIUM | Fences, Frontmatter |
| src/utils/ | ~10 files | ✅ Done | MEDIUM | Time, Queue, Directives |
| src/terminal/ | ~10 files | ✅ Done | MEDIUM | Table, Colors, Progress |
| src/process/ | ~5 files | ✅ Done | HIGH | **[PROCESS-SYSTEM.md](modules/PROCESS-SYSTEM.md)** |
| src/acp/ | ~12 files | ✅ Done | MEDIUM | Agent Communication Protocol |
| src/telegram/ | ~83 files | ⏳ Pending | LOW | Reference only |
| src/discord/ | ~44 files | ⏳ Pending | LOW | Reference only |
| src/config/ | ~124 files | ⏳ Pending | MEDIUM | Configuration |
| src/tui/ | ~25 files | ✅ Done | MEDIUM | Terminal User Interface |
| src/browser/ | ~35 files | ✅ Done | MEDIUM | Chrome DevTools Protocol |
| src/cli/ | ~107 files | ⏳ Pending | LOW | CLI interface |
| src/infra/ | ~152 files | ⏳ Pending | LOW | Infrastructure |
| src/plugins/ | ~30 files | ⏳ Pending | MEDIUM | Plugin architecture |

## Architecture Overview

```
openclaw/
├── src/
│   ├── index.ts          ← Main entry, exports public API
│   ├── entry.ts          ← CLI bootstrap, Node.js setup
│   ├── agents/           ← AI agent logic (302 files) ⭐
│   ├── memory/           ← Vector memory system (41 files) ⭐
│   ├── cron/             ← Scheduled tasks, heartbeat ⭐
│   ├── gateway/          ← Message routing (127 files)
│   ├── config/           ← Configuration management
│   ├── cli/              ← Command line interface
│   ├── line/             ← LINE integration ⭐
│   ├── telegram/         ← Telegram integration
│   ├── discord/          ← Discord integration
│   ├── slack/            ← Slack integration
│   ├── whatsapp/         ← WhatsApp integration
│   ├── signal/           ← Signal integration
│   ├── hooks/            ← Event hooks
│   ├── plugins/          ← Plugin system
│   └── infra/            ← Infrastructure utilities
├── skills/               ← Skill definitions (55 folders) ⭐
├── extensions/           ← Channel extensions (32 folders)
└── docs/                 ← Documentation
```

## Key Discoveries

### 1. Entry Point Flow (src/index.ts)
```
1. loadDotEnv() - Load environment
2. normalizeEnv() - Normalize env vars
3. ensureOpenClawCliOnPath() - Setup PATH
4. enableConsoleCapture() - Structured logging
5. assertSupportedRuntime() - Check Node version
6. buildProgram() - Build CLI with Commander
7. program.parseAsync() - Execute command
```

### 2. Key Exports
- `loadConfig` - Configuration loader
- `monitorWebChannel` - Web channel monitor
- `createDefaultDeps` - Dependency injection
- `loadSessionStore` / `saveSessionStore` - Session management

## Implementation Priority for Oracle

1. **Skill System** - ให้ Oracle เรียนรู้ได้
2. **Memory System** - Vector search + embeddings
3. **Cron Service** - Better heartbeat
4. **LINE Rich Features** - Flex messages, rich menu

## Study Sessions Log

### Session 1: 2026-02-03
- [x] Clone repo
- [x] Count total lines (441,267)
- [x] Read entry points
- [x] Create documentation structure
- [x] Deep dive: Skill System
- [x] Deep dive: Memory System
- [x] Deep dive: Cron/Heartbeat
- [x] Deep dive: Session Persistence
- [x] Deep dive: LINE Integration
- [x] Deep dive: Gateway/Routing
- [x] Deep dive: Agent Core (Bootstrap, Compaction)
- [x] Deep dive: Heartbeat System (แยกจาก Cron!)

### Session 2: 2026-02-03 (continued)
- [x] Deep dive: Auto-Reply System
  - Inline directives (/think, /verbose, /model)
  - Smart chunking (fence-aware, paragraph-aware)
  - Inbound debounce (batch rapid messages)
  - Status builder (comprehensive status)
  - Thinking levels (off/minimal/low/medium/high)

### Session 3: 2026-02-03 (continued)
- [x] Deep dive: Plugin System
  - Plugin discovery (bundled, global, workspace)
  - Lifecycle hooks (15 types)
  - Tool/Command/Service registration
  - Config validation

### Session 4: 2026-02-03 (continued)
- [x] Deep dive: Config System
  - Config loading pipeline (path → include → env → validate → defaults)
  - Multi-layer defaults (non-mutating)
  - Environment variable substitution (${VAR})
  - $include directive (deep merge)
  - Config caching (200ms)
  - Config backup (5 versions)

### Session 5: 2026-02-03 (continued)
- [x] Deep dive: Hooks System
  - Event registry (Map-based pub-sub)
  - Event types: message, session, agent, tool, autonomy
  - HOOK.md discovery + handler.js loading
  - Eligibility checking (env, config requirements)
  - Error resilient - handler error ไม่หยุด hooks อื่น
  - Priority ordering + event cancellation

### Session 6: 2026-02-03 (continued)
- [x] Deep dive: Infrastructure System
  - Structured logging (subsystem prefixes, levels, file output)
  - Retry with exponential backoff + jitter
  - Error classification (transient, fatal, config, abort)
  - Deduplication cache (TTL-based, size-limited)
  - Platform-specific retry configs (LINE, Anthropic, Beds24)

### Session 7: 2026-02-03 (continued)
- [x] Deep dive: Routing & Sessions
  - Route resolution (priority: peer → guild → team → account → channel → default)
  - Session key generation (agent:id:scope format)
  - Send policies (allow/deny per session/channel)
  - Model overrides per session
  - Session labels + verbose levels

### Session 8: 2026-02-03 (continued)
- [x] Deep dive: Channels & Media
  - Chat type normalization (direct, group, channel)
  - Sender label resolution (name > username > tag > id)
  - Command gating (multi-layer authorization)
  - Ack reactions (scope-based)
  - Media token parsing (MEDIA: url)
  - MIME detection (buffer sniff > extension > header)
  - Filename sanitization + storage

### Session 9: 2026-02-03 (continued)
- [x] Deep dive: Security System
  - Suspicious pattern detection (prompt injection)
  - External content boundary markers
  - Permission checks (0o700/0o600)
  - Security audit (config, secrets, filesystem)
  - Path traversal prevention
  - Auto-fix permissions

### Session 10: 2026-02-03 (continued)
- [x] Deep dive: Markdown & Utils
  - Code fence detection (state machine)
  - Frontmatter parsing (line-based + YAML)
  - Safe split points (fence-aware)
  - Relative time formatting
  - Boolean parsing (yes/no/true/false)
  - Queue helpers (drop policies, summarization)
  - Directive tags ([[audio_as_voice]], [[reply_to:]])

### Session 11: 2026-02-03 (continued)
- [x] Deep dive: Terminal Utilities
  - Table rendering (flex columns, ANSI-aware)
  - ANSI code handling (strip, visible width)
  - Color palette/theme (accent, success, error, etc.)
  - Progress/spinner (TTY carriage return)
  - Box/note formatting (smart word wrap)

### Session 12: 2026-02-03 (continued)
- [x] Deep dive: Process Management
  - Command Queue (Pump Pattern - FIFO with per-lane concurrency)
  - Command Lanes (Main, Cron, Subagent, Nested - แยก priority)
  - Timeout Management (SIGTERM → SIGKILL with grace period)
  - Spawn with Fallback (try multiple shell options)
  - Process Pool (reusable processes with idle timeout)
  - Process Tree Kill (cross-platform)

### Session 13: 2026-02-03 (continued)
- [x] Deep dive: LINE Core Functions
  - Webhook Signature Validation (HMAC-SHA256, constant-time)
  - Immediate 200 Response (ป้องกัน LINE timeout)
  - Message Chunking (5 messages per reply, then push)
  - User Profile Caching (5-minute TTL in-memory)
  - Quick Reply Helpers (max 13 items, 20 chars)
  - Flex Message Builders (Info, List, Image, KeyValue, Status cards)
  - Carousel Builder (max 10 bubbles)
  - Button/Confirm Templates
  - Markdown → Flex (tables, code blocks)
  - Target ID Normalization (strip line: prefixes)

### Session 14: 2026-02-03 (continued)
- [x] Deep dive: Auto-Reply Advanced (templating, dispatch, envelope)
  - MsgContext Schema (multi-body types: Body, BodyForAgent, BodyForCommands)
  - Template Interpolation ({{variable}} replacement with type coercion)
  - Context Finalization (normalize + compute defaults + secure defaults)
  - Envelope Formatting ([Channel From +elapsed timestamp] body)
  - Human Delay (800-2500ms between blocks, skip first)
  - Serialized Reply Queue (promise chain, ordered delivery)
  - Dispatch Kinds (tool, block, final)
  - Typing Indicator Integration (auto start/stop)
  - Chunked Delivery with Retry (exponential backoff)

### Session 15: 2026-02-03 (continued)
- [x] Deep dive: Memory System (Semantic Search + Embeddings)
  - Dual-Backend (QMD external + Builtin SQLite)
  - Hybrid Search (BM25 keyword + Vector cosine similarity)
  - Multi-Provider Embeddings (OpenAI, Gemini, Local with fallback chain)
  - Batch Processing (8000 tokens, 4x concurrency)
  - Embedding Cache (hash-based key, LRU eviction)
  - Chunking with Overlap (context continuity)
  - Incremental Sync (hash + mtime tracking)
  - Session Delta Tracking (read only new bytes)
  - Score Merging (configurable weights: vectorWeight + textWeight)

### Session 16: 2026-02-03 (continued)
- [x] Deep dive: Gateway System (Multi-Channel Hub)
  - Hierarchical Routing (peer → guild → team → account → channel → default)
  - Session Key Encoding (agent:channel:account:peer:scope)
  - DM Scopes (main, per-peer, per-channel-peer, per-account-channel-peer)
  - WebSocket Device Auth (RSA signatures, nonce challenge)
  - Scope-Based Event Filtering (client authorization)
  - Backpressure Detection (bufferedAmount > threshold → drop/close)
  - Channel Lifecycle (start/stop per account with abort signals)
  - Batch Delivery (sequential, per-payload callbacks, best-effort)
  - Broadcast with Sequence Numbers (gap detection)

### Session 17: 2026-02-03 (continued)
- [x] Deep dive: ACP Protocol (Agent Communication Protocol)
  - Frame Types (Request/Response/Event)
  - Session Store (in-memory with AbortController)
  - Delta Streaming (sentTextLength tracking)
  - Tool Call Phases (start → result)
  - Tool Kind Inference (read/edit/delete/execute/fetch/other)
  - Commands Registry
  - Metadata Helpers (readMetaString, readMetaBool, readMetaNumber)
  - IDE ↔ Agent ↔ Gateway bridge pattern

### Session 18: 2026-02-03 (continued)
- [x] Deep dive: TUI Core (Terminal User Interface)
  - Slash Command Parser (/command args with aliases)
  - Input Type Detection (command/bash/message)
  - Activity Status Tracking (idle/sending/waiting/streaming/running/error)
  - Connection Status (connecting/connected/disconnected/reconnecting)
  - Stream Assembler (delta processing, thinking/content separation)
  - Waiting Animation (shimmer effect, playful phrases, tick-based)
  - Searchable Filtering (4-tier: exact → prefix → substring → fuzzy)
  - Input History (up/down navigation, deduplication)
  - Footer Builder (multi-part status display)

### Session 19: 2026-02-03 (continued)
- [x] Deep dive: Browser CDP (Chrome DevTools Protocol)
  - CDP WebSocket Connection (request/response via message ID)
  - Screenshot Capture (full page, viewport, clip region)
  - Screenshot Optimization (resize + JPEG quality ladder)
  - Navigation with Waiting (timeMs, text, selector, loadState, fn)
  - Content Extraction (text, HTML, querySelector)
  - JavaScript Evaluation
  - Multi-Browser Detection (Chrome, Brave, Edge, Chromium)
  - Browser Launch/Stop (--remote-debugging-port, graceful shutdown)

### Progress Summary
- **Lines Read:** ~72,000 / 441,267 (~16.3%)
- **Modules Documented:** 29
- **Key Patterns Found:** Bootstrap files, Compaction, Rich directives, Inline directives, Smart chunking, Debounce, Config pipeline, Event hooks, Structured logging, Retry/Backoff, Dedupe, Message routing, Session management, Channel abstraction, Media handling, Security audit, Injection protection, Markdown processing, Queue management, Terminal UI, Command Queue (Pump), Command Lanes, Process Timeout, Spawn Fallback, Webhook Validation, Profile Caching, Flex Builders, Markdown→Flex, MsgContext, Template Interpolation, Envelope Formatting, Human Delay, Reply Queue, Dispatch Kinds, Hybrid Search, Multi-Provider Embeddings, Embedding Cache, Chunk Overlap, Incremental Sync, Hierarchical Routing, Session Key Encoding, Channel Lifecycle, Batch Delivery, Backpressure Detection, ACP Protocol, Delta Streaming, Tool Call Tracking, Command Parser, Activity Tracker, Stream Assembler, Waiting Animation, Searchable Filter, CDP Connection, Screenshot Capture, Navigation Waiting, Content Extraction, Browser Detection
- **Implemented for Oracle:**
  - Session persistence (oracle-session.json)
  - Skill System (lib/skill-system.js)
  - LINE Rich Directives (lib/line-directives.js)
  - BOOT.md System (lib/boot-system.js)
  - Auto-Compaction (lib/compaction.js)
  - Context Window Guard (lib/context-guard.js)
  - Cron Patterns (lib/cron-patterns.js)
  - LINE Multi-Account (lib/line-multi-account.js)
  - Inline Directives (lib/inline-directives.js)
  - Smart Chunking (lib/smart-chunking.js)
  - Inbound Debounce (lib/inbound-debounce.js)
  - Status Builder (lib/status-builder.js)
  - Config Loader (lib/config-loader.js)
  - Config Defaults (lib/config-defaults.js)
  - Hooks System (lib/hooks-system.js)
  - Logger (lib/logger.js)
  - Retry (lib/retry.js)
  - Dedupe (lib/dedupe.js)
  - Routing (lib/routing.js)
  - Session Manager (lib/session-manager.js)
  - Channels (lib/channels.js)
  - Media (lib/media.js)
  - Security (lib/security.js)
  - Markdown (lib/markdown.js)
  - Utils (lib/utils.js)
  - Terminal (lib/terminal.js)
  - Process (lib/process.js)
  - LINE Core (lib/line-core.js)
  - Flex Builder (lib/flex-builder.js)
  - Context Builder (lib/context-builder.js)
  - Reply Queue (lib/reply-queue.js)
  - Memory Index (lib/memory-index.js)
  - Embeddings (lib/embeddings.js)
  - Message Router (lib/message-router.js)
  - Channel Manager (lib/channel-manager.js)
  - ACP Protocol (lib/acp-protocol.js)
  - TUI Core (lib/tui-core.js)
  - Browser CDP (lib/browser-cdp.js)

---
*Last Updated: 2026-02-03*
