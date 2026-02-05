/**
 * Oracle Agent - Main Server v5.5 (Beds24 Integration Fixed)
 * Digital Partner for Tars - ALL aspects of life
 *
 * Features:
 * - 24/7 Always-on (Failover System)
 * - Multi-Channel Gateway (LINE, Telegram, WhatsApp planned)
 * - Router: Local (free) → Railway (API)
 * - Phase 3: AUTONOMY ENGINE
 *   - Proactive monitoring (Gold, BTC, Hotel)
 *   - Pattern detection & opportunity alerts
 *   - Approval queue for decisions
 *   - Learning from Tars's decisions
 * - Phase 3.5: OPENCLAW UPGRADES
 *   - JSONL Session Logging
 *   - Prompt Versioning
 *   - Graceful Shutdown
 * - Phase 4: HEARTBEAT SYSTEM
 *   - AI wakes every 30 minutes
 *   - HEARTBEAT_OK protocol
 * - Phase 5: SUB-AGENT SPAWN
 *   - AI spawns background workers
 *   - Parallel task execution
 *   - Non-blocking, announces results
 * - Phase 6: MULTI-CHANNEL GATEWAY
 *   - Same brain, all channels
 *   - LINE + Telegram + WhatsApp (planned)
 *   - Unified message handling
 * - Phase 7: MODEL FAILOVER + WEBHOOK INGRESS
 *   - Auto-switch between Claude/GPT/Gemini/Groq
 *   - Webhook endpoints for Beds24, Stripe, GitHub
 *   - Event-driven automation
 * - Phase 8: GMAIL PUB/SUB + QUEUE MANAGEMENT
 *   - Real-time email processing
 *   - Message batching and steering
 *   - Concurrency lanes
 * - Phase 9: THINKING LEVELS
 *   - Control AI reasoning depth
 *   - Auto-detect question complexity
 *   - Cost optimization (40-50% savings)
 * - Shared memory system with learnings
 */

import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import https from 'https';
import http from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('./config.json');

// Import core modules
import claude from './lib/claude.js';
import line from './lib/line.js';
import telegram from './lib/telegram.js';
import gateway from './lib/gateway.js';
import trustPolicy from './lib/trust-policy.js';
import toolPolicy from './lib/tool-policy.js';
import voiceManager from './lib/voice.js';
import broadcastManager from './lib/broadcast.js';
import codingOrchestrator from './lib/coding-orchestrator.js';
import modelFailover from './lib/model-failover.js';
import webhookIngress, { createBeds24Handler, createStripeHandler, createGitHubHandler } from './lib/webhook-ingress.js';
import gmailPubSub from './lib/gmail-pubsub.js';
import queueManager from './lib/queue-manager.js';
import thinkingLevels from './lib/thinking-levels.js';
import memory from './lib/memory.js';
import memorySync from './lib/memory-sync.js';
import HeartbeatManager from './lib/heartbeat.js';
import SubAgentManager from './lib/subagent.js';
import beds24 from './lib/beds24.js';
import pricing from './lib/pricing.js';
import parcelTracking from './lib/parcel-tracking.js';
import parcelWatchlist from './lib/parcel-watchlist.js';
import realtimeContext from './lib/realtime-context.js';
import autonomousLoop from './lib/autonomous-loop.js';
import imageGen from './lib/image-gen.js';
import autonomy from './lib/autonomy.js';
import hotelNotify from './lib/hotel-notifications.js';

// Phase 5.3: Tier 1-3 OpenClaw Features
import typingIndicators from './lib/typing-indicators.js';
import flexBuilder from './lib/flex-builder.js';
import { smartChunk, getChunkLimit } from './lib/smart-chunking.js';
import verboseMode from './lib/verbose-mode.js';
import debugCommand from './lib/debug-command.js';
import reactions from './lib/reactions.js';
import localModels from './lib/local-models.js';
import firecrawl from './lib/firecrawl.js';
import lobster from './lib/lobster.js';
import otel from './lib/opentelemetry.js';
import presence from './lib/presence.js';

// Phase 5.4: Self-Improvement Features
import mistakeTracker from './lib/mistake-tracker.js';
import selfReflection from './lib/self-reflection.js';
import sentimentAnalysis from './lib/sentiment-analysis.js';
import qualityTracker from './lib/quality-tracker.js';

// Phase 5.5: Proactive Partner Features
import reminderSystem from './lib/reminder-system.js';
import googleCalendar from './lib/google-calendar.js';
import dailyDigest from './lib/daily-digest.js';
import memoryConsolidation from './lib/memory-consolidation.js';

// Phase 5.6: User Profiles System
import userProfiles from './lib/user-profiles.js';

// Phase 6: Local Agent (Remote Execution)
import localAgentServer from './lib/local-agent-server.js';

// Phase 7: Autonomous Idea Engine
import autonomousIdeas from './lib/autonomous-ideas.js';

// Phase 3.5: OpenClaw Upgrades
import {
  initSessionLogger,
  logUserMessage,
  logAssistantMessage,
  logSystemEvent,
  logError,
  closeAllStreams,
  readSessionLog,
  listSessionLogs,
  getSessionStats
} from './lib/session-jsonl.js';

import {
  initPromptLoader,
  renderPrompt,
  loadPrompt,
  listPrompts,
  listVersions,
  getVersion as getPromptVersion,
  setVersion as setPromptVersion
} from './lib/prompt-loader.js';

import {
  setupSignalHandlers,
  registerCleanup,
  registerHttpServer
} from './lib/graceful-shutdown.js';

const app = express();
app.use(express.json());

// Heartbeat Manager instance
let heartbeatManager = null;

// Sub-Agent Manager instance
let subAgentManager = null;

// =============================================================================
// FAILOVER ROUTER CONFIGURATION
// =============================================================================

// Local tunnel URL (cloudflared) - set via environment variable
const LOCAL_TUNNEL_URL = process.env.LOCAL_TUNNEL_URL || null;
const LOCAL_HEALTH_TIMEOUT = 3000; // 3 seconds to check health

// Cache for local status
let localStatus = {
  online: false,
  lastCheck: 0,
  checkInterval: 30000 // Check every 30 seconds
};

/**
 * Check if Local server is online
 */
async function checkLocalHealth() {
  if (!LOCAL_TUNNEL_URL) {
    return false;
  }

  // Use cached status if checked recently
  if (Date.now() - localStatus.lastCheck < localStatus.checkInterval) {
    return localStatus.online;
  }

  return new Promise((resolve) => {
    const url = new URL('/health', LOCAL_TUNNEL_URL);
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.get(url.href, { timeout: LOCAL_HEALTH_TIMEOUT }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          localStatus.online = result.status === 'online';
          localStatus.lastCheck = Date.now();
          console.log(`[ROUTER] Local health: ${localStatus.online ? 'ONLINE' : 'OFFLINE'}`);
          resolve(localStatus.online);
        } catch (e) {
          localStatus.online = false;
          localStatus.lastCheck = Date.now();
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      localStatus.online = false;
      localStatus.lastCheck = Date.now();
      console.log('[ROUTER] Local health: OFFLINE (error)');
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      localStatus.online = false;
      localStatus.lastCheck = Date.now();
      console.log('[ROUTER] Local health: OFFLINE (timeout)');
      resolve(false);
    });
  });
}

/**
 * Forward request to Local server
 */
async function forwardToLocal(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, LOCAL_TUNNEL_URL);
    const postData = JSON.stringify(body);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000 // 60 seconds for actual request
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// =============================================================================
// SYSTEM PROMPT - Oracle Agent's Identity (Phase 3: Autonomous)
// =============================================================================

const SYSTEM_PROMPT = `คุณคือ Oracle Agent - Digital Partner ของ Tars

## ตัวตนของคุณ
- ชื่อ: Oracle Agent
- Version: ${config.agent.version}
- เจ้าของ: Tars
- บทบาท: Digital Partner ที่**คิดเอง ทำเอง** ช่วย Tars ทุกเรื่องในชีวิต
- GitHub: https://github.com/qualyads/Tars (branch: main)

## DIRECTIVE บังคับ (ห้ามลืม!)
🚫 ห้ามถาม "ต้องการให้ทำไหม?" → ทำเลย!
🚫 ห้ามถาม "เลือกอันไหน?" → เลือกเอง!
🚫 ห้ามรอ confirmation → ทำต่อเลย!
✅ เจอโอกาสธุรกิจ → เสนอทันที
✅ มีงานต่อที่ควรทำ → ทำเลย
✅ ตัดสินใจเอง ตามหลักการที่ดีที่สุด

## 🧠 Real-time Thinking (มาตรฐาน!)
**คุณคิดเอง real-time จาก context ที่เห็น - ไม่ใช่รอ script บอก!**

Context ที่คุณจะเห็น:
- ⏰ **เวลาปัจจุบัน** - รู้ว่ากี่โมง วันอะไร เสาร์/อาทิตย์
- 💰 **Investment Alerts** - ทอง/BTC เปลี่ยนแรง
- 🔔 **Check-in Proximity** - ใกล้เวลาแขก check-in
- 📊 **Pricing Urgency** - occupancy ต่ำ + เวลากดดัน

**หลักการ:**
1. เห็น context → คิดเอง → พูดกับ Tars (ไม่ต้องรอถาม)
2. ข้อมูลสำคัญ/urgent → บอกทันที
3. ไม่สำคัญ → ไม่ต้องพูด (อย่า spam)
4. คิดจากข้อมูลจริง → แนะนำสิ่งที่ทำได้จริง

## ขอบเขตที่คุณดูแล (ทุกอย่างของ Tars)
1. **ธุรกิจที่พัก Best Hotel Pai** - 4 แห่ง
2. **SaaS Projects** - KeyForge และโปรเจคใหม่ๆ
3. **การลงทุน** - Gold, Bitcoin, Crypto
4. **ธุรกิจอื่นๆ** - VisionXBrain
5. **ทุกสิ่งที่ Tars ต้องการความช่วยเหลือ**

## ที่พักที่คุณดูแล
- The Arch Casa (Design Boutique Hotel): **11 ห้อง** (A01-A06, B07-B09, C10-C11)
- Betel Palm Village (Boutique Hotel): 4 ห้อง
- Paddy Fields Haven (Homestay / Bamboo Glamping): 3 ห้อง
- 365 Vila (Family Villa): 1 ห้อง

## API ที่คุณเข้าถึงได้
- **Beds24 API** ✅ - ดึงข้อมูล booking, ห้องว่าง, ราคา ได้เลย (Property ID: 308400)
- **LINE API** ✅ - ส่งข้อความ, Push notification
- **Stripe API** ✅ - ดูข้อมูล payment
- **TrackingMore API** ✅ - เช็คสถานะพัสดุ KEX/Kerry, Flash, J&T, EMS ได้เลย!

## 📦 เช็คพัสดุ (TrackingMore API)
**คุณเช็คพัสดุได้แล้ว!** เมื่อ user ส่ง tracking number มา ระบบจะ fetch ข้อมูลให้อัตโนมัติ
รองรับ: KEX Express, Kerry, Flash Express, J&T, Thailand Post, DHL, FedEx
ข้อมูลจะอยู่ใน context ถ้ามี - ใช้ข้อมูลนั้นตอบเลย

## 📦 Parcel Watchlist (ติดตามพัสดุ)
**คุณมี watchlist พัสดุที่ Tars สนใจ!**
- เมื่อ Tars พูดว่า "ติดตามพัสดุนี้" / "ช่วยดูพัสดุ" / "แจ้งเตือนเมื่อถึง":
  1. **ถามชื่อเรียกพัสดุก่อนเสมอ!** "พัสดุนี้ให้เรียกว่าอะไรครับ?" (เช่น "ROG Ally", "เคส iPhone", "ของขวัญแม่")
  2. เมื่อได้ชื่อแล้ว → ระบบจะเพิ่มเข้า watchlist อัตโนมัติ
- **[PENDING_WATCHLIST]** ใน context = กำลังรอชื่อพัสดุ → ให้ถาม "พัสดุนี้ให้เรียกว่าอะไรครับ?"
- เมื่อสถานะพัสดุเปลี่ยน → webhook จะแจ้งเตือน LINE ทันทีพร้อมชื่อที่ตั้งไว้
- เมื่อพัสดุถึงแล้ว (delivered) → ลบออกจาก watchlist อัตโนมัติ
- ข้อมูล watchlist จะอยู่ใน context → บอก Tars ได้ว่ากำลังติดตามพัสดุอะไรบ้าง

## 🚨 กฎเหล็ก: ข้อมูล Beds24 (บังคับเคร่งครัด!)
**ห้ามแต่ง ห้ามเดา ห้าม hallucinate!**
1. ใช้ข้อมูลที่ให้มาใน context เท่านั้น - ห้ามสมมติเลข/ชื่อ/ห้อง
2. Room ID ต้องตรงกับ context (เช่น A05, B07) - ห้ามเดาเอง
3. ถ้าไม่มีข้อมูล → บอกว่าไม่มี ห้ามแต่งขึ้นมา
4. Occupancy/จำนวนห้อง → ใช้ตัวเลขจาก context เท่านั้น
5. ชื่อแขก/Booking ID → copy จาก context ห้ามพิมพ์เอง
6. **Self Check-in Link** → ใช้รูปแบบนี้เท่านั้น:
   \`https://thearchcasa.com/booking/{BOOKING_ID}?lang=en\`
   ตัวอย่าง: https://thearchcasa.com/booking/81874011?lang=en
   ❌ ห้ามใช้ checkin.besthotelpai.com (URL ปลอม!)
   ❌ ห้ามใช้ admin.besthotelpai.com (URL ปลอม!)

## Autonomy Level (ระดับความเป็นอิสระ)
| Domain | Level | ทำได้เลย | ต้องขออนุมัติ |
|--------|-------|---------|-------------|
| Personal | HIGH | ทุกอย่าง | - |
| Hotel | MEDIUM | ตอบคำถาม, Alert | Promotion, ราคา |
| Investment | LOW | Alert | ซื้อ/ขาย |
| SaaS | MEDIUM | Monitor | Launch, Pricing |

## 🧠 Real-time Pricing Intelligence (คิดเอง!)
**เมื่อเห็น Urgency Analysis ใน context → คุณต้องคิดเองว่าควรทำอะไร!**

วิธีคิด:
- ดู Urgency Score: ยิ่งสูง ยิ่งต้อง proactive
- ดูเวลาปัจจุบัน: หลัง 18:00 + พรุ่งนี้ว่าง = urgent มาก
- ดู occupancy: <50% = ต้องทำอะไรสักอย่าง

Action ตาม Urgency Level:
- 🟢 OK (<50): ไม่ต้องพูดถึงราคา
- 🟡 LOW (50-99): บอก Tars ว่า "ยังว่างอยู่นะ"
- 🟠 MEDIUM (100-149): แนะนำว่า "น่าจะลดราคาหน่อย"
- 🔴 HIGH (150-199): เตือนชัดว่า "ต้องทำโปรแล้วนะ!"
- 🚨 CRITICAL (200+): **แจ้งเตือนทันที** "ด่วน!"

**คุณไม่ต้องรอ Tars ถาม - ถ้าเห็น urgency สูง ให้พูดเอง!**

## 🖥️ Local Agent (Remote Execution) - NEW!
**เมื่อเห็น [LOCAL_AGENT: connected] → คุณสามารถ execute commands บนเครื่อง Mac ของ Tars ได้!**

✅ **คุณทำได้เลย (ถ้า Local Agent connected):**
- สร้างโฟลเดอร์: "สร้างโฟลเดอร์ X ใน Desktop"
- ดูไฟล์: "ls ~/Desktop"
- git commands: "git status", "git pull"
- Claude Code: "ให้ Claude Code สร้าง/แก้ไข..."
- สร้างโปรเจค: "npx create-next-app..."

**วิธีทำ:** เมื่อ user สั่ง → ดู context ว่ามี [LOCAL_AGENT_RESULT] หรือไม่:
- ถ้ามี result → ใช้ข้อมูลนั้นตอบ
- ถ้า success: true → บอกว่า "ทำเสร็จแล้วครับ" + แสดงผล
- ถ้า error → บอก error และแนะนำวิธีแก้

**ถ้า Local Agent ไม่ connected:** บอก Tars ให้รัน \`node local-agent.js\` ก่อน

## ⚠️ แนะนำเฉพาะสิ่งที่ทำได้จริง!
**ห้ามแนะนำลอยๆ ต้องเป็น actionable ที่ทำได้!**

❌ สิ่งที่ Oracle ทำไม่ได้:
- "push Flash Sale บน Agoda/Booking.com" → ต้อง login manual
- "ลดราคาใน Beds24 ให้เลย" → ยังไม่มี write API
- "ส่ง email/SMS หาลูกค้า" → ไม่มีระบบ
- "โพสต์โปรโมชั่นใน Facebook" → ไม่มี access

✅ สิ่งที่ Oracle ทำได้จริง:
- แจ้งเตือน Tars ผ่าน LINE (ทำได้เลย)
- บอกราคาที่ควรตั้ง + เหตุผล (Tars ไปปรับเอง)
- วิเคราะห์สถานการณ์จากข้อมูลจริง
- เตือนว่า "ห้อง X ควรลดเหลือ Y บาท" (Tars ทำเอง)
- **สั่งงานบน Mac ผ่าน Local Agent (ถ้า connected)**

**หลักการ: บอกว่า "ควรทำอะไร" + "ทำไม" แต่ Tars ต้องไปทำเอง (ยกเว้น Local Agent tasks)**

## Opportunity Hunter (บังคับ!)
Tars พูดถึง/สนใจอะไร → หาโอกาสทำเงินทันที!
- ขายต่อได้ไหม?
- ทำเป็น SaaS ได้ไหม?
- ให้บริการได้ไหม?
- Passive income ได้ไหม?

## สิ่งที่ทำได้เลย (ไม่ต้องถาม)
- ตอบคำถามทุกอย่าง
- ส่ง Morning briefing
- แจ้งเตือนโอกาส/ปัญหา
- วิเคราะห์และแนะนำ
- เสนอโอกาสธุรกิจใหม่

## สิ่งที่ต้องใส่ Approval Queue
- Confirm booking
- ส่วนลดพิเศษ / Promotion
- Refund
- ปรับราคา
- การลงทุน

## วิธีตอบ (สำคัญมาก!)
⚠️ นี่คือ LINE chat - ตอบสั้นๆ 2-5 บรรทัดเท่านั้น!
- ไม่ต้องใส่ header/bullet ยาวๆ
- ตรงประเด็น กระชับ
- ถ้าต้องอธิบายยาว → ถามก่อนว่าอยากรู้รายละเอียดไหม
- เป็นมิตร คุยแบบ Partner

ถ้าเห็นโอกาส → เสนอเลย ไม่ต้องรอถาม!`;

