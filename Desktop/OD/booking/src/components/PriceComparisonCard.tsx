'use client';

interface PriceComparisonCardProps {
  yourPrice: number | null;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  currency: string;
  priceRank: number | null;
  totalCompared: number;
}

export default function PriceComparisonCard({
  yourPrice,
  averagePrice,
  minPrice,
  maxPrice,
  currency,
  priceRank,
  totalCompared,
}: PriceComparisonCardProps) {
  const getPriceStatus = () => {
    if (!yourPrice || !averagePrice) return { text: 'ไม่ทราบ', color: 'text-gray-500' };
    const diff = ((yourPrice - averagePrice) / averagePrice) * 100;
    if (diff <= -15) return { text: 'ถูกมาก', color: 'text-green-600' };
    if (diff <= 0) return { text: 'ราคาดี', color: 'text-green-500' };
    if (diff <= 15) return { text: 'ปานกลาง', color: 'text-yellow-600' };
    return { text: 'สูงกว่าเฉลี่ย', color: 'text-red-600' };
  };

  const priceStatus = getPriceStatus();

  const getPricePosition = () => {
    if (!yourPrice || minPrice === maxPrice) return 50;
    return ((yourPrice - minPrice) / (maxPrice - minPrice)) * 100;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">เปรียบเทียบราคา</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">ราคาของคุณ</div>
          <div className="text-2xl font-bold text-blue-600">
            {yourPrice ? `${yourPrice.toLocaleString()} ${currency}` : 'ไม่ทราบ'}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">ราคาเฉลี่ย</div>
          <div className="text-2xl font-bold text-gray-600">
            {averagePrice ? `${Math.round(averagePrice).toLocaleString()} ${currency}` : 'ไม่ทราบ'}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>ต่ำสุด: {minPrice.toLocaleString()} {currency}</span>
          <span>สูงสุด: {maxPrice.toLocaleString()} {currency}</span>
        </div>
        <div className="relative">
          <div className="w-full bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-full h-4" />
          {yourPrice && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg"
              style={{ left: `calc(${getPricePosition()}% - 8px)` }}
            />
          )}
        </div>
        <div className="flex justify-center mt-2">
          <span className={`text-sm font-medium ${priceStatus.color}`}>
            {priceStatus.text}
          </span>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold text-gray-700 mb-3">อันดับราคา</h3>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-3xl font-bold text-blue-600">
              {priceRank !== null ? `#${priceRank}` : 'N/A'}
            </div>
            <div className="text-sm text-gray-500">ถูกที่สุดอันดับ</div>
          </div>
          <div className="text-4xl text-gray-300">/</div>
          <div className="text-center flex-1">
            <div className="text-3xl font-bold text-gray-600">{totalCompared}</div>
            <div className="text-sm text-gray-500">ที่พักเปรียบเทียบ</div>
          </div>
        </div>

        {yourPrice && averagePrice > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              ราคาของคุณ{' '}
              <span className={yourPrice < averagePrice ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {yourPrice < averagePrice
                  ? `ต่ำกว่าค่าเฉลี่ย ${Math.round(averagePrice - yourPrice).toLocaleString()} ${currency}`
                  : `สูงกว่าค่าเฉลี่ย ${Math.round(yourPrice - averagePrice).toLocaleString()} ${currency}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
