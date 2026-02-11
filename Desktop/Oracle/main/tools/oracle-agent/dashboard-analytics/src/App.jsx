import { useState, useEffect, useCallback } from 'react';

const API = window.location.origin;

function timeAgo(d) {
  if (!d) return '-';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'เมื่อกี้';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

function fmtNum(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH');
}

function fmtPct(n) {
  if (n == null) return '-';
  return (n * 100).toFixed(1) + '%';
}

function fmtDuration(secs) {
  if (!secs) return '0s';
  if (secs < 60) return Math.round(secs) + 's';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}`;
}

// ============ SIDEBAR ============
function Sidebar({ open, onClose }) {
  const links = [
    { label: 'Analytics', icon: '📊', href: '/vision/analytics/', active: true },
    { label: 'Growth Strategy', icon: '🚀', href: '/vision/growthstrategy/' },
    { label: 'Email Campaign', icon: '📧', href: '/vision/email/' },
    { label: 'API Costs', icon: '💰', href: '/costs/' },
  ];
  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <a className="sidebar-logo" href="/vision/analytics/">
            <span>VXB</span> Analytics
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
        <div className="sidebar-footer">
          Oracle Agent &middot; VisionXBrain
        </div>
      </aside>
    </>
  );
}

// ============ STAT CARD ============
function StatCard({ label, value, badge, badgeType = 'neutral', progress, progressColor }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-row">
        <div className="stat-value">{value}</div>
        {badge && (
          <span className={`stat-badge ${badgeType}`}>
            {badgeType === 'up' ? '↑' : badgeType === 'down' ? '↓' : ''} {badge}
          </span>
        )}
      </div>
      {progress != null && (
        <div className="stat-progress">
          <div
            className="stat-progress-fill"
            style={{ width: `${Math.min(progress, 100)}%`, background: progressColor || 'var(--purple)' }}
          />
        </div>
      )}
    </div>
  );
}

// ============ BAR CHART ============
function BarChart({ data }) {
  if (!data || !data.length) return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>ไม่มีข้อมูล</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bar-chart" style={{ height: 120 }}>
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div
            className="bar"
            style={{
              height: `${(d.value / max) * 80}px`,
              background: d.color || 'var(--purple)',
            }}
            title={`${d.label}: ${d.value}`}
          />
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============ PROBLEMS SECTION ============
function Problems({ ga4Data, gscData, pagesData, landingData }) {
  const problems = [];

  // 1) No conversion tracking
  const hasConversions = landingData?.rows?.some(r => r.keyEvents > 0);
  if (!hasConversions) {
    problems.push({
      severity: 'critical',
      title: 'ไม่มี Conversion Tracking',
      desc: 'Key Events = 0 ทุกหน้า ไม่รู้ว่า traffic ไหนทำเงิน ต้องตั้ง GA4 events (form submit, CTA click, thank-you pageview)',
      action: 'ตั้ง GA4 Key Events ทันที',
    });
  }

  // 2) 404 pages
  const notFoundPages = pagesData?.rows?.filter(r => r.pageTitle === 'Not Found') || [];
  if (notFoundPages.length > 0) {
    problems.push({
      severity: 'critical',
      title: `Blog 404 — ${notFoundPages.length} หน้าพัง`,
      desc: notFoundPages.map(p => p.pagePath).join(', '),
      action: 'Redirect หรือสร้างหน้าใหม่',
    });
  }

  // 3) High bounce landing pages from organic
  const highBounceLandings = landingData?.rows?.filter(r =>
    r.sessions >= 2 && r.bounceRate >= 0.9 && r.landingPage !== '' && r.landingPage !== '(not set)'
  ) || [];
  if (highBounceLandings.length > 0) {
    problems.push({
      severity: 'warning',
      title: `Landing Pages Bounce 100% — ${highBounceLandings.length} หน้า`,
      desc: highBounceLandings.map(r => `${r.landingPage} (${r.sessions} sessions)`).join(', '),
      action: 'ปรับ CTA, content ให้ตรง search intent',
    });
  }

  // 4) Low CTR keywords
  const lowCTR = gscData?.filter(q => q.impressions >= 50 && q.ctr < 3) || [];
  if (lowCTR.length > 0) {
    problems.push({
      severity: 'warning',
      title: `SEO CTR ต่ำ — ${lowCTR.length} keywords มี impression เยอะแต่ไม่คลิก`,
      desc: lowCTR.map(q => `"${q.keys[0]}" (${q.impressions} imp, CTR ${q.ctr}%)`).join(' | '),
      action: 'เขียน Title + Meta Description ใหม่',
    });
  }

  // 5) Low traffic overall
  const totalSessions = ga4Data?.totals?.sessions || 0;
  if (totalSessions < 100) {
    problems.push({
      severity: 'info',
      title: `Traffic ต่ำ — ${totalSessions} sessions ใน 28 วัน`,
      desc: 'ยังไม่มี Growth Engine ที่ชัดเจน ส่วนใหญ่เป็น Direct traffic',
      action: 'เปิด channel ใหม่: Content, LinkedIn, Email, Paid',
    });
  }

  if (problems.length === 0) {
    return (
      <div className="section">
        <div className="section-header"><h2>สุขภาพเว็บ</h2></div>
        <div className="problem-list" style={{ color: 'var(--green)', fontWeight: 600, padding: 24 }}>
          ไม่พบปัญหาร้ายแรง
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-header">
        <h2>ปัญหาที่ต้องแก้ ({problems.length})</h2>
        <span className="tag error">{problems.filter(p => p.severity === 'critical').length} ร้ายแรง</span>
      </div>
      <div className="problem-list">
        {problems.map((p, i) => (
          <div className="problem-item" key={i}>
            <div className={`problem-severity ${p.severity}`} />
            <div>
              <div className="problem-title">{p.title}</div>
              <div className="problem-desc">{p.desc}</div>
              <div className="problem-action">→ {p.action}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [period, setPeriod] = useState('28daysAgo');

  // Data states
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [allPages, setAllPages] = useState(null);
  const [landing, setLanding] = useState(null);
  const [gscQueries, setGscQueries] = useState(null);
  const [gscPages, setGscPages] = useState(null);

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
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  // Derived data
  const traffic = summary?.traffic || summary?.totals || {};
  const topSources = summary?.topSources || [];
  const devices = summary?.devices || [];
  const countries = summary?.countries || [];

  const trendBars = (trends?.rows || []).slice(-14).map(r => ({
    label: formatDate(r.date),
    value: r.sessions || 0,
    color: 'var(--purple)',
  }));

  const engagementPct = traffic.engagementRate ? (traffic.engagementRate * 100) : 0;
  const bouncePct = traffic.bounceRate ? (traffic.bounceRate * 100) : 0;

  if (loading) {
    return (
      <div className="loader-wrap">
        <div className="loader" />
        <div className="loader-text">กำลังโหลด Analytics...</div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <button className="mobile-trigger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-area">
        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-title">
            📊 VisionXBrain Analytics
          </div>
          <div className="topbar-actions">
            <span className="last-updated">อัพเดท: {timeAgo(lastUpdated)}</span>
            <select className="period-select" value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="7daysAgo">7 วัน</option>
              <option value="14daysAgo">14 วัน</option>
              <option value="28daysAgo">28 วัน</option>
              <option value="90daysAgo">90 วัน</option>
            </select>
            <button className={`btn-refresh ${refreshing ? 'loading' : ''}`} onClick={() => fetchData(false)}>
              {refreshing ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>

        <div className="content">
          {/* === KPI STAT CARDS === */}
          <div className="stat-grid">
            <StatCard
              label="Sessions"
              value={fmtNum(traffic.sessions)}
              badge={traffic.sessions < 100 ? 'ต่ำ' : null}
              badgeType={traffic.sessions < 100 ? 'down' : 'up'}
              progress={Math.min((traffic.sessions || 0) / 5, 100)}
              progressColor="var(--purple)"
            />
            <StatCard
              label="Users"
              value={fmtNum(traffic.totalUsers)}
              progress={Math.min((traffic.totalUsers || 0) / 4, 100)}
              progressColor="var(--blue)"
            />
            <StatCard
              label="Engagement Rate"
              value={engagementPct.toFixed(1) + '%'}
              badge={engagementPct < 50 ? 'ต่ำกว่าเกณฑ์' : 'ดี'}
              badgeType={engagementPct < 50 ? 'down' : 'up'}
              progress={engagementPct}
              progressColor={engagementPct < 50 ? 'var(--orange)' : 'var(--green)'}
            />
            <StatCard
              label="Bounce Rate"
              value={bouncePct.toFixed(1) + '%'}
              badge={bouncePct > 60 ? 'สูง' : 'ปกติ'}
              badgeType={bouncePct > 60 ? 'down' : 'up'}
              progress={bouncePct}
              progressColor={bouncePct > 60 ? 'var(--red)' : 'var(--green)'}
            />
          </div>

          {/* === PROBLEMS === */}
          <Problems ga4Data={summary} gscData={gscQueries} pagesData={allPages} landingData={landing} />

          {/* === TRAFFIC TRENDS === */}
          <div className="section">
            <div className="section-header">
              <h2>Traffic Trend (Sessions / วัน)</h2>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Avg: {trendBars.length ? Math.round(trendBars.reduce((s, b) => s + b.value, 0) / trendBars.length) : 0}/วัน
              </span>
            </div>
            <BarChart data={trendBars} />
          </div>

          {/* === TWO COLUMN: Sources + Devices === */}
          <div className="grid-2">
            {/* Traffic Sources */}
            <div className="section">
              <div className="section-header"><h2>Traffic Sources</h2></div>
              <div className="section-body">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source / Medium</th>
                      <th>Sessions</th>
                      <th>Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSources.map((s, i) => (
                      <tr key={i}>
                        <td><strong>{s.sessionSource}</strong> / {s.sessionMedium}</td>
                        <td>{fmtNum(s.sessions)}</td>
                        <td>
                          <span className={`tag ${s.engagementRate > 0.4 ? 'success' : s.engagementRate > 0 ? 'warning' : 'error'}`}>
                            {fmtPct(s.engagementRate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {topSources.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>ไม่มีข้อมูล</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Devices + Countries */}
            <div className="section">
              <div className="section-header"><h2>Devices & Countries</h2></div>
              <div className="section-body">
                <table className="data-table">
                  <thead>
                    <tr><th>Device</th><th>Sessions</th><th>Bounce</th></tr>
                  </thead>
                  <tbody>
                    {devices.map((d, i) => (
                      <tr key={i}>
                        <td>{d.deviceCategory === 'desktop' ? '🖥️' : d.deviceCategory === 'mobile' ? '📱' : '📟'} {d.deviceCategory}</td>
                        <td>{fmtNum(d.sessions)}</td>
                        <td>{fmtPct(d.bounceRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="data-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr><th>Country</th><th>Sessions</th><th>Users</th></tr>
                  </thead>
                  <tbody>
                    {countries.slice(0, 5).map((c, i) => (
                      <tr key={i}>
                        <td>{c.country}</td>
                        <td>{fmtNum(c.sessions)}</td>
                        <td>{fmtNum(c.totalUsers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* === TOP PAGES === */}
          <div className="section">
            <div className="section-header"><h2>Top Pages (GA4)</h2></div>
            <div className="section-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Title</th>
                    <th>Views</th>
                    <th>Sessions</th>
                    <th>Avg Duration</th>
                    <th>Bounce</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(allPages?.rows || []).slice(0, 15).map((p, i) => (
                    <tr key={i}>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.pagePath}
                      </td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.pageTitle}
                      </td>
                      <td>{fmtNum(p.screenPageViews)}</td>
                      <td>{fmtNum(p.sessions)}</td>
                      <td>{fmtDuration(p.averageSessionDuration)}</td>
                      <td>{fmtPct(p.bounceRate)}</td>
                      <td>
                        {p.pageTitle === 'Not Found'
                          ? <span className="tag error">404</span>
                          : p.bounceRate >= 0.9
                            ? <span className="tag warning">High Bounce</span>
                            : <span className="tag success">OK</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* === TWO COLUMN: GSC Keywords + GSC Pages === */}
          <div className="grid-2">
            {/* Search Console Keywords */}
            <div className="section">
              <div className="section-header"><h2>Search Keywords (GSC)</h2></div>
              <div className="section-body">
                <table className="data-table">
                  <thead>
                    <tr><th>Keyword</th><th>Clicks</th><th>Imp</th><th>CTR</th><th>Pos</th></tr>
                  </thead>
                  <tbody>
                    {gscQueries.filter(q => q.clicks > 0 || q.impressions >= 20).slice(0, 15).map((q, i) => (
                      <tr key={i}>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.keys?.[0]}
                        </td>
                        <td><strong>{q.clicks}</strong></td>
                        <td>{fmtNum(q.impressions)}</td>
                        <td>
                          <span className={`tag ${q.ctr > 5 ? 'success' : q.ctr > 2 ? 'warning' : 'error'}`}>
                            {q.ctr}%
                          </span>
                        </td>
                        <td>{q.position?.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Search Console Pages */}
            <div className="section">
              <div className="section-header"><h2>Top Pages (GSC)</h2></div>
              <div className="section-body">
                <table className="data-table">
                  <thead>
                    <tr><th>Page</th><th>Clicks</th><th>Imp</th><th>CTR</th><th>Pos</th></tr>
                  </thead>
                  <tbody>
                    {gscPages.slice(0, 10).map((p, i) => {
                      const path = p.keys?.[0]?.replace('https://www.visionxbrain.com', '') || p.keys?.[0];
                      return (
                        <tr key={i}>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={path}>
                            {path}
                          </td>
                          <td><strong>{p.clicks}</strong></td>
                          <td>{fmtNum(p.impressions)}</td>
                          <td>
                            <span className={`tag ${p.ctr > 5 ? 'success' : p.ctr > 2 ? 'warning' : 'error'}`}>
                              {p.ctr}%
                            </span>
                          </td>
                          <td>{p.position?.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* === LANDING PAGES === */}
          <div className="section">
            <div className="section-header"><h2>Landing Pages (หน้าแรกที่คนเข้ามา)</h2></div>
            <div className="section-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Landing Page</th>
                    <th>Sessions</th>
                    <th>Engagement</th>
                    <th>Bounce</th>
                    <th>Avg Duration</th>
                    <th>Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {(landing?.rows || []).slice(0, 12).map((r, i) => (
                    <tr key={i}>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.landingPage || '(not set)'}
                      </td>
                      <td>{fmtNum(r.sessions)}</td>
                      <td>
                        <span className={`tag ${r.engagementRate > 0.4 ? 'success' : r.engagementRate > 0 ? 'warning' : 'error'}`}>
                          {fmtPct(r.engagementRate)}
                        </span>
                      </td>
                      <td>{fmtPct(r.bounceRate)}</td>
                      <td>{fmtDuration(r.averageSessionDuration)}</td>
                      <td>
                        {r.keyEvents > 0
                          ? <span className="tag success">{r.keyEvents}</span>
                          : <span className="tag neutral" style={{ background: '#f5f5f5', color: '#999' }}>0</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
