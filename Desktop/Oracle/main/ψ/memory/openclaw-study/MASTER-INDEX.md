# OpenClaw Study - Master Index

> เป้าหมาย: อ่าน + เข้าใจ + ก้าวข้าม OpenClaw
> เริ่ม: 2026-02-03
> Total Lines: 441,267 lines TypeScript
> Last Updated: 2026-02-03T21:45:00+07:00

---

## Quick Resume

**Session ใหม่ → อ่าน:** `RESUME.md`

---

## Verified Progress

| Metric | Value | Verification |
|--------|-------|--------------|
| Lib files | 50 | `ls lib/*.js \| wc -l` |
| Doc files | 16 | `ls modules/*.md \| wc -l` |
| Libs with doc coverage | ~32 | manually mapped |
| Libs without doc | ~18 | manually mapped |
| OpenClaw read | ~16% | ~72K/441K lines |

---

## Documentation → Library Mapping

### 16 System Docs → ~32 Libraries

| Doc File | Libraries Covered |
|----------|-------------------|
| SKILL-SYSTEM.md | skill-system.js |
| MEMORY-SYSTEM.md | memory.js, memory-db.js, memory-index.js, embeddings.js, memory-sync.js |
| CRON-HEARTBEAT.md | cron-patterns.js |
| HEARTBEAT-SYSTEM.md | heartbeat.js |
| SESSION-PERSISTENCE.md | session-memory.js |
| LINE-INTEGRATION.md | line.js, line-directives.js, line-multi-account.js |
| GATEWAY-ROUTING.md | channel-manager.js, message-router.js |
| AGENT-CORE.md | boot-system.js, compaction.js, context-guard.js |
| AUTO-REPLY.md | smart-chunking.js, inbound-debounce.js, inline-directives.js |
| PLUGIN-SYSTEM.md | plugin-system.js |
| CONFIG-SYSTEM.md | config-loader.js, config-defaults.js |
| HOOKS-SYSTEM.md | hooks-system.js |
| INFRA-SYSTEM.md | logger.js, retry.js, dedupe.js |
| ROUTING-SESSIONS.md | routing.js, session-manager.js |
| CHANNELS-MEDIA.md | channels.js, media.js |
| SECURITY-SYSTEM.md | security.js |

### ~18 Libraries WITHOUT Documentation

**From OpenClaw Study (14):**
```
acp-protocol.js      announce-queue.js    browser-cdp.js
context-builder.js   flex-builder.js      index.js
line-core.js         markdown.js          process.js
reply-queue.js       status-builder.js    terminal.js
tui-core.js          utils.js
```

**Pre-existing (4):**
```
autonomous-scheduler.js  autonomy.js
beds24.js               claude.js
```

---

## Full Library List (50 files)

### All Libraries in lib/

```
acp-protocol.js       announce-queue.js     autonomous-scheduler.js
autonomy.js           beds24.js             boot-system.js
browser-cdp.js        channel-manager.js    channels.js
claude.js             compaction.js         config-defaults.js
config-loader.js      context-builder.js    context-guard.js
cron-patterns.js      dedupe.js             embeddings.js
flex-builder.js       heartbeat.js          hooks-system.js
inbound-debounce.js   index.js              inline-directives.js
line.js               line-core.js          line-directives.js
line-multi-account.js logger.js             markdown.js
media.js              memory.js             memory-db.js
memory-index.js       memory-sync.js        message-router.js
plugin-system.js      process.js            reply-queue.js
retry.js              routing.js            security.js
session-manager.js    session-memory.js     skill-system.js
smart-chunking.js     status-builder.js     terminal.js
tui-core.js           utils.js
```

---

## OpenClaw Codebase Status

### ✅ Read (~16%)
- src/agents/ (core, skills)
- src/memory/
- src/cron/
- src/gateway/
- src/line/
- src/auto-reply/
- src/plugins/
- src/config/
- src/hooks/
- src/infra/
- src/routing/
- src/sessions/
- src/channels/
- src/media/
- src/security/
- src/markdown/
- src/utils/
- src/terminal/
- src/process/
- src/acp/
- src/tui/
- src/browser/

### ⏳ Not Read (~84%)
- src/telegram/ (LOW priority)
- src/discord/ (LOW priority)
- src/cli/ (LOW priority)
- src/slack/ (LOW priority)
- src/whatsapp/ (LOW priority)
- src/signal/ (LOW priority)
- skills/ (MEDIUM priority)
- extensions/ (LOW priority)

---

## Next Steps

See `RESUME.md` for detailed next actions.

**Recommended:** Integrate libraries into server.js

---

*Last Updated: 2026-02-03T21:45:00+07:00*
