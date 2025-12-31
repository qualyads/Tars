export interface HotelDetails {
  hotel_id: number;
  name: string;
  address: string;
  city: string;
  country: string;
  review_score: number;
  review_score_word: string;
  review_nr: number;
  class: number;
  latitude: number;
  longitude: number;
  url: string;
  main_photo_url?: string;
  price?: number;
  currency?: string;
}

export interface SearchResult {
  hotel_id: number;
  hotel_name: string;
  position: number;
  review_score: number;
  price: number;
  currency: string;
}

export interface RankingData {
  hotelDetails: HotelDetails | null;
  searchPosition: {
    position: number | null;
    totalResults: number;
    competitors: SearchResult[];
  };
  reviewRanking: {
    score: number;
    word: string;
    numberOfReviews: number;
    rankInArea: number | null;
    totalHotelsInArea: number;
  };
  priceComparison: {
    yourPrice: number | null;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    currency: string;
    priceRank: number | null;
    totalCompared: number;
  };
}

export interface LocationSearchResult {
  dest_id: string;
  dest_type: string;
  name: string;
  label: string;
  city_name?: string;
  country?: string;
}
