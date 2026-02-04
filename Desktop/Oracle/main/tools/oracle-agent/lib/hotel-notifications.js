/**
 * Hotel Notifications - Telegram Alerts
 * Pattern learned from checkin-main
 *
 * Features:
 * - New booking alerts
 * - Check-in confirmations
 * - Check-out reminders
 * - Service request notifications
 * - Low occupancy warnings
 * - Critical alerts (payment disputes, etc.)
 */

import telegram from './telegram.js';
import beds24 from './beds24.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../config.json');

// ============================================================
// ICONS (Telegram-safe emojis)
// ============================================================

const ICONS = {
  SUCCESS: '✅',
  ALERT: '⚠️',
  CRITICAL: '🚨',
  ROOM: '🏠',
  GUEST: '👤',
  CALENDAR: '📅',
  MONEY: '💰',
  CLOCK: '⏰',
  CHECK_IN: '🛎️',
  CHECK_OUT: '🚪',
  CLEANING: '🧹',
  INFO: 'ℹ️',
  STAR: '⭐'
};

// ============================================================
// SANITIZATION (from checkin-main)
// ============================================================

/**
 * Sanitize text for Telegram Markdown
 */
function sanitize(text, maxLength = 100) {
  if (!text) return '';
  return String(text)
    .replace(/[_*`\[\]]/g, '') // Remove Markdown special chars
    .replace(/\n+/g, ' ')       // Collapse newlines
    .substring(0, maxLength)
    .trim();
}

/**
 * Format Thai Baht
 */
function formatTHB(amount) {
  if (!amount) return '฿0';
  return `฿${Number(amount).toLocaleString()}`;
}

/**
 * Format date Thai style
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString('th-TH', { month: 'short' });
  return `${day} ${month}`;
}

// ============================================================
// NOTIFICATION FUNCTIONS
// ============================================================

/**
 * Send notification if Telegram is configured
 */
async function notify(message) {
  if (!telegram.isConfigured()) {
    console.log('[HOTEL-NOTIFY] Telegram not configured, skipping notification');
    return false;
  }

  try {
    await telegram.notifyOwner(message);
    console.log('[HOTEL-NOTIFY] Sent:', message.substring(0, 50) + '...');
    return true;
  } catch (error) {
    console.error('[HOTEL-NOTIFY] Failed to send:', error.message);
    return false;
  }
}

/**
 * New booking notification
 */
async function notifyNewBooking(booking) {
  const room = beds24.getRoomById(booking.roomId);
  const nights = Math.ceil((new Date(booking.departure) - new Date(booking.arrival)) / (1000 * 60 * 60 * 24));

  const message = `${ICONS.SUCCESS} *New Booking!*

${ICONS.GUEST} ${sanitize(booking.guestName || `${booking.firstName} ${booking.lastName}`)}
${ICONS.ROOM} ${room.id} ${room.name}
${ICONS.CALENDAR} ${formatDate(booking.arrival)} → ${formatDate(booking.departure)} (${nights} คืน)
${ICONS.MONEY} ${formatTHB(booking.price)}
📱 ${booking.apiSource || booking.referer || 'Direct'}`;

  return notify(message);
}

/**
 * Check-in confirmation notification
 */
async function notifyCheckIn(booking, roomId) {
  const room = beds24.getRoomById(booking.roomId);

  const message = `${ICONS.CHECK_IN} *Check-in สำเร็จ*

${ICONS.GUEST} ${sanitize(booking.guestName)}
${ICONS.ROOM} ${room.id} ${room.name}
${ICONS.CALENDAR} Check-out: ${formatDate(booking.departure)}`;

  return notify(message);
}

/**
 * Check-out reminder notification
 */
async function notifyCheckOutReminder(bookings) {
  if (!bookings || bookings.length === 0) return false;

  let message = `${ICONS.CHECK_OUT} *Check-out วันนี้*\n`;
  message += `${bookings.length} ห้อง:\n\n`;

  bookings.forEach(b => {
    const room = beds24.getRoomById(b.roomId);
    message += `• ${room.id} ${sanitize(b.guestName, 30)}\n`;
  });

  return notify(message);
}

/**
 * Service request notification
 */
async function notifyServiceRequest(request) {
  const serviceIcons = {
    housekeeping: '🧹',
    towelChange: '🛁',
    laundry: '👕',
    taxi: '🚕',
    tm30: '📋',
    lateCheckout: '⏰',
    extend: '📅',
    other: '📝'
  };

  const icon = serviceIcons[request.serviceType] || '📝';

  const message = `${icon} *Service Request*

${ICONS.ROOM} ห้อง: ${request.roomId}
${ICONS.GUEST} ${sanitize(request.guestName)}
📝 ${request.serviceName || request.serviceType}
${request.notes ? `💬 ${sanitize(request.notes, 50)}` : ''}`;

  return notify(message);
}

/**
 * Low occupancy warning
 */
async function notifyLowOccupancy(date, occupiedCount, totalRooms) {
  const availableCount = totalRooms - occupiedCount;
  const occupancyRate = Math.round((occupiedCount / totalRooms) * 100);

  if (occupancyRate >= 50) return false; // Only alert if below 50%

  const message = `${ICONS.ALERT} *Low Occupancy Alert*

${ICONS.CALENDAR} วันที่: ${formatDate(date)}
${ICONS.ROOM} ว่าง: ${availableCount}/${totalRooms} ห้อง
📊 Occupancy: ${occupancyRate}%

💡 Consider promotions or last-minute deals`;

  return notify(message);
}

/**
 * Critical alert (payment disputes, errors, etc.)
 */
async function notifyCritical(title, details) {
  const message = `${ICONS.CRITICAL} *${sanitize(title)}*

${sanitize(details, 500)}

⚡ ต้องดำเนินการด่วน!`;

  return notify(message);
}

/**
 * Daily summary notification
 */
async function notifyDailySummary() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const occupancy = await beds24.getOccupancyForDate(today);

    if (occupancy.error) {
      console.error('[HOTEL-NOTIFY] Failed to get occupancy:', occupancy.error);
      return false;
    }

    const checkIns = await beds24.getCheckInsToday();
    const checkOuts = await beds24.getCheckOutsToday();

    const checkInCount = Array.isArray(checkIns) ? checkIns.length : 0;
    const checkOutCount = Array.isArray(checkOuts) ? checkOuts.length : 0;

    const message = `${ICONS.INFO} *Daily Summary - ${formatDate(today)}*

${ICONS.ROOM} Occupancy: ${occupancy.occupied}/${occupancy.totalRooms} (${occupancy.occupancyRate}%)
${ICONS.CHECK_IN} Check-in: ${checkInCount}
${ICONS.CHECK_OUT} Check-out: ${checkOutCount}
🆓 ว่าง: ${occupancy.available} ห้อง

${checkInCount > 0 ? `\n*Check-ins:*\n${checkIns.slice(0, 5).map(b => `• ${beds24.getRoomById(b.roomId).id} ${sanitize(b.guestName, 25)}`).join('\n')}` : ''}`;

    return notify(message);
  } catch (error) {
    console.error('[HOTEL-NOTIFY] Daily summary error:', error.message);
    return false;
  }
}

/**
 * Payment received notification
 */
async function notifyPaymentReceived(booking, amount, source = 'Stripe') {
  const room = beds24.getRoomById(booking.roomId);

  const message = `${ICONS.MONEY} *Payment Received*

${ICONS.GUEST} ${sanitize(booking.guestName)}
${ICONS.ROOM} ${room.id} ${room.name}
${ICONS.MONEY} ${formatTHB(amount)}
💳 ${source}`;

  return notify(message);
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  // Core
  notify,
  sanitize,

  // Booking events
  notifyNewBooking,
  notifyCheckIn,
  notifyCheckOutReminder,

  // Service events
  notifyServiceRequest,

  // Alerts
  notifyLowOccupancy,
  notifyCritical,

  // Summaries
  notifyDailySummary,
  notifyPaymentReceived,

  // Constants
  ICONS
};

export {
  notify,
  notifyNewBooking,
  notifyCheckIn,
  notifyCheckOutReminder,
  notifyServiceRequest,
  notifyLowOccupancy,
  notifyCritical,
  notifyDailySummary,
  notifyPaymentReceived,
  ICONS
};
