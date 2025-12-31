import { NextRequest, NextResponse } from 'next/server';
import {
  getHotelDetails,
  findHotelPosition,
  calculatePriceRanking,
  calculateReviewRanking,
} from '@/lib/booking-api';
import type { RankingData } from '@/types/booking';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hotelId = searchParams.get('hotel_id');
  const destId = searchParams.get('dest_id');
  const destType = searchParams.get('dest_type') || 'city';
  const checkinDate = searchParams.get('checkin_date');
  const checkoutDate = searchParams.get('checkout_date');

  if (!hotelId) {
    return NextResponse.json({ error: 'hotel_id is required' }, { status: 400 });
  }

  if (!destId || !checkinDate || !checkoutDate) {
    return NextResponse.json(
      { error: 'dest_id, checkin_date, and checkout_date are required' },
      { status: 400 }
    );
  }

  try {
    // Get hotel details (requires dates for booking-com15 API)
    const hotelDetails = await getHotelDetails(hotelId, checkinDate, checkoutDate);

    // Find position in search results
    const { position, competitors, totalCount } = await findHotelPosition(
      hotelId,
      destId,
      destType,
      checkinDate,
      checkoutDate
    );

    // Get your hotel's price and score from competitors list or hotel details
    const yourHotel = competitors.find(c => c.hotel_id.toString() === hotelId);
    const yourPrice = yourHotel?.price || hotelDetails?.price || 0;
    const yourReviewScore = yourHotel?.review_score || hotelDetails?.review_score || 0;

    // Calculate price ranking
    const priceRanking = calculatePriceRanking(yourPrice, competitors);

    // Calculate review ranking
    const reviewRanking = calculateReviewRanking(yourReviewScore, competitors);

    const rankingData: RankingData = {
      hotelDetails,
      searchPosition: {
        position,
        totalResults: totalCount,
        competitors: competitors.slice(0, 10),
      },
      reviewRanking: {
        score: yourReviewScore,
        word: hotelDetails?.review_score_word || 'N/A',
        numberOfReviews: hotelDetails?.review_nr || 0,
        rankInArea: reviewRanking.rank,
        totalHotelsInArea: reviewRanking.total,
      },
      priceComparison: {
        yourPrice,
        averagePrice: priceRanking.avg,
        minPrice: priceRanking.min,
        maxPrice: priceRanking.max,
        currency: 'THB',
        priceRank: priceRanking.rank,
        totalCompared: priceRanking.total,
      },
    };

    return NextResponse.json(rankingData);
  } catch (error) {
    console.error('Error getting ranking:', error);
    return NextResponse.json({ error: 'Failed to get ranking data' }, { status: 500 });
  }
}