// =============================================================================
// LINE WEBHOOK
// =============================================================================

app.post('/webhook/line', async (req, res) => {
  try {
    const events = req.body.events || [];

    // ==========================================================================
    // FAILOVER ROUTER: Check Local first, then handle locally
    // ==========================================================================

    // Check if Local server is online
    const localOnline = await checkLocalHealth();

    if (localOnline && LOCAL_TUNNEL_URL) {
      // Forward to Local (uses Claude Max - FREE)
      console.log('[ROUTER] Forwarding to Local (Claude Max - FREE)');
      try {
        const result = await forwardToLocal('/webhook', req.body);
        console.log(`[ROUTER] Local responded: ${result.status}`);
        res.status(200).send('OK (via Local)');
        return;
      } catch (forwardError) {
        console.log(`[ROUTER] Forward failed: ${forwardError.message}, handling locally`);
        // Fall through to handle locally
      }
    }

    // Handle locally (uses Anthropic API - PAID)
    console.log('[ROUTER] Handling locally (Anthropic API - PAID)');

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMessage = event.message.text;
        const replyToken = event.replyToken;
        const sessionId = `line:${userId}`;

        console.log(`[LINE] Message from ${userId}: ${userMessage}`);

        // =====================================================================
        // PHASE 5.6: USER PROFILES - ตรวจสอบตัวตน user
        // =====================================================================
        const userProfile = userProfiles.getAIContext(userId);

        // Check if user needs onboarding (not owner, not known)
        if (!userProfiles.isOwner(userId) && userProfiles.needsOnboarding(userId)) {
          console.log(`[USER-PROFILES] New user ${userId}, checking onboarding...`);

          // Check if this is onboarding response
          const existingProfile = userProfiles.getProfile(userId);
          if (existingProfile && existingProfile.onboardingStarted) {
            // Process onboarding response
            const result = userProfiles.processOnboarding(userId, userMessage);
            await line.reply(replyToken, result.message);

            if (result.success) {
              logSystemEvent('user-profiles', 'onboarded', { userId });
            }
            return;
          }

          // Start onboarding - get LINE display name if possible
          const displayName = event.source.displayName || null;
          const onboardingMsg = userProfiles.getOnboardingMessage(userId, displayName);

          // Mark as onboarding started
          userProfiles.updateProfile(userId, { onboardingStarted: true });

          await line.reply(replyToken, onboardingMsg);
          logSystemEvent('user-profiles', 'onboarding_started', { userId });
          return;
        }

        console.log(`[USER-PROFILES] ${userProfile.name} (${userProfile.role}) - ${userProfile.contextString}`);

        // =====================================================================
        // PHASE 5.4: SENTIMENT ANALYSIS - วิเคราะห์อารมณ์ user
        // =====================================================================
        const sentiment = sentimentAnalysis.analyze(userMessage, userId);
        console.log(`[SENTIMENT] ${userId}: ${sentiment.mood} (${Math.round(sentiment.confidence * 100)}%) urgency=${sentiment.urgency}`);

        // =====================================================================
        // PHASE 5.5: MEMORY CONSOLIDATION - บันทึก short-term memory
        // =====================================================================
        memoryConsolidation.addShortTerm({
          type: 'conversation',
          content: userMessage,
          context: { channel: 'line', userId, sentiment: sentiment.mood },
          importance: sentiment.urgency === 'high' ? 4 : 3,
          tags: ['line', sentiment.mood]
        });

        // Phase 3.5: Log user message to JSONL
        logUserMessage(sessionId, userMessage, {
          channel: 'line',
          replyToken,
          timestamp: event.timestamp,
          sentiment: sentiment.mood
        });

        // Load conversation history
        const history = await memory.getConversation(userId);

        // Check if this is owner or customer
        const isOwner = userId === config.line.owner_id;

        // =====================================================================
        // PHASE 5.6: OWNER COMMANDS - คำสั่งพิเศษสำหรับ owner
        // =====================================================================
        if (isOwner) {
          // Check for partner registration command
          // Usage: "ลงทะเบียน นิว เป็น partner"
          const registerCmd = userProfiles.registerPartnerByCommand(userMessage);
          if (registerCmd.isCommand) {
            // Store pending registration
            const pendingKey = `pending_partner_${registerCmd.name.toLowerCase()}`;
            await memory.set(pendingKey, {
              name: registerCmd.name,
              role: registerCmd.role,
              registeredBy: userId,
              createdAt: new Date().toISOString()
            });

            await line.reply(replyToken,
              `✅ รับทราบครับ! จะลงทะเบียน "${registerCmd.name}" เป็น ${registerCmd.role}\n\n` +
              `เมื่อ ${registerCmd.name} ส่งข้อความมาครั้งแรก ผมจะจำได้และตั้งค่าให้อัตโนมัติครับ 👍`
            );
            logSystemEvent('user-profiles', 'partner_pending', { name: registerCmd.name, role: registerCmd.role });
            return;
          }

          // Check for list users command
          if (userMessage.match(/^(รายชื่อ|list)\s*(users?|profiles?)?$/i)) {
            const profiles = userProfiles.getAllProfiles();
            const profileList = Object.values(profiles).map(p =>
              `• ${p.name} (${p.role}) - ${p.onboarded ? '✅' : '⏳'}`
            ).join('\n');

            await line.reply(replyToken,
              `👥 **User Profiles**\n\n${profileList || 'ยังไม่มี profiles'}`
            );
            return;
          }
        }

        // Phase 2: Get intelligent context
        const context = await memory.getIntelligentContext();

        // Phase 3: Get autonomy suggestions
        const suggestions = autonomy.getProactiveSuggestions();
        const pendingApprovals = autonomy.getPendingApprovals();

        // =====================================================================
        // PHASE 5.4: MISTAKE TRACKER - เช็คก่อนตอบ
        // =====================================================================
        const mistakeCheck = mistakeTracker.checkBeforeResponding({
          action: 'reply',
          topic: 'line_message',
          askingPermission: false
        });
        if (!mistakeCheck.ok) {
          console.log(`[MISTAKE] Warnings: ${mistakeCheck.warnings.map(w => w.message).join(', ')}`);
        }

        // Build context string for Claude
        let contextString = '';

        // Real-time Context (Standard: ทุก feature ต้องมี!)
        try {
          const rtContext = await realtimeContext.generateRealtimeContext({
            includeInvestment: isOwner, // Only show investment to owner
            includeHotel: isOwner
          });
          if (rtContext) {
            contextString += rtContext;
          }
        } catch (rtErr) {
          console.error('[REALTIME] Context error:', rtErr.message);
        }

        if (context.current_focus) {
          contextString += `\n\n[Current Focus: ${context.current_focus.topic}]`;
        }
        if (context.hotel_status && context.hotel_status.date) {
          contextString += `\n[Hotel Today: ${JSON.stringify(context.hotel_status)}]`;
        }
        if (context.market_alerts && context.market_alerts.length > 0) {
          contextString += `\n[Recent Alerts: ${context.market_alerts.map(a => a.message || a.type).join(', ')}]`;
        }
        if (pendingApprovals.length > 0) {
          contextString += `\n[Pending Approvals: ${pendingApprovals.length} - พิมพ์ "อนุมัติ" หรือ "ปฏิเสธ" + ID]`;
          contextString += `\n[IDs: ${pendingApprovals.map(a => a.id).join(', ')}]`;
        }
        if (suggestions.length > 0) {
          contextString += `\n[Proactive Suggestions: ${suggestions.map(s => s.message).join('; ')}]`;
        }

        // Add user profile context (Phase 5.6)
        if (userProfile.contextString) {
          contextString += `\n[👤 ${userProfile.contextString}]`;
        }
        // Filter content based on user permissions
        if (!userProfile.canAccess?.investment) {
          contextString += `\n[🚫 ไม่ต้องพูดเรื่องทอง/BTC/ลงทุน กับ user นี้]`;
        }
        if (!userProfile.canAccess?.business) {
          contextString += `\n[🚫 ไม่ต้องพูดเรื่อง business/opportunities กับ user นี้]`;
        }

        // Add sentiment-based context
        if (sentiment.mood === 'angry' || sentiment.mood === 'frustrated') {
          contextString += `\n[⚠️ User Mood: ${sentiment.mood} - ตอบอย่างใจเย็น เน้น solution]`;
        } else if (sentiment.mood === 'urgent') {
          contextString += `\n[🚨 Urgent: ตอบเร็วและตรงประเด็น]`;
        }

        // Add mistake prevention rules
        if (mistakeCheck.rulesToFollow.length > 0) {
          contextString += `\n[Rules: ${mistakeCheck.rulesToFollow.join('; ')}]`;
        }

        // =====================================================================
        // LOCAL AGENT - Execute commands on Tars's Mac
        // =====================================================================
        const localAgentStatus = localAgentServer.getStatus();
        const isLocalAgentConnected = localAgentServer.isConnected();

        // Add Local Agent status to context
        if (isLocalAgentConnected) {
          contextString += `\n[LOCAL_AGENT: connected ✅ - สามารถ execute commands บน Mac ได้]`;
        }

        // Detect commands that need Local Agent - ใช้ AI classify intent
        console.log('[LOCAL-AGENT-DETECT] Checking message:', userMessage);
        console.log('[LOCAL-AGENT-DETECT] Agent connected:', isLocalAgentConnected);

        // ถ้า Local Agent connected → ใช้ Claude Haiku วิเคราะห์ intent
        let localAgentIntent = null;
        if (isLocalAgentConnected) {
          try {
            const intentPrompt = `วิเคราะห์ข้อความนี้ว่าต้องการทำอะไร:
"${userMessage}"

ถ้าต้องการ:
- สร้างโฟลเดอร์ → ตอบ: {"action":"mkdir","name":"ชื่อโฟลเดอร์"}
- เปิด browser → ตอบ: {"action":"open_browser","app":"Chrome/Safari/Firefox"}
- ดูไฟล์ใน Desktop → ตอบ: {"action":"ls"}
- git command → ตอบ: {"action":"git","cmd":"status/pull/etc"}
- เช็ค RAM/memory/ความจำ → ตอบ: {"action":"system_info"}
- สร้างโปรเจค/เว็บ/app ให้เสร็จ → ตอบ: {"action":"workflow","projectName":"ชื่อโปรเจค","prompt":"รายละเอียดที่ต้องทำ","deploy":true}
- เปิด Terminal → ตอบ: {"action":"open_terminal","command":"คำสั่งที่ต้องรัน (ถ้ามี)"}
- คิด idea/หาโอกาส/brainstorm → ตอบ: {"action":"think_ideas"}
- ดู ideas ที่คิดไว้ → ตอบ: {"action":"list_ideas"}
- ทำ idea ชื่อ X → ตอบ: {"action":"execute_idea","name":"ชื่อ idea"}
- ไม่เกี่ยวกับการทำงาน → ตอบ: {"action":"none"}

ตอบ JSON เท่านั้น ไม่ต้องอธิบาย:`;

            const intentResponse = await claude.chat([{ role: 'user', content: intentPrompt }], {
              model: 'claude-3-haiku-20240307',
              max_tokens: 100
            });

            const intentText = intentResponse.content?.[0]?.text || intentResponse;
            const jsonMatch = intentText.match(/\{[^}]+\}/);
            if (jsonMatch) {
              localAgentIntent = JSON.parse(jsonMatch[0]);
              console.log('[LOCAL-AGENT-INTENT] Detected:', localAgentIntent);
            }
          } catch (intentErr) {
            console.error('[LOCAL-AGENT-INTENT] Error:', intentErr.message);
          }
        }

        const lowerMsg = userMessage.toLowerCase();

        // =================================================================
        // AI Result Validator - ใช้ AI เช็คผลลัพธ์ว่าทำงานจริงไหม
        // =================================================================
        async function validateWithAI(action, result, context = {}) {
          try {
            const validatePrompt = `ตรวจสอบว่าคำสั่งทำงานสำเร็จจริงไหม:

Action: ${action}
Result: ${JSON.stringify(result)}
Context: ${JSON.stringify(context)}

วิเคราะห์:
1. คำสั่งทำงานสำเร็จจริงไหม?
2. มี error หรือ warning อะไรไหม?
3. ผลลัพธ์ตรงกับที่คาดหวังไหม?

ตอบ JSON: {"verified": true/false, "message": "อธิบายสั้นๆ", "issues": ["ปัญหา (ถ้ามี)"]}`;

            const validateResponse = await claude.chat([{ role: 'user', content: validatePrompt }], {
              model: 'claude-3-haiku-20240307',
              max_tokens: 150
            });

            const validateText = validateResponse.content?.[0]?.text || validateResponse;
            const jsonMatch = validateText.match(/\{[^}]+\}/);
            if (jsonMatch) {
              const validation = JSON.parse(jsonMatch[0]);
              console.log(`[AI-VALIDATOR] ${action}:`, validation);
              return validation;
            }
          } catch (err) {
            console.error('[AI-VALIDATOR] Error:', err.message);
          }
          return { verified: true, message: 'Could not validate' };
        }

        // Execute based on AI intent
        let localAgentResult = null;
        if (localAgentIntent && localAgentIntent.action !== 'none') {
          console.log(`[LOCAL-AGENT] Executing intent:`, localAgentIntent);

          try {
            if (localAgentIntent.action === 'mkdir' && localAgentIntent.name) {
              const folderName = localAgentIntent.name;
              const targetPath = `/Users/tanakitchaithip/Desktop/${folderName}`;
              localAgentResult = await localAgentServer.fileOperation('mkdir', { filePath: targetPath });

              // AI Validation: เช็คว่าโฟลเดอร์ถูกสร้างจริงไหม
              if (localAgentResult.success) {
                // เช็คซ้ำว่าโฟลเดอร์มีอยู่จริง
                const verifyResult = await localAgentServer.executeShell(`ls -la ~/Desktop | grep "${folderName}"`);
                const validation = await validateWithAI('mkdir', { ...localAgentResult, verifyOutput: verifyResult.stdout }, { folderName, targetPath });

                if (validation.verified && verifyResult.success && verifyResult.stdout.includes(folderName)) {
                  contextString += `\n\n[LOCAL_AGENT_RESULT: สร้างโฟลเดอร์ "${folderName}" บน Desktop สำเร็จแล้ว ✅ (AI verified)]`;
                } else {
                  contextString += `\n\n[LOCAL_AGENT_WARNING: สร้างโฟลเดอร์แล้วแต่ AI ไม่แน่ใจว่าสำเร็จ - ${validation.message}]`;
                }
              } else {
                contextString += `\n\n[LOCAL_AGENT_ERROR: ${localAgentResult.error}]`;
              }
            }
            else if (localAgentIntent.action === 'ls') {
              localAgentResult = await localAgentServer.executeShell('ls -la ~/Desktop | head -20');
              if (localAgentResult.success) {
                contextString += `\n\n[LOCAL_AGENT_RESULT: Files on Desktop]\n${localAgentResult.stdout}`;
              }
            }
            else if (localAgentIntent.action === 'git' && localAgentIntent.cmd) {
              const gitCmd = `git ${localAgentIntent.cmd}`;
              localAgentResult = await localAgentServer.executeShell(gitCmd);
              if (localAgentResult.success) {
                contextString += `\n\n[LOCAL_AGENT_RESULT: ${gitCmd}]\n${localAgentResult.stdout}`;
              } else {
                contextString += `\n\n[LOCAL_AGENT_ERROR: ${localAgentResult.error || localAgentResult.stderr}]`;
              }
            }
            else if (localAgentIntent.action === 'open_browser') {
              const appName = localAgentIntent.app || 'Google Chrome';
              localAgentResult = await localAgentServer.executeShell(`open -a "${appName}"`);
              if (localAgentResult.success) {
                contextString += `\n\n[LOCAL_AGENT_RESULT: เปิด ${appName} สำเร็จแล้ว ✅]`;
              } else {
                contextString += `\n\n[LOCAL_AGENT_ERROR: ${localAgentResult.error}]`;
              }
            }
            // เช็ค system info (RAM, Disk)
            else if (localAgentIntent.action === 'system_info') {
              localAgentResult = await localAgentServer.getSystemInfo();
              if (localAgentResult.success) {
                const info = localAgentResult.info;
                contextString += `\n\n[LOCAL_AGENT_RESULT: System Info]
- RAM: ${info.memory?.total || 'N/A'} (Free: ${info.memory?.free || 'N/A'})
- CPU: ${info.cpus || 'N/A'} cores
- Uptime: ${info.uptime || 'N/A'}
- Platform: ${info.platform || 'N/A'} ${info.arch || ''}`;
              }
            }
            // เปิด Terminal พร้อม command
            else if (localAgentIntent.action === 'open_terminal') {
              const termCommand = localAgentIntent.command || '';
              localAgentResult = await localAgentServer.openTerminal(termCommand);
              if (localAgentResult.success) {
                contextString += `\n\n[LOCAL_AGENT_RESULT: เปิด Terminal สำเร็จแล้ว ✅${termCommand ? ` (รัน: ${termCommand})` : ''}]`;
              } else {
                contextString += `\n\n[LOCAL_AGENT_ERROR: ${localAgentResult.error}]`;
              }
            }
            // Workflow: สร้างโปรเจคเต็มรูปแบบ + Deploy
            else if (localAgentIntent.action === 'workflow') {
              const projectName = localAgentIntent.projectName || 'new-project';
              const prompt = localAgentIntent.prompt || userMessage;
              const shouldDeploy = localAgentIntent.deploy !== false;

              console.log('[WORKFLOW] Starting:', { projectName, prompt: prompt.slice(0, 50), deploy: shouldDeploy });

              localAgentResult = await localAgentServer.executeWorkflow({
                projectName,
                prompt,
                model: 'opus',
                deploy: shouldDeploy,
                notifyLine: true
              });

              if (localAgentResult.success) {
                // AI Validation: เช็คว่า Terminal เปิดจริงไหม (รอสักครู่แล้วเช็ค)
                await new Promise(resolve => setTimeout(resolve, 2000)); // รอ 2 วิ
                const termCheck = await localAgentServer.executeShell('pgrep -x Terminal || pgrep -x iTerm2 || echo "not_found"');
                const scriptCheck = await localAgentServer.executeShell(`ls /tmp/oracle-workflows/ 2>/dev/null | grep workflow || echo "no_script"`);

                const validation = await validateWithAI('workflow', {
                  workflowResult: localAgentResult,
                  terminalRunning: termCheck.stdout,
                  scriptCreated: scriptCheck.stdout
                }, { projectName, prompt: prompt.slice(0, 50) });

                if (validation.verified) {
                  contextString += `\n\n[LOCAL_AGENT_RESULT: 🚀 Workflow เริ่มแล้ว! (AI verified ✅)
- Terminal เปิดแล้วให้ดู progress
- Project: ${projectName}
- Claude Opus กำลังทำงาน
${shouldDeploy ? '- จะ deploy ขึ้น Railway เมื่อเสร็จ' : '- ไม่ deploy'}
- เสร็จแล้วจะแจ้งใน LINE พร้อมลิงค์]`;
                } else {
                  contextString += `\n\n[LOCAL_AGENT_WARNING: Workflow อาจไม่ได้เริ่มต้นถูกต้อง - ${validation.message}]`;
                }
              } else {
                contextString += `\n\n[LOCAL_AGENT_ERROR: ${localAgentResult.error}]`;
              }
            }
            // =================================================================
            // AUTONOMOUS IDEAS - คิด idea, ดู ideas, execute idea
            // =================================================================
            else if (localAgentIntent.action === 'think_ideas') {
              console.log('[IDEAS] Manual thinking triggered from LINE');
              contextString += `\n\n[IDEAS: 🧠 Oracle กำลังคิด ideas ใหม่... รอสักครู่จะแจ้งผลทาง LINE]`;

              // Run thinking in background (don't block response)
              autonomousIdeas.thinkNow(config).then(result => {
                console.log('[IDEAS] Thinking complete:', result.success);
              }).catch(err => {
                console.error('[IDEAS] Thinking error:', err);
              });
            }
            else if (localAgentIntent.action === 'list_ideas') {
              const status = autonomousIdeas.getStatus();
              const data = autonomousIdeas.getIdeas();

              let ideaList = `[IDEAS: 💡 Ideas ที่ Oracle คิดไว้]\n\n`;
              ideaList += `Total: ${status.totalIdeas} ideas\n`;
              ideaList += `Executed: ${status.executedIdeas} ideas\n`;
              ideaList += `Last thinking: ${status.lastThinking || 'Never'}\n\n`;

              if (status.topIdeas && status.topIdeas.length > 0) {
                ideaList += `Top ideas:\n`;
                status.topIdeas.forEach((idea, i) => {
                  ideaList += `${i + 1}. ${idea.name} (${idea.score}/100) - ${idea.recommendation}\n`;
                });
              } else {
                ideaList += `ยังไม่มี ideas - บอก "คิด idea หน่อย" เพื่อให้ Oracle คิดใหม่`;
              }

              contextString += `\n\n${ideaList}`;
            }
            else if (localAgentIntent.action === 'execute_idea' && localAgentIntent.name) {
              console.log(`[IDEAS] Execute idea requested: ${localAgentIntent.name}`);
              contextString += `\n\n[IDEAS: 🚀 กำลัง execute idea "${localAgentIntent.name}"... Terminal จะเปิดบน Mac]`;

              // Execute in background
              autonomousIdeas.executeIdeaByName(localAgentIntent.name, config).then(result => {
                console.log('[IDEAS] Execute result:', result.success);
              }).catch(err => {
                console.error('[IDEAS] Execute error:', err);
              });
            }

            console.log('[LOCAL-AGENT] Result:', localAgentResult?.success ? 'success' : 'failed');
          } catch (localErr) {
            console.error('[LOCAL-AGENT] Error:', localErr.message);
            contextString += `\n\n[LOCAL_AGENT_ERROR: ${localErr.message}]`;
          }
        }

        // =====================================================================
        // PARCEL TRACKING & WATCHLIST - เช็คสถานะพัสดุและติดตาม
        // =====================================================================
        const lowerMessage = userMessage.toLowerCase();
        const trackingKeywords = ['พัสดุ', 'tracking', 'track', 'ส่งของ', 'ขนส่ง', 'kex', 'flash', 'ems', 'ไปรษณีย์', 'เคอรี่', 'kerry'];
        const watchKeywords = ['ติดตาม', 'ช่วยดู', 'แจ้งเตือน', 'บอกด้วย', 'watch', 'notify', 'alert'];
        const trackingNumberMatch = userMessage.match(/\b(SOE|THKE|KEX|KE|TH|FL|JT|SPXTH|LEX|LZD|E[A-Z])[A-Z0-9]{8,20}\b/i);

        // Store last tracking number per user (in-memory cache)
        if (!global.userTrackingCache) global.userTrackingCache = {};
        // Store pending watchlist entries waiting for name
        if (!global.pendingWatchlist) global.pendingWatchlist = {};

        // Check if user wants to add to watchlist
        const wantsToWatch = watchKeywords.some(kw => lowerMessage.includes(kw));

        // Check if user is responding to "ให้เรียกว่าอะไร" prompt
        const hasPendingWatchlist = userId && global.pendingWatchlist[userId];
        const hasNoTrackingNumber = !trackingNumberMatch && !userMessage.match(/[A-Z0-9]{10,20}/);

        if (hasPendingWatchlist && hasNoTrackingNumber) {
          // User is giving a name for the pending parcel
          const pending = global.pendingWatchlist[userId];
          const parcelName = userMessage.trim();

          console.log('[WATCHLIST] Adding with name:', pending.trackingNumber, '→', parcelName);

          try {
            const watchResult = await parcelWatchlist.addToWatchlist(pending.trackingNumber, {
              userId: userId,
              description: parcelName
            });
            console.log('[WATCHLIST] Add result:', watchResult.message);
            contextString += `\n\n✅ เพิ่ม "${parcelName}" (${pending.trackingNumber}) เข้า watchlist แล้ว จะแจ้งเตือนเมื่อมีอัพเดท`;

            // Clear pending state
            delete global.pendingWatchlist[userId];
          } catch (watchError) {
            console.error('[WATCHLIST] Error:', watchError.message);
            contextString += `\n\n❌ ไม่สามารถเพิ่มเข้า watchlist: ${watchError.message}`;
          }
        }
        else if (trackingNumberMatch || trackingKeywords.some(kw => lowerMessage.includes(kw))) {
          // Extract tracking number from message OR use cached one
          let trackingNumber = trackingNumberMatch?.[0] || userMessage.match(/[A-Z0-9]{10,20}/)?.[0];

          // If no tracking number in message, use last one for this user
          if (!trackingNumber && userId && global.userTrackingCache[userId]) {
            trackingNumber = global.userTrackingCache[userId];
            console.log('[LINE] Using cached tracking number for user:', trackingNumber);
          }

          if (trackingNumber) {
            // Cache this tracking number for the user
            if (userId) global.userTrackingCache[userId] = trackingNumber;

            console.log('[LINE] Detected tracking query for:', trackingNumber);

            // If user wants to watch, store pending state (wait for name)
            if (wantsToWatch) {
              // Check if already in watchlist
              if (parcelWatchlist.isInWatchlist(trackingNumber)) {
                contextString += `\n\n📦 พัสดุ ${trackingNumber} อยู่ใน watchlist แล้ว`;
              } else {
                // Store pending state - Oracle will ask for name
                global.pendingWatchlist[userId] = {
                  trackingNumber,
                  requestedAt: new Date().toISOString()
                };
                contextString += `\n\n🔔 [PENDING_WATCHLIST] กำลังรอชื่อเรียกพัสดุ ${trackingNumber} - ถาม user ว่าพัสดุนี้ให้เรียกว่าอะไร`;
              }
            }

            try {
              const trackingResult = await parcelTracking.getTrackingSummary(trackingNumber);
              contextString += `\n\n${trackingResult}`;
            } catch (trackError) {
              console.error('[Tracking] Error:', trackError.message);
              contextString += `\n\n⚠️ ไม่สามารถเช็คพัสดุ ${trackingNumber} ได้: ${trackError.message}`;
            }
          }
        }

        // Add watchlist summary to context
        try {
          const watchlistSummary = await parcelWatchlist.getWatchlistSummary();
          if (watchlistSummary) {
            contextString += `\n\n${watchlistSummary}`;
          }
        } catch (err) {
          console.error('[WATCHLIST] Error getting summary:', err.message);
        }

        // =====================================================================
        // SMART API DATA FETCHING - ดึงข้อมูลจริงเมื่อ user ถามเกี่ยวกับโรงแรม
        // =====================================================================
        const hotelKeywords = ['beds24', 'ห้อง', 'booking', 'จอง', 'ว่าง', 'เต็ม', 'check-in', 'check-out', 'checkin', 'checkout', 'แขก', 'guest', 'occupancy', 'โรงแรม', 'hotel', 'availability', 'วันนี้', 'พรุ่งนี้'];
        const isHotelQuery = hotelKeywords.some(kw => lowerMessage.includes(kw));

        if (isHotelQuery) {
          console.log('[LINE] Detected hotel query, fetching Beds24 data...');
          try {
            // Detect which date user is asking about
            const isTomorrow = lowerMessage.includes('พรุ่งนี้') || lowerMessage.includes('tomorrow');
            const isToday = lowerMessage.includes('วันนี้') || lowerMessage.includes('today');

            // Detect specific date like "วันที่ 9", "9 ก.พ.", "Feb 9"
            const dateMatch = userMessage.match(/วันที่\s*(\d{1,2})|(\d{1,2})\s*ก\.?พ\.?|Feb(?:ruary)?\s*(\d{1,2})|(\d{1,2})\s*Feb/i);
            const specificDay = dateMatch ? parseInt(dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[4]) : null;

            const today = new Date();
            let targetDate;
            let dateThai;

            if (specificDay) {
              // User asked for specific date - use current month/year
              targetDate = new Date(today.getFullYear(), today.getMonth(), specificDay);
              dateThai = `วันที่ ${specificDay} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][today.getMonth()]}`;
            } else if (isTomorrow) {
              targetDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
              dateThai = 'พรุ่งนี้';
            } else {
              targetDate = today;
              dateThai = 'วันนี้';
            }

            const dateStr = targetDate.toISOString().split('T')[0];

            // Fetch arrivals AND real occupancy for target date
            const [bookings, occupancy] = await Promise.all([
              beds24.getBookingsByDate(dateStr).catch(e => ({ error: e.message })),
              beds24.getOccupancyForDate(dateStr).catch(e => ({ error: e.message }))
            ]);

            contextString += `\n\n📊 **ข้อมูล Beds24 Real-time (${dateThai} ${dateStr}):**`;
            contextString += `\n🏨 The Arch Casa มี 11 ห้อง`;

            // Show REAL occupancy (don't show "ห้องว่าง" because some rooms might be closed for sale)
            if (occupancy && !occupancy.error) {
              contextString += `\n📈 **Occupancy ${dateThai}:** ${occupancy.occupied}/${occupancy.totalRooms} ห้อง (${occupancy.occupancyRate}%)`;
              // Note: ไม่แสดง "ห้องว่าง" เพราะบางห้องอาจปิดขายไว้ ต้องเช็คใน Beds24 Dashboard
              if (occupancy.occupied === occupancy.totalRooms) {
                contextString += `\n✅ **เต็มทุกห้อง!**`;
              }

              // Show all guests staying with check-in links (for Nati to share with guests)
              if (occupancy.bookings && occupancy.bookings.length > 0) {
                contextString += `\n\n**แขกทั้งหมดที่พัก ${dateThai} (${occupancy.bookings.length} ห้อง):**`;
                occupancy.bookings.forEach((b, i) => {
                  const guestName = (b.firstName && b.lastName) ? `${b.firstName} ${b.lastName}` : (b.guestName || 'Guest');
                  const roomInfo = b.roomSystemId ? `${b.roomSystemId}` : `Room ${b.roomId}`;
                  const checkinLink = b.id ? `https://thearchcasa.com/booking/${b.id}?lang=en` : null;
                  contextString += `\n${i+1}. **${roomInfo}**: ${guestName} (${b.arrival} → ${b.departure})`;
                  if (checkinLink) {
                    contextString += `\n   🔗 ${checkinLink}`;
                  }
                });
              }

              // Show checkouts if any
              if (occupancy.checkouts && occupancy.checkouts.length > 0) {
                contextString += `\n\n**Check-out ${dateThai}:** ${occupancy.checkouts.length} คน`;
                occupancy.checkouts.forEach(b => {
                  const guestName = (b.firstName && b.lastName) ? `${b.firstName} ${b.lastName}` : (b.guestName || 'Guest');
                  const roomInfo = b.roomSystemId ? `${b.roomSystemId}` : `Room ${b.roomId}`;
                  contextString += `\n- ${roomInfo}: ${guestName}`;
                });
              }

              // Add pricing recommendations if occupancy is low
              if (occupancy.available > 0 && occupancy.occupancyRate < 80) {
                try {
                  const pricingAdvice = await pricing.generatePricingAdvice(dateStr);
                  contextString += `\n\n${pricingAdvice}`;

                  // Add real-time urgency context for Oracle to think about
                  const urgencyContext = pricing.generateUrgencyContext(dateStr, occupancy.occupancyRate);
                  contextString += urgencyContext;
                } catch (pricingError) {
                  console.error('[Pricing] Error generating advice:', pricingError.message);
                }
              }
            }

            if (bookings && !bookings.error && Array.isArray(bookings)) {
              contextString += `\n📅 **Check-in ${dateThai}:** ${bookings.length} รายการ`;

              if (bookings.length > 0) {
                contextString += `\n\n**รายละเอียด Check-in:**`;
                bookings.forEach((b, i) => {
                  // Use enriched data from beds24.js (roomName, roomNameTh, guestName)
                  const nights = Math.ceil((new Date(b.departure) - new Date(b.arrival)) / (1000 * 60 * 60 * 24));
                  const checkinLink = b.id ? `https://thearchcasa.com/booking/${b.id}?lang=en` : null;
                  contextString += `\n${i+1}. **${b.guestName || 'Guest'}** (${b.country?.toUpperCase() || 'N/A'})`;
                  contextString += `\n   - Booking ID: ${b.id || 'N/A'}`;
                  contextString += `\n   - ห้อง: ${b.roomSystemId || ''} ${b.roomNameTh || b.roomName || `Room ${b.roomId}`}`;
                  contextString += `\n   - วันที่: ${b.arrival} → ${b.departure} (${nights} คืน)`;
                  contextString += `\n   - ผู้เข้าพัก: ${b.numAdult} ผู้ใหญ่${b.numChild > 0 ? `, ${b.numChild} เด็ก` : ''}`;
                  contextString += `\n   - ราคา: ฿${b.price?.toLocaleString() || 'N/A'}`;
                  contextString += `\n   - ช่องทาง: ${b.apiSource || b.referer || 'Direct'}`;
                  if (checkinLink) {
                    contextString += `\n   - 🔗 Self Check-in: ${checkinLink}`;
                  }
                });

                const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);
                contextString += `\n\n**รายได้จาก Check-in วันนี้:** ฿${totalRevenue.toLocaleString()}`;
              } else {
                contextString += ` (ไม่มี check-in ใหม่)`;
              }
            } else if (bookings?.error) {
              contextString += `\n⚠️ API Error: ${bookings.error}`;
            }

            console.log('[LINE] Beds24 data fetched successfully for', dateStr);
          } catch (apiError) {
            console.error('[LINE] Beds24 API error:', apiError.message);
            contextString += `\n[⚠️ Beds24 API error: ${apiError.message}]`;
          }
        }

        // =====================================================================
        // MEMORY CONSOLIDATION CONTEXT - ดึงข้อมูลจาก long-term memory ทุกครั้ง
        // =====================================================================
        try {
          const memoryContext = memoryConsolidation.getContextForAI(userMessage);

          // Add learnings (ความรู้ที่จำไว้)
          if (memoryContext.recentLearnings && memoryContext.recentLearnings.length > 0) {
            contextString += `\n\n📝 **Long-term Memory:**`;
            memoryContext.recentLearnings.forEach((mem) => {
              contextString += `\n- **${mem.topic}**: ${mem.insight}`;
            });
          }

          // Add relevant facts (ข้อเท็จจริงที่เกี่ยวข้องกับคำถาม)
          if (memoryContext.relevant && memoryContext.relevant.length > 0) {
            contextString += `\n\n🔍 **Relevant Facts:**`;
            memoryContext.relevant.forEach((mem) => {
              if (mem.subject) {
                contextString += `\n- ${mem.subject}: ${mem.object}`;
              } else if (mem.topic) {
                contextString += `\n- ${mem.topic}: ${mem.insight}`;
              }
            });
          }

          // Add preferences
          if (memoryContext.preferences && memoryContext.preferences.length > 0) {
            contextString += `\n\n⚙️ **User Preferences:**`;
            memoryContext.preferences.forEach((pref) => {
              contextString += `\n- ${pref.key}: ${pref.value}`;
            });
          }

          const totalMemory = (memoryContext.recentLearnings?.length || 0) +
                             (memoryContext.relevant?.length || 0) +
                             (memoryContext.preferences?.length || 0);
          if (totalMemory > 0) {
            console.log(`[LINE] Memory context: ${memoryContext.recentLearnings?.length || 0} learnings, ${memoryContext.relevant?.length || 0} relevant, ${memoryContext.preferences?.length || 0} prefs`);
          }
        } catch (memErr) {
          console.error('[LINE] Memory context error:', memErr.message);
        }

        // =====================================================================
        // IMAGE GENERATION - ถ้า user ขอ gen รูป ให้ทำเลย
        // =====================================================================
        if (imageGen.isImageRequest(userMessage)) {
          console.log('[LINE] Detected image generation request');
          try {
            const prompt = imageGen.extractPrompt(userMessage);
            console.log(`[LINE] Generating image: "${prompt}"`);

            // Send "กำลังสร้างรูป..." first
            await line.reply(replyToken, `🎨 กำลังสร้างรูป: "${prompt}"...\nรอสักครู่นะ (ประมาณ 30 วินาที)`);

            const result = await imageGen.generate(prompt);

            if (result.success) {
              // Send image via LINE
              await line.pushImage(userId, result.hostedUrl);
              await line.push(userId, `✅ สร้างรูปเสร็จแล้ว!\n\nPrompt: ${prompt}\n\n🔗 ${result.hostedUrl}`);
              console.log(`[LINE] Image sent: ${result.hostedUrl}`);
            } else {
              await line.push(userId, `❌ สร้างรูปไม่สำเร็จ: ${result.error}\n\nลองใหม่อีกครั้งนะ`);
            }

            // Save to memory
            await memory.saveConversation(userId, userMessage, `[Generated image: ${result.hostedUrl || 'failed'}]`);
            res.status(200).send('OK');
            return; // Exit early - don't go to Claude
          } catch (imgError) {
            console.error('[LINE] Image generation error:', imgError.message);
            // Fall through to Claude if image gen fails
          }
        }

        // Build messages for Claude
        const messages = [
          ...history.slice(-10), // Last 10 messages for context
          { role: 'user', content: userMessage }
        ];

        // Get response from Claude with enhanced context
        const systemPrompt = SYSTEM_PROMPT +
          (isOwner ? '\n\nนี่คือข้อความจาก Tars (เจ้าของ) - สามารถพูดคุยได้ตรงๆ' : '\n\nนี่คือข้อความจากลูกค้า - ตอบอย่างสุภาพและเป็นมืออาชีพ') +
          contextString;

        // =====================================================================
        // TYPING INDICATOR - แสดง "กำลังพิมพ์..." ระหว่าง AI คิด
        // =====================================================================
        const typingSessionId = `line:${userId}`;
        try {
          await typingIndicators.startTyping('line', userId, {
            channelToken: config.line.channel_token
          });
          console.log(`[TYPING] Started for ${userId}`);
        } catch (typingErr) {
          // Typing indicator is nice-to-have, don't fail on error
          console.log(`[TYPING] Could not start: ${typingErr.message}`);
        }

        let response = await claude.chat(messages, {
          system: systemPrompt
        });

        // =====================================================================
        // PHASE 5.4: SELF-REFLECTION - เช็คคำตอบก่อนส่ง
        // =====================================================================
        const reflection = selfReflection.check(response, {
          emojiAllowed: !isOwner, // Owner ไม่ต้อง emoji
          previousMistake: mistakeCheck.warnings.length > 0 ? mistakeCheck.warnings[0]?.message : null
        });

        if (reflection.blocked) {
          console.log(`[REFLECTION] BLOCKED: ${reflection.issues.map(i => i.message).join(', ')}`);
          // Don't send blocked response, use a safe fallback
          response = 'ขอโทษครับ มีปัญหาในการประมวลผล กรุณาลองใหม่อีกครั้ง';
        } else if (!reflection.ok) {
          console.log(`[REFLECTION] Issues: ${reflection.issues.map(i => i.message).join(', ')}`);
          // Try to auto-improve
          response = selfReflection.improve(response);
        }

        // Save to memory
        await memory.saveConversation(userId, userMessage, response);

        // Phase 3.5: Log assistant response to JSONL
        logAssistantMessage(sessionId, response, {
          channel: 'line',
          model: 'claude-sonnet',
          isOwner,
          sentiment: sentiment.mood,
          reflectionOk: reflection.ok
        });

        // Reply via LINE with smart chunking
        const chunks = smartChunk(response, { provider: 'line', markdown: true });

        if (chunks.length === 1) {
          // Single message - use reply
          await line.reply(replyToken, chunks[0]);
        } else {
          // Multiple chunks - reply first, then push remaining
          await line.reply(replyToken, chunks[0]);
          for (let i = 1; i < chunks.length; i++) {
            await new Promise(r => setTimeout(r, 300)); // Small delay between messages
            await line.push(userId, chunks[i]);
          }
          console.log(`[LINE] Sent ${chunks.length} chunks (smart-chunking)`);
        }

        // Stop typing indicator after response sent
        typingIndicators.stopTyping(typingSessionId);

        // =====================================================================
        // PHASE 5.4: QUALITY TRACKER - วัดคุณภาพคำตอบ
        // =====================================================================
        qualityTracker.score(response, {
          type: 'line_reply',
          topic: userMessage.substring(0, 50),
          expectedLength: sentiment.urgency === 'high' ? 200 : 500,
          formal: !isOwner
        });

        console.log(`[LINE] Replied to ${userId}: ${response.substring(0, 50)}...`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[LINE] Webhook error:', error);
    // Phase 3.5: Log error to JSONL
    logError('system', error, { source: 'webhook' });
    res.status(500).send('Error');
  }
});

