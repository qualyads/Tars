'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DemandAnalysis, DayDemand } from '@/types/demand';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const HOTEL_ID = '14973027'; // The Arch Casa
const DEST_ID = '-3252365'; // Pai
const CACHE_KEY = 'demand_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

interface CachedData {
  data: DemandAnalysis;
  timestamp: number;
  days: number;
}

export default function Home() {
  const [data, setData] = useState<DemandAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(1); // Default to 1 day to save API
  const [selectedDay, setSelectedDay] = useState<DayDemand | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const loadFromCache = useCallback((): CachedData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const parsedCache: CachedData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid (not expired and same days setting)
      if (now - parsedCache.timestamp < CACHE_DURATION && parsedCache.days === days) {
        return parsedCache;
      }
      return null;
    } catch {
      return null;
    }
  }, [days]);

  const saveToCache = (data: DemandAnalysis, daysCount: number) => {
    try {
      const cacheData: CachedData = {
        data,
        timestamp: Date.now(),
        days: daysCount,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      // Ignore cache save errors
    }
  };

  const fetchDemand = useCallback(async (forceRefresh = false) => {
    // Try to load from cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = loadFromCache();
      if (cached) {
        setData(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        setFromCache(true);
        if (cached.data.days?.length > 0) {
          setSelectedDay(cached.data.days[0]);
        }
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setFromCache(false);

    try {
      const response = await fetch(
        `/api/demand?hotel_id=${HOTEL_ID}&dest_id=${DEST_ID}&location=Pai&days=${days}`
      );
      if (!response.ok) throw new Error('Failed to fetch demand data');
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      saveToCache(result, days);
      if (result.days?.length > 0) {
        setSelectedDay(result.days[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [days, loadFromCache]);

  useEffect(() => {
    fetchDemand();
  }, [fetchDemand]);

  const handleRefresh = () => {
    fetchDemand(true); // Force refresh, bypass cache
  };

  const handleDaysChange = (newDays: number) => {
    setDays(newDays);
    // Will trigger useEffect and check cache for new days setting
  };

  // Load more days incrementally
  const loadMoreDays = async (additionalDays: number) => {
    const newTotal = days + additionalDays;
    setLoadingMore(true);
    setDays(newTotal);

    try {
      const response = await fetch(
        `/api/demand?hotel_id=${HOTEL_ID}&dest_id=${DEST_ID}&location=Pai&days=${newTotal}`
      );
      if (!response.ok) throw new Error('Failed to fetch demand data');
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      setFromCache(false);
      saveToCache(result, newTotal);
      // Keep current selected day if it exists
      if (!selectedDay && result.days?.length > 0) {
        setSelectedDay(result.days[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingMore(false);
    }
  };

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;

    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Calculate price trend data for chart
  const priceTrendData = useMemo(() => {
    if (!data?.days) return [];

    return data.days.map((day) => {
      const competitors = day.competitors.filter(c => c.price > 0);

      const budget = competitors.filter(c => c.price < 1500);
      const mid = competitors.filter(c => c.price >= 1500 && c.price < 3000);
      const premium = competitors.filter(c => c.price >= 3000 && c.price < 5000);
      const luxury = competitors.filter(c => c.price >= 5000);

      const avgBudget = budget.length > 0 ? Math.round(budget.reduce((s, c) => s + c.price, 0) / budget.length) : null;
      const avgMid = mid.length > 0 ? Math.round(mid.reduce((s, c) => s + c.price, 0) / mid.length) : null;
      const avgPremium = premium.length > 0 ? Math.round(premium.reduce((s, c) => s + c.price, 0) / premium.length) : null;
      const avgLuxury = luxury.length > 0 ? Math.round(luxury.reduce((s, c) => s + c.price, 0) / luxury.length) : null;

      const dateObj = new Date(day.date);
      const shortDate = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

      // Find dominant tier
      const tiers = [
        { name: 'ถูก', count: budget.length, color: '#22C55E', avgPrice: avgBudget },
        { name: 'กลาง', count: mid.length, color: '#3B82F6', avgPrice: avgMid },
        { name: 'แพง', count: premium.length, color: '#F97316', avgPrice: avgPremium },
        { name: 'หรู', count: luxury.length, color: '#A855F7', avgPrice: avgLuxury },
      ];
      const dominantTier = tiers.reduce((max, tier) => tier.count > max.count ? tier : max, tiers[0]);

      return {
        date: shortDate,
        fullDate: day.date,
        dayOfWeek: day.dayOfWeek,
        ถูก: avgBudget,
        กลาง: avgMid,
        แพง: avgPremium,
        หรู: avgLuxury,
        ถูกCount: budget.length,
        กลางCount: mid.length,
        แพงCount: premium.length,
        หรูCount: luxury.length,
        dominantTier: dominantTier.name,
        dominantColor: dominantTier.color,
        total: competitors.length,
      };
    });
  }, [data]);

  // Get selected day's market analysis
  const selectedDayMarket = useMemo(() => {
    if (!selectedDay) return null;

    const competitors = selectedDay.competitors.filter(c => c.price > 0);
    const budget = competitors.filter(c => c.price < 1500);
    const mid = competitors.filter(c => c.price >= 1500 && c.price < 3000);
    const premium = competitors.filter(c => c.price >= 3000 && c.price < 5000);
    const luxury = competitors.filter(c => c.price >= 5000);

    // Calculate recommended price (10% below average to be competitive)
    const calcRecommended = (prices: number[]) => {
      if (prices.length === 0) return 0;
      const sorted = [...prices].sort((a, b) => a - b);
      // Use 25th percentile for competitive pricing
      const idx = Math.floor(sorted.length * 0.25);
      return Math.round(sorted[idx] || sorted[0]);
    };

    const budgetPrices = budget.map(c => c.price);
    const midPrices = mid.map(c => c.price);
    const premiumPrices = premium.map(c => c.price);
    const luxuryPrices = luxury.map(c => c.price);

    const tiers = [
      {
        name: 'ถูก',
        range: '< 1,500 ฿',
        count: budget.length,
        color: '#22C55E',
        bgColor: 'from-green-900/50',
        borderColor: 'border-green-600',
        avgPrice: budget.length > 0 ? Math.round(budget.reduce((s, c) => s + c.price, 0) / budget.length) : 0,
        percent: competitors.length > 0 ? Math.round((budget.length / competitors.length) * 100) : 0,
        recommendedPrice: calcRecommended(budgetPrices),
      },
      {
        name: 'กลาง',
        range: '1,500 - 3,000 ฿',
        count: mid.length,
        color: '#3B82F6',
        bgColor: 'from-blue-900/50',
        borderColor: 'border-blue-600',
        avgPrice: mid.length > 0 ? Math.round(mid.reduce((s, c) => s + c.price, 0) / mid.length) : 0,
        percent: competitors.length > 0 ? Math.round((mid.length / competitors.length) * 100) : 0,
        recommendedPrice: calcRecommended(midPrices),
      },
      {
        name: 'แพง',
        range: '3,000 - 5,000 ฿',
        count: premium.length,
        color: '#F97316',
        bgColor: 'from-orange-900/50',
        borderColor: 'border-orange-600',
        avgPrice: premium.length > 0 ? Math.round(premium.reduce((s, c) => s + c.price, 0) / premium.length) : 0,
        percent: competitors.length > 0 ? Math.round((premium.length / competitors.length) * 100) : 0,
        recommendedPrice: calcRecommended(premiumPrices),
      },
      {
        name: 'หรู',
        range: '> 5,000 ฿',
        count: luxury.length,
        color: '#A855F7',
        bgColor: 'from-purple-900/50',
        borderColor: 'border-purple-600',
        avgPrice: luxury.length > 0 ? Math.round(luxury.reduce((s, c) => s + c.price, 0) / luxury.length) : 0,
        percent: competitors.length > 0 ? Math.round((luxury.length / competitors.length) * 100) : 0,
        recommendedPrice: calcRecommended(luxuryPrices),
      },
    ];

    const dominant = tiers.reduce((max, tier) => tier.count > max.count ? tier : max, tiers[0]);

    return { tiers, dominant, total: competitors.length };
  }, [selectedDay]);

  const getDemandColor = (level: string) => {
    switch (level) {
      case 'very_high': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getDemandEmoji = (level: string) => {
    switch (level) {
      case 'very_high': return '🔥';
      case 'high': return '⚡';
      case 'medium': return '📊';
      case 'low': return '❄️';
      default: return '';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl">กำลังดึงข้อมูล Demand วันนี้...</p>
          <p className="text-gray-400 mt-2">ใช้เวลาประมาณ 2-3 วินาที</p>
          <p className="text-gray-500 text-sm mt-1">โหลดแค่ 1 วันเพื่อประหยัด API</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="bg-red-900 p-4 rounded-lg">
          <h2 className="text-xl font-bold">Error</h2>
          <p>{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📊 Demand Dashboard - Pai</h1>
        <p className="text-gray-400">The Arch Casa - Design Hotel Pai</p>
        <p className="text-gray-500 text-sm">ที่พักทั้งหมดในปาย: 220 แห่ง</p>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-3">
        {/* Status Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="bg-gray-800 px-3 py-2 rounded flex items-center gap-2">
            <span className="text-gray-400">กำลังดู:</span>
            <span className="text-white font-bold">{days} วัน</span>
            <span className="text-gray-500">({days * 2} API calls)</span>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-2 py-1 rounded ${fromCache ? 'bg-green-900 text-green-400' : 'bg-blue-900 text-blue-400'}`}>
                {fromCache ? '📦 จาก Cache' : '🌐 ดึงใหม่'}
              </span>
              <span className="text-gray-400">
                อัพเดท: {formatLastUpdated(lastUpdated)}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-gray-400 text-sm">โหลดเพิ่ม:</span>
          <button
            onClick={() => loadMoreDays(6)}
            disabled={loadingMore || days >= 7}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm"
          >
            +7 วัน
          </button>
          <button
            onClick={() => loadMoreDays(days >= 7 ? 7 : 13)}
            disabled={loadingMore || days >= 14}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm"
          >
            รวม 14 วัน
          </button>
          <button
            onClick={() => loadMoreDays(30 - days)}
            disabled={loadingMore || days >= 30}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded text-sm"
          >
            รวม 30 วัน
          </button>
          <div className="border-l border-gray-600 h-6 mx-2"></div>
          <button
            onClick={handleRefresh}
            disabled={loadingMore}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded text-sm flex items-center gap-1"
          >
            🔄 Refresh
          </button>
          {loadingMore && (
            <span className="text-yellow-400 text-sm flex items-center gap-2">
              <span className="animate-spin">⏳</span> กำลังโหลด...
            </span>
          )}
        </div>
      </div>

      {/* Tracked Competitors Status - Only show for first day */}
      {data?.days?.[0]?.trackedCompetitors && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-bold mb-4">🏨 สถานะคู่แข่งหลักวันนี้ ({formatDate(data.days[0].date)})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Sold Out */}
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
              <h3 className="font-bold text-red-400 mb-3 flex items-center gap-2">
                <span className="text-xl">❌</span> ห้องเต็ม ({data.days[0].trackedCompetitors.filter(c => c.soldOut).length} แห่ง)
              </h3>
              <div className="space-y-2">
                {data.days[0].trackedCompetitors.filter(c => c.soldOut).map(comp => (
                  <div key={comp.id} className="flex justify-between items-center py-1 border-b border-red-900/50">
                    <span className="text-gray-300">{comp.name}</span>
                    <span className="text-red-400 text-sm">เต็ม</span>
                  </div>
                ))}
                {data.days[0].trackedCompetitors.filter(c => c.soldOut).length === 0 && (
                  <p className="text-gray-500 text-sm">ไม่มีคู่แข่งที่เต็ม</p>
                )}
              </div>
            </div>

            {/* Available */}
            <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4">
              <h3 className="font-bold text-green-400 mb-3 flex items-center gap-2">
                <span className="text-xl">✅</span> ยังว่าง ({data.days[0].trackedCompetitors.filter(c => !c.soldOut).length} แห่ง)
              </h3>
              <div className="space-y-2">
                {data.days[0].trackedCompetitors.filter(c => !c.soldOut).map(comp => (
                  <div key={comp.id} className="flex justify-between items-center py-1 border-b border-green-900/50">
                    <span className="text-gray-300">{comp.name}</span>
                    <span className="text-green-400 font-bold">
                      {comp.price ? `${Math.round(comp.price).toLocaleString()} ฿` : '-'}
                    </span>
                  </div>
                ))}
                {data.days[0].trackedCompetitors.filter(c => !c.soldOut).length === 0 && (
                  <p className="text-gray-500 text-sm">คู่แข่งเต็มหมด!</p>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">* ติดตามคู่แข่งระดับเดียวกัน 7 แห่ง (Reverie Siam, Pai Village, Belle Villa, Pai Vimaan, Pai River Corner, The Oia, Pai Country Hut)</p>
        </div>
      )}

      {/* Demand Timeline */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-bold mb-4">📅 Demand Timeline ({data?.days?.length || 0} วัน)</h2>
        <div className={`grid gap-2 ${
          (data?.days?.length || 0) <= 7
            ? 'grid-cols-7'
            : (data?.days?.length || 0) <= 14
              ? 'grid-cols-7 md:grid-cols-14'
              : 'grid-cols-7 md:grid-cols-10 lg:grid-cols-15'
        }`}>
          {data?.days.map((day) => (
            <button
              key={day.date}
              onClick={() => setSelectedDay(day)}
              className={`p-2 rounded text-center transition-all ${
                selectedDay?.date === day.date
                  ? 'ring-2 ring-white scale-105'
                  : 'hover:scale-105'
              } ${getDemandColor(day.demandLevel)}`}
            >
              <div className="text-xs font-bold">{formatDate(day.date)}</div>
              <div className="text-lg">{getDemandEmoji(day.demandLevel)}</div>
              <div className="text-xs">{day.soldOutPercentage}%</div>
              {day.yourRanking && (
                <div className="text-xs font-bold text-yellow-300">#{day.yourRanking}</div>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 bg-red-500 rounded"></span> 🔥 60%+ (Peak)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 bg-orange-500 rounded"></span> ⚡ 40-60%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 bg-yellow-500 rounded"></span> 📊 20-40%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 bg-blue-500 rounded"></span> ❄️ 0-20%
          </span>
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDay && (
        <div className="space-y-6">
          {/* Top Row: Summary + Your Position */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Your Ranking - Big Card */}
            <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 rounded-lg">
              <h2 className="text-lg font-bold mb-2">
                📌 {formatDate(selectedDay.date)} ({selectedDay.dayOfWeek})
              </h2>
              <div className="text-gray-300 text-sm">อันดับของคุณใน Booking.com</div>
              <div className="text-5xl font-bold text-yellow-400 my-2">
                {selectedDay.yourRanking ? `#${selectedDay.yourRanking}` : 'ไม่พบ'}
              </div>
              <div className="text-gray-400">จาก {selectedDay.availableCount} ที่พักที่ว่าง</div>
              <div className="mt-4 pt-4 border-t border-gray-600">
                <div className="text-gray-300 text-sm">ราคาที่แสดงอยู่</div>
                <div className="text-3xl font-bold text-green-400">
                  {selectedDay.yourPrice ? `${selectedDay.yourPrice.toLocaleString()} ฿` : '-'}
                </div>
              </div>
            </div>

            {/* Demand Info */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <span>Demand Level</span>
                  <span className="font-bold">{selectedDay.soldOutPercentage}% เต็ม</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-6">
                  <div
                    className={`h-6 rounded-full ${getDemandColor(selectedDay.demandLevel)} transition-all`}
                    style={{ width: `${selectedDay.soldOutPercentage}%` }}
                  ></div>
                </div>
                <p className="mt-2">{selectedDay.priceAdvice}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 text-xs">ที่พักว่าง</div>
                  <div className="text-xl font-bold text-green-400">{selectedDay.availableCount}</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 text-xs">ที่พักเต็ม</div>
                  <div className="text-xl font-bold text-red-400">{selectedDay.soldOutCount}</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 text-xs">ราคาเฉลี่ย</div>
                  <div className="text-xl font-bold">{selectedDay.avgPrice.toLocaleString()} ฿</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 text-xs">ต่ำสุด-สูงสุด</div>
                  <div className="text-sm font-bold">
                    {selectedDay.minPrice.toLocaleString()} - {selectedDay.maxPrice.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended Prices */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3 text-lg">💰 ราคาแนะนำ (ปิด Booster)</h3>
              <div className="bg-gray-900 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">ตั้งใน BDC</span>
                  <span>→</span>
                  <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-bold">ลูกค้าเห็น</span>
                </div>
              </div>
              <div className="space-y-2 overflow-y-auto max-h-80">
                {selectedDay.recommendedPrices?.map((room) => (
                  <div key={room.name} className="bg-gray-700 rounded-lg p-3">
                    <div className="text-gray-300 text-sm mb-2">{room.name}</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-green-900/50 border border-green-600 rounded-lg p-2 text-center">
                        <div className="text-green-400 font-bold text-lg">{room.bookingInput.toLocaleString()} ฿</div>
                      </div>
                      <span className="text-gray-500 text-xl">→</span>
                      <div className="flex-1 bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-2 text-center">
                        <div className="text-yellow-400 font-bold text-lg">{room.displayPrice.toLocaleString()} ฿</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-600">
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 mb-1">รวมตั้งใน BDC</div>
                    <div className="text-green-400 font-bold text-xl">
                      {selectedDay.recommendedPrices?.reduce((sum, r) => sum + r.bookingInput, 0).toLocaleString()} ฿
                    </div>
                  </div>
                  <span className="text-gray-500 text-xl">→</span>
                  <div className="flex-1 text-center">
                    <div className="text-xs text-gray-400 mb-1">รวมลูกค้าเห็น</div>
                    <div className="text-yellow-400 font-bold text-xl">
                      {selectedDay.recommendedPrices?.reduce((sum, r) => sum + r.displayPrice, 0).toLocaleString()} ฿
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top 40 Competitors - Full Width */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-4 text-xl">🏨 อันดับคู่แข่ง Top 40 ใน Booking.com</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2">ชื่อที่พัก</th>
                    <th className="text-right py-2 px-2">ราคา</th>
                    <th className="text-right py-2 px-2">คะแนน</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDay.competitors.map((comp, idx) => {
                    const isYou = comp.hotel_id === 14973027;
                    return (
                      <tr
                        key={comp.hotel_id}
                        className={`border-b border-gray-700 ${
                          isYou
                            ? 'bg-yellow-900/50 font-bold'
                            : idx % 2 === 0
                            ? 'bg-gray-800'
                            : 'bg-gray-750'
                        }`}
                      >
                        <td className={`py-2 px-2 ${isYou ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {idx + 1}
                        </td>
                        <td className={`py-2 ${isYou ? 'text-yellow-400' : ''}`}>
                          {comp.hotel_name}
                          {isYou && <span className="ml-2 text-xs bg-yellow-600 px-2 py-0.5 rounded">YOU</span>}
                        </td>
                        <td className={`text-right py-2 px-2 ${isYou ? 'text-yellow-400' : 'text-green-400'}`}>
                          {comp.price.toLocaleString()} ฿
                        </td>
                        <td className="text-right py-2 px-2 text-gray-300">
                          {comp.review_score}/10
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {selectedDay.competitors.length === 0 && (
              <p className="text-gray-500 text-center py-4">ไม่มีข้อมูลคู่แข่ง</p>
            )}
          </div>

          {/* Price Tier Segmentation */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-bold mb-4 text-xl">📊 วิเคราะห์ตามกลุ่มราคา (Top 10 แต่ละกลุ่ม)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Budget Tier */}
              {(() => {
                const budgetHotels = selectedDay.competitors.filter(c => c.price > 0 && c.price < 1500).slice(0, 10);
                const avgPrice = budgetHotels.length > 0 ? Math.round(budgetHotels.reduce((sum, c) => sum + c.price, 0) / budgetHotels.length) : 0;
                return (
                  <div className="bg-gradient-to-br from-green-900/50 to-gray-800 rounded-lg p-4 border border-green-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-green-400">💚 กลุ่มถูก</h4>
                      <span className="text-xs text-gray-400">&lt; 1,500 ฿</span>
                    </div>
                    <div className="text-center mb-3 py-2 bg-green-900/30 rounded">
                      <div className="text-xs text-gray-400">ราคาเฉลี่ย</div>
                      <div className="text-2xl font-bold text-green-400">{avgPrice.toLocaleString()} ฿</div>
                      <div className="text-xs text-gray-500">{budgetHotels.length} ที่พัก</div>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {budgetHotels.map((hotel, idx) => (
                        <div key={hotel.hotel_id} className="flex justify-between text-sm py-1 border-b border-gray-700/50">
                          <span className="text-gray-400 truncate flex-1 mr-2">{idx + 1}. {hotel.hotel_name}</span>
                          <span className="text-green-400 font-bold whitespace-nowrap">{hotel.price.toLocaleString()} ฿</span>
                        </div>
                      ))}
                      {budgetHotels.length === 0 && <p className="text-gray-500 text-center text-sm">ไม่มีข้อมูล</p>}
                    </div>
                  </div>
                );
              })()}

              {/* Mid-range Tier */}
              {(() => {
                const midHotels = selectedDay.competitors.filter(c => c.price >= 1500 && c.price < 3000).slice(0, 10);
                const avgPrice = midHotels.length > 0 ? Math.round(midHotels.reduce((sum, c) => sum + c.price, 0) / midHotels.length) : 0;
                return (
                  <div className="bg-gradient-to-br from-blue-900/50 to-gray-800 rounded-lg p-4 border border-blue-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-blue-400">💙 กลุ่มกลาง</h4>
                      <span className="text-xs text-gray-400">1,500 - 3,000 ฿</span>
                    </div>
                    <div className="text-center mb-3 py-2 bg-blue-900/30 rounded">
                      <div className="text-xs text-gray-400">ราคาเฉลี่ย</div>
                      <div className="text-2xl font-bold text-blue-400">{avgPrice.toLocaleString()} ฿</div>
                      <div className="text-xs text-gray-500">{midHotels.length} ที่พัก</div>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {midHotels.map((hotel, idx) => (
                        <div key={hotel.hotel_id} className={`flex justify-between text-sm py-1 border-b border-gray-700/50 ${hotel.hotel_id === 14973027 ? 'bg-yellow-900/50 rounded px-1' : ''}`}>
                          <span className={`truncate flex-1 mr-2 ${hotel.hotel_id === 14973027 ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {idx + 1}. {hotel.hotel_name}
                            {hotel.hotel_id === 14973027 && <span className="ml-1 text-xs bg-yellow-600 px-1 rounded">YOU</span>}
                          </span>
                          <span className={`font-bold whitespace-nowrap ${hotel.hotel_id === 14973027 ? 'text-yellow-400' : 'text-blue-400'}`}>{hotel.price.toLocaleString()} ฿</span>
                        </div>
                      ))}
                      {midHotels.length === 0 && <p className="text-gray-500 text-center text-sm">ไม่มีข้อมูล</p>}
                    </div>
                  </div>
                );
              })()}

              {/* Premium Tier */}
              {(() => {
                const premiumHotels = selectedDay.competitors.filter(c => c.price >= 3000 && c.price < 5000).slice(0, 10);
                const avgPrice = premiumHotels.length > 0 ? Math.round(premiumHotels.reduce((sum, c) => sum + c.price, 0) / premiumHotels.length) : 0;
                return (
                  <div className="bg-gradient-to-br from-orange-900/50 to-gray-800 rounded-lg p-4 border border-orange-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-orange-400">🧡 กลุ่มแพง</h4>
                      <span className="text-xs text-gray-400">3,000 - 5,000 ฿</span>
                    </div>
                    <div className="text-center mb-3 py-2 bg-orange-900/30 rounded">
                      <div className="text-xs text-gray-400">ราคาเฉลี่ย</div>
                      <div className="text-2xl font-bold text-orange-400">{avgPrice.toLocaleString()} ฿</div>
                      <div className="text-xs text-gray-500">{premiumHotels.length} ที่พัก</div>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {premiumHotels.map((hotel, idx) => (
                        <div key={hotel.hotel_id} className={`flex justify-between text-sm py-1 border-b border-gray-700/50 ${hotel.hotel_id === 14973027 ? 'bg-yellow-900/50 rounded px-1' : ''}`}>
                          <span className={`truncate flex-1 mr-2 ${hotel.hotel_id === 14973027 ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {idx + 1}. {hotel.hotel_name}
                            {hotel.hotel_id === 14973027 && <span className="ml-1 text-xs bg-yellow-600 px-1 rounded">YOU</span>}
                          </span>
                          <span className={`font-bold whitespace-nowrap ${hotel.hotel_id === 14973027 ? 'text-yellow-400' : 'text-orange-400'}`}>{hotel.price.toLocaleString()} ฿</span>
                        </div>
                      ))}
                      {premiumHotels.length === 0 && <p className="text-gray-500 text-center text-sm">ไม่มีข้อมูล</p>}
                    </div>
                  </div>
                );
              })()}

              {/* Luxury Tier */}
              {(() => {
                const luxuryHotels = selectedDay.competitors.filter(c => c.price >= 5000).slice(0, 10);
                const avgPrice = luxuryHotels.length > 0 ? Math.round(luxuryHotels.reduce((sum, c) => sum + c.price, 0) / luxuryHotels.length) : 0;
                return (
                  <div className="bg-gradient-to-br from-purple-900/50 to-gray-800 rounded-lg p-4 border border-purple-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-purple-400">💜 กลุ่มหรู</h4>
                      <span className="text-xs text-gray-400">&gt; 5,000 ฿</span>
                    </div>
                    <div className="text-center mb-3 py-2 bg-purple-900/30 rounded">
                      <div className="text-xs text-gray-400">ราคาเฉลี่ย</div>
                      <div className="text-2xl font-bold text-purple-400">{avgPrice.toLocaleString()} ฿</div>
                      <div className="text-xs text-gray-500">{luxuryHotels.length} ที่พัก</div>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {luxuryHotels.map((hotel, idx) => (
                        <div key={hotel.hotel_id} className={`flex justify-between text-sm py-1 border-b border-gray-700/50 ${hotel.hotel_id === 14973027 ? 'bg-yellow-900/50 rounded px-1' : ''}`}>
                          <span className={`truncate flex-1 mr-2 ${hotel.hotel_id === 14973027 ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {idx + 1}. {hotel.hotel_name}
                            {hotel.hotel_id === 14973027 && <span className="ml-1 text-xs bg-yellow-600 px-1 rounded">YOU</span>}
                          </span>
                          <span className={`font-bold whitespace-nowrap ${hotel.hotel_id === 14973027 ? 'text-yellow-400' : 'text-purple-400'}`}>{hotel.price.toLocaleString()} ฿</span>
                        </div>
                      ))}
                      {luxuryHotels.length === 0 && <p className="text-gray-500 text-center text-sm">ไม่มีข้อมูล</p>}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>
      )}

      {/* Summary */}
      {data?.summary && (
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">📈 สรุปภาพรวม</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-gray-400">Demand เฉลี่ย</div>
              <div className="text-3xl font-bold">{data.summary.avgDemand}%</div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-gray-400">วัน High Demand</div>
              <div className="text-xl font-bold text-orange-400">
                {data.summary.highDemandDays.length} วัน
              </div>
              <div className="text-sm text-gray-500">
                {data.summary.highDemandDays.slice(0, 3).map(formatDate).join(', ')}
                {data.summary.highDemandDays.length > 3 && '...'}
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded">
              <div className="text-gray-400">วัน Low Demand</div>
              <div className="text-xl font-bold text-blue-400">
                {data.summary.lowDemandDays.length} วัน
              </div>
              <div className="text-sm text-gray-500">
                {data.summary.lowDemandDays.slice(0, 3).map(formatDate).join(', ')}
                {data.summary.lowDemandDays.length > 3 && '...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market Buying Power Analysis */}
      {selectedDayMarket && selectedDay && (
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">💰 กำลังซื้อตลาด - {formatDate(selectedDay.date)} ({selectedDay.dayOfWeek})</h2>

          {/* Dominant Tier Highlight */}
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-yellow-900/50 to-gray-800 border border-yellow-600/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">กลุ่มที่มีคู่แข่งมากที่สุด (จาก Top 40)</div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-4xl font-bold"
                    style={{ color: selectedDayMarket.dominant.color }}
                  >
                    กลุ่ม{selectedDayMarket.dominant.name}
                  </span>
                  <span className="text-2xl text-gray-400">
                    ({selectedDayMarket.dominant.percent}%)
                  </span>
                </div>
                <div className="text-gray-400 mt-1">
                  {selectedDayMarket.dominant.count} / {selectedDayMarket.total} (Top 40) | ราคาเฉลี่ย {selectedDayMarket.dominant.avgPrice.toLocaleString()} ฿
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">ช่วงราคา</div>
                <div className="text-xl font-bold" style={{ color: selectedDayMarket.dominant.color }}>
                  {selectedDayMarket.dominant.range}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ที่พักว่างทั้งหมด: {selectedDay.availableCount} แห่ง
                </div>
              </div>
            </div>
          </div>

          {/* Tier Distribution Bars */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {selectedDayMarket.tiers.map((tier) => (
              <div
                key={tier.name}
                className={`p-4 rounded-lg bg-gradient-to-br ${tier.bgColor} to-gray-800 border ${tier.borderColor}/50 ${
                  tier.name === selectedDayMarket.dominant.name ? 'ring-2 ring-yellow-500' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold" style={{ color: tier.color }}>{tier.name}</span>
                  <span className="text-xs text-gray-400">{tier.range}</span>
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color: tier.color }}>
                  {tier.count} <span className="text-lg text-gray-400">ที่พัก</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{ width: `${tier.percent}%`, backgroundColor: tier.color }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">{tier.percent}%</span>
                  <span className="text-gray-400">เฉลี่ย: <span style={{ color: tier.color }}>{tier.avgPrice > 0 ? `${tier.avgPrice.toLocaleString()} ฿` : '-'}</span></span>
                </div>
                {tier.recommendedPrice > 0 && (
                  <div className="bg-gray-900/50 rounded p-2 text-center">
                    <div className="text-xs text-gray-400">ตั้งขายแนะนำ</div>
                    <div className="text-lg font-bold text-yellow-400">{tier.recommendedPrice.toLocaleString()} ฿</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 text-center">
            * ข้อมูลจาก Top 40 อันดับแรกใน Booking.com (ที่พักว่างทั้งหมด: {selectedDay.availableCount} แห่ง จาก 220 แห่ง)
          </div>
        </div>
      )}

      {/* Price Trend Charts */}
      {priceTrendData.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">📊 Trend จำนวนที่พักแต่ละกลุ่ม (ตามวัน)</h2>

          {/* Stacked Bar Chart - Hotel Count per Tier */}
          <div className="h-72 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={priceTrendData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  label={{ value: 'จำนวนที่พัก', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#F3F4F6' }}
                  formatter={(value: number, name: string) => [`${value} ที่พัก`, name]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const d = payload[0].payload;
                      return `${label} (${d.dayOfWeek}) - กลุ่มฮิต: ${d.dominantTier}`;
                    }
                    return label;
                  }}
                />
                <Legend formatter={(value) => <span style={{ color: '#F3F4F6' }}>{value}</span>} />
                <Bar dataKey="ถูกCount" name="ถูก" fill="#22C55E" stackId="stack" />
                <Bar dataKey="กลางCount" name="กลาง" fill="#3B82F6" stackId="stack" />
                <Bar dataKey="แพงCount" name="แพง" fill="#F97316" stackId="stack" />
                <Bar dataKey="หรูCount" name="หรู" fill="#A855F7" stackId="stack" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="text-lg font-bold mb-3 mt-6">📉 Trend ราคาเฉลี่ยแต่ละกลุ่ม</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={priceTrendData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#F3F4F6' }}
                  formatter={(value: number, name: string) => [
                    value ? `${value.toLocaleString()} ฿` : 'ไม่มีข้อมูล',
                    `ราคาเฉลี่ย ${name}`,
                  ]}
                />
                <Legend formatter={(value) => <span style={{ color: '#F3F4F6' }}>{value}</span>} />
                <Line type="monotone" dataKey="ถูก" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="กลาง" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="แพง" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="หรู" stroke="#A855F7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
