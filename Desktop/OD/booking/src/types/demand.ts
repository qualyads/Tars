export interface RoomPrice {
  name: string;
  displayPrice: number;
  bookingInput: number;
  netReceive: number;
}

export interface TrackedCompetitor {
  id: string;
  name: string;
  soldOut: boolean;
  price: number | null;
  reviewScore: number | null;
}

export interface DayDemand {
  date: string;
  dayOfWeek: string;
  totalHotels: number;
  soldOutCount: number;
  soldOutPercentage: number;
  availableCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  yourPrice: number | null;
  yourAvailable: boolean;
  yourRanking: number | null;
  competitors: CompetitorPrice[];
  trackedCompetitors?: TrackedCompetitor[];
  demandLevel: 'low' | 'medium' | 'high' | 'very_high';
  recommendedPrice: number;
  priceAdvice: string;
  recommendedPrices?: RoomPrice[];
}

export interface CompetitorPrice {
  hotel_id: number;
  hotel_name: string;
  price: number;
  review_score: number;
  soldOut: boolean;
  ranking?: number;
}

export interface DemandAnalysis {
  hotelId: string;
  hotelName: string;
  location: string;
  dateRange: {
    start: string;
    end: string;
  };
  days: DayDemand[];
  summary: {
    avgDemand: number;
    highDemandDays: string[];
    lowDemandDays: string[];
    suggestedMinPrice: number;
    suggestedMaxPrice: number;
  };
}
