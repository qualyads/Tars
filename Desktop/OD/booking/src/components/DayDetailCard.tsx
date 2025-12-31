'use client';

import type { DayDemand } from '@/types/demand';

interface DayDetailCardProps {
  day: DayDemand;
}

export default function DayDetailCard({ day }: DayDetailCardProps) {
  const getDemandColor = (level: string) => {
    switch (level) {
      case 'very_high':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getDemandText = (level: string) => {
    switch (level) {
      case 'very_high':
        return 'Demand สูงมาก!';
      case 'high':
        return 'Demand สูง';
      case 'medium':
        return 'Demand ปานกลาง';
      case 'low':
        return 'Demand ต่ำ';
      default:
        return '-';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          📊 รายละเอียดวันที่ {formatDate(day.date)}
        </h2>
        <span className={`px-3 py-1 rounded-full font-medium ${getDemandColor(day.demandLevel)}`}>
          {getDemandText(day.demandLevel)}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{day.soldOutPercentage}%</div>
          <div className="text-sm text-gray-500">ที่พักเต็ม</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{day.avgPrice.toLocaleString()}฿</div>
          <div className="text-sm text-gray-500">ราคาเฉลี่ย</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{day.minPrice.toLocaleString()}฿</div>
          <div className="text-sm text-gray-500">ราคาต่ำสุด</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{day.maxPrice.toLocaleString()}฿</div>
          <div className="text-sm text-gray-500">ราคาสูงสุด</div>
        </div>
      </div>

      {/* Your Price vs Recommended */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-700 mb-3">💡 คำแนะนำราคา</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">ราคาของคุณ</div>
            <div className="text-2xl font-bold text-blue-600">
              {day.yourPrice ? `${day.yourPrice.toLocaleString()}฿` : 'ไม่ทราบ'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">ราคาแนะนำ</div>
            <div className="text-2xl font-bold text-purple-600">
              {day.recommendedPrice.toLocaleString()}฿
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-white rounded-lg">
          <p className="text-sm text-gray-700">{day.priceAdvice}</p>
          {day.yourPrice && (
            <p className="mt-2 text-sm font-medium">
              {day.yourPrice > day.recommendedPrice ? (
                <span className="text-orange-600">
                  ⚠️ ราคาของคุณสูงกว่าที่แนะนำ {(day.yourPrice - day.recommendedPrice).toLocaleString()}฿
                </span>
              ) : day.yourPrice < day.recommendedPrice ? (
                <span className="text-green-600">
                  ✓ คุณสามารถขึ้นราคาได้อีก {(day.recommendedPrice - day.yourPrice).toLocaleString()}฿
                </span>
              ) : (
                <span className="text-blue-600">✓ ราคาของคุณเหมาะสมแล้ว</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Competitors */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3">🏨 คู่แข่ง Top 10 ในวันนี้</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {day.competitors.map((comp, index) => (
            <div
              key={comp.hotel_id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                comp.soldOut ? 'bg-red-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-500 w-6">#{index + 1}</span>
                <div>
                  <div className="font-medium text-gray-800 truncate max-w-[200px]">
                    {comp.hotel_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    คะแนน: {comp.review_score.toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {comp.soldOut ? (
                  <span className="px-2 py-1 bg-red-500 text-white text-xs rounded">เต็ม</span>
                ) : (
                  <div className="font-bold text-gray-800">
                    {comp.price.toLocaleString()}฿
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
