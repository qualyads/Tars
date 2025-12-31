import { NextRequest, NextResponse } from 'next/server';
import { getHotelDetails } from '@/lib/booking-api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hotelId = searchParams.get('hotel_id');
  const arrivalDate = searchParams.get('arrival_date');
  const departureDate = searchParams.get('departure_date');

  if (!hotelId || !arrivalDate || !departureDate) {
    return NextResponse.json(
      { error: 'hotel_id, arrival_date, and departure_date are required' },
      { status: 400 }
    );
  }

  try {
    const hotelDetails = await getHotelDetails(hotelId, arrivalDate, departureDate);

    if (!hotelDetails) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    return NextResponse.json(hotelDetails);
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'API ถูก Rate Limit กรุณารอสักครู่แล้วลองใหม่', rateLimited: true },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Failed to fetch hotel details' }, { status: 500 });
  }
}
