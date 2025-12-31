import { NextRequest, NextResponse } from 'next/server';
import { getHotelDetails } from '@/lib/booking-api';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const hotelId = searchParams.get('hotel_id');

  // Default to tomorrow and day after
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const arrivalDate = searchParams.get('arrival_date') || formatDate(tomorrow);
  const departureDate = searchParams.get('departure_date') || formatDate(dayAfter);

  if (!hotelId) {
    return NextResponse.json({ error: 'hotel_id is required' }, { status: 400 });
  }

  const details = await getHotelDetails(hotelId, arrivalDate, departureDate);

  if (!details) {
    return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
  }

  return NextResponse.json(details);
}
