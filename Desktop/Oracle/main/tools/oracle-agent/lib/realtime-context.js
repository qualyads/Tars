/**
 * Real-time Context Module
 * Oracle คิดเอง real-time จาก context ที่ inject เข้ามา
 *
 * Standard: ทุก feature ใหม่ต้องมี real-time thinking!
 *
 * @version 1.0.0
 */

import beds24 from './beds24.js';

// =============================================================================
// 1. TIME AWARENESS - รู้เวลาปัจจุบัน
// =============================================================================

/**
 * Get current time context for Oracle to think about
 */
function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const dayNamesTh = dayNames[dayOfWeek];

  // Time period
  let period, emoji;
  if (hour >= 5 && hour < 12) {
    period = 'เช้า';
    emoji = '🌅';
  } else if (hour >= 12 && hour < 17) {
    period = 'บ่าย';
    emoji = '☀️';
  } else if (hour >= 17 && hour < 21) {
    period = 'เย็น';
    emoji = '🌆';
  } else {
    period = 'ดึก';
    emoji = '🌙';
  }

  // Weekend check
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isFriday = dayOfWeek === 5;

  // Business context
  let businessContext = '';
  if (isWeekend) {
    businessContext = 'วันหยุด - demand สูง';
  } else if (isFriday && hour >= 14) {
    businessContext = 'บ่ายศุกร์ - คนกำลังจะเดินทาง weekend';
  } else if (hour >= 21) {
    businessContext = 'ดึกแล้ว - last minute booking';
  }

  return {
    hour,
    minute: now.getMinutes(),
    dayOfWeek,
    dayNamesTh,
    period,
    emoji,
    isWeekend,
    isFriday,
    isLateNight: hour >= 21 || hour < 6,
    isBusinessHours: hour >= 9 && hour < 18,
    businessContext,
    formatted: `${emoji} ${hour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} วัน${dayNamesTh}`,
    timestamp: now.toISOString()
  };
}

/**
 * Generate time context string for Oracle
 */
function generateTimeContextString() {
  const time = getTimeContext();

  let context = `\n⏰ **เวลาปัจจุบัน:** ${time.formatted}`;

  if (time.businessContext) {
    context += ` (${time.businessContext})`;
  }

  if (time.isLateNight) {
    context += `\n💡 ดึกแล้ว - ถ้า Tars ถามเรื่องงาน ตอบสั้นๆ ได้`;
  }

  return context;
}

// =============================================================================
// 2. INVESTMENT ALERTS - ทอง/BTC เปลี่ยนแรง
// =============================================================================

// Cache for market data (avoid excessive API calls)
let marketCache = {
  gold: null,
  btc: null,
  lastFetch: null
};

/**
 * Fetch gold price (Thai gold)
 */
async function fetchGoldPrice() {
  try {
    // Use GoldPrice.org API or cached data
    const response = await fetch('https://api.chnwt.dev/thai-gold-api/latest');
    const data = await response.json();

    if (data.response) {
      return {
        success: true,
        price: data.response.price?.gold_bar?.sell || 0,
        change: data.response.price?.change || 0,
        updatedAt: data.response.date
      };
    }
  } catch (e) {
    console.error('[REALTIME] Gold price error:', e.message);
  }

  return { success: false };
}

/**
 * Fetch BTC price and Fear & Greed
 */
async function fetchBTCData() {
  try {
    // CoinGecko API (free)
    const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    const priceData = await priceRes.json();

    // Fear & Greed Index
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=1');
    const fgData = await fgRes.json();

    return {
      success: true,
      price: priceData.bitcoin?.usd || 0,
      change24h: priceData.bitcoin?.usd_24h_change || 0,
      fearGreed: fgData.data?.[0]?.value || 50,
      fearGreedText: fgData.data?.[0]?.value_classification || 'Neutral'
    };
  } catch (e) {
    console.error('[REALTIME] BTC data error:', e.message);
  }

  return { success: false };
}

/**
 * Check if market has significant moves
 */
async function checkMarketAlerts() {
  const alerts = [];
  const now = Date.now();

  // Only fetch every 30 minutes
  if (marketCache.lastFetch && (now - marketCache.lastFetch) < 30 * 60 * 1000) {
    return marketCache.alerts || [];
  }

  // Fetch BTC
  const btc = await fetchBTCData();
  if (btc.success) {
    marketCache.btc = btc;

    // Alert if BTC moves > 3% in 24h
    if (Math.abs(btc.change24h) > 3) {
      const direction = btc.change24h > 0 ? '📈 ขึ้น' : '📉 ลง';
      alerts.push({
        type: 'btc',
        emoji: btc.change24h > 0 ? '🟢' : '🔴',
        message: `BTC ${direction} ${Math.abs(btc.change24h).toFixed(1)}% ($${btc.price.toLocaleString()})`,
        urgency: Math.abs(btc.change24h) > 5 ? 'high' : 'medium'
      });
    }

    // Alert on extreme Fear & Greed
    if (btc.fearGreed < 25) {
      alerts.push({
        type: 'btc_fg',
        emoji: '😱',
        message: `Fear & Greed: ${btc.fearGreed} (${btc.fearGreedText}) - อาจเป็นโอกาสซื้อ?`,
        urgency: 'medium'
      });
    } else if (btc.fearGreed > 75) {
      alerts.push({
        type: 'btc_fg',
        emoji: '🤑',
        message: `Fear & Greed: ${btc.fearGreed} (${btc.fearGreedText}) - ระวัง FOMO`,
        urgency: 'medium'
      });
    }
  }

  marketCache.lastFetch = now;
  marketCache.alerts = alerts;

  return alerts;
}

