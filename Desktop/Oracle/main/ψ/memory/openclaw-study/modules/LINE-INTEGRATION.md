# OpenClaw LINE Integration - Deep Dive

> ศึกษาวิธีที่ OpenClaw ทำ LINE integration
> Status: ✅ Core patterns understood
> Location: `extensions/line/`

## 1. Architecture Overview

```
extensions/line/
├── index.ts              ← Plugin registration
├── src/
│   ├── channel.ts        ← Main LINE plugin (780+ lines) ⭐
│   ├── runtime.ts        ← Runtime singleton
│   └── card-command.ts   ← /card command for rich messages
```

## 2. Plugin System Pattern

OpenClaw ใช้ **Plugin Architecture** - LINE เป็น extension ไม่ใช่ core

```typescript
// index.ts - Registration pattern
const plugin = {
  id: "line",
  name: "LINE",
  description: "LINE Messaging API channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setLineRuntime(api.runtime);
    api.registerChannel({ plugin: linePlugin });
    registerLineCardCommand(api);
  },
};
```

**Key Insight:** Plugin ได้รับ `runtime` จาก core → เก็บไว้ใน module-level variable

## 3. ChannelPlugin Interface

LINE implement `ChannelPlugin<ResolvedLineAccount>` - interface มาตรฐานสำหรับทุก channel

### 3.1 Metadata
```typescript
const meta = {
  id: "line",
  label: "LINE",
  selectionLabel: "LINE (Messaging API)",
  detailLabel: "LINE Bot",
  docsPath: "/channels/line",
  blurb: "LINE Messaging API bot for Japan/Taiwan/Thailand markets.",
  systemImage: "message.fill",
};
```

### 3.2 Capabilities
```typescript
capabilities: {
  chatTypes: ["direct", "group"],
  reactions: false,         // LINE ไม่รองรับ
  threads: false,           // LINE ไม่รองรับ
  media: true,              // รองรับ images, stickers
  nativeCommands: false,
  blockStreaming: true,     // 🔥 KEY: ส่งทั้ง message ไม่ stream
},
```

### 3.3 Pairing System
```typescript
pairing: {
  idLabel: "lineUserId",
  normalizeAllowEntry: (entry) => {
    // LINE IDs case-sensitive - strip prefix only
    return entry.replace(/^line:(?:user:)?/i, "");
  },
  notifyApproval: async ({ cfg, id }) => {
    // ส่ง notification เมื่อ approve user
    await line.pushMessageLine(id, "OpenClaw: your access has been approved.", { ... });
  },
},
```

## 4. Multi-Account Support

OpenClaw รองรับหลาย LINE accounts พร้อมกัน!

```typescript
config: {
  // List all configured accounts
  listAccountIds: (cfg) => getLineRuntime().channel.line.listLineAccountIds(cfg),

  // Resolve specific account
  resolveAccount: (cfg, accountId) =>
    getLineRuntime().channel.line.resolveLineAccount({ cfg, accountId }),

  // Default account fallback
  defaultAccountId: (cfg) => getLineRuntime().channel.line.resolveDefaultLineAccountId(cfg),

  // Enable/disable per account
  setAccountEnabled: ({ cfg, accountId, enabled }) => { ... },

  // Delete account config
  deleteAccount: ({ cfg, accountId }) => { ... },
}
```

**Config Structure:**
```yaml
channels:
  line:
    enabled: true
    channelAccessToken: "xxx"  # Default account
    channelSecret: "yyy"
    accounts:                   # Multiple accounts
      hotel:
        channelAccessToken: "aaa"
        channelSecret: "bbb"
      personal:
        channelAccessToken: "ccc"
        channelSecret: "ddd"
```

## 5. Security Policies

### 5.1 DM Policy
```typescript
security: {
  resolveDmPolicy: ({ cfg, accountId, account }) => {
    return {
      policy: account.config.dmPolicy ?? "pairing",  // pairing, allow, deny
      allowFrom: account.config.allowFrom ?? [],
      policyPath: `channels.line.dmPolicy`,
      allowFromPath: basePath,
      approveHint: "openclaw pairing approve line <code>",
      normalizeEntry: (raw) => raw.replace(/^line:(?:user:)?/i, ""),
    };
  },
}
```

### 5.2 Group Policy
```typescript
groups: {
  resolveRequireMention: ({ cfg, accountId, groupId }) => {
    // ต้อง @ mention ใน group ไหม
    const groups = account.config.groups;
    const groupConfig = groups[groupId] ?? groups["*"];
    return groupConfig?.requireMention ?? false;
  },
}
```

## 6. Messaging System

### 6.1 Target Resolution
```typescript
messaging: {
  normalizeTarget: (target) => {
    // ลบ prefix: "line:user:Uxxxx" → "Uxxxx"
    return trimmed.replace(/^line:(group|room|user):/i, "").replace(/^line:/i, "");
  },
  targetResolver: {
    looksLikeId: (id) => {
      // LINE ID patterns:
      // User: U + 32 hex
      // Group: C + 32 hex
      // Room: R + 32 hex
      return /^[UCR][a-f0-9]{32}$/i.test(trimmed);
    },
    hint: "<userId|groupId|roomId>",
  },
},
```

### 6.2 Outbound Messages (sendPayload)

🔥 **นี่คือหัวใจของ LINE integration:**

