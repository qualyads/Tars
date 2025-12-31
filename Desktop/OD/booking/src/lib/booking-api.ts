import type { HotelDetails, SearchResult, LocationSearchResult } from '@/types/booking';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY!;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'booking-com15.p.rapidapi.com';

const headers = {
  'x-rapidapi-key': RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST,
};

// API base URL for booking-com15
const API_BASE = `https://${RAPIDAPI_HOST}/api/v1`;

interface ApiResponse<T> {
  status: boolean;
  message: string;
  timestamp: number;
  data: T;
}

export async function getHotelDetails(
  hotelId: string,
  arrivalDate: string,
  departureDate: string
): Promise<HotelDetails | null> {
  try {
    const params = new URLSearchParams({
      hotel_id: hotelId,
      arrival_date: arrivalDate,
      departure_date: departureDate,
      languagecode: 'en-us',
      currency_code: 'THB',
    });

    const response = await fetch(
      `${API_BASE}/hotels/getHotelDetails?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      console.error('Failed to fetch hotel details:', response.statusText);
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      return null;
    }

    const json: ApiResponse<Record<string, unknown>> = await response.json();

    if (!json.status || !json.data) {
      return null;
    }

    const data = json.data;

    // Get photo from property_highlight_strip or photos array
    let mainPhoto = '';
    if (data.property_highlight_strip) {
      const highlights = data.property_highlight_strip as Array<{ icon_url?: string }>;
      if (highlights[0]?.icon_url) {
        mainPhoto = highlights[0].icon_url;
      }
    }

    // Get price from product_price_breakdown
    let price = 0;
    let currency = 'THB';
    if (data.product_price_breakdown) {
      const priceBreakdown = data.product_price_breakdown as {
        gross_amount?: { value?: number; currency?: string };
      };
      price = priceBreakdown.gross_amount?.value || 0;
      currency = priceBreakdown.gross_amount?.currency || 'THB';
    }

    return {
      hotel_id: Number(hotelId),
      name: (data.hotel_name as string) || '',
      address: (data.address as string) || '',
      city: (data.city_trans as string) || (data.city as string) || '',
      country: (data.country_trans as string) || '',
      review_score: (data.review_score as number) || 0,
      review_score_word: (data.review_score_word as string) || '',
      review_nr: (data.review_nr as number) || 0,
      class: (data.class as number) || (data.propertyClass as number) || 0,
      latitude: (data.latitude as number) || 0,
      longitude: (data.longitude as number) || 0,
      url: (data.url as string) || '',
      main_photo_url: mainPhoto,
      price,
      currency,
    };
  } catch (error) {
    console.error('Error fetching hotel details:', error);
    return null;
  }
}

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  try {
    const response = await fetch(
      `${API_BASE}/hotels/searchDestination?query=${encodeURIComponent(query)}`,
      { headers }
    );

    if (!response.ok) {
      console.error('Location search failed:', response.status, response.statusText);
      if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      return [];
    }

    const json = await response.json();
    console.log('Raw location API response:', JSON.stringify(json, null, 2));

    if (!json.status || !json.data) {
      console.error('Location API returned status=false or no data');
      return [];
    }

    return json.data.map((item: Record<string, unknown>) => ({
      dest_id: String(item.dest_id),
      dest_type: (item.dest_type as string) || (item.search_type as string) || 'city',
      name: (item.name as string) || '',
      label: (item.label as string) || '',
      city_name: item.city_name as string | undefined,
      country: item.country as string | undefined,
    }));
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
}

interface HotelSearchData {
  hotels: Array<{
    hotel_id: number;
    property: {
      name: string;
      reviewScore: number;
      reviewCount: number;
      priceBreakdown: {
        grossPrice: {
          value: number;
          currency: string;
        };
      };
      rankingPosition: number;
      photoUrls?: string[];
    };
  }>;
  meta?: {
    title?: string;
  };
}

export async function searchHotels(
  destId: string,
  destType: string,
  checkinDate: string,
  checkoutDate: string,
  adults: number = 2,
  roomQty: number = 1,
  pageNumber: number = 1
): Promise<{ results: SearchResult[]; totalCount: number }> {
  try {
    const params = new URLSearchParams({
      dest_id: destId,
      search_type: destType,
      arrival_date: checkinDate,
      departure_date: checkoutDate,
      adults: adults.toString(),
      room_qty: roomQty.toString(),
      page_number: pageNumber.toString(),
      units: 'metric',
      temperature_unit: 'c',
      languagecode: 'en-us',
      currency_code: 'THB',
    });

    const response = await fetch(
      `${API_BASE}/hotels/searchHotels?${params.toString()}`,
      { headers }
    );

    if (!response.ok) {
      console.error('Failed to search hotels:', response.statusText);
      return { results: [], totalCount: 0 };
    }

    const json: ApiResponse<HotelSearchData> = await response.json();

    if (!json.status || !json.data?.hotels) {
      return { results: [], totalCount: 0 };
    }

    const results: SearchResult[] = json.data.hotels.map((hotel, index) => ({
      hotel_id: hotel.hotel_id,
      hotel_name: hotel.property.name,
      position: (pageNumber - 1) * 20 + index + 1,
      review_score: hotel.property.reviewScore || 0,
      price: hotel.property.priceBreakdown?.grossPrice?.value || 0,
      currency: hotel.property.priceBreakdown?.grossPrice?.currency || 'THB',
    }));

    return {
      results,
      totalCount: json.data.hotels.length > 0 ? 1000 : 0, // API doesn't return total count
    };
  } catch (error) {
    console.error('Error searching hotels:', error);
    return { results: [], totalCount: 0 };
  }
}

export async function findHotelPosition(
  hotelId: string,
  destId: string,
  destType: string,
  checkinDate: string,
  checkoutDate: string,
  maxPages: number = 5
): Promise<{ position: number | null; competitors: SearchResult[]; totalCount: number }> {
  const allResults: SearchResult[] = [];
  let foundPosition: number | null = null;
  let totalCount = 0;

  for (let page = 1; page <= maxPages; page++) {
    const { results, totalCount: count } = await searchHotels(
      destId,
      destType,
      checkinDate,
      checkoutDate,
      2,
      1,
      page
    );

    totalCount = count;

    if (results.length === 0) break;

    allResults.push(...results);

    const found = results.find(r => r.hotel_id.toString() === hotelId);
    if (found) {
      foundPosition = found.position;
      break;
    }
  }

  return {
    position: foundPosition,
    competitors: allResults.slice(0, 20),
    totalCount: allResults.length,
  };
}

export function calculatePriceRanking(
  yourPrice: number,
  competitors: SearchResult[]
): { rank: number; total: number; avg: number; min: number; max: number } {
  const prices = competitors.map(c => c.price).filter(p => p > 0);

  if (prices.length === 0) {
    return { rank: 0, total: 0, avg: 0, min: 0, max: 0 };
  }

  const sortedPrices = [...prices].sort((a, b) => a - b);
  const rank = sortedPrices.filter(p => p < yourPrice).length + 1;

  return {
    rank,
    total: prices.length,
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

export function calculateReviewRanking(
  yourScore: number,
  competitors: SearchResult[]
): { rank: number; total: number } {
  const scores = competitors.map(c => c.review_score).filter(s => s > 0);

  if (scores.length === 0) {
    return { rank: 0, total: 0 };
  }

  const rank = scores.filter(s => s > yourScore).length + 1;

  return { rank, total: scores.length };
}
