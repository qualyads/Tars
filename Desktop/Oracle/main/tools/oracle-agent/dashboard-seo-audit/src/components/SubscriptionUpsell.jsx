import { useState } from 'react';

const API = window.location.origin;

export default function SubscriptionUpsell({ url, email }) {
  const [plan, setPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!email) {
      alert('กรุณากรอกอีเมลตอนตรวจ SEO เพื่อสมัครสมาชิก');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/audit/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email, plan }),
      });
      const data = await res.json();

      if (data.alreadySubscribed) {
        alert('คุณสมัครอยู่แล้ว! รายงานจะส่งทุกเดือนอัตโนมัติ');
        setLoading(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
        setLoading(false);
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่');
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[15px] border-2 border-brand-primary/50 bg-gradient-to-br from-red-50 to-white p-6 md:p-8 text-center">
      <div className="inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-1 rounded-full text-sm font-medium mb-4">
        Clairify Monthly
      </div>

      <h3 className="text-2xl font-bold text-text-primary mb-3">
        Clairify ตรวจเว็บทุกเดือน อัตโนมัติ
      </h3>

      <p className="text-text-secondary max-w-lg mx-auto mb-6 leading-relaxed">
        ระบบตรวจเว็บทุกเดือน ส่ง report เปรียบเทียบกับเดือนก่อน
        เห็น trend คะแนน + ปัญหาใหม่ + ปัญหาที่แก้แล้ว — ไม่ต้องจำมาตรวจเอง
      </p>

      {/* Plan toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setPlan('monthly')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            plan === 'monthly'
              ? 'bg-brand-primary text-white'
              : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
          }`}
        >
          รายเดือน
        </button>
        <button
          onClick={() => setPlan('yearly')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            plan === 'yearly'
              ? 'bg-brand-primary text-white'
              : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
          }`}
        >
          รายปี (ลด 17%)
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-3xl font-bold text-text-primary">
          {plan === 'monthly' ? '990' : '9,900'}
        </span>
        <span className="text-lg text-text-secondary">
          บาท/{plan === 'monthly' ? 'เดือน' : 'ปี'}
        </span>
        {plan === 'yearly' && (
          <span className="text-sm text-green-600 font-medium ml-2">ประหยัด 1,980 บาท</span>
        )}
      </div>

      <ul className="text-left max-w-sm mx-auto space-y-2 mb-8 text-sm">
        {[
          'Clairify วิเคราะห์อัตโนมัติทุกเดือน (45+ ข้อ)',
          'รายงานเปรียบเทียบกับเดือนก่อน',
          'เห็น trend คะแนน + ปัญหาใหม่/แก้แล้ว',
          'ส่ง report ทางอีเมลอัตโนมัติ',
          'ยกเลิกเมื่อไหร่ก็ได้',
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-brand-primary mt-0.5">✓</span>
            <span className="text-text-primary">{item}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="bg-brand-primary text-white px-8 py-3 rounded-full font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'กำลังเชื่อมต่อ...' : `สมัคร — ${plan === 'monthly' ? '990 บาท/เดือน' : '9,900 บาท/ปี'}`}
      </button>

      <p className="text-xs text-text-secondary mt-3">
        ชำระผ่าน Stripe — ยกเลิกได้ตลอดเวลา
      </p>
    </div>
  );
}
