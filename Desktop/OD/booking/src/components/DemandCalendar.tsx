'use client';

import type { DayDemand } from '@/types/demand';

interface DemandCalendarProps {
  days: DayDemand[];
  onSelectDay: (day: DayDemand) => void;
  selectedDate: string | null;
}

export default function DemandCalendar({ days, onSelectDay, selectedDate }: DemandCalendarProps) {
  const getDemandColor = (level: string) => {
    switch (level) {
      case 'very_high':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-400 text-white';
      case 'medium':
        return 'bg-yellow-400 text-gray-800';
      case 'low':
        return 'bg-green-400 text-white';
      default:
        return 'bg-gray-200';
    }
  };

  const getDemandText = (level: string) => {
    switch (level) {
      case 'very_high':
        return 'สูงมาก';
      case 'high':
        return 'สูง';
      case 'medium':
        return 'ปานกลาง';
      case 'low':
        return 'ต่ำ';
      default:
        return '-';
    }
  };

  const formatDateThai = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-2xl">📅</span> Demand Calendar (7 วันล่วงหน้า)
      </h2>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>Demand สูงมาก</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-orange-400" />
          <span>Demand สูง</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-yellow-400" />
          <span>Demand ปานกลาง</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-400" />
          <span>Demand ต่ำ</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <button
            key={day.date}
            onClick={() => onSelectDay(day)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedDate === day.date
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            <div className="text-xs text-gray-500 mb-1">{day.dayOfWeek}</div>
            <div className="font-bold text-lg">{formatDateThai(day.date)}</div>
            <div
              className={`mt-2 px-2 py-1 rounded text-xs font-medium ${getDemandColor(
                day.demandLevel
              )}`}
            >
              {getDemandText(day.demandLevel)}
            </div>
            <div className="mt-2 text-xs text-gray-600">
              <div>เฉลี่ย: {day.avgPrice.toLocaleString()}฿</div>
              <div className="text-blue-600 font-medium">
                แนะนำ: {day.recommendedPrice.toLocaleString()}฿
              </div>
            </div>
            {day.yourPrice && (
              <div className="mt-1 text-xs">
                <span className={day.yourPrice > day.avgPrice ? 'text-red-600' : 'text-green-600'}>
                  คุณ: {day.yourPrice.toLocaleString()}฿
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
