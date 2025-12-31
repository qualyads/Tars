'use client';

import type { HistoryItem } from '@/lib/storage';

interface HistoryCardProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export default function HistoryCard({
  history,
  onSelect,
  onDelete,
  onClear,
}: HistoryCardProps) {
  if (history.length === 0) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📋</span> ประวัติการค้นหา
        </h2>
        <button
          onClick={onClear}
          className="text-sm text-red-500 hover:text-red-700"
        >
          ล้างทั้งหมด
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        คลิกเพื่อดูผลลัพธ์จากประวัติ (ไม่เรียก API ใหม่)
      </p>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer group"
            onClick={() => onSelect(item)}
          >
            <div className="flex-1">
              <div className="font-medium text-gray-800 truncate">
                {item.hotelName}
              </div>
              <div className="text-sm text-gray-500">
                {item.location} • {item.checkinDate}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                บันทึกเมื่อ {formatDate(item.timestamp)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={`font-bold ${
                  item.position && item.position <= 10
                    ? 'text-green-600'
                    : item.position && item.position <= 30
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  #{item.position || 'N/A'}
                </div>
                <div className="text-sm text-gray-500">
                  {item.price ? `${item.price.toLocaleString()} THB` : '-'}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
