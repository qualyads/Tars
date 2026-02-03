# OpenClaw Agent Core - Deep Dive

> ศึกษา core agent logic: bootstrap, compaction, context window
> Status: ✅ Core patterns understood
> Location: `src/agents/`

## 1. Bootstrap Files System

OpenClaw โหลดไฟล์เหล่านี้ทุก session ใหม่:

```typescript
// src/agents/workspace.ts

// Standard bootstrap files
export const DEFAULT_AGENTS_FILENAME = "AGENTS.md";      // Agent capabilities, routing
export const DEFAULT_SOUL_FILENAME = "SOUL.md";          // Personality, values
export const DEFAULT_TOOLS_FILENAME = "TOOLS.md";        // Tool documentation
export const DEFAULT_IDENTITY_FILENAME = "IDENTITY.md";  // Avatar, appearance
export const DEFAULT_USER_FILENAME = "USER.md";          // User preferences
export const DEFAULT_HEARTBEAT_FILENAME = "HEARTBEAT.md"; // Scheduled task config
export const DEFAULT_BOOTSTRAP_FILENAME = "BOOTSTRAP.md"; // Initial setup
export const DEFAULT_MEMORY_FILENAME = "MEMORY.md";      // 🔥 Persistent learnings
```

### Bootstrap Loading Flow
```typescript
async function resolveBootstrapFilesForRun(params) {
  // 1. Load all workspace bootstrap files
  const bootstrapFiles = await loadWorkspaceBootstrapFiles(params.workspaceDir);

  // 2. Filter by session (some files are session-specific)
  const filtered = filterBootstrapFilesForSession(bootstrapFiles, sessionKey);

  // 3. Apply hook overrides (dynamic injection)
  return applyBootstrapHookOverrides({
    files: filtered,
    workspaceDir,
    config,
    sessionKey,
    agentId,
  });
}
```

### File Priority
```
1. AGENTS.md   - "Who am I, what can I do"
2. SOUL.md     - "My personality and values"
3. MEMORY.md   - "What I remember" ← 🔥 KEY!
4. USER.md     - "Who is my user"
5. TOOLS.md    - "How to use my tools"
6. IDENTITY.md - "How I present myself"
```

## 2. Compaction System (Auto-Summarize)

เมื่อ context ยาวเกิน → summarize อัตโนมัติ

```typescript
// src/agents/compaction.ts

export const BASE_CHUNK_RATIO = 0.4;   // Default: 40% of context
export const MIN_CHUNK_RATIO = 0.15;   // Min: 15%
export const SAFETY_MARGIN = 1.2;      // 20% buffer for estimation

// Split messages by token share
export function splitMessagesByTokenShare(
  messages: AgentMessage[],
  parts = 2  // Default: split into 2 parts
): AgentMessage[][] {
  const totalTokens = estimateMessagesTokens(messages);
  const targetTokens = totalTokens / parts;

  // Split at token boundaries
  const chunks: AgentMessage[][] = [];
  let current: AgentMessage[] = [];
  let currentTokens = 0;

  for (const message of messages) {
    const msgTokens = estimateTokens(message);
    if (currentTokens + msgTokens > targetTokens && current.length > 0) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(message);
    currentTokens += msgTokens;
  }

  return chunks;
}
```

### Summarization Flow
```typescript
async function summarizeChunks(params) {
  const chunks = chunkMessagesByMaxTokens(params.messages, params.maxChunkTokens);
  let summary = params.previousSummary;

  // Iteratively summarize each chunk
  for (const chunk of chunks) {
    summary = await generateSummary(
      chunk,
      params.model,
      params.reserveTokens,
      params.apiKey,
      params.signal,
      params.customInstructions,
      summary  // Previous summary as context
    );
  }

  return summary ?? "No prior history.";
}
```

### Adaptive Chunk Ratio
```typescript
// When messages are large, use smaller chunks
export function computeAdaptiveChunkRatio(messages, contextWindow) {
  const avgTokens = estimateMessagesTokens(messages) / messages.length;
  const safeAvgTokens = avgTokens * SAFETY_MARGIN;
  const avgRatio = safeAvgTokens / contextWindow;

  // If average message > 10% of context, reduce chunk ratio
  if (avgRatio > 0.1) {
    const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
    return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
  }

  return BASE_CHUNK_RATIO;
}
```

**Key Instruction for Summary:**
> "Preserve decisions, TODOs, open questions, and any constraints."

## 3. Context Window Guard

