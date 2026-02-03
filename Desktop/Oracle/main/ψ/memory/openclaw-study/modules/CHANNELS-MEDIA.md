# Channels & Media - สรุปจาก OpenClaw

> **สถานะ:** ✅ Implement แล้ว
> **ไฟล์ที่อ่าน:** ~15 files ใน `src/channels/`, `src/media/`
> **Patterns หลัก:** Chat Type Normalization, Command Gating, Media Parsing, MIME Detection

## สรุปเข้าใจง่าย

**Channels** = normalize ข้อมูลจากหลาย platforms ให้เหมือนกัน
**Media** = จัดการไฟล์ media (รูป, เสียง, วิดีโอ)

## 1. Chat Type Normalization

### ประเภท Chat

| Type | ตัวอย่าง | Aliases |
|------|---------|---------|
| `direct` | DM 1:1 | dm, private |
| `group` | Group chat | - |
| `channel` | Public channel | public |

### วิธีใช้

```javascript
import { normalizeChatType, isDirect, isGroup } from './lib/channels.js';

normalizeChatType('dm');      // 'direct'
normalizeChatType('DM');      // 'direct'
normalizeChatType('group');   // 'group'

isDirect('dm');  // true
isGroup('group'); // true
```

## 2. Sender Label Resolution

### Priority Order

```
name > username > tag > e164 > id
```

### วิธีใช้

```javascript
import { resolveSenderLabel } from './lib/channels.js';

resolveSenderLabel({
  name: 'Tars',
  id: 'U123'
});
// 'Tars (U123)'

resolveSenderLabel({
  username: '@tars',
  id: 'U123'
});
// '@tars (U123)'
```

## 3. Command Gating (Authorization)

### หลักการ

```
ถ้า useAccessGroups = true:
  → ต้องมี authorizer อย่างน้อย 1 ตัวที่ configured && allowed

ถ้า useAccessGroups = false:
  → ใช้ fallback mode (allow / deny / configured)
```

### วิธีใช้

```javascript
import { isCommandAllowed, createUserAuthorizer } from './lib/channels.js';

// สร้าง authorizer
const auth = createUserAuthorizer('U123', ['U123', 'U456']);
// auth = { configured: true, allowed: true }

// เช็คสิทธิ์
const allowed = isCommandAllowed({
  useAccessGroups: true,
  authorizers: [auth]
});
// allowed = true
```

## 4. Ack Reactions (Scope-based)

### Scopes

| Scope | ตอบ DM? | ตอบ Group? |
|-------|---------|-----------|
| `all` | ✅ | ✅ |
| `direct` | ✅ | ❌ |
| `group-all` | ❌ | ✅ |
| `group-mentions` | ✅ | ถ้า mention |
| `off` | ❌ | ❌ |

### วิธีใช้

```javascript
import { shouldSendAck } from './lib/channels.js';

shouldSendAck({
  scope: 'group-mentions',
  chatType: 'group',
  wasMentioned: true
});
// true

shouldSendAck({
  scope: 'group-mentions',
  chatType: 'group',
  wasMentioned: false
});
// false
```

## 5. Media Token Parsing

### Format

```
MEDIA: https://example.com/image.png
MEDIA: ./local/file.jpg
[[audio_as_voice]]
```

### วิธีใช้

```javascript
import { parseMediaTokens } from './lib/media.js';

const result = parseMediaTokens(`
  สวัสดี MEDIA: https://example.com/pic.jpg
  [[audio_as_voice]]
`);

// result = {
//   mediaUrls: ['https://example.com/pic.jpg'],
//   audioAsVoice: true,
//   cleanText: 'สวัสดี'
// }
```

## 6. MIME Type Detection

### Priority

```
1. Buffer sniff (magic bytes) ← สูงสุด
2. File extension
3. Content-Type header
4. Default: application/octet-stream
```

### วิธีใช้

```javascript
import { detectMime, detectMimeFromExtension } from './lib/media.js';

// จาก extension
detectMimeFromExtension('photo.jpg');  // 'image/jpeg'

// จากหลาย sources
detectMime({
  buffer: fileBuffer,
  filename: 'photo.jpg',
  contentType: 'image/jpeg'
});
```

## 7. Filename Sanitization

### วิธีใช้

```javascript
import { sanitizeFilename, generateStorageFilename } from './lib/media.js';

sanitizeFilename('my<file>.txt');     // 'my_file_.txt'
sanitizeFilename('../../secret.txt'); // 'secret.txt'

generateStorageFilename('photo.jpg');
// 'photo---a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg'
```

## 8. Media Storage

### วิธีใช้

```javascript
import { storeMedia, cleanOldMedia, getMediaStorageDir } from './lib/media.js';

// เก็บไฟล์
const filepath = storeMedia(buffer, 'photo.jpg', 'inbound');
// ~/.oracle/media/inbound/photo---uuid.jpg

// ลบไฟล์เก่า (default 2 นาที)
cleanOldMedia();

// หา directory
const dir = getMediaStorageDir();
// ~/.oracle/media/
```

## ไฟล์ที่ Implement

| ไฟล์ | หน้าที่ |
|------|--------|
| `lib/channels.js` | Chat types, Sender labels, Command gating, Ack |
| `lib/media.js` | Media parsing, MIME, Storage |

## Security Notes

1. **Path Traversal Protection** - ไม่อนุญาต `../`
2. **File Permissions** - 0o600 (user only)
3. **Filename Sanitization** - ลบ unsafe chars

---
*สรุป: 2026-02-03*
