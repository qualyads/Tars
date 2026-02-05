/**
 * Parcel Tracking Module
 * รองรับ KEX Express, Thailand Post, Flash Express และอื่นๆ
 *
 * ใช้ AfterShip API (Free tier: 100 tracking/month)
 * หรือ TrackingMore API (Free tier: 100 tracking/month)
 *
 * @version 1.0.0
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const config = require('../config.json');

// Carrier detection patterns -> TrackingMore courier_code
const CARRIER_PATTERNS = {
  'kerry-logistics': /^(SOE|THKE|KEX|KE)[A-Z0-9]+$/i,  // KEX Express Thailand
  'thailand-post': /^(E[A-Z]\d{9}TH|R[A-Z]\d{9}TH|C[A-Z]\d{9}TH|P[A-Z]\d{9}TH|\d{13})$/i,
  'flash-express': /^(TH\d{13}[A-Z]|FL\d+)$/i,
  'j-t-express': /^(TH\d{13}[A-Z]?|JT\d+)$/i,
  'shopee-express-th': /^(SPXTH\d+|TH\d{14})$/i,
  'lazada-lex-th': /^(LEX|LZD)[A-Z0-9]+$/i,
  'dhl': /^\d{10,22}$/,
  'fedex': /^\d{12,22}$/
};

// AfterShip slug mapping
const AFTERSHIP_SLUGS = {
  'kex-express': 'kex-express',
  'thailand-post': 'thailand-post',
  'flash-express': 'flash-express',
  'j-t-express': 'j-t-express-th',
  'shopee-express': 'shopee-express-th',
  'lazada-express': 'lazada-express',
  'dhl': 'dhl',
  'fedex': 'fedex'
};

// Status translations
const STATUS_TH = {
  'InfoReceived': 'รับข้อมูลแล้ว',
  'InTransit': 'กำลังจัดส่ง',
  'OutForDelivery': 'กำลังนำจ่าย',
  'AttemptFail': 'นำจ่ายไม่สำเร็จ',
  'Delivered': 'จัดส่งแล้ว',
  'AvailableForPickup': 'รอรับที่จุดบริการ',
  'Exception': 'มีปัญหา',
  'Expired': 'หมดอายุ',
  'Pending': 'รอดำเนินการ'
};

/**
 * Detect carrier from tracking number
 */
function detectCarrier(trackingNumber) {
  const normalized = trackingNumber.trim().toUpperCase();

  for (const [carrier, pattern] of Object.entries(CARRIER_PATTERNS)) {
    if (pattern.test(normalized)) {
      return carrier;
    }
  }

  return null;
}

/**
 * Track parcel using AfterShip API
 */
