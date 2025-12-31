'use client';

import type { SearchResult } from '@/types/booking';

interface SearchPositionCardProps {
  position: number | null;
  totalResults: number;
  competitors: SearchResult[];
  hotelId: string;
}

export default function SearchPositionCard({
  position,
  totalResults,
  competitors,
  hotelId,
}: SearchPositionCardProps) {
  const getPositionColor = (pos: number | null) => {
    if (pos === null) return 'text-gray-500';
    if (pos <= 3) return 'text-green-600';
    if (pos <= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPositionBadge = (pos: number | null) => {
    if (pos === null) return 'bg-gray-100';
    if (pos <= 3) return 'bg-green-100';
    if (pos <= 10) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getPositionText = (pos: number | null) => {
    if (pos === null) return 'ไม่พบ';
    if (pos <= 3) return 'ดีเยี่ยม!';
    if (pos <= 10) return 'ดีมาก';
    if (pos <= 30) return 'ปานกลาง';
    return 'ควรปรับปรุง';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">อันดับในผลค้นหา</h2>
        <span className="text-sm text-gray-500">เรียงตามความนิยม</span>
      </div>

      <div className="flex items-center justify-center mb-6">
        <div className={`${getPositionBadge(position)} rounded-full p-8`}>
          <div className="text-center">
            <div className={`text-5xl font-bold ${getPositionColor(position)}`}>
              {position !== null ? `#${position}` : 'N/A'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              จาก {totalResults} ที่พัก
            </div>
            <div className={`text-sm font-medium mt-1 ${getPositionColor(position)}`}>
              {getPositionText(position)}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-gray-700 mb-3">คู่แข่ง Top 10</h3>
        {competitors.slice(0, 10).map((hotel, index) => (
          <div
            key={hotel.hotel_id}
            className={`flex items-center justify-between p-3 rounded-lg ${
              hotel.hotel_id.toString() === hotelId
                ? 'bg-blue-100 border-2 border-blue-500'
                : 'bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-600 w-8">
                #{index + 1}
              </span>
              <div>
                <div className="font-medium text-gray-800 truncate max-w-[200px]">
                  {hotel.hotel_name}
                  {hotel.hotel_id.toString() === hotelId && (
                    <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                      ที่พักของคุณ
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  คะแนน: {hotel.review_score.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-800">
                {hotel.price.toLocaleString()} {hotel.currency}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
