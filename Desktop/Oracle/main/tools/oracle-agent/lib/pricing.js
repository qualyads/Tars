/**
 * Pricing Intelligence Module for The Arch Casa
 * Data-driven pricing recommendations based on historical Beds24 data
 *
 * @version 1.0.0
 */

import beds24 from './beds24.js';

// Room baseline prices (from historical data analysis - Feb 2026)
const ROOM_PRICING = {
  'A01': { regular: 2000, min: 1600, max: 2400 },
  'A02': { regular: 1958, min: 1566, max: 2350 },
  'A03': { regular: 1772, min: 1418, max: 2126 },
  'A04': { regular: 2687, min: 2150, max: 3224 },
  'A05': { regular: 2128, min: 1702, max: 2554 },
  'A06': { regular: 2000, min: 1600, max: 2400 },
  'B07': { regular: 2219, min: 1775, max: 2663 },
  'B08': { regular: 2100, min: 1680, max: 2520 },
  'B09': { regular: 2092, min: 1674, max: 2510 },
  'C10': { regular: 1800, min: 1440, max: 2160 },
  'C11': { regular: 1675, min: 1340, max: 2010 }
};

// Day of week price modifiers (from historical data)
const DAY_MODIFIERS = {
  0: 0.85,  // อาทิตย์ -15%
  1: 0.95,  // จันทร์ -5%
  2: 0.95,  // อังคาร -5%
  3: 0.95,  // พุธ -5%
  4: 1.15,  // พฤหัส +15%
  5: 1.00,  // ศุกร์ ปกติ
  6: 1.00   // เสาร์ ปกติ
};

// Season definitions
const SEASONS = {
  high: { months: [11, 12, 1, 2], modifier: 1.20 },  // พ.ย. - ก.พ.
  shoulder: { months: [3, 10], modifier: 1.00 },       // มี.ค., ต.ค.
  low: { months: [4, 5, 6, 7, 8, 9], modifier: 0.75 }  // เม.ย. - ก.ย.
};

// Occupancy-based pricing
const OCCUPANCY_MODIFIERS = {
  emergency: { threshold: 20, modifier: 0.60, label: 'Emergency (-40%)' },
  low: { threshold: 40, modifier: 0.80, label: 'Low Occupancy (-20%)' },
  medium: { threshold: 60, modifier: 0.90, label: 'Medium (-10%)' },
  normal: { threshold: 80, modifier: 1.00, label: 'Normal' },
  high: { threshold: 100, modifier: 1.15, label: 'High Demand (+15%)' }
};

/**
 * Get season for a given date
 */
function getSeason(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;

  if (SEASONS.high.months.includes(month)) return 'high';
  if (SEASONS.shoulder.months.includes(month)) return 'shoulder';
  return 'low';
}

/**
 * Get days until date
 */
function getDaysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Get hours until date (for same-day/next-day urgency)
 */
function getHoursUntil(date) {
  const now = new Date();
  const target = new Date(date);
  target.setHours(14, 0, 0, 0); // Check-in time is typically 14:00
  return Math.max(0, (target - now) / (1000 * 60 * 60));
}

/**
 * Calculate real-time urgency score
 * Higher score = more urgent = need to take action
 *
 * Factors:
 * - occupancy: ยิ่งว่างเยอะ ยิ่ง urgent
 * - time: ยิ่งใกล้วัน ยิ่ง urgent
 * - time of day: หลัง 18:00 + พรุ่งนี้ยังว่าง = very urgent
 */
