'use client';

import type { RankingData } from '@/types/booking';

interface SummaryCardProps {
  data: RankingData;
}

export default function SummaryCard({ data }: SummaryCardProps) {
  const { hotelDetails, searchPosition, reviewRanking, priceComparison } = data;

  const getPriceStatus = () => {
    if (!priceComparison.yourPrice || !priceComparison.averagePrice) return '';
    const diff = priceComparison.yourPrice - priceComparison.averagePrice;
    if (diff > 0) return `(สูงกว่าค่าเฉลี่ย ${Math.round(diff).toLocaleString()} บาท)`;
    if (diff < 0) return `(ต่ำกว่าค่าเฉลี่ย ${Math.round(Math.abs(diff)).toLocaleString()} บาท)`;
    return '(เท่ากับค่าเฉลี่ย)';
  };

  const getPositionStatus = () => {
    if (!searchPosition.position) return 'ไม่พบในผลค้นหา';
    if (searchPosition.position <= 10) return 'ดีมาก';
    if (searchPosition.position <= 30) return 'ดี';
    if (searchPosition.position <= 50) return 'ปานกลาง';
    return 'ควรปรับปรุง';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-2xl">📊</span> สรุปภาพรวม
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-600 w-1/3">ชื่อที่พัก</td>
              <td className="py-3 px-4 text-gray-900 font-semibold">
                {hotelDetails?.name || 'ไม่ทราบ'}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-600">ที่ตั้ง</td>
              <td className="py-3 px-4 text-gray-900">
                {hotelDetails?.city}, {hotelDetails?.country}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-600">อันดับในผลค้นหา</td>
              <td className="py-3 px-4">
                <span className={`font-bold text-lg ${
                  searchPosition.position && searchPosition.position <= 10
                    ? 'text-green-600'
                    : searchPosition.position && searchPosition.position <= 30
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  #{searchPosition.position || 'N/A'}
                </span>
                <span className="text-gray-500 ml-2">
                  จาก {searchPosition.totalResults} ที่พัก ({getPositionStatus()})
                </span>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-600">ราคาของคุณ</td>
              <td className="py-3 px-4">
                <span className="font-bold text-lg text-blue-600">
                  {priceComparison.yourPrice
                    ? `${priceComparison.yourPrice.toLocaleString()} ${priceComparison.currency}`
                    : 'ไม่ทราบ'}
                </span>
                <span className="text-gray-500 ml-2">{getPriceStatus()}</span>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-600">อันดับราคา</td>
              <td className="py-3 px-4">
                <span className={`font-bold ${
                  priceComparison.priceRank && priceComparison.priceRank <= 5
                    ? 'text-green-600'
                    : 'text-orange-600'
                }`}>
                  #{priceComparison.priceRank || 'N/A'}
                </span>
                <span className="text-gray-500 ml-2">
                  จาก {priceComparison.totalCompared} ที่พัก
                  {priceComparison.priceRank && priceComparison.priceRank > priceComparison.totalCompared / 2
                    ? ' (แพงกว่าค่าเฉลี่ย)'
                    : ' (ถูกกว่าค่าเฉลี่ย)'}
                </span>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-600">คะแนนรีวิว</td>
              <td className="py-3 px-4">
                <span className={`font-bold text-lg ${
                  reviewRanking.score >= 8 ? 'text-green-600'
                    : reviewRanking.score >= 7 ? 'text-yellow-600'
                    : reviewRanking.score > 0 ? 'text-red-600'
                    : 'text-gray-500'
                }`}>
                  {reviewRanking.score > 0 ? reviewRanking.score.toFixed(1) : 'ยังไม่มี'}
                </span>
                <span className="text-gray-500 ml-2">
                  ({reviewRanking.numberOfReviews.toLocaleString()} รีวิว)
                </span>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-600">ลิงก์ Booking.com</td>
              <td className="py-3 px-4">
                {hotelDetails?.url ? (
                  <a
                    href={hotelDetails.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    ดูที่พักบน Booking.com →
                  </a>
                ) : (
                  <span className="text-gray-400">ไม่มีลิงก์</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
