# Local Agent Remote Execution System

> **สร้างเมื่อ:** 2026-02-05
> **Version:** 5.18.0
> **สำคัญมาก** - ระบบนี้ทำให้ Oracle ทำงานบน Mac ของ Tars ได้จาก LINE

---

## Architecture Overview

```
┌─────────────┐      ┌────────────────────┐      ┌──────────────────────┐
│    LINE     │─────▶│  Oracle (Railway)  │─────▶│  Local Agent (Mac)   │
│  Telegram   │      │  - Receive message │      │  - Execute commands  │
└─────────────┘      │  - AI Intent       │ WS   │  - File operations   │
                     │  - Send to agent   │      │  - Claude Code       │
                     └────────────────────┘      │  - Open Terminal     │
                                                 └──────────────────────┘
```

---

## Key Components

### 1. Local Agent (`local-agent.js`)
- **Location:** `/Users/tanakitchaithip/Desktop/Oracle/main/tools/oracle-agent/local-agent.js`
- **Function:** รันบน Mac, เชื่อมต่อ Railway ผ่าน WebSocket
- **Capabilities:** shell, file, claude_code, system_info, workflow, open_terminal

### 2. Local Agent Server (`lib/local-agent-server.js`)
- **Location:** Railway server
- **Function:** รับ connection จาก Local Agent, route commands

### 3. Security Layer (`lib/local-security.js`)
- **Whitelist:** ls, cat, git, node, npm, claude, open, osascript, etc.
- **Blacklist:** sudo, rm, kill, chmod, shutdown, etc.
- **Path Restriction:** ~/Desktop, ~/Documents, ~/Downloads, ~/projects, /tmp

### 4. Workflow Executor (`lib/workflow-executor.js`)
- **Function:** สร้าง shell script, เปิด Terminal.app, รัน Claude Code
- **Output:** Projects ที่ `~/Desktop/projects/`

---

## AI-Powered Features

### Intent Detection (ไม่ใช้ regex!)
```javascript
// ใช้ Claude Haiku วิเคราะห์ intent จากข้อความ
const intentPrompt = `วิเคราะห์ข้อความนี้...`;
const intentResponse = await claude.chat([...], { model: 'claude-3-haiku-20240307' });
```

**ทำไมไม่ใช้ regex:**
- คนพิมพ์ผิด เช่น "สร้งโฟลเดอร์" (ขาด า)
- AI เข้าใจ context ได้ดีกว่า
- รองรับหลายภาษา/รูปแบบ

### AI Result Validator
```javascript
// ใช้ AI เช็คว่าคำสั่งทำงานจริงไหม
async function validateWithAI(action, result, context) {
  // ไม่ใช่แค่ดู exit code - AI วิเคราะห์ผลลัพธ์จริง
}
```

---

## Autonomous Systems

### Idea Engine (`lib/autonomous-ideas.js`)
- **Cron:** ทุก 6 ชม. (0:00, 6:00, 12:00, 18:00)
- **Flow:** Research → Generate → Score → Auto-execute (if score >= 75)
- **Data:** `data/autonomous-ideas.json`

### API Hunter (`lib/api-hunter.js`)
- **Cron:** ทุก 8 ชม. (2:00, 10:00, 18:00)
- **Sources:** Public APIs, GitHub, Curated list
- **Flow:** Discover → Test → Analyze → Notify
- **Data:** `data/api-discoveries.json`

---

## LINE Commands

| คำสั่ง | Action | ทำอะไร |
|--------|--------|--------|
| สร้างโฟลเดอร์ X | mkdir | สร้างโฟลเดอร์บน Desktop |
| เปิด browser | open_browser | เปิด Chrome/Safari |
| git status | git | รัน git command |
| เช็ค RAM | system_info | ดู memory/disk |
| สร้างโปรเจค X | workflow | เปิด Terminal + Claude + Deploy |
| คิด idea | think_ideas | Oracle brainstorm |
| ดู ideas | list_ideas | แสดง ideas |
| ล่า API | hunt_apis | หา API ใหม่ |
| ดู API | list_apis | แสดง discoveries |

---

## Auto-Start (launchd)

**File:** `~/Library/LaunchAgents/com.oracle.local-agent.plist`

```bash
# Commands
launchctl load ~/Library/LaunchAgents/com.oracle.local-agent.plist
launchctl unload ~/Library/LaunchAgents/com.oracle.local-agent.plist
launchctl start com.oracle.local-agent
launchctl stop com.oracle.local-agent
```

**Terminal aliases (in ~/.zshrc):**
- `line-24` - รัน full stack (Claude + tunnel + agent)
- `oracle-status` - เช็คสถานะ
- `oracle-logs` - ดู log
- `oracle-restart` - restart service

**Chat commands (พิมพ์ใน Claude Code):**
- `load memory` / `ดึงความจำ` - โหลดความจำ Oracle (ψ files + Supabase)

---

## API Endpoints

### Local Agent
```
GET  /api/local-agent/status
POST /api/local-agent/shell
POST /api/local-agent/file
POST /api/local-agent/claude-code
POST /api/local-agent/workflow
POST /api/local-agent/open-terminal
```

### Workflow
```
POST /api/workflow/status    (callback from script)
POST /api/workflow/complete  (callback when done)
GET  /api/workflow/:id
GET  /api/workflows
```

### Ideas
```
GET  /api/ideas/status
GET  /api/ideas
POST /api/ideas/think
POST /api/ideas/execute/:name
```

### API Hunter
```
GET  /api/hunt/status
GET  /api/hunt/discoveries
POST /api/hunt/now
GET  /api/hunt/search?q=xxx
POST /api/hunt/test
POST /api/hunt/analyze
```

---

## Lessons Learned

1. **ใช้ AI แทน regex** - คนพิมพ์ผิดบ่อย, AI เข้าใจ context
2. **Validate ด้วย AI** - ไม่ใช่แค่ดู exit code
3. **WebSocket ดีกว่า HTTP polling** - real-time, less overhead
4. **Security layers สำคัญ** - whitelist + blacklist + path restriction
5. **Projects folder แยก** - ไม่ปนกับ Oracle codebase

---

## Files Changed (2026-02-05)

| File | Type | Description |
|------|------|-------------|
| `local-agent.js` | Modified | เพิ่ม workflow, open_terminal, ideas, api hunter |
| `lib/local-agent-server.js` | Modified | เพิ่ม executeWorkflow, openTerminal |
| `lib/local-security.js` | Modified | เพิ่ม open, osascript, projects path |
| `lib/workflow-executor.js` | **NEW** | สร้าง workflow scripts |
| `lib/autonomous-ideas.js` | **NEW** | Idea generation engine |
| `lib/api-hunter.js` | **NEW** | API discovery & testing |
| `server.js` | Modified | AI intent, validators, crons, endpoints |
| `config.json` | Modified | version 5.18.0 |

---

*Knowledge documented by Oracle - 2026-02-05*
