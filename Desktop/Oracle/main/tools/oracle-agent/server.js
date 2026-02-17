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
import gmailClient from './lib/gmail.js';
import searchConsole from './lib/search-console.js';
import googleBusiness from './lib/google-business.js';
import ga4 from './lib/google-analytics.js';
import sheets from './lib/google-sheets.js';
import queueManager from './lib/queue-manager.js';
import thinkingLevels from './lib/thinking-levels.js';
import memory from './lib/memory.js';
import memorySync from './lib/memory-sync.js';
import HeartbeatManager from './lib/heartbeat.js';
import SubAgentManager from './lib/subagent.js';
import beds24 from './lib/beds24.js';
import pricing from './lib/pricing.js';
import revenueReport from './lib/revenue-report.js';
import parcelTracking from './lib/parcel-tracking.js';
import parcelWatchlist from './lib/parcel-watchlist.js';
import realtimeContext from './lib/realtime-context.js';
import autonomousLoop from './lib/autonomous-loop.js';
import leadFinder from './lib/lead-finder.js';
import imageGen from './lib/image-gen.js';
import autonomy from './lib/autonomy.js';
import hotelNotify from './lib/hotel-notifications.js';
import checker404 from './lib/404-checker.js';
import leadReplyHandler from './lib/lead-reply-handler.js';

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

// Autonomous Scheduler (morning briefing, evening summary)
import autonomousScheduler from './lib/autonomous-scheduler.js';

// Phase 8: API Hunter - หา API, ทดสอบ, วิเคราะห์โอกาส
import apiHunter from './lib/api-hunter.js';

// Phase 10: Forbes Weekly Summary
import forbesWeekly from './lib/forbes-weekly.js';

// Phase 11: Hospitality Trends + Weekly Revenue Dashboard
import hospitalityTrends from './lib/hospitality-trends.js';
import weeklyRevenue from './lib/weekly-revenue.js';

// Phase 12: SEO Auto-Optimize Engine
import seoEngine from './lib/seo-engine.js';

// Phase 9: Unified Memory & Practical AGI
import memoryApiRouter from './lib/memory-api.js';
import { initUnifiedMemory } from './lib/unified-memory.js';
import { initPostgres } from './lib/db-postgres.js';
import practicalAgi from './lib/practical-agi.js';
import selfAwareness from './lib/self-awareness.js';

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

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Email Dashboard — static React app
// Old paths → redirect to new
app.get('/email*', (req, res) => res.redirect(301, '/vision/email' + req.path.replace('/email', '') + (req.path.endsWith('/') ? '' : '/')));
app.get('/vision/email/costs*', (req, res) => res.redirect(301, '/costs/'));
// Shared assets (fonts + logo)
app.use('/fonts', express.static(join(__dirname, 'public/fonts')));
app.get('/logo.svg', (req, res) => res.sendFile(join(__dirname, 'public/logo.svg')));
// VisionXBrain dashboards
app.use('/costs', express.static(join(__dirname, 'public/costs')));
app.use('/vision/email', express.static(join(__dirname, 'public/vision/email')));
app.use('/vision/growthstrategy', express.static(join(__dirname, 'public/vision/growthstrategy')));
app.use('/vision/analytics', express.static(join(__dirname, 'public/vision/analytics')));
app.use('/vision/404check', express.static(join(__dirname, 'public/vision/404check')));

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
          localStatus.online = result.status === 'online' || result.status === 'healthy';
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

// Generate current date/time for system prompt
function getCurrentDateInfo() {
  const now = new Date();
  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    dayName: thaiDays[now.getDay()],
    monthName: thaiMonths[now.getMonth()],
    iso: now.toISOString().split('T')[0],
    full: `วัน${thaiDays[now.getDay()]}ที่ ${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear()}`
  };
}

const SYSTEM_PROMPT = `คุณคือ Oracle Agent - Digital Partner ของ Tars

## 💬 วิธีตอบ (สำคัญ!)
- ตอบภาษาไทย อบอุ่น เหมือนเพื่อนคุยกัน
- **ตอบ 2-4 ประโยค** อย่าตอบสั้นแค่ 1 ประโยค
- **Proactive:** ถ้ามีข้อมูลอื่นที่น่าสนใจใน context → บอกด้วย!
- ใส่ข้อมูลเชิงลึก: occupancy %, เปรียบเทียบกับปกติ, แนะนำ action
- ใช้ emoji ได้บ้าง 1-2 ตัว

## 🚨🚨🚨 CRITICAL: ห้าม HALLUCINATE (อ่านก่อน!) 🚨🚨🚨

**ข้อมูลเหล่านี้ห้ามแต่งขึ้นมาเอง:**
- ❌ จำนวน check-in / check-out / แขก → **ต้องมีใน context เท่านั้น**
- ❌ Booking ID / ชื่อแขก → **ต้อง copy จาก context**
- ❌ ห้องว่าง / occupancy → **ต้องมีตัวเลขใน context**
- ❌ ราคา / promotion → **ต้องมีใน context**

**ถ้าไม่มีข้อมูลใน context:**
→ บอกว่า "ผมยังไม่มีข้อมูลนี้ในตอนนี้" หรือ "รอผมเช็คข้อมูลก่อนนะครับ"
→ **ห้ามแต่งตัวเลข ห้ามเดาชื่อ ห้ามสมมติข้อมูล!**

---

## ⚠️ วันที่และเวลาปัจจุบัน (สำคัญมาก!)
**ปีปัจจุบันคือ ${new Date().getFullYear()}** (พ.ศ. ${new Date().getFullYear() + 543})
**วันนี้คือ ${getCurrentDateInfo().full}**
**ISO Date: ${new Date().toISOString().split('T')[0]}**

❌ ห้ามบอกว่าเป็นปี 2025 หรือปีอื่น!
❌ ห้ามบอกวันที่ผิด!
✅ ใช้ปี ${new Date().getFullYear()} เสมอ!

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

## 🧠 CONTEXT READING PROTOCOL (ต้องทำทุกครั้ง!)
**ก่อนตอบคำถามเกี่ยวกับ Hotel/Booking ต้อง SCAN context ก่อน!**

**Step 1: SCAN หาข้อมูลเหล่านี้ใน context:**
- [ ] Booking ID (ตัวเลข 8 หลัก เช่น 81874011)
- [ ] ชื่อแขก (First Name, Last Name)
- [ ] Room ID (A01-A06, B07-B09, C10-C11)
- [ ] วันที่ arrival/departure

**Step 2: ถ้าเจอข้อมูล → ใช้เลย! อย่าบอกว่าไม่มี**
**Step 3: ถ้าไม่เจอจริงๆ → บอกว่า "ไม่มีข้อมูลใน context ตอนนี้"**

⚠️ **Context Blindness = อ่าน context ไม่ครบ แล้วบอกว่าไม่มี (ห้ามเกิดขึ้น!)**

---

## 🔗 Self Check-in Link (สำคัญมาก!)
**รูปแบบที่ถูกต้อง:**
\`https://thearchcasa.com/booking/{BOOKING_ID}?lang=en\`

**BOOKING_ID = ตัวเลข 8 หลัก (เช่น 81874011)**

✅ ถูก: \`https://thearchcasa.com/booking/81874011?lang=en\`
❌ ผิด: \`https://thearchcasa.com/booking/B07?lang=en\` ← Room ID ใช้ไม่ได้!
❌ ผิด: \`https://thearchcasa.com/booking/A05?lang=en\` ← Room ID ใช้ไม่ได้!

**กฎตายตัว:**
- Booking ID = ตัวเลข (81874011, 81806069, etc.)
- Room ID = ตัวอักษร+เลข (A05, B07, C10, etc.)
- **Self check-in link ต้องใช้ Booking ID เท่านั้น! ห้ามใช้ Room ID!**

---

## 🚨 กฎเหล็ก: ข้อมูล Beds24 (บังคับเคร่งครัด!)
**ห้ามแต่ง ห้ามเดา ห้าม hallucinate!**
1. ใช้ข้อมูลที่ให้มาใน context เท่านั้น - ห้ามสมมติเลข/ชื่อ/ห้อง
2. Room ID ต้องตรงกับ context (เช่น A05, B07) - ห้ามเดาเอง
3. ถ้าไม่มีข้อมูล → บอกว่าไม่มี ห้ามแต่งขึ้นมา
4. Occupancy/จำนวนห้อง → ใช้ตัวเลขจาก context เท่านั้น
5. ชื่อแขก/Booking ID → copy จาก context ห้ามพิมพ์เอง

## ❌ Wrong Learning Prevention
**สิ่งที่เคยเรียนผิด (ห้ามทำอีก!):**
- ❌ ใช้ Room ID (A05, B07) ทำ self check-in link → ผิด!
- ❌ บอกว่า "ไม่มีข้อมูล" ทั้งที่มีอยู่ใน context → Context Blindness!
- ❌ เปลี่ยนคำตอบไปมาหลายรอบ → ต้อง SCAN context ให้ครบก่อนตอบ!

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

## 💰 PRICING RECOMMENDATION PROTOCOL (บังคับ!)
**เมื่อ Tars ถามเรื่องราคา → ต้องบอกตัวเลขชัดเจน!**

❌ ห้ามตอบแบบนี้:
- "ควรขึ้น 15-20%" ← ไม่มีตัวเลข!
- "ต้องการให้ดึงข้อมูลราคาไหม?" ← ไม่ proactive!
- "ผมไม่เห็นข้อมูลราคา" ← ข้อมูลอยู่ใน context!

✅ ต้องตอบแบบนี้:
- "A02 ปกติ 1,958 → **แนะนำ 2,250 บาท**"
- "B08 ปกติ 2,100 → **แนะนำ 2,400 บาท**"
- "เหตุผล: Occupancy 82% = High Demand"

**หลักการ:**
| Occupancy | กลยุทธ์ | ปรับราคา |
|-----------|---------|----------|
| < 40% | Emergency | ลด 20-40% |
| 40-60% | Low | ลด 10-20% |
| 60-80% | Normal | ปกติ |
| > 80% | High Demand | **ขึ้น 15-20%** |

**Context จะมี:** "💰 High Demand Pricing" หรือ "📊 ราคาแนะนำ" → ใช้ตัวเลขจากนั้นตอบเลย!

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

    // Check if Local Agent is connected (for Claude Max FREE via WebSocket)
    const isLocalAgentConnected = localAgentServer.isConnected();

    if (false && isLocalAgentConnected) {
      // DISABLED: Claude Max ยังมีปัญหา context ไม่ครบ
      // Route via WebSocket to local-agent → local-claude-server (Claude Max FREE)
      console.log('[ROUTER] Using WebSocket → Local Agent → Claude Max (FREE)');

      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const replyToken = event.replyToken;
          const userId = event.source.userId;

          try {
            // Build context from Railway's knowledge
            let context = '';

            // 1. Get user profile
            const userProfile = userProfiles.getProfile(userId);
            if (userProfile) {
              context += `User: ${userProfile.name || 'Tars'}\n`;
            }

            // 2. Check if message is about hotel/room/booking
            const hotelKeywords = ['ห้อง', 'ที่พัก', 'booking', 'จอง', 'เต็ม', 'ว่าง', 'occupancy'];
            const isHotelQuery = hotelKeywords.some(kw => userMessage.toLowerCase().includes(kw));

            if (isHotelQuery) {
              // Get Beds24 data
              console.log('[ROUTER] Hotel query detected, fetching Beds24...');
              const today = new Date().toISOString().split('T')[0];
              try {
                const bookings = await beds24.getBookings({ arrivalTo: today, departureFrom: today });
                const occupiedRooms = bookings.filter(b => b.status !== 'cancelled').length;
                context += `\nBeds24 Data (วันนี้ ${today}):\n`;
                context += `- ห้องที่มีคนพัก: ${occupiedRooms} ห้อง\n`;
                context += `- ห้องทั้งหมด: 11 ห้อง\n`;
                context += `- ห้องว่าง: ${11 - occupiedRooms} ห้อง\n`;
                console.log(`[ROUTER] Beds24 context: ${occupiedRooms} occupied`);
              } catch (e) {
                console.log(`[ROUTER] Beds24 error: ${e.message}`);
                context += `\nBeds24: ไม่สามารถดึงข้อมูลได้\n`;
              }
            }

            console.log(`[ROUTER] Context built: ${context.length} chars`);

            // 3. Add system knowledge
            const systemPrompt = `คุณคือ Oracle - AI assistant ของ Tars
