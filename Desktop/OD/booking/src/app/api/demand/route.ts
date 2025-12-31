import { NextRequest, NextResponse } from 'next/server';
import type { DayDemand, DemandAnalysis, CompetitorPrice } from '@/types/demand';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'booking-com15.p.rapidapi.com';

const headers = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST,
};

const API_BASE = `https://${RAPIDAPI_HOST}/api/v1`;

const DAY_NAMES_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// Total hotels in Pai (from API data on a normal day)
const TOTAL_HOTELS_PAI = 220;

async function getHotelDetails(hotelId: string, arrivalDate: string, departureDate: string) {
  try {
    const params = new URLSearchParams({
      hotel_id: hotelId,
      arrival_date: arrivalDate,
      departure_date: departureDate,
      languagecode: 'en-us',
      currency_code: 'THB',
    });

    const response = await fetch(`${API_BASE}/hotels/getHotelDetails?${params.toString()}`, { headers });
    if (!response.ok) return null;

    const json = await response.json();
    if (!json.status || !json.data) return null;

    const data = json.data;
    const priceBreakdown = data.product_price_breakdown as {
      gross_amount?: { value?: number };
    } | undefined;

    return {
      name: data.hotel_name as string,
      price: priceBreakdown?.gross_amount?.value || null,
      soldOut: data.soldout === 1,
      available: data.available_rooms > 0,
    };
  } catch {
    return null;
  }
}

const YOUR_HOTEL_ID = 14973027; // The Arch Casa

// Known competitor hotels in Pai to track sold-out status
const TRACKED_COMPETITORS = [
  { id: '861136', name: 'Reverie Siam' },
  { id: '292822', name: 'Pai Village Boutique Resort' },
  { id: '246973', name: 'Belle Villa Resort Pai' },
  { id: '329192', name: 'Pai Vimaan Resort' },
  { id: '430770', name: 'Pai River Corner' },
  { id: '351598', name: 'The Oia Pai Resort' },
  { id: '353165', name: 'Pai Country Hut' },
];

interface TrackedCompetitorStatus {
  id: string;
  name: string;
  soldOut: boolean;
  price: number | null;
  reviewScore: number | null;
}