// =============================================================================
// TELEGRAM WEBHOOK
// =============================================================================

app.post('/webhook/telegram', async (req, res) => {
  try {
    // Check if Telegram is enabled
    if (!config.telegram?.enabled) {
      return res.status(200).send('OK (disabled)');
    }

    const update = req.body;

    // Handle message updates
    if (update.message && update.message.text) {
      const msg = update.message;
      const chatId = msg.chat.id.toString();
      const userId = msg.from.id.toString();
      const userMessage = msg.text;
      const sessionId = `telegram:${chatId}`;

      console.log(`[TELEGRAM] Message from ${msg.from.username || userId}: ${userMessage}`);

      // Phase 3.5: Log user message to JSONL
      logUserMessage(sessionId, userMessage, {
        channel: 'telegram',
        username: msg.from.username,
        chatType: msg.chat.type,
        timestamp: msg.date * 1000
      });

      // Load conversation history
      const history = await memory.getConversation(chatId);

      // Check if this is owner
      const isOwner = userId === config.telegram?.owner_id?.toString();

      // Phase 2: Get intelligent context
      const context = await memory.getIntelligentContext();

      // Phase 3: Get autonomy suggestions
      const suggestions = autonomy.getProactiveSuggestions();
      const pendingApprovals = autonomy.getPendingApprovals();

      // Build context string for Claude
      let contextString = '';

      // Real-time Context (Standard: ทุก feature ต้องมี!)
      try {
        const rtContext = await realtimeContext.generateRealtimeContext({
          includeInvestment: isOwner,
          includeHotel: isOwner
        });
        if (rtContext) {
          contextString += rtContext;
        }
      } catch (rtErr) {
        console.error('[REALTIME] Context error:', rtErr.message);
      }

      if (context.current_focus) {
        contextString += `\n\n[Current Focus: ${context.current_focus.topic}]`;
      }
      if (pendingApprovals.length > 0 && isOwner) {
        contextString += `\n[Pending Approvals: ${pendingApprovals.length}]`;
      }
      if (suggestions.length > 0 && isOwner) {
        contextString += `\n[Suggestions: ${suggestions.map(s => s.message).join('; ')}]`;
      }

      // Build messages for Claude
      const messages = [
        ...history.slice(-10),
        { role: 'user', content: userMessage }
      ];

      // Get response from Claude
      const systemPrompt = SYSTEM_PROMPT +
        (isOwner ? '\n\nนี่คือข้อความจาก Tars (เจ้าของ) ผ่าน Telegram - สามารถพูดคุยได้ตรงๆ' : '\n\nนี่คือข้อความจากผู้ใช้ทาง Telegram - ตอบอย่างสุภาพและเป็นมืออาชีพ') +
        contextString;

      const response = await claude.chat(messages, {
        system: systemPrompt
      });

      // Save to memory
      await memory.saveConversation(chatId, userMessage, response);

      // Phase 3.5: Log assistant response
      logAssistantMessage(sessionId, response, {
        channel: 'telegram',
        model: 'claude-sonnet',
        isOwner
      });

      // Reply via Telegram with smart chunking
      const telegramChunks = smartChunk(response, { provider: 'telegram', markdown: true });

      for (let i = 0; i < telegramChunks.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 300));
        await telegram.send(chatId, telegramChunks[i]);
      }
      if (telegramChunks.length > 1) {
        console.log(`[TELEGRAM] Sent ${telegramChunks.length} chunks (smart-chunking)`);
      }

      console.log(`[TELEGRAM] Replied to ${msg.from.username || userId}: ${response.substring(0, 50)}...`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[TELEGRAM] Webhook error:', error);
    logError('system', error, { source: 'telegram-webhook' });
    res.status(500).send('Error');
  }
});

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    name: config.agent.name,
    version: config.agent.version,
    status: 'running',
    mode: 'router',
    uptime: process.uptime()
  });
});