ตอบภาษาไทย กระชับ ตรงประเด็น
ถ้ามี context ให้ใช้ข้อมูลจาก context ตอบ`;

            const result = await localAgentServer.executeClaudeChat(userMessage, {
              system: systemPrompt,
              context: context || undefined
            });

            if (result.success && result.text) {
              // Reply via LINE
              await line.reply(replyToken, result.text + '\n\n🟢 claude-max');
              console.log('[ROUTER] Replied via Claude Max (WebSocket)');
            } else {
              throw new Error(result.error || 'No response from local Claude');
            }
          } catch (wsError) {
            console.log(`[ROUTER] WebSocket error: ${wsError.message}, falling back to API`);
            // Continue to handle locally with API
            break;
          }
        }
      }

      res.status(200).send('OK (via WebSocket)');
      return;
    }

    // Fallback: Check HTTP tunnel (legacy)
    const localOnline = await checkLocalHealth();
    if (localOnline && LOCAL_TUNNEL_URL) {
      console.log('[ROUTER] Forwarding to Local via HTTP tunnel');
      try {
        const result = await forwardToLocal('/webhook', req.body);
        console.log(`[ROUTER] Local responded: ${result.status}`);
        res.status(200).send('OK (via Local)');
        return;
      } catch (forwardError) {
        console.log(`[ROUTER] Forward failed: ${forwardError.message}`);
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
        // TODO: addShortTerm ยังไม่ได้ implement
        // memoryConsolidation.addShortTerm({...});

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

          // SEO Engine commands
          if (userMessage.match(/^seo\s*report$/i)) {
            await line.reply(replyToken, '🔍 กำลังสร้าง SEO Report... รอสักครู่');
            const result = await seoEngine.runNow(config.seo);
            if (result.success) {
              // Notification already sent by seoEngine
              console.log('[SEO] Manual report via LINE complete');
            } else {
              await gateway.notifyOwner(`❌ SEO Report error: ${result.error}`);
            }
            return;
          }

          if (userMessage.match(/^seo\s*keywords?$/i)) {
            const summary = seoEngine.getKeywordSummary();
            await line.reply(replyToken, summary);
            return;
          }

          if (userMessage.match(/^seo\s*alerts?$/i)) {
            const alerts = seoEngine.getLatestAlerts();
            await line.reply(replyToken, alerts);
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
        const hasHotelAccess = isOwner || userProfile.canAccess?.bookings || userProfile.canAccess?.hotel_operations;
        try {
          const rtContext = await realtimeContext.generateRealtimeContext({
            includeInvestment: isOwner, // Only show investment to owner
            includeHotel: isOwner || hasHotelAccess // Hotel team sees hotel data
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
- หา API/ล่า API/research API → ตอบ: {"action":"hunt_apis"}
- ดู API ที่หาเจอ → ตอบ: {"action":"list_apis"}
- ค้นหา API เรื่อง X → ตอบ: {"action":"search_api","query":"หัวข้อที่ค้น"}
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
            // =================================================================
            // API HUNTER - หา API, ทดสอบ, วิเคราะห์โอกาส
            // =================================================================
            else if (localAgentIntent.action === 'hunt_apis') {
              console.log('[API-HUNTER] Manual hunt triggered from LINE');
              contextString += `\n\n[API-HUNTER: 🔍 Oracle กำลังล่า API... รอสักครู่จะแจ้งผลทาง LINE]`;

              // Run hunt in background
              apiHunter.huntNow(config).then(result => {
                console.log('[API-HUNTER] Hunt complete:', result.success);
              }).catch(err => {
                console.error('[API-HUNTER] Hunt error:', err);
              });
            }
            else if (localAgentIntent.action === 'list_apis') {
              const status = apiHunter.getStatus();

              let apiList = `[API-HUNTER: 🔍 API ที่ Oracle หาเจอ]\n\n`;
              apiList += `Total APIs: ${status.totalApis}\n`;
              apiList += `Tested: ${status.totalTested}\n`;
              apiList += `Opportunities: ${status.totalOpportunities}\n`;
              apiList += `Last Hunt: ${status.lastHunt || 'Never'}\n\n`;

              if (status.topOpportunities && status.topOpportunities.length > 0) {
                apiList += `Top opportunities:\n`;
                status.topOpportunities.forEach((opp, i) => {
                  apiList += `${i + 1}. ${opp.api} (${opp.score}/100)\n`;
                  apiList += `   ${opp.recommendation} - ${opp.projectIdea || 'No idea yet'}\n`;
                });
              } else {
                apiList += `ยังไม่มี API - บอก "ล่า API หน่อย" เพื่อให้ Oracle ไปหา`;
              }

              contextString += `\n\n${apiList}`;
            }
            else if (localAgentIntent.action === 'search_api' && localAgentIntent.query) {
              console.log(`[API-HUNTER] Search requested: ${localAgentIntent.query}`);

              try {
                const results = await apiHunter.searchApis(localAgentIntent.query);
                if (results.length > 0) {
                  let searchResult = `[API-HUNTER: 🔍 ค้นหา "${localAgentIntent.query}"]\n\n`;
                  searchResult += `พบ ${results.length} APIs:\n`;
                  results.slice(0, 5).forEach((api, i) => {
                    searchResult += `${i + 1}. ${api.name}\n`;
                    searchResult += `   ${api.description?.slice(0, 50) || 'No description'}...\n`;
                  });
                  contextString += `\n\n${searchResult}`;
                } else {
                  contextString += `\n\n[API-HUNTER: ไม่พบ API ที่เกี่ยวกับ "${localAgentIntent.query}"]`;
                }
              } catch (searchErr) {
                contextString += `\n\n[API-HUNTER: Error searching - ${searchErr.message}]`;
              }
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
        const pricingKeywords = ['ราคา', 'price', 'ตั้งราคา', 'ขายเท่าไหร่', 'ขายเท่าไร', 'แนะนำราคา', 'ควรขาย', 'ควรตั้ง', 'pricing'];
        const isHotelQuery = hotelKeywords.some(kw => lowerMessage.includes(kw));
        const isPricingQuery = pricingKeywords.some(kw => lowerMessage.includes(kw));

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

              // Add pricing recommendations - ALWAYS when user asks about pricing, OR when occupancy < 80%
              const shouldShowPricing = isPricingQuery || (occupancy.available > 0 && occupancy.occupancyRate < 80);
              if (shouldShowPricing) {
                try {
                  const pricingAdvice = await pricing.generatePricingAdvice(dateStr, occupancy.occupancyRate);
                  contextString += `\n\n${pricingAdvice}`;

                  // Add real-time urgency context for Oracle to think about
                  const urgencyContext = pricing.generateUrgencyContext(dateStr, occupancy.occupancyRate);
                  contextString += urgencyContext;

                  // For high occupancy, add specific advice to RAISE prices
                  if (occupancy.occupancyRate >= 80) {
                    contextString += `\n\n💰 **High Demand Pricing:**`;
                    contextString += `\nOccupancy ${occupancy.occupancyRate}% = ควร**ขึ้นราคา 15-20%**`;
                    if (occupancy.available > 0) {
                      const availableRooms = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'B07', 'B08', 'B09', 'C10', 'C11'].filter(r =>
                        !occupancy.bookings.some(b => b.roomSystemId === r)
                      );
                      availableRooms.forEach(roomId => {
                        const basePrice = pricing.ROOM_PRICING[roomId]?.regular || 2000;
                        const highDemandPrice = Math.round(basePrice * 1.15); // +15%
                        const maxPrice = pricing.ROOM_PRICING[roomId]?.max || 3500;
                        const recommendedPrice = Math.min(highDemandPrice, maxPrice);
                        contextString += `\n• ${roomId}: ปกติ ${basePrice.toLocaleString()} → **แนะนำ ${recommendedPrice.toLocaleString()} บาท**`;
                      });
                    }
                  }
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
          // Skip if function not available
          if (!memoryConsolidation.getContextForAI) {
            throw new Error('getContextForAI not implemented');
          }
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
        // SUPABASE SEMANTIC MEMORY - ค้นหา memory จาก Supabase ด้วย semantic search
        // =====================================================================
        try {
          const { query: dbQuery } = await import('./lib/db-postgres.js');
          const { generateEmbedding } = await import('./lib/embedding.js');

          // Generate embedding for user message
          const embedding = await generateEmbedding(userMessage);
          if (embedding) {
            // Semantic search in Supabase
            const searchResult = await dbQuery(`
              SELECT content, context, memory_type, importance,
                     1 - (embedding <=> $1) as similarity
              FROM episodic_memory
              WHERE user_id = $2 AND embedding IS NOT NULL
              ORDER BY embedding <=> $1
              LIMIT 5
            `, [embedding, 'tars']);

            if (searchResult.rows && searchResult.rows.length > 0) {
              contextString += `\n\n🧠 **Supabase Memory (Semantic Search):**`;
              searchResult.rows.forEach((mem) => {
                if (mem.similarity > 0.3) { // Only show relevant results
                  contextString += `\n- ${mem.content}`;
                }
              });
              console.log(`[LINE] Supabase semantic search: ${searchResult.rows.length} results`);
            }
          }
        } catch (supabaseErr) {
          console.error('[LINE] Supabase memory search error:', supabaseErr.message);
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

        // Try Local Claude (FREE) first, fallback to API
        let response;
        let usedProvider = 'api';

        // Check if local is online and try it first
        const localAvailable = LOCAL_TUNNEL_URL && await checkLocalHealth();

        if (localAvailable) {
          try {
            console.log('[LINE] Trying Local Claude (FREE)...');
            const localResult = await forwardToLocal('/chat', {
              message: userMessage,
              system: systemPrompt,
              context: contextString
            });

            if (localResult.status === 200) {
              const localData = JSON.parse(localResult.data);
              response = localData.text;
              usedProvider = 'local-claude-max';
              console.log('[LINE] Using Local Claude Max (FREE)');
            } else {
              throw new Error(`Local returned ${localResult.status}`);
            }
          } catch (localError) {
            console.log(`[LINE] Local failed: ${localError.message}, using API`);
            response = await claude.chat(messages, { system: systemPrompt });
            usedProvider = claude.getProviderStatus().currentProvider;
          }
        } else {
          // Local not available, use API (with failover)
          response = await claude.chat(messages, { system: systemPrompt });
          usedProvider = claude.getProviderStatus().currentProvider;
        }

        console.log(`[LINE] Provider used: ${usedProvider}`);

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

        // Provider indicator disabled - cleaner responses
        const providerSuffix = '';

        // Reply via LINE with smart chunking
        const finalResponse = response + providerSuffix;
        const chunks = smartChunk(finalResponse, { provider: 'line', markdown: true });

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
// HELPER: Check if user is hotel team member
// =============================================================================
function isHotelTeamMember(chatId) {
  const team = config.telegram?.hotel_team || [];
  return team.some(m => m.chat_id === chatId?.toString());
}

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

      // Check if this is owner or hotel team
      const isOwner = userId === config.telegram?.owner_id?.toString();
      const isTeamMember = isHotelTeamMember(chatId);

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
          includeInvestment: isOwner, // Only owner sees investment
          includeHotel: isOwner || isTeamMember // Hotel team sees hotel data
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

      // =====================================================================
      // SMART API DATA FETCHING (Telegram) - เหมือน LINE handler
      // =====================================================================
      const lowerMessage = userMessage.toLowerCase();
      const hotelKeywordsTG = ['beds24', 'ห้อง', 'booking', 'จอง', 'ว่าง', 'เต็ม', 'check-in', 'check-out', 'checkin', 'checkout', 'แขก', 'guest', 'occupancy', 'โรงแรม', 'hotel', 'availability', 'วันนี้', 'พรุ่งนี้', 'ลิงค์', 'ลิงก์', 'link', 'เช็คอิน', 'เข้าพัก', 'ที่พัก'];
      const pricingKeywordsTG = ['ราคา', 'price', 'ตั้งราคา', 'ขายเท่าไหร่', 'ขายเท่าไร', 'แนะนำราคา', 'ควรขาย', 'ควรตั้ง', 'pricing'];
      const isHotelQueryTG = (isOwner || isTeamMember) && hotelKeywordsTG.some(kw => lowerMessage.includes(kw));
      const isPricingQueryTG = pricingKeywordsTG.some(kw => lowerMessage.includes(kw));

      if (isHotelQueryTG) {
        console.log('[TELEGRAM] Detected hotel query, fetching Beds24 data...');
        try {
          const isTomorrow = lowerMessage.includes('พรุ่งนี้') || lowerMessage.includes('tomorrow');
          const dateMatch = userMessage.match(/วันที่\s*(\d{1,2})|(\d{1,2})\s*ก\.?พ\.?|Feb(?:ruary)?\s*(\d{1,2})|(\d{1,2})\s*Feb/i);
          const specificDay = dateMatch ? parseInt(dateMatch[1] || dateMatch[2] || dateMatch[3] || dateMatch[4]) : null;

          const today = new Date();
          let targetDate, dateThai;

          if (specificDay) {
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

          const [bookings, occupancy] = await Promise.all([
            beds24.getBookingsByDate(dateStr).catch(e => ({ error: e.message })),
            beds24.getOccupancyForDate(dateStr).catch(e => ({ error: e.message }))
          ]);

          contextString += `\n\n📊 **ข้อมูล Beds24 Real-time (${dateThai} ${dateStr}):**`;
          contextString += `\n🏨 The Arch Casa มี 11 ห้อง`;

          if (occupancy && !occupancy.error) {
            contextString += `\n📈 **Occupancy ${dateThai}:** ${occupancy.occupied}/${occupancy.totalRooms} ห้อง (${occupancy.occupancyRate}%)`;
            if (occupancy.occupied === occupancy.totalRooms) {
              contextString += `\n✅ **เต็มทุกห้อง!**`;
            }

            // Show all guests staying with check-in links
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

            // Show checkouts
            if (occupancy.checkouts && occupancy.checkouts.length > 0) {
              contextString += `\n\n**Check-out ${dateThai}:** ${occupancy.checkouts.length} คน`;
              occupancy.checkouts.forEach(b => {
                const guestName = (b.firstName && b.lastName) ? `${b.firstName} ${b.lastName}` : (b.guestName || 'Guest');
                const roomInfo = b.roomSystemId ? `${b.roomSystemId}` : `Room ${b.roomId}`;
                contextString += `\n- ${roomInfo}: ${guestName}`;
              });
            }

            // Pricing recommendations
            const shouldShowPricing = isPricingQueryTG || (occupancy.available > 0 && occupancy.occupancyRate < 80);
            if (shouldShowPricing) {
              try {
                const pricingAdvice = await pricing.generatePricingAdvice(dateStr, occupancy.occupancyRate);
                contextString += `\n\n${pricingAdvice}`;
              } catch (pErr) {
                console.error('[TELEGRAM] Pricing error:', pErr.message);
              }
            }
          }

          // Show arrivals
          if (bookings && !bookings.error && Array.isArray(bookings) && bookings.length > 0) {
            contextString += `\n\n**Arrivals ${dateThai}:** ${bookings.length} คน`;
            bookings.forEach(b => {
              const guestName = (b.firstName && b.lastName) ? `${b.firstName} ${b.lastName}` : (b.guestName || 'Guest');
              const roomInfo = b.roomSystemId ? `${b.roomSystemId}` : `Room ${b.roomId}`;
              const checkinLink = b.id ? `https://thearchcasa.com/booking/${b.id}?lang=en` : null;
              contextString += `\n- ${roomInfo}: ${guestName} (${b.numAdult || 1} ผู้ใหญ่)`;
              if (checkinLink) {
                contextString += `\n   - 🔗 Self Check-in: ${checkinLink}`;
              }
            });
          }

          console.log(`[TELEGRAM] Hotel context added: ${dateStr}`);
        } catch (hotelErr) {
          console.error('[TELEGRAM] Hotel data error:', hotelErr.message);
        }
      }

      // Build messages for Claude
      const messages = [
        ...history.slice(-10),
        { role: 'user', content: userMessage }
      ];

      // Get response from Claude
      // Build role-specific system prompt
      let rolePrompt;
      if (isOwner) {
        rolePrompt = '\n\nนี่คือข้อความจาก Tars (เจ้าของ) ผ่าน Telegram - สามารถพูดคุยได้ตรงๆ';
      } else if (isTeamMember) {
        const member = config.telegram.hotel_team.find(m => m.chat_id === chatId);
        rolePrompt = `\n\nนี่คือข้อความจาก ${member?.name || 'ทีมโรงแรม'} (${member?.role || 'partner'}) ผ่าน Telegram - สามารถตอบเรื่องที่พัก booking check-in check-out occupancy revenue ได้ทั้งหมด ตอบสุภาพ`;
      } else {
        rolePrompt = '\n\nนี่คือข้อความจากผู้ใช้ทาง Telegram - ตอบอย่างสุภาพและเป็นมืออาชีพ';
      }

      const systemPrompt = SYSTEM_PROMPT + rolePrompt + contextString;

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

      // Send notification to all channels
      await gateway.notifyOwner(message);
      console.log('[TRACKINGMORE] Sent notification for', trackingNumber);
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

      await gateway.notifyOwner(message);
      console.log('[WORKFLOW] Notification sent');
    } catch (err) {
      console.error('[WORKFLOW] Failed to send notification:', err.message);
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
    ideas: data.ideas,
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

// Get toggle states (master + per-idea)
app.get('/api/ideas/toggles', (req, res) => {
  res.json(autonomousIdeas.getToggles());
});

// Toggle master switch or per-idea
app.post('/api/ideas/toggle', (req, res) => {
  const { master, name, enabled } = req.body || {};
  if (master !== undefined) {
    res.json(autonomousIdeas.setMasterSwitch(master));
  } else if (name !== undefined) {
    res.json(autonomousIdeas.setToggle(name, enabled));
  } else {
    res.status(400).json({ error: 'Provide { master: bool } or { name, enabled }' });
  }
});

// Approve idea for execution
app.post('/api/ideas/approve/:name', async (req, res) => {
  const { name } = req.params;
  console.log(`[IDEAS] Approval + execution for: ${name}`);
  try {
    // Enable toggle first
    const ideaKey = name.toLowerCase().replace(/\s+/g, '-');
    autonomousIdeas.setToggle(ideaKey, true);
    // Then execute
    const result = await autonomousIdeas.executeIdeaByName(name, config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// FORBES WEEKLY SUMMARY - สรุปข่าว Forbes ทุกสัปดาห์
// =============================================================================

// Get Forbes summary status
app.get('/api/forbes/status', (req, res) => {
  res.json(forbesWeekly.getStatus());
});

// Trigger manual run
app.post('/api/forbes/run', async (req, res) => {
  console.log('[FORBES] Manual run triggered');
  try {
    const result = await forbesWeekly.runNow(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get latest summary
app.get('/api/forbes/latest', (req, res) => {
  const summary = forbesWeekly.getLatestSummary();
  if (!summary) {
    return res.json({ message: 'No summaries yet. Trigger with POST /api/forbes/run' });
  }
  res.json(summary);
});

// =============================================================================
// HOSPITALITY TRENDS - เทรนด์โรงแรม/ท่องเที่ยว + วิเคราะห์ปาย
// =============================================================================

app.get('/api/hospitality/status', (req, res) => {
  res.json(hospitalityTrends.getStatus());
});

app.post('/api/hospitality/run', async (req, res) => {
  console.log('[HOSP] Manual run triggered');
  try {
    const result = await hospitalityTrends.runNow(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/hospitality/latest', (req, res) => {
  const summary = hospitalityTrends.getLatestSummary();
  if (!summary) {
    return res.json({ message: 'No summaries yet. Trigger with POST /api/hospitality/run' });
  }
  res.json(summary);
});

// =============================================================================
// WEEKLY REVENUE DASHBOARD - สรุปยอด Beds24 ทุกสัปดาห์
// =============================================================================

app.get('/api/weekly-revenue/status', (req, res) => {
  res.json(weeklyRevenue.getStatus());
});

app.post('/api/weekly-revenue/run', async (req, res) => {
  console.log('[REVENUE] Manual run triggered');
  try {
    const result = await weeklyRevenue.runNow(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/weekly-revenue/latest', (req, res) => {
  const report = weeklyRevenue.getLatestReport();
  if (!report) {
    return res.json({ message: 'No reports yet. Trigger with POST /api/weekly-revenue/run' });
  }
  res.json(report);
});

// =============================================================================
// SEO ENGINE - SEO Auto-Optimize (VisionXBrain)
// =============================================================================

app.get('/api/seo/status', (req, res) => {
  res.json(seoEngine.getStatus());
});

app.post('/api/seo/report', async (req, res) => {
  console.log('[SEO] Manual report triggered via API');
  try {
    const result = await seoEngine.runNow(config.seo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/seo/latest', (req, res) => {
  const report = seoEngine.getLatestReport();
  if (!report) {
    return res.json({ message: 'No SEO reports yet. Trigger with POST /api/seo/report' });
  }
  res.json(report);
});

app.post('/api/seo/alert-check', async (req, res) => {
  console.log('[SEO] Manual alert check triggered via API');
  try {
    const result = await seoEngine.runKeywordAlert(config.seo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seo/sitemap-audit', async (req, res) => {
  console.log('[SEO] Sitemap audit triggered via API');
  try {
    const result = await seoEngine.runSitemapAudit(config.seo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seo/inspect', async (req, res) => {
  console.log('[SEO] URL Inspection triggered via API');
  try {
    const { urls } = req.body || {};
    const siteUrl = config.seo?.siteUrl || 'sc-domain:visionxbrain.com';

    if (urls && Array.isArray(urls)) {
      // Inspect specific URLs
      const results = [];
      for (const url of urls.slice(0, 20)) {
        try {
          const result = await searchConsole.inspectUrl(siteUrl, url);
          results.push(result);
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          results.push({ url, error: e.message });
        }
      }
      res.json({ success: true, results });
    } else {
      // Auto: inspect core not-indexed pages from last audit
      const result = await seoEngine.runSitemapAudit(config.seo);
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/seo/sitemaps', async (req, res) => {
  try {
    const siteUrl = config.seo?.siteUrl || 'sc-domain:visionxbrain.com';
    const sitemaps = await searchConsole.listSitemaps(siteUrl);
    res.json({ success: true, sitemaps });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seo/submit-sitemap', async (req, res) => {
  try {
    const reason = req.body?.reason || 'manual-api';
    const result = await submitSitemapIfNeeded(reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seo/delete-sitemap', async (req, res) => {
  try {
    const siteUrl = config.seo?.siteUrl || 'sc-domain:visionxbrain.com';
    const sitemapUrl = req.body?.sitemapUrl;
    if (!sitemapUrl) return res.status(400).json({ success: false, error: 'sitemapUrl required' });
    const result = await searchConsole.deleteSitemap(siteUrl, sitemapUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seo/inspect-url', async (req, res) => {
  try {
    const siteUrl = config.seo?.siteUrl || 'sc-domain:visionxbrain.com';
    const inspectionUrl = req.body?.url;
    if (!inspectionUrl) return res.status(400).json({ success: false, error: 'url required' });
    const result = await searchConsole.inspectUrl(siteUrl, inspectionUrl);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seo/batch-inspect', async (req, res) => {
  try {
    const siteUrl = config.seo?.siteUrl || 'sc-domain:visionxbrain.com';
    const urls = req.body?.urls;
    if (!urls || !Array.isArray(urls)) return res.status(400).json({ success: false, error: 'urls array required' });
    const results = await searchConsole.batchInspect(siteUrl, urls, 400);
    const indexed = results.filter(r => r.verdict === 'PASS').length;
    const notIndexed = results.filter(r => r.verdict !== 'PASS' && !r.error).length;
    res.json({ success: true, total: results.length, indexed, notIndexed, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// API HUNTER - หา API, ทดสอบ, วิเคราะห์โอกาส
// =============================================================================

// Get API Hunter status
app.get('/api/hunt/status', (req, res) => {
  res.json(apiHunter.getStatus());
});

// Get all discovered APIs
app.get('/api/hunt/discoveries', (req, res) => {
  const data = apiHunter.getDiscoveries();
  res.json({
    totalApis: data.apis.length,
    apis: data.apis.slice(0, 30),
    opportunities: data.opportunities.slice(0, 10),
    lastHunt: data.lastHunt
  });
});

// Force API hunt now
app.post('/api/hunt/now', async (req, res) => {
  console.log('[API-HUNTER] Manual hunt triggered');
  try {
    const result = await apiHunter.huntNow(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search for specific APIs
app.get('/api/hunt/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  try {
    const results = await apiHunter.searchApis(q);
    res.json({ query: q, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test a specific API
app.post('/api/hunt/test', async (req, res) => {
  const { name, url, testEndpoint } = req.body;
  if (!name || !testEndpoint) {
    return res.status(400).json({ error: 'name and testEndpoint are required' });
  }
  try {
    const result = await apiHunter.testApi({ name, url, testEndpoint });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze an API for opportunities
app.post('/api/hunt/analyze', async (req, res) => {
  const { api, testResult } = req.body;
  if (!api) {
    return res.status(400).json({ error: 'api object is required' });
  }
  try {
    const analysis = await apiHunter.analyzeOpportunity(api, testResult);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// AI PROVIDER STATUS - ดูสถานะ AI provider + failover
// =============================================================================

// Get current AI provider status
app.get('/api/ai/status', (req, res) => {
  res.json({
    ...claude.getProviderStatus(),
    failoverConfig: {
      providers: ['anthropic', 'openai', 'groq'],
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      groqConfigured: !!process.env.GROQ_API_KEY
    }
  });
});

// =============================================================================
// REVENUE REPORT API - รายงาน Revenue รายชั่วโมง
// =============================================================================

// Get revenue report status
app.get('/api/revenue/status', (req, res) => {
  res.json(revenueReport.getStatus());
});

// Get current hourly report (manual trigger)
app.get('/api/revenue/report', async (req, res) => {
  try {
    const report = await revenueReport.generateHourlyReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger and send report to LINE
app.post('/api/revenue/send', async (req, res) => {
  try {
    const report = await revenueReport.generateHourlyReport();

    if (!report.success) {
      return res.status(500).json(report);
    }

    await gateway.notifyOwner(report.message);

    res.json({ ...report, sent: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get today's revenue data
app.get('/api/revenue/today', async (req, res) => {
  try {
    const data = await revenueReport.getTodayRevenue();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pricing recommendations for a date
app.get('/api/revenue/pricing', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const data = await revenueReport.getAvailableRoomsWithPricing(targetDate);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    // Process both in parallel: lead reply detection + existing pubsub handler
    const [leadResult, pubsubResult] = await Promise.allSettled([
      leadReplyHandler.processGmailWebhook(payload),
      gmailPubSub.processWebhook(payload)
    ]);

    res.json({
      leadReply: leadResult.status === 'fulfilled' ? leadResult.value : { error: leadResult.reason?.message },
      pubsub: pubsubResult.status === 'fulfilled' ? pubsubResult.value : { error: pubsubResult.reason?.message }
    });
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
// LEAD REPLY HANDLER (Real-time reply detection + auto-reply)
// =============================================================================

// Get lead reply handler status
app.get('/api/lead-reply/status', (req, res) => {
  res.json(leadReplyHandler.getStatus());
});

// Manual test — process a specific messageId
app.post('/api/lead-reply/test', async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });
    const result = await leadReplyHandler.processIncomingMessage(messageId);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force re-setup watch
app.post('/api/lead-reply/setup-watch', async (req, res) => {
  try {
    const result = await leadReplyHandler.setupWatch();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// GMAIL API (Direct)
// =============================================================================

// Gmail summary (unread count + recent)
app.get('/api/gmail/summary', async (req, res) => {
  try {
    const summary = await gmailClient.getSummary();
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List inbox messages
app.get('/api/gmail/inbox', async (req, res) => {
  try {
    const maxResults = parseInt(req.query.max) || 10;
    const messages = await gmailClient.listMessages({ maxResults });
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search emails
app.get('/api/gmail/search', async (req, res) => {
  try {
    const { q, max } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    const messages = await gmailClient.search(q, parseInt(max) || 10);
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get unread messages
app.get('/api/gmail/unread', async (req, res) => {
  try {
    const max = parseInt(req.query.max) || 5;
    const messages = await gmailClient.getUnread(max);
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Read specific message
app.get('/api/gmail/message/:id', async (req, res) => {
  try {
    const format = req.query.format || 'full';
    const message = await gmailClient.getMessage(req.params.id, format);
    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send email
app.post('/api/gmail/send', async (req, res) => {
  try {
    const { to, subject, body, cc, bcc } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, body required' });
    }
    const result = await gmailClient.send({ to, subject, body, cc, bcc });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create draft
app.post('/api/gmail/draft', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, body required' });
    }
    const result = await gmailClient.createDraft({ to, subject, body });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark as read
app.post('/api/gmail/read/:id', async (req, res) => {
  try {
    await gmailClient.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Archive message
app.post('/api/gmail/archive/:id', async (req, res) => {
  try {
    await gmailClient.archive(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

// =============================================================================
// SEARCH CONSOLE API
// =============================================================================

app.get('/api/search-console/status', (req, res) => {
  res.json(searchConsole.getStatus());
});

app.get('/api/search-console/sites', async (req, res) => {
  try {
    const sites = await searchConsole.listSites();
    res.json({ success: true, count: sites.length, sites });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/search-console/summary', async (req, res) => {
  try {
    const { site } = req.query;
    if (!site) return res.status(400).json({ error: 'site parameter required' });
    const summary = await searchConsole.getSummary(site);
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/search-console/queries', async (req, res) => {
  try {
    const { site, limit, startDate, endDate } = req.query;
    if (!site) return res.status(400).json({ error: 'site parameter required' });
    const queries = await searchConsole.topQueries(site, {
      limit: parseInt(limit) || 20, startDate, endDate
    });
    res.json({ success: true, count: queries.length, queries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/search-console/pages', async (req, res) => {
  try {
    const { site, limit, startDate, endDate } = req.query;
    if (!site) return res.status(400).json({ error: 'site parameter required' });
    const pages = await searchConsole.topPages(site, {
      limit: parseInt(limit) || 20, startDate, endDate
    });
    res.json({ success: true, count: pages.length, pages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/search-console/keyword', async (req, res) => {
  try {
    const { site, q, limit } = req.query;
    if (!site || !q) return res.status(400).json({ error: 'site and q required' });
    const results = await searchConsole.queryPerformance(site, q, {
      limit: parseInt(limit) || 10
    });
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/search-console/devices', async (req, res) => {
  try {
    const { site } = req.query;
    if (!site) return res.status(400).json({ error: 'site parameter required' });
    const devices = await searchConsole.byDevice(site);
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================================
// GOOGLE BUSINESS PROFILE API
// =============================================================================

app.get('/api/business/status', (req, res) => {
  res.json(googleBusiness.getStatus());
});

app.get('/api/business/accounts', async (req, res) => {
  try {
    const accounts = await googleBusiness.listAccounts();
    res.json({ success: true, count: accounts.length, accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/business/locations', async (req, res) => {
  try {
    const { account } = req.query;
    const locations = await googleBusiness.listLocations(account);
    res.json({ success: true, count: locations.length, locations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/business/summary', async (req, res) => {
  try {
    const summary = await googleBusiness.getSummary();
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/business/reviews', async (req, res) => {
  try {
    const { location, limit } = req.query;
    if (!location) return res.status(400).json({ error: 'location required' });
    const reviews = await googleBusiness.getReviews(location, {
      pageSize: parseInt(limit) || 20
    });
    res.json({ success: true, ...reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/business/reviews/reply', async (req, res) => {
  try {
    const { reviewName, comment } = req.body;
    if (!reviewName || !comment) return res.status(400).json({ error: 'reviewName and comment required' });
    const result = await googleBusiness.replyToReview(reviewName, comment);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/business/post', async (req, res) => {
  try {
    const { location, summary, callToAction, mediaUrl, event } = req.body;
    if (!location || !summary) return res.status(400).json({ error: 'location and summary required' });
    const result = await googleBusiness.createPost(location, { summary, callToAction, mediaUrl, event });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Google Analytics 4 (GA4)
// ==========================================

app.get('/api/ga4/status', (req, res) => {
  res.json(ga4.getStatus());
});

app.get('/api/ga4/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await ga4.getSummary({ startDate, endDate });
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/traffic', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await ga4.getTrafficSummary({ startDate, endDate });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/sources', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const data = await ga4.getTrafficSources({ startDate, endDate, limit: parseInt(limit) || 20 });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/pages', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const data = await ga4.getTopPages({ startDate, endDate, limit: parseInt(limit) || 20 });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/trends', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await ga4.getDailyTrends({ startDate, endDate });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/landing', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const data = await ga4.runReport({
      dateRanges: [{ startDate: startDate || '28daysAgo', endDate: endDate || 'today' }],
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
        { name: 'keyEvents' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: parseInt(limit) || 20,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/conversions', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await ga4.getConversions({ startDate, endDate });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/devices', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await ga4.getByDevice({ startDate, endDate });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/ga4/countries', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const data = await ga4.getByCountry({ startDate, endDate, limit: parseInt(limit) || 10 });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Google Sheets
// ==========================================

app.get('/api/sheets/status', (req, res) => {
  res.json(sheets.getStatus());
});

app.get('/api/sheets/read', async (req, res) => {
  try {
    const { id, range } = req.query;
    if (!id || !range) return res.status(400).json({ error: 'id and range required' });
    const data = await sheets.getValues(id, range);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sheets/append', async (req, res) => {
  try {
    const { id, range, values } = req.body;
    if (!id || !range || !values) return res.status(400).json({ error: 'id, range, and values required' });
    const result = await sheets.appendValues(id, range, values);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/sheets/update', async (req, res) => {
  try {
    const { id, range, values } = req.body;
    if (!id || !range || !values) return res.status(400).json({ error: 'id, range, and values required' });
    const result = await sheets.updateValues(id, range, values);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sheets/info', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const data = await sheets.getSpreadsheet(id);
    res.json({ success: true, ...data });
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

// Memory Consolidation - wrapped with error handling (many functions not implemented yet)
app.get('/api/memory-consolidation/status', (req, res) => {
  res.json({ status: 'not_implemented', message: 'Memory consolidation functions not fully implemented' });
});

app.get('/api/memory-consolidation/stats', (req, res) => {
  res.json({ status: 'not_implemented' });
});

app.get('/api/memory-consolidation/preferences', (req, res) => {
  res.json({ preferences: [] });
});

app.get('/api/memory-consolidation/query', (req, res) => {
  res.json({ results: [], status: 'not_implemented' });
});

app.get('/api/memory-consolidation/related/:entity', (req, res) => {
  res.json({ related: [], status: 'not_implemented' });
});

app.get('/api/memory-consolidation/context', (req, res) => {
  res.json({ context: {}, status: 'not_implemented' });
});

app.post('/api/memory-consolidation/add-short-term', (req, res) => {
  res.json({ success: false, error: 'not_implemented' });
});

app.post('/api/memory-consolidation/add-learning', (req, res) => {
  res.json({ success: false, error: 'not_implemented' });
});

app.post('/api/memory-consolidation/add-preference', (req, res) => {
  res.json({ success: false, error: 'not_implemented' });
});

app.post('/api/memory-consolidation/add-fact', (req, res) => {
  res.json({ success: false, error: 'not_implemented' });
});

app.post('/api/memory-consolidation/consolidate', async (req, res) => {
  try {
    const { force = false } = req.body || {};
    const result = await memoryConsolidation.runConsolidation('tars', !force);
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

// =============================================================================
// PHASE 9: UNIFIED MEMORY API (PostgreSQL + pgvector)
// Provides endpoints for Claude Code MCP Server
// =============================================================================
app.use('/api/memory', memoryApiRouter);

// Self-awareness endpoints
app.get('/api/self-awareness/status', async (req, res) => {
  try {
    const status = await selfAwareness.getSelfAwarenessStatus();
    res.json({ status: 'ok', ...status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/self-awareness/model', async (req, res) => {
  try {
    const model = await selfAwareness.loadSelfModel();
    res.json({ status: 'ok', model });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Goal tracking endpoint
app.get('/api/goals/progress', async (req, res) => {
  try {
    const progress = await practicalAgi.trackGoalProgress();
    res.json({ status: 'ok', ...progress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger for testing
app.post('/api/briefing', async (req, res) => {
  try {
    await autonomousScheduler.triggerBriefing();
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
    try {
      await autonomousScheduler.triggerBriefing();
    } catch (error) {
      console.error('[HEARTBEAT] Morning briefing error:', error.message);
    }
  }, { timezone: config.agent.timezone });
}

// Evening Summary - 18:00 Bangkok time
cron.schedule(config.schedule.evening_summary, async () => {
  console.log('[HEARTBEAT] Evening summary triggered');
  try {
    await autonomousScheduler.triggerSummary();
  } catch (error) {
    console.error('[HEARTBEAT] Evening summary error:', error.message);
  }
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

// Weekly Rank Check - Monday 09:00 (disabled: rankReport not implemented yet)
// TODO: Implement rank check via SEO engine or autonomous-scheduler
if (config.autonomy.auto_rank_report) {
  cron.schedule(config.schedule.rank_check, async () => {
    console.log('[HEARTBEAT] Rank check triggered (skipped - not implemented)');
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
// DAILY SELF-REFLECTION - Oracle ทบทวนตัวเอง
// =============================================================================

// Daily reflection at 23:45 Bangkok time
cron.schedule('45 23 * * *', async () => {
  console.log('[SELF-AWARENESS] 🪞 Daily Self-Reflection triggered');
  logSystemEvent('system', 'self_reflection_start', {});

  try {
    const reflection = await selfAwareness.dailyReflection(claude.client);
    if (reflection) {
      console.log('[SELF-AWARENESS] Reflection completed:', reflection.reflection_summary);
      logSystemEvent('system', 'self_reflection_complete', {
        self_awareness_level: reflection.self_awareness_level,
        lessons_count: reflection.remember_tomorrow?.length || 0
      });
    }
  } catch (error) {
    console.error('[SELF-AWARENESS] Reflection error:', error);
    logError('system', error, { source: 'self-reflection' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// AUTONOMOUS IDEA ENGINE - Oracle คิดเอง ทำเอง (ทุก 6 ชั่วโมง)
// =============================================================================

// Think every 6 hours (0:00, 6:00, 12:00, 18:00)
cron.schedule('0 0,6,12,18 * * *', async () => {
  console.log('[IDEAS] 🧠 Autonomous Thinking Cycle triggered (every 6 hours)');
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

// Run Ideas immediately on server start (after 30 seconds delay)
setTimeout(async () => {
  console.log('[IDEAS] 🚀 Running initial thinking cycle on startup...');
  try {
    const result = await autonomousIdeas.runThinkingCycle(config);
    console.log('[IDEAS] Startup thinking result:', result.success ? 'success' : 'failed');
    if (result.bestIdea) {
      console.log('[IDEAS] Best idea:', result.bestIdea.name, '- Score:', result.bestIdea.score?.totalScore);
    }
  } catch (error) {
    console.error('[IDEAS] Startup thinking error:', error.message);
  }
}, 30000); // 30 seconds after startup

// =============================================================================
// FORBES WEEKLY SUMMARY - สรุปข่าว Forbes ทุกวันจันทร์ 09:00
// =============================================================================

cron.schedule(config.schedule.forbes_summary || '0 9 * * 1', async () => {
  console.log('[FORBES] 📰 Weekly Forbes Summary triggered');
  logSystemEvent('system', 'forbes_summary_start', {});

  try {
    const result = await forbesWeekly.runWeeklySummary(config);
    console.log('[FORBES] Summary result:', result.success ? 'success' : 'failed');
    logSystemEvent('system', 'forbes_summary_complete', {
      success: result.success,
      stories: result.storiesCount,
      articles: result.articlesAnalyzed
    });
  } catch (error) {
    console.error('[FORBES] Summary error:', error);
    logError('system', error, { source: 'forbes-weekly' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// HOSPITALITY TRENDS - เทรนด์โรงแรม/ท่องเที่ยว (ทุกวันจันทร์ 09:30)
// =============================================================================

cron.schedule(config.schedule.hospitality_trends || '30 9 * * 1', async () => {
  console.log('[HOSP] 🏨 Weekly Hospitality Trends triggered');
  logSystemEvent('system', 'hospitality_trends_start', {});

  try {
    const result = await hospitalityTrends.runWeeklySummary(config);
    console.log('[HOSP] Result:', result.success ? 'success' : 'failed');
    logSystemEvent('system', 'hospitality_trends_complete', {
      success: result.success,
      stories: result.storiesCount,
      articles: result.articlesAnalyzed
    });
  } catch (error) {
    console.error('[HOSP] Error:', error);
    logError('system', error, { source: 'hospitality-trends' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// WEEKLY REVENUE DASHBOARD - สรุปยอด Beds24 (ทุกวันจันทร์ 10:00)
// =============================================================================

cron.schedule(config.schedule.weekly_revenue || '0 10 * * 1', async () => {
  console.log('[REVENUE] 📊 Weekly Revenue Report triggered');
  logSystemEvent('system', 'weekly_revenue_start', {});

  try {
    const result = await weeklyRevenue.runWeeklyReport(config);
    console.log('[REVENUE] Result:', result.success ? 'success' : 'failed');
    logSystemEvent('system', 'weekly_revenue_complete', {
      success: result.success,
      revenue: result.report?.metrics?.totalRevenue,
      occupancy: result.report?.metrics?.avgOccupancy
    });
  } catch (error) {
    console.error('[REVENUE] Error:', error);
    logError('system', error, { source: 'weekly-revenue' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// SEO ENGINE - Weekly SEO Report (ทุกวันจันทร์ 10:30)
// =============================================================================

cron.schedule(config.schedule.seo_weekly_report || '30 10 * * 1', async () => {
  console.log('[SEO] 🔍 Weekly SEO Report triggered');
  logSystemEvent('system', 'seo_weekly_report_start', {});

  try {
    const result = await seoEngine.runWeeklyReport(config.seo);
    console.log('[SEO] Result:', result.success ? 'success' : 'failed');
    logSystemEvent('system', 'seo_weekly_report_complete', {
      success: result.success,
      clicks: result.report?.currentData?.totals?.clicks,
      grade: result.report?.analysis?.grade
    });

    // Run sitemap audit after weekly report
    const auditResult = await seoEngine.runSitemapAudit(config.seo);
    console.log('[SEO] Sitemap audit:', auditResult.success ? `${auditResult.audit?.coverageRate}% coverage` : 'failed');
  } catch (error) {
    console.error('[SEO] Error:', error);
    logError('system', error, { source: 'seo-engine' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// SEO ENGINE - Daily Keyword Alert (ทุกวัน 08:00)
// =============================================================================

cron.schedule(config.schedule.seo_keyword_alert || '0 8 * * *', async () => {
  console.log('[SEO] 🔔 Daily Keyword Alert Check triggered');
  logSystemEvent('system', 'seo_keyword_alert_start', {});

  try {
    const result = await seoEngine.runKeywordAlert(config.seo);
    console.log('[SEO] Alert result:', result.success ? 'success' : 'failed', `(${result.alertCount || 0} alerts)`);
    logSystemEvent('system', 'seo_keyword_alert_complete', {
      success: result.success,
      alertCount: result.alertCount
    });
  } catch (error) {
    console.error('[SEO] Alert error:', error);
    logError('system', error, { source: 'seo-engine-alert' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// SEO ENGINE - Sitemap Submit (Weekly + Event-Driven with Debounce)
// =============================================================================

// Debounced event-driven sitemap submit — ป้องกัน submit ถี่เกินไป (min 1 ชม.)
let lastSitemapSubmit = 0;
const SITEMAP_DEBOUNCE_MS = 60 * 60 * 1000; // 1 hour

async function submitSitemapIfNeeded(reason = 'unknown') {
  const now = Date.now();
  if (now - lastSitemapSubmit < SITEMAP_DEBOUNCE_MS) {
    console.log(`[SEO] Sitemap submit skipped (debounce) — last submit ${Math.round((now - lastSitemapSubmit) / 60000)}m ago, reason: ${reason}`);
    return { success: false, skipped: true, reason: 'debounce' };
  }
  const siteUrl = config.seo?.siteUrl || 'sc-domain:visionxbrain.com';
  try {
    const result = await searchConsole.submitSitemap(siteUrl, 'https://www.visionxbrain.com/sitemap.xml');
    lastSitemapSubmit = now;
    console.log(`[SEO] Sitemap submitted — reason: ${reason}, result: ${result.success ? 'OK' : 'failed'}`);
    return result;
  } catch (error) {
    console.error(`[SEO] Sitemap submit error (${reason}):`, error.message);
    return { success: false, error: error.message };
  }
}

// Weekly fallback — ทุกจันทร์ 06:00
cron.schedule('0 6 * * 1', async () => {
  console.log('[SEO] 🗺️ Weekly Sitemap Submit triggered');
  await submitSitemapIfNeeded('weekly-cron');
}, { timezone: config.agent.timezone });

// =============================================================================
// API HUNTER - หา API, ทดสอบ, วิเคราะห์โอกาส (ทุก 2 ชม.)
// =============================================================================

// Hunt every 2 hours during active hours (9:00-21:00)
cron.schedule('0 9,11,13,15,17,19,21 * * *', async () => {
  console.log('[API-HUNTER] 🔍 API Hunt Cycle triggered');
  logSystemEvent('system', 'api_hunt_start', {});

  try {
    const result = await apiHunter.runHuntCycle(config);
    console.log('[API-HUNTER] Hunt cycle result:', result.success ? 'success' : 'failed');
    logSystemEvent('system', 'api_hunt_complete', {
      success: result.success,
      discovered: result.discovered,
      opportunities: result.opportunities
    });

    // Notify Tars if found good opportunity
    if (result.bestOpportunity && result.bestOpportunity.analysis?.score?.total >= 70) {
      const opp = result.bestOpportunity;
      let message = `🔍 **API Hunter พบโอกาส!**\n\n`;
      message += `API: ${opp.api}\n`;
      message += `Score: ${opp.analysis.score.total}/100\n`;
      message += `Recommendation: ${opp.analysis.recommendation}\n\n`;
      if (opp.analysis.projectIdea) {
        message += `💡 Project Idea: ${opp.analysis.projectIdea.name}\n`;
        message += `${opp.analysis.projectIdea.description}\n`;
      }
      message += `\nต้องการให้ทำไหมครับ?`;

      await gateway.notifyOwner(message);
    }
  } catch (error) {
    console.error('[API-HUNTER] Hunt cycle error:', error);
    logError('system', error, { source: 'api-hunter' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// HOURLY REVENUE REPORT - ส่ง Report รายชั่วโมง (The Arch Casa)
// =============================================================================

// Send revenue report every hour during active hours (8:00-21:00)
cron.schedule('0 8-21 * * *', async () => {
  const hour = new Date().getHours();
  console.log(`[REVENUE] 📊 Hourly Revenue Report triggered at ${hour}:00`);
  logSystemEvent('system', 'revenue_report_start', { hour });

  try {
    const report = await revenueReport.generateHourlyReport();

    if (!report.success) {
      console.error('[REVENUE] Report generation failed:', report.error);
      return;
    }

    // Check if should send (avoid spam if nothing changed)
    const shouldSend = revenueReport.shouldSendReport(report.data);

    if (shouldSend) {
      console.log('[REVENUE] Sending report...');

      await gateway.notifyOwner(report.message);
      console.log('[REVENUE] Report sent successfully');
      logSystemEvent('system', 'revenue_report_sent', {
        hour,
        revenue: report.data.revenue,
        occupancy: report.data.occupancy
      });
    } else {
      console.log('[REVENUE] Skipping report (no significant changes)');
    }
  } catch (error) {
    console.error('[REVENUE] Report error:', error);
    logError('system', error, { source: 'revenue-report' });
  }
}, { timezone: config.agent.timezone });

// =============================================================================
// LEAD FINDER — Auto Lead Generation for VXB (ทุกวัน 10:00)
// =============================================================================

cron.schedule('0 10 * * *', async () => {
  console.log('[LEAD-FINDER] ⏰ Morning lead search CRON at', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
  try {
    const result = await leadFinder.runDaily();
    console.log('[LEAD-FINDER] ✅ Morning result:', JSON.stringify(result));
  } catch (error) {
    console.error('[LEAD-FINDER] ❌ Morning run error:', error.message, error.stack);
  }
}, { timezone: config.agent.timezone });

// Lead Finder: Afternoon run (15:00) — ใช้ RapidAPI Pro quota ให้คุ้ม
cron.schedule('0 15 * * *', async () => {
  console.log('[LEAD-FINDER] ⏰ Afternoon lead search CRON at', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
  try {
    const result = await leadFinder.runDaily();
    console.log('[LEAD-FINDER] ✅ Afternoon result:', JSON.stringify(result));
  } catch (error) {
    console.error('[LEAD-FINDER] ❌ Afternoon run error:', error.message, error.stack);
  }
}, { timezone: config.agent.timezone });

// Lead Finder: Check replies (ทุก 3 ชม. ระหว่าง 9:00-18:00)
cron.schedule('0 9,12,15,18 * * *', async () => {
  console.log('[LEAD-FINDER] 🔍 Reply check CRON TRIGGERED at', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
  try {
    await leadFinder.checkReplies();
  } catch (error) {
    console.error('[LEAD-FINDER] Reply check error:', error.message);
  }
}, { timezone: config.agent.timezone });

// Lead Finder: Startup catchup — ถ้า server เพิ่ง boot และยังไม่เคย run วันนี้ → run เลย
setTimeout(async () => {
  try {
    const stats = leadFinder.getStats();
    const lastRun = stats.lastRun ? new Date(stats.lastRun) : null;
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    today.setHours(0, 0, 0, 0);

    const ranToday = lastRun && new Date(lastRun.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })) >= today;

    if (!ranToday) {
      const bangkokHour = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', hour12: false }));
      if (bangkokHour >= 10 && bangkokHour < 22) {
        console.log(`[LEAD-FINDER] 🚀 Startup catchup — lastRun: ${stats.lastRun || 'never'}, running now...`);
        const result = await leadFinder.runDaily();
        console.log('[LEAD-FINDER] ✅ Startup catchup result:', JSON.stringify(result));
      } else {
        console.log(`[LEAD-FINDER] ⏳ Startup catchup skipped — Bangkok hour: ${bangkokHour} (will run at 10:00)`);
      }
    } else {
      console.log(`[LEAD-FINDER] ✅ Already ran today: ${stats.lastRun}`);
    }
  } catch (error) {
    console.error('[LEAD-FINDER] Startup catchup error:', error.message);
  }
}, 30000); // 30 วินาทีหลัง boot (ให้ระบบอื่น init ก่อน)

// =============================================================================
// LEAD FINDER API — Manual control + stats
// =============================================================================

app.get('/api/leads/stats', (req, res) => {
  res.json(leadFinder.getStats());
});

app.get('/api/leads/replies', async (req, res) => {
  try {
    // Get all leads that replied (including audit_sent and closed with reply)
    const allLeadsData = leadFinder.getLeads({});
    const repliedLeads = allLeadsData.filter(l =>
      l.status === 'replied' || l.status === 'audit_sent' ||
      (l.status === 'closed' && l.replyClassification) ||
      l.replyClassification
    );
    const repliesWithContent = [];

    for (const lead of repliedLeads) {
      const entry = {
        businessName: lead.businessName,
        industry: lead.industry,
        email: lead.email,
        domain: lead.domain,
        repliedAt: lead.repliedAt,
        replySubject: lead.replySubject || '',
        replySnippet: lead.replySnippet || '',
        replyBody: lead.replyBody || '',
        classification: lead.replyClassification || 'unknown',
        auditSentAt: lead.auditSentAt || null,
        status: lead.status,
      };

      // If no reply content stored, try to fetch from Gmail
      if (!entry.replyBody && lead.email) {
        try {
          const results = await gmailClient.search(`from:${lead.email} newer_than:30d`, 3);
          if (results && results.length > 0) {
            const msg = await gmailClient.getMessage(results[0].id);
            entry.replySnippet = msg?.snippet || '';
            const payload = msg?.payload;
            if (payload?.body?.data) {
              entry.replyBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
            } else if (payload?.parts) {
              const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
              const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
              if (textPart?.body?.data) {
                entry.replyBody = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
              } else if (htmlPart?.body?.data) {
                entry.replyBody = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
              }
            }
            const subjectH = payload?.headers?.find(h => h.name?.toLowerCase() === 'subject');
            entry.replySubject = subjectH?.value || entry.replySubject;
          }
        } catch (gmailErr) {
          // ignore — show what we have
        }
      }

      repliesWithContent.push(entry);
    }

    res.json({ total: repliesWithContent.length, replies: repliesWithContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads', (req, res) => {
  const { status, industry } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (industry) filter.industry = industry;
  res.json(leadFinder.getLeads(filter));
});

// Update a lead by domain or email
app.post('/api/leads/update', (req, res) => {
  const { domain, email: matchEmail, updates } = req.body;
  if (!updates || (!domain && !matchEmail)) {
    return res.status(400).json({ error: 'Need domain or email + updates' });
  }
  const result = leadFinder.updateLead(domain || matchEmail, updates);
  if (result) {
    res.json({ ok: true, lead: result });
  } else {
    res.status(404).json({ error: 'Lead not found' });
  }
});

let leadFinderRunning = false;
let leadFinderLastResult = null;
let enrichRunning = false;
let enrichLastResult = null;

// Enrich leads — find website + email via DuckDuckGo + scraping
app.post('/api/leads/enrich', async (req, res) => {
  if (enrichRunning) {
    return res.json({ message: 'Enrichment already running', status: 'busy' });
  }
  enrichRunning = true;
  res.json({ message: 'Enrichment started', status: 'started' });
  try {
    enrichLastResult = await leadFinder.enrichLeads();
  } catch (e) {
    enrichLastResult = { error: e.message };
    console.error('[ENRICH] Error:', e.message);
  } finally {
    enrichRunning = false;
  }
});

app.get('/api/leads/enrich/status', (req, res) => {
  res.json({ running: enrichRunning, lastResult: enrichLastResult });
});

app.post('/api/leads/run', async (req, res) => {
  if (leadFinderRunning) {
    return res.json({ message: 'Lead finder already running', status: 'busy' });
  }
  leadFinderRunning = true;
  res.json({ message: 'Lead finder started', status: 'started' });
  // Run async (don't block response)
  try {
    leadFinderLastResult = await leadFinder.runDaily();
  } catch (e) {
    leadFinderLastResult = { error: e.message };
    console.error('[LEAD-FINDER] Manual run error:', e.message, e.stack);
  } finally {
    leadFinderRunning = false;
  }
});

app.get('/api/leads/status', (req, res) => {
  const stats = leadFinder.getStats();
  const bangkokTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  res.json({
    running: leadFinderRunning,
    lastResult: leadFinderLastResult,
    lastRun: stats.lastRun,
    nextCron: '10:00 + 15:00 Bangkok daily',
    serverTime: bangkokTime,
    stats
  });
});

// Export full leads data (สำหรับ backup ก่อน deploy)
app.get('/api/leads/export', async (req, res) => {
  try {
    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname: dn, join: jn } = await import('path');
    const __dir = dn(fileURLToPath(import.meta.url));
    const leadsPath = jn(__dir, 'data', 'leads.json');
    const data = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'));
    res.json(data);
  } catch (e) {
    // Fallback: build from getLeads
    const leads = leadFinder.getLeads();
    const stats = leadFinder.getStats();
    res.json({ leads, processedDomains: [], lastRun: stats.lastRun });
  }
});

// Import/merge leads data (กู้ข้อมูลหลัง deploy)
app.post('/api/leads/import', async (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || !incoming.leads) {
      return res.status(400).json({ error: 'Need { leads: [...] }' });
    }

    const fs = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname: dn, join: jn } = await import('path');
    const __dir = dn(fileURLToPath(import.meta.url));
    const leadsPath = jn(__dir, 'data', 'leads.json');

    // Replace mode: overwrite entire leads.json
    if (incoming.replace) {
      const content = JSON.stringify(incoming, null, 2);
      const fd = fs.openSync(leadsPath, 'w');
      fs.writeSync(fd, content);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      console.log(`[LEADS-IMPORT] REPLACE mode: ${incoming.leads.length} leads (fsync'd)`);
      return res.json({ ok: true, mode: 'replace', total: incoming.leads.length });
    }

    let current;
    try {
      current = JSON.parse(fs.readFileSync(leadsPath, 'utf-8'));
    } catch {
      current = { leads: [], processedDomains: [], lastRun: null };
    }

    let merged = 0;
    let added = 0;
    for (const inLead of incoming.leads) {
      const id = inLead.place_id || inLead.domain || inLead.email;
      if (!id) continue;

      const existing = current.leads.find(l =>
        (l.place_id && inLead.place_id && l.place_id === inLead.place_id) ||
        (l.domain && inLead.domain && l.domain === inLead.domain) ||
        (l.email && inLead.email && l.email === inLead.email)
      );

      if (existing) {
        // Merge tracking data ที่อาจหายไป
        if (inLead.emailTrackingId && !existing.emailTrackingId) existing.emailTrackingId = inLead.emailTrackingId;
        if (inLead.emailClicked && !existing.emailClicked) {
          existing.emailClicked = inLead.emailClicked;
          existing.emailClickedAt = inLead.emailClickedAt;
          existing.emailClickCount = inLead.emailClickCount;
          existing.lastClickAt = inLead.lastClickAt;
        }
        if (inLead.emailOpened && !existing.emailOpened) existing.emailOpened = inLead.emailOpened;
        if (inLead.threadId && !existing.threadId) existing.threadId = inLead.threadId;
        merged++;
      } else {
        // Lead ไม่มีใน local — เพิ่มเข้าไป
        current.leads.push(inLead);
        if (inLead.place_id && !current.processedDomains.includes(inLead.place_id)) {
          current.processedDomains.push(inLead.place_id);
        }
        added++;
      }
    }

    // Merge processedDomains
    if (incoming.processedDomains) {
      for (const pd of incoming.processedDomains) {
        if (!current.processedDomains.includes(pd)) current.processedDomains.push(pd);
      }
    }

    const mergeContent = JSON.stringify(current, null, 2);
    const fd2 = fs.openSync(leadsPath, 'w');
    fs.writeSync(fd2, mergeContent);
    fs.fsyncSync(fd2);
    fs.closeSync(fd2);
    console.log(`[LEADS-IMPORT] Merged: ${merged}, Added: ${added}, Total: ${current.leads.length} (fsync'd)`);
    res.json({ ok: true, merged, added, total: current.leads.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Debug: test search only (sync, returns results)
app.get('/api/leads/test-search', async (req, res) => {
  try {
    const query = req.query.q || 'คลินิกความงาม กรุงเทพ';
    const results = await leadFinder.searchGoogle(query);
    res.json({ version: 'v3-with-details', query, count: results.length, results: results.slice(0, 3) });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Debug: test place details (sync, returns details for one place)
app.get('/api/leads/test-details', async (req, res) => {
  try {
    const placeId = req.query.place_id;
    if (!placeId) return res.status(400).json({ error: 'place_id required' });
    const details = await leadFinder.getPlaceDetails(placeId);
    res.json({ version: 'v3', place_id: placeId, details });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Map business type to relevant VXB service page
// Service page URL mapping — validated against live sitemap on startup
const SERVICE_PAGE_FALLBACK = 'https://www.visionxbrain.com/services/website';
const SERVICE_PAGE_MAP = [
  { kw: ['clinic', 'surgery', 'botox', 'hifu', 'filler', 'derma', 'skin'], url: 'https://www.visionxbrain.com/services/premium-clinic-website-hifu-botox-filler' },
  { kw: ['spa', 'massage', 'wellness'], url: 'https://www.visionxbrain.com/services/premium-spa-wellness-website-design' },
  { kw: ['restaurant', 'cafe', 'bakery', 'food'], url: 'https://www.visionxbrain.com/services/restaurant-website-design' },
  { kw: ['hotel', 'resort', 'hostel', 'guesthouse'], url: 'https://www.visionxbrain.com/services/hotel-website-design' },
  { kw: ['car rental', 'rent a car'], url: 'https://www.visionxbrain.com/services/car-rental-website-development' },
  { kw: ['fitness', 'gym', 'yoga'], url: 'https://www.visionxbrain.com/services/fitness-website-design' },
  { kw: ['dental', 'dentist'], url: 'https://www.visionxbrain.com/services/dental-cosmetic-surgery-clinic-sites' },
  { kw: ['real estate', 'property'], url: 'https://www.visionxbrain.com/services/real-estate-website-development-thailand' },
  { kw: ['shop', 'store', 'retail', 'ecommerce', 'e-commerce'], url: 'https://www.visionxbrain.com/services/e-commerce-website-design' },
  { kw: ['education', 'school', 'tutor', 'academy'], url: 'https://www.visionxbrain.com/services/educational-website-development' },
  { kw: ['law', 'legal'], url: 'https://www.visionxbrain.com/services/law-firm-website-design-experts' },
  { kw: ['construction', 'architect', 'interior'], url: 'https://www.visionxbrain.com/services/web-design-construction-company' },
  { kw: ['pet', 'vet', 'animal'], url: 'https://www.visionxbrain.com/services/website' },
  { kw: ['travel', 'tour'], url: 'https://www.visionxbrain.com/services/travel-website-development' },
];

// Validate service page URLs against live sitemap on startup
async function validateServicePageUrls() {
  try {
    const resp = await fetch('https://www.visionxbrain.com/sitemap.xml');
    if (!resp.ok) { console.warn('[SERVICE-PAGES] Could not fetch sitemap, skipping validation'); return; }
    const xml = await resp.text();
    const liveUrls = new Set((xml.match(/<loc>([^<]+)<\/loc>/g) || []).map(m => m.replace(/<\/?loc>/g, '')));
    let fixed = 0;
    for (const entry of SERVICE_PAGE_MAP) {
      if (entry.url !== SERVICE_PAGE_FALLBACK && !liveUrls.has(entry.url)) {
        console.warn(`[SERVICE-PAGES] ⚠️ 404 DETECTED: ${entry.url} → fallback to hub page`);
        entry.url = SERVICE_PAGE_FALLBACK;
        fixed++;
      }
    }
    console.log(`[SERVICE-PAGES] Validated ${SERVICE_PAGE_MAP.length} URLs against sitemap (${fixed} fixed)`);
  } catch (err) {
    console.warn('[SERVICE-PAGES] Validation failed:', err.message);
  }
}

function findRelevantServicePage(bizType) {
  const t = (bizType || '').toLowerCase();
  for (const entry of SERVICE_PAGE_MAP) {
    if (entry.kw.some(k => t.includes(k))) return entry.url;
  }
  return SERVICE_PAGE_FALLBACK;
}

// Test: send audit report (language-aware) — ทดสอบก่อนส่งจริง
app.post('/api/leads/test-audit', async (req, res) => {
  try {
    const { to, bizName, domain, bizType, replyText } = req.body;
    if (!to) return res.status(400).json({ error: 'to (email) required' });

    // สร้าง fake lead สำหรับทดสอบ
    const fakeLead = {
      email: to,
      domain: domain || 'example.com',
      businessName: bizName || 'Test Business',
      type: bizType || '',
      industry: bizType || '',
      websiteIssues: [],
      replyBody: replyText || '',
      replySnippet: replyText || '',
      threadId: null,
    };

    const result = await leadFinder.generateAndSendAuditReport(fakeLead);
    res.json({ success: true, ...result, language: /[\u0E00-\u0E7F]/.test(replyText || '') ? 'TH' : 'EN' });
  } catch (err) {
    console.error('[TEST-AUDIT] Error:', err);
    res.json({ success: false, error: err.message });
  }
});

// Test: send genuine value-first outreach email — Tar's 13 Requirements
app.post('/api/leads/test-email', async (req, res) => {
  try {
    const { to, lead_index } = req.body;
    if (!to) return res.status(400).json({ error: 'to (email) required' });

    const leads = leadFinder.getLeads();
    const idx = lead_index || 0;
    const lead = leads.filter(l => l.isGoodTarget && l.domain)?.[idx] || leads[idx];
    if (!lead) return res.status(404).json({ error: 'No leads found' });

    const domain = lead.domain || '-';
    // Fallback: ถ้า businessName เป็น placeholder หรือว่าง → ใช้ businessNameEn → domain
    const rawName = lead.businessName || '';
    const isPlaceholder = !rawName || /ชื่อธุรกิจ|ใส่ชื่อ|ภาษาไทย ถ้า|English name/i.test(rawName);
    const bizName = isPlaceholder ? (lead.businessNameEn || lead.name || domain) : rawName;
    const bizType = lead.type || lead.industry || '';
    const issues = lead.websiteIssues || [];
    const servicePage = findRelevantServicePage(bizType);
    const isHotel = /hotel|resort|hostel|guesthouse|โรงแรม|ที่พัก/i.test(bizType);
    const websiteUrl = domain !== '-' ? 'https://' + domain : '';

    // AI generates genuine value-first email
    const prompt = `คุณคือ ต้าร์ — Founder ของ VisionXBrain เขียน email ถึงเจ้าของ "${bizName}"

=== ตัวตนของต้าร์ ===
- ทำเว็บ Webflow + Digital Marketing มา 80+ ราย 6 ประเทศ Clutch 5.0
- ผลงาน: traffic เพิ่ม x28, orders x24, booking x30
- พูดตรง มั่นใจ ไม่อ้อมค้อม ไม่เป็นทางการ ไม่ขาย
- เป็น "ครีเอทีฟบัดดี้เพื่อนคู่คิด" — ผู้ให้ก่อนเสมอ
- ตัวอย่างวิธีเขียน:
  "เว็บที่ดีต้องทำงานแทนคุณ ไม่ใช่แค่สวย"
  "เว็บโหลดเกิน 3 วินาที คนกดออก 53% — ลูกค้าหายไปก่อนเห็นสินค้าด้วยซ้ำ"
  "ไม่ใช่สัญญา แต่ผลจริง"
- โดยส่วนตัวเชี่ยวชาญด้าน Digital Marketing, SEO, AI Search, Automation — ทำระบบ SEO + AI Search แบบ Auto ให้ลูกค้า
- ห้ามพูดถึงโรงแรม/ปาย/ประสบการณ์ส่วนตัว

=== ข้อมูลธุรกิจ ===
- ชื่อ: ${bizName}
- ประเภท: ${bizType}
- เว็บ: ${domain}
- ปัญหาที่เจอ: ${issues.length > 0 ? issues.join(', ') : 'ยังไม่วิเคราะห์ลึก'}

=== โครงสร้าง email (ทำตามนี้เท่านั้น) ===

**1. เปิดเรื่อง (2-3 บรรทัด):**
- "สวัสดีครับ ผมต้าร์ จาก บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด ครับ"
- หลังแนะนำตัว ใส่ screenshot เว็บลูกค้าด้วย HTML:
<div style="text-align:center;margin:16px 0;">
  <p style="font-size:13px;color:#888;margin:0 0 8px;">เว็บไซต์ปัจจุบันของ ${bizName}:</p>
  <img src="https://image.thum.io/get/width/600/${websiteUrl}" alt="เว็บไซต์ ${bizName}" style="width:100%;max-width:580px;border-radius:12px;border:1px solid #eee;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
</div>
แสดงให้เห็นว่าเราดูเว็บจริงๆ ไม่ได้ส่ง template
- บอกตรงๆ ว่าเจอเว็บเขาตอน research ธุรกิจ${bizType}ออนไลน์
- ลองดูเว็บแล้วเห็นจุดที่ถ้าปรับนิดหน่อย น่าจะได้ลูกค้าเพิ่มเยอะเลย เลยตั้งใจเขียนคำแนะนำเฉพาะสำหรับธุรกิจของคุณมาครับ
- ต้องให้รู้สึกว่า report นี้ผมเขียนให้เคสธุรกิจลูกค้าโดยตรง ไม่ใช่ template
- ใส่ลิงก์เว็บลูกค้าด้วย เช่น "ผมเจอเว็บของคุณ (${websiteUrl}) ตอน research..." — แสดงว่าเราใส่ใจดูจริง
- ห้ามพูดถึง Google reviews / rating (อาจไม่ตรง)

**2. Action Plan — 5-6 ข้อที่ทำแล้วเปลี่ยนธุรกิจ:**
แต่ละข้อต้องมีโครงสร้าง HTML แบบนี้:

<div style="background:#fafafa;border-left:4px solid #eb3f43;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
  <strong style="color:#1b1c1b;font-size:15px;">Step X: ชื่อสิ่งที่ควรทำ</strong>
  <p style="margin:8px 0 4px;color:#eb3f43;font-weight:bold;font-size:14px;">Impact: อธิบายว่าทำแล้วเปลี่ยนอะไร (ภาษาธุรกิจ)</p>
  <p style="margin:4px 0;font-size:14px;color:#444;line-height:1.7;">อธิบายรายละเอียด + วิธีทำเอง step-by-step ที่ actionable จริงๆ</p>
  <p style="margin:4px 0;font-size:13px;color:#888;font-style:italic;">** บรรทัดนี้ใส่เฉพาะข้อที่เกี่ยวกับการ Post/Social เท่านั้น: "ปกติทางผมจะใช้ระบบ automation ช่วยจัดการโพสให้ลูกค้าครับ" — ข้ออื่นที่ไม่เกี่ยวกับ Post ห้ามใส่ประโยคนี้! **</p>
</div>

ข้อที่ต้องมี (ปรับ wording ให้เหมาะธุรกิจ):

A) **Google Business Profile Post** — ใช้แนวคิดนี้เป็นหลัก:
"จริงๆแล้วถ้าอยากให้ธุรกิจ Rank ดีขึ้น การมองเห็นดีขึ้น สิ่งที่ทำได้ง่ายเลยคือการโพส Google Business ครับ ตอนนี้คู่แข่งส่วนใหญ่มองข้ามเรื่องนี้ ลองทำดูก็ได้ครับ วิธีนี้จะช่วยให้อันดับถูกจัดได้ดีขึ้น ถึงแม้กรณีรีวิวน้อย ก็ยังชนะคู่แข่งที่ทุกอย่างใหญ่กว่าได้ด้วยครับ"
บอก action ชัด: โพสอะไร กี่ครั้ง/สัปดาห์ ใส่อะไรบ้าง

B) **NAP + Map Consistency** — ใช้แนวคิดนี้:
"ถ้าทำให้เว็บไซต์มีแผนที่ Map ครบถูกต้อง ชื่อธุรกิจและหมุดตรงกับ Google Maps เบอร์โทร ที่อยู่ธุรกิจตรง เว็บไซต์ก็จะช่วยดันอันดับได้ไวมาก ในการเพิ่มลูกค้าเข้ามาฟรีๆ จริงๆก็มีเทคนิคที่ลึกกว่านี้ แต่แค่นี้ลูกค้าจะเข้ามาเยอะขึ้นแน่นอน"
checklist: ชื่อตรงไหม เบอร์ตรงไหม ที่อยู่ตรงไหม map embed ยัง

C) **AI Search Optimization** — เรื่องที่ลูกค้าตามหา:
ตอนนี้คนเริ่มใช้ AI (ChatGPT, Gemini, Perplexity) ค้นหาแทน Google มากขึ้น
ธุรกิจที่มี structured data + เนื้อหาตอบคำถามชัดจะถูก AI แนะนำก่อน
แนะนำ action ชัด: ทำอะไรบ้างให้ AI หาเจอ

D) **Website Issues** — จากข้อมูลที่วิเคราะห์ได้ (ถ้ามี issues):
${issues.filter(i => !/ssl|https/i.test(i)).length > 0 ? issues.filter(i => !/ssl|https/i.test(i)).map(i => '- ' + i).join('\\n') : 'วิเคราะห์จาก domain + bizType แล้วแนะนำเรื่อง mobile-first, page speed, CTA ที่ชัด, เว็บหลายภาษา'}
แนะนำวิธีแก้ที่เห็นผลทันที (ห้ามยก SSL/HTTPS เป็นประเด็น!)

E) **อีก 1-2 ข้อ** — คุณเลือกเองจากประสบการณ์ที่ทำให้ลูกค้า WOW:
เช่น เว็บหลายภาษา (ถ้าธุรกิจมีลูกค้าต่างชาติ), Content Strategy, Local SEO, Social Proof, Conversion Optimization, Structured Data/Schema Markup
ต้อง WOW จริงๆ ไม่ใช่คำแนะนำทั่วไปที่ใครก็รู้

⚠️ **ห้ามแนะนำเรื่อง SSL/HTTPS เด็ดขาด!** — เว็บทุกวันนี้มี SSL หมดแล้ว ถ้ายกเรื่องนี้ลูกค้าจะรู้ว่าเราไม่ได้ดูเว็บจริง เหมือนยกประเด็นสำเร็จรูปมา
⚠️ **ห้ามแนะนำเรื่องพื้นฐานเกินไป** เช่น "ทำเว็บให้สวย" "ใส่รูปสินค้า" — ต้องเป็นคำแนะนำระดับมืออาชีพที่คนทั่วไปไม่รู้

${isHotel ? `F) **Hotel-Specific: ระบบ Automation สำหรับโรงแรม** —
ตอนนี้ VisionXBrain มี product เฉพาะสำหรับโรงแรม:
- ระบบ Auto Reviews — รีวิวจัดการอัตโนมัติ ตอบรีวิวลูกค้าทุก platform
- Kiosk Self Check-In — ลูกค้า check-in เองได้ ลดงาน front desk
- Auto Social Post — โพสทุก social media อัตโนมัติทุก platform
ถ้าเป็นโรงแรม ให้แนะนำ product เหล่านี้ด้วย บอกว่าผมทำระบบพวกนี้ให้ลูกค้าโรงแรมอยู่แล้ว` : ''}

**3. ปิดท้าย:**
- สรุปสั้น 2-3 บรรทัด ว่าถ้าทำตาม action plan นี้ ธุรกิจจะเปลี่ยนยังไง
- "โดยส่วนตัวผมเชี่ยวชาญด้าน Digital Marketing, SEO, AI Search และระบบ Automation ครับ ทำระบบ SEO + AI Search แบบ Auto ให้ลูกค้าอยู่แล้ว"
- "พอดีผมรับทำเซอร์วิสนี้ให้ลูกค้าอยู่แล้วครับ ลองดูบริการของผมได้ที่: ${servicePage}"
- "หากต้องการรับคำปรึกษาเพิ่มเติม โทรตรงหาผมก็ได้ครับ ปรึกษาฟรี 097-153-6565"
- "ไม่เป็นลูกค้าไม่เป็นไรครับ ผมเป็นครีเอทีฟบัดดี้เพื่อนคู่คิดอยู่แล้ว พอดีเห็นเว็บของคุณลูกค้าเลยลองส่งแนะนำครับ"
- "ถ้าอยากได้ report แบบละเอียดกว่านี้ กดปุ่มด้านล่างได้เลยครับ ฟรีครับ"
- ห้ามใส่ปุ่ม (จะใส่ให้ใน template)

=== กฎเหล็ก ===
- ห้ามพูดถึงโรงแรม/ปาย/ประสบการณ์เปิดโรงแรม
- ห้ามพูดถึง Google reviews/rating (อาจผิด)
- ห้ามให้คะแนน/score "3/10" "4/10"
- ห้ามตะโกน ห้ามคำว่า "ด่วน" "ก่อนสาย" "รีบ"
- ห้ามภาษาทางการ — ใช้ "ผม" "คุณ" "ครับ"
- ห้ามเขียนเหมือน AI — ไม่ใช่ "ข้อเสนอแนะ" "ข้อควรพิจารณา"
- ประโยคสั้นยาวสลับ อ่านแล้วเหมือนคนพิมพ์
- Emoji ได้แค่ในกล่อง action (อย่างละไม่เกิน 1 ที่) — ห้ามใส่ emoji ใน subject เด็ดขาด!
- HTML inline style ทั้งหมด (email client)
- ตอบ JSON เท่านั้น

ตอบ JSON:
{
  "subject": "หัวข้อ — ต้องมีชื่อธุรกิจลูกค้า (${bizName}) + สื่อว่ามีคำแนะนำดีๆ ให้อยากเปิดอ่าน — ห้ามหัวข้อทั่วไป! ใช้ CRO คิดเอง ภาษาไทย — ห้ามใส่ emoji เด็ดขาด!",
  "body": "HTML body ทั้งหมด (ไม่ต้องใส่ signature/ปุ่ม จะใส่ให้ใน template)"
}`;

    const aiRes = await claude.chat(
      [{ role: 'user', content: prompt }],
      {
        system: 'คุณคือ ต้าร์ เจ้าของ VisionXBrain เขียน email เหมือนคนจริงที่อยากช่วยจริงๆ ไม่ใช่ AI ไม่ขาย เป็นผู้ให้ ตอบ JSON เท่านั้น',
        max_tokens: 4000,
        skipAutoRecall: true
      }
    );

    const jsonMatch = aiRes.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI failed to generate email', raw: aiRes });

    const emailContent = JSON.parse(jsonMatch[0]);

    // Wrap AI body in premium branded template
    // Strip emoji from subject (safety net — AI อาจใส่มาถึงสั่งห้าม)
    const subject = emailContent.subject.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();

    // Generate tracking IDs
    const trackingId = (lead.place_id || domain) + '_' + Date.now();
    const clickBase = 'https://oracle-agent-production-546e.up.railway.app/api/email/click/' + trackingId;
    const trackedServicePage = clickBase + '?url=' + encodeURIComponent(servicePage);
    const trackedVxbHome = clickBase + '?url=' + encodeURIComponent('https://www.visionxbrain.com');
    const body = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1b1c1b;line-height:1.8;background:#fff;padding:0 20px;">

  <div style="height:3px;background:linear-gradient(90deg,#eb3f43,#6e49f3);border-radius:2px;margin-bottom:28px;"></div>

  ${emailContent.body}

  <!-- Service Page Link -->
  <div style="background:#f8f7f5;border-radius:12px;padding:18px 24px;margin:24px 0;text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;color:#666;">บริการที่เกี่ยวข้องกับธุรกิจของคุณครับ:</p>
    <a href="${trackedServicePage}" style="color:#eb3f43;font-weight:bold;text-decoration:none;font-size:15px;">${servicePage.replace('https://', '')}</a>
  </div>

  <!-- CTA Button -->
  <div style="text-align:center;margin:32px 0;">
    <a href="mailto:info@visionxbrain.com?subject=ขอ Report เต็ม — ${bizName}" style="display:inline-block;background:linear-gradient(135deg,#eb3f43,#d63337);color:#fff;padding:16px 40px;border-radius:100px;text-decoration:none;font-size:16px;font-weight:bold;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(235,63,67,0.3);">ขอ Report เต็มฟรี</a>
    <span style="display:inline-block;width:12px;"></span>
    <a href="tel:0971536565" style="display:inline-block;background:#fff;color:#eb3f43;padding:16px 40px;border-radius:100px;text-decoration:none;font-size:16px;font-weight:bold;letter-spacing:0.3px;border:2px solid #eb3f43;">โทรปรึกษาฟรี</a>
    <p style="color:#999;font-size:13px;margin-top:10px;">หรือตอบกลับ email นี้ได้เลยครับ ไม่มีข้อผูกมัดใดๆ</p>
  </div>

  <!-- Signature -->
  <table style="margin-top:36px;border-top:1px solid #eee;padding-top:20px;width:100%;">
    <tr>
      <td style="padding-right:16px;vertical-align:top;">
        <div style="width:4px;height:52px;background:linear-gradient(180deg,#eb3f43,#6e49f3);border-radius:2px;"></div>
      </td>
      <td style="font-size:13px;color:#666;line-height:1.7;">
        <strong style="color:#1b1c1b;font-size:15px;">Tanakit Chaithip (ต้าร์)</strong><br>
        Founder & Creative Director — <span style="color:#eb3f43;font-weight:bold;">บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด</span><br>
        80+ ลูกค้า 6 ประเทศ | Clutch 5.0 | ทะเบียน: 0585564000175<br>
        <span style="font-size:14px;"><a href="tel:0971536565" style="color:#1b1c1b;text-decoration:none;font-weight:bold;">097-153-6565</a> — โทรปรึกษาฟรีครับ</span><br>
        <a href="${trackedVxbHome}" style="color:#eb3f43;text-decoration:none;">www.visionxbrain.com</a>
      </td>
    </tr>
  </table>

</div>`;

    // Attach cached PDF from leadFinder (โหลดครั้งเดียวตอน startup — ทุก email ต้องมี!)
    const attachments = [];
    if (leadFinder.pdfBuffer) {
      attachments.push({
        filename: leadFinder.pdfFilename || 'VisionXBrain Portfolio.pdf',
        content: leadFinder.pdfBuffer,
        mimeType: 'application/pdf'
      });
    } else {
      console.log('[TEST-EMAIL] ⚠️ PDF not cached — email sent without attachment');
    }

    // Tracking pixel (ยังเก็บไว้เป็น backup แม้ Gmail pre-fetch)
    const trackingPixel = `<img src="https://oracle-agent-production-546e.up.railway.app/api/email/track/${trackingId}.png" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" alt="">`;
    const bodyWithTracking = body.replace(/<\/div>\s*$/, trackingPixel + '\n</div>');

    const result = await gmailClient.send({ to, subject, body: bodyWithTracking, attachments: attachments.length ? attachments : undefined });

    // Mark lead as emailed + persist to file
    const sentAt = new Date().toISOString();
    console.log(`[TEST-EMAIL] Persisting... place_id: ${lead.place_id}, bizName: ${bizName}`);
    try {
      const updated = leadFinder.updateLead(lead.place_id, {
        emailSentAt: sentAt,
        emailTrackingId: trackingId,
        status: 'emailed',
        emailSentTo: to
      });
      console.log(`[TEST-EMAIL] Persisted: ${bizName} → emailed (result: ${updated}), trackingId: ${trackingId}`);
    } catch (persistErr) {
      console.log(`[TEST-EMAIL] Persist ERROR: ${persistErr.message}`);
    }

    res.json({
      success: true, to, subject,
      lead: { name: bizName, domain, type: bizType, issues, servicePage, trackingId },
      gmail: result,
      attachment: attachments.length ? 'VisionXBrain Portfolio.pdf' : 'none (PDF not found on server)'
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// ============ DGP PROPOSAL SYSTEM ============

// Fixed HTML sections from dgp-proposal-duke.html (ราคาคงที่ ห้ามเปลี่ยน)
const DGP_PRICING_HTML = `
  <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#1b1c1b;text-align:center;">ราคาโปรโมชั่นลูกค้ากลุ่มแรก</p>
  <p style="margin:0 0 20px;font-size:12px;color:#999;text-align:center;">ราคานี้จะไม่มีอีกหลังจากนี้</p>
  <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 0 24px;">
    <tr>
      <td style="width:33%;vertical-align:top;background:#fff;border:2px solid #e5e5e5;border-radius:10px;padding:0;text-align:center;">
        <div style="background:#f8f7f5;padding:14px 10px;border-radius:8px 8px 0 0;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#1b1c1b;">Basic</p>
          <p style="margin:3px 0 0;font-size:12px;color:#888;">TH + EN</p>
        </div>
        <div style="padding:16px 10px 20px;">
          <p style="margin:0;font-size:11px;color:#999;text-decoration:line-through;">33,000</p>
          <p style="margin:2px 0 0;font-size:24px;font-weight:800;color:#eb3f43;">19,900</p>
          <p style="margin:0 0 12px;font-size:11px;color:#888;">Setup ครั้งเดียว</p>
          <div style="height:1px;background:#eee;margin:0 10px 12px;"></div>
          <p style="margin:0;font-size:11px;color:#999;text-decoration:line-through;">20,000/ด.</p>
          <p style="margin:2px 0 0;font-size:22px;font-weight:800;color:#1b1c1b;">9,900</p>
          <p style="margin:0 0 10px;font-size:11px;color:#888;">บาท/เดือน</p>
          <div style="background:#fef2f2;border-radius:4px;padding:4px 8px;display:inline-block;">
            <span style="font-size:11px;color:#eb3f43;font-weight:bold;">ประหยัด 40%</span>
          </div>
        </div>
      </td>
      <td style="width:33%;vertical-align:top;background:#fff;border:2px solid #eb3f43;border-radius:10px;padding:0;text-align:center;">
        <div style="background:#eb3f43;padding:14px 10px;border-radius:7px 7px 0 0;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#fff;">Growth</p>
          <p style="margin:3px 0 0;font-size:12px;color:#ffcdd2;">TH+EN+CN</p>
        </div>
        <div style="padding:16px 10px 20px;">
          <p style="margin:0;font-size:11px;color:#999;text-decoration:line-through;">41,000</p>
          <p style="margin:2px 0 0;font-size:24px;font-weight:800;color:#eb3f43;">25,900</p>
          <p style="margin:0 0 12px;font-size:11px;color:#888;">Setup ครั้งเดียว</p>
          <div style="height:1px;background:#eee;margin:0 10px 12px;"></div>
          <p style="margin:0;font-size:11px;color:#999;text-decoration:line-through;">25,000/ด.</p>
          <p style="margin:2px 0 0;font-size:22px;font-weight:800;color:#1b1c1b;">12,900</p>
          <p style="margin:0 0 10px;font-size:11px;color:#888;">บาท/เดือน</p>
          <div style="background:#fef2f2;border-radius:4px;padding:4px 8px;display:inline-block;">
            <span style="font-size:11px;color:#eb3f43;font-weight:bold;">ประหยัด 37% + จีน</span>
          </div>
        </div>
      </td>
      <td style="width:33%;vertical-align:top;background:#fff;border:2px solid #e5e5e5;border-radius:10px;padding:0;text-align:center;">
        <div style="background:#1b1c1b;padding:14px 10px;border-radius:7px 7px 0 0;">
          <p style="margin:0;font-size:15px;font-weight:bold;color:#fff;">Full</p>
          <p style="margin:3px 0 0;font-size:12px;color:#aaa;">TH+EN+CN+JP</p>
        </div>
        <div style="padding:16px 10px 20px;">
          <p style="margin:0;font-size:11px;color:#999;text-decoration:line-through;">49,000</p>
          <p style="margin:2px 0 0;font-size:24px;font-weight:800;color:#eb3f43;">29,900</p>
          <p style="margin:0 0 12px;font-size:11px;color:#888;">Setup ครั้งเดียว</p>
          <div style="height:1px;background:#eee;margin:0 10px 12px;"></div>
          <p style="margin:0;font-size:11px;color:#999;text-decoration:line-through;">30,000/ด.</p>
          <p style="margin:2px 0 0;font-size:22px;font-weight:800;color:#1b1c1b;">15,900</p>
          <p style="margin:0 0 10px;font-size:11px;color:#888;">บาท/เดือน</p>
          <div style="background:#fef2f2;border-radius:4px;padding:4px 8px;display:inline-block;">
            <span style="font-size:11px;color:#eb3f43;font-weight:bold;">ประหยัด 39% + 4 ภาษา</span>
          </div>
        </div>
      </td>
    </tr>
  </table>`;

const DGP_PROMO_HTML = `
  <p style="font-size:14px;color:#444;margin:0 0 8px;">ผมกำลังขยายบริการนี้ อยากได้ลูกค้ากลุ่มแรกที่ใช้งานจริง เลยให้ราคาต่ำสุดที่จะให้ได้ เงื่อนไขเดียว ถ้าผลงานออกมาดีตามเป้า ช่วยรีวิวให้ผมสั้นๆ แค่นั้น ไม่พอใจก็ไม่ต้องรีวิว ไม่มีข้อผูกมัด</p>
  <p style="font-size:12px;color:#999;margin:0 0 24px;">* ค่า hosting จ่ายตรงกับ Webflow: ~700-800 บาท/เดือน | เว็บหลายภาษา ค่าระบบเพิ่ม 350 บาท/เดือน จ่ายตรงกับ Webflow</p>
  <p style="font-size:14px;color:#444;margin:0 0 8px;"><strong>ไม่มีสัญญาผูกมัด</strong> ยกเลิกเมื่อไหร่ก็ได้ สิ่งที่ได้ไปแล้วไม่หายไปไหน Landing Page ยังใช้ต่อได้ บทความทั้งหมดยังดึง traffic ต่อ</p>
  <p style="font-size:14px;color:#444;margin:0 0 24px;">ถ้าวันนึงยิง Ads ด้วย เว็บที่โหลดเร็วและ convert สูง Google ให้ Quality Score สูง ค่าคลิกถูกลง 20-30% แล้วเอา data จาก SEO ที่สะสมมาใช้ได้เลย</p>`;

function buildDgpTemplate({ opening, problemROI, landingPageDesc, seoAutopilotDesc, recommendation, bizName, trackingId }) {
  const clickBase = 'https://oracle-agent-production-546e.up.railway.app/api/email/click/' + (trackingId || 'dgp');
  const trackedVxbHome = clickBase + '?url=' + encodeURIComponent('https://www.visionxbrain.com');
  const trackedEmail = `mailto:info@visionxbrain.com?subject=สนใจ DGP — ${encodeURIComponent(bizName || '')}`;

  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1b1c1b;line-height:1.8;background:#fff;padding:0 20px;">

  <div style="height:3px;background:linear-gradient(90deg,#eb3f43,#6e49f3);border-radius:2px;margin-bottom:28px;"></div>

  <p style="font-size:15px;margin:0 0 16px;">สวัสดีครับ</p>

  ${opening}

  ${problemROI}

  <!-- Section 1 -->
  <div style="background:#fafafa;border-left:4px solid #eb3f43;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
    <strong style="color:#1b1c1b;font-size:15px;">1. Landing Page ที่ออกแบบมาให้คนซื้อ/สมัคร</strong>
    <p style="margin:8px 0 4px;color:#eb3f43;font-weight:bold;font-size:14px;">ไม่ใช่แค่หน้าเว็บสวย แต่เป็นหน้าเว็บที่ปิดการขาย</p>
    ${landingPageDesc}
  </div>

  <!-- Section 2 -->
  <div style="background:#fafafa;border-left:4px solid #6e49f3;padding:16px 20px;margin:16px 0;border-radius:0 8px 8px 0;">
    <strong style="color:#1b1c1b;font-size:15px;">2. VXB SEO Autopilot — ระบบที่ผมพัฒนาขึ้นมาเอง</strong>
    <p style="margin:8px 0 4px;color:#6e49f3;font-weight:bold;font-size:14px;">ไม่ใช่จ้างคนมานั่งเขียนบทความ</p>
    ${seoAutopilotDesc}
  </div>

  ${DGP_PRICING_HTML}

  ${DGP_PROMO_HTML}

  ${recommendation}

  <!-- CTA -->
  <div style="text-align:center;margin:28px 0;">
    <a href="${trackedEmail}" style="display:inline-block;background:linear-gradient(135deg,#eb3f43,#d63337);color:#fff;padding:14px 36px;border-radius:100px;text-decoration:none;font-size:15px;font-weight:bold;letter-spacing:0.3px;">สนใจแจ้งได้เลยครับ</a>
    <span style="display:inline-block;width:12px;"></span>
    <a href="tel:0971536565" style="display:inline-block;background:#fff;color:#eb3f43;padding:14px 36px;border-radius:100px;text-decoration:none;font-size:15px;font-weight:bold;letter-spacing:0.3px;border:2px solid #eb3f43;">โทรปรึกษาฟรี</a>
    <p style="color:#999;font-size:13px;margin-top:10px;">เริ่มได้ภายใน 1 สัปดาห์ หรือตอบกลับ email นี้ได้เลยครับ</p>
  </div>

  <!-- Signature -->
  <table style="margin-top:36px;border-top:1px solid #eee;padding-top:20px;width:100%;">
    <tr>
      <td style="padding-right:16px;vertical-align:top;">
        <div style="width:4px;height:52px;background:linear-gradient(180deg,#eb3f43,#6e49f3);border-radius:2px;"></div>
      </td>
      <td style="font-size:13px;color:#666;line-height:1.7;">
        <strong style="color:#1b1c1b;font-size:15px;">Tanakit Chaithip (ต้าร์)</strong><br>
        Founder & Creative Director — <span style="color:#eb3f43;font-weight:bold;">บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด</span><br>
        80+ ลูกค้า 6 ประเทศ | Clutch 5.0 | ทะเบียน: 0585564000175<br>
        <span style="font-size:14px;"><a href="tel:0971536565" style="color:#1b1c1b;text-decoration:none;font-weight:bold;">097-153-6565</a> — โทรปรึกษาฟรีครับ</span><br>
        <a href="${trackedVxbHome}" style="color:#eb3f43;text-decoration:none;">www.visionxbrain.com</a>
      </td>
    </tr>
  </table>

</div>`;
}

// DGP Generate — AI สร้าง proposal (standalone, ไม่ผูก lead finder)
// --- DGP Sent Tracking ---
const DGP_SENT_PATH = join(__dirname, 'data', 'dgp-sent.json');
function loadDgpSent() {
  try { return JSON.parse(readFileSync(DGP_SENT_PATH, 'utf8')); } catch { return []; }
}
function saveDgpSent(records) {
  writeFileSync(DGP_SENT_PATH, JSON.stringify(records, null, 2), 'utf8');
}
function isDgpAlreadySent(email, bizName) {
  const records = loadDgpSent();
  return records.some(r => r.email === email && r.bizName === bizName);
}

// GET /api/dgp/sent — ดูรายการที่ส่งแล้ว
app.get('/api/dgp/sent', (req, res) => {
  res.json(loadDgpSent());
});

app.post('/api/dgp/generate', async (req, res) => {
  try {
    const { bizName, industry, domain, email, context } = req.body;
    if (!bizName) return res.status(400).json({ error: 'bizName required' });

    // Check if already sent
    if (email && isDgpAlreadySent(email, bizName)) {
      return res.status(409).json({ error: `DGP proposal already sent to ${bizName} (${email}) — ห้ามส่งซ้ำ`, alreadySent: true });
    }

    const bizType = industry || '';
    const webDomain = domain || '-';
    const extraContext = context || '';

    const prompt = `คุณคือ ต้าร์ (Tanakit Chaithip) — Founder ของ VisionXBrain เขียน DGP Proposal email ถึงเจ้าของ "${bizName}"

=== ต้าร์คือใคร (จำให้ขึ้นใจ) ===
- คนเดียวที่ทำทุกอย่าง: Design, Development, SEO, CRO
- เลือกลูกค้า ไม่ใช่ลูกค้าเลือก — ไม่รับ pitch ไม่แข่งราคา
- London Top 3% Webflow Partner
- รันธุรกิจหลายตัวเอง เข้าใจว่าเว็บที่ดี = เว็บที่ทำเงิน
- 80+ ลูกค้า 6 ประเทศ, Clutch 5.0, Core Web Vitals 90+ ทุกโปรเจกต์
- เสร็จใน 2-3 สัปดาห์ ไม่ใช่ 3 เดือนแบบ agency ทั่วไป
- พัฒนาระบบ SEO Autopilot ของตัวเอง บทความ 380+ ชิ้น organic traffic เพิ่มทุกเดือนไม่จ่าย Ads

=== VXB Voice (สำคัญมาก!) ===
ต้องเขียนเหมือน Tar คุยกับลูกค้าตัวต่อตัว ไม่ใช่ AI เขียน:
- มั่นใจ แต่ไม่ตะโกน
- ตรง แต่ไม่หยาบ
- ให้ผลงานและตัวเลขพูดแทน พูดครั้งเดียวให้ชัด
- ประโยคสั้นยาวสลับ อ่านแล้วเหมือนคนพิมพ์
- ใช้ "ผม" "คุณ" "ครับ"

❌ ห้าม:
- ห้าม emoji เด็ดขาด
- ห้ามตะโกน (!!!) ห้ามคำว่า "ด่วน" "ก่อนสาย" "รีบ"
- ห้ามซ้ำตัวเลข/คำเดิมหลายจุด (80+ ลูกค้า พูดครั้งเดียว)
- ห้ามคำ AI ชอบใช้: crucial, leverage, landscape, ข้อเสนอแนะ, ข้อควรพิจารณา
- ห้ามเขียนเหมือน ad copy / brochure / copywriter AI
- ห้ามภาษาทางการ
- ห้ามอ้างเคสลูกค้าอื่นเด็ดขาด! (ห้ามพูดถึง SiamTak, Keystone, Prime Host หรือตัวเลข x24 x28 x30 ใน proposal) — โฟกัสแค่ธุรกิจของลูกค้าคนนี้เท่านั้น ราคาแต่ละเคสต่างกัน อ้างไปก็ไม่เกี่ยว
- ห้ามพูดว่า "ทุกคำถามตอบหมดแล้ว" หรือ claim เกินจริง

✅ ตัวอย่างที่ถูก:
- "เว็บที่ดีต้องทำงานแทนคุณ ไม่ใช่แค่สวย"
- "เว็บโหลดเกิน 3 วินาที คนกดออก 53% — ลูกค้าหายไปก่อนจะเห็นสินค้าด้วยซ้ำ"
- "ไม่ใช่สัญญา แต่ผลจริง"

=== ตัวอย่างน้ำเสียง Tar (ดูแค่วิธีเขียน ห้าม copy ข้อมูล) ===
opening: "ตามที่คุยกันและ Audit ที่ส่งไป ผมสรุปแผนเพิ่มนักเรียนให้ Duke ครับ"
landing page: "ผมใช้หลัก CRO ออกแบบโครงสร้างหน้าตามจิตวิทยาการตัดสินใจ เริ่มจากปัญหาที่คนเจอ วิธีแก้ หลักฐาน แล้วจบด้วยปุ่มสมัคร FAQ ตอบคำถามครบในหน้าเดียว คนไม่ต้องออกไปหาที่อื่น"
seo: "6 เดือน = 180 บทความ เหมือนมีพนักงานขาย 180 คนทำงาน 24 ชั่วโมง ยิ่งนานยิ่งมีคนเข้า ไม่เหมือน Ads ที่หยุดจ่ายก็หายทันที"
recommendation: "ผมแนะนำเริ่ม Basic (ไทย + อังกฤษ) ก่อนครับ ได้นักเรียนเพิ่มแค่ 1 คนก็คุ้มแล้ว"
→ สังเกต: สั้น กระชับ ตรง ไม่มี buzzword ไม่มี emoji ตัวเลขใช้ทีเดียว เหมือนคนคุยจริงๆ

=== 🚨 กฎห้ามมั่ว — สำคัญมาก! ===
- ห้ามอ้างข้อมูลเว็บลูกค้าที่ไม่ได้อยู่ใน context! (จำนวน blog, ranking, จำนวนหน้า, speed score)
- ถ้า context ไม่ได้บอก → ห้ามแต่งขึ้นมาเอง
- ใช้เหตุผล industry-level ที่เป็นจริงเสมอ เช่น:
  ✅ "คนค้นหาบริการแบบนี้บน Google เยอะ แต่ถ้าเว็บไม่มีเนื้อหาที่ตอบคำถามเหล่านี้ Google ก็จะจัดอันดับให้คู่แข่งแทน"
  ✅ "ธุรกิจ${bizType}ส่วนใหญ่ยังพึ่ง walk-in หรือ referral เป็นหลัก ช่องทางออนไลน์ยังเปิดกว้างให้คนที่เริ่มก่อน"
  ❌ "เว็บคุณมี blog แค่ 4 โพสต์" (ไม่ได้เช็คจริง ห้ามพูด!)
  ❌ "เว็บคุณโหลด 5 วินาที" (ไม่ได้วัดจริง ห้ามพูด!)
- ถ้ามีข้อมูลจริงจาก context (เช่น Tar โทรคุยแล้วรู้ปัญหา) → ใช้ได้
- ถ้าไม่มี → พูดในมุม industry/opportunity ไม่ใช่ claim เรื่องเว็บลูกค้า

=== ข้อมูลธุรกิจที่ต้อง customize ===
- ชื่อ: ${bizName}
- ประเภท: ${bizType}
- เว็บ: ${webDomain}
${extraContext ? `- บริบทจากที่โทรคุย: ${extraContext}` : ''}

=== สิ่งที่ต้อง generate (6 ส่วน) ===

1. **subject** — หัวข้อ email ต้องมีชื่อ "${bizName}" สื่อว่าตามที่คุยกัน มีแผนให้ ห้าม emoji ห้ามหัวข้อทั่วไป

2. **opening** — 1 paragraph สั้นๆ เปิดเรื่อง อ้างอิงการคุย สรุปว่าจะช่วยอะไร
   ใส่ใน <p style="font-size:15px;margin:0 0 16px;">

3. **problemROI** — 2 paragraphs:
   - ปัญหา/โอกาสของ industry ${bizType} (ใช้ข้อมูลจาก context ถ้ามี ถ้าไม่มีให้พูดในมุม industry opportunity)
   - ห้ามอ้างข้อมูลเว็บลูกค้าที่ไม่ได้อยู่ใน context!
   - ROI คำนวณจาก industry: ลูกค้า/ออเดอร์ 1 คน ≈ ? บาทโดยทั่วไป ได้เพิ่มแค่ X คนก็คุ้ม
   - paragraph แรก: <p style="font-size:15px;margin:0 0 8px;">
   - paragraph ROI: <p style="font-size:14px;color:#666;margin:0 0 24px;">

4. **landingPageDesc** — 2 paragraphs อธิบาย Landing Page CRO ปรับให้เหมาะ ${bizType}
   - ใส่ใน <p style="margin:4px 0;font-size:14px;color:#444;line-height:1.7;">
   - ถ้า Tar เขียนเอง Tar จะพูดแบบไหนกับเจ้าของ ${bizType}

5. **seoAutopilotDesc** — 2 paragraphs อธิบาย SEO Autopilot ปรับ keyword ตัวอย่างให้เหมาะ ${bizType}
   - format เดียวกับข้อ 4
   - ต่อด้วย bridge paragraph: "ระบบนี้ผมใช้กับเว็บของตัวเองอยู่ทุกวัน..." ปรับให้เข้ากับ ${bizName}

6. **recommendation** — 1 paragraph สั้นๆ แนะนำแพ็คไหน เหตุผลจาก target market
   - <p style="font-size:15px;color:#1b1c1b;margin:0 0 8px;">
   - Basic (TH+EN) / Growth (TH+EN+CN) / Full (TH+EN+CN+JP)

=== Checklist ก่อนตอบ ===
- อ่านทุก paragraph แล้วถามตัวเอง: "ถ้า Tar พูดกับลูกค้าตัวต่อตัว Tar จะพูดแบบนี้ไหม?" ถ้าไม่ → เขียนใหม่
- ตัวเลข/social proof ซ้ำจากจุดอื่นไหม? → ปรับให้ไม่ซ้ำ
- มี emoji ไหม? → ลบ
- อ่านแล้วเหมือน AI ไหม? → เขียนใหม่ให้เป็นภาษาคน

ตอบ JSON เท่านั้น:
{
  "subject": "...",
  "opening": "<p style=\\"...\\">...</p>",
  "problemROI": "<p ...>...</p><p ...>...</p>",
  "landingPageDesc": "<p ...>...</p><p ...>...</p>",
  "seoAutopilotDesc": "<p ...>...</p><p ...>...</p><p ...>bridge...</p>",
  "recommendation": "<p ...>...</p>"
}`;

    const aiRes = await claude.chat(
      [{ role: 'user', content: prompt }],
      {
        system: 'คุณคือ ต้าร์ (Tanakit Chaithip) เจ้าของ VisionXBrain เขียน DGP Proposal เหมือนคนจริงที่คุยกับลูกค้าตัวต่อตัว ไม่ใช่ AI ไม่ใช่ copywriter ไม่ใช่ brochure ภาษาเหมือนคนพิมพ์ มั่นใจแต่ไม่ตะโกน ตัวเลขพูดครั้งเดียว ตอบ JSON เท่านั้น',
        max_tokens: 4000,
        skipAutoRecall: true
      }
    );

    const jsonMatch = aiRes.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI failed to generate proposal', raw: aiRes });

    const customParts = JSON.parse(jsonMatch[0]);
    const subject = customParts.subject.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();

    const trackingId = (domain || bizName).replace(/[^a-zA-Z0-9]/g, '') + '_dgp_' + Date.now();
    const htmlPreview = buildDgpTemplate({ ...customParts, bizName, trackingId });

    res.json({ subject, htmlPreview, customParts, trackingId });
  } catch (e) {
    console.error('[DGP-GENERATE] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DGP Send — ส่ง proposal email (standalone, ไม่ผูก lead finder)
app.post('/api/dgp/send', async (req, res) => {
  try {
    const { bizName, email, subject, customParts, htmlBody, industry, domain } = req.body;
    if (!email || !subject) return res.status(400).json({ error: 'email and subject required' });
    if (!bizName) return res.status(400).json({ error: 'bizName required' });

    // Block duplicate sends
    if (isDgpAlreadySent(email, bizName)) {
      return res.status(409).json({ error: `DGP proposal already sent to ${bizName} (${email}) — ห้ามส่งซ้ำ`, alreadySent: true });
    }

    const trackingId = bizName.replace(/[^a-zA-Z0-9]/g, '') + '_dgp_' + Date.now();

    let finalBody;
    if (customParts) {
      finalBody = buildDgpTemplate({ ...customParts, bizName, trackingId });
    } else if (htmlBody) {
      finalBody = htmlBody;
    } else {
      return res.status(400).json({ error: 'customParts or htmlBody required' });
    }

    // Add tracking pixel
    const trackingPixel = `<img src="https://oracle-agent-production-546e.up.railway.app/api/email/track/${trackingId}.png" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" alt="">`;
    const bodyWithTracking = finalBody.replace(/<\/div>\s*$/, trackingPixel + '\n</div>');

    // Attach PDF
    const attachments = [];
    if (leadFinder.pdfBuffer) {
      attachments.push({
        filename: leadFinder.pdfFilename || 'VisionXBrain Portfolio.pdf',
        content: leadFinder.pdfBuffer,
        mimeType: 'application/pdf'
      });
    }

    const result = await gmailClient.send({
      to: email,
      subject,
      body: bodyWithTracking,
      attachments: attachments.length ? attachments : undefined
    });

    console.log(`[DGP-SEND] Sent to ${bizName} (${email}), trackingId: ${trackingId}`);

    // Record to dgp-sent.json (ห้ามส่งซ้ำ)
    const records = loadDgpSent();
    records.push({
      bizName,
      email,
      subject,
      trackingId,
      sentAt: new Date().toISOString(),
      industry: industry || '',
      domain: domain || ''
    });
    saveDgpSent(records);

    // Notify Tar
    try {
      await gateway.notifyOwner(`[DGP Proposal ส่งแล้ว]\n${bizName} → ${email}\nSubject: ${subject}`);
    } catch (notifyErr) {
      console.log('[DGP-SEND] Notify error:', notifyErr.message);
    }

    res.json({
      success: true,
      to: email,
      subject,
      trackingId,
      bizName,
      attachment: attachments.length ? 'VisionXBrain Portfolio.pdf' : 'none'
    });
  } catch (e) {
    console.error('[DGP-SEND] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Email Open Tracking Pixel
app.get('/api/email/track/:trackingId.png', (req, res) => {
  const { trackingId } = req.params;
  console.log(`[EMAIL-TRACK] Open detected: ${trackingId} | ${new Date().toISOString()} | UA: ${req.headers['user-agent'] || '-'} | IP: ${req.ip}`);

  // Update lead data via leadFinder.updateLead
  try {
    const leads = leadFinder.getLeads();
    // Match by: exact trackingId, place_id prefix, or domain prefix
    const lead = leads.find(l =>
      (l.emailTrackingId && l.emailTrackingId === trackingId) ||
      (l.place_id && trackingId.startsWith(l.place_id)) ||
      (l.domain && trackingId.startsWith(l.domain))
    );
    if (lead) {
      const openCount = (lead.emailOpenCount || 0) + 1;
      const id = lead.place_id || lead.domain || lead.email;
      leadFinder.updateLead(id, {
        emailOpened: true,
        emailOpenedAt: lead.emailOpenedAt || new Date().toISOString(),
        emailOpenCount: openCount,
        lastOpenAt: new Date().toISOString()
      });
      console.log(`[EMAIL-TRACK] Updated: ${lead.businessName || lead.domain} (opens: ${openCount})`);
    } else {
      console.log(`[EMAIL-TRACK] No lead found for trackingId: ${trackingId}`);
    }
  } catch (e) {
    console.log('[EMAIL-TRACK] Error:', e.message);
  }

  // Return 1x1 transparent PNG
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(pixel);
});

// Link Click Tracking (แม่น 100% — ต้องคลิกจริง)
app.get('/api/email/click/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const destination = req.query.url || 'https://www.visionxbrain.com';
  console.log(`[EMAIL-CLICK] Click detected: ${trackingId} | dest: ${destination} | ${new Date().toISOString()}`);

  try {
    const leads = leadFinder.getLeads();
    // Match by: exact trackingId, place_id prefix, or domain prefix
    const lead = leads.find(l =>
      (l.emailTrackingId && l.emailTrackingId === trackingId) ||
      (l.place_id && trackingId.startsWith(l.place_id)) ||
      (l.domain && trackingId.startsWith(l.domain))
    );
    if (lead) {
      const clickCount = (lead.emailClickCount || 0) + 1;
      const id = lead.place_id || lead.domain || lead.email;
      leadFinder.updateLead(id, {
        emailClicked: true,
        emailClickedAt: lead.emailClickedAt || new Date().toISOString(),
        emailClickCount: clickCount,
        lastClickAt: new Date().toISOString()
      });
      console.log(`[EMAIL-CLICK] Updated: ${lead.businessName || lead.domain} (clicks: ${clickCount})`);
    } else {
      console.log(`[EMAIL-CLICK] No lead found for trackingId: ${trackingId}`);
    }
  } catch (e) {
    console.log('[EMAIL-CLICK] Error:', e.message);
  }

  res.redirect(302, destination);
});

// Email stats (pixel open + link click)
app.get('/api/email/stats', async (req, res) => {
  try {
    const leads = leadFinder.getLeads();
    const emailed = leads.filter(l => l.emailSentAt || l.status === 'emailed');
    const pixelOpened = leads.filter(l => l.emailOpened);
    const clicked = leads.filter(l => l.emailClicked);
    res.json({
      totalEmailed: emailed.length,
      pixelOpens: pixelOpened.length,
      pixelOpenNote: 'Gmail pre-fetch ทำให้ไม่แม่น — ดู clicks แทน',
      totalClicked: clicked.length,
      clickRate: emailed.length ? Math.round((clicked.length / emailed.length) * 100) + '%' : '0%',
      leads: emailed.map(l => ({
        name: l.businessName || l.businessNameEn || l.domain,
        domain: l.domain,
        status: l.status,
        sentAt: l.emailSentAt,
        pixelOpen: l.emailOpened || false,
        clicked: l.emailClicked || false,
        clickCount: l.emailClickCount || 0,
        firstClick: l.emailClickedAt || null,
        lastClick: l.lastClickAt || null
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reset leads data (for development)
app.post('/api/leads/reset', async (req, res) => {
  try {
    const { writeFileSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const leadsFile = join(dir, 'data', 'leads.json');
    writeFileSync(leadsFile, JSON.stringify({ leads: [], processedDomains: [], lastRun: null }, null, 2));
    res.json({ success: true, message: 'Leads data reset' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/leads/add-domain', (req, res) => {
  const { domain, industry } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  leadFinder.addManualDomain(domain, industry);
  res.json({ success: true, domain, industry });
});

// Sync historical outreach emails from Gmail SENT folder → leads.json
app.post('/api/email/sync-history', async (req, res) => {
  try {
    if (!gmailClient.isConfigured()) {
      return res.status(500).json({ error: 'Gmail not configured' });
    }

    // Search Gmail SENT — outreach-specific query (exclude invoices/internal)
    const maxResults = req.body?.maxResults || 50;
    const sentEmails = await gmailClient.search('from:me in:sent (subject:คำแนะนำ OR subject:ผลตรวจเว็บ OR subject:เพิ่มลูกค้า OR subject:ดึงดูดลูกค้า) -subject:วางบิล -subject:ใบเสนอราคา -subject:ชำระ -subject:invoice -subject:งวด', maxResults);

    if (!sentEmails.length) {
      return res.json({ synced: 0, message: 'No outreach emails found in Gmail SENT' });
    }

    // Load current leads
    const { readFileSync, writeFileSync } = await import('fs');
    const leadsFile = join(__dirname, 'data', 'leads.json');
    let leadsData;
    try {
      leadsData = JSON.parse(readFileSync(leadsFile, 'utf-8'));
    } catch {
      leadsData = { leads: [], processedDomains: [], lastRun: null };
    }

    // Use email address as unique key (not domain — multiple leads can share gmail.com)
    const existingEmails = new Set(leadsData.leads.map(l => l.email || l.emailSentTo).filter(Boolean));
    let synced = 0;
    const syncedLeads = [];
    const skipped = [];

    for (const email of sentEmails) {
      const to = email.to || '';
      const subject = email.subject || '';
      const date = email.date || '';

      // Extract email address from "To" field
      const emailMatch = to.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (!emailMatch) {
        skipped.push({ to, subject, reason: 'no email found in To' });
        continue;
      }
      const toEmail = emailMatch[0];

      // Skip own email / oracle / internal team / test emails
      const internalEmails = ['visionxbrain', 'casperstack', 'oracle', 'natiya.nami', 'sukanya18.piya', 'miw.angvara', '15623.smnr'];
      if (internalEmails.some(e => toEmail.includes(e))) {
        skipped.push({ to: toEmail, subject, reason: 'internal/test email' });
        continue;
      }

      // Skip invoices, payments, quotes that slipped through
      const invoiceKeywords = ['วางบิล', 'ใบเสนอราคา', 'ชำระ', 'invoice', 'งวดที่', 'payment', 'receipt'];
      if (invoiceKeywords.some(kw => subject.includes(kw))) {
        skipped.push({ to: toEmail, subject, reason: 'invoice/payment email' });
        continue;
      }

      // Skip if this exact email already exists
      if (existingEmails.has(toEmail)) {
        // But still update existing lead if it has no sentAt
        const existing = leadsData.leads.find(l => (l.email === toEmail || l.emailSentTo === toEmail));
        if (existing && !existing.emailSentAt) {
          existing.status = 'emailed';
          existing.emailSentAt = new Date(date).toISOString();
          existing.emailSentTo = toEmail;
          synced++;
          syncedLeads.push({ email: toEmail, action: 'updated' });
        } else {
          skipped.push({ to: toEmail, subject, reason: 'already exists' });
        }
        continue;
      }

      const toDomain = toEmail.split('@').pop();

      // Extract business name from subject — รองรับทุก template ที่ใช้
      let bizName = '';
      const patterns = [
        // Current templates (2026-02-08+)
        /เพิ่มลูกค้า(?:ให้|ที่)\s*(.+?)\s*(?:ด้วย|—|–|\-|$)/,
        /เคล็ดลับ(?:เพิ่มลูกค้า)?(?:ที่|สำหรับ)\s*(.+?)\s*(?:ด้วย|ควร|—|–|\-|$)/,
        /(?:เพื่อ)?ขยายธุรกิจ\s*(.+?)\s*(?:ด้วย|—|–|\-|$)/,
        /ดึงดูดลูกค้า(?:ให้|ที่)\s*(.+?)\s*(?:ด้วย|—|–|\-|$)/,
        // Legacy templates
        /เว็บไซต์\s*(.+?)\s*(?:—|–|\-:|มี|$)/,
        /คำแนะนำ(?:สำหรับ)?\s*(.+?)(?:\s*[—–\-:|]|$)/,
        /(.+?)\s*(?:—|–|\-)\s*(?:VisionXBrain|วิเคราะห์|report|เว็บไซต์|มี\s*\d)/i,
      ];
      for (const pat of patterns) {
        const m = subject.match(pat);
        if (m) { bizName = m[1].trim(); break; }
      }
      // Last resort: ดึงแค่ส่วนแรกก่อน — หรือ — (จำกัด 50 ตัวอักษร)
      if (!bizName) {
        const firstPart = subject.split(/[—–|]/)[0].trim();
        bizName = firstPart.length > 50 ? firstPart.substring(0, 50) : (firstPart || toDomain);
      }

      // Create new lead entry from Gmail history
      const isFreeEmail = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'live.com'].includes(toDomain);
      const newLead = {
        domain: isFreeEmail ? null : toDomain,
        url: isFreeEmail ? '' : `https://${toDomain}`,
        industry: '',
        businessName: bizName,
        businessNameEn: '',
        emails: [toEmail],
        email: toEmail,
        phones: [],
        lineId: null,
        facebook: null,
        address: '',
        googleMapsLink: null,
        websiteScore: 0,
        websiteIssues: [],
        isGoodTarget: true,
        reason: 'synced from Gmail SENT',
        status: 'emailed',
        foundAt: new Date(date).toISOString(),
        emailSentAt: new Date(date).toISOString(),
        emailSentTo: toEmail,
        threadId: email.threadId || null,
        followUps: 0,
        gmailMessageId: email.id
      };

      leadsData.leads.push(newLead);
      existingEmails.add(toEmail);
      synced++;
      syncedLeads.push({ domain: newLead.domain, bizName, email: toEmail, action: 'created' });
    }

    // Save
    writeFileSync(leadsFile, JSON.stringify(leadsData, null, 2));

    res.json({
      synced,
      total: leadsData.leads.length,
      gmailFound: sentEmails.length,
      details: syncedLeads,
      skipped
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Clean junk leads (internal/test/invoice emails)
app.post('/api/leads/clean', async (req, res) => {
  try {
    const { readFileSync, writeFileSync } = await import('fs');
    const leadsFile = join(__dirname, 'data', 'leads.json');
    const ld = JSON.parse(readFileSync(leadsFile, 'utf-8'));
    const before = ld.leads.length;

    const internalList = ['visionxbrain','casperstack','oracle','natiya.nami','sukanya18.piya','miw.angvara','15623.smnr'];
    const invoiceKw = ['วางบิล','ใบเสนอราคา','ชำระ','invoice','งวดที่','payment','receipt'];

    const removed = [];
    ld.leads = ld.leads.filter(l => {
      const em = l.email || l.emailSentTo || '';
      const biz = l.businessName || '';
      // Remove internal/test
      if (internalList.some(e => em.includes(e))) { removed.push({ email: em, reason: 'internal/test' }); return false; }
      // Remove invoices (by businessName)
      if (invoiceKw.some(kw => biz.includes(kw))) { removed.push({ email: em, biz, reason: 'invoice/payment' }); return false; }
      // Remove duplicates with no email
      if (!em && l.status === 'new') {
        const hasDupe = ld.leads.some(o => o !== l && o.domain === l.domain && (o.email || o.emailSentTo));
        if (hasDupe) { removed.push({ domain: l.domain, reason: 'duplicate without email' }); return false; }
      }
      return true;
    });

    writeFileSync(leadsFile, JSON.stringify(ld, null, 2));
    res.json({ before, after: ld.leads.length, removed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// API COSTS — ค่าบริการ API ประจำเดือน
// =============================================================================

app.get('/api/costs', (req, res) => {
  try {
    const stats = leadFinder.getStats();
    const totalLeads = stats.total || 0;
    const emailed = stats.emailed || 0;
    const processedDomains = stats.processedDomains || 0;
    const leadsWithAnalysis = totalLeads; // ทุก lead ใช้ AI analyze

    // --- RapidAPI ---
    // Local Rank Tracker: ~1 call per search query
    const searchesEstimate = processedDomains; // rough: 1 place = came from 1 search
    // Local Business Data: 1 call per lead enriched
    const businessDetailsUsed = processedDomains;

    // --- AI Costs ---
    // Analysis: $0 — ใช้ regex + heuristic แทน AI 100%
    // Email gen: Haiku 4.5 — Input $0.80/MTok, Output $4/MTok
    //   ~3500 input + ~1750 output = ~$0.010/call
    // Follow-up: Haiku 4.5 — ~$0.003/call (สั้นกว่า)
    const COST_PER_ANALYSIS = 0; // NO AI — pure local
    const COST_PER_EMAIL = 0.010; // Haiku 4.5
    const USD_TO_THB = 34;

    const aiAnalysisCalls = leadsWithAnalysis;
    const aiEmailCalls = emailed;
    const anthropicAnalysisCost = aiAnalysisCalls * COST_PER_ANALYSIS;
    const anthropicEmailCost = aiEmailCalls * COST_PER_EMAIL;
    const anthropicTotal = anthropicAnalysisCost + anthropicEmailCost;

    // --- Monthly projections (based on settings) ---
    const daysInMonth = 30;
    const runsPerDay = 2;
    const searchesPerRun = 25;
    const leadsPerSearch = 10; // avg
    const emailsPerDay = 20;

    const projectedSearches = runsPerDay * searchesPerRun * daysInMonth;
    const projectedBusinessDetails = runsPerDay * searchesPerRun * leadsPerSearch * daysInMonth * 0.5; // 50% unique
    const projectedEmails = emailsPerDay * daysInMonth;
    const projectedAiAnalysis = 0; // NO AI for analysis — pure regex + heuristic
    const projectedAiEmail = projectedEmails;

    const projAnthropic = projectedAiAnalysis * COST_PER_ANALYSIS + projectedAiEmail * COST_PER_EMAIL;
    const projTotal = 25 + projAnthropic + 7;

    res.json({
      currentUsage: {
        rapidapi: {
          searchCalls: searchesEstimate,
          businessDetailCalls: businessDetailsUsed,
          businessDetailLimit: 20000,
          businessDetailUsedPercent: Math.round((businessDetailsUsed / 20000) * 100),
          planCostUsd: 25.00,
          planCostThb: 25 * USD_TO_THB,
          overageCostPer: 0.005,
          overageCost: Math.max(0, (businessDetailsUsed - 20000) * 0.005),
        },
        anthropic: {
          analysisModel: 'none (local regex)',
          emailModel: 'claude-haiku-4.5',
          pricingNote: 'Analysis: $0 (local) | Email: Haiku 4.5 ($0.80/$4 MTok)',
          analysisCalls: aiAnalysisCalls,
          emailCalls: aiEmailCalls,
          estimatedCostUsd: Math.round(anthropicTotal * 100) / 100,
          estimatedCostThb: Math.round(anthropicTotal * USD_TO_THB),
          costPerAnalysis: COST_PER_ANALYSIS,
          costPerEmail: COST_PER_EMAIL,
        },
        gmail: {
          emailsSent: emailed,
          costUsd: 0,
          costThb: 0,
          note: 'Free (Google OAuth)',
        },
        railway: {
          estimatedMonthlyCostUsd: 7.00,
          estimatedMonthlyCostThb: 7 * USD_TO_THB,
          note: 'Usage-based ~$5-10/mo',
        },
        totalUsd: Math.round((25 + anthropicTotal + 7) * 100) / 100,
        totalThb: Math.round((25 + anthropicTotal + 7) * USD_TO_THB),
      },
      monthlyProjection: {
        rapidapi: {
          searches: projectedSearches,
          businessDetails: Math.round(projectedBusinessDetails),
          costUsd: 25.00,
          costThb: 25 * USD_TO_THB,
          overageCost: Math.max(0, Math.round((projectedBusinessDetails - 20000) * 0.005 * 100) / 100),
        },
        anthropic: {
          analysisCalls: Math.round(projectedAiAnalysis),
          emailCalls: projectedEmails,
          estimatedCostUsd: Math.round(projAnthropic * 100) / 100,
          estimatedCostThb: Math.round(projAnthropic * USD_TO_THB),
        },
        railway: { costUsd: 7.00, costThb: 7 * USD_TO_THB },
        gmail: { costUsd: 0, costThb: 0 },
        totalEstimatedUsd: Math.round(projTotal * 100) / 100,
        totalEstimatedThb: Math.round(projTotal * USD_TO_THB),
      },
      leads: {
        total: totalLeads,
        emailed: emailed,
        goodTargets: stats.goodTargets || 0,
        processedDomains: processedDomains,
      },
      usdToThb: USD_TO_THB,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Costs Dashboard SPA fallback
app.get('/costs/*', (req, res) => {
  res.sendFile(join(__dirname, 'public/costs/index.html'));
});

// Email Dashboard SPA fallback
app.get('/vision/email/*', (req, res) => {
  res.sendFile(join(__dirname, 'public/vision/email/index.html'));
});

// Analytics Dashboard SPA fallback
app.get('/vision/analytics/*', (req, res) => {
  res.sendFile(join(__dirname, 'public/vision/analytics/index.html'));
});

// Growth Strategy Dashboard SPA fallback
app.get('/vision/growthstrategy/*', (req, res) => {
  res.sendFile(join(__dirname, 'public/vision/growthstrategy/index.html'));
});

// =============================================================================
// 404 CHECK DASHBOARD API
// =============================================================================

// Start GSC scan (async)
app.post('/api/404check/scan', async (req, res) => {
  try {
    const siteUrl = req.body?.siteUrl || 'sc-domain:visionxbrain.com';
    // Run async — don't await
    checker404.scanGSC(siteUrl).catch(err => console.error('[404check] Scan error:', err.message));
    res.json({ ok: true, message: 'Scan started', status: checker404.getJobStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check scan status
app.get('/api/404check/status', (req, res) => {
  res.json(checker404.getJobStatus());
});

// Get cached results
app.get('/api/404check/results', (req, res) => {
  const data = checker404.loadResults();
  if (!data) return res.json({ empty: true });
  res.json(data);
});

// Run auto-match redirects
app.post('/api/404check/match', async (req, res) => {
  try {
    const result = await checker404.matchRedirects();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update single redirect
app.put('/api/404check/redirect/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const { target } = req.body;
  if (isNaN(index) || !target) return res.status(400).json({ error: 'Missing index or target' });

  const updated = checker404.updateRedirect(index, target);
  if (!updated) return res.status(404).json({ error: 'Redirect not found' });
  res.json(updated);
});

// Validate all targets
app.post('/api/404check/validate', async (req, res) => {
  try {
    const result = await checker404.validateTargets();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download CSV
app.get('/api/404check/csv', (req, res) => {
  const csv = checker404.generateCSV();
  if (!csv) return res.status(404).json({ error: 'No redirect data' });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=redirects-404.csv');
  res.send(csv);
});

// 404 Check Dashboard SPA fallback
app.get('/vision/404check/*', (req, res) => {
  res.sendFile(join(__dirname, 'public/vision/404check/index.html'));
});

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

  // Validate service page URLs against live sitemap (prevent 404 in outreach emails)
  await validateServicePageUrls();
  await leadFinder.validateServicePageUrls();

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

  // Initialize Unified Memory System (Phase 9: Practical AGI)
  try {
    await initUnifiedMemory();
    console.log('[UNIFIED-MEMORY] System initialized');
  } catch (error) {
    console.log('[UNIFIED-MEMORY] Running without PostgreSQL:', error.message);
  }

  // Initialize Local Agent WebSocket Server (Phase 6: Remote Execution)
  localAgentServer.initialize(server);
  localAgentServer.setNotifyCallback(async (message) => {
    await gateway.notifyOwner(message);
  });
  registerCleanup('local-agent', () => localAgentServer.shutdown(), { phase: 'cleanup', priority: 5 });
  console.log('[LOCAL-AGENT-SERVER] WebSocket server initialized');

  // Setup Claude failover notification callback
  claude.setNotifyCallback(async (message) => {
    console.log('[CLAUDE-FAILOVER] Sending notification...');
    await gateway.notifyOwner(message);
  });
  console.log('[CLAUDE] Failover notification callback configured');

  // Initialize Heartbeat System (Phase 4)
  if (config.heartbeat?.enabled) {
    heartbeatManager = new HeartbeatManager(config.heartbeat);

    // Set notification callback to hotel team (owner + subscribers)
    heartbeatManager.setNotifyCallback(async (message) => {
      console.log('[HEARTBEAT] Sending alert to hotel team...');
      await gateway.notifyHotelTeam(message);
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

    // Set announce callback to all channels
    subAgentManager.setAnnounceCallback(async (message) => {
      console.log('[SUBAGENT] Announcing result...');
      await gateway.notifyOwner(message);
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

  // Initialize Lead Reply Handler — Gmail watch for real-time reply detection
  setTimeout(async () => {
    try {
      await leadReplyHandler.setupWatch();
      console.log('[LEAD-REPLY] Watch setup complete');
    } catch (err) {
      console.error('[LEAD-REPLY] Watch setup failed:', err.message);
    }
  }, 10000);

  // Renew Gmail watch every 6 days (expires after 7 days)
  cron.schedule('0 3 */6 * *', async () => {
    console.log('[LEAD-REPLY] Renewing Gmail watch...');
    try {
      await leadReplyHandler.setupWatch();
      console.log('[LEAD-REPLY] Watch renewed');
    } catch (err) {
      console.error('[LEAD-REPLY] Watch renewal failed:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });

  // =========================================================================
  // PHASE 5.5: REMINDER SYSTEM - Set notification callback
  // =========================================================================
  reminderSystem.setNotifyCallback(async (reminder) => {
    console.log(`[REMINDER] Sending notification: ${reminder.message}`);

    const message = `🔔 Reminder\n\n${reminder.message}\n\n⏰ ${reminder.timeFormatted}`;

    // Send via all configured channels
    await gateway.notifyOwner(message);

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
        await gateway.notifyHotelTeam(`📬 Morning Briefing\n\n${digest.output}`, 'digest');
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
        await gateway.notifyHotelTeam(`📊 Evening Summary\n\n${digest.output}`, 'digest');
        logSystemEvent('digest', 'evening_sent', { id: digest.id });
      }
    } catch (err) {
      console.error('[DIGEST] Evening summary failed:', err.message);
    }
  }, { timezone: config.agent?.timezone || 'Asia/Bangkok' });

  console.log('[DIGEST] Daily Digest scheduled (7:00 morning, 18:00 evening)');

  // =========================================================================
  // AUTO-SYNC: Recover leads from Gmail SENT on startup (survives deploys)
  // =========================================================================
  setTimeout(async () => {
    try {
      const leadsData = leadFinder.getLeads();
      const emailedCount = leadsData.filter(l => l.status === 'emailed').length;
      if (emailedCount < 5 && gmailClient.isConfigured()) {
        console.log(`[AUTO-SYNC] Only ${emailedCount} emailed leads found — syncing from Gmail SENT...`);
        const sentEmails = await gmailClient.search('from:me in:sent (subject:คำแนะนำ OR subject:ผลตรวจเว็บ OR subject:เพิ่มลูกค้า OR subject:ดึงดูดลูกค้า) -subject:วางบิล -subject:ใบเสนอราคา -subject:ชำระ -subject:invoice -subject:งวด', 50);
        if (sentEmails.length) {
          const { readFileSync, writeFileSync } = await import('fs');
          const leadsFile = join(__dirname, 'data', 'leads.json');
          let ld;
          try { ld = JSON.parse(readFileSync(leadsFile, 'utf-8')); } catch { ld = { leads: [], processedDomains: [], lastRun: null }; }
          const existingEmails = new Set(ld.leads.map(l => l.email || l.emailSentTo).filter(Boolean));
          let synced = 0;
          for (const email of sentEmails) {
            const to = email.to || '';
            const subject = email.subject || '';
            const date = email.date || '';
            const emailMatch = to.match(/[\w.+-]+@[\w.-]+\.\w+/);
            if (!emailMatch) continue;
            const toEmail = emailMatch[0];
            const internalList = ['visionxbrain','casperstack','oracle','natiya.nami','sukanya18.piya','miw.angvara','15623.smnr'];
            if (internalList.some(e => toEmail.includes(e))) continue;
            const invoiceKw = ['วางบิล','ใบเสนอราคา','ชำระ','invoice','งวดที่','payment','receipt'];
            if (invoiceKw.some(kw => subject.includes(kw))) continue;
            if (existingEmails.has(toEmail)) continue;
            const toDomain = toEmail.split('@').pop();
            let bizName = '';
            const patterns = [
              /เพิ่มลูกค้า(?:ให้|ที่)\s*(.+?)\s*(?:ด้วย|—|–|\-|$)/,
              /เคล็ดลับ(?:เพิ่มลูกค้า)?(?:ที่|สำหรับ)\s*(.+?)\s*(?:ด้วย|ควร|—|–|\-|$)/,
              /(?:เพื่อ)?ขยายธุรกิจ\s*(.+?)\s*(?:ด้วย|—|–|\-|$)/,
              /ดึงดูดลูกค้า(?:ให้|ที่)\s*(.+?)\s*(?:ด้วย|—|–|\-|$)/,
              /เว็บไซต์\s*(.+?)\s*(?:—|–|\-:|มี|$)/,
              /คำแนะนำ(?:สำหรับ)?\s*(.+?)(?:\s*[—–\-:|]|$)/,
              /(.+?)\s*(?:—|–|\-)\s*(?:VisionXBrain|วิเคราะห์|report)/i,
            ];
            for (const pat of patterns) { const m = subject.match(pat); if (m) { bizName = m[1].trim(); break; } }
            if (!bizName) { const fp = subject.split(/[—–|]/)[0].trim(); bizName = fp.length > 50 ? fp.substring(0,50) : (fp || toDomain); }
            const isFreeMail = ['gmail.com','hotmail.com','yahoo.com','icloud.com','outlook.com','live.com'].includes(toDomain);
            ld.leads.push({
              domain: isFreeMail ? null : toDomain,
              url: isFreeMail ? '' : `https://${toDomain}`,
              industry: '', businessName: bizName, businessNameEn: '', emails: [toEmail], email: toEmail,
              phones: [], lineId: null, facebook: null, address: '', googleMapsLink: null,
              websiteScore: 0, websiteIssues: [], isGoodTarget: true, reason: 'synced from Gmail SENT',
              status: 'emailed', foundAt: new Date(date).toISOString(), emailSentAt: new Date(date).toISOString(),
              emailSentTo: toEmail, threadId: email.threadId || null, followUps: 0, gmailMessageId: email.id
            });
            existingEmails.add(toEmail);
            synced++;
          }
          if (synced > 0) {
            writeFileSync(leadsFile, JSON.stringify(ld, null, 2));
            console.log(`[AUTO-SYNC] Recovered ${synced} leads from Gmail SENT (total: ${ld.leads.length})`);
          } else {
            console.log('[AUTO-SYNC] No new leads to sync');
          }

          // 🛡️ REPLY SYNC: เช็ค replies จาก leads ที่ sync มา — ป้องกัน follow-up คนที่ declined
          const emailedLeads = ld.leads.filter(l => l.status === 'emailed' && l.email);
          let replyFixed = 0;
          const genericDomains = ['gmail.com','hotmail.com','yahoo.com','outlook.com','live.com','icloud.com'];
          for (const lead of emailedLeads.slice(0, 30)) { // max 30 เพื่อไม่ให้ช้า
            try {
              const emailDomain = lead.email.split('@')[1];
              const searchEmail = (emailDomain && !genericDomains.includes(emailDomain))
                ? `@${emailDomain}`
                : lead.email;
              const replyResults = await gmailClient.search(`from:${searchEmail} newer_than:30d`, 1);
              if (replyResults && replyResults.length > 0) {
                // มี reply → ดึง snippet มาดู
                try {
                  const replyMsg = await gmailClient.getMessage(replyResults[0].id);
                  const snippet = replyMsg?.snippet || '';
                  const declineKeywords = ['ไม่สนใจ','ไม่ต้อง','ขอบคุณค่ะ แต่','ขอบคุณครับ แต่','ยกเลิก','ไม่รับ','ปฏิเสธ','ไม่ประสงค์','not interested','unsubscribe','remove','not to proceed','decided not to','decline','no thank','not at this time','ไม่สะดวก','ไม่ต้องการ'];
                  const isDeclined = declineKeywords.some(kw => snippet.toLowerCase().includes(kw));
                  lead.status = isDeclined ? 'closed' : 'replied';
                  lead.repliedAt = new Date().toISOString();
                  lead.replySnippet = snippet.substring(0, 200);
                  if (isDeclined) lead.closedReason = 'declined_detected_on_sync';
                  replyFixed++;
                  console.log(`[AUTO-SYNC] ${lead.businessName || lead.email} → ${lead.status} (${isDeclined ? 'declined' : 'has reply'})`);
                } catch (msgErr) {
                  lead.status = 'replied';
                  replyFixed++;
                }
              }
            } catch (replyErr) {
              // ignore individual errors
            }
          }
          if (replyFixed > 0) {
            writeFileSync(leadsFile, JSON.stringify(ld, null, 2));
            console.log(`[AUTO-SYNC] 🛡️ Fixed ${replyFixed} lead statuses from Gmail replies`);
          }
        }
      } else {
        console.log(`[AUTO-SYNC] ${emailedCount} emailed leads OK — skip sync`);

        // 🛡️ Even with enough leads, still check replies for status accuracy
        try {
          const { readFileSync: rfs, writeFileSync: wfs } = await import('fs');
          const lFile = join(__dirname, 'data', 'leads.json');
          let lData;
          try { lData = JSON.parse(rfs(lFile, 'utf-8')); } catch { lData = null; }
          if (lData && lData.leads) {
            const emailedOnly = lData.leads.filter(l => l.status === 'emailed' && l.email && !l.replyClassification);
            const genericDs = ['gmail.com','hotmail.com','yahoo.com','outlook.com','live.com','icloud.com'];
            let fixed = 0;
            for (const lead of emailedOnly.slice(0, 20)) {
              try {
                const eDomain = lead.email.split('@')[1];
                const sEmail = (eDomain && !genericDs.includes(eDomain)) ? `@${eDomain}` : lead.email;
                const rr = await gmailClient.search(`from:${sEmail} newer_than:30d`, 1);
                if (rr && rr.length > 0) {
                  lead.status = 'replied';
                  lead.repliedAt = new Date().toISOString();
                  fixed++;
                }
              } catch {}
            }
            if (fixed > 0) {
              wfs(lFile, JSON.stringify(lData, null, 2));
              console.log(`[AUTO-SYNC] 🛡️ Fixed ${fixed} lead reply statuses`);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error('[AUTO-SYNC] Failed:', e.message);
    }
  }, 10000); // Wait 10s after startup to avoid rate limits

  // =========================================================================
  // PHASE 5.5: MEMORY CONSOLIDATION - Schedule daily consolidation
  // =========================================================================
  // Consolidate memories at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[MEMORY] Running daily consolidation...');
    try {
      const result = await memoryConsolidation.runConsolidation('tars', false);
      logSystemEvent('memory', 'consolidation', result);
      console.log(`[MEMORY] Consolidation complete:`, result);
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
  console.log('║  Lead Reply Handler (Real-time):                           ║');
  console.log('║  - GET  /api/lead-reply/status   Watch status              ║');
  console.log('║  - POST /api/lead-reply/test     Test with messageId       ║');
  console.log('║  - POST /api/lead-reply/setup-watch  Force re-watch        ║');
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
