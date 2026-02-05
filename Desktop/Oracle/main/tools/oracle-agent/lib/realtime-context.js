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
// 4. WEATHER @ PAI - สภาพอากาศที่ปาย
// =============================================================================

let weatherCache = { data: null, lastFetch: null };

/**
 * Fetch weather for Pai, Thailand
 */
async function fetchPaiWeather() {
  try {
    // OpenWeatherMap API (free tier)
    // Pai coordinates: 19.3590° N, 98.4408° E
    const apiKey = process.env.OPENWEATHER_API_KEY || '';
    if (!apiKey) {
      // Use wttr.in as fallback (no API key needed)
      const response = await fetch('https://wttr.in/Pai,Thailand?format=j1');
      const data = await response.json();

      if (data.current_condition?.[0]) {
        const current = data.current_condition[0];
        return {
          success: true,
          temp: parseInt(current.temp_C),
          feelsLike: parseInt(current.FeelsLikeC),
          humidity: parseInt(current.humidity),
          description: current.weatherDesc?.[0]?.value || '',
          icon: getWeatherEmoji(current.weatherCode),
          updatedAt: new Date().toISOString()
        };
      }
    }
  } catch (e) {
    console.error('[REALTIME] Weather error:', e.message);
  }
  return { success: false };
}

function getWeatherEmoji(code) {
  const codeNum = parseInt(code);
  if (codeNum >= 200 && codeNum < 300) return '⛈️'; // Thunderstorm
  if (codeNum >= 300 && codeNum < 400) return '🌧️'; // Drizzle
  if (codeNum >= 500 && codeNum < 600) return '🌧️'; // Rain
  if (codeNum >= 600 && codeNum < 700) return '❄️'; // Snow
  if (codeNum >= 700 && codeNum < 800) return '🌫️'; // Fog
  if (codeNum === 800) return '☀️'; // Clear
  if (codeNum > 800) return '☁️'; // Clouds
  return '🌤️';
}

async function generateWeatherContextString() {
  const now = Date.now();

  // Cache for 1 hour
  if (weatherCache.lastFetch && (now - weatherCache.lastFetch) < 60 * 60 * 1000) {
    if (weatherCache.data) {
      const w = weatherCache.data;
      return `\n🌤️ **อากาศปาย:** ${w.icon} ${w.temp}°C (${w.description})`;
    }
    return '';
  }

  const weather = await fetchPaiWeather();
  weatherCache.lastFetch = now;

  if (weather.success) {
    weatherCache.data = weather;

    let context = `\n🌤️ **อากาศปาย:** ${weather.icon} ${weather.temp}°C`;
    if (weather.description) context += ` (${weather.description})`;

    // Business insight
    if (weather.temp < 20) {
      context += ` - อากาศเย็น demand สูง!`;
    } else if (weather.temp > 35) {
      context += ` - ร้อนมาก demand อาจต่ำ`;
    }
    if (weather.description.toLowerCase().includes('rain')) {
      context += ` - ฝนตก อาจมี cancellation`;
    }

    return context;
  }

  return '';
}

// =============================================================================
// 5. REVENUE TRACKING - รายได้ vs เป้า
// =============================================================================

/**
 * Calculate monthly revenue from Beds24
 */
async function getMonthlyRevenue() {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const fromDate = firstDay.toISOString().split('T')[0];
    const toDate = lastDay.toISOString().split('T')[0];

    // Get bookings for the month
    const bookings = await beds24.getBookings?.(fromDate, toDate) || [];

    let totalRevenue = 0;
    let bookingCount = 0;

    for (const b of bookings) {
      if (b.price) {
        totalRevenue += b.price;
        bookingCount++;
      }
    }

    // Monthly target (example: 500,000 THB)
    const monthlyTarget = 500000;
    const percentOfTarget = Math.round((totalRevenue / monthlyTarget) * 100);
    const daysInMonth = lastDay.getDate();
    const currentDay = now.getDate();
    const expectedPercent = Math.round((currentDay / daysInMonth) * 100);

    return {
      success: true,
      totalRevenue,
      bookingCount,
      monthlyTarget,
      percentOfTarget,
      expectedPercent,
      onTrack: percentOfTarget >= expectedPercent - 10,
      daysRemaining: daysInMonth - currentDay
    };
  } catch (e) {
    console.error('[REALTIME] Revenue error:', e.message);
    return { success: false };
  }
}

let revenueCache = { data: null, lastFetch: null };

async function generateRevenueContextString() {
  const now = Date.now();

  // Cache for 6 hours
  if (revenueCache.lastFetch && (now - revenueCache.lastFetch) < 6 * 60 * 60 * 1000) {
    return revenueCache.context || '';
  }

  const revenue = await getMonthlyRevenue();
  revenueCache.lastFetch = now;

  if (!revenue.success) {
    revenueCache.context = '';
    return '';
  }

  const emoji = revenue.onTrack ? '📈' : '📉';
  const status = revenue.onTrack ? 'On Track' : 'ต่ำกว่าเป้า';

  let context = `\n${emoji} **Revenue เดือนนี้:** ฿${revenue.totalRevenue.toLocaleString()} (${revenue.percentOfTarget}% of target)`;

  if (!revenue.onTrack) {
    context += `\n⚠️ ${status} - ควรอยู่ที่ ${revenue.expectedPercent}% แต่ได้ ${revenue.percentOfTarget}%`;
    context += ` (เหลืออีก ${revenue.daysRemaining} วัน)`;
  }

  revenueCache.context = context;
  return context;
}

// =============================================================================
// 6. CALENDAR - นัดหมายวันนี้
// =============================================================================

async function generateCalendarContextString() {
  try {
    // Try to import google-calendar if available
    const { default: calendar } = await import('./google-calendar.js');

    if (!calendar.isConfigured?.()) {
      return '';
    }

    const events = await calendar.getTodayEvents?.();
    if (!events || events.length === 0) {
      return '';
    }

    let context = `\n📅 **นัดวันนี้ (${events.length}):**`;
    for (const event of events.slice(0, 3)) {
      context += `\n  • ${event.time || ''} ${event.title}`;
    }

    return context;
  } catch (e) {
    // Google Calendar not configured
    return '';
  }
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

  // 4. Weather @ Pai
  if (options.includeWeather !== false) {
    const weatherContext = await generateWeatherContextString();
    if (weatherContext) {
      contexts.push(weatherContext);
    }
  }

  // 5. Revenue tracking
  if (options.includeRevenue !== false) {
    const revenueContext = await generateRevenueContextString();
    if (revenueContext) {
      contexts.push(revenueContext);
    }
  }

  // 6. Calendar
  if (options.includeCalendar !== false) {
    const calendarContext = await generateCalendarContextString();
    if (calendarContext) {
      contexts.push(calendarContext);
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

  // Weather
  fetchPaiWeather,
  generateWeatherContextString,

  // Revenue
  getMonthlyRevenue,
  generateRevenueContextString,

  // Calendar
  generateCalendarContextString,

  // Main
  generateRealtimeContext,
  getAllAlerts
};
