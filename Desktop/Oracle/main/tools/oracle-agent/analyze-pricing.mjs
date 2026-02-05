import beds24 from './lib/beds24.js';

console.log('=== PRICING ANALYSIS - The Arch Casa ===\n');

// Force token refresh first
await beds24.forceRefreshToken();

// Get current bookings (these have the actual prices)
const bookings = await beds24.getAllActiveBookings();
console.log('Active bookings found:', bookings.length);

// Room mapping
const ROOM_MAP = {
  642555: 'A01', 642557: 'A02', 642556: 'A03', 642561: 'A04', 642553: 'A05',
  642560: 'A06', 642562: 'B07', 642558: 'B08', 642559: 'B09', 642552: 'C10', 642554: 'C11'
};

// Extract pricing data
const priceData = bookings.map(b => {
  const nights = Math.ceil((new Date(b.departure) - new Date(b.arrival)) / (1000*60*60*24));
  const price = parseFloat(b.price) || 0;
  return {
    arrival: b.arrival,
    departure: b.departure,
    roomId: b.roomSystemId || ROOM_MAP[b.roomId] || 'R' + b.roomId,
    price: price,
    nights: nights,
    pricePerNight: price && nights > 0 ? Math.round(price / nights) : 0,
    source: b.apiSource || b.referer || 'Direct',
    dayOfWeek: new Date(b.arrival).getDay(),
    month: new Date(b.arrival).getMonth() + 1,
    guestName: (b.firstName || '') + ' ' + (b.lastName || '')
  };
}).filter(b => b.pricePerNight > 500);

console.log('Bookings with valid price:', priceData.length);

if (priceData.length === 0) {
  console.log('\nNo bookings with price data. Showing raw data:');
  bookings.slice(0, 3).forEach(b => {
    console.log('- Room:', b.roomId, '| Price:', b.price, '| Arrival:', b.arrival);
  });
  process.exit(0);
}

// Group by room
const byRoom = {};
priceData.forEach(b => {
  if (!byRoom[b.roomId]) byRoom[b.roomId] = [];
  byRoom[b.roomId].push(b);
});

console.log('\n╔════════════════════════════════════════════╗');
console.log('║     ราคาเฉลี่ยต่อคืนแต่ละห้อง (จริง)      ║');
console.log('╠════════════════════════════════════════════╣');

const roomStats = {};
Object.entries(byRoom).sort((a,b) => a[0].localeCompare(b[0])).forEach(([room, bks]) => {
  const avgPrice = Math.round(bks.reduce((sum, b) => sum + b.pricePerNight, 0) / bks.length);
  const minPrice = Math.min(...bks.map(b => b.pricePerNight));
  const maxPrice = Math.max(...bks.map(b => b.pricePerNight));
  roomStats[room] = { avg: avgPrice, min: minPrice, max: maxPrice, count: bks.length };
  console.log(`║ ${room}: ${avgPrice.toLocaleString().padStart(5)} THB | ${minPrice.toLocaleString()}-${maxPrice.toLocaleString()} | ${bks.length} bookings`.padEnd(43) + '║');
});
console.log('╚════════════════════════════════════════════╝');

// Overall stats
const overallAvg = Math.round(priceData.reduce((sum, b) => sum + b.pricePerNight, 0) / priceData.length);
console.log(`\nราคาเฉลี่ยรวม: ${overallAvg.toLocaleString()} THB/night`);

// Day of week analysis
const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const byDay = [[], [], [], [], [], [], []];
priceData.forEach(b => byDay[b.dayOfWeek].push(b.pricePerNight));

console.log('\n╔════════════════════════════════════════════╗');
console.log('║         ราคาเฉลี่ยตามวันในสัปดาห์          ║');
console.log('╠════════════════════════════════════════════╣');
byDay.forEach((prices, i) => {
  if (prices.length > 0) {
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const bar = '█'.repeat(Math.round(avg / 200));
    console.log(`║ ${dayNames[i].padEnd(2)}: ${avg.toLocaleString().padStart(5)} THB ${bar.padEnd(20)} ║`);
  }
});
console.log('╚════════════════════════════════════════════╝');

// Recent bookings detail
console.log('\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║                    Recent Bookings Detail                          ║');
console.log('╠════════════════════════════════════════════════════════════════════╣');
const sorted = [...priceData].sort((a, b) => new Date(b.arrival) - new Date(a.arrival));
sorted.slice(0, 10).forEach(b => {
  const line = `${b.roomId} | ${b.arrival} | ${b.nights}N | ${b.pricePerNight.toLocaleString()}/N | ${b.source}`;
  console.log('║ ' + line.padEnd(66) + '║');
});
console.log('╚════════════════════════════════════════════════════════════════════╝');

// PRICING RECOMMENDATIONS
console.log('\n');
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║           🎯 RECOMMENDED PRICES (Data-Driven)                      ║');
console.log('╠════════════════════════════════════════════════════════════════════╣');

Object.entries(roomStats).sort((a,b) => a[0].localeCompare(b[0])).forEach(([room, stats]) => {
  const reg = stats.avg;
  const high = Math.round(stats.avg * 1.2);
  const low = Math.round(stats.avg * 0.8);
  const lastMin = Math.round(stats.avg * 0.65);

  console.log('║'.padEnd(68) + '║');
  console.log(`║ ${room}: `.padEnd(68) + '║');
  console.log(`║   Regular (ปกติ):     ${reg.toLocaleString().padStart(5)} THB `.padEnd(68) + '║');
  console.log(`║   High Season (+20%): ${high.toLocaleString().padStart(5)} THB `.padEnd(68) + '║');
  console.log(`║   Low Season (-20%):  ${low.toLocaleString().padStart(5)} THB `.padEnd(68) + '║');
  console.log(`║   Last Min (<3d):     ${lastMin.toLocaleString().padStart(5)} THB (-35%) `.padEnd(68) + '║');
});
console.log('╚════════════════════════════════════════════════════════════════════╝');

// Specific strategy for Feb 9-20
console.log('\n');
console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║     🚨 EMERGENCY PRICING: 9-20 ก.พ. (Occupancy < 20%)              ║');
console.log('╠════════════════════════════════════════════════════════════════════╣');
console.log('║                                                                    ║');
console.log('║  ราคาแนะนำเพื่อเพิ่ม Occupancy (ลด 35-40% จากปกติ):                 ║');
console.log('║                                                                    ║');

Object.entries(roomStats).sort((a,b) => a[0].localeCompare(b[0])).forEach(([room, stats]) => {
  const emergency = Math.round(stats.avg * 0.6);
  console.log(`║   ${room}: ${emergency.toLocaleString().padStart(5)} THB/night `.padEnd(68) + '║');
});

console.log('║                                                                    ║');
console.log('║  💡 Tips:                                                          ║');
console.log('║   - Direct booking ลด commission 15-18%                            ║');
console.log('║   - Package รวมอาหารเช้า +150-200 THB                              ║');
console.log('║   - Minimum stay 2 nights                                          ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