async function checkTrackedCompetitors(
  arrivalDate: string,
  departureDate: string
): Promise<TrackedCompetitorStatus[]> {
  const results: TrackedCompetitorStatus[] = [];

  for (const comp of TRACKED_COMPETITORS) {
    try {
      const details = await getHotelDetails(comp.id, arrivalDate, departureDate);

      if (details) {
        results.push({
          id: comp.id,
          name: details.name || comp.name,
          soldOut: details.soldOut || !details.available,
          price: details.price,
          reviewScore: null,
        });
      } else {
        results.push({
          id: comp.id,
          name: comp.name,
          soldOut: true, // Assume sold out if can't get details
          price: null,
          reviewScore: null,
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      results.push({
        id: comp.id,
        name: comp.name,
        soldOut: true,
        price: null,
        reviewScore: null,
      });
    }
  }

  return results;
}

async function searchHotelsForDay(
  destId: string,
  destType: string,
  arrivalDate: string,
  departureDate: string
): Promise<{ competitors: CompetitorPrice[]; availableCount: number; yourRanking: number | null; yourPrice: number | null }> {
  try {
    const allHotels: Array<{
      hotel_id: number;
      property: {
        name: string;
        reviewScore: number;
        priceBreakdown?: {
          grossPrice?: { value: number };
        };
        soldout?: number;
      };
    }> = [];

    let availableCount = 0;
    let yourRanking: number | null = null;
    let yourPrice: number | null = null;

    // Fetch 2 pages to get top 40 hotels
    for (let page = 1; page <= 2; page++) {
      const params = new URLSearchParams({
        dest_id: destId,
        search_type: destType,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        adults: '2',
        room_qty: '1',
        page_number: page.toString(),
        units: 'metric',
        temperature_unit: 'c',
        languagecode: 'en-us',
        currency_code: 'THB',
      });

      try {
        const response = await fetch(`${API_BASE}/hotels/searchHotels?${params.toString()}`, { headers });
        if (!response.ok) {
          console.log(`Page ${page} failed with status: ${response.status}`);
          continue;
        }

        const json = await response.json();
        if (!json.status || !json.data?.hotels) {
          console.log(`Page ${page} no data`);
          continue;
        }

        console.log(`Page ${page}: Got ${json.data.hotels.length} hotels`);

        // Get available count from meta on first page
        if (page === 1) {
          const meta = json.data.meta as Array<{ title?: string }> | undefined;
          if (meta && meta.length > 0) {
            const title = meta[0].title || '';
            const match = title.match(/(\d+)\s*properties/);
            if (match) {
              availableCount = parseInt(match[1], 10);
            }
          }
          if (availableCount === 0) {
            availableCount = json.data.hotels.length;
          }
        }

        allHotels.push(...json.data.hotels);
      } catch (err) {
        console.log(`Page ${page} error:`, err);
      }

      // Delay between pages to avoid rate limiting
      if (page < 2) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`Total hotels collected: ${allHotels.length}`);

    // Find your hotel in the results
    for (let i = 0; i < allHotels.length; i++) {
      if (allHotels[i].hotel_id === YOUR_HOTEL_ID) {
        yourRanking = i + 1;
        yourPrice = allHotels[i].property.priceBreakdown?.grossPrice?.value || null;
        break;
      }
    }

    const competitors: CompetitorPrice[] = allHotels.slice(0, 40).map((hotel, index) => ({
      hotel_id: hotel.hotel_id,
      hotel_name: hotel.property.name,
      price: hotel.property.priceBreakdown?.grossPrice?.value || 0,
      review_score: hotel.property.reviewScore || 0,
      soldOut: hotel.property.soldout === 1,
      ranking: index + 1,
    }));

    return {
      competitors,
      availableCount,
      yourRanking,
      yourPrice,
    };
  } catch {
    return { competitors: [], availableCount: 0, yourRanking: null, yourPrice: null };
  }
}

function calculateDemandLevel(soldOutPercentage: number): 'low' | 'medium' | 'high' | 'very_high' {
  if (soldOutPercentage >= 70) return 'very_high';
  if (soldOutPercentage >= 50) return 'high';
  if (soldOutPercentage >= 30) return 'medium';
  return 'low';
}

// Room types with base prices
const ROOM_TYPES = [
  { name: 'A01 Executive Suite บ้านญี่ปุ่น (มีอ่าง)', basePrice: 4100, tier: 'premium' },
  { name: 'A02 Studio Garden View กระจกสไลด์', basePrice: 2500, tier: 'mid' },
  { name: 'A03 Standard Studio ใต้บันได', basePrice: 2300, tier: 'value' },
  { name: 'A04 Suite Mountain View ห้องกลาง (มีอ่าง)', basePrice: 3500, tier: 'mid-high' },
  { name: 'A05 Deluxe Double w/Bath บ้านดำ', basePrice: 2900, tier: 'mid' },
  { name: 'A06 Suite Garden View อ่างเขียว', basePrice: 3500, tier: 'mid-high' },
  { name: 'B07 Superior Studio อ่างชั้น2ขวา', basePrice: 3200, tier: 'mid-high' },
  { name: 'B08 Studio Mountain View อ่างชั้น2ซ้าย', basePrice: 3800, tier: 'premium' },
  { name: 'B09 Studio Terrace ชั้น2 (ไม่มีอ่าง)', basePrice: 2600, tier: 'mid' },
  { name: 'C10 Deluxe King Studio ห้องแดง', basePrice: 2700, tier: 'mid' },
  { name: 'C11 Classic Quadruple คาวบอย', basePrice: 3200, tier: 'family' },
];

function calculatePriceMultiplier(demandLevel: string): number {
  switch (demandLevel) {
    case 'very_high': return 1.25;  // +25%
    case 'high': return 1.15;       // +15%
    case 'medium': return 1.0;      // normal
    case 'low': return 0.90;        // -10%
    default: return 1.0;
  }
}

function calculateRecommendedPrices(
  demandLevel: string,
  soldOutPercentage: number
): { rooms: Array<{ name: string; displayPrice: number; bookingInput: number; netReceive: number }>; advice: string } {
  const multiplier = calculatePriceMultiplier(demandLevel);

  const rooms = ROOM_TYPES.map(room => {
    const displayPrice = Math.round(room.basePrice * multiplier);
    const bookingInput = Math.round(displayPrice / 0.83); // For 17% commission
    const netReceive = Math.round(displayPrice * 0.83);
    return {
      name: room.name,
      displayPrice,
      bookingInput,
      netReceive,
    };
  });

  let advice = '';
  switch (demandLevel) {
    case 'very_high':
      advice = `🔥 Demand สูงมาก (${soldOutPercentage}% เต็ม)! ขึ้นราคา +25%`;
      break;
    case 'high':
      advice = `⚡ Demand สูง (${soldOutPercentage}% เต็ม) ขึ้นราคา +15%`;
      break;
    case 'medium':
      advice = `📊 Demand ปานกลาง (${soldOutPercentage}% เต็ม) ใช้ราคาปกติ`;
      break;
    case 'low':
      advice = `❄️ Demand ต่ำ (${soldOutPercentage}% เต็ม) ลดราคา -10%`;
      break;
  }

  return { rooms, advice };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hotelId = searchParams.get('hotel_id');
  const destId = searchParams.get('dest_id');
  const destType = searchParams.get('dest_type') || 'city';
  const location = searchParams.get('location') || '';
  const daysAhead = parseInt(searchParams.get('days') || '7');

  if (!hotelId || !destId) {
    return NextResponse.json(
      { error: 'hotel_id and dest_id are required' },
      { status: 400 }
    );
  }

  try {
    const today = new Date();
    // Start from today (no +1)
    const days: DayDemand[] = [];
    let hotelName = '';

    for (let i = 0; i < daysAhead; i++) {
      const checkIn = addDays(today, i);
      const checkOut = addDays(today, i + 1);
      const arrivalDate = formatDate(checkIn);
      const departureDate = formatDate(checkOut);

      // Get your hotel details for this day
      const yourHotel = await getHotelDetails(hotelId, arrivalDate, departureDate);
      if (i === 0 && yourHotel) {
        hotelName = yourHotel.name;
      }

      // Get competitors for this day
      const { competitors, availableCount, yourRanking, yourPrice: apiYourPrice } = await searchHotelsForDay(
        destId,
        destType,
        arrivalDate,
        departureDate
      );

      // Calculate statistics based on total hotels in Pai (220)
      const soldOutCount = TOTAL_HOTELS_PAI - availableCount;
      const prices = competitors.filter(c => c.price > 0).map(c => c.price);
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
      const soldOutPercentage = (soldOutCount / TOTAL_HOTELS_PAI) * 100;

      const demandLevel = calculateDemandLevel(soldOutPercentage);
      const recommendation = calculateRecommendedPrices(demandLevel, Math.round(soldOutPercentage));

      const dayOfWeek = DAY_NAMES_TH[checkIn.getDay()];

      // Check tracked competitors status (only for first day to save API calls)
      let trackedCompetitors: TrackedCompetitorStatus[] | undefined;
      if (i === 0) {
        trackedCompetitors = await checkTrackedCompetitors(arrivalDate, departureDate);
      }

      days.push({
        date: arrivalDate,
        dayOfWeek,
        totalHotels: TOTAL_HOTELS_PAI,
        soldOutCount,
        soldOutPercentage: Math.round(soldOutPercentage),
        availableCount,
        avgPrice: Math.round(avgPrice),
        minPrice: Math.round(minPrice),
        maxPrice: Math.round(maxPrice),
        yourPrice: apiYourPrice ? Math.round(apiYourPrice) : (yourHotel?.price ? Math.round(yourHotel.price) : null),
        yourAvailable: yourHotel?.available ?? true,
        yourRanking: yourRanking,
        competitors: competitors.slice(0, 40),
        trackedCompetitors,
        demandLevel,
        recommendedPrice: recommendation.rooms[0]?.displayPrice || 0,
        priceAdvice: recommendation.advice,
        recommendedPrices: recommendation.rooms,
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Calculate summary
    const avgDemand = days.reduce((acc, d) => acc + d.soldOutPercentage, 0) / days.length;
    const highDemandDays = days
      .filter(d => d.demandLevel === 'high' || d.demandLevel === 'very_high')
      .map(d => d.date);
    const lowDemandDays = days
      .filter(d => d.demandLevel === 'low')
      .map(d => d.date);
    const allPrices = days.flatMap(d => d.competitors.map(c => c.price)).filter(p => p > 0);
    const suggestedMinPrice = allPrices.length > 0 ? Math.round(Math.min(...allPrices) * 1.1) : 0;
    const suggestedMaxPrice = allPrices.length > 0 ? Math.round(Math.max(...allPrices) * 0.9) : 0;

    const analysis: DemandAnalysis = {
      hotelId,
      hotelName,
      location,
      dateRange: {
        start: days[0]?.date || '',
        end: days[days.length - 1]?.date || '',
      },
      days,
      summary: {
        avgDemand: Math.round(avgDemand),
        highDemandDays,
        lowDemandDays,
        suggestedMinPrice,
        suggestedMaxPrice,
      },
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing demand:', error);
    return NextResponse.json({ error: 'Failed to analyze demand' }, { status: 500 });
  }
}
