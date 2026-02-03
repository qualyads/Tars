# OpenClaw Study - Master Index

> เป้าหมาย: อ่าน + เข้าใจ + ก้าวข้าม OpenClaw
> เริ่ม: 2026-02-03
> Total Lines: 441,267 lines TypeScript
> Last Updated: 2026-02-03T21:30:00+07:00

---

## Quick Resume

**Session ใหม่ → อ่าน:** `RESUME.md`

---

## Progress Summary

| Metric | Value |
|--------|-------|
| Lines Read | ~72,000 / 441,267 |
| Progress | ~16.3% |
| Docs Created | 16 files |
| Libs Implemented | 50 files (42 new + 8 pre-existing) |

---

## Documentation Status

### ✅ Documented (16 modules)

| Module | Doc File | Lib File |
|--------|----------|----------|
| Skill System | [SKILL-SYSTEM.md](modules/SKILL-SYSTEM.md) | skill-system.js |
| Memory System | [MEMORY-SYSTEM.md](modules/MEMORY-SYSTEM.md) | memory-index.js, embeddings.js |
| Cron/Heartbeat | [CRON-HEARTBEAT.md](modules/CRON-HEARTBEAT.md) | cron-patterns.js |
| Heartbeat | [HEARTBEAT-SYSTEM.md](modules/HEARTBEAT-SYSTEM.md) | heartbeat.js |
| Session Persistence | [SESSION-PERSISTENCE.md](modules/SESSION-PERSISTENCE.md) | session-memory.js |
| LINE Integration | [LINE-INTEGRATION.md](modules/LINE-INTEGRATION.md) | line-directives.js |
| Gateway/Routing | [GATEWAY-ROUTING.md](modules/GATEWAY-ROUTING.md) | channel-manager.js |
| Agent Core | [AGENT-CORE.md](modules/AGENT-CORE.md) | boot-system.js, compaction.js |
| Auto-Reply | [AUTO-REPLY.md](modules/AUTO-REPLY.md) | smart-chunking.js, inbound-debounce.js |
| Plugin System | [PLUGIN-SYSTEM.md](modules/PLUGIN-SYSTEM.md) | plugin-system.js |
| Config System | [CONFIG-SYSTEM.md](modules/CONFIG-SYSTEM.md) | config-loader.js, config-defaults.js |
| Hooks System | [HOOKS-SYSTEM.md](modules/HOOKS-SYSTEM.md) | hooks-system.js |
| Infra System | [INFRA-SYSTEM.md](modules/INFRA-SYSTEM.md) | logger.js, retry.js, dedupe.js |
| Routing/Sessions | [ROUTING-SESSIONS.md](modules/ROUTING-SESSIONS.md) | routing.js, session-manager.js |
| Channels/Media | [CHANNELS-MEDIA.md](modules/CHANNELS-MEDIA.md) | channels.js, media.js |
| Security | [SECURITY-SYSTEM.md](modules/SECURITY-SYSTEM.md) | security.js |

### ❌ Implemented but No Doc (10 modules)

| Module | Lib File | Priority |
|--------|----------|----------|
| Process Management | process.js | MEDIUM |
| LINE Core | line-core.js | HIGH |
| Flex Builder | flex-builder.js | HIGH |
| Context Builder | context-builder.js | HIGH |
| ACP Protocol | acp-protocol.js | LOW |
| TUI Core | tui-core.js | LOW |
| Browser CDP | browser-cdp.js | MEDIUM |
| Announce Queue | announce-queue.js | MEDIUM |
| Reply Queue | reply-queue.js | MEDIUM |
| Message Router | message-router.js | HIGH |

---

## Libraries Inventory (50 files)

### From OpenClaw Study (42 files)

```
acp-protocol.js      announce-queue.js    boot-system.js
browser-cdp.js       channel-manager.js   channels.js
compaction.js        config-defaults.js   config-loader.js
context-builder.js   context-guard.js     cron-patterns.js
dedupe.js            embeddings.js        flex-builder.js
hooks-system.js      inbound-debounce.js  index.js
inline-directives.js line-core.js         line-directives.js
line-multi-account.js logger.js           markdown.js
media.js             memory-db.js         memory-index.js
message-router.js    plugin-system.js     process.js
reply-queue.js       retry.js             routing.js
security.js          session-manager.js   session-memory.js
skill-system.js      smart-chunking.js    status-builder.js
terminal.js          tui-core.js          utils.js
```

### Pre-existing (8 files)

```
autonomous-scheduler.js  autonomy.js    beds24.js
claude.js               heartbeat.js    line.js
memory-sync.js          memory.js
```

---

## OpenClaw Codebase Status

### ✅ Read & Understood (~16%)

| Directory | Files | Status |
|-----------|-------|--------|
| src/index.ts | 1 | ✅ Done |
| src/entry.ts | 1 | ✅ Done |
| src/agents/skills/ | ~13 | ✅ Done |
| src/memory/ | ~41 | ✅ Done |
| src/cron/ | ~23 | ✅ Done |
| src/gateway/ | ~127 | ✅ Done |
| src/agents/ (core) | ~289 | ✅ Done |
| src/line/ | ~36 | ✅ Done |
| src/auto-reply/ | ~73 | ✅ Done |
| src/plugins/ | ~30 | ✅ Done |
| src/config/ | ~124 | ✅ Done |
| src/hooks/ | ~15 | ✅ Done |
| src/infra/ | ~152 | ✅ Done |
| src/routing/ | ~5 | ✅ Done |
| src/sessions/ | ~10 | ✅ Done |
| src/channels/ | ~10 | ✅ Done |
| src/media/ | ~10 | ✅ Done |
| src/security/ | ~5 | ✅ Done |
| src/markdown/ | ~6 | ✅ Done |
| src/utils/ | ~10 | ✅ Done |
| src/terminal/ | ~10 | ✅ Done |
| src/process/ | ~5 | ✅ Done |
| src/acp/ | ~12 | ✅ Done |
| src/tui/ | ~25 | ✅ Done |
| src/browser/ | ~35 | ✅ Done |

### ⏳ Not Read Yet (~84%)

| Directory | Files | Priority |
|-----------|-------|----------|
| src/telegram/ | ~83 | LOW |
| src/discord/ | ~44 | LOW |
| src/cli/ | ~107 | LOW |
| src/slack/ | ~30 | LOW |
| src/whatsapp/ | ~25 | LOW |
| src/signal/ | ~20 | LOW |
| skills/ | ~55 folders | MEDIUM |
| extensions/ | ~32 folders | LOW |

---

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

---

## Key Discoveries

### 1. Entry Point Flow
```
1. loadDotEnv() - Load environment
2. normalizeEnv() - Normalize env vars
3. ensureOpenClawCliOnPath() - Setup PATH
4. enableConsoleCapture() - Structured logging
5. assertSupportedRuntime() - Check Node version
6. buildProgram() - Build CLI with Commander
7. program.parseAsync() - Execute command
```

### 2. Key Patterns
- Bootstrap files (MEMORY.md always loaded)
- Auto-compaction at 80% context
- Hybrid search (BM25 + Vector)
- Human delay between messages
- Inbound debounce for rapid messages
- Reply queue for ordered delivery

---

## Next Steps

**Recommended:** Integrate libraries into server.js

See `RESUME.md` for detailed next actions.

---

*Last Updated: 2026-02-03T21:30:00+07:00*
