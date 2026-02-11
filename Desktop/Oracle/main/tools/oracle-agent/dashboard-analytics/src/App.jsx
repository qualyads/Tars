import { useState, useEffect, useCallback } from 'react';

const API = window.location.origin;

function fmtNum(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH');
}

function fmtDuration(secs) {
  if (!secs) return '0 วินาที';
  if (secs < 60) return Math.round(secs) + ' วินาที';
  const m = Math.floor(secs / 60);
  return `${m} นาที`;
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}`;
}

// ============ HEALTH SCORE ============
function calcHealth(traffic, pagesData, landingData, gscQueries) {
  let score = 100;
  const issues = [];

  // No conversion tracking = -30
  const hasConversions = landingData?.rows?.some(r => r.keyEvents > 0);
  if (!hasConversions) {
    score -= 30;
    issues.push({ severity: 'critical', text: 'ยังไม่ได้ติดตั้งระบบนับลูกค้า (Conversion Tracking)' });
  }

  // 404 pages = -15
  const notFound = (pagesData?.rows || []).filter(r => r.pageTitle === 'Not Found');
  if (notFound.length > 0) {
    score -= 15;
    issues.push({ severity: 'critical', text: `มี ${notFound.length} หน้าที่พัง (เปิดไม่ได้)` });
  }

  // Bounce > 60% = -10
  const bounce = traffic.bounceRate;
  if (bounce > 0.6) {
    score -= 10;
    issues.push({ severity: 'warning', text: `${Math.round(bounce * 100)}% ของคนเข้ามาแล้วออกทันที` });
  }

  // Low traffic = -10
  if ((traffic.sessions || 0) < 100) {
    score -= 10;
    issues.push({ severity: 'warning', text: 'จำนวนคนเข้าเว็บยังน้อยมาก' });
  }

  // Low CTR keywords = -5
  const lowCTR = (gscQueries || []).filter(q => q.impressions >= 50 && q.ctr < 3);
  if (lowCTR.length > 0) {
    score -= 5;
    issues.push({ severity: 'info', text: `เว็บขึ้น Google แล้ว แต่คนไม่คลิกเข้ามา (${lowCTR.length} คำ)` });
  }

  // High bounce landing pages = -10
  const highBounce = (landingData?.rows || []).filter(r => r.sessions >= 2 && r.bounceRate >= 0.9 && r.landingPage && r.landingPage !== '(not set)');
  if (highBounce.length > 0) {
    score -= 10;
    issues.push({ severity: 'warning', text: `${highBounce.length} หน้าที่คน Google เข้ามาแล้วออกทันที` });
  }

  return { score: Math.max(score, 0), issues };
}

function getHealthColor(score) {
  if (score >= 80) return '#2e7d32';
  if (score >= 50) return '#e65100';
  return '#eb3f43';
}

function getHealthLabel(score) {
  if (score >= 80) return 'ดี';
  if (score >= 50) return 'ต้องปรับปรุง';
  return 'ต้องแก้ด่วน';
}

function getHealthEmoji(score) {
  if (score >= 80) return '✅';
  if (score >= 50) return '⚠️';
  return '🔴';
}

// ============ SIDEBAR ============
function Sidebar({ open, onClose }) {
  const links = [
    { label: 'รายงานเว็บ', icon: '📊', href: '/vision/analytics/', active: true },
    { label: 'แผนเติบโต', icon: '🚀', href: '/vision/growthstrategy/' },
    { label: 'อีเมลลูกค้า', icon: '📧', href: '/vision/email/' },
    { label: 'ค่าใช้จ่าย', icon: '💰', href: '/costs/' },
  ];
  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <a className="sidebar-logo" href="/vision/analytics/">
            <span>VXB</span> Report
          </a>
        </div>
        <nav className="sidebar-nav">
          {links.map(l => (
            <a key={l.label} href={l.href} className={l.active ? 'active' : ''}>
              <span style={{ fontSize: 18 }}>{l.icon}</span>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">Oracle Agent — VisionXBrain</div>
      </aside>
    </>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState('28daysAgo');

  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [allPages, setAllPages] = useState(null);
  const [landing, setLanding] = useState(null);
  const [gscQueries, setGscQueries] = useState([]);
  const [gscPages, setGscPages] = useState([]);

  const periodLabel = { '7daysAgo': '7 วัน', '14daysAgo': '14 วัน', '28daysAgo': '28 วัน', '90daysAgo': '90 วัน' };

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    try {
      const [sumRes, trendRes, pagesRes, landRes, gscQRes, gscPRes] = await Promise.all([
        fetch(`${API}/api/ga4/summary?startDate=${period}&endDate=today`).then(r => r.json()),
        fetch(`${API}/api/ga4/trends?startDate=${period}&endDate=today`).then(r => r.json()),
        fetch(`${API}/api/ga4/pages?startDate=${period}&endDate=today&limit=30`).then(r => r.json()),
        fetch(`${API}/api/ga4/landing?startDate=${period}&endDate=today`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/search-console/queries?site=sc-domain:visionxbrain.com&limit=20`).then(r => r.json()),
        fetch(`${API}/api/search-console/pages?site=sc-domain:visionxbrain.com&limit=15`).then(r => r.json()),
      ]);
      setSummary(sumRes);
      setTrends(trendRes);
      setAllPages(pagesRes);
      setLanding(landRes);
      setGscQueries(Array.isArray(gscQRes) ? gscQRes : []);
      setGscPages(Array.isArray(gscPRes) ? gscPRes : []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  if (loading) {
    return (
      <div className="loader-wrap">
        <div className="loader" />
        <div className="loader-text">กำลังโหลดรายงาน...</div>
      </div>
    );
  }

  const traffic = summary?.traffic || summary?.totals || {};
  const topSources = summary?.topSources || [];
  const devices = summary?.devices || [];
  const countries = summary?.countries || [];

  const health = calcHealth(traffic, allPages, landing, gscQueries);
  const healthColor = getHealthColor(health.score);

  // Trend bars (last 14 days)
  const trendRows = (trends?.rows || []).slice(-14);
  const trendMax = Math.max(...trendRows.map(r => r.sessions || 0), 1);

  // Good pages vs problem pages
  const goodPages = (allPages?.rows || []).filter(r => r.pageTitle !== 'Not Found' && r.bounceRate < 0.9 && r.screenPageViews >= 2);
  const problemPages = (allPages?.rows || []).filter(r => r.pageTitle === 'Not Found' || r.bounceRate >= 0.9);

  // Missed opportunities (GSC: high impressions, low clicks)
  const opportunities = gscQueries
    .filter(q => q.impressions >= 10 && q.keys?.[0]?.length < 60)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);

  // Top pages from Google
  const topFromGoogle = gscPages
    .filter(p => p.clicks >= 1)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 6);

  // Landing bounce
  const bounceLandings = (landing?.rows || [])
    .filter(r => r.sessions >= 2 && r.bounceRate >= 0.9 && r.landingPage && r.landingPage !== '' && r.landingPage !== '(not set)');

  return (
    <div className="app-layout">
      <button className="mobile-trigger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-area">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">รายงานเว็บ VisionXBrain</div>
          <div className="topbar-actions">
            <select className="period-select" value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="7daysAgo">7 วัน</option>
              <option value="14daysAgo">14 วัน</option>
              <option value="28daysAgo">28 วัน</option>
              <option value="90daysAgo">90 วัน</option>
            </select>
            <button className={`btn-refresh ${refreshing ? 'loading' : ''}`} onClick={() => fetchData(false)}>
              {refreshing ? '⏳' : '🔄'}
            </button>
          </div>
        </div>

        <div className="content">

          {/* ==================== SECTION 1: HEALTH SCORE ==================== */}
          <div className="health-hero" style={{ borderColor: healthColor }}>
            <div className="health-score-ring" style={{ borderColor: healthColor, color: healthColor }}>
              <div className="health-score-num">{health.score}</div>
              <div className="health-score-label">คะแนน</div>
            </div>
            <div className="health-info">
              <h1 style={{ color: healthColor }}>
                {getHealthEmoji(health.score)} สุขภาพเว็บ: {getHealthLabel(health.score)}
              </h1>
              <p className="health-period">ข้อมูลย้อนหลัง {periodLabel[period] || '28 วัน'}</p>
              <div className="health-issues">
                {health.issues.map((issue, i) => (
                  <div key={i} className={`health-issue ${issue.severity}`}>
                    <span className="issue-dot" />
                    {issue.text}
                  </div>
                ))}
                {health.issues.length === 0 && (
                  <div className="health-issue good"><span className="issue-dot" /> ไม่พบปัญหา</div>
                )}
              </div>
            </div>
          </div>

          {/* ==================== SECTION 2: 4 KPI SIMPLE ==================== */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon">👥</div>
              <div className="kpi-num">{fmtNum(traffic.totalUsers || 0)}</div>
              <div className="kpi-label">คนเข้าชม</div>
              <div className="kpi-sub">ใน {periodLabel[period]}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon">📄</div>
              <div className="kpi-num">{fmtNum(traffic.screenPageViews || 0)}</div>
              <div className="kpi-label">หน้าที่ถูกดู</div>
              <div className="kpi-sub">
                เฉลี่ย {traffic.totalUsers ? ((traffic.screenPageViews || 0) / traffic.totalUsers).toFixed(1) : '0'} หน้า/คน
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon">⏱️</div>
              <div className="kpi-num">{fmtDuration(traffic.averageSessionDuration || 0)}</div>
              <div className="kpi-label">เวลาอยู่ในเว็บ</div>
              <div className="kpi-sub">เฉลี่ยต่อคน</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon">{(traffic.bounceRate || 0) > 0.6 ? '🔴' : '🟢'}</div>
              <div className="kpi-num">{Math.round((traffic.bounceRate || 0) * 100)}%</div>
              <div className="kpi-label">ออกทันที</div>
              <div className="kpi-sub">{(traffic.bounceRate || 0) > 0.6 ? 'สูงกว่าปกติ (ควร < 40%)' : 'อยู่ในเกณฑ์'}</div>
            </div>
          </div>

          {/* ==================== SECTION 3: TREND SIMPLE ==================== */}
          <div className="card">
            <div className="card-header">
              <h2>คนเข้าเว็บรายวัน</h2>
              <span className="card-badge">
                เฉลี่ย {trendRows.length ? Math.round(trendRows.reduce((s, r) => s + (r.sessions || 0), 0) / trendRows.length) : 0} คน/วัน
              </span>
            </div>
            <div className="trend-chart">
              {trendRows.map((r, i) => (
                <div className="trend-col" key={i}>
                  <div className="trend-value">{r.sessions}</div>
                  <div
                    className="trend-bar"
                    style={{
                      height: `${Math.max((r.sessions / trendMax) * 100, 4)}%`,
                      background: r.sessions >= (trendMax * 0.7) ? 'var(--purple)' : r.sessions >= (trendMax * 0.3) ? '#b39ddb' : '#e0e0e0',
                    }}
                  />
                  <div className="trend-label">{formatDate(r.date)}</div>
                </div>
              ))}
              {trendRows.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>ยังไม่มีข้อมูล</div>
              )}
            </div>
          </div>

          {/* ==================== SECTION 4: ACTION ITEMS ==================== */}
          <div className="card">
            <div className="card-header">
              <h2>🎯 สิ่งที่ต้องทำ</h2>
              <span className="card-badge">{health.issues.length} รายการ</span>
            </div>
            <div className="action-list">
              {/* Critical: No conversion */}
              {!landing?.rows?.some(r => r.keyEvents > 0) && (
                <div className="action-card critical">
                  <div className="action-priority">ด่วนมาก</div>
                  <h3>ติดตั้งระบบนับลูกค้า</h3>
                  <p>ตอนนี้ไม่รู้เลยว่าคนกดติดต่อ/กรอกฟอร์มกี่คน เหมือนขายของแต่ไม่นับเงิน</p>
                  <div className="action-how">
                    <strong>วิธีแก้:</strong> ตั้ง Google Analytics Events ให้ track เมื่อคนกดปุ่มติดต่อ, กรอกฟอร์ม, หรือเข้าหน้า Thank You
                  </div>
                </div>
              )}

              {/* Critical: 404 pages */}
              {(allPages?.rows || []).filter(r => r.pageTitle === 'Not Found').length > 0 && (
                <div className="action-card critical">
                  <div className="action-priority">ด่วนมาก</div>
                  <h3>แก้หน้าที่พัง ({(allPages?.rows || []).filter(r => r.pageTitle === 'Not Found').length} หน้า)</h3>
                  <p>มีหน้าเว็บที่เปิดไม่ได้ คนคลิกจาก Google มาเจอหน้าเปล่า แล้วออกไป</p>
                  <div className="action-pages">
                    {(allPages?.rows || []).filter(r => r.pageTitle === 'Not Found').map((p, i) => (
                      <span key={i} className="action-page-tag">❌ {p.pagePath}</span>
                    ))}
                  </div>
                  <div className="action-how">
                    <strong>วิธีแก้:</strong> Redirect URL เก่าไปหน้าที่ถูกต้อง หรือสร้าง content ใหม่
                  </div>
                </div>
              )}

              {/* Warning: Bounce landing pages */}
              {bounceLandings.length > 0 && (
                <div className="action-card warning">
                  <div className="action-priority">ควรแก้</div>
                  <h3>หน้าที่คนเข้ามาแล้วออกทันที ({bounceLandings.length} หน้า)</h3>
                  <p>คน Google เข้ามาแล้วไม่อ่านต่อ อาจเป็นเพราะ content ไม่ตรงที่คนหา หรือไม่มีปุ่มให้ทำอะไรต่อ</p>
                  <div className="action-pages">
                    {bounceLandings.slice(0, 5).map((r, i) => (
                      <span key={i} className="action-page-tag">⚠️ {r.landingPage} ({r.sessions} คน)</span>
                    ))}
                  </div>
                  <div className="action-how">
                    <strong>วิธีแก้:</strong> เพิ่มปุ่ม "ติดต่อเรา" / "ดูผลงาน" ให้ชัดเจน ปรับ content ให้ตรง keyword ที่คนหา
                  </div>
                </div>
              )}

              {/* Info: Low CTR */}
              {opportunities.filter(q => q.impressions >= 50 && q.ctr < 3).length > 0 && (
                <div className="action-card info">
                  <div className="action-priority">โอกาส</div>
                  <h3>เว็บขึ้น Google แล้ว แต่คนไม่คลิก</h3>
                  <p>มีคำค้นที่เว็บขึ้นแสดงแล้วแต่ชื่อไม่ดึงดูดพอ คนเห็นแล้วเลื่อนผ่าน</p>
                  <div className="action-how">
                    <strong>วิธีแก้:</strong> เขียน Title และคำอธิบายใหม่ให้น่าคลิก ใส่ตัวเลขหรือ benefit ที่ชัดเจน
                  </div>
                </div>
              )}

              {/* Info: Low traffic */}
              {(traffic.sessions || 0) < 100 && (
                <div className="action-card info">
                  <div className="action-priority">โอกาส</div>
                  <h3>คนเข้าเว็บยังน้อย</h3>
                  <p>ส่วนใหญ่เป็นคนที่รู้จักเว็บอยู่แล้ว ยังไม่มีช่องทางดึงคนใหม่เข้ามา</p>
                  <div className="action-how">
                    <strong>วิธีแก้:</strong> โพสต์ใน LinkedIn / เขียน Blog ที่ตรง keyword / ลอง Google Ads ทดสอบ
                  </div>
                </div>
              )}

              {health.issues.length === 0 && (
                <div className="action-card good">
                  <h3>✅ ไม่พบปัญหาเร่งด่วน</h3>
                  <p>เว็บอยู่ในสภาพดี ให้โฟกัสเพิ่ม traffic และ conversion</p>
                </div>
              )}
            </div>
          </div>

          {/* ==================== SECTION 5: WHERE PEOPLE COME FROM ==================== */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h2>คนมาจากไหน</h2></div>
              <div className="source-list">
                {topSources.map((s, i) => {
                  const total = topSources.reduce((sum, x) => sum + (x.sessions || 0), 0) || 1;
                  const pct = Math.round((s.sessions / total) * 100);
                  const label = s.sessionSource === '(direct)' ? 'พิมพ์ URL เข้ามาเอง'
                    : s.sessionSource === 'google' && s.sessionMedium === 'organic' ? 'ค้น Google'
                    : s.sessionMedium === 'referral' || s.sessionMedium === 'referral_profile' ? `จากเว็บ ${s.sessionSource}`
                    : s.sessionSource === '(not set)' ? 'ไม่ทราบแหล่ง'
                    : `${s.sessionSource} (${s.sessionMedium})`;
                  return (
                    <div className="source-row" key={i}>
                      <div className="source-info">
                        <span className="source-name">{label}</span>
                        <span className="source-num">{s.sessions} คน</span>
                      </div>
                      <div className="source-bar-bg">
                        <div className="source-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h2>อุปกรณ์ & ประเทศ</h2></div>
              <div className="device-list">
                {devices.map((d, i) => (
                  <div className="device-row" key={i}>
                    <span className="device-icon">
                      {d.deviceCategory === 'desktop' ? '🖥️' : d.deviceCategory === 'mobile' ? '📱' : '📟'}
                    </span>
                    <span className="device-name">
                      {d.deviceCategory === 'desktop' ? 'คอมพิวเตอร์' : d.deviceCategory === 'mobile' ? 'มือถือ' : 'แท็บเล็ต'}
                    </span>
                    <span className="device-num">{fmtNum(d.sessions)} คน</span>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="country-list">
                {countries.slice(0, 4).map((c, i) => (
                  <div className="country-row" key={i}>
                    <span className="country-name">
                      {c.country === 'Thailand' ? '🇹🇭 ไทย'
                        : c.country === 'United States' ? '🇺🇸 สหรัฐฯ'
                        : c.country === 'China' ? '🇨🇳 จีน'
                        : c.country === 'Singapore' ? '🇸🇬 สิงคโปร์'
                        : c.country}
                    </span>
                    <span className="country-num">{fmtNum(c.sessions)} คน</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ==================== SECTION 6: TOP PAGES FROM GOOGLE ==================== */}
          <div className="card">
            <div className="card-header">
              <h2>🏆 หน้าที่คนจาก Google เข้ามามากสุด</h2>
            </div>
            <div className="top-pages-list">
              {topFromGoogle.map((p, i) => {
                const path = p.keys?.[0]?.replace('https://www.visionxbrain.com', '') || '';
                return (
                  <div className="top-page-row" key={i}>
                    <div className="top-page-rank">{i + 1}</div>
                    <div className="top-page-info">
                      <div className="top-page-path">{path}</div>
                      <div className="top-page-stats">
                        {p.clicks} คลิก &middot; {fmtNum(p.impressions)} ครั้งที่ขึ้น Google &middot; อันดับ {p.position?.toFixed(0)}
                      </div>
                    </div>
                    <div className={`top-page-ctr ${p.ctr > 5 ? 'good' : p.ctr > 2 ? 'ok' : 'low'}`}>
                      {p.ctr}% คลิก
                    </div>
                  </div>
                );
              })}
              {topFromGoogle.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>ยังไม่มีข้อมูลจาก Google</div>
              )}
            </div>
          </div>

          {/* ==================== SECTION 7: MISSED OPPORTUNITIES ==================== */}
          <div className="card">
            <div className="card-header">
              <h2>💡 โอกาสที่พลาดไป</h2>
              <span className="card-badge">คำค้นที่เว็บขึ้น Google แล้วแต่คนไม่คลิก</span>
            </div>
            <div className="opp-list">
              {opportunities.map((q, i) => {
                const keyword = q.keys?.[0] || '';
                return (
                  <div className="opp-row" key={i}>
                    <div className="opp-keyword">"{keyword}"</div>
                    <div className="opp-stats">
                      <span>ขึ้น Google <strong>{fmtNum(q.impressions)}</strong> ครั้ง</span>
                      <span>คลิกแค่ <strong>{q.clicks}</strong> ครั้ง ({q.ctr}%)</span>
                      <span>อันดับ {q.position?.toFixed(0)}</span>
                    </div>
                    <div className="opp-bar-bg">
                      <div className="opp-bar-fill" style={{ width: `${Math.min(q.ctr * 5, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==================== SECTION 8: GOOD PAGES ==================== */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h2>✅ หน้าที่ทำได้ดี</h2></div>
              <div className="simple-page-list">
                {goodPages.slice(0, 6).map((p, i) => (
                  <div className="simple-page-row" key={i}>
                    <div className="simple-page-path" title={p.pagePath}>{p.pagePath}</div>
                    <div className="simple-page-meta">
                      {fmtNum(p.screenPageViews)} views &middot; อ่านนาน {fmtDuration(p.averageSessionDuration)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h2>❌ หน้าที่มีปัญหา</h2></div>
              <div className="simple-page-list">
                {problemPages.slice(0, 6).map((p, i) => (
                  <div className="simple-page-row" key={i}>
                    <div className="simple-page-path" title={p.pagePath}>
                      {p.pageTitle === 'Not Found' && <span className="tag-inline error">404</span>}
                      {p.pageTitle !== 'Not Found' && p.bounceRate >= 0.9 && <span className="tag-inline warning">ออกทันที</span>}
                      {p.pagePath}
                    </div>
                    <div className="simple-page-meta">
                      {p.pageTitle === 'Not Found' ? 'หน้าไม่มีอยู่แล้ว' : `${fmtNum(p.sessions)} คนเข้า แต่ไม่ทำอะไร`}
                    </div>
                  </div>
                ))}
                {problemPages.length === 0 && (
                  <div style={{ padding: 16, color: 'var(--green)' }}>ไม่มีหน้าที่มีปัญหา 🎉</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
