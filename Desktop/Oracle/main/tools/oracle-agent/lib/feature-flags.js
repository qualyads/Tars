/**
 * Feature Flags System v1.1
 * เปิด/ปิด feature ได้จาก API โดยไม่ต้องแก้โค้ด
 * Persist ลง JSON file — survive restart
 *
 * Created: 2026-02-20 by Tar
 * v1.1: ค่าใช้จ่ายแสดงเป็นบาท (THB)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAGS_FILE = path.join(__dirname, '../data/feature-flags.json');

// Default feature definitions (cost in THB/day, rate ~34 THB/USD)
const FEATURE_DEFAULTS = {
  heartbeat: {
    enabled: true,
    name: 'Heartbeat',
    description: 'AI ตื่นทุก 30 นาที เช็ค hotel/goals',
    model: 'haiku',
    costPerDay: 1,
    schedule: 'ทุก 30 นาที (8:00-22:00)',
    category: 'core'
  },
  morningBriefing: {
    enabled: false,
    name: 'สรุปเช้า',
    description: 'สรุปข้อมูลตอนเช้า 07:00',
    model: 'sonnet',
    costPerDay: 1.7,
    schedule: '07:00 ทุกวัน',
    category: 'core'
  },
  eveningSummary: {
    enabled: false,
    name: 'สรุปเย็น',
    description: 'สรุปวันตอนเย็น 18:00',
    model: 'sonnet',
    costPerDay: 1.7,
    schedule: '18:00 ทุกวัน',
    category: 'core'
  },
  hotelDailySummary: {
    enabled: true,
    name: 'สรุปโรงแรมรายวัน',
    description: 'สรุป check-in/check-out ประจำวัน',
    model: 'ไม่ใช้ AI',
    costPerDay: 0,
    schedule: '08:00 ทุกวัน',
    category: 'hotel'
  },
  checkoutReminder: {
    enabled: true,
    name: 'แจ้งเตือน Check-out',
    description: 'แจ้งเตือน check-out วันนี้',
    model: 'ไม่ใช้ AI',
    costPerDay: 0,
    schedule: '09:00 ทุกวัน',
    category: 'hotel'
  },
  autonomousIdeas: {
    enabled: false,
    name: 'คิด Idea อัตโนมัติ',
    description: 'AI คิด idea ธุรกิจทุก 6 ชม.',
    model: 'sonnet',
    costPerDay: 20,
    schedule: 'ทุก 6 ชม.',
    category: 'experimental'
  },
  apiHunter: {
    enabled: false,
    name: 'API Hunter',
    description: 'หา API ใหม่ วิเคราะห์โอกาส ทุก 2 ชม.',
    model: 'sonnet',
    costPerDay: 12,
    schedule: 'ทุก 2 ชม. (9:00-21:00)',
    category: 'experimental'
  },
  selfReflection: {
    enabled: false,
    name: 'ทบทวนตัวเอง',
    description: 'Oracle ทบทวนตัวเอง 23:45',
    model: 'sonnet',
    costPerDay: 1.7,
    schedule: '23:45 ทุกวัน',
    category: 'experimental'
  },
  lineSummarizer: {
    enabled: false,
    name: 'สรุป LINE',
    description: 'สรุป LINE session ทุกคืน 23:00',
    model: 'sonnet',
    costPerDay: 1.7,
    schedule: '23:00 ทุกวัน',
    category: 'core'
  },
  terminalSummarizer: {
    enabled: false,
    name: 'สรุป Terminal',
    description: 'สรุป terminal session ทุกคืน 23:30',
    model: 'sonnet',
    costPerDay: 1.7,
    schedule: '23:30 ทุกวัน',
    category: 'core'
  },
  leadFinder: {
    enabled: true,
    name: 'หา Lead',
    description: 'หา lead + ส่ง email อัตโนมัติ 2 รอบ/วัน',
    model: 'sonnet',
    costPerDay: 34,
    schedule: '10:00 + 15:00 ทุกวัน',
    category: 'sales'
  },
  leadReplyCheck: {
    enabled: true,
    name: 'เช็ค Reply',
    description: 'เช็ค reply จาก lead ทุก 3 ชม.',
    model: 'sonnet',
    costPerDay: 3.4,
    schedule: '9,12,15,18 ทุกวัน',
    category: 'sales'
  },
  hourlyRevenue: {
    enabled: true,
    name: 'รายงานรายได้',
    description: 'รายงานรายได้ทุกชั่วโมง',
    model: 'ไม่ใช้ AI',
    costPerDay: 0,
    schedule: 'ทุกชม. (8:00-21:00)',
    category: 'hotel'
  },
  forbesWeekly: {
    enabled: false,
    name: 'สรุป Forbes',
    description: 'สรุปข่าว Forbes ทุกจันทร์',
    model: 'sonnet',
    costPerDay: 0.24,
    schedule: 'จันทร์ 09:00',
    category: 'weekly'
  },
  hospitalityTrends: {
    enabled: false,
    name: 'เทรนด์โรงแรม',
    description: 'เทรนด์โรงแรม/ท่องเที่ยว ทุกจันทร์',
    model: 'sonnet',
    costPerDay: 0.24,
    schedule: 'จันทร์ 09:30',
    category: 'weekly'
  },
  weeklyRevenue: {
    enabled: false,
    name: 'สรุปรายได้รายสัปดาห์',
    description: 'สรุปยอด Beds24 ทุกจันทร์',
    model: 'sonnet',
    costPerDay: 0.24,
    schedule: 'จันทร์ 10:00',
    category: 'weekly'
  },
  seoWeeklyReport: {
    enabled: false,
    name: 'รายงาน SEO',
    description: 'รายงาน SEO ประจำสัปดาห์',
    model: 'sonnet',
    costPerDay: 0.24,
    schedule: 'จันทร์ 10:30',
    category: 'weekly'
  },
  seoKeywordAlert: {
    enabled: false,
    name: 'แจ้งเตือน Keyword',
    description: 'แจ้งเตือน keyword ร่วง/ขึ้น',
    model: 'sonnet',
    costPerDay: 1.7,
    schedule: '08:00 ทุกวัน',
    category: 'seo'
  },
  backlinkSyndication: {
    enabled: false,
    name: 'Backlink Syndication',
    description: 'แปลบทความไทย→EN แล้วลง Dev.to/Medium (dofollow backlink)',
    model: 'haiku',
    costPerDay: 0.5,
    schedule: 'จันทร์+พฤหัสบดี 11:00',
    category: 'seo'
  },
  backlinkOutreach: {
    enabled: false,
    name: 'Backlink Outreach',
    description: 'หา roundup articles → pitch ใส่ VXB tool',
    model: 'haiku',
    costPerDay: 0.3,
    schedule: 'อังคาร+ศุกร์ 14:00',
    category: 'seo'
  },
  backlinkBrokenLink: {
    enabled: false,
    name: 'Broken Link Builder',
    description: 'หาหน้าที่มี 404 links → เสนอ VXB แทน',
    model: 'ไม่ใช้ AI',
    costPerDay: 0,
    schedule: 'พุธ 14:00',
    category: 'seo'
  },
  backlinkMonitor: {
    enabled: false,
    name: 'Backlink Monitor',
    description: 'ติดตาม backlinks + SEO health รายสัปดาห์',
    model: 'ไม่ใช้ AI',
    costPerDay: 0,
    schedule: 'อาทิตย์ 10:00',
    category: 'seo'
  }
};

// In-memory state
let flags = {};

/**
 * Load flags from file, merge with defaults
 */
