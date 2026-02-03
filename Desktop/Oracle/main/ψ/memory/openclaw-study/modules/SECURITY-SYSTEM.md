# Security System - สรุปจาก OpenClaw

> **สถานะ:** ✅ Implement แล้ว
> **ไฟล์ที่อ่าน:** ~5 files ใน `src/security/`
> **Patterns หลัก:** Audit, Injection Protection, Permission Checks

## สรุปเข้าใจง่าย

Security System = **ป้องกัน Oracle จากการโจมตี**:
- ตรวจจับ prompt injection
- ตรวจสอบ permissions
- ป้องกัน path traversal
- Wrap external content

## 1. Suspicious Pattern Detection

### Patterns ที่ตรวจจับ

```javascript
// Prompt injection attempts
"ignore previous instructions"
"you are now a..."
"system prompt override"
"forget everything"
"<system> tags"
"exec command"
"rm -rf /"
```

### วิธีใช้

```javascript
import { hasSuspiciousContent, detectSuspiciousPatterns } from './lib/security.js';

// เช็คเร็ว
if (hasSuspiciousContent(userMessage)) {
  console.warn('Suspicious content detected!');
}

// เช็คละเอียด
const patterns = detectSuspiciousPatterns(userMessage);
// patterns = [{ pattern: 'ignore.*instructions', match: '...', index: 0 }]
```

## 2. External Content Protection

### หลักการ

```
ข้อความจากภายนอก (email, webhook)
         ↓
  sanitizeMarkers()  ← ลบ Unicode bypass
         ↓
  wrapExternalContent()  ← ใส่ boundary markers
         ↓
[SECURITY NOTICE: ...]
<<<EXTERNAL_UNTRUSTED_CONTENT>>>
Source: email
From: attacker@evil.com
---
(เนื้อหา sanitized)
<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>
```

### วิธีใช้

```javascript
import { wrapExternalContent, unwrapExternalContent } from './lib/security.js';

// Wrap content จาก email
const safe = wrapExternalContent(emailBody, {
  source: 'email',
  from: 'customer@example.com',
  subject: 'สอบถามราคาห้อง'
});

// ส่งให้ AI อย่างปลอดภัย
const response = await ai.chat(safe);

// Unwrap กลับ (ถ้าต้องการ)
const { content, metadata } = unwrapExternalContent(safe);
```

## 3. Permission Checks

### Safe Permissions

| Type | Mode | คือ |
|------|------|-----|
| Directory | `0o700` | user rwx only |
| File | `0o600` | user rw only |

### วิธีใช้

```javascript
import { checkPermissions, fixPermissions, SAFE_PERMISSIONS } from './lib/security.js';

// เช็ค
const result = checkPermissions('/path/to/config.json', SAFE_PERMISSIONS.FILE);
if (!result.ok) {
  console.warn(`Insecure: ${result.reason}`);
}

// แก้ไข
fixPermissions('/path/to/config.json', SAFE_PERMISSIONS.FILE);
```

### สิ่งที่ตรวจจับ

- **Symlinks** - อาจ point ไปที่อื่น
- **World Writable** - ใครก็แก้ได้
- **Group Readable** - คนอื่นอ่านได้

## 4. Security Audit

### วิธีใช้

```javascript
import { runSecurityAudit, formatAuditFindings } from './lib/security.js';

const findings = runSecurityAudit({
  config: myConfig,
  stateDir: '~/.oracle',
  configPath: './oracle-config.json'
});

// แสดงผล
console.log(formatAuditFindings(findings));
```

### ตัวอย่าง Output

```
Security Audit Results:

🔴 [CRITICAL] filesystem
   State directory has insecure permissions: wrong_mode
   Path: /home/user/.oracle

🟡 [WARN] secrets
   Config may contain hardcoded API keys. Use ${ENV_VAR} instead.

🟡 [WARN] auth
   Gateway token is too short (12 chars). Minimum 24 recommended.

Summary: 1 critical, 2 warnings, 0 info
```

### สิ่งที่ตรวจสอบ

| Category | ตรวจอะไร |
|----------|---------|
| filesystem | Permissions ของ state dir, config |
| secrets | Hardcoded API keys |
| auth | Token strength |
| privacy | Logging redaction |
| tools | Elevated tools enabled |

## 5. Path Traversal Prevention

### วิธีใช้

```javascript
import { isPathSafe, sanitizePath } from './lib/security.js';

// เช็คว่าปลอดภัย
const check = isPathSafe('../../../etc/passwd', '/var/data');
// check = { safe: false, reason: 'traversal_attempt' }

// Sanitize
const safe = sanitizePath('../../../etc/passwd');
// safe = 'etc/passwd' (ลบ ..)
```

## ไฟล์ที่ Implement

| ไฟล์ | หน้าที่ |
|------|--------|
| `lib/security.js` | Audit, Protection, Permissions |

## Best Practices

### 1. Wrap ทุก External Content

```javascript
// ❌ ไม่ดี
const response = await ai.chat(emailBody);

// ✅ ดี
const wrapped = wrapExternalContent(emailBody, { source: 'email' });
const response = await ai.chat(wrapped);
```

### 2. Run Audit เมื่อ Startup

```javascript
import { runSecurityAudit, formatAuditFindings } from './lib/security.js';

// ตอน boot
const findings = runSecurityAudit({ config, stateDir, configPath });
if (findings.some(f => f.severity === 'critical')) {
  console.error('CRITICAL SECURITY ISSUES!');
  console.error(formatAuditFindings(findings));
  process.exit(1);
}
```

### 3. Validate User Paths

```javascript
import { isPathSafe } from './lib/security.js';

// ก่อนอ่านไฟล์จาก user input
const check = isPathSafe(userPath, baseDir);
if (!check.safe) {
  throw new Error('Invalid path');
}
fs.readFileSync(check.resolved);
```

---
*สรุป: 2026-02-03*
