# Auto-Reply System - OpenClaw Deep Dive

> **Status:** ✅ Implemented for Oracle
> **Files Studied:** ~73 files in `src/auto-reply/`
> **Key Patterns:** Inline directives, Smart chunking, Debounce, Status building

## Summary

The auto-reply system handles incoming messages and generates appropriate responses.
It's the core of how OpenClaw processes chat messages.

## Key Components

### 1. Inline Directives (`reply/directives.ts`)

Users can embed directives in their messages:

```
/think high How do I solve this?
/verbose on Tell me about X
/model claude-3-opus Explain Y
```

**Supported Directives:**
- `/think [level]` - Control thinking depth (off/minimal/low/medium/high/xhigh)
- `/verbose [on/off/full]` - Toggle verbose output
- `/elevated [on/off/ask/full]` - Permission control
- `/reasoning [on/off/stream]` - Show reasoning
- `/status` - Show current status

**Implementation Pattern:**
```javascript
function extractLevelDirective(body, names, normalize) {
  const namePattern = names.join('|');
  const regex = new RegExp(`(?:^|\\s)\\/(?:${namePattern})(?:$|\\s|:)\\s*([A-Za-z-]*)?`, 'i');
  const match = body.match(regex);
  // Extract level, clean body
}
```

### 2. Thinking Levels (`thinking.ts`)

Multiple levels of AI "thinking":

| Level | Description |
|-------|-------------|
| off | No extended thinking |
| minimal | Basic thinking |
| low | Light reasoning |
| medium | Moderate reasoning |
| high | Deep reasoning |
| xhigh | Maximum (specific models only) |

### 3. Smart Chunking (`chunk.ts`)

Intelligent message splitting:

**Features:**
- Respects markdown code fences
- Breaks at paragraph boundaries (blank lines)
- Doesn't break inside parentheses (URLs)
- Per-provider limits

**Modes:**
- `length` - Split only when exceeding limit
- `newline` - Prefer paragraph boundaries

**Provider Limits:**
| Provider | Limit |
|----------|-------|
| LINE | 5000 |
| WhatsApp | 4096 |
| Telegram | 4096 |
| Discord | 2000 |
| SMS | 160 |

**Code Pattern:**
```javascript
function chunkMarkdownText(text, limit) {
  const spans = parseFenceSpans(text);
  // Find safe break points
  // If inside fence, close & reopen
}
```

### 4. Inbound Debounce (`inbound-debounce.ts`)

Batch rapid messages:

```
User sends: "hello" (t=0ms)
User sends: "how are you" (t=200ms)
User sends: "?" (t=400ms)

→ Debouncer waits 500ms
→ Sends combined: "hello\nhow are you\n?"
```

**Configuration:**
```javascript
const debouncer = createInboundDebouncer({
  debounceMs: 500,
  buildKey: (msg) => msg.userId,
  onFlush: async (messages) => { /* process batch */ }
});
```

### 5. Message Envelope (`envelope.ts`)

Format messages with context:

```
[LINE User +2m 2026-02-03 14:30 ICT] How much is the room?
```

**Envelope Parts:**
- Channel (LINE, WhatsApp, etc.)
- Sender
- Elapsed time (+2m)
- Timestamp
- Timezone

### 6. Status Builder (`status.ts`)

Build comprehensive status messages:

```
🦞 OpenClaw v2025.1.15
🧠 Model: anthropic/claude-3-5-sonnet · 🔑 api-key
🧮 Tokens: 12.5K in / 2.1K out · 💵 $0.042
📚 Context: 45.2K/200K (23%) · 🧹 Compactions: 0
🧵 Session: line:user:U123 • updated 5m ago
⚙️ Think: low · Verbose: off
🪢 Queue: buffered (depth 0)
```

### 7. Command Registry (`commands-registry.ts`)

Command parsing and normalization:

**Text Aliases:**
```
/new, /reset, /clear → newSession
/think, /thinking, /t → think
/v, /verbose → verbose
```

**Features:**
- Case-insensitive
- Bot mention handling (`/command@botname`)
- Args parsing
- Per-config command enabling

## Oracle Implementation

Created 4 new modules based on these patterns:

### 1. `lib/inline-directives.js`
```javascript
import { processAllDirectives } from './inline-directives.js';

const result = processAllDirectives('/think high สวัสดี');
// {
//   cleanedBody: 'สวัสดี',
//   thinkLevel: 'high',
//   hasAnyDirective: true
// }
```

### 2. `lib/smart-chunking.js`
```javascript
import { smartChunk } from './smart-chunking.js';

const chunks = smartChunk(longText, {
  provider: 'line',
  mode: 'newline',
  markdown: true
});
```

### 3. `lib/inbound-debounce.js`
```javascript
import { createMessageDebouncer } from './inbound-debounce.js';

const debouncer = createMessageDebouncer(handleMessage, {
  provider: 'line',
  debounceMs: 500
});

// Use: debouncer.handle(message)
```

### 4. `lib/status-builder.js`
```javascript
import { buildStatusMessage } from './status-builder.js';

const status = buildStatusMessage({
  model: 'claude-3-5-sonnet',
  contextUsed: 45000,
  contextMax: 200000,
  thinkLevel: 'low'
});
```

## Key Learnings

1. **Inline directives are powerful** - Let users control AI behavior without separate commands
2. **Smart chunking prevents broken code** - Never split inside fences
3. **Debounce reduces costs** - Batch rapid messages
4. **Status should be comprehensive** - Users want to know everything

## Files Read

| File | Lines | Purpose |
|------|-------|---------|
| reply.ts | 12 | Export barrel |
| dispatch.ts | 78 | Dispatcher functions |
| envelope.ts | 279 | Message formatting |
| chunk.ts | 501 | Smart chunking |
| status.ts | 698 | Status building |
| commands-registry.ts | 521 | Command system |
| thinking.ts | 230 | Think levels |
| templating.ts | 185 | Template engine |
| reply/directives.ts | 194 | Directive extraction |
| inbound-debounce.ts | 111 | Debouncing |

**Total:** ~2,809 lines

---
*Documented: 2026-02-03*