```typescript
// src/agents/context-window-guard.ts

export const CONTEXT_WINDOW_HARD_MIN_TOKENS = 16_000;
export const CONTEXT_WINDOW_WARN_BELOW_TOKENS = 32_000;

export function evaluateContextWindowGuard(params) {
  return {
    tokens: params.info.tokens,
    source: params.info.source,
    shouldWarn: tokens < warnBelow,   // Warn if < 32K
    shouldBlock: tokens < hardMin,     // Block if < 16K
  };
}
```

### Context Window Sources (Priority)
```
1. modelsConfig - User-defined in config
2. model        - From model metadata
3. default      - Fallback value

+ agentContextTokens cap - Hard limit from agent config
```

## 4. Identity System

```typescript
// src/agents/identity.ts

export function resolveAgentIdentity(cfg, agentId) {
  return resolveAgentConfig(cfg, agentId)?.identity;
}

export function resolveAckReaction(cfg, agentId) {
  const configured = cfg.messages?.ackReaction;
  if (configured !== undefined) return configured.trim();

  // Fallback to identity emoji
  const emoji = resolveAgentIdentity(cfg, agentId)?.emoji?.trim();
  return emoji || "👀";  // Default reaction
}

// Human-like delay simulation
export function resolveHumanDelayConfig(cfg, agentId) {
  return {
    mode: "enabled" | "disabled",
    minMs: 500,   // Minimum delay
    maxMs: 2000,  // Maximum delay
  };
}
```

## 5. Key Patterns for Oracle

### 5.1 Bootstrap Files → Oracle Equivalent

| OpenClaw | Oracle | Purpose |
|----------|--------|---------|
| MEMORY.md | session-learnings.md | Accumulated knowledge |
| SOUL.md | identity.md | Personality |
| USER.md | oracle-session.json | User preferences |
| AGENTS.md | CLAUDE.md | Capabilities |
| HEARTBEAT.md | autonomy.js | Scheduled tasks |

### 5.2 Compaction → Oracle Implementation

```javascript
// Oracle ยังไม่มี auto-summarize
// ต้อง implement:

async function compactIfNeeded(messages, contextLimit) {
  const tokens = estimateTokens(messages);
  if (tokens > contextLimit * 0.8) {
    // Summarize old messages
    const toSummarize = messages.slice(0, -5);  // Keep last 5
    const summary = await generateSummary(toSummarize);

    // Replace with summary
    return [
      { role: "system", content: `Previous context: ${summary}` },
      ...messages.slice(-5)
    ];
  }
  return messages;
}
```

### 5.3 Context Window Management

```javascript
// Oracle should add:
const CONTEXT_LIMITS = {
  'claude-3-opus': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-haiku': 200_000,
};

function checkContextWindow(messages, model) {
  const limit = CONTEXT_LIMITS[model] || 100_000;
  const used = estimateTokens(messages);

  if (used > limit * 0.9) {
    console.warn(`Context ${used}/${limit} (90%+) - consider compaction`);
  }
}
```

## 6. Key Insights

### What OpenClaw Does Right

1. **Bootstrap = Always Loaded**
   - MEMORY.md โหลดทุก session
   - ไม่ต้องถามซ้ำ AI รู้เลย

2. **Compaction = Auto-Summarize**
   - Context ยาว → summarize
   - Keep: decisions, TODOs, open questions

3. **Identity = Consistent Personality**
   - Same voice across sessions
   - Emoji/avatar/name

4. **Human Delay = Natural Feel**
   - ไม่ตอบทันที
   - รู้สึกเป็นมนุษย์

### What Oracle Should Add

1. **Auto-compaction** - เมื่อ context ใกล้เต็ม
2. **Better token estimation** - accurate counting
3. **Memory injection** - อ่าน learnings อัตโนมัติ

## 7. Implementation Priority

| Priority | Feature | Status |
|----------|---------|--------|
| HIGH | Bootstrap files (CLAUDE.md, identity.md) | ✅ Done |
| HIGH | Session persistence (oracle-session.json) | ✅ Done |
| MEDIUM | Auto-compaction | ❌ Not yet |
| MEDIUM | Context window guard | ❌ Not yet |
| LOW | Human delay simulation | ❌ Not yet |

---
*Analyzed: 2026-02-03*
*Files: workspace.ts (~300 lines), compaction.ts (~250 lines), context-window-guard.ts (~75 lines), identity.ts (~96 lines), bootstrap-files.ts (~60 lines)*
