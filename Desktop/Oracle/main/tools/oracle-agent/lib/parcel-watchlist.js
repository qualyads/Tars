/**
 * Parcel Watchlist Module
 * ระบบติดตามพัสดุที่ Oracle เฝ้าดูอยู่
 *
 * Features:
 * - เพิ่ม/ลบ tracking number ใน watchlist
 * - ส่ง LINE notification เมื่อสถานะเปลี่ยน
 * - ลบอัตโนมัติเมื่อ delivered
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import parcelTracking from './parcel-tracking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WATCHLIST_FILE = path.join(__dirname, '../data/parcel-watchlist.json');

// Ensure data directory exists
const dataDir = path.dirname(WATCHLIST_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Load watchlist from file
 */
function loadWatchlist() {
  try {
    if (fs.existsSync(WATCHLIST_FILE)) {
      const data = fs.readFileSync(WATCHLIST_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[WATCHLIST] Error loading:', err.message);
  }
  return { parcels: [] };
}

/**
 * Save watchlist to file
 */
function saveWatchlist(watchlist) {
  try {
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(watchlist, null, 2));
    console.log('[WATCHLIST] Saved:', watchlist.parcels.length, 'parcels');
  } catch (err) {
    console.error('[WATCHLIST] Error saving:', err.message);
  }
}

/**
 * Add tracking number to watchlist
 */
async function addToWatchlist(trackingNumber, options = {}) {
  const watchlist = loadWatchlist();

  // Check if already exists
  const existing = watchlist.parcels.find(p => p.trackingNumber === trackingNumber);
  if (existing) {
    return {
      success: false,
      message: `พัสดุ ${trackingNumber} อยู่ใน watchlist แล้ว`,
      parcel: existing
    };
  }

  // Get initial tracking info
  let trackingInfo = null;
  try {
    trackingInfo = await parcelTracking.track(trackingNumber);
  } catch (err) {
    console.error('[WATCHLIST] Error getting tracking info:', err.message);
  }

  const parcel = {
    trackingNumber,
    description: options.description || null,
    addedAt: new Date().toISOString(),
    addedBy: options.userId || 'owner',
    lastStatus: trackingInfo?.status || 'unknown',
    lastLocation: trackingInfo?.lastLocation || null,
    lastUpdate: trackingInfo?.lastUpdate || null,
    carrier: trackingInfo?.carrier || options.carrier || null,
    notifyOnUpdate: options.notifyOnUpdate !== false,
    delivered: false
  };

  watchlist.parcels.push(parcel);
  saveWatchlist(watchlist);

  console.log('[WATCHLIST] Added:', trackingNumber);

  return {
    success: true,
    message: `เพิ่ม ${trackingNumber} เข้า watchlist แล้ว จะแจ้งเตือนเมื่อมีอัพเดท`,
    parcel
  };
}

/**
 * Remove tracking number from watchlist
 */
function removeFromWatchlist(trackingNumber) {
  const watchlist = loadWatchlist();

  const index = watchlist.parcels.findIndex(p => p.trackingNumber === trackingNumber);
  if (index === -1) {
    return {
      success: false,
      message: `ไม่พบ ${trackingNumber} ใน watchlist`
    };
  }

  const removed = watchlist.parcels.splice(index, 1)[0];
  saveWatchlist(watchlist);

  console.log('[WATCHLIST] Removed:', trackingNumber);

  return {
    success: true,
    message: `ลบ ${trackingNumber} ออกจาก watchlist แล้ว`,
    parcel: removed
  };
}

/**
 * Get all parcels in watchlist
 */
function getWatchlist() {
  return loadWatchlist().parcels;
}

/**
 * Get a specific parcel from watchlist
 */
function getParcel(trackingNumber) {
  const watchlist = loadWatchlist();
  return watchlist.parcels.find(p => p.trackingNumber === trackingNumber);
}

/**
 * Check if tracking number is in watchlist
 */
function isInWatchlist(trackingNumber) {
  const watchlist = loadWatchlist();
  return watchlist.parcels.some(p => p.trackingNumber === trackingNumber);
}

/**
 * Update parcel status (called by webhook)
 */
function updateParcelStatus(trackingNumber, status, location, event) {
  const watchlist = loadWatchlist();

  const parcel = watchlist.parcels.find(p => p.trackingNumber === trackingNumber);
  if (!parcel) {
    return { found: false };
  }

  const previousStatus = parcel.lastStatus;
  const statusChanged = previousStatus !== status;

  parcel.lastStatus = status;
  parcel.lastLocation = location;
  parcel.lastUpdate = new Date().toISOString();
  parcel.lastEvent = event;

  // Mark as delivered if status is delivered
  if (status === 'delivered') {
    parcel.delivered = true;
    parcel.deliveredAt = new Date().toISOString();
  }

  saveWatchlist(watchlist);

  return {
    found: true,
    parcel,
    statusChanged,
    previousStatus,
    shouldNotify: parcel.notifyOnUpdate && statusChanged
  };
}

/**
 * Clean up delivered parcels (optional - keep history)
 */
function cleanupDelivered() {
  const watchlist = loadWatchlist();
  const before = watchlist.parcels.length;

  watchlist.parcels = watchlist.parcels.filter(p => !p.delivered);
  saveWatchlist(watchlist);

  const removed = before - watchlist.parcels.length;
  console.log('[WATCHLIST] Cleaned up', removed, 'delivered parcels');

  return { removed };
}

/**
 * Get summary for Oracle context
 */
async function getWatchlistSummary() {
  const parcels = getWatchlist();

  if (parcels.length === 0) {
    return null;
  }

  let summary = `📦 **พัสดุที่กำลังติดตาม (${parcels.length} รายการ):**\n`;

  for (const p of parcels) {
    const statusTh = {
      'transit': 'กำลังจัดส่ง',
      'delivered': 'จัดส่งแล้ว ✅',
      'pending': 'รอดำเนินการ',
      'pickup': 'รับพัสดุแล้ว',
      'exception': 'มีปัญหา ❌'
    }[p.lastStatus] || p.lastStatus;

    summary += `\n• **${p.trackingNumber}**`;
    if (p.description) summary += ` (${p.description})`;
    summary += `\n  สถานะ: ${statusTh}`;
    if (p.lastLocation) summary += ` | ${p.lastLocation}`;
  }

  return summary;
}

/**
 * Refresh all parcels in watchlist (fetch latest status)
 */
async function refreshAllParcels() {
  const watchlist = loadWatchlist();
  const results = [];

  for (const parcel of watchlist.parcels) {
    if (parcel.delivered) continue;

    try {
      const info = await parcelTracking.track(parcel.trackingNumber);
      if (info.success) {
        const statusChanged = parcel.lastStatus !== info.status;

        parcel.lastStatus = info.status;
        parcel.lastLocation = info.lastLocation;
        parcel.lastUpdate = info.lastUpdate;
        parcel.carrier = info.carrier;

        if (info.status === 'delivered') {
          parcel.delivered = true;
          parcel.deliveredAt = new Date().toISOString();
        }

        results.push({
          trackingNumber: parcel.trackingNumber,
          statusChanged,
          newStatus: info.status,
          delivered: parcel.delivered
        });
      }
    } catch (err) {
      console.error('[WATCHLIST] Error refreshing', parcel.trackingNumber, err.message);
    }
  }

  saveWatchlist(watchlist);
  return results;
}

export default {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  getParcel,
  isInWatchlist,
  updateParcelStatus,
  cleanupDelivered,
  getWatchlistSummary,
  refreshAllParcels,
  loadWatchlist,
  saveWatchlist
};
