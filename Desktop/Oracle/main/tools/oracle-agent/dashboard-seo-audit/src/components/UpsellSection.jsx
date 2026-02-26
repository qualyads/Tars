import { useState } from 'react';

const API = window.location.origin;

export default function UpsellSection({ auditId, failCount, warnCount, score, predictedScore }) {
  const [loading, setLoading] = useState(false);
  const totalIssues = (failCount || 0) + (warnCount || 0);

  const handleBuy = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/audit/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      });
      const data = await res.json();

      if (data.alreadyPaid) {
        window.location.href = `/tools/clairify/report/${auditId}`;
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        setLoading(false);
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อระบบชำระเงินได้ กรุณาลองใหม่');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[15px] border-2 border-brand-primary/30 bg-white p-6 md:p-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left: Value Prop */}
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-1 rounded-full text-sm font-bold mb-4">
            Clairify Action Plan
          </div>

          <h3 className="text-xl md:text-2xl font-bold text-text-primary mb-3">
            รู้ว่าผิดอะไรแล้ว แต่ไม่รู้จะเริ่มตรงไหน?
          </h3>

          <p className="text-text-secondary leading-relaxed mb-6">
            Clairify Action Plan จัดลำดับ {totalIssues} ปัญหาที่พบ
            บอกว่าแก้อะไรก่อนได้ผลมากสุด พร้อมระดับความยาก
            ส่งให้ทีม dev ทำตามได้ทันที
          </p>

          <ul className="space-y-3 mb-6">
            {[
              { icon: '📋', text: 'Priority Roadmap — จัดลำดับ แก้อะไรก่อนได้ผลมากสุด' },
              { icon: '⏱️', text: 'ระดับความยาก — ง่าย / ปานกลาง / ต้องการ developer' },
              { icon: '📊', text: `Score Simulation — แก้แต่ละข้อ คะแนนเพิ่มเท่าไหร่ (${score} → ${predictedScore || '?'})` },
              { icon: '📧', text: 'ส่ง Report ให้ทีมได้ไม่จำกัด — link permanent' },
              { icon: '🔄', text: 'Re-check ฟรี 30 วัน — วัดผลหลังแก้ไข' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                <span className="text-text-primary">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Pricing + CTA */}
        <div className="md:w-64 flex flex-col items-center justify-center text-center md:border-l md:pl-8 border-gray-100">
          <div className="mb-4">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-text-primary">990</span>
              <span className="text-lg text-text-secondary">บาท</span>
            </div>
            <div className="text-sm text-text-secondary line-through">2,500 บาท</div>
            <div className="text-xs text-green-600 font-medium mt-1">ประหยัด 60%</div>
          </div>

          <button
            onClick={handleBuy}
            disabled={loading}
            className="w-full bg-brand-primary text-white px-6 py-3.5 rounded-full font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'กำลังเชื่อมต่อ...' : 'สั่ง Action Plan'}
          </button>

          <p className="text-xs text-text-secondary mt-3">
            ชำระผ่าน Stripe — Visa, MasterCard, PromptPay
          </p>

          <div className="mt-4 text-xs text-text-secondary">
            ที่ปรึกษา SEO คิด 5,000-15,000 บาท<br />
            สำหรับการวิเคราะห์แบบเดียวกัน
          </div>
        </div>
      </div>
    </div>
  );
}