function calculateUrgency(date, occupancyRate) {
  const now = new Date();
  const currentHour = now.getHours();
  const daysUntil = getDaysUntil(date);
  const hoursUntil = getHoursUntil(date);

  // Base urgency from vacancy (100 - occupancy)
  const vacancyFactor = 100 - occupancyRate;

  // Time pressure multiplier
  let timePressure = 1.0;
  if (daysUntil === 0) {
    // Same day
    timePressure = 4.0;
  } else if (daysUntil === 1) {
    // Tomorrow
    timePressure = currentHour >= 18 ? 3.5 : currentHour >= 14 ? 2.5 : 2.0;
  } else if (daysUntil === 2) {
    timePressure = currentHour >= 18 ? 2.0 : 1.5;
  } else if (daysUntil <= 5) {
    timePressure = 1.2;
  }

  // Urgency score
  const urgencyScore = Math.round(vacancyFactor * timePressure);

  // Determine urgency level and action
  let level, action, emoji;
  if (urgencyScore >= 200) {
    level = 'CRITICAL';
    emoji = '🚨';
    action = 'ต้องลดราคา 30-40% หรือ Flash Sale ทันที!';
  } else if (urgencyScore >= 150) {
    level = 'HIGH';
    emoji = '🔴';
    action = 'ควรลดราคา 20-30% หรือทำโปรโมชั่น';
  } else if (urgencyScore >= 100) {
    level = 'MEDIUM';
    emoji = '🟠';
    action = 'ควรลดราคา 10-15% หรือ push OTA';
  } else if (urgencyScore >= 50) {
    level = 'LOW';
    emoji = '🟡';
    action = 'Monitor ต่อ อาจไม่ต้องทำอะไร';
  } else {
    level = 'OK';
    emoji = '🟢';
    action = 'สถานการณ์ดี ไม่ต้องทำอะไร';
  }

  return {
    score: urgencyScore,
    level,
    emoji,
    action,
    factors: {
      vacancy: vacancyFactor,
      timePressure,
      daysUntil,
      hoursUntil: Math.round(hoursUntil),
      currentHour
    }
  };
}

/**
 * Generate urgency context for Oracle to think about
 * This is injected into context - Oracle decides what to do
 */
function generateUrgencyContext(date, occupancyRate) {
  const urgency = calculateUrgency(date, occupancyRate);
  const daysUntil = getDaysUntil(date);

  const dateLabel = daysUntil === 0 ? 'วันนี้' : daysUntil === 1 ? 'พรุ่งนี้' : `อีก ${daysUntil} วัน`;

  let context = `\n\n${urgency.emoji} **Urgency Analysis (${dateLabel}):**\n`;
  context += `• Score: ${urgency.score}/300 (${urgency.level})\n`;
  context += `• Occupancy: ${occupancyRate}% | Time Pressure: ${urgency.factors.timePressure}x\n`;
  context += `• Now: ${urgency.factors.currentHour}:00 | Hours until check-in: ${urgency.factors.hoursUntil}h\n`;
  context += `• ${urgency.action}`;

  return context;
}

/**
 * Get occupancy modifier based on current occupancy rate
 */
function getOccupancyModifier(occupancyRate) {
  if (occupancyRate < OCCUPANCY_MODIFIERS.emergency.threshold) {
    return OCCUPANCY_MODIFIERS.emergency;
  }
  if (occupancyRate < OCCUPANCY_MODIFIERS.low.threshold) {
    return OCCUPANCY_MODIFIERS.low;
  }
  if (occupancyRate < OCCUPANCY_MODIFIERS.medium.threshold) {
    return OCCUPANCY_MODIFIERS.medium;
  }
  if (occupancyRate < OCCUPANCY_MODIFIERS.normal.threshold) {
    return OCCUPANCY_MODIFIERS.normal;
  }
  return OCCUPANCY_MODIFIERS.high;
}

/**
 * Calculate recommended price for a room on a specific date
 */
function calculatePrice(roomId, date, occupancyRate = 50) {
  const basePrice = ROOM_PRICING[roomId]?.regular || 2000;
  const d = new Date(date);

  // Day of week modifier
  const dayMod = DAY_MODIFIERS[d.getDay()];

  // Season modifier
  const season = getSeason(date);
  const seasonMod = SEASONS[season].modifier;

  // Occupancy modifier
  const occMod = getOccupancyModifier(occupancyRate);

  // Last minute discount (< 3 days)
  const daysUntil = getDaysUntil(date);
  const lastMinuteMod = daysUntil <= 2 ? 0.75 : daysUntil <= 5 ? 0.90 : 1.0;

  // Calculate final price
  const finalPrice = Math.round(basePrice * dayMod * seasonMod * occMod.modifier * lastMinuteMod);

  // Ensure within min/max bounds
  const minPrice = ROOM_PRICING[roomId]?.min || 1500;
  const maxPrice = ROOM_PRICING[roomId]?.max || 3500;

  return {
    roomId,
    date: date,
    basePrice,
    finalPrice: Math.max(minPrice, Math.min(maxPrice, finalPrice)),
    modifiers: {
      dayOfWeek: { value: dayMod, day: d.getDay() },
      season: { value: seasonMod, type: season },
      occupancy: occMod,
      lastMinute: { value: lastMinuteMod, daysUntil }
    }
  };
}

