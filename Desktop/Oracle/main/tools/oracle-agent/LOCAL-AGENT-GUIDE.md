# Oracle Local Agent v2.0

**Remote Execution System** - สั่งงานจาก LINE/Telegram แล้ว Oracle ไปทำงานบนเครื่อง Mac ได้!

---

## Architecture

```
┌─────────────┐      ┌────────────────────┐      ┌──────────────────────┐
│    LINE     │─────▶│  Oracle (Railway)  │─────▶│  Local Agent (Mac)   │
│  Telegram   │      │  - Receive message │      │  - Execute commands  │
└─────────────┘      │  - Parse intent    │ WS   │  - File operations   │
                     │  - Send to agent   │      │  - Claude Code       │
                     └────────────────────┘      └──────────────────────┘
```

---

## Quick Start

### 1. ติดตั้ง dependencies (ครั้งเดียว)

```bash
cd /Users/tanakitchaithip/Desktop/Oracle/main/tools/oracle-agent
npm install
```

### 2. รัน Local Agent บน Mac

```bash
node local-agent.js
```

Output:
```
========================================
  Oracle Local Agent v2.0
========================================
Agent ID: mac-Tarss-MacBook-Pro
Agent Name: Tars Mac
Oracle URL: wss://oracle-agent-production-546e.up.railway.app/ws/local-agent
Work Dir: /Users/tanakitchaithip/Desktop/Oracle
========================================

Security Status:
  Allowed Commands: 35
  Blocked Commands: 16
  Allowed Paths: /Users/tanakitchaithip/Desktop, /Users/tanakitchaithip/Documents, ...

[SUCCESS] Connected to Oracle!
```

### 3. ทดสอบจาก LINE

พิมพ์:
- "สร้างโฟลเดอร์ test ใน Desktop"
- "ดูไฟล์ใน Desktop"
- "git status"

---

## Security Layers

### 1. Command Whitelist

เฉพาะคำสั่งที่อนุญาตเท่านั้น:

| Category | Commands |
|----------|----------|
| File | ls, cat, head, tail, find, grep, mkdir, touch, cp, mv |
| Git | git (all subcommands) |
| Dev | node, npm, npx, pnpm, python, cargo, go |
| AI | claude (Claude Code) |
| System (read-only) | pwd, whoami, date, uptime |

### 2. Blocked Commands

คำสั่งที่ **ห้าม** ทั้งหมด:
- `sudo`, `su` - ห้ามใช้ root
- `rm`, `rmdir` - ลบไฟล์ต้อง approve ก่อน
- `chmod`, `chown` - ห้ามเปลี่ยน permission
- `kill`, `killall` - ห้าม kill process
- `shutdown`, `reboot` - ห้าม shutdown

### 3. Dangerous Pattern Detection

ตรวจจับ pattern อันตราย:
- `rm -rf /` - ลบทุกอย่าง
- `curl | bash` - execute จาก internet
- `> /dev/sda` - เขียนทับ disk
- Fork bombs

### 4. Path Restriction

ทำงานได้เฉพาะใน:
- `/Users/tanakitchaithip/Desktop`
- `/Users/tanakitchaithip/Documents`
- `/Users/tanakitchaithip/Downloads`
- `/Users/tanakitchaithip/projects`
- `/tmp`

### 5. Approval Flow

คำสั่งเหล่านี้ต้องขอ approve ก่อน:
- `rm` - ลบไฟล์
- `git push` - push to remote
- `git reset` - reset changes
- `npm publish` - publish package
- `railway up` - deploy
- `mv` - move (อาจ overwrite)

---

## Features

### Shell Commands

```
LINE: "สร้างโฟลเดอร์ my-project ใน Desktop"
→ mkdir ~/Desktop/my-project

LINE: "ดูไฟล์ใน Desktop"
→ ls ~/Desktop

LINE: "git status ของ Oracle"
→ git status (ใน work directory)
```

### File Operations

```
LINE: "อ่านไฟล์ config.json"
→ อ่านและแสดงเนื้อหา

LINE: "เขียนไฟล์ test.txt ว่า Hello World"
→ สร้างไฟล์พร้อมเนื้อหา
```

### Claude Code Integration

```
LINE: "ให้ Claude Code แก้ bug ใน server.js"
→ claude -p "แก้ bug ใน server.js" --yes

LINE: "ให้ Claude Code สร้าง API endpoint ใหม่"
→ รัน Claude Code แล้วรายงานผล
```

---

## API Endpoints (Railway)

### Status

```bash
curl https://oracle-agent-production-546e.up.railway.app/api/local-agent/status
```

