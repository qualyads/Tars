# Config System - สรุปจาก OpenClaw

> **สถานะ:** ✅ Implement แล้ว
> **ไฟล์ที่อ่าน:** ~15 files ใน `src/config/`
> **Patterns หลัก:** Config Loading, Defaults, Validation, Environment Substitution

## สรุปเข้าใจง่าย

Config System คือระบบจัดการ **ค่าตั้งค่าทั้งหมด** ของ Oracle ได้แก่:
- API keys
- Model settings
- LINE accounts
- Autonomy levels
- และอื่นๆ

### ก่อน vs หลัง

| ก่อน | หลัง |
|------|------|
| Hardcode ในโค้ด | อ่านจากไฟล์ config |
| แก้โค้ดทุกครั้ง | แก้ไฟล์ JSON |
| ไม่มี defaults | มี defaults ครบ |
| API keys ใส่ตรงๆ | `${VAR}` แทน |

## หลักการทำงาน

```
                    ┌─────────────────┐
                    │  oracle-config  │
                    │     .json       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Config Loader  │
                    │  1. Path resolve│
                    │  2. $include    │
                    │  3. ${VAR}      │
                    │  4. Validate    │
                    │  5. Defaults    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Final Config   │
                    │  (พร้อมใช้งาน)  │
                    └─────────────────┘
```

## Features หลัก

### 1. Path Resolution (หา config จากหลายที่)

ลำดับการหา:
1. `ORACLE_CONFIG_PATH` (env var)
2. `./oracle-config.json` (workspace)
3. `~/.oracle/oracle-config.json` (home)
4. `~/.oracle-agent/oracle-config.json` (legacy)

### 2. Environment Variable Substitution

```json
{
  "api": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

### 3. $include Directive (รวมหลายไฟล์)

```json
{
  "$include": ["./base.json", "./secrets.json"],
  "name": "Oracle"
}
```

### 4. Multi-layer Defaults

```javascript
// Non-mutating chain
applyAllDefaults(config)
  → applyModelDefaults
  → applyAgentDefaults
  → applySessionDefaults
  → applyHeartbeatDefaults
  → applyLineDefaults
  → applyAutonomyDefaults
```

### 5. Config Caching (200ms)

ไม่โหลดซ้ำทุกครั้ง → เร็วขึ้น

### 6. Config Backup (5 versions)

ก่อน save → backup อัตโนมัติ

## ตัวอย่าง Config

```json
{
  "model": {
    "primary": "sonnet",
    "fallback": "haiku"
  },
  "autonomy": {
    "enabled": true,
    "levels": {
      "personal": "high",
      "hotel": "medium"
    }
  },
  "heartbeat": {
    "every": "30m",
    "morningBriefing": "07:00"
  }
}
```

## วิธีใช้งาน

```javascript
import { loadConfig, saveConfig, createDefaultConfig } from './lib/index.js';

// โหลด config
const config = loadConfig();

// สร้าง config ใหม่พร้อม defaults
const newConfig = createDefaultConfig({
  model: { primary: 'opus' }
});

// Save config
saveConfig(config);
```

## Model Aliases

| Alias | Full Model ID |
|-------|---------------|
| `opus` | claude-opus-4-5-20251101 |
| `sonnet` | claude-sonnet-4-5-20250514 |
| `haiku` | claude-3-5-haiku-20241022 |
| `gpt` | gpt-4o |

## ไฟล์ที่ Implement

| ไฟล์ | หน้าที่ |
|------|--------|
| `lib/config-loader.js` | โหลด, Save, Validate |
| `lib/config-defaults.js` | Default values, Aliases |
| `oracle-config.example.json` | ตัวอย่าง config |

---
*สรุป: 2026-02-03*
