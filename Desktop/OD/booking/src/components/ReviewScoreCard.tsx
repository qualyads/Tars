'use client';

interface ReviewScoreCardProps {
  score: number;
  word: string;
  numberOfReviews: number;
  rankInArea: number | null;
  totalHotelsInArea: number;
}

export default function ReviewScoreCard({
  score,
  word,
  numberOfReviews,
  rankInArea,
  totalHotelsInArea,
}: ReviewScoreCardProps) {
  const getScoreColor = (s: number) => {
    if (s >= 9) return 'text-green-600 bg-green-100';
    if (s >= 8) return 'text-blue-600 bg-blue-100';
    if (s >= 7) return 'text-yellow-600 bg-yellow-100';
    if (s > 0) return 'text-red-600 bg-red-100';
    return 'text-gray-500 bg-gray-100';
  };

  const getScoreBarWidth = (s: number) => {
    return `${(s / 10) * 100}%`;
  };

  const getScoreWord = (s: number) => {
    if (word && word !== 'N/A') return word;
    if (s >= 9) return 'ยอดเยี่ยม';
    if (s >= 8) return 'ดีมาก';
    if (s >= 7) return 'ดี';
    if (s >= 6) return 'พอใช้';
    if (s > 0) return 'ควรปรับปรุง';
    return 'ยังไม่มีคะแนน';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">คะแนนรีวิว</h2>

      <div className="flex items-center gap-6 mb-6">
        <div
          className={`${getScoreColor(score)} rounded-xl p-4 text-center min-w-[100px]`}
        >
          <div className="text-4xl font-bold">
            {score > 0 ? score.toFixed(1) : '-'}
          </div>
          <div className="text-sm font-medium">{getScoreWord(score)}</div>
        </div>

        <div className="flex-1">
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">คะแนน</span>
              <span className="font-medium">
                {score > 0 ? `${score.toFixed(1)} / 10` : 'ยังไม่มี'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: score > 0 ? getScoreBarWidth(score) : '0%' }}
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            จาก <span className="font-semibold">{numberOfReviews.toLocaleString()}</span> รีวิว
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="font-semibold text-gray-700 mb-3">อันดับคะแนนในพื้นที่</h3>
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-3xl font-bold text-blue-600">
              {rankInArea !== null && rankInArea > 0 ? `#${rankInArea}` : 'N/A'}
            </div>
            <div className="text-sm text-gray-500">อันดับของคุณ</div>
          </div>
          <div className="text-4xl text-gray-300">/</div>
          <div className="text-center flex-1">
            <div className="text-3xl font-bold text-gray-600">{totalHotelsInArea}</div>
            <div className="text-sm text-gray-500">ที่พักทั้งหมด</div>
          </div>
        </div>

        {rankInArea && rankInArea > 0 && totalHotelsInArea > 0 && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-1">เปอร์เซ็นไทล์</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{
                    width: `${((totalHotelsInArea - rankInArea + 1) / totalHotelsInArea) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-green-600">
                Top {Math.round((rankInArea / totalHotelsInArea) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
