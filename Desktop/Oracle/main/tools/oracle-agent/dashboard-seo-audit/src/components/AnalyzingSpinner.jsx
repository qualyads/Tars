import { useState, useEffect } from 'react';

const CHECKS = [
  'กำลังดึงข้อมูลเว็บไซต์...',
  'ตรวจ Title Tag & Meta Description...',
  'วิเคราะห์โครงสร้าง Heading...',
  'เช็ค SSL & Security Headers...',
  'ตรวจ HSTS, X-Frame-Options, CSP...',
  'วิเคราะห์ความเร็ว & Compression...',
  'เช็ค Render-blocking Resources...',
  'ตรวจ Structured Data (Schema)...',
  'วิเคราะห์ Image Alt Text & Dimensions...',
  'เช็ค Internal Links & CTA...',
  'ตรวจ Open Graph & Twitter Cards...',
  'วิเคราะห์ URL Quality...',
  'เช็ค Sitemap, Robots.txt & Analytics...',
  'ตรวจ Lazy Loading & Third-party Scripts...',
  'เช็ค Mobile & Lang Attribute...',
  'คำนวณคะแนน 6 หมวดหมู่...',
];

export default function AnalyzingSpinner({ url }) {
  const [currentCheck, setCurrentCheck] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCheck(prev => (prev < CHECKS.length - 1 ? prev + 1 : prev));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center py-16 px-4">
      <div className="loader-spinner mb-6" />
      <h2 className="text-xl font-bold text-text-primary mb-2">Clairify กำลังวิเคราะห์</h2>
      <p className="text-sm text-text-secondary mb-8 text-center max-w-md break-all">{url}</p>

      <div className="w-full max-w-sm space-y-2">
        {CHECKS.map((check, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-sm transition-opacity duration-300"
            style={{ opacity: i <= currentCheck ? 1 : 0.2 }}
          >
            {i < currentCheck ? (
              <span className="text-green-600 font-bold w-5 text-center">✓</span>
            ) : i === currentCheck ? (
              <span className="check-pulse text-brand-primary font-bold w-5 text-center">●</span>
            ) : (
              <span className="text-gray-300 w-5 text-center">○</span>
            )}
            <span className={i <= currentCheck ? 'text-text-primary' : 'text-text-secondary'}>
              {check}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
