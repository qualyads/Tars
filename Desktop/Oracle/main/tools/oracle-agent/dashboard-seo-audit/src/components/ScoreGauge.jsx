import { useEffect, useState } from 'react';

const GRADE_COLORS = {
  'A+': '#027a48', A: '#027a48',
  'B+': '#2e90fa', B: '#2e90fa',
  'C+': '#f59e0b', C: '#f59e0b',
  D: '#ef4444', F: '#b42318',
};

export default function ScoreGauge({ score, grade }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const color = GRADE_COLORS[grade] || '#666';
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    let frame;
    let start = 0;
    const step = () => {
      start += 1;
      if (start > score) { setAnimatedScore(score); return; }
      setAnimatedScore(start);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#eee" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>{animatedScore}</span>
          <span className="text-sm text-text-secondary">/100</span>
        </div>
      </div>
      <div
        className="mt-3 px-5 py-1.5 rounded-full text-white font-bold text-lg"
        style={{ backgroundColor: color }}
      >
        เกรด {grade}
      </div>
    </div>
  );
}