```typescript
outbound: {
  deliveryMode: "direct",
  textChunkLimit: 5000,  // LINE allows 5000 chars/message

  sendPayload: async ({ to, payload, accountId, cfg }) => {
    // 1. Process markdown → extract tables/code blocks
    const processed = processLineMessage(payload.text);

    // 2. Chunk text if too long
    const chunks = runtime.channel.text.chunkMarkdownText(processed.text, chunkLimit);

    // 3. Send Flex messages (rich cards)
    if (lineData.flexMessage) {
      await sendFlex(to, lineData.flexMessage.altText, lineData.flexMessage.contents, { ... });
    }

    // 4. Send Template messages (confirm, buttons)
    if (lineData.templateMessage) {
      await sendTemplate(to, template, { ... });
    }

    // 5. Send Location
    if (lineData.location) {
      await sendLocation(to, lineData.location, { ... });
    }

    // 6. Send text chunks with quick replies on last
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      if (isLast && hasQuickReplies) {
        await sendQuickReplies(to, chunks[i], quickReplies, { ... });
      } else {
        await sendText(to, chunks[i], { ... });
      }
    }

    // 7. Send media (images)
    for (const url of mediaUrls) {
      await runtime.channel.line.sendMessageLine(to, "", { mediaUrl: url, ... });
    }
  },
}
```

**Key Patterns:**
1. **processLineMessage** - แปลง markdown tables/code → Flex messages
2. **Chunking** - แบ่ง text ยาวๆ เป็น multiple messages
3. **Quick Replies** - ใส่ใน message สุดท้ายเท่านั้น
4. **Batch Sending** - ส่งได้ max 5 messages/batch

## 7. Gateway Integration

```typescript
gateway: {
  startAccount: async (ctx) => {
    // Probe bot info
    const probe = await getLineRuntime().channel.line.probeLineBot(token, 2500);

    ctx.log?.info(`[${account.accountId}] starting LINE provider`);

    // Start webhook monitoring
    return getLineRuntime().channel.line.monitorLineProvider({
      channelAccessToken: token,
      channelSecret: secret,
      accountId: account.accountId,
      config: ctx.cfg,
      runtime: ctx.runtime,
      abortSignal: ctx.abortSignal,
      webhookPath: account.config.webhookPath,
    });
  },

  logoutAccount: async ({ accountId, cfg }) => {
    // Clear credentials from config
    // ...complex cleanup logic...
    return { cleared, envToken: Boolean(envToken), loggedOut };
  },
}
```

## 8. Rich Card System (/card command)

OpenClaw มี command `/card` สำหรับสร้าง rich messages

### Card Types
```
/card info "Title" "Body" ["Footer"]
/card image "Title" "Caption" --url <image-url>
/card action "Title" "Body" --actions "Btn1|url1,Btn2|text2"
/card list "Title" "Item1|Desc1,Item2|Desc2"
/card receipt "Title" "Item1:$10,Item2:$20" --total "$30"
/card confirm "Question?" --yes "Yes|data" --no "No|data"
/card buttons "Title" "Text" --actions "Btn1|url1,Btn2|data2"
```

### Action Parsing Logic
```typescript
function parseActions(actionsStr: string): CardAction[] {
  for (const part of actionsStr.split(",")) {
    const [label, data] = part.split("|");

    if (actionData.startsWith("http")) {
      // → URI action (open URL)
      results.push({ type: "uri", uri: actionData });
    } else if (actionData.includes("=")) {
      // → Postback action (key=value)
      results.push({ type: "postback", data: actionData });
    } else {
      // → Message action (send text)
      results.push({ type: "message", text: actionData });
    }
  }
}
```

## 9. Agent Prompt Integration

AI ได้รับ hints สำหรับ LINE rich messages:

```typescript
agentPrompt: {
  messageToolHints: () => [
    "### LINE Rich Messages",
    "**Quick Replies**: [[quick_replies: Option 1, Option 2, Option 3]]",
    "**Location**: [[location: Place Name | Address | lat | lng]]",
    "**Confirm Dialog**: [[confirm: Question? | Yes | No]]",
    "**Button Menu**: [[buttons: Title | Desc | Btn1:action1, Btn2:url]]",
    "**Media Player Card**: [[media_player: Song | Artist | Source | url | status]]",
    "**Event Card**: [[event: Title | Date | Time | Location | Description]]",
    "**Agenda Card**: [[agenda: Title | Event1:9:00 AM, Event2:12:00 PM]]",
    "**Device Control**: [[device: Name | Type | Status | Control1:data1]]",
    "**Apple TV Remote**: [[appletv_remote: Apple TV | Playing]]",
    "Tables/code auto-convert to visual cards",
  ],
}
```

**🔥 AI ใช้ directive syntax:** `[[quick_replies: ...]]` ใน response → parser แปลงเป็น LINE Flex

## 10. Key Insights for Oracle

### What to Copy
1. **Multi-account support** - Oracle รองรับแค่ 1 account
2. **Rich message directives** - `[[quick_replies: ...]]` syntax สะดวกมาก
3. **Markdown → Flex conversion** - Tables/code blocks auto-convert
4. **Chunking strategy** - 5000 chars limit, quick replies on last chunk
5. **Security policies** - pairing system, allowlist, group require mention

### What Oracle Has Better
1. **Simpler setup** - ไม่ต้อง config file complex
2. **Tars-specific** - customize ได้มากกว่า

### Implementation Priority
1. `[[quick_replies: ...]]` directive - ใช้บ่อย
2. Auto-convert tables → Flex cards
3. Multi-account (ถ้าต้องการ)

---
*Analyzed: 2026-02-03*
*Files: channel.ts (780 lines), card-command.ts (344 lines), runtime.ts (14 lines)*
