# Oracle Agent - Setup Checklist

## สิ่งที่ต้อง Setup เพื่อใช้งาน Features ครบ

---

## ✅ ใช้งานได้เลย (ไม่ต้อง Setup เพิ่ม)

| Feature | Status | หมายเหตุ |
|---------|--------|----------|
| LINE Bot | ✅ Ready | มี token แล้ว |
| Sentiment Analysis | ✅ Ready | Auto ทุกข้อความ |
| Self-Reflection | ✅ Ready | Auto ก่อนส่ง |
| Quality Tracker | ✅ Ready | Auto หลังส่ง |
| Mistake Tracker | ✅ Ready | Auto เช็ค |
| Reminder System | ✅ Ready | Notify via LINE |
| Daily Digest | ✅ Ready | 07:00 + 18:00 |
| Memory Consolidation | ✅ Ready | 00:00 daily |
| Heartbeat | ✅ Ready | ทุก 30 นาที |
| Autonomy Engine | ✅ Ready | Monitoring |
| Model Failover | ✅ Ready | Claude → GPT → Groq |
| Webhook Ingress | ✅ Ready | Beds24, Stripe, GitHub |

---

## ⚠️ ต้อง Setup ก่อนใช้

### 1. Google Calendar
**Status:** Code เสร็จ, ต้องใส่ credentials

**ขั้นตอน:**
1. ไป [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่
3. Enable **Google Calendar API**
4. สร้าง OAuth 2.0 credentials
5. ได้ Client ID และ Client Secret
6. ใช้ OAuth Playground หรือ script เพื่อได้ Refresh Token

**Environment Variables:**
```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx
```

**หรือใส่ใน config.json:**
```json
{
  "google": {
    "clientId": "xxx",
    "clientSecret": "xxx",
    "refreshToken": "xxx"
  }
}
```

**Test:**
```bash
curl http://localhost:3000/api/calendar/status
# ควรได้ { "configured": true, "hasToken": true }
```

---

### 2. Telegram Bot
**Status:** Code เสร็จ, ต้องใส่ bot token

**ขั้นตอน:**
1. คุยกับ [@BotFather](https://t.me/BotFather) บน Telegram
2. พิมพ์ `/newbot`
3. ตั้งชื่อ bot
4. ได้ Bot Token (เช่น `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. หา owner_id โดยคุยกับ [@userinfobot](https://t.me/userinfobot)

**ใส่ใน config.json:**
```json
{
  "telegram": {
    "enabled": true,
    "bot_token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "owner_id": "123456789"
  }
}
```

**Set Webhook:**
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram"
```

**Test:**
```bash
curl http://localhost:3000/api/gateway/status
# ควรเห็น telegram: { enabled: true }
```

---

### 3. Voice TTS/STT
**Status:** Code เสร็จ, ต้องใส่ API key

**ขั้นตอน:**
1. ได้ OpenAI API Key จาก [platform.openai.com](https://platform.openai.com/)
2. หรือใช้ ElevenLabs สำหรับ TTS ที่เสียงดีกว่า

**Environment Variables:**
```bash
OPENAI_API_KEY=sk-xxx
# หรือ
ELEVENLABS_API_KEY=xxx
```

**ใส่ใน config.json:**
```json
{
  "voice": {
    "enabled": true,
    "ttsProvider": "openai",
    "ttsVoice": "nova",
    "sttModel": "whisper-1"
  }
}
```

**Test:**
```bash
curl -X POST http://localhost:3000/api/voice/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "สวัสดีครับ"}'
```

---

### 4. Local Models (Ollama/LM Studio)
**Status:** Code เสร็จ, ต้องรัน local server

**ขั้นตอน Ollama:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull llama2
# หรือ
ollama pull mistral

# Run (default port 11434)
ollama serve
```

**ขั้นตอน LM Studio:**
1. Download จาก [lmstudio.ai](https://lmstudio.ai/)
2. Download model (เช่น Mistral, Llama)
3. Start local server (default port 1234)

**ใส่ใน config.json:**
```json
{
  "localModels": {
    "enabled": true,
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "llama2"
  }
}
```

**Test:**
```bash
curl http://localhost:3000/api/local-models/status
```

---

### 5. Gmail Pub/Sub
**Status:** Code เสร็จ, ต้อง setup Google Cloud

**ขั้นตอน:**
1. ไป Google Cloud Console
2. Enable **Gmail API** และ **Pub/Sub API**
3. สร้าง Topic และ Subscription
4. Grant permissions ให้ gmail

**ใส่ใน config.json:**
```json
{
  "gmail": {
    "enabled": true,
    "projectId": "your-project-id",
    "topicName": "gmail-notifications",
    "subscriptionName": "gmail-oracle-sub"
  }
}
```

---

### 6. Webhook Secrets
**Status:** Endpoints พร้อม, ต้องใส่ secrets

**ใส่ใน config.json:**
```json
{
  "webhooks": {
    "enabled": true,
    "secrets": {
      "beds24": "your-beds24-webhook-secret",
      "stripe": "whsec_xxx",
      "github": "your-github-webhook-secret"
    }
  }
}
```

**Stripe:**
1. ไป Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/webhook/stripe`
3. Copy Signing secret

**GitHub:**
1. ไป Repo → Settings → Webhooks
2. Add webhook: `https://your-domain.com/webhook/github`
3. Set secret

---

## ❌ ยังไม่ได้ Implement

| Feature | Status | หมายเหตุ |
|---------|--------|----------|
| WhatsApp | Placeholder only | ต้องเขียน code เพิ่ม + ใช้ Meta Business API |
| Image Processing | ไม่มี | รับรูปจาก LINE แล้วประมวลผล |
| Slack | ไม่มี | ต้องเขียนใหม่ |
| Discord | ไม่มี | ต้องเขียนใหม่ |
| Notion Integration | ไม่มี | มี Reminder แทน |
| Image Generation | ไม่มี | DALL-E / Midjourney |

---

## Quick Setup Summary

```bash
# Required (มีแล้ว)
ANTHROPIC_API_KEY=sk-ant-xxx ✅

# LINE (มีแล้ว)
LINE_CHANNEL_TOKEN=xxx ✅
LINE_CHANNEL_SECRET=xxx ✅

# Optional - ต้อง setup
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx
TELEGRAM_BOT_TOKEN=xxx
OPENAI_API_KEY=xxx
```

---

## Priority Setup Order

1. **ไม่ต้องทำอะไร** - LINE + Core features พร้อมใช้แล้ว
2. **ถ้าต้องการ Calendar** - Setup Google OAuth
3. **ถ้าต้องการ Telegram** - สร้าง bot กับ BotFather
4. **ถ้าต้องการ Voice** - ใส่ OpenAI API Key
5. **ถ้าต้องการ Local AI** - Install Ollama

---

*Last updated: 2026-02-04*
