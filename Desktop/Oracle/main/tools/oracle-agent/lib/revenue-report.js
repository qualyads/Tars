/**
 * Revenue Report System v1.0
 * Hourly revenue tracking & pricing strategy for The Arch Casa
 *
 * ส่ง Report ทุกชั่วโมง เพื่อให้ปรับราคา/กลยุทธ์ได้ทันท่วงที
 */

import { getOccupancyForDate, getAllActiveBookings, getCheckInsToday } from './beds24.js';
import pricing from './pricing.js';

// Room baseline prices
const ROOM_PRICING = pricing.ROOM_PRICING;

/**
 * Calculate today's revenue from bookings
 */
async function getTodayRevenue() {
  const today = new Date().toISOString().split('T')[0];

  try {
    const occupancy = await getOccupancyForDate(today);

    if (occupancy.error) {
      return { error: occupancy.error };
    }

    // Calculate revenue from occupied rooms
    let totalRevenue = 0;
    const roomRevenues = [];

    if (occupancy.bookings && occupancy.bookings.length > 0) {
      occupancy.bookings.forEach(booking => {
        const price = booking.price || 0;
        totalRevenue += price;
        roomRevenues.push({
          roomId: booking.roomSystemId || booking.roomId,
          guestName: booking.guestName || `${booking.firstName} ${booking.lastName}`.trim(),
          price: price,
          source: booking.apiSource || booking.referer || 'Direct'
        });
      });
    }

    return {
      date: today,
      totalRevenue,
      occupiedRooms: occupancy.occupied,
      totalRooms: occupancy.totalRooms,
      availableRooms: occupancy.available,
      occupancyRate: occupancy.occupancyRate,
      roomRevenues,
      bookings: occupancy.bookings
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get available rooms with recommended prices
 */
async function getAvailableRoomsWithPricing(date) {
  try {
    const occupancy = await getOccupancyForDate(date);

    if (occupancy.error) {
      return { error: occupancy.error };
    }

    const allRooms = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'B07', 'B08', 'B09', 'C10', 'C11'];
    const occupiedRoomIds = new Set(occupancy.bookings.map(b => b.roomSystemId || b.roomId));

    const availableRooms = allRooms.filter(r => !occupiedRoomIds.has(r));

    // Calculate recommended prices based on occupancy
    const roomsWithPricing = availableRooms.map(roomId => {
      const basePrice = ROOM_PRICING[roomId]?.regular || 2000;
      const minPrice = ROOM_PRICING[roomId]?.min || 1500;
      const maxPrice = ROOM_PRICING[roomId]?.max || 3500;

      // Pricing strategy based on occupancy
      let recommendedPrice;
      let strategy;

      if (occupancy.occupancyRate >= 80) {
        // High demand - raise prices
        recommendedPrice = Math.min(Math.round(basePrice * 1.15), maxPrice);
        strategy = 'HIGH_DEMAND';
      } else if (occupancy.occupancyRate >= 60) {
        // Normal - base price
        recommendedPrice = basePrice;
        strategy = 'NORMAL';
      } else if (occupancy.occupancyRate >= 40) {
        // Low - slight discount
        recommendedPrice = Math.max(Math.round(basePrice * 0.90), minPrice);
        strategy = 'LOW';
      } else {
        // Emergency - big discount
        recommendedPrice = Math.max(Math.round(basePrice * 0.75), minPrice);
        strategy = 'EMERGENCY';
      }

      return {
        roomId,
        basePrice,
        recommendedPrice,
        minPrice,
        maxPrice,
        strategy
      };
    });

    return {
      date,
      occupancyRate: occupancy.occupancyRate,
      occupied: occupancy.occupied,
      available: occupancy.available,
      rooms: roomsWithPricing
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Generate hourly revenue report
 */
async function generateHourlyReport() {
  const now = new Date();
  const hour = now.getHours();
  const today = now.toISOString().split('T')[0];

  // Thai date formatting
  const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const dateThai = `วัน${thaiDays[now.getDay()]}ที่ ${now.getDate()} ${thaiMonths[now.getMonth()]}`;

  try {
    // Get today's revenue
    const revenue = await getTodayRevenue();

    if (revenue.error) {
      return {
        success: false,
        error: revenue.error,
        message: `Revenue Report Error: ${revenue.error}`
      };
    }

    // Get tomorrow's data for planning
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowPricing = await getAvailableRoomsWithPricing(tomorrowStr);

    // Build report message
    let report = `📊 **Revenue Report ${hour}:00**\n`;
    report += `${dateThai}\n\n`;

    // Today's summary
    report += `💰 **วันนี้ (${today})**\n`;
    report += `• Revenue: ฿${revenue.totalRevenue.toLocaleString()}\n`;
    report += `• Occupancy: ${revenue.occupancyRate}% (${revenue.occupiedRooms}/${revenue.totalRooms})\n`;
    report += `• ห้องว่าง: ${revenue.availableRooms} ห้อง\n\n`;

    // Room details
    if (revenue.roomRevenues.length > 0) {
      report += `📋 **ห้องที่ขายได้:**\n`;
      revenue.roomRevenues.forEach(r => {
        report += `• ${r.roomId}: ฿${r.price.toLocaleString()} (${r.source})\n`;
      });
      report += '\n';
    }

    // Today's available rooms with pricing
    if (revenue.availableRooms > 0) {
      const todayPricing = await getAvailableRoomsWithPricing(today);
      if (!todayPricing.error && todayPricing.rooms.length > 0) {
        const strategyEmoji = {
          'HIGH_DEMAND': '🔥',
          'NORMAL': '✅',
          'LOW': '⚡',
          'EMERGENCY': '🚨'
        };
        const strategyText = {
          'HIGH_DEMAND': 'ขึ้นราคา',
          'NORMAL': 'ราคาปกติ',
          'LOW': 'ลดราคา',
          'EMERGENCY': 'Flash Sale'
        };

        report += `💡 **ราคาแนะนำวันนี้:**\n`;
        todayPricing.rooms.forEach(r => {
          const emoji = strategyEmoji[r.strategy];
          const text = strategyText[r.strategy];
          report += `• ${r.roomId}: ฿${r.recommendedPrice.toLocaleString()} ${emoji} ${text}\n`;
        });
        report += '\n';
      }
    }

    // Tomorrow preview
    if (!tomorrowPricing.error) {
      const tomorrowDate = `${tomorrow.getDate()} ${thaiMonths[tomorrow.getMonth()]}`;
      report += `📅 **พรุ่งนี้ (${tomorrowDate}):**\n`;
      report += `• Occupancy: ${tomorrowPricing.occupancyRate}% (${tomorrowPricing.occupied}/${11})\n`;
      report += `• ห้องว่าง: ${tomorrowPricing.available} ห้อง\n`;

      if (tomorrowPricing.rooms.length > 0 && tomorrowPricing.available <= 3) {
        report += `• 🔥 เกือบเต็ม! แนะนำขึ้นราคา\n`;
      } else if (tomorrowPricing.available >= 6) {
        report += `• ⚡ ว่างเยอะ ควรทำโปรโมชั่น\n`;
      }
    }

    // Strategy recommendation
    report += '\n';
    if (revenue.occupancyRate >= 80) {
      report += `🎯 **กลยุทธ์:** Maximize Revenue - ขึ้นราคา 15-20%`;
    } else if (revenue.occupancyRate >= 60) {
      report += `🎯 **กลยุทธ์:** รักษาราคา - Push OTA ถ้าต้องการเพิ่ม`;
    } else if (revenue.occupancyRate >= 40) {
      report += `🎯 **กลยุทธ์:** ลดราคา 10-15% หรือทำ Deal`;
    } else {
      report += `🎯 **กลยุทธ์:** Flash Sale -20% หรือ Last Minute Deal`;
    }

    return {
      success: true,
      message: report,
      data: {
        date: today,
        hour,
        revenue: revenue.totalRevenue,
        occupancy: revenue.occupancyRate,
        available: revenue.availableRooms,
        tomorrowOccupancy: tomorrowPricing.occupancyRate || null
      }
    };

  } catch (error) {
    console.error('[REVENUE] Error generating report:', error);
    return {
      success: false,
      error: error.message,
      message: `Revenue Report Error: ${error.message}`
    };
  }
}

/**
 * Check if should send report (skip if nothing changed significantly)
 */
let lastReportData = null;

function shouldSendReport(newData) {
  if (!lastReportData) {
    lastReportData = newData;
    return true;
  }

  // Always send first report of the day
  if (lastReportData.date !== newData.date) {
    lastReportData = newData;
    return true;
  }

  // Send if revenue changed
  if (lastReportData.revenue !== newData.revenue) {
    lastReportData = newData;
    return true;
  }

  // Send if occupancy changed
  if (lastReportData.occupancy !== newData.occupancy) {
    lastReportData = newData;
    return true;
  }

  // Send at key hours: 9, 12, 15, 18, 21
  const keyHours = [9, 12, 15, 18, 21];
  if (keyHours.includes(newData.hour)) {
    lastReportData = newData;
    return true;
  }

  return false;
}

/**
 * Get status of revenue report system
 */
function getStatus() {
  return {
    lastReport: lastReportData,
    version: '1.0'
  };
}

export default {
  getTodayRevenue,
  getAvailableRoomsWithPricing,
  generateHourlyReport,
  shouldSendReport,
  getStatus
};

export {
  getTodayRevenue,
  getAvailableRoomsWithPricing,
  generateHourlyReport,
  shouldSendReport,
  getStatus
};