/**
 * Get pricing recommendations for a specific date
 */
async function getPricingForDate(date) {
  // Get occupancy for that date
  const occupancy = await beds24.getOccupancyForDate(date);
  const occRate = occupancy.occupancyRate;

  // Get available rooms
  const allRooms = Object.keys(ROOM_PRICING);
  const occupiedRoomIds = new Set(occupancy.bookings.map(b => b.roomSystemId));
  const availableRooms = allRooms.filter(r => !occupiedRoomIds.has(r));

  // Calculate prices for available rooms
  const recommendations = availableRooms.map(roomId => {
    return calculatePrice(roomId, date, occRate);
  });

  return {
    date,
    occupancy: {
      rate: occRate,
      occupied: occupancy.occupied,
      available: occupancy.available
    },
    recommendations: recommendations.sort((a, b) => a.finalPrice - b.finalPrice),
    summary: {
      lowestPrice: Math.min(...recommendations.map(r => r.finalPrice)),
      highestPrice: Math.max(...recommendations.map(r => r.finalPrice)),
      averagePrice: Math.round(recommendations.reduce((sum, r) => sum + r.finalPrice, 0) / recommendations.length)
    }
  };
}

/**
 * Generate pricing recommendation text for Oracle responses
 */
async function generatePricingAdvice(date) {
  const pricing = await getPricingForDate(date);

  const d = new Date(date);
  const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  const dateThai = `วัน${dayNames[d.getDay()]}ที่ ${d.getDate()} ${monthNames[d.getMonth()]}`;

  let advice = `📊 **ราคาแนะนำ: ${dateThai}**\n`;
  advice += `Occupancy: ${pricing.occupancy.rate}% (ว่าง ${pricing.occupancy.available} ห้อง)\n\n`;

  if (pricing.recommendations.length === 0) {
    advice += '🔴 เต็มทุกห้อง - ไม่มีห้องให้ขาย';
    return advice;
  }

  // Determine pricing strategy based on occupancy
  const occMod = getOccupancyModifier(pricing.occupancy.rate);
  if (occMod.threshold <= 20) {
    advice += '🚨 **Emergency Pricing** - ลดราคาดึงลูกค้า:\n';
  } else if (occMod.threshold <= 40) {
    advice += '⚡ **Low Occupancy** - ราคาแข่งขัน:\n';
  } else {
    advice += '💰 **ราคาแนะนำตามห้อง:**\n';
  }

  pricing.recommendations.forEach(rec => {
    advice += `• ${rec.roomId}: ${rec.finalPrice.toLocaleString()} THB`;
    if (rec.modifiers.lastMinute.daysUntil <= 2) {
      advice += ' (Last Min)';
    }
    advice += '\n';
  });

  advice += `\n📈 Range: ${pricing.summary.lowestPrice.toLocaleString()}-${pricing.summary.highestPrice.toLocaleString()} THB`;

  return advice;
}

/**
 * Get upcoming week pricing overview
 */
async function getWeeklyPricingOverview() {
  const today = new Date();
  const overview = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    try {
      const pricing = await getPricingForDate(dateStr);
      overview.push({
        date: dateStr,
        dayName: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][date.getDay()],
        occupancy: pricing.occupancy.rate,
        available: pricing.occupancy.available,
        avgPrice: pricing.summary.averagePrice
      });
    } catch (err) {
      console.error(`Error getting pricing for ${dateStr}:`, err);
    }
  }

  return overview;
}

export default {
  ROOM_PRICING,
  calculatePrice,
  getPricingForDate,
  generatePricingAdvice,
  getWeeklyPricingOverview,
  getSeason,
  getOccupancyModifier,
  calculateUrgency,
  generateUrgencyContext
};
