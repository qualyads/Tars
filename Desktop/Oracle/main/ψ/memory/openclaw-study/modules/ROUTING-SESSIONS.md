# Routing & Sessions - สรุปจาก OpenClaw

> **สถานะ:** ✅ Implement แล้ว
> **ไฟล์ที่อ่าน:** ~10 files ใน `src/routing/`, `src/sessions/`
> **Patterns หลัก:** Route Resolution, Session Keys, Send Policy, Model Override

## สรุปเข้าใจง่าย

Routing = **ส่งข้อความไปถูกคน** (agent)
Sessions = **จำได้ว่าคุยกับใคร** + ตั้งค่าต่อคน

## 1. Message Routing

### ลำดับการหา Agent (Priority)

```
1. peer         → ถ้า DM/Group ตรงกับ binding
2. parent peer  → ถ้าอยู่ใน thread และ parent ตรง
3. guildId      → ถ้า Discord server ตรง
4. teamId       → ถ้า Slack workspace ตรง
5. accountId    → ถ้า account ตรง (ไม่ใช่ *)
6. channel      → ถ้า channel ตรง และ account = *
7. default      → ไม่มีอะไรตรง ใช้ default agent
```

### วิธีใช้

```javascript
import { resolveRoute, createBinding } from './lib/routing.js';

// สร้าง bindings
const bindings = [
  createBinding({
    agentId: 'hotel-agent',
    channel: 'line',
    accountId: 'hotel-account'
  }),
  createBinding({
    agentId: 'personal-agent',
    channel: 'line',
    accountId: '*'  // wildcard = ทุก account
  })
];

// Resolve route
const route = resolveRoute({
  bindings,
  channel: 'line',
  accountId: 'hotel-account',
  peer: { kind: 'dm', id: 'U123' }
});

// route = { agentId: 'hotel-agent', matchedBy: 'binding.accountId' }
```

## 2. Session Key Format

### รูปแบบ

```
agent:<agent-id>:<scope>
```

### ตัวอย่าง

| Scope | Session Key | ใช้เมื่อ |
|-------|------------|---------|
| main | `agent:main:main` | DM รวมทุกคน |
| per-peer | `agent:main:dm:U123` | DM แยกต่อคน |
| per-channel-peer | `agent:main:line:dm:U123` | แยก channel + คน |
| group | `agent:main:line:group:G456` | Group chat |
| thread | `agent:main:line:group:G456:thread:T789` | Thread |

### วิธีใช้

```javascript
import { generateSessionKey, parseSessionKey } from './lib/routing.js';

// สร้าง session key
const key = generateSessionKey({
  agentId: 'main',
  channel: 'line',
  peer: { kind: 'dm', id: 'U123' },
  dmScope: 'per-peer'
});
// key = 'agent:main:dm:U123'

// Parse กลับ
const parsed = parseSessionKey(key);
// parsed = { agentId: 'main', scope: 'dm', peerId: 'U123' }
```

## 3. Send Policy (อนุญาต/ปฏิเสธ)

### หลักการ

```
1. เช็ค session entry override ก่อน
2. ถ้าไม่มี → เช็ค rules
3. ถ้าไม่ match → ใช้ default (allow)
```

### ตัวอย่าง Config

```javascript
const policyConfig = {
  default: 'allow',
  rules: [
    {
      match: { channel: 'slack', chatType: 'group' },
      action: 'deny'  // ไม่ให้ส่งไป Slack groups
    },
    {
      match: { keyPrefix: 'agent:restricted:' },
      action: 'deny'  // ไม่ให้ส่งถ้า agent restricted
    }
  ]
};
```

### วิธีใช้

```javascript
import { resolveSendPolicy, setSessionSendPolicy } from './lib/session-manager.js';

// Resolve policy
const policy = resolveSendPolicy(
  'agent:main:line:dm:U123',
  { channel: 'line', chatType: 'dm' },
  policyConfig
);
// policy = 'allow'

// Override per session
setSessionSendPolicy('agent:main:line:dm:U123', 'deny');
```

## 4. Model Override (เปลี่ยน model ต่อ session)

### วิธีใช้

```javascript
import { setModelOverride, getModelOverride } from './lib/session-manager.js';

// Set override
setModelOverride('agent:main:main', {
  provider: 'anthropic',
  model: 'claude-opus-4-5'
});

// Get override
const override = getModelOverride('agent:main:main');
// override = { provider: 'anthropic', model: 'claude-opus-4-5' }

// Clear override
setModelOverride('agent:main:main', { isDefault: true });
```

## 5. Session Labels

### วิธีใช้

```javascript
import { setSessionLabel, getSessionLabel } from './lib/session-manager.js';

// Set label (max 64 chars)
setSessionLabel('agent:main:line:dm:U123', 'VIP Customer');

// Get label
const label = getSessionLabel('agent:main:line:dm:U123');
// label = 'VIP Customer'
```

## 6. Verbose Level

### วิธีใช้

```javascript
import { setVerboseLevel, getVerboseLevel } from './lib/session-manager.js';

// Set verbose
setVerboseLevel('agent:main:main', 'on');

// Get
const level = getVerboseLevel('agent:main:main');
// level = 'on'
```

## ไฟล์ที่ Implement

| ไฟล์ | หน้าที่ |
|------|--------|
| `lib/routing.js` | Route resolution, Session keys |
| `lib/session-manager.js` | Session store, Policies, Overrides |

## Flow รวม

```
ข้อความเข้ามา
    ↓
resolveRoute() → หา agent
    ↓
generateSessionKey() → สร้าง key
    ↓
resolveSendPolicy() → allow/deny?
    ↓
getModelOverride() → ใช้ model ไหน?
    ↓
ประมวลผล + ตอบกลับ
```

---
*สรุป: 2026-02-03*
