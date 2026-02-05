# Oracle Memory MCP Server

MCP Server สำหรับ Claude Code - ให้ Claude Code เข้าถึง Oracle's Unified Memory

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Claude Code

Add to `~/.claude/mcp_servers.json`:

```json
{
  "oracle-memory": {
    "command": "node",
    "args": ["/Users/tanakitchaithip/Desktop/Oracle/main/tools/oracle-agent/mcp-server/index.js"],
    "env": {
      "ORACLE_API_URL": "https://oracle-agent-production.up.railway.app/api/memory",
      "ORACLE_API_KEY": "your-api-key-here"
    }
  }
}
```

### 3. Restart Claude Code

## Available Tools

| Tool | Description |
|------|-------------|
| `oracle_remember` | บันทึกข้อมูลลง memory |
| `oracle_recall` | ค้นหา memory แบบ semantic |
| `oracle_context` | ดึง context ทั้งหมด |
| `oracle_learn` | บันทึก mistake หรือ lesson |
| `oracle_self_model` | ดู Oracle's self-model |

## Examples

### Remember something
```
oracle_remember({
  content: "Tars ชอบให้ทำเลยไม่ต้องถาม",
  type: "preference",
  importance: 0.9
})
```

### Search memories
```
oracle_recall({
  query: "Beds24 authentication",
  limit: 5
})
```

### Get full context
```
oracle_context({
  user_id: "tars"
})
```

### Record a lesson
```
oracle_learn({
  type: "mistake",
  category: "assumption",
  description: "คิดเอาเองว่า feature มีอยู่แล้ว",
  lesson: "เช็คโค้ดจริงก่อนพูดเสมอ"
})
```

## Architecture

```
Claude Code → MCP Server → Memory API → PostgreSQL
                              ↓
                        Oracle Agent (LINE)
```

**Single Brain** - ทั้ง Claude Code และ Oracle LINE ใช้ memory เดียวกัน!