/**
 * Generate investment context string for Oracle
 */
async function generateInvestmentContextString() {
  const alerts = await checkMarketAlerts();

  if (alerts.length === 0) {
    return ''; // No alerts = don't add to context
  }

  let context = `\n\n💰 **Investment Alerts:**`;
  for (const alert of alerts) {
    context += `\n${alert.emoji} ${alert.message}`;
  }

  return context;
}

// =============================================================================
// 3. CHECK-IN PROXIMITY - ใกล้เวลา check-in แขก
// =============================================================================

/**
 * Check if any guest is checking in soon
 */
async function checkUpcomingCheckins() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const bookings = await beds24.getBookingsByDate(today);

    if (!Array.isArray(bookings) || bookings.length === 0) {
      return [];
    }

    const now = new Date();
    const currentHour = now.getHours();
    const alerts = [];

    // Check-in time is typically 14:00
    const checkinHour = 14;

    // If it's before check-in time, calculate hours until
    if (currentHour < checkinHour) {
      const hoursUntil = checkinHour - currentHour;

      if (hoursUntil <= 3) {
        alerts.push({
          type: 'checkin_soon',
          emoji: '🔔',
          message: `อีก ${hoursUntil} ชม. แขก ${bookings.length} คน จะ check-in`,
          guests: bookings.map(b => ({
            name: b.guestName || `${b.firstName} ${b.lastName}`,
            room: b.roomSystemId || b.roomId
          })),
          urgency: hoursUntil <= 1 ? 'high' : 'medium'
        });
      }
    } else if (currentHour >= checkinHour && currentHour < 18) {
      // During check-in hours - remind about any arrivals
      const notCheckedIn = bookings.filter(b => !b.checkedIn);
      if (notCheckedIn.length > 0) {
        alerts.push({
          type: 'checkin_now',
          emoji: '🚪',
          message: `ช่วง check-in แล้ว - รอแขก ${notCheckedIn.length} คน`,
          guests: notCheckedIn.map(b => ({
            name: b.guestName || `${b.firstName} ${b.lastName}`,
            room: b.roomSystemId || b.roomId
          })),
          urgency: 'low'
        });
      }
    }

    return alerts;
  } catch (e) {
    console.error('[REALTIME] Checkin proximity error:', e.message);
    return [];
  }
}

/**
 * Generate check-in context string for Oracle
 */
async function generateCheckinContextString() {
  const alerts = await checkUpcomingCheckins();

  if (alerts.length === 0) {
    return '';
  }

  let context = '';
  for (const alert of alerts) {
    context += `\n\n${alert.emoji} **${alert.message}**`;
    if (alert.guests && alert.guests.length <= 5) {
      for (const guest of alert.guests) {
        context += `\n  • ${guest.room}: ${guest.name}`;
      }
    }
  }

  return context;
}

// =============================================================================
// MAIN: Generate all real-time context
// =============================================================================

/**
 * Generate complete real-time context for Oracle
 * Call this in server.js to inject into contextString
 */
async function generateRealtimeContext(options = {}) {
  const contexts = [];

  // 1. Time awareness (always)
  contexts.push(generateTimeContextString());

  // 2. Investment alerts (if user is owner and interested)
  if (options.includeInvestment !== false) {
    const investmentContext = await generateInvestmentContextString();
    if (investmentContext) {
      contexts.push(investmentContext);
    }
  }

  // 3. Check-in proximity (if hotel query or owner)
  if (options.includeHotel !== false) {
    const checkinContext = await generateCheckinContextString();
    if (checkinContext) {
      contexts.push(checkinContext);
    }
  }

  return contexts.join('');
}

/**
 * Get all real-time alerts (for proactive notification)
 */
async function getAllAlerts() {
  const alerts = [];

  // Investment
  const marketAlerts = await checkMarketAlerts();
  alerts.push(...marketAlerts);

  // Check-in
  const checkinAlerts = await checkUpcomingCheckins();
  alerts.push(...checkinAlerts);

  return alerts;
}

export default {
  // Time
  getTimeContext,
  generateTimeContextString,

  // Investment
  fetchGoldPrice,
  fetchBTCData,
  checkMarketAlerts,
  generateInvestmentContextString,

  // Check-in
  checkUpcomingCheckins,
  generateCheckinContextString,

  // Main
  generateRealtimeContext,
  getAllAlerts
};
