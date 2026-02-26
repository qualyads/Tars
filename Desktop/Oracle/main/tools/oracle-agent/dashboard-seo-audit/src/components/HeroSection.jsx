import { useState, useEffect } from 'react';

const API = window.location.origin;

export default function HeroSection({ onSubmit, loading }) {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [auditCount, setAuditCount] = useState(0);

  // Fetch audit count for social proof
  useEffect(() => {
    fetch(`${API}/api/audit/stats`)
      .then(r => r.json())
      .then(d => { if (d.total > 0) setAuditCount(d.total); })
      .catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('กรุณาใส่ URL เว็บไซต์');
      return;
    }

    let testUrl = trimmedUrl;
    if (!testUrl.startsWith('http')) testUrl = 'https://' + testUrl;
    try {
      new URL(testUrl);
    } catch {
      setError('URL ไม่ถูกต้อง เช่น example.com หรือ https://example.com');
      return;
    }

    // Email required + basic format validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('กรุณาใส่อีเมล เพื่อรับรายงานและเทคนิค SEO');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('อีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    // Block disposable/fake patterns
    const disposable = /(tempmail|guerrilla|mailinator|yopmail|throwaway|fakeinbox|sharklasers|grr\.la|dispostable)/i;
    if (disposable.test(trimmedEmail)) {
      setError('กรุณาใช้อีเมลจริง ไม่รับอีเมลชั่วคราว');
      return;
    }

    onSubmit(trimmedUrl, trimmedEmail);
  };

  return (
    <section className="bg-background-alternative text-text-alternative py-20 px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {[
            'ฟรี 100%',
            'ผลใน 30 วินาที',
            'ส่ง PDF ให้ทางอีเมล',
          ].map(badge => (
            <span key={badge} className="bg-white/10 text-white/80 px-3 py-1 rounded-full text-xs font-medium">
              {badge}
            </span>
          ))}
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          <span className="bg-gradient-to-r from-brand-primary to-[#6e49f3] bg-clip-text text-transparent">Clairify</span>
          <span className="text-white text-lg align-top">™</span>
          <br />
          <span className="text-2xl md:text-3xl text-white/90 font-medium">
            AI วิเคราะห์เว็บไซต์เพื่อการเติบโต
          </span>
        </h1>

        <p className="text-lg text-white/70 mb-10 max-w-lg mx-auto leading-relaxed">
          ตรวจ <strong className="text-white/90">45+ จุดสำคัญ</strong> ครอบคลุม <strong className="text-white/90">6 หมวด</strong> — SEO, Security, Performance, เนื้อหา และอื่นๆ
          <br />
          <span className="text-white/60">ให้ผลลัพธ์จริงทุกข้อ ไม่มีซ่อน พร้อมวิธีแก้ไขภาษาไทย</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 max-w-lg mx-auto">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ใส่ URL เว็บไซต์ เช่น example.com"
            className="w-full px-6 py-4 text-text-primary bg-white rounded-full text-base focus:outline-none focus:ring-2 focus:ring-brand-primary"
            disabled={loading}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมลของคุณ — ส่งรายงาน PDF + เทคนิค SEO ฟรี"
            className="w-full px-6 py-4 text-text-primary bg-white rounded-full text-base focus:outline-none focus:ring-2 focus:ring-brand-primary"
            required
            disabled={loading}
          />
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary text-white px-8 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ฟรี — รู้ผลใน 30 วินาที'}
          </button>
        </form>

        <p className="text-xs text-white/40 mt-4">
          {auditCount > 10
            ? `วิเคราะห์แล้ว ${auditCount.toLocaleString()} เว็บไซต์ — ตรวจได้ 5 ครั้งต่อชั่วโมง`
            : 'ตรวจได้ 5 ครั้งต่อชั่วโมง — ผลวิเคราะห์จากข้อมูลจริงของเว็บไซต์'
          }
        </p>
      </div>
    </section>
  );
}