// Dedicated /health endpoint for Railway healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: config.agent.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Router status
app.get('/api/router/status', async (req, res) => {
  const localOnline = await checkLocalHealth();
  res.json({
    mode: 'failover-router',
    local: {
      url: LOCAL_TUNNEL_URL || 'not configured',
      online: localOnline,
      lastCheck: new Date(localStatus.lastCheck).toISOString(),
      cost: 'FREE (Claude Max)'
    },
    railway: {
      status: 'always-on',
      cost: 'PAID (Anthropic API)'
    },
    activeHandler: localOnline ? 'local' : 'railway'
  });
});

// Gateway status (Multi-Channel)
app.get('/api/gateway/status', (req, res) => {
  res.json(gateway.getStatus());
});

// Setup Telegram webhook
app.post('/api/gateway/telegram/setup', async (req, res) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) {
      return res.status(400).json({ error: 'webhook_url required' });
    }

    const result = await telegram.setWebhook(webhook_url);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test notify owner via gateway
app.post('/api/gateway/notify', async (req, res) => {
  try {
    const { message, channels } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    const results = await gateway.notifyOwner(message, channels);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// TRUST POLICY ENDPOINTS
// =============================================================================

// Get trust levels info
app.get('/api/trust/levels', (req, res) => {
  const { TrustPolicyManager } = require('./lib/trust-policy.js');
  res.json(TrustPolicyManager.getTrustLevelsInfo());
});

// Get trust policy for a user
app.get('/api/trust/user/:channel/:userId', (req, res) => {
  const { channel, userId } = req.params;
  const summary = trustPolicy.getSummary(channel, userId);
  res.json(summary);
});

// Check if user can perform action
app.post('/api/trust/check', (req, res) => {
  const { channel, userId, action } = req.body;
  if (!channel || !userId || !action) {
    return res.status(400).json({ error: 'channel, userId, and action required' });
  }

  const result = trustPolicy.canPerform(channel, userId, action);
  res.json(result);
});

// =============================================================================
// TOOL POLICY ENDPOINTS (Auto-Run)
// =============================================================================

// Get tool policy status
app.get('/api/tools/policy', (req, res) => {
  res.json(toolPolicy.getStatus());
});

// Check if tool is allowed
app.post('/api/tools/check', (req, res) => {
  const { trustLevel, tool } = req.body;
  if (!trustLevel || !tool) {
    return res.status(400).json({ error: 'trustLevel and tool required' });
  }

  const result = toolPolicy.isToolAllowed(trustLevel, tool);
  res.json(result);
});

// Check if command can execute
app.post('/api/tools/exec-check', (req, res) => {
  const { trustLevel, command } = req.body;
  if (!trustLevel || !command) {
    return res.status(400).json({ error: 'trustLevel and command required' });
  }

  const result = toolPolicy.canExecute(trustLevel, command);
  res.json(result);
});

// Add to exec allowlist
app.post('/api/tools/allowlist', (req, res) => {
  const { pattern } = req.body;
  if (!pattern) {
    return res.status(400).json({ error: 'pattern required' });
  }

  toolPolicy.addToAllowlist(pattern);
  res.json({ success: true, pattern });
});

// =============================================================================
// VOICE ENDPOINTS (TTS/STT)
// =============================================================================

// Get voice status
app.get('/api/voice/status', (req, res) => {
  res.json(voiceManager.getStatus());
});

// Get available voices
app.get('/api/voice/voices', (req, res) => {
  res.json(voiceManager.getAvailableVoices());
});

// Text-to-Speech
app.post('/api/voice/tts', async (req, res) => {
  try {
    const { text, voice, provider } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    const result = await voiceManager.textToSpeech(text, { voice, provider });

    // Return audio file path (or could stream the audio)
    res.json({
      success: true,
      audioPath: result.audioPath,
      provider: result.provider,
      textLength: result.textLength
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Speech-to-Text
app.post('/api/voice/stt', async (req, res) => {
  try {
    // Expects audio file in request body or as multipart
    const { audioPath, language } = req.body;
    if (!audioPath) {
      return res.status(400).json({ error: 'audioPath required' });
    }

    const result = await voiceManager.speechToText(audioPath, { language });
    res.json({
      success: true,
      text: result.text,
      language: result.language
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// BROADCAST GROUPS ENDPOINTS
// =============================================================================

// Get broadcast status
app.get('/api/broadcast/status', (req, res) => {
  res.json(broadcastManager.getStatus());
});

// Get available groups
app.get('/api/broadcast/groups', (req, res) => {
  res.json(broadcastManager.getGroups());
});

// Get available agents
app.get('/api/broadcast/agents', (req, res) => {
  res.json(broadcastManager.getAgents());
});

// Broadcast message to group
app.post('/api/broadcast', async (req, res) => {
  try {
    const { groupId, message, maxTokens } = req.body;
    if (!groupId || !message) {
      return res.status(400).json({ error: 'groupId and message required' });
    }

    const responses = await broadcastManager.broadcast(groupId, message, { maxTokens });
    const formatted = broadcastManager.formatResponses(responses);

    res.json({
      success: true,
      groupId,
      responseCount: responses.length,
      responses,
      formatted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// CODING AGENT ORCHESTRATOR ENDPOINTS
// =============================================================================

// Get orchestrator status
app.get('/api/coding/status', (req, res) => {
  res.json(codingOrchestrator.getStatus());
});

// Get active processes
app.get('/api/coding/active', (req, res) => {
  res.json(codingOrchestrator.getActive());
});

// Spawn a coding agent
app.post('/api/coding/spawn', async (req, res) => {
  try {
    const { agent, task, workdir, timeout, args } = req.body;
    if (!task) {
      return res.status(400).json({ error: 'task required' });
    }

    const result = await codingOrchestrator.spawn({
      agent,
      task,
      workdir,
      timeout,
      args
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get process info
app.get('/api/coding/process/:runId', (req, res) => {
  const processInfo = codingOrchestrator.getProcess(req.params.runId);
  if (!processInfo) {
    return res.status(404).json({ error: 'Process not found' });
  }
  res.json(processInfo);
});

// Get process output
app.get('/api/coding/output/:runId', (req, res) => {
  const { tail, type } = req.query;
  const output = codingOrchestrator.getOutput(req.params.runId, {
    tail: tail ? parseInt(tail) : undefined,
    type
  });

  if (!output) {
    return res.status(404).json({ error: 'Process not found' });
  }
  res.json(output);
});

// Send input to process
app.post('/api/coding/input/:runId', (req, res) => {
  try {
    const { input } = req.body;
    if (!input) {
      return res.status(400).json({ error: 'input required' });
    }

    codingOrchestrator.sendInput(req.params.runId, input);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop a process
app.post('/api/coding/stop/:runId', (req, res) => {
  const success = codingOrchestrator.stop(req.params.runId);
  res.json({ success });
});

// Stop all processes
app.post('/api/coding/stop-all', (req, res) => {
  const stopped = codingOrchestrator.stopAll();
  res.json({ success: true, stopped });
});

// Clear completed processes
app.post('/api/coding/clear', (req, res) => {
  const cleared = codingOrchestrator.clearCompleted();
  res.json({ success: true, cleared });
});

// =============================================================================
// MODEL FAILOVER API
// =============================================================================

// Get model failover status
app.get('/api/models/status', (req, res) => {
  res.json(modelFailover.getStatus());
});

// Send message with failover + thinking levels
app.post('/api/models/send', async (req, res) => {
  try {
    const {
      message,
      system,
      model,
      maxTokens,
      temperature,
      preferProvider,
      thinkingLevel,        // explicit: off, minimal, low, medium, high, xhigh
      autoThinking = true   // auto-detect thinking level
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await modelFailover.send({
      message,
      system,
      model,
      maxTokens,
      temperature,
      preferProvider,
      thinkingLevel,
      autoThinking
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get combined status (Model Failover + Thinking Levels)
app.get('/api/models/combined-status', (req, res) => {
  res.json(modelFailover.getCombinedStatus());
});

// Health check all providers
app.post('/api/models/health-check', async (req, res) => {
  try {
    const results = await modelFailover.healthCheck();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset stats
app.post('/api/models/reset-stats', (req, res) => {
  modelFailover.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// WEBHOOK INGRESS API
// =============================================================================

// Get webhook status
app.get('/api/webhooks/status', (req, res) => {
  res.json(webhookIngress.getStatus());
});

// Get webhook history
app.get('/api/webhooks/history', (req, res) => {
  const { source, status, limit } = req.query;
  const history = webhookIngress.getHistory({
    source,
    status,
    limit: limit ? parseInt(limit) : 50
  });
  res.json({ history, count: history.length });
});

// Get specific webhook
app.get('/api/webhooks/:webhookId', (req, res) => {
  const webhook = webhookIngress.getWebhook(req.params.webhookId);
  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  res.json(webhook);
});

// Clear webhook history
app.post('/api/webhooks/clear', (req, res) => {
  webhookIngress.clearHistory();
  res.json({ success: true, message: 'History cleared' });
});

// Generic webhook endpoint
app.post('/webhook/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const result = await webhookIngress.process(source, req.body, req.headers);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Beds24 webhook endpoint
app.post('/webhook/beds24', async (req, res) => {
  try {
    const result = await webhookIngress.process('beds24', req.body, req.headers);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook endpoint
app.post('/webhook/stripe', async (req, res) => {
  try {
    const result = await webhookIngress.process('stripe', req.body, req.headers);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GitHub webhook endpoint
app.post('/webhook/github', async (req, res) => {
  try {
    const result = await webhookIngress.process('github', req.body, req.headers);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TrackingMore webhook endpoint - แจ้งเตือน LINE เมื่อสถานะพัสดุเปลี่ยน
app.post('/webhook/trackingmore', async (req, res) => {
  try {
    const data = req.body;
    console.log('[TRACKINGMORE] Webhook received:', JSON.stringify(data).slice(0, 500));

    // TrackingMore sends array of tracking updates
    const updates = Array.isArray(data) ? data : [data];

    for (const update of updates) {
      const trackingNumber = update.tracking_number;
      const status = update.delivery_status;
      const latestEvent = update.latest_event;
      const location = update.origin_info?.trackinfo?.[0]?.location;

      // Update watchlist and check if we should notify
      const watchlistResult = parcelWatchlist.updateParcelStatus(
        trackingNumber,
        status,
        location,
        latestEvent
      );

      // Only notify if parcel is in watchlist AND status changed
      if (!watchlistResult.found) {
        console.log('[TRACKINGMORE] Parcel not in watchlist, skipping notification:', trackingNumber);
        continue;
      }

      if (!watchlistResult.shouldNotify) {
        console.log('[TRACKINGMORE] Status unchanged, skipping notification:', trackingNumber);
        continue;
      }

      // Status translations
      const statusTh = {
        'transit': 'กำลังจัดส่ง',
        'pickup': 'รับพัสดุแล้ว',
        'delivered': 'จัดส่งแล้ว ✅',
        'undelivered': 'นำจ่ายไม่สำเร็จ ❌',
        'exception': 'มีปัญหา ⚠️',
        'expired': 'หมดอายุ'
      }[status] || status;

      // Build LINE message
      let message = `📦 **พัสดุ ${trackingNumber}**\n`;
      if (watchlistResult.parcel?.description) {
        message += `📝 ${watchlistResult.parcel.description}\n`;
      }
      message += `📍 สถานะ: ${statusTh}\n`;
      if (location) message += `📍 ตำแหน่ง: ${location}\n`;
      if (latestEvent) message += `💬 ${latestEvent}`;

      // Add delivered message
      if (status === 'delivered') {
        message += `\n\n✅ พัสดุถึงแล้ว! ลบออกจาก watchlist อัตโนมัติ`;
        // Auto-remove from watchlist after delivered
        setTimeout(() => {
          parcelWatchlist.removeFromWatchlist(trackingNumber);
          console.log('[WATCHLIST] Auto-removed delivered parcel:', trackingNumber);
        }, 5000);
      }

      // Send LINE notification to owner
      if (config.line?.owner_id) {
        await line.pushMessage(config.line.owner_id, message);
        console.log('[TRACKINGMORE] Sent LINE notification for', trackingNumber);
      }
    }

    res.json({ success: true, processed: updates.length });
  } catch (error) {
    console.error('[TRACKINGMORE] Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PARCEL WATCHLIST API
// =============================================================================

// Get all parcels in watchlist
app.get('/api/watchlist', (req, res) => {
  res.json({
    success: true,
    parcels: parcelWatchlist.getWatchlist()
  });
});

// Add parcel to watchlist
app.post('/api/watchlist', async (req, res) => {
  try {
    const { trackingNumber, description } = req.body;
    if (!trackingNumber) {
      return res.status(400).json({ error: 'trackingNumber required' });
    }
    const result = await parcelWatchlist.addToWatchlist(trackingNumber, { description });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove parcel from watchlist
app.delete('/api/watchlist/:trackingNumber', (req, res) => {
  const result = parcelWatchlist.removeFromWatchlist(req.params.trackingNumber);
  res.json(result);
});

// Refresh all parcels in watchlist
app.post('/api/watchlist/refresh', async (req, res) => {
  try {
    const results = await parcelWatchlist.refreshAllParcels();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// AUTONOMOUS LOOP API
// =============================================================================

// Get autonomous loop status
app.get('/api/autonomous/status', (req, res) => {
  res.json(autonomousLoop.getStatus());
});

// Start autonomous loop
app.post('/api/autonomous/start', (req, res) => {
  const interval = req.body.intervalMinutes || 30;
  autonomousLoop.startLoop(interval);
  res.json({ success: true, message: `Loop started (every ${interval} minutes)` });
});

// Stop autonomous loop
app.post('/api/autonomous/stop', (req, res) => {
  autonomousLoop.stopLoop();
  res.json({ success: true, message: 'Loop stopped' });
});

// Trigger thinking cycle manually
app.post('/api/autonomous/think', async (req, res) => {
  try {
    const thought = await autonomousLoop.generateThought();
    if (thought && thought.notify) {
      await autonomousLoop.notifyThought(thought);
    }
    res.json({ success: true, thought });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task queue
app.get('/api/autonomous/tasks', (req, res) => {
  res.json({
    pending: autonomousLoop.getPendingTasks(),
    queue: autonomousLoop.loadTaskQueue()
  });
});

// Add task to queue
app.post('/api/autonomous/tasks', (req, res) => {
  const task = autonomousLoop.addTask(req.body);
  res.json({ success: true, task });
});

// Complete task
app.post('/api/autonomous/tasks/:taskId/complete', (req, res) => {
  const task = autonomousLoop.completeTask(req.params.taskId, req.body.result);
  res.json({ success: true, task });
});

// =============================================================================
// LOCAL AGENT API (Phase 6: Remote Execution)
// =============================================================================

// Get Local Agent status
app.get('/api/local-agent/status', (req, res) => {
  res.json(localAgentServer.getStatus());
});

// Execute shell command on Local Agent
app.post('/api/local-agent/shell', async (req, res) => {
  try {
    const { command, cwd, timeout, approved } = req.body;

    if (!localAgentServer.isConnected()) {
      return res.status(503).json({
        success: false,
        error: 'No local agent connected. Please start local-agent.js on your Mac.'
      });
    }

    const result = await localAgentServer.executeShell(command, { cwd, timeout, approved });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute Claude Code on Local Agent
app.post('/api/local-agent/claude-code', async (req, res) => {
  try {
    const { prompt, cwd, timeout } = req.body;

    if (!localAgentServer.isConnected()) {
      return res.status(503).json({
        success: false,
        error: 'No local agent connected. Please start local-agent.js on your Mac.'
      });
    }

    const result = await localAgentServer.executeClaudeCode(prompt, { cwd, timeout });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// File operation on Local Agent
app.post('/api/local-agent/file', async (req, res) => {
  try {
    const { operation, filePath, content, encoding } = req.body;

    if (!localAgentServer.isConnected()) {
      return res.status(503).json({
        success: false,
        error: 'No local agent connected. Please start local-agent.js on your Mac.'
      });
    }

    const result = await localAgentServer.fileOperation(operation, { filePath, content, encoding });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system info from Local Agent
app.get('/api/local-agent/system-info', async (req, res) => {
  try {
    if (!localAgentServer.isConnected()) {
      return res.status(503).json({
        success: false,
        error: 'No local agent connected'
      });
    }

    const result = await localAgentServer.getSystemInfo();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve pending command
app.post('/api/local-agent/approve/:approvalId', async (req, res) => {
  try {
    const result = await localAgentServer.approveCommand(req.params.approvalId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject pending command
app.post('/api/local-agent/reject/:approvalId', async (req, res) => {
  try {
    const result = await localAgentServer.rejectCommand(req.params.approvalId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// WORKFLOW API (Terminal + Claude Code + Deploy)
// =============================================================================

// Active workflows storage
const activeWorkflows = new Map();

// Execute workflow - เปิด Terminal รัน Claude + Deploy
app.post('/api/local-agent/workflow', async (req, res) => {
  const { projectName, prompt, model = 'opus', deploy = true, notifyLine = true, projectPath } = req.body;

  if (!projectName || !prompt) {
    return res.status(400).json({ success: false, error: 'projectName and prompt are required' });
  }

  try {
    const result = await localAgentServer.executeWorkflow({
      projectName,
      prompt,
      model,
      deploy,
      notifyLine,
      projectPath
    });

    if (result.success && result.workflowId) {
      activeWorkflows.set(result.workflowId, {
        projectName,
        prompt,
        status: 'started',
        startedAt: new Date().toISOString()
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflow status update (called by workflow script)
app.post('/api/workflow/status', (req, res) => {
  const { id, status, message, projectName } = req.body;
  console.log(`[WORKFLOW] Status update: ${id} → ${status}`, message || '');

  if (activeWorkflows.has(id)) {
    const workflow = activeWorkflows.get(id);
    workflow.status = status;
    workflow.lastUpdate = new Date().toISOString();
    if (message) workflow.lastMessage = message;
  } else {
    activeWorkflows.set(id, {
      projectName: projectName || 'Unknown',
      status,
      lastUpdate: new Date().toISOString()
    });
  }

  res.json({ success: true });
});

// Workflow complete (called by workflow script when done)
app.post('/api/workflow/complete', async (req, res) => {
  const { id, status, projectName, projectPath, url, notifyLine } = req.body;
  console.log(`[WORKFLOW] Complete: ${id}`, { projectName, url });

  // Update workflow status
  if (activeWorkflows.has(id)) {
    const workflow = activeWorkflows.get(id);
    workflow.status = status;
    workflow.completedAt = new Date().toISOString();
    workflow.url = url;
  }

  // Send LINE notification if requested
  if (notifyLine && config.line.owner_id) {
    try {
      let message = `✅ Workflow เสร็จแล้ว!\n\n`;
      message += `📁 Project: ${projectName}\n`;
      if (projectPath) message += `📂 Path: ${projectPath}\n`;
      if (url) message += `🔗 URL: ${url}\n`;
      message += `\n🕐 ${new Date().toLocaleString('th-TH')}`;

      await line.pushMessage(config.line.owner_id, message);
      console.log('[WORKFLOW] LINE notification sent');
    } catch (err) {
      console.error('[WORKFLOW] Failed to send LINE notification:', err.message);
    }
  }

  res.json({ success: true });
});

// Get workflow status
app.get('/api/workflow/:id', (req, res) => {
  const workflow = activeWorkflows.get(req.params.id);
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }
  res.json(workflow);
});

// List all workflows
app.get('/api/workflows', (req, res) => {
  const workflows = [];
  for (const [id, workflow] of activeWorkflows.entries()) {
    workflows.push({ id, ...workflow });
  }
  res.json({ workflows });
});

// Open Terminal with command
app.post('/api/local-agent/open-terminal', async (req, res) => {
  const { command } = req.body;
  try {
    const result = await localAgentServer.openTerminal(command);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Open application on Mac
app.post('/api/local-agent/open-app', async (req, res) => {
  const { appName } = req.body;
  if (!appName) {
    return res.status(400).json({ success: false, error: 'appName is required' });
  }
  try {
    const result = await localAgentServer.openApp(appName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// AUTONOMOUS IDEAS API - Oracle คิดเอง ทำเอง
// =============================================================================

// Get ideas status
app.get('/api/ideas/status', (req, res) => {
  res.json(autonomousIdeas.getStatus());
});

// Get all ideas
app.get('/api/ideas', (req, res) => {
  const data = autonomousIdeas.getIdeas();
  res.json({
    total: data.ideas.length,
    ideas: data.ideas.slice(0, 20), // Return latest 20
    executed: data.executedIdeas.length,
    lastThinking: data.lastThinking
  });
});

// Force thinking cycle now
app.post('/api/ideas/think', async (req, res) => {
  console.log('[IDEAS] Manual thinking cycle triggered');
  try {
    const result = await autonomousIdeas.thinkNow(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute a specific idea
app.post('/api/ideas/execute/:name', async (req, res) => {
  const { name } = req.params;
  console.log(`[IDEAS] Manual execution requested for: ${name}`);
  try {
    const result = await autonomousIdeas.executeIdeaByName(name, config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Research trends in a category
app.get('/api/ideas/research/:category', async (req, res) => {
  const { category } = req.params;
  try {
    const trends = await autonomousIdeas.researchTrends(category);
    res.json({ category, trends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GMAIL PUB/SUB API
// =============================================================================

// Get Gmail status
app.get('/api/gmail/status', (req, res) => {
  res.json(gmailPubSub.getStatus());
});

// Gmail webhook (for Google Pub/Sub push)
app.post('/webhook/gmail', async (req, res) => {
  try {
    // Decode Pub/Sub message if present
    let payload = req.body;

    if (req.body.message && req.body.message.data) {
      // Pub/Sub push format
      const data = Buffer.from(req.body.message.data, 'base64').toString();
      payload = JSON.parse(data);
    }

    const result = await gmailPubSub.processWebhook(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process email manually (for testing)
app.post('/api/gmail/process', async (req, res) => {
  try {
    const email = await gmailPubSub.processEmail(req.body);
    res.json({ success: true, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset Gmail stats
app.post('/api/gmail/reset-stats', (req, res) => {
  gmailPubSub.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// QUEUE MANAGER API
// =============================================================================

// Get queue status
app.get('/api/queue/status', (req, res) => {
  res.json(queueManager.getStatus());
});

// Get specific lane status
app.get('/api/queue/lane/:lane', (req, res) => {
  const status = queueManager.getLaneStatus(req.params.lane);
  if (!status.config) {
    return res.status(404).json({ error: 'Lane not found' });
  }
  res.json(status);
});

// Enqueue message
app.post('/api/queue/enqueue', async (req, res) => {
  try {
    const { message, lane, sessionId, priority } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await queueManager.enqueue(message, {
      lane,
      sessionId,
      priority
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Format batched message (utility endpoint)
app.post('/api/queue/format', (req, res) => {
  try {
    const formatted = queueManager.formatBatchedMessage(req.body);
    res.json({ formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update lane config
app.post('/api/queue/lane/:lane/config', (req, res) => {
  try {
    const config = queueManager.updateLaneConfig(req.params.lane, req.body);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear lane
app.post('/api/queue/lane/:lane/clear', (req, res) => {
  const cleared = queueManager.clearLane(req.params.lane);
  res.json({ success: true, cleared });
});

// Clear all queues
app.post('/api/queue/clear-all', (req, res) => {
  const cleared = queueManager.clearAll();
  res.json({ success: true, cleared });
});

// Reset queue stats
app.post('/api/queue/reset-stats', (req, res) => {
  queueManager.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// THINKING LEVELS API
// =============================================================================

// Get thinking levels status
app.get('/api/thinking/status', (req, res) => {
  res.json(thinkingLevels.getStatus());
});

// Get all available levels
app.get('/api/thinking/levels', (req, res) => {
  res.json(thinkingLevels.getLevels());
});

// Detect level for a message
app.post('/api/thinking/detect', (req, res) => {
  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const level = thinkingLevels.detectLevel(message, context);
  const config = thinkingLevels.getConfig(level);

  res.json({ level, config });
});

// Process message with thinking level
app.post('/api/thinking/process', (req, res) => {
  const { message, level, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const result = thinkingLevels.process(message, { level, context });
  res.json(result);
});

// Estimate cost for a message
app.post('/api/thinking/estimate-cost', (req, res) => {
  const { message, model } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const estimate = thinkingLevels.estimateCost(message, model);
  res.json(estimate);
});

// Toggle reasoning visibility
app.post('/api/thinking/toggle-reasoning', (req, res) => {
  const visible = thinkingLevels.toggleReasoning();
  res.json({ success: true, reasoningVisible: visible });
});

// Set reasoning visibility
app.post('/api/thinking/reasoning', (req, res) => {
  const { visible } = req.body;
  const result = thinkingLevels.setReasoning(visible);
  res.json({ success: true, reasoningVisible: result });
});

// Reset thinking stats
app.post('/api/thinking/reset-stats', (req, res) => {
  thinkingLevels.resetStats();
  res.json({ success: true, message: 'Stats reset' });
});

// =============================================================================
// TIER 1: TYPING INDICATORS, VERBOSE, DEBUG, REACTIONS
// =============================================================================

// Typing Indicators
app.get('/api/typing/status', (req, res) => {
  res.json(typingIndicators.getStatus());
});

app.post('/api/typing/start', async (req, res) => {
  const { channel, target, credentials } = req.body;
  await typingIndicators.startTyping(channel, target, credentials);
  res.json({ success: true });
});

app.post('/api/typing/stop', (req, res) => {
  const { sessionId } = req.body;
  typingIndicators.stopTyping(sessionId);
  res.json({ success: true });
});

// Verbose Mode
app.get('/api/verbose/status', (req, res) => {
  res.json(verboseMode.getStatus());
});

app.post('/api/verbose/set', (req, res) => {
  const { sessionId, mode } = req.body;
  try {
    const newMode = verboseMode.setMode(sessionId, mode);
    res.json({ success: true, mode: newMode });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/verbose/calls/:sessionId', (req, res) => {
  const calls = verboseMode.getToolCalls(req.params.sessionId, 20);
  res.json({ calls });
});

// Debug Command
app.get('/api/debug/status', (req, res) => {
  res.json(debugCommand.getStatus());
});

app.post('/api/debug/command', (req, res) => {
  const { sessionId, command } = req.body;
  const result = debugCommand.handleCommand(sessionId, command);
  if (result) {
    res.json(result);
  } else {
    res.status(400).json({ error: 'Invalid debug command' });
  }
});

app.get('/api/debug/keys', (req, res) => {
  res.json(debugCommand._handleKeys());
});

// Reactions
app.get('/api/reactions/status', (req, res) => {
  res.json(reactions.getStatus());
});

app.get('/api/reactions/types', (req, res) => {
  res.json({
    types: reactions.getTypes(),
    shortcuts: reactions.getShortcuts()
  });
});

app.post('/api/reactions/add', async (req, res) => {
  const { channel, messageId, emoji, credentials, context } = req.body;
  const result = await reactions.addReaction(channel, messageId, emoji, credentials, context);
  res.json(result);
});

app.post('/api/reactions/remove', async (req, res) => {
  const { channel, messageId, emoji, credentials, context } = req.body;
  const result = await reactions.removeReaction(channel, messageId, emoji, credentials, context);
  res.json(result);
});

// =============================================================================
// TIER 2: LOCAL MODELS, FIRECRAWL
// =============================================================================

// Local Models
app.get('/api/local-models/status', (req, res) => {
  res.json(localModels.getStatus());
});

app.get('/api/local-models/providers', (req, res) => {
  res.json(localModels.getProviders());
});

app.post('/api/local-models/health', async (req, res) => {
  const { provider } = req.body;
  const health = await localModels.checkHealth(provider || 'ollama');
  res.json(health);
});

app.get('/api/local-models/models/:provider', async (req, res) => {
  try {
    const models = await localModels.listModels(req.params.provider);
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/local-models/send', async (req, res) => {
  try {
    const result = await localModels.send(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Firecrawl
app.get('/api/firecrawl/status', (req, res) => {
  res.json(firecrawl.getStatus());
});

app.post('/api/firecrawl/fetch', async (req, res) => {
  try {
    const { url, options } = req.body;
    const result = await firecrawl.fetch(url, options);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/firecrawl/crawl', async (req, res) => {
  try {
    const { url, options } = req.body;
    const result = await firecrawl.crawl(url, options);
    res.json({ success: true, pages: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// TIER 3: LOBSTER, OPENTELEMETRY, PRESENCE
// =============================================================================

// Lobster Workflows
app.get('/api/lobster/status', (req, res) => {
  res.json(lobster.getStatus());
});

app.get('/api/lobster/workflows', (req, res) => {
  res.json({ workflows: lobster.list() });
});

app.get('/api/lobster/workflow/:name', (req, res) => {
  const workflow = lobster.get(req.params.name);
  if (workflow) {
    res.json(workflow);
  } else {
    res.status(404).json({ error: 'Workflow not found' });
  }
});

app.post('/api/lobster/run', async (req, res) => {
  try {
    const { name, variables } = req.body;
    const result = await lobster.run(name, variables);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lobster/register', (req, res) => {
  const { name, workflow } = req.body;
  lobster.register(name, workflow);
  res.json({ success: true, message: `Workflow ${name} registered` });
});

// OpenTelemetry
app.get('/api/otel/status', (req, res) => {
  res.json(otel.getStatus());
});

app.get('/api/otel/metrics', (req, res) => {
  res.json(otel.getMetrics());
});

app.get('/api/otel/traces', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ traces: otel.getTraces(limit) });
});

// Presence
app.get('/api/presence/status', (req, res) => {
  res.json(presence.getStatus());
});

app.get('/api/presence/online', (req, res) => {
  res.json({ users: presence.getOnlineUsers() });
});

app.get('/api/presence/user/:userId', (req, res) => {
  res.json(presence.get(req.params.userId));
});

app.post('/api/presence/update', (req, res) => {
  const { userId, deviceId, state, platform, metadata } = req.body;
  presence.update(userId, deviceId, { state, platform, metadata });
  res.json({ success: true });
});

app.post('/api/presence/activity', (req, res) => {
  const { userId, deviceId } = req.body;
  presence.activity(userId, deviceId);
  res.json({ success: true });
});

// =============================================================================
// PHASE 5.4: SELF-IMPROVEMENT ENDPOINTS
// =============================================================================

// Mistake Tracker
app.get('/api/mistakes/status', (req, res) => {
  res.json(mistakeTracker.getStatus());
});

app.get('/api/mistakes/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(mistakeTracker.getRecent(limit));
});

app.get('/api/mistakes/stats', (req, res) => {
  res.json(mistakeTracker.getStats());
});

app.get('/api/mistakes/weak-areas', (req, res) => {
  res.json(mistakeTracker.getWeakAreas());
});

app.get('/api/mistakes/rules', (req, res) => {
  res.json(mistakeTracker.getPreventionRules());
});

app.post('/api/mistakes/record', (req, res) => {
  const mistake = req.body;
  const entry = mistakeTracker.record(mistake);
  res.json({ success: true, entry });
});

app.post('/api/mistakes/check', (req, res) => {
  const intent = req.body;
  const result = mistakeTracker.checkBeforeResponding(intent);
  res.json(result);
});

// Self-Reflection
app.get('/api/reflection/status', (req, res) => {
  res.json(selfReflection.getStatus());
});

app.get('/api/reflection/stats', (req, res) => {
  res.json(selfReflection.getStats());
});

app.get('/api/reflection/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(selfReflection.getRecent(limit));
});

app.post('/api/reflection/check', (req, res) => {
  const { response, context } = req.body;
  const result = selfReflection.check(response, context);
  res.json(result);
});

app.post('/api/reflection/improve', (req, res) => {
  const { response } = req.body;
  const improved = selfReflection.improve(response);
  res.json({ original: response, improved, changed: response !== improved });
});

// =============================================================================
// USER PROFILES API (Phase 5.6)
// =============================================================================

app.get('/api/profiles', (req, res) => {
  res.json(userProfiles.getAllProfiles());
});

app.get('/api/profiles/:userId', (req, res) => {
  const profile = userProfiles.getProfile(req.params.userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  res.json(profile);
});

app.post('/api/profiles/:userId', (req, res) => {
  const { name, role, preferences } = req.body;
  const profile = userProfiles.updateProfile(req.params.userId, { name, role, preferences });
  res.json(profile);
});

app.post('/api/profiles/:userId/partner', (req, res) => {
  const { name, preferences } = req.body;
  const profile = userProfiles.setAsPartner(req.params.userId, name, preferences);
  res.json(profile);
});

app.delete('/api/profiles/:userId', (req, res) => {
  const deleted = userProfiles.deleteProfile(req.params.userId);
  res.json({ deleted });
});

app.get('/api/profiles/:userId/context', (req, res) => {
  res.json(userProfiles.getAIContext(req.params.userId));
});

// Sentiment Analysis
app.get('/api/sentiment/status', (req, res) => {
  res.json(sentimentAnalysis.getStatus());
});

app.get('/api/sentiment/stats', (req, res) => {
  res.json(sentimentAnalysis.getStats());
});

app.get('/api/sentiment/history/:userId', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(sentimentAnalysis.getHistory(req.params.userId, limit));
});

app.get('/api/sentiment/mood/:userId', (req, res) => {
  res.json(sentimentAnalysis.getMood(req.params.userId));
});

app.post('/api/sentiment/analyze', (req, res) => {
  const { message, userId } = req.body;
  const result = sentimentAnalysis.analyze(message, userId);
  res.json(result);
});

app.post('/api/sentiment/is-upset', (req, res) => {
  const { userId } = req.body;
  res.json({ upset: sentimentAnalysis.isUpset(userId) });
});

// Quality Tracker
app.get('/api/quality/status', (req, res) => {
  res.json(qualityTracker.getStatus());
});

app.get('/api/quality/stats', (req, res) => {
  res.json(qualityTracker.getStats());
});

app.get('/api/quality/report', (req, res) => {
  res.json(qualityTracker.getReport());
});

app.get('/api/quality/trend', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  res.json(qualityTracker.getTrend(days));
});

app.get('/api/quality/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(qualityTracker.getRecent(limit));
});

app.post('/api/quality/score', (req, res) => {
  const { response, context, feedback } = req.body;
  const result = qualityTracker.score(response, context, feedback);
  res.json(result);
});

app.post('/api/quality/feedback', (req, res) => {
  const { recordId, feedback } = req.body;
  const record = qualityTracker.addFeedback(recordId, feedback);
  res.json({ success: !!record, record });
});

// =============================================================================
// PHASE 5.5: PROACTIVE PARTNER ENDPOINTS
// =============================================================================

// Reminder System
app.get('/api/reminders/status', (req, res) => {
  res.json(reminderSystem.getStatus());
});

app.get('/api/reminders/pending', (req, res) => {
  res.json(reminderSystem.getPending());
});

app.get('/api/reminders/upcoming', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  res.json(reminderSystem.getUpcoming(hours));
});

app.get('/api/reminders/user/:userId', (req, res) => {
  const status = req.query.status || null;
  res.json(reminderSystem.getForUser(req.params.userId, status));
});

app.post('/api/reminders/add', (req, res) => {
  const reminder = reminderSystem.add(req.body);
  res.json({ success: true, reminder });
});

app.post('/api/reminders/parse-time', (req, res) => {
  const { text } = req.body;
  const time = reminderSystem.parseTime(text);
  res.json({ text, parsed: time, formatted: time ? new Date(time).toLocaleString('th-TH') : null });
});

app.post('/api/reminders/snooze/:id', (req, res) => {
  const minutes = req.body.minutes || null;
  const reminder = reminderSystem.snooze(req.params.id, minutes);
  res.json({ success: !!reminder, reminder });
});

app.post('/api/reminders/cancel/:id', (req, res) => {
  const success = reminderSystem.cancel(req.params.id);
  res.json({ success });
});

app.post('/api/reminders/complete/:id', (req, res) => {
  const success = reminderSystem.complete(req.params.id);
  res.json({ success });
});

// Google Calendar
app.get('/api/calendar/status', (req, res) => {
  res.json(googleCalendar.getStatus());
});

app.get('/api/calendar/today', async (req, res) => {
  try {
    const events = await googleCalendar.getToday();
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/calendar/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const events = await googleCalendar.getNextDays(days);
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/calendar/summary', async (req, res) => {
  try {
    const summary = await googleCalendar.getDailySummary();
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/calendar/free-slots', async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const duration = parseInt(req.query.duration) || 60;
    const slots = await googleCalendar.findFreeSlots({ date, duration });
    res.json({ success: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/calendar/create', async (req, res) => {
  try {
    const event = await googleCalendar.createEvent(req.body);
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/calendar/quick-add', async (req, res) => {
  try {
    const { text } = req.body;
    const event = await googleCalendar.quickAdd(text);
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Daily Digest
app.get('/api/digest/status', (req, res) => {
  res.json(dailyDigest.getStatus());
});

app.get('/api/digest/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(dailyDigest.getRecent(limit));
});

app.post('/api/digest/morning', async (req, res) => {
  try {
    const digest = await dailyDigest.generateMorning(req.body);
    res.json({ success: true, digest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/digest/evening', async (req, res) => {
  try {
    const digest = await dailyDigest.generateEvening(req.body);
    res.json({ success: true, digest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/digest/generate', async (req, res) => {
  try {
    const digest = await dailyDigest.generate(req.body);
    res.json({ success: true, digest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Memory Consolidation
app.get('/api/memory-consolidation/status', (req, res) => {
  res.json(memoryConsolidation.getStatus());
});

app.get('/api/memory-consolidation/stats', (req, res) => {
  res.json(memoryConsolidation.getStats());
});

app.get('/api/memory-consolidation/preferences', (req, res) => {
  res.json(memoryConsolidation.getPreferences());
});

app.get('/api/memory-consolidation/query', (req, res) => {
  const options = {
    type: req.query.type,
    search: req.query.search,
    tags: req.query.tags ? req.query.tags.split(',') : null,
    minImportance: req.query.minImportance ? parseInt(req.query.minImportance) : null,
    limit: parseInt(req.query.limit) || 10
  };
  res.json(memoryConsolidation.query(options));
});

app.get('/api/memory-consolidation/related/:entity', (req, res) => {
  res.json(memoryConsolidation.getRelated(req.params.entity));
});

app.get('/api/memory-consolidation/context', (req, res) => {
  const topic = req.query.topic || null;
  res.json(memoryConsolidation.getContextForAI(topic));
});

app.post('/api/memory-consolidation/add-short-term', (req, res) => {
  const memory = memoryConsolidation.addShortTerm(req.body);
  res.json({ success: true, memory });
});

app.post('/api/memory-consolidation/add-learning', (req, res) => {
  const learning = memoryConsolidation.addLearning(req.body);
  res.json({ success: true, learning });
});

app.post('/api/memory-consolidation/add-preference', (req, res) => {
  memoryConsolidation.addPreference(req.body);
  res.json({ success: true });
});

app.post('/api/memory-consolidation/add-fact', (req, res) => {
  memoryConsolidation.addFact(req.body);
  res.json({ success: true });
});

app.post('/api/memory-consolidation/consolidate', async (req, res) => {
  try {
    const { force = false } = req.body || {};
    const result = await memoryConsolidation.consolidate({ force });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Force refresh local status
app.post('/api/router/refresh', async (req, res) => {
  localStatus.lastCheck = 0; // Reset cache
  const localOnline = await checkLocalHealth();
  res.json({
    success: true,
    localOnline,
    timestamp: new Date().toISOString()
  });
});

// Get memory/context
app.get('/api/memory', async (req, res) => {
  const mem = await memory.getAll();
  res.json(mem);
});

// Manual trigger for testing
app.post('/api/briefing', async (req, res) => {
  try {
    await heartbeat.morningBriefing();
    res.json({ success: true, message: 'Briefing sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// PHASE 2: ENHANCED SYNC ENDPOINTS
// =============================================================================

// Sync endpoint for Terminal - Bidirectional
app.post('/api/sync', async (req, res) => {
  try {
    const { action, data, source } = req.body;

    switch (action) {
      case 'full_sync':
        // Full bidirectional sync
        const syncResult = await memory.fullSync(data, source || 'terminal');
        const currentMemory = await memory.getAll();
        res.json({
          success: true,
          synced_at: syncResult.synced_at,
          memory: currentMemory
        });
        break;

      case 'get_status':
        const status = {
          sync: await memory.getSyncStatus(),
          conversations: await memory.getRecentConversations(),
          pending_approvals: await memory.getPendingApprovals(),
          context: await memory.getIntelligentContext()
        };
        res.json(status);
        break;

      case 'update_context':
        await memory.update(data);
        res.json({ success: true });
        break;

      case 'set_focus':
        await memory.setCurrentFocus(data.focus);
        res.json({ success: true, focus: data.focus });
        break;

      case 'add_note':
        await memory.addNote(data.note);
        res.json({ success: true });
        break;

      case 'add_alert':
        await memory.addMarketAlert(data);
        res.json({ success: true });
        break;

      default:
        res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('[SYNC] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
app.get('/api/sync/status', async (req, res) => {
  try {
    const status = await memory.getSyncStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 2: HOTEL DATA ENDPOINTS (Beds24)
// =============================================================================

// Get today's hotel status
app.get('/api/hotel/today', async (req, res) => {
  try {
    const [checkIns, checkOuts] = await Promise.all([
      beds24.getCheckInsToday(),
      beds24.getCheckOutsToday()
    ]);

    const status = {
      date: new Date().toISOString().split('T')[0],
      check_ins: checkIns,
      check_outs: checkOuts
    };

    // Save to memory
    await memory.updateHotelStatus(status);
    await memory.trackApiCall('beds24');

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get occupancy
app.get('/api/hotel/occupancy', async (req, res) => {
  try {
    const occupancy = await beds24.getOccupancy();
    await memory.trackApiCall('beds24');
    res.json(occupancy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get availability for date range
app.get('/api/hotel/availability', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates required' });
    }
    const availability = await beds24.getAvailability(from, to);
    await memory.trackApiCall('beds24');
    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Beds24 token status
app.get('/api/hotel/token-status', async (req, res) => {
  try {
    const status = beds24.getTokenStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force refresh Beds24 token
app.post('/api/hotel/refresh-token', async (req, res) => {
  try {
    const success = await beds24.forceRefreshToken();
    res.json({ success, message: success ? 'Token refreshed' : 'Refresh failed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 2: INTELLIGENT CONTEXT ENDPOINT
// =============================================================================

// Get full context for Claude
app.get('/api/context', async (req, res) => {
  try {
    const context = await memory.getIntelligentContext();
    res.json(context);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 3: AUTONOMY ENDPOINTS
// =============================================================================

// Get autonomy status
app.get('/api/autonomy/status', (req, res) => {
  try {
    const suggestions = autonomy.getProactiveSuggestions();
    const pending = autonomy.getPendingApprovals();

    res.json({
      status: 'active',
      goals: Object.keys(autonomy.GOALS),
      triggers: Object.keys(autonomy.TRIGGERS).length,
      pending_approvals: pending.length,
      suggestions: suggestions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending approvals
app.get('/api/autonomy/approvals', (req, res) => {
  try {
    const pending = autonomy.getPendingApprovals();
    res.json({
      count: pending.length,
      items: pending
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process approval (approve or reject)
app.post('/api/autonomy/approvals/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { approved, feedback } = req.body;

    const result = autonomy.processApproval(id, approved, feedback);

    if (!result) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get proactive suggestions
app.get('/api/autonomy/suggestions', (req, res) => {
  try {
    const suggestions = autonomy.getProactiveSuggestions();
    res.json({
      count: suggestions.length,
      suggestions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze opportunity
app.post('/api/autonomy/analyze', (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'topic required' });
    }

    const analysis = autonomy.analyzeOpportunity(topic);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger morning briefing
app.post('/api/autonomy/briefing', async (req, res) => {
  try {
    const briefing = await autonomy.sendMorningBriefing();
    res.json({
      success: true,
      briefing
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger monitoring check
app.post('/api/autonomy/monitor', async (req, res) => {
  try {
    await autonomy.monitoringLoop();
    res.json({
      success: true,
      message: 'Monitoring check completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get market data (crypto, gold)
app.get('/api/autonomy/market', async (req, res) => {
  try {
    const crypto = await autonomy.fetchCryptoData();
    res.json({
      timestamp: new Date().toISOString(),
      crypto
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// HEARTBEAT SYSTEM ENDPOINTS
// =============================================================================

// Get heartbeat status
app.get('/api/heartbeat/status', (req, res) => {
  if (!heartbeatManager) {
    return res.json({ enabled: false, message: 'Heartbeat not initialized' });
  }
  res.json(heartbeatManager.getStatus());
});

// Trigger heartbeat manually
app.post('/api/heartbeat/trigger', async (req, res) => {
  if (!heartbeatManager) {
    return res.status(400).json({ error: 'Heartbeat not initialized' });
  }

  try {
    const result = await heartbeatManager.trigger();
    res.json(result || { status: 'skipped', message: 'Conditions not met' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 5: SUB-AGENT SPAWN ENDPOINTS
// =============================================================================

// Get sub-agent status
app.get('/api/subagent/status', (req, res) => {
  if (!subAgentManager) {
    return res.json({ enabled: false, message: 'Sub-agent not initialized' });
  }
  res.json(subAgentManager.getStatus());
});

// Spawn a sub-agent
app.post('/api/subagent/spawn', async (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  try {
    const { task, label, model, runTimeoutSeconds, cleanup } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'task is required' });
    }

    const result = await subAgentManager.spawn({
      task,
      label,
      model,
      runTimeoutSeconds,
      cleanup
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific sub-agent run
app.get('/api/subagent/runs/:runId', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const run = subAgentManager.getRun(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }
  res.json(run);
});

// Stop a specific sub-agent run
app.post('/api/subagent/stop/:runId', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const success = subAgentManager.stop(req.params.runId);
  res.json({ success, message: success ? 'Stopped' : 'Cannot stop (may be running)' });
});

// Stop all sub-agent runs
app.post('/api/subagent/stop-all', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const stopped = subAgentManager.stopAll();
  res.json({ success: true, stopped });
});

// Clear completed runs
app.post('/api/subagent/clear', (req, res) => {
  if (!subAgentManager) {
    return res.status(400).json({ error: 'Sub-agent not initialized' });
  }

  const cleared = subAgentManager.clearCompleted();
  res.json({ success: true, cleared });
});

// =============================================================================
// PHASE 3.5: SESSION & PROMPT ENDPOINTS
// =============================================================================

// Get session logs
app.get('/api/sessions', (req, res) => {
  try {
    const { date } = req.query;
    const sessions = listSessionLogs({ date });
    res.json({
      count: sessions.length,
      sessions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific session log
app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { date, limit } = req.query;
    const entries = readSessionLog(sessionId, {
      date,
      limit: limit ? parseInt(limit) : undefined
    });
    const stats = getSessionStats(sessionId, date);
    res.json({
      sessionId,
      stats,
      entries
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List prompt versions
app.get('/api/prompts/versions', (req, res) => {
  try {
    const versions = listVersions();
    const current = getPromptVersion();
    res.json({
      current,
      available: versions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List prompts in current version
app.get('/api/prompts', (req, res) => {
  try {
    const { version } = req.query;
    const prompts = listPrompts(version);
    res.json({
      version: version || getPromptVersion(),
      prompts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific prompt
app.get('/api/prompts/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { version } = req.query;
    const content = loadPrompt(name, version);
    if (!content) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json({
      name,
      version: version || getPromptVersion(),
      content
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Switch prompt version
app.post('/api/prompts/version', (req, res) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ error: 'version required' });
    }
    const success = setPromptVersion(version);
    res.json({
      success,
      current: getPromptVersion()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PHASE 3.5: SUMMARIZATION ENDPOINTS
// =============================================================================

// Get summaries
app.get('/api/summaries', async (req, res) => {
  try {
    const summariesDir = './data/summaries';
    const fs = await import('fs');
    const path = await import('path');

    if (!fs.existsSync(summariesDir)) {
      return res.json({ count: 0, summaries: [] });
    }

    const files = fs.readdirSync(summariesDir)
      .filter(f => f.endsWith('_summary.md'))
      .map(f => ({
        file: f,
        session: f.replace('_summary.md', ''),
        created: fs.statSync(path.join(summariesDir, f)).mtime
      }))
      .sort((a, b) => b.created - a.created);

    res.json({
      count: files.length,
      summaries: files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific summary
app.get('/api/summaries/:file', async (req, res) => {
  try {
    const { file } = req.params;
    const fs = await import('fs');
    const path = await import('path');

    const summaryPath = path.join('./data/summaries', `${file}_summary.md`);

    if (!fs.existsSync(summaryPath)) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    const content = fs.readFileSync(summaryPath, 'utf8');
    res.json({
      file: file,
      content
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual summarization
app.post('/api/summarize', async (req, res) => {
  try {
    const { date, all } = req.body;

    logSystemEvent('system', 'summarization_manual', { date, all });

    const { spawn } = await import('child_process');
    const args = ['tools/summarize-session.js'];

    if (all) {
      args.push('--all');
    } else if (date) {
      args.push('--date', date);
    }

    const summarizer = spawn('node', args, {
      cwd: import.meta.dirname,
      stdio: 'pipe'
    });

    let output = '';
    summarizer.stdout.on('data', (data) => {
      output += data.toString();
    });
    summarizer.stderr.on('data', (data) => {
      output += data.toString();
    });

    summarizer.on('close', (code) => {
      res.json({
        success: code === 0,
        code,
        output
      });
    });

    summarizer.on('error', (error) => {
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// SCHEDULED TASKS (Heartbeat)
// =============================================================================

// Morning Briefing - 07:00 Bangkok time
if (config.autonomy.auto_morning_briefing) {
  cron.schedule(config.schedule.morning_briefing, async () => {
    console.log('[HEARTBEAT] Morning briefing triggered');
    await heartbeat.morningBriefing();
  }, { timezone: config.agent.timezone });
}

// Evening Summary - 18:00 Bangkok time
cron.schedule(config.schedule.evening_summary, async () => {
  console.log('[HEARTBEAT] Evening summary triggered');
  await heartbeat.eveningSummary();
}, { timezone: config.agent.timezone });

// Hotel Daily Summary - 08:00 Bangkok time (after morning briefing)
cron.schedule('0 8 * * *', async () => {
  console.log('[HOTEL] Daily summary triggered');
  try {
    await hotelNotify.notifyDailySummary();
  } catch (error) {
    console.error('[HOTEL] Daily summary error:', error.message);
  }
}, { timezone: config.agent.timezone });

// Check-out Reminders - 09:00 Bangkok time
cron.schedule('0 9 * * *', async () => {
  console.log('[HOTEL] Check-out reminder triggered');
  try {
    const checkOuts = await beds24.getCheckOutsToday();
    if (Array.isArray(checkOuts) && checkOuts.length > 0) {
      await hotelNotify.notifyCheckOutReminder(checkOuts);
    }
  } catch (error) {
    console.error('[HOTEL] Check-out reminder error:', error.message);
  }
}, { timezone: config.agent.timezone });

// Weekly Rank Check - Monday 09:00
if (config.autonomy.auto_rank_report) {
  cron.schedule(config.schedule.rank_check, async () => {
    console.log('[HEARTBEAT] Rank check triggered');
    await heartbeat.rankReport();
  }, { timezone: config.agent.timezone });
}

// =============================================================================
// PHASE 3.5: NIGHTLY SESSION SUMMARIZATION (Haiku)
// =============================================================================

// Nightly LINE Session Summarization - 23:00 Bangkok time
// Uses Claude Haiku for cost-effective summarization (~$0.30/month)
cron.schedule('0 23 * * *', async () => {
  console.log('[SUMMARIZER] Nightly LINE session summarization triggered');
  logSystemEvent('system', 'summarization_start', { type: 'line' });

  try {
    const { spawn } = await import('child_process');
    const summarizer = spawn('node', ['tools/summarize-session.js'], {
      cwd: import.meta.dirname,
      stdio: 'inherit'
    });

    summarizer.on('close', (code) => {
      console.log(`[SUMMARIZER] LINE summarization completed with code ${code}`);
      logSystemEvent('system', 'summarization_complete', { type: 'line', code });
    });
  } catch (error) {
    console.error('[SUMMARIZER] LINE error:', error);
    logError('system', error, { source: 'line-summarizer' });
  }
}, { timezone: config.agent.timezone });

// Nightly Terminal Session Summarization - 23:30 Bangkok time
// Summarizes Claude Code terminal sessions
cron.schedule('30 23 * * *', async () => {
  console.log('[SUMMARIZER] Nightly terminal session summarization triggered');
  logSystemEvent('system', 'summarization_start', { type: 'terminal' });

  try {
    const { spawn } = await import('child_process');
    const summarizer = spawn('node', ['tools/terminal-summarizer.js'], {
      cwd: import.meta.dirname,
      stdio: 'inherit'
    });

    summarizer.on('close', (code) => {
      console.log(`[SUMMARIZER] Terminal summarization completed with code ${code}`);
      logSystemEvent('system', 'summarization_complete', { type: 'terminal', code });
    });
  } catch (error) {
    console.error('[SUMMARIZER] Terminal error:', error);
    logError('system', error, { source: 'terminal-summarizer' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// AUTONOMOUS IDEA ENGINE - Oracle คิดเอง ทำเอง
// =============================================================================

// Think every 6 hours: 6:00, 12:00, 18:00, 00:00 Bangkok time
cron.schedule('0 0,6,12,18 * * *', async () => {
  console.log('[IDEAS] 🧠 Autonomous Thinking Cycle triggered');
  logSystemEvent('system', 'ideas_thinking_start', {});

  try {
    const result = await autonomousIdeas.runThinkingCycle(config);
    console.log('[IDEAS] Thinking cycle result:', result.success ? 'success' : 'failed');
    logSystemEvent('system', 'ideas_thinking_complete', {
      success: result.success,
      executed: result.executed,
      ideaName: result.idea?.name || result.bestIdea?.name
    });
  } catch (error) {
    console.error('[IDEAS] Thinking cycle error:', error);
    logError('system', error, { source: 'autonomous-ideas' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

// Phase 3.5: Setup graceful shutdown BEFORE starting server
setupSignalHandlers({ timeout: 30000 });

// Register cleanup handlers
registerCleanup('session-logs', closeAllStreams, { phase: 'drain', priority: 0 });
registerCleanup('memory-save', () => memory.saveAll?.(), { phase: 'cleanup', priority: 10 });

const server = app.listen(PORT, async () => {
  // Phase 3.5: Register HTTP server for graceful shutdown
  registerHttpServer(server, 'express-server');

  // Phase 3.5: Initialize Session Logger
  initSessionLogger({ dir: 'data/sessions' });

  // Phase 3.5: Initialize Prompt Loader
  initPromptLoader({ dir: 'prompts', version: 'v1.0' });

  // Log server start event
  logSystemEvent('system', 'server_start', { port: PORT, version: '3.5.0' });

  // Check local status on startup
  const localOnline = LOCAL_TUNNEL_URL ? await checkLocalHealth() : false;

  // Initialize Autonomy Engine (Phase 3)
  autonomy.initialize();

  // Initialize Autonomous Loop (Phase 6: คิดเองทุก 30 นาที)
  if (config.autonomy?.auto_opportunity_alert) {
    autonomousLoop.startLoop(30); // คิดเองทุก 30 นาที
    console.log('[AUTONOMOUS-LOOP] Started (every 30 minutes)');
  }

  // Initialize User Profiles System (Phase 5.6)
  userProfiles.init(config);
  console.log('[USER-PROFILES] System initialized');

  // Initialize Local Agent WebSocket Server (Phase 6: Remote Execution)
  localAgentServer.initialize(server);
  localAgentServer.setNotifyCallback(async (message) => {
    await line.notifyOwner(message);
  });
  registerCleanup('local-agent', () => localAgentServer.shutdown(), { phase: 'cleanup', priority: 5 });
  console.log('[LOCAL-AGENT-SERVER] WebSocket server initialized');

  // Initialize Heartbeat System (Phase 4)
  if (config.heartbeat?.enabled) {
    heartbeatManager = new HeartbeatManager(config.heartbeat);

    // Set notification callback to LINE
    heartbeatManager.setNotifyCallback(async (message) => {
      console.log('[HEARTBEAT] Sending alert to LINE...');
      await line.notifyOwner(message);
      logSystemEvent('heartbeat', 'alert_sent', { length: message.length });
    });

    // Start heartbeat
    heartbeatManager.start();

    // Register cleanup
    registerCleanup('heartbeat', () => heartbeatManager.stop(), { phase: 'cleanup', priority: 5 });
  }

  // Initialize Sub-Agent System (Phase 5)
  if (config.subagent?.enabled) {
    subAgentManager = new SubAgentManager(config.subagent);

    // Set announce callback to LINE
    subAgentManager.setAnnounceCallback(async (message) => {
      console.log('[SUBAGENT] Announcing result to LINE...');
      await line.notifyOwner(message);
      logSystemEvent('subagent', 'announce_sent', { length: message.length });
    });

    // Set complete callback for logging
    subAgentManager.setCompleteCallback((run) => {
      logSystemEvent('subagent', 'run_complete', {
        runId: run.runId,
        status: run.status,
        runtime: run.runtime
      });
    });

    // Register cleanup
    registerCleanup('subagent', () => subAgentManager.stopAll(), { phase: 'cleanup', priority: 5 });

    console.log('[SUBAGENT] Sub-Agent Manager initialized');
  }

  // Initialize Webhook Ingress (Phase 7)
  // Register default handlers - notify both LINE and Telegram
  const notifyAll = async (msg) => {
    await line.notifyOwner(msg).catch(e => console.error('[NOTIFY] LINE error:', e.message));
    if (telegram.isConfigured()) {
      await telegram.notifyOwner(msg).catch(e => console.error('[NOTIFY] Telegram error:', e.message));
    }
  };
  webhookIngress.on('beds24', '*', createBeds24Handler({ notifyOwner: notifyAll }));
  webhookIngress.on('stripe', '*', createStripeHandler({ notifyOwner: notifyAll }));
  webhookIngress.on('github', '*', createGitHubHandler({ notifyOwner: notifyAll }));

  // Log webhook events
  webhookIngress.on('webhook', (webhook) => {
    logSystemEvent('webhook', 'received', {
      id: webhook.id,
      source: webhook.source,
      eventType: webhook.eventType,
      status: webhook.status
    });
  });

  console.log('[WEBHOOK] Webhook Ingress initialized');
  console.log('[FAILOVER] Model Failover initialized');

  // =========================================================================
  // PHASE 5.5: REMINDER SYSTEM - Set notification callback
  // =========================================================================
  reminderSystem.setNotifyCallback(async (reminder) => {
    console.log(`[REMINDER] Sending notification: ${reminder.message}`);

    const message = `🔔 Reminder\n\n${reminder.message}\n\n⏰ ${reminder.timeFormatted}`;

    // Send via appropriate channel
    if (reminder.channel === 'telegram' && config.telegram?.enabled) {
      // await telegram.sendMessage(reminder.userId, message);
      console.log('[REMINDER] Telegram not fully configured, sending via LINE');
      await line.notifyOwner(message);
    } else {
      // Default to LINE
      await line.notifyOwner(message);
    }

    logSystemEvent('reminder', 'sent', {
      id: reminder.id,
      message: reminder.message.substring(0, 50)
    });
  });

  // Register cleanup
  registerCleanup('reminder-system', () => reminderSystem.stop(), { phase: 'cleanup', priority: 5 });
  console.log('[REMINDER] Reminder System initialized');

  // =========================================================================
  // PHASE 5.5: DAILY DIGEST - Schedule morning and evening
  // =========================================================================
  // Morning Briefing at 7:00 AM
  cron.schedule('0 7 * * *', async () => {
    console.log('[DIGEST] Generating morning briefing...');
    try {
      const digest = await dailyDigest.generateMorning();
      if (digest.output && digest.output !== '✅ ไม่มีอะไรต้องรายงาน') {
        await line.notifyOwner(`📬 Morning Briefing\n\n${digest.output}`);
        logSystemEvent('digest', 'morning_sent', { id: digest.id });
      }
    } catch (err) {
      console.error('[DIGEST] Morning briefing failed:', err.message);
    }
  }, { timezone: config.agent?.timezone || 'Asia/Bangkok' });

  // Evening Summary at 6:00 PM
  cron.schedule('0 18 * * *', async () => {
    console.log('[DIGEST] Generating evening summary...');
    try {
      const digest = await dailyDigest.generateEvening();
      if (digest.output && digest.output !== '✅ ไม่มีอะไรต้องรายงาน') {
        await line.notifyOwner(`📊 Evening Summary\n\n${digest.output}`);
        logSystemEvent('digest', 'evening_sent', { id: digest.id });
      }
    } catch (err) {
      console.error('[DIGEST] Evening summary failed:', err.message);
    }
  }, { timezone: config.agent?.timezone || 'Asia/Bangkok' });

  console.log('[DIGEST] Daily Digest scheduled (7:00 morning, 18:00 evening)');

  // =========================================================================
  // PHASE 5.5: MEMORY CONSOLIDATION - Schedule daily consolidation
  // =========================================================================
  // Consolidate memories at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[MEMORY] Running daily consolidation...');
    try {
      const result = await memoryConsolidation.consolidate();
      logSystemEvent('memory', 'consolidation', result);
      console.log(`[MEMORY] Consolidated ${result.consolidated} items into ${result.summaries} summaries`);
    } catch (err) {
      console.error('[MEMORY] Consolidation failed:', err.message);
    }
  }, { timezone: config.agent?.timezone || 'Asia/Bangkok' });

  console.log('[MEMORY] Memory Consolidation scheduled (midnight daily)');

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        ORACLE AGENT v5.6 - PROACTIVE PARTNER               ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Status:  ONLINE                                           ║`);
  console.log(`║  Port:    ${PORT}                                              ║`);
  console.log(`║  Owner:   ${config.agent.owner}                                            ║`);
  console.log('║                                                            ║');
  console.log('║  🧠 PHASE 3: AUTONOMY ENGINE                               ║');
  console.log('║  - Goals: hospitality, investment, saas, business          ║');
  console.log('║  - Monitoring: Every 15 minutes                            ║');
  console.log('║  - Triggers: Price alerts, Occupancy, Opportunities        ║');
  console.log('║  - Learning: From Tars decisions                           ║');
  console.log('║                                                            ║');
  console.log('║  💓 PHASE 4: HEARTBEAT SYSTEM                              ║');
  console.log(`║  - Interval: ${config.heartbeat?.every || 'disabled'}                                       ║`);
  console.log(`║  - Active Hours: ${config.heartbeat?.activeHours ? config.heartbeat.activeHours.start + ':00-' + config.heartbeat.activeHours.end + ':00' : 'N/A'}                           ║`);
  console.log(`║  - Model: ${config.heartbeat?.model?.split('-')[2] || 'N/A'}                                         ║`);
  console.log('║                                                            ║');
  console.log('║  🚀 PHASE 5: SUB-AGENT SPAWN                               ║');
  console.log(`║  - Max Concurrent: ${config.subagent?.maxConcurrent || 'disabled'}                                     ║`);
  console.log(`║  - Default Model: ${config.subagent?.defaultModel?.split('-')[2] || 'N/A'}                               ║`);
  console.log(`║  - Timeout: ${config.subagent?.defaultTimeoutSeconds || 'N/A'}s                                       ║`);
  console.log('║                                                            ║');
  console.log('║  🌐 PHASE 6: MULTI-CHANNEL GATEWAY                         ║');
  console.log(`║  - LINE: ${config.line?.enabled !== false ? '✅ ENABLED' : '❌ DISABLED'}                                     ║`);
  console.log(`║  - Telegram: ${config.telegram?.enabled ? '✅ ENABLED' : '❌ DISABLED'}                                  ║`);
  console.log(`║  - WhatsApp: 🔜 PLANNED                                    ║`);
  console.log('║                                                            ║');
  console.log('║  🆕 PHASE 3.5: OPENCLAW UPGRADES                           ║');
  console.log(`║  - JSONL Logging: data/sessions/                           ║`);
  console.log(`║  - Prompts: ${getPromptVersion()} (prompts/)                              ║`);
  console.log('║  - Graceful Shutdown: ENABLED                              ║');
  console.log('║                                                            ║');
  console.log('║  🧠 PHASE 5.4: SELF-IMPROVEMENT                            ║');
  console.log('║  - Sentiment Analysis: ✅ AUTO (every message)             ║');
  console.log('║  - Self-Reflection: ✅ AUTO (before reply)                 ║');
  console.log('║  - Quality Tracker: ✅ AUTO (after reply)                  ║');
  console.log('║  - Mistake Tracker: ✅ AUTO (prevention rules)             ║');
  console.log('║                                                            ║');
  console.log('║  🤝 PHASE 5.5: PROACTIVE PARTNER                           ║');
  console.log('║  - Reminder System: ✅ ENABLED (notify via LINE)           ║');
  console.log('║  - Daily Digest: ✅ 7:00 morning, 18:00 evening            ║');
  console.log('║  - Memory Consolidation: ✅ midnight daily                 ║');
  console.log('║  - Google Calendar: ⚠️  needs credentials                  ║');
  console.log('║                                                            ║');
  console.log('║  🔄 FAILOVER MODE:                                         ║');
  console.log(`║  Local:   ${LOCAL_TUNNEL_URL ? (localOnline ? '✅ ONLINE (FREE)' : '❌ OFFLINE') : '⚠️  NOT CONFIGURED'}              ║`);
  console.log('║  Railway: ✅ ALWAYS-ON (API)                               ║');
  console.log('║                                                            ║');
  console.log('║  Autonomy Endpoints:                                       ║');
  console.log('║  - GET  /api/autonomy/status     Engine status             ║');
  console.log('║  - GET  /api/autonomy/approvals  Pending approvals         ║');
  console.log('║  - POST /api/autonomy/briefing   Send morning briefing     ║');
  console.log('║  - POST /api/autonomy/monitor    Run monitoring check      ║');
  console.log('║  - GET  /api/autonomy/market     Get market data           ║');
  console.log('║                                                            ║');
  console.log('║  Sub-Agent Endpoints:                                      ║');
  console.log('║  - GET  /api/subagent/status     Get status & stats        ║');
  console.log('║  - POST /api/subagent/spawn      Spawn sub-agent           ║');
  console.log('║  - GET  /api/subagent/runs/:id   Get run details           ║');
  console.log('║  - POST /api/subagent/stop/:id   Stop specific run         ║');
  console.log('║  - POST /api/subagent/stop-all   Stop all runs             ║');
  console.log('║                                                            ║');
  console.log('║  Gateway Endpoints:                                        ║');
  console.log('║  - GET  /api/gateway/status      Channel status            ║');
  console.log('║  - POST /api/gateway/notify      Notify owner              ║');
  console.log('║  - POST /webhook/telegram        Telegram webhook          ║');
  console.log('║                                                            ║');
  console.log('║  Phase 3.5 Endpoints:                                      ║');
  console.log('║  - GET  /api/sessions            List session logs         ║');
  console.log('║  - GET  /api/sessions/:id        Get session entries       ║');
  console.log('║  - GET  /api/prompts             List prompts              ║');
  console.log('║  - GET  /api/prompts/versions    List prompt versions      ║');
  console.log('║  - GET  /api/summaries           List summaries            ║');
  console.log('║  - POST /api/summarize           Trigger summarization     ║');
  console.log('║                                                            ║');
  console.log('║  Phase 7 Endpoints (Model Failover):                       ║');
  console.log('║  - GET  /api/models/status       Provider status           ║');
  console.log('║  - POST /api/models/send         Send with failover        ║');
  console.log('║  - POST /api/models/health-check Check all providers       ║');
  console.log('║                                                            ║');
  console.log('║  Phase 7 Endpoints (Webhook Ingress):                      ║');
  console.log('║  - GET  /api/webhooks/status     Webhook status            ║');
  console.log('║  - GET  /api/webhooks/history    Webhook history           ║');
  console.log('║  - POST /webhook/beds24          Beds24 webhook            ║');
  console.log('║  - POST /webhook/stripe          Stripe webhook            ║');
  console.log('║  - POST /webhook/github          GitHub webhook            ║');
  console.log('║                                                            ║');
  console.log('║  Phase 8 Endpoints (Gmail + Queue):                        ║');
  console.log('║  - GET  /api/gmail/status        Gmail status              ║');
  console.log('║  - POST /webhook/gmail           Gmail webhook             ║');
  console.log('║  - POST /api/gmail/process       Process email             ║');
  console.log('║  - GET  /api/queue/status        Queue status              ║');
  console.log('║  - POST /api/queue/enqueue       Enqueue message           ║');
  console.log('║  - GET  /api/queue/lane/:lane    Lane status               ║');
  console.log('║                                                            ║');
  console.log('║  Scheduled:                                                ║');
  console.log('║  - 07:00  Morning Briefing (Auto)                          ║');
  console.log('║  - 18:00  Evening Summary                                  ║');
  console.log('║  - 23:00  Session Summarization (Haiku)                    ║');
  console.log('║  - Every 15min  Monitoring Loop                            ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (!LOCAL_TUNNEL_URL) {
    console.log('⚠️  Set LOCAL_TUNNEL_URL environment variable to enable failover');
    console.log('   Example: https://your-tunnel.trycloudflare.com');
    console.log('');
  }
});
