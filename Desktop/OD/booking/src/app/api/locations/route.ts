import { NextRequest, NextResponse } from 'next/server';
import { searchLocations } from '@/lib/booking-api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  try {
    const locations = await searchLocations(query);
    console.log(`Location search for "${query}":`, JSON.stringify(locations, null, 2));
    return NextResponse.json(locations);
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return NextResponse.json(
        { error: 'API ถูก Rate Limit กรุณารอสักครู่แล้วลองใหม่', rateLimited: true },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Failed to search locations' }, { status: 500 });
  }
}
