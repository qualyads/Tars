'use client';

import type { DemandAnalysis } from '@/types/demand';

interface DemandSummaryCardProps {
  analysis: DemandAnalysis;
}

export default function DemandSummaryCard({ analysis }: DemandSummaryCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-2xl">📈</span> สรุปการวิเคราะห์ Demand
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-700 mb-2">ข้อมูลทั่วไป</h3>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-500">ที่พัก</td>
                  <td className="py-1 font-medium text-right">{analysis.hotelName || 'ไม่ทราบ'}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">พื้นที่</td>
                  <td className="py-1 font-medium text-right">{analysis.location}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">ช่วงวันที่</td>
                  <td className="py-1 font-medium text-right">
                    {formatDate(analysis.dateRange.start)} - {formatDate(analysis.dateRange.end)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500">Demand เฉลี่ย</td>
                  <td className="py-1 font-medium text-right">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        analysis.summary.avgDemand >= 50
                          ? 'bg-red-100 text-red-600'
                          : analysis.summary.avgDemand >= 30
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-green-100 text-green-600'
                      }`}
                    >
                      {analysis.summary.avgDemand}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-2">💰 ราคาแนะนำ</h3>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-sm text-gray-500">ต่ำสุด</div>
                <div className="text-xl font-bold text-green-600">
                  {analysis.summary.suggestedMinPrice.toLocaleString()}฿
                </div>
              </div>
              <div className="text-2xl text-gray-300">→</div>
              <div className="text-center">
                <div className="text-sm text-gray-500">สูงสุด</div>
                <div className="text-xl font-bold text-red-600">
                  {analysis.summary.suggestedMaxPrice.toLocaleString()}฿
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {analysis.summary.highDemandDays.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-700 mb-2">🔥 วัน Demand สูง (ขึ้นราคาได้)</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.summary.highDemandDays.map((date) => (
                  <span
                    key={date}
                    className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm"
                  >
                    {formatDate(date)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.summary.lowDemandDays.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-green-700 mb-2">💚 วัน Demand ต่ำ (ควรลดราคา)</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.summary.lowDemandDays.map((date) => (
                  <span
                    key={date}
                    className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm"
                  >
                    {formatDate(date)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.summary.highDemandDays.length === 0 &&
            analysis.summary.lowDemandDays.length === 0 && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-700 mb-2">📊 Demand ปานกลางทุกวัน</h3>
                <p className="text-sm text-gray-600">
                  แนะนำตั้งราคาใกล้เคียงค่าเฉลี่ยของตลาด
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
