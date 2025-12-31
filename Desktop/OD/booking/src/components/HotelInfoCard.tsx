'use client';

import type { HotelDetails } from '@/types/booking';

interface HotelInfoCardProps {
  hotel: HotelDetails;
}

export default function HotelInfoCard({ hotel }: HotelInfoCardProps) {
  const getStarRating = (stars: number) => {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
      <div className="flex items-start gap-4">
        {hotel.main_photo_url && (
          <img
            src={hotel.main_photo_url}
            alt={hotel.name}
            className="w-24 h-24 rounded-lg object-cover"
          />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">{hotel.name}</h1>
          {hotel.class > 0 && (
            <div className="text-yellow-300 text-lg mb-2">
              {getStarRating(hotel.class)}
            </div>
          )}
          <div className="text-blue-100 text-sm">
            {hotel.address}
          </div>
          <div className="text-blue-200 text-sm mt-1">
            {hotel.city}, {hotel.country}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-blue-500">
        <div className="text-center">
          <div className="text-3xl font-bold">
            {hotel.review_score > 0 ? hotel.review_score.toFixed(1) : 'N/A'}
          </div>
          <div className="text-sm text-blue-200">
            {hotel.review_score_word || 'คะแนนรีวิว'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{hotel.review_nr.toLocaleString()}</div>
          <div className="text-sm text-blue-200">รีวิวทั้งหมด</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">
            {hotel.price ? `${hotel.price.toLocaleString()}` : 'N/A'}
          </div>
          <div className="text-sm text-blue-200">ราคา/คืน ({hotel.currency || 'THB'})</div>
        </div>
      </div>
    </div>
  );
}