async function trackWithAfterShip(trackingNumber, carrier = null) {
  const apiKey = config.apis?.aftership_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'AfterShip API key not configured',
      hint: 'Get free API key at https://www.aftership.com/signup'
    };
  }

  const detectedCarrier = carrier || detectCarrier(trackingNumber);
  const slug = detectedCarrier ? AFTERSHIP_SLUGS[detectedCarrier] : null;

  try {
    // First, create tracking (if not exists)
    const createRes = await fetch('https://api.aftership.com/v4/trackings', {
      method: 'POST',
      headers: {
        'aftership-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tracking: {
          tracking_number: trackingNumber,
          slug: slug
        }
      })
    });

    // Then get tracking info
    const url = slug
      ? `https://api.aftership.com/v4/trackings/${slug}/${trackingNumber}`
      : `https://api.aftership.com/v4/trackings/${trackingNumber}`;

    const response = await fetch(url, {
      headers: {
        'aftership-api-key': apiKey
      }
    });

    const data = await response.json();

    if (data.meta?.code !== 200) {
      return {
        success: false,
        error: data.meta?.message || 'Unknown error',
        code: data.meta?.code
      };
    }

    const tracking = data.data?.tracking;

    return {
      success: true,
      trackingNumber: tracking.tracking_number,
      carrier: tracking.slug,
      carrierName: tracking.courier_name,
      status: tracking.tag,
      statusTh: STATUS_TH[tracking.tag] || tracking.tag,
      lastUpdate: tracking.last_checkpoint?.checkpoint_time,
      lastLocation: tracking.last_checkpoint?.location,
      lastMessage: tracking.last_checkpoint?.message,
      origin: tracking.origin_country_iso3,
      destination: tracking.destination_country_iso3,
      deliveredAt: tracking.delivered_at,
      expectedDelivery: tracking.expected_delivery,
      checkpoints: (tracking.checkpoints || []).map(cp => ({
        time: cp.checkpoint_time,
        location: cp.location,
        message: cp.message,
        status: cp.tag
      }))
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Track parcel using TrackingMore API
 */
async function trackWithTrackingMore(trackingNumber, carrier = null) {
  const apiKey = config.apis?.trackingmore_key;

  if (!apiKey) {
    return {
      success: false,
      error: 'TrackingMore API key not configured',
      hint: 'Get free API key at https://www.trackingmore.com/signup'
    };
  }

  const detectedCarrier = carrier || detectCarrier(trackingNumber);

  try {
    const response = await fetch('https://api.trackingmore.com/v4/trackings/create', {
      method: 'POST',
      headers: {
        'Tracking-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        courier_code: detectedCarrier || 'auto'
      })
    });

    const data = await response.json();

    // 4101 = tracking already exists (ok to continue), 4120 = invalid courier
    if (data.meta?.code !== 200 && data.meta?.code !== 4101) {
      // If invalid courier, still try to get existing tracking
      if (data.meta?.code !== 4120) {
        return {
          success: false,
          error: data.meta?.message || 'Unknown error'
        };
      }
    }

    // Get tracking details
    const getRes = await fetch(`https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${trackingNumber}`, {
      headers: {
        'Tracking-Api-Key': apiKey
      }
    });

    const getData = await getRes.json();
    const tracking = getData.data?.[0];

    if (!tracking) {
      return {
        success: false,
        error: 'Tracking not found'
      };
    }

    return {
      success: true,
      trackingNumber: tracking.tracking_number,
      carrier: tracking.courier_code,
      carrierName: tracking.courier_name,
      status: tracking.delivery_status,
      statusTh: STATUS_TH[tracking.delivery_status] || tracking.delivery_status,
      lastUpdate: tracking.latest_checkpoint_time,
      lastLocation: tracking.latest_event?.location,
      lastMessage: tracking.latest_event?.description,
      checkpoints: (tracking.origin_info?.trackinfo || []).map(cp => ({
        time: cp.Date,
        location: cp.Details,
        message: cp.StatusDescription
      }))
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Track parcel (auto-select provider)
 */
async function track(trackingNumber) {
  // Try TrackingMore first (we have API key)
  if (config.apis?.trackingmore_key) {
    const result = await trackWithTrackingMore(trackingNumber);
    if (result.success) return result;
  }

  // Fallback to AfterShip
  if (config.apis?.aftership_key) {
    const result = await trackWithAfterShip(trackingNumber);
    if (result.success) return result;
  }

  return {
    success: false,
    error: 'No tracking API configured',
    hint: 'Add aftership_key or trackingmore_key to config.json apis section'
  };
}

/**
 * Generate tracking summary for Oracle responses
 */
async function getTrackingSummary(trackingNumber) {
  const result = await track(trackingNumber);

  if (!result.success) {
    return `❌ ไม่สามารถเช็คพัสดุ ${trackingNumber} ได้\n${result.error}${result.hint ? `\n💡 ${result.hint}` : ''}`;
  }

  let summary = `📦 **พัสดุ: ${result.trackingNumber}**\n`;
  summary += `🚚 ขนส่ง: ${result.carrierName || result.carrier}\n`;
  summary += `📍 สถานะ: ${result.statusTh}\n`;

  if (result.lastUpdate) {
    const lastDate = new Date(result.lastUpdate);
    summary += `🕐 อัพเดทล่าสุด: ${lastDate.toLocaleString('th-TH')}\n`;
  }

  if (result.lastLocation) {
    summary += `📍 ตำแหน่ง: ${result.lastLocation}\n`;
  }

  if (result.lastMessage) {
    summary += `💬 ${result.lastMessage}\n`;
  }

  if (result.expectedDelivery) {
    summary += `⏰ คาดว่าจะถึง: ${new Date(result.expectedDelivery).toLocaleDateString('th-TH')}\n`;
  }

  if (result.deliveredAt) {
    summary += `✅ จัดส่งเมื่อ: ${new Date(result.deliveredAt).toLocaleString('th-TH')}\n`;
  }

  // Show last 3 checkpoints
  if (result.checkpoints && result.checkpoints.length > 0) {
    summary += `\n**ประวัติการจัดส่ง:**\n`;
    result.checkpoints.slice(0, 3).forEach(cp => {
      const time = cp.time ? new Date(cp.time).toLocaleString('th-TH') : '';
      summary += `• ${time}: ${cp.message || cp.location}\n`;
    });
  }

  return summary;
}

export default {
  track,
  trackWithAfterShip,
  trackWithTrackingMore,
  detectCarrier,
  getTrackingSummary,
  CARRIER_PATTERNS,
  STATUS_TH
};
