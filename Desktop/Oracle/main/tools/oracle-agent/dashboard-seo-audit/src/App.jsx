import { useState, useCallback, useEffect } from 'react';
import { Button } from '@relume_io/relume-ui';
import { BiCheck } from 'react-icons/bi';
import HeroSection from './components/HeroSection';
import AnalyzingSpinner from './components/AnalyzingSpinner';
import ScoreGauge from './components/ScoreGauge';
import FindingCard from './components/FindingCard';
import UpsellSection from './components/UpsellSection';
import SubscriptionUpsell from './components/SubscriptionUpsell';
import SeoContent from './components/SeoContent';

const API = window.location.origin;
const STORAGE_KEY = 'clairify_api_key';

function getStoredApiKey() {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}
function storeApiKey(key) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch {}
}

const CAT_ICONS = {
  'seo-onpage': '🔍', 'technical': '⚙️', 'performance': '⚡',
  'security': '🔒', 'content': '📝', 'mobile-social': '📱',
};

const FREE_FIX_LIMIT = 3; // Show "วิธีแก้" free for top 3 findings only

// ============ SHARE SCORE ============
function ShareScore({ score, grade, url, auditId }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/tools/clairify/report/${auditId}`;

  const handleShare = async () => {
    const shareData = {
      title: `Clairify™ — ${url} ได้ ${score}/100 (${grade})`,
      text: `เว็บ ${url} ได้คะแนน ${score}/100 เกรด ${grade} — ลองตรวจเว็บของคุณฟรี!`,
      url: shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch { /* fallback */ }
    }
  };

  return (
    <button
      onClick={handleShare}
      className="mt-6 inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-text-primary px-5 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95"
    >
      {copied ? (
        <><span className="text-green-600">✓</span> คัดลอกลิงก์แล้ว!</>
      ) : (
        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> แชร์ผลวิเคราะห์</>
      )}
    </button>
  );
}

// ============ SCORE CONTEXT (Benchmark) ============
function ScoreContext({ score, grade }) {
  let message, percentile;
  if (score >= 85) { message = 'ดีกว่าเว็บไซต์ส่วนใหญ่ในไทย'; percentile = 'top 10%'; }
  else if (score >= 70) { message = 'อยู่ในเกณฑ์ดี แต่ยังปรับปรุงได้อีกมาก'; percentile = 'top 30%'; }
  else if (score >= 55) { message = 'ต่ำกว่าค่าเฉลี่ย — มีโอกาสปรับปรุงสูง'; percentile = 'เฉลี่ย'; }
  else { message = 'ต้องแก้ไขด่วน — อาจเสีย traffic มากกว่า 40%'; percentile = 'ต่ำกว่าเกณฑ์'; }

  return (
    <div className="mt-6 bg-gray-50 rounded-[12px] px-4 py-3 inline-block">
      <p className="text-sm text-text-secondary">
        <span className="font-bold text-text-primary">{score}/100</span> — {message}
        <span className="text-xs ml-2 bg-white px-2 py-0.5 rounded-full border border-gray-200">{percentile}</span>
      </p>
    </div>
  );
}

// ============ SCORE SIMULATION ============
function ScoreSimulation({ score, predictedScore, failCount, warnCount }) {
  const totalIssues = (failCount || 0) + (warnCount || 0);
  if (!predictedScore || predictedScore <= score || totalIssues === 0) return null;
  const diff = predictedScore - score;

  return (
    <section className="relative overflow-hidden py-10 px-4">
      <div className="absolute inset-0 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50" />
      <div className="relative max-w-3xl mx-auto text-center">
        <p className="text-sm text-green-800 font-medium mb-4">
          ถ้าแก้ปัญหาทั้ง {totalIssues} ข้อ คะแนนจะเพิ่มเป็น
        </p>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-text-primary">{score}</div>
            <div className="text-xs text-text-secondary mt-1">ตอนนี้</div>
          </div>
          <div className="flex flex-col items-center">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-green-600">{predictedScore}</div>
            <div className="text-xs text-green-600 font-medium mt-1">+{diff} คะแนน</div>
          </div>
        </div>
        <p className="text-xs text-green-700/70 mt-4">
          * ประมาณการจาก weighted scoring 6 หมวด
        </p>
      </div>
    </section>
  );
}

// ============ MINI VXB CTA (after findings, before scrolling too far) ============
function MiniServicesCTA() {
  return (
    <div className="rounded-[15px] bg-background-alternative text-white p-6 text-center">
      <p className="text-white/60 text-xs mb-1">ไม่อยากแก้เอง?</p>
      <p className="font-bold text-lg mb-3">ให้ทีม VisionXBrain ช่วยแก้ทั้งหมด</p>
      <div className="flex flex-col sm:flex-row justify-center gap-2">
        <a
          href="https://www.visionxbrain.com/seo-that-we-use-ourselves"
          target="_blank"
          rel="noopener"
          className="bg-brand-primary text-white px-6 py-2.5 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
        >
          ปรึกษาฟรี — ดูบริการ SEO
        </a>
        <a
          href="https://www.visionxbrain.com/services/website"
          target="_blank"
          rel="noopener"
          className="bg-white/10 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-white/20 transition-colors border border-white/20"
        >
          ออกแบบเว็บไซต์
        </a>
      </div>
    </div>
  );
}

// ============ VXB SERVICES CTA (full) ============
function ServicesCTA() {
  return (
    <section className="py-12 px-4 bg-background-alternative text-white">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-white/60 text-sm mb-2">ไม่อยากแก้เอง?</p>
        <h3 className="text-2xl md:text-3xl font-bold mb-4">
          ให้ทีม VisionXBrain ช่วยแก้ทั้งหมด
        </h3>
        <p className="text-white/70 max-w-lg mx-auto mb-8 leading-relaxed">
          ด้วยประสบการณ์จากลูกค้ากว่า 80 ราย ใน 6 ประเทศ
          เราจะปรับเว็บไซต์ให้ได้คะแนน A+ ตั้งแต่เดือนแรก
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <a href="https://www.visionxbrain.com/seo-that-we-use-ourselves" target="_blank" rel="noopener"
            className="bg-brand-primary text-white px-8 py-3.5 rounded-full font-bold text-lg hover:opacity-90 transition-opacity">
            ดูบริการ SEO
          </a>
          <a href="https://www.visionxbrain.com/services/website" target="_blank" rel="noopener"
            className="bg-white/10 text-white border border-white/20 px-8 py-3.5 rounded-full font-bold text-lg hover:bg-white/20 transition-colors">
            ออกแบบเว็บไซต์
          </a>
        </div>
        <p className="text-white/40 text-xs mt-6">ปรึกษาฟรี ไม่มีค่าใช้จ่าย — ตอบภายใน 24 ชั่วโมง</p>
      </div>
    </section>
  );
}

// ============ CATEGORY FINDINGS GROUP ============
function CategoryGroup({ cat, findings, freeFixIds, isPaid }) {
  const catColor = cat.score >= 80 ? '#027a48' : cat.score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <span className="text-lg">{CAT_ICONS[cat.category]}</span>
        <h4 className="font-bold text-text-primary text-base">{cat.nameTh}</h4>
        <span
          className="text-xs px-2.5 py-0.5 rounded-full font-bold ml-auto"
          style={{ backgroundColor: catColor + '12', color: catColor }}
        >
          {cat.score}/100
        </span>
      </div>
      <div className="space-y-3 stagger">
        {findings.map((f, i) => (
          <FindingCard
            key={f.id}
            finding={f}
            index={i}
            showFix={isPaid || freeFixIds.has(f.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ============ UNLOCK FIXES CTA (between findings and pass) ============
function UnlockFixesCTA({ lockedCount, auditId, onBuy, loading }) {
  if (lockedCount <= 0) return null;

  return (
    <div className="mt-8 rounded-[15px] border-2 border-brand-primary/30 bg-gradient-to-r from-red-50 to-white p-5 text-center">
      <p className="text-lg font-bold text-text-primary mb-1">
        🔒 ปลดล็อควิธีแก้ทั้ง {lockedCount} ข้อ
      </p>
      <p className="text-sm text-text-secondary mb-4">
        Action Plan จัดลำดับความสำคัญ + บอกระดับความยาก + วิธีแก้ทุกข้อ
      </p>
      <button
        onClick={onBuy}
        disabled={loading}
        className="bg-brand-primary text-white px-6 py-2.5 rounded-full font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'กำลังเชื่อมต่อ...' : 'สั่ง Action Plan — 990 บาท'}
      </button>
      <p className="text-xs text-text-secondary mt-2">รายงานจะหมดอายุใน 7 วัน — Action Plan เก็บถาวร</p>
    </div>
  );
}

// ============ STICKY BOTTOM BAR ============
function StickyBar({ failCount, warnCount, auditId }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const totalIssues = (failCount || 0) + (warnCount || 0);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBuy = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/audit/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else setLoading(false);
    } catch { setLoading(false); }
  };

  if (!visible || totalIssues === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 py-3 px-4 animate-slideUp">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-bold text-text-primary">พบ {totalIssues} ปัญหา</span>
          <span className="text-text-secondary hidden sm:inline"> — ปลดล็อควิธีแก้ทั้งหมด</span>
        </div>
        <button
          onClick={handleBuy}
          disabled={loading}
          className="bg-brand-primary text-white px-5 py-2 rounded-full font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '...' : 'Action Plan — 990฿'}
        </button>
      </div>
    </div>
  );
}

// ============ RESULTS VIEW ============
function ResultsView({ result, email }) {
  const {
    score, grade, businessName, url, totalChecks, passCount, failCount, warnCount,
    freeFindings, passFindings, auditId, categoryScores, predictedScore, paid,
  } = result;

  const [buyLoading, setBuyLoading] = useState(false);
  const isPaid = !!paid;

  // Top 3 findings (highest severity) get free how-to-fix
  const freeFixIds = new Set();
  if (!isPaid) {
    const sorted = [...freeFindings].sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 };
      return (sev[b.severity] || 0) - (sev[a.severity] || 0);
    });
    sorted.slice(0, FREE_FIX_LIMIT).forEach(f => freeFixIds.add(f.id));
  }
  const lockedCount = isPaid ? 0 : freeFindings.filter(f => f.howToFix && !freeFixIds.has(f.id)).length;

  // Group findings by category
  const categoryGroups = (categoryScores || [])
    .map(cat => ({ cat, issues: freeFindings.filter(f => f.category === cat.category) }))
    .filter(g => g.issues.length > 0);

  const handleBuyActionPlan = async () => {
    setBuyLoading(true);
    try {
      const res = await fetch(`${API}/api/audit/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      });
      const data = await res.json();
      if (data.alreadyPaid) {
        window.location.href = `/tools/clairify/report/${auditId}`;
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
        setBuyLoading(false);
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อได้');
      setBuyLoading(false);
    }
  };

  return (
    <>
      {/* Paid badge */}
      {isPaid && (
        <div className="bg-green-50 border-b border-green-200 py-3 px-4 text-center">
          <span className="text-green-700 font-medium text-sm">✓ Action Plan — ปลดล็อคแล้ว</span>
        </div>
      )}

      {/* ===== SCORE HEADER ===== */}
      <section className="bg-white py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-text-secondary text-sm mb-2">ผลการวิเคราะห์ Clairify™</p>
          <h2 className="text-2xl font-bold text-text-primary mb-1">{businessName || url}</h2>
          <p className="text-sm text-text-secondary mb-8 break-all">{url}</p>

          <ScoreGauge score={score} grade={grade} />

          {/* Benchmark context — Fix #2 */}
          <ScoreContext score={score} grade={grade} />

          {/* Summary Stats */}
          <div className="flex justify-center gap-8 mt-6">
            {[
              { n: passCount, label: 'ผ่าน', color: 'text-green-600' },
              { n: warnCount, label: 'ควรปรับ', color: 'text-amber-500' },
              { n: failCount, label: 'ต้องแก้', color: 'text-red-600' },
              { n: totalChecks, label: 'ตรวจทั้งหมด', color: 'text-text-primary' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.n}</div>
                <div className="text-xs text-text-secondary">{s.label}</div>
              </div>
            ))}
          </div>

          <ShareScore score={score} grade={grade} url={url} auditId={auditId} />
        </div>
      </section>

      {/* ===== SCORE SIMULATION (now counts fail + warn) ===== */}
      <ScoreSimulation score={score} predictedScore={predictedScore} failCount={failCount} warnCount={warnCount} />

      {/* ===== CATEGORY BREAKDOWN ===== */}
      {categoryScores && categoryScores.length > 0 && (
        <section className="bg-white py-10 px-4 border-t border-gray-100">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-text-primary mb-1">คะแนนแยกตามหมวด</h3>
            <p className="text-sm text-text-secondary mb-6">แต่ละหมวดมีน้ำหนักต่างกันตามความสำคัญ</p>
            <div className="grid md:grid-cols-2 gap-3">
              {categoryScores.map(cat => {
                const color = cat.score >= 80 ? '#027a48' : cat.score >= 60 ? '#f59e0b' : cat.score >= 40 ? '#ef4444' : '#b42318';
                return (
                  <div key={cat.category} className="rounded-[12px] border border-gray-200 p-4 bg-white hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-text-primary text-sm">
                        {CAT_ICONS[cat.category]} {cat.nameTh}
                      </span>
                      <span className="text-xs text-text-secondary bg-gray-50 px-2 py-0.5 rounded-full">
                        น้ำหนัก {cat.weight}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cat.score}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-sm font-bold min-w-[28px] text-right" style={{ color }}>{cat.score}</span>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-green-600">✓ {cat.passCount}</span>
                      {cat.warnCount > 0 && <span className="text-amber-500">! {cat.warnCount}</span>}
                      {cat.failCount > 0 && <span className="text-red-600">✕ {cat.failCount}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== ALL FINDINGS — GROUPED BY CATEGORY ===== */}
      {freeFindings.length > 0 && (
        <section className="bg-background-secondary py-10 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-text-primary">
                ปัญหาที่พบ — {freeFindings.length} ข้อ
              </h3>
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                เห็นครบทุกข้อ
              </span>
            </div>
            <p className="text-sm text-text-secondary mb-8">
              {isPaid
                ? 'Action Plan — วิธีแก้ไขปลดล็อคทั้งหมดแล้ว'
                : `วิธีแก้ฟรี ${FREE_FIX_LIMIT} ข้อสำคัญสุด — ที่เหลืออยู่ใน Action Plan`
              }
            </p>

            {categoryGroups.map(({ cat, issues }) => (
              <CategoryGroup
                key={cat.category}
                cat={cat}
                findings={issues}
                freeFixIds={freeFixIds}
                isPaid={isPaid}
              />
            ))}

            {/* Unlock CTA — right after findings */}
            {!isPaid && (
              <UnlockFixesCTA
                lockedCount={lockedCount}
                auditId={auditId}
                onBuy={handleBuyActionPlan}
                loading={buyLoading}
              />
            )}

            {/* Mini VXB CTA — Fix #5: put services CTA EARLY */}
            <div className="mt-8">
              <MiniServicesCTA />
            </div>
          </div>
        </section>
      )}

      {/* ===== PASS FINDINGS ===== */}
      {passFindings && passFindings.length > 0 && (
        <section className="bg-white py-10 px-4">
          <div className="max-w-3xl mx-auto">
            <details>
              <summary className="cursor-pointer text-lg font-bold text-text-primary mb-4 hover:text-brand-primary transition-colors select-none">
                ผ่านแล้ว {passFindings.length} ข้อ ✓
              </summary>
              <div className="space-y-2 mt-4">
                {passFindings.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-sm py-2.5 px-3 bg-green-50 rounded-[8px]">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-text-primary">{f.titleTh || f.title}</span>
                    <span className="text-xs text-text-secondary ml-auto">{CAT_ICONS[f.category]}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>
      )}

      {/* ===== ACTION PLAN UPSELL ===== */}
      {!isPaid && (
        <section className="py-10 px-4 bg-background-secondary">
          <div className="max-w-3xl mx-auto">
            <UpsellSection
              auditId={auditId}
              failCount={failCount}
              warnCount={warnCount}
              score={score}
              predictedScore={predictedScore}
            />
          </div>
        </section>
      )}

      {/* ===== VXB SERVICES CTA (full) ===== */}
      <ServicesCTA />

      {/* ===== MONTHLY MONITORING ===== */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <SubscriptionUpsell url={url} email={email} />
        </div>
      </section>

      {/* ===== STICKY BOTTOM BAR ===== */}
      {!isPaid && <StickyBar failCount={failCount} warnCount={warnCount} auditId={auditId} />}
    </>
  );
}

// ============ PRICING PAGE — Relume Pricing 10 pattern (3-col) ============
function PricingPlanCard({ plan, onBuy, loading }) {
  return (
    <div className={`relative flex h-full flex-col justify-between rounded border px-6 py-8 md:p-8 transition-all duration-200 hover:shadow-lg ${
      plan.isPopular
        ? 'border-border-primary bg-background-alternative text-text-alternative ring-2 ring-brand-primary'
        : 'border-border-primary bg-white'
    }`}>
      {plan.isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-brand-primary text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
            ยอดนิยม
          </span>
        </div>
      )}
      <div>
        {/* Plan header */}
        <div className="mb-6 text-center md:mb-8">
          <p className={`text-sm font-medium mb-2 ${plan.isPopular ? 'text-white/60' : 'text-text-secondary'}`}>
            {plan.tagline}
          </p>
          <h6 className="text-md font-bold leading-[1.4] md:text-xl">{plan.planName}</h6>
          <h1 className="my-2 text-6xl font-bold md:text-8xl lg:text-9xl">
            ฿{plan.price.toLocaleString()}
          </h1>
          <p className={plan.isPopular ? 'text-white/50 text-sm' : 'text-text-secondary text-sm'}>
            {plan.priceNote}
          </p>
        </div>
        {/* Divider */}
        <div className={`mb-6 border-t ${plan.isPopular ? 'border-white/10' : 'border-border-primary'}`} />
        {/* Features */}
        <div className="mb-8 grid grid-cols-1 gap-4 py-2">
          {plan.features.map((feature, index) => (
            <div key={index} className="flex self-start">
              <div className="mr-4 flex-none self-start">
                <BiCheck className={`size-6 ${plan.isPopular ? 'text-brand-primary' : 'text-green-600'}`} />
              </div>
              <p className={`text-sm ${plan.isPopular ? 'text-white/80' : 'text-text-secondary'}`}>{feature}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Button
          onClick={() => onBuy(plan.id)}
          disabled={!!loading}
          className="w-full"
          variant={plan.isPopular ? 'primary' : 'secondary'}
        >
          {loading === plan.id ? 'กำลังเชื่อมต่อ...' : plan.buttonTitle}
        </Button>
      </div>
    </div>
  );
}

function PricingPage({ tiers, onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');

  const handleBuy = async (tierId) => {
    if (!email) { setError('กรุณาใส่อีเมลก่อน'); return; }
    setLoading(tierId);
    setError('');
    try {
      const res = await fetch(`${API}/api/clairify/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId, email }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else { setError(data.error || 'ไม่สามารถเชื่อมต่อ Stripe ได้'); setLoading(''); }
    } catch { setError('เกิดข้อผิดพลาด'); setLoading(''); }
  };

  const handleRecover = async () => {
    if (!recoverEmail) return;
    try {
      const res = await fetch(`${API}/api/clairify/recover-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail }),
      });
      const data = await res.json();
      if (data.apiKey) {
        storeApiKey(data.apiKey);
        window.location.href = '/tools/clairify/';
      } else { setError('ไม่พบ API key สำหรับอีเมลนี้'); }
    } catch { setError('เกิดข้อผิดพลาด'); }
  };

  const pricingPlans = [
    {
      id: 'quick-pass',
      planName: 'Quick Pass',
      tagline: 'จ่ายครั้งเดียว',
      price: 99,
      priceNote: '50 audits — ฿2 ต่อครั้ง · ไม่หมดอายุ',
      buttonTitle: 'ซื้อ Quick Pass',
      isPopular: false,
      features: [
        '50 เครดิต ใช้วิเคราะห์เว็บได้ 50 ครั้ง',
        'ไม่มีวันหมดอายุ — ใช้เมื่อไหร่ก็ได้',
        'ใช้ได้ทันทีหลังชำระเงิน',
        'ส่งผลวิเคราะห์ทางอีเมล',
      ],
    },
    {
      id: 'pro',
      planName: 'Pro',
      tagline: 'สำหรับธุรกิจ',
      price: 490,
      priceNote: 'ต่อเดือน — Unlimited · ยกเลิกได้ทุกเมื่อ',
      buttonTitle: 'เริ่มต้นใช้งาน Pro',
      isPopular: true,
      features: [
        'วิเคราะห์ได้ไม่จำกัดจำนวน',
        'ส่ง PDF report ให้ลูกค้าของคุณ',
        'ส่งผลทางอีเมลอัตโนมัติ',
        'Priority support ตอบภายใน 24 ชม.',
        'ดู dashboard สรุปผลทุกเว็บ',
      ],
    },
    {
      id: 'agency',
      planName: 'Agency',
      tagline: 'สำหรับ Agency / Freelancer',
      price: 1990,
      priceNote: 'ต่อเดือน — White-label · ยกเลิกได้ทุกเมื่อ',
      buttonTitle: 'เลือก Agency',
      isPopular: false,
      features: [
        'Unlimited audits — ไม่จำกัด',
        'White-label report ใส่โลโก้คุณเอง',
        'Custom branding — สี + ชื่อบริษัท',
        'API access สำหรับ automation',
        'Bulk audit วิเคราะห์หลายเว็บพร้อมกัน',
        'ส่ง report ในชื่อบริษัทคุณ',
      ],
    },
  ];

  return (
    <section className="px-[5%] py-16 md:py-24 lg:py-28">
      <div className="container max-w-6xl">
        {/* Header */}
        <div className="mx-auto mb-8 max-w-lg text-center md:mb-12">
          <p className="mb-3 font-semibold text-brand-primary md:mb-4">ลิมิตฟรีหมดแล้ว</p>
          <h2 className="mb-5 text-5xl font-bold md:mb-6 md:text-7xl lg:text-8xl">
            อัปเกรด
          </h2>
          <p className="md:text-md text-text-secondary">
            เลือกแพ็กเกจที่เหมาะกับคุณ — ชำระผ่าน PromptPay หรือบัตรเครดิต
          </p>
        </div>

        {/* Email input */}
        <div className="mx-auto mb-10 max-w-md">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="อีเมลของคุณ"
            className="w-full px-6 py-4 bg-background-secondary border border-border-primary rounded-md text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary text-center"
          />
          {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
        </div>

        {/* Pricing cards — Relume Pricing 10 grid, 3 cols */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <PricingPlanCard key={index} plan={plan} onBuy={handleBuy} loading={loading} />
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-text-secondary">
          {[
            'ชำระปลอดภัยผ่าน Stripe',
            'รองรับ PromptPay',
            'ยกเลิกได้ทุกเมื่อ',
            'ได้ API key ทันที',
          ].map(t => (
            <span key={t} className="flex items-center gap-2">
              <BiCheck className="size-5 text-green-600" />
              {t}
            </span>
          ))}
        </div>

        {/* Recovery + Back */}
        <div className="mt-8 text-center space-y-3">
          {!recoverMode ? (
            <button onClick={() => setRecoverMode(true)} className="text-sm text-text-secondary hover:text-brand-primary transition-colors underline underline-offset-4">
              มี API key อยู่แล้ว? กู้คืนด้วยอีเมล
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
              <input
                type="email" value={recoverEmail} onChange={e => setRecoverEmail(e.target.value)}
                placeholder="อีเมลที่ใช้ซื้อ"
                className="flex-1 px-4 py-2.5 border border-border-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <Button onClick={handleRecover} variant="secondary" size="sm">กู้คืน</Button>
            </div>
          )}
          <div>
            <button onClick={onBack} className="text-sm text-text-secondary/60 hover:text-text-secondary transition-colors">
              ← กลับหน้าหลัก
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ CREDIT SUCCESS PAGE ============
function CreditSuccessPage() {
  const [status, setStatus] = useState('verifying');
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) { setStatus('error'); return; }

    fetch(`${API}/api/clairify/credit-verify?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.apiKey) {
          storeApiKey(data.apiKey);
          setInfo(data);
          setStatus('success');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'verifying') {
    return (
      <section className="py-20 px-4 text-center">
        <div className="loader-spinner mx-auto mb-4" />
        <p className="text-text-secondary">กำลังยืนยันการชำระเงิน...</p>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="py-20 px-4 text-center">
        <div className="text-5xl mb-4">⚠</div>
        <h2 className="text-xl font-bold text-text-primary mb-2">ไม่สามารถยืนยันได้</h2>
        <p className="text-text-secondary mb-6">กรุณาลองใหม่หรือติดต่อ support</p>
        <a href="/tools/clairify/" className="bg-background-alternative text-white px-6 py-3 rounded-full font-bold">
          กลับหน้าหลัก
        </a>
      </section>
    );
  }

  return (
    <section className="py-20 px-4 text-center">
      <div className="text-6xl mb-6">✓</div>
      <h2 className="text-2xl font-bold text-text-primary mb-3">อัปเกรดสำเร็จ!</h2>
      <p className="text-text-secondary mb-2">
        แพ็กเกจ: <strong className="text-text-primary">{info?.tier}</strong>
        {info?.credits > 0 && <> — เครดิต: <strong className="text-text-primary">{info.credits}</strong></>}
        {info?.credits === -1 && <> — <strong className="text-green-600">Unlimited</strong></>}
      </p>
      <p className="text-sm text-text-secondary mb-8">
        API key ถูกบันทึกในเบราว์เซอร์แล้ว — วิเคราะห์ได้ไม่จำกัดลิมิต
      </p>
      <a href="/tools/clairify/" className="bg-brand-primary text-white px-8 py-3.5 rounded-full font-bold text-lg hover:opacity-90 transition-opacity">
        เริ่มวิเคราะห์เลย
      </a>
      <div className="mt-6 bg-gray-50 rounded-[12px] p-4 max-w-sm mx-auto">
        <p className="text-xs text-text-secondary mb-1">API Key ของคุณ (เก็บไว้ปลอดภัย)</p>
        <code className="text-xs text-text-primary break-all select-all">{info?.apiKey}</code>
      </div>
    </section>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [analyzingUrl, setAnalyzingUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [apiKey] = useState(getStoredApiKey);
  const [rateLimitTiers, setRateLimitTiers] = useState(null);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    const path = window.location.pathname;

    // Credit purchase success
    if (path.includes('/credit-success')) {
      setState('credit-success');
      return;
    }

    if (path.includes('/subscription/success')) {
      setState('sub-success');
      return;
    }

    // Load credit info if has API key
    if (apiKey) {
      fetch(`${API}/api/clairify/key-info?apiKey=${apiKey}`)
        .then(r => r.json())
        .then(d => { if (d.credits !== undefined) setCredits(d.credits); })
        .catch(() => {});
    }

    const reportMatch = path.match(/\/report\/([a-f0-9-]+)/);
    if (reportMatch) {
      const auditId = reportMatch[1];
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');

      setState('report-loading');

      (async () => {
        try {
          if (sessionId) {
            await fetch(`${API}/api/audit/checkout/verify?session_id=${sessionId}`);
          }
          const res = await fetch(`${API}/api/audit/report/${auditId}`);
          const data = await res.json();
          if (!res.ok || data.error) {
            setErrorMsg(data.error || 'ไม่พบรายงาน');
            setState('error');
            return;
          }
          setResult(data);
          setState('done');
        } catch {
          setErrorMsg('ไม่สามารถโหลดรายงานได้');
          setState('error');
        }
      })();
    }
  }, []);

  const handleSubmit = useCallback(async (url, email) => {
    setState('loading');
    setAnalyzingUrl(url);
    setErrorMsg('');
    if (email) setUserEmail(email);

    const storedKey = getStoredApiKey();
    try {
      const res = await fetch(`${API}/api/audit/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email: email || undefined, apiKey: storedKey || undefined }),
      });
      const data = await res.json();

      // Rate limited → show pricing
      if (res.status === 429 && data.code === 'rate-limit') {
        setRateLimitTiers(data.tiers || null);
        setState('rate-limited');
        return;
      }

      if (!res.ok || data.error) {
        setErrorMsg(data.errorTh || data.error || `เว็บไซต์ไม่ตอบสนอง (${res.status})`);
        setState('error');
        return;
      }
      // Update credits from response
      if (data.credits !== undefined) setCredits(data.credits);
      setResult(data);
      setState('done');
      window.history.pushState({}, '', `/tools/clairify/report/${data.auditId}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMsg('ไม่สามารถเชื่อมต่อ server ได้ กรุณาลองใหม่');
      setState('error');
    }
  }, []);

  const handleReset = () => {
    setState('idle');
    setResult(null);
    setAnalyzingUrl('');
    setErrorMsg('');
    window.history.pushState({}, '', '/tools/clairify/');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="bg-background-alternative px-4 py-3 flex items-center justify-between">
        <a href="https://visionxbrain.com" target="_blank" rel="noopener" className="flex items-center gap-2">
          <img src="/logo.svg" alt="VXB" className="h-8" onError={(e) => { e.target.style.display = 'none'; }} />
        </a>
        <div className="flex items-center gap-3">
          {credits !== null && (
            <span className="text-xs bg-white/10 text-white/80 px-3 py-1 rounded-full">
              {credits === -1 ? '∞ Unlimited' : `${credits} credits`}
            </span>
          )}
          {(state === 'done' || state === 'error' || state === 'rate-limited') && (
            <button
              onClick={handleReset}
              className="text-white/70 hover:text-white text-sm px-4 py-1.5 border border-white/20 rounded-full transition-colors"
            >
              วิเคราะห์เว็บใหม่
            </button>
          )}
        </div>
      </nav>

      {state === 'idle' && (
        <>
          <HeroSection onSubmit={handleSubmit} loading={false} />
          <SeoContent />
        </>
      )}

      {state === 'loading' && (
        <section className="bg-white min-h-[70vh] flex items-center justify-center">
          <AnalyzingSpinner url={analyzingUrl} />
        </section>
      )}

      {state === 'report-loading' && (
        <section className="bg-white min-h-[70vh] flex items-center justify-center">
          <div className="text-center">
            <div className="loader-spinner mx-auto mb-4" />
            <p className="text-text-secondary">กำลังโหลดรายงาน...</p>
          </div>
        </section>
      )}

      {state === 'rate-limited' && (
        <PricingPage tiers={rateLimitTiers} onBack={handleReset} />
      )}

      {state === 'credit-success' && <CreditSuccessPage />}

      {state === 'error' && (
        <>
          <section className="bg-white py-16 px-4 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-5xl mb-4">⚠</div>
              <h2 className="text-xl font-bold text-text-primary mb-2">ไม่สามารถวิเคราะห์ได้</h2>
              <p className="text-text-secondary mb-6">{errorMsg}</p>
              <button onClick={handleReset} className="bg-background-alternative text-text-alternative px-6 py-3 rounded-full font-bold hover:opacity-90 transition-opacity">
                ลองใหม่
              </button>
            </div>
          </section>
          <SeoContent />
        </>
      )}

      {state === 'sub-success' && (
        <section className="bg-white py-20 px-4 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">✓</div>
            <h2 className="text-2xl font-bold text-text-primary mb-3">สมัครสำเร็จ!</h2>
            <p className="text-text-secondary mb-2">Clairify จะวิเคราะห์เว็บของคุณทุกเดือนอัตโนมัติ</p>
            <p className="text-text-secondary mb-8">รายงานเปรียบเทียบจะส่งเข้าอีเมลทุกต้นเดือน</p>
            <button onClick={handleReset} className="bg-background-alternative text-text-alternative px-6 py-3 rounded-full font-bold hover:opacity-90 transition-opacity">
              วิเคราะห์เว็บอื่น
            </button>
          </div>
        </section>
      )}

      {state === 'done' && result && <ResultsView result={result} email={userEmail} />}

      <footer className="bg-background-alternative text-white/50 py-6 px-4 text-center text-sm">
        <p>Clairify™ by{' '}<a href="https://visionxbrain.com" target="_blank" rel="noopener" className="text-white/70 hover:text-white">VisionXBrain</a> — Digital Growth Partner</p>
      </footer>
    </div>
  );
}
