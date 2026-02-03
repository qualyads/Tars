# OpenClaw Session Persistence - The Solution to "Forgetting"

> 🔥 นี่คือ KEY INSIGHT ที่แก้ปัญหา "Session ใหม่ลืมหมด"
> Status: ✅ Core pattern understood

## 1. ปัญหาที่ต้องแก้

```
Session 1: AI เข้าใจ → ทำงาน → session จบ
Session 2: AI ลืมหมด → ต้องเริ่มใหม่

❌ ความรู้หาย
❌ Preferences หาย
❌ Context หาย
```

## 2. OpenClaw แก้ยังไง

### Layer 1: SessionEntry (Sticky Preferences)

```typescript
// เก็บ decisions ที่ user ทำไว้ - carry forward ไป session ใหม่
type SessionEntry = {
  sessionId: string;
  updatedAt: number;

  // 🔥 Sticky choices - ไม่หายข้าม session
  thinkingLevel?: string;       // User ชอบคิดลึกแค่ไหน
  verboseLevel?: string;        // User ชอบคำตอบยาว/สั้น
  modelOverride?: string;       // User ชอบ model ไหน
  sendPolicy?: "allow" | "deny"; // User อนุญาตส่งข้อความไหม

  // 🔥 Statistics - เรียนรู้จาก usage
  inputTokens?: number;
  outputTokens?: number;
  compactionCount?: number;     // กี่ครั้งที่ถูก summarize

  // 🔥 Origin - จำว่าเริ่มจากไหน
  origin?: {
    provider: string;   // LINE, WhatsApp, etc.
    from: string;       // User ID
    chatType: string;   // DM, Group
  };
};
```

**เก็บที่:** `~/.openclaw/sessions/sessions.json`

### Layer 2: JSONL Transcripts (Full History)

```
~/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl

{"role":"user","content":"ห้องว่างวันนี้มีไหม"}
{"role":"assistant","content":"มีครับ ห้อง 101, 102..."}
{"role":"user","content":"จอง 101 ให้หน่อย"}
...
```

**Key:** Append-only, ไม่เคยลบ, replay ได้

### Layer 3: Bootstrap Files (Always Loaded)

```
workspace/
├── AGENTS.md      ← ความสามารถ, routing rules
├── SOUL.md        ← Personality, values
├── MEMORY.md      ← 🔥 สิ่งที่เรียนรู้มา
├── IDENTITY.md    ← ตัวตน, avatar
├── USER.md        ← User preferences
└── TOOLS.md       ← Skills documentation
```

**Key:** โหลดทุก session ใหม่ - นี่คือ "ความทรงจำถาวร"

### Layer 4: Compaction Summaries (Automatic Learning)

```typescript
// เมื่อ context ยาวเกิน → summarize อัตโนมัติ
async function summarizeInStages(messages) {
  // 1. แบ่ง conversation เป็นส่วนๆ
  const splits = splitMessagesByTokenShare(messages, parts);

  // 2. Summarize แต่ละส่วน
  const summaries = await Promise.all(
    splits.map(chunk => summarize(chunk))
  );

  // 3. รวมเป็น summary เดียว
  return mergeSummaries(summaries);

  // 🔥 Instruction: "Preserve decisions, TODOs, open questions"
}
```

**Key:** AI สรุป "สิ่งสำคัญ" จาก conversation แล้วเก็บไว้

## 3. The Real Solution Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Session Persistence                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐     ┌──────────────────┐            │
│  │ Bootstrap Files  │ +   │  SessionEntry    │            │
│  │ (MEMORY.md)      │     │  (preferences)   │            │
│  │ โหลดทุก session   │     │  persist ถาวร    │            │
│  └────────┬─────────┘     └────────┬─────────┘            │
│           │                        │                       │
│           └────────────┬───────────┘                       │
│                        ▼                                   │
│           ┌──────────────────────────┐                    │
│           │   Session Start Context  │                    │
│           │   - Identity             │                    │
│           │   - Memory               │                    │
│           │   - User preferences     │                    │
│           │   - Previous learnings   │                    │
│           └──────────────────────────┘                    │
│                        │                                   │
│                        ▼                                   │
│           ┌──────────────────────────┐                    │
│           │   Conversation           │                    │
│           │   (recorded in JSONL)    │                    │
│           └──────────────────────────┘                    │
│                        │                                   │
│                        ▼                                   │
│           ┌──────────────────────────┐                    │
│           │   Session End            │                    │
│           │   - Save preferences     │                    │
│           │   - Summarize if needed  │                    │
│           │   - Update MEMORY.md     │   ← 🔥 KEY!       │
│           └──────────────────────────┘                    │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

## 4. Implementation for Oracle

### Step 1: สร้าง oracle-session.json

```javascript
// ψ/memory/oracle-session.json
{
  "sessionId": "abc123",
  "lastUpdated": 1706961234567,

  // Tars's preferences (sticky)
  "preferences": {
    "thinkingLevel": "deep",
    "verboseLevel": "concise",
    "language": "th",
    "notifyChannel": "line"
  },

  // Statistics (learning)
  "stats": {
    "totalSessions": 42,
    "totalMessages": 1234,
    "compactionCount": 5,
    "lastTopics": ["hotel", "crypto", "tm30"]
  },

  // Origin (context)
  "origin": {
    "firstContact": "2025-11-01",
    "primaryChannel": "line",
    "userId": "Tars"
  }
}
```

### Step 2: Update MEMORY.md หลัง session

```javascript
// หลังทุก session สำคัญ
async function updateMemory(sessionSummary) {
  const memoryPath = 'ψ/memory/resonance/session-learnings.md';

  const newEntry = `
### Session ${new Date().toISOString().split('T')[0]}
${sessionSummary.keyDecisions}
${sessionSummary.openQuestions}
${sessionSummary.newKnowledge}
`;

  // Append to memory file
  fs.appendFileSync(memoryPath, newEntry);
}
```

### Step 3: Smart Bootstrap Loading

```javascript
// Session เริ่ม → load ตามลำดับ
async function loadSessionContext() {
  // 1. Load identity (ต้องมี)
  const identity = await loadFile('ψ/memory/resonance/identity.md');

  // 2. Load session state (ถ้ามี)
  const session = await loadFile('ψ/memory/oracle-session.json');

  // 3. Load relevant memories only
  if (session.lastTopics.includes('hotel')) {
    await loadFile('ψ/skills/beds24/SKILL.md');
  }

  // 4. Load recent learnings (last 10 sessions)
  const learnings = await loadFile('ψ/memory/resonance/session-learnings.md');

  return { identity, session, learnings };
}
```

## 5. Key Insight

**OpenClaw ไม่ได้แก้ "AI memory" - แก้ "State persistence"**

```
❌ พยายามให้ AI "จำ" ข้าม session
✅ เก็บ state ใน files → AI อ่าน files → AI "รู้"
```

**ความรู้อยู่ใน:**
1. SessionEntry (preferences, stats)
2. JSONL transcripts (full history)
3. Bootstrap files (MEMORY.md, SOUL.md)
4. Compaction summaries (extracted patterns)

**AI ไม่ได้จำ - AI อ่าน**

## 6. For Oracle: Action Items

```
1. ✅ สร้าง oracle-session.json (sticky preferences)
2. ✅ สร้าง session-learnings.md (accumulated knowledge)
3. ✅ Update CLAUDE.md to reference these files
4. ✅ Auto-summarize important sessions → append to learnings
5. ✅ Load relevant context based on topic
```

---
*Analyzed: 2026-02-03*
*This is the KEY to making Oracle "remember"*