Response:
```json
{
  "initialized": true,
  "connectedAgents": 1,
  "agents": [{
    "id": "mac-Tarss-MacBook-Pro",
    "name": "Tars Mac",
    "connected": true,
    "capabilities": ["shell", "file", "claude_code"]
  }]
}
```

### Execute Shell

```bash
curl -X POST https://oracle-agent-production-546e.up.railway.app/api/local-agent/shell \
  -H "Content-Type: application/json" \
  -d '{"command": "ls ~/Desktop"}'
```

### Execute Claude Code

```bash
curl -X POST https://oracle-agent-production-546e.up.railway.app/api/local-agent/claude-code \
  -H "Content-Type: application/json" \
  -d '{"prompt": "สร้าง hello world function"}'
```

### File Operations

```bash
# Read file
curl -X POST https://oracle-agent-production-546e.up.railway.app/api/local-agent/file \
  -H "Content-Type: application/json" \
  -d '{"operation": "read", "filePath": "/Users/tanakitchaithip/Desktop/test.txt"}'

# Write file
curl -X POST https://oracle-agent-production-546e.up.railway.app/api/local-agent/file \
  -H "Content-Type: application/json" \
  -d '{"operation": "write", "filePath": "/Users/tanakitchaithip/Desktop/test.txt", "content": "Hello!"}'

# Create directory
curl -X POST https://oracle-agent-production-546e.up.railway.app/api/local-agent/file \
  -H "Content-Type: application/json" \
  -d '{"operation": "mkdir", "filePath": "/Users/tanakitchaithip/Desktop/new-folder"}'
```

---

## Advanced: Cloudflare Tunnel (Optional)

สำหรับ secure connection ผ่าน Cloudflare:

### Quick Start (ไม่ต้อง domain)

```bash
# ติดตั้ง cloudflared
./setup-tunnel.sh install

# รัน quick tunnel (ได้ URL ชั่วคราว)
./setup-tunnel.sh quick
```

### Full Setup (มี domain)

```bash
./setup-tunnel.sh install
./setup-tunnel.sh login
./setup-tunnel.sh create
./setup-tunnel.sh run
```

---

## Run as Background Service

### Option 1: tmux/screen

```bash
tmux new -s oracle-agent
node local-agent.js
# Press Ctrl+B, D to detach
```

### Option 2: launchd (macOS)

สร้างไฟล์ `~/Library/LaunchAgents/com.oracle.local-agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.oracle.local-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/tanakitchaithip/Desktop/Oracle/main/tools/oracle-agent/local-agent.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/oracle-local-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/oracle-local-agent.error.log</string>
</dict>
</plist>
```

Commands:
```bash
# Load
launchctl load ~/Library/LaunchAgents/com.oracle.local-agent.plist

# Unload
launchctl unload ~/Library/LaunchAgents/com.oracle.local-agent.plist

# Check status
launchctl list | grep oracle
```

---

## Troubleshooting

### Agent ไม่ connect

1. ตรวจสอบว่า Railway deploy ล่าสุด (version 5.15.0+)
2. ตรวจสอบ network - Mac ต้อง access internet ได้
3. ดู log: `tail -f data/local-agent.log`

### Command ถูก block

1. ดู error message ว่า block เพราะอะไร
2. ถ้าต้องการ command ที่ถูก block จริงๆ → แก้ไข `lib/local-security.js`

### Approval required

1. บาง command ต้องขอ approve ก่อน (rm, git push, etc.)
2. Oracle จะถาม confirm ใน LINE
3. ตอบ "อนุมัติ" หรือ "ไม่อนุมัติ"

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ORACLE_WS_URL` | wss://oracle-agent-production-546e.up.railway.app/ws/local-agent | WebSocket URL |
| `LOCAL_AGENT_KEY` | oracle-local-agent-2026 | API Key |
| `AGENT_ID` | mac-{hostname} | Agent identifier |
| `AGENT_NAME` | Tars Mac | Display name |
| `WORK_DIR` | ~/Desktop/Oracle | Working directory |
| `COMMAND_TIMEOUT` | 60000 | Command timeout (ms) |

---

## Version History

- **v2.0.0** (2026-02-05)
  - WebSocket connection (realtime)
  - Security layers (whitelist, blacklist, patterns)
  - Path restriction
  - Approval flow
  - Claude Code integration
  - File operations

- **v1.0.0** (2026-02-04)
  - HTTP polling version
  - Basic shell execution

---

*Oracle Local Agent v2.0 - Remote Execution System*
*พลังมหาศาล ใช้อย่างระวัง!*