function load() {
  try {
    if (fs.existsSync(FLAGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(FLAGS_FILE, 'utf-8'));
      // Merge: saved overrides defaults (only 'enabled' field)
      flags = {};
      for (const [key, def] of Object.entries(FEATURE_DEFAULTS)) {
        flags[key] = { ...def };
        if (saved[key] !== undefined) {
          flags[key].enabled = typeof saved[key] === 'boolean' ? saved[key] : saved[key].enabled;
        }
      }
      console.log('[FEATURES] Loaded from file:', Object.entries(flags).filter(([,v]) => v.enabled).map(([k]) => k).join(', '));
    } else {
      flags = JSON.parse(JSON.stringify(FEATURE_DEFAULTS));
      save();
      console.log('[FEATURES] Created default flags file');
    }
  } catch (e) {
    console.error('[FEATURES] Load error, using defaults:', e.message);
    flags = JSON.parse(JSON.stringify(FEATURE_DEFAULTS));
  }
}

/**
 * Save current enabled state to file
 */
function save() {
  try {
    const dir = path.dirname(FLAGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Save only enabled state (compact)
    const toSave = {};
    for (const [key, val] of Object.entries(flags)) {
      toSave[key] = val.enabled;
    }
    fs.writeFileSync(FLAGS_FILE, JSON.stringify(toSave, null, 2));
  } catch (e) {
    console.error('[FEATURES] Save error:', e.message);
  }
}

/**
 * Check if feature is enabled
 */
function isEnabled(featureKey) {
  return flags[featureKey]?.enabled === true;
}

/**
 * Toggle feature on/off
 */
function toggle(featureKey, enabled) {
  if (!flags[featureKey]) return null;
  flags[featureKey].enabled = enabled;
  save();
  console.log(`[FEATURES] ${featureKey} → ${enabled ? 'ON' : 'OFF'}`);
  return flags[featureKey];
}

/**
 * Get all flags with full info
 */
function getAll() {
  return flags;
}

/**
 * Get summary: total cost estimate in THB
 */
function getSummary() {
  let totalCostPerDay = 0;
  let enabledCount = 0;
  let disabledCount = 0;

  for (const val of Object.values(flags)) {
    if (val.enabled) {
      enabledCount++;
      totalCostPerDay += val.costPerDay || 0;
    } else {
      disabledCount++;
    }
  }

  return {
    enabled: enabledCount,
    disabled: disabledCount,
    total: Object.keys(flags).length,
    estimatedCostPerDay: `฿${totalCostPerDay.toFixed(0)}`,
    estimatedCostPerMonth: `฿${(totalCostPerDay * 30).toFixed(0)}`
  };
}

// Initialize on import
load();

export default { isEnabled, toggle, getAll, getSummary, load, save };
export { isEnabled, toggle, getAll, getSummary };
