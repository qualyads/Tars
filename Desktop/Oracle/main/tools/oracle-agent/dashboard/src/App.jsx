import { useState, useEffect, useCallback } from 'react';

const API_BASE = window.location.origin;

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }) {
  const colors = {
    new: { bg: '#e8f5e9', color: '#2e7d32' },
    emailed: { bg: '#e3f2fd', color: '#1565c0' },
    replied: { bg: '#fce4ec', color: '#c62828' },
    qualified: { bg: '#f3e5f5', color: '#6a1b9a' },
  };
  const c = colors[status] || { bg: '#f5f5f5', color: '#616161' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 500 }}>
      {status || 'unknown'}
    </span>
  );
}

function BoolIcon({ value }) {
  return value ? <span style={{ color: '#2e7d32', fontSize: '18px' }}>&#10003;</span> : <span style={{ color: '#bdbdbd' }}>-</span>;
}

export default function App() {
  const [emailStats, setEmailStats] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [emailRes, leadStatsRes, leadsRes] = await Promise.all([
        fetch(`${API_BASE}/api/email/stats`),
        fetch(`${API_BASE}/api/leads/stats`),
        fetch(`${API_BASE}/api/leads`),
      ]);
      const [emailData, leadStatsData, leadsData] = await Promise.all([
        emailRes.json(),
        leadStatsRes.json(),
        leadsRes.json(),
      ]);
      setEmailStats(emailData);
      setLeadStats(leadStatsData);
      setLeads(Array.isArray(leadsData) ? leadsData : leadsData.leads || []);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const syncGmailHistory = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/email/sync-history`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      setSyncResult(data);
      if (data.synced > 0) fetchData();
    } catch (e) {
      setSyncResult({ error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const filteredLeads = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  const totalLeads = leadStats?.total || leads.length;
  const totalEmailed = emailStats?.totalEmailed || 0;
  const totalClicked = emailStats?.totalClicked || 0;
  const clickRate = emailStats?.clickRate || '0%';
  const replied = leads.filter(l => l.status === 'replied').length;

  if (loading) {
    return (
      <div className="loader-wrap">
        <div className="loader" />
        <p style={{ marginTop: '16px', color: '#999' }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Navbar - Relume Application Shell pattern */}
      <header className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <span className="logo-icon">&#x1F4CA;</span>
            <span className="logo-text">Oracle Dashboard</span>
          </div>
          <div className="navbar-right">
            {lastRefresh && (
              <span className="refresh-info">
                Updated: {lastRefresh.toLocaleTimeString('th-TH')}
              </span>
            )}
            <button className="btn-refresh" onClick={fetchData}>Refresh</button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        <div className="container">
          {error && (
            <div className="error-banner">
              API Error: {error}
            </div>
          )}

          {/* Page header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Email Campaign Report</h1>
              <p className="page-desc">Auto-send outreach tracking &mdash; refreshes every 30s</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="btn-sync"
                onClick={syncGmailHistory}
                disabled={syncing}
              >
                {syncing ? 'Syncing...' : 'Sync Gmail History'}
              </button>
              {syncResult && (
                <span style={{ fontSize: '13px', color: syncResult.error ? '#c62828' : '#2e7d32' }}>
                  {syncResult.error ? `Error: ${syncResult.error}` : `Synced ${syncResult.synced} leads (${syncResult.gmailFound} found in Gmail)`}
                </span>
              )}
            </div>
          </div>

          {/* Stat Cards - Relume Stat Card pattern: grid auto-cols-fr */}
          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-label">Total Leads</p>
              <div className="stat-row">
                <h2 className="stat-value">{totalLeads}</h2>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: '100%', background: '#6e49f3' }} />
              </div>
            </div>
            <div className="stat-card">
              <p className="stat-label">Emails Sent</p>
              <div className="stat-row">
                <h2 className="stat-value">{totalEmailed}</h2>
                <span className="stat-badge">{totalLeads ? Math.round((totalEmailed / totalLeads) * 100) : 0}%</span>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${totalLeads ? (totalEmailed / totalLeads) * 100 : 0}%`, background: '#1565c0' }} />
              </div>
            </div>
            <div className="stat-card">
              <p className="stat-label">Link Clicks</p>
              <div className="stat-row">
                <h2 className="stat-value">{totalClicked}</h2>
                <span className="stat-badge">{clickRate}</span>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${totalEmailed ? (totalClicked / totalEmailed) * 100 : 0}%`, background: '#eb3f43' }} />
              </div>
            </div>
            <div className="stat-card">
              <p className="stat-label">Replies</p>
              <div className="stat-row">
                <h2 className="stat-value">{replied}</h2>
                <span className="stat-badge">{totalEmailed ? Math.round((replied / totalEmailed) * 100) : 0}%</span>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${totalEmailed ? (replied / totalEmailed) * 100 : 0}%`, background: '#2e7d32' }} />
              </div>
            </div>
          </div>

          {/* Lead Table - Relume Table pattern */}
          <div className="table-section">
            <div className="table-header">
              <div>
                <h2 className="table-title">Lead Tracking</h2>
                <p className="table-desc">{filteredLeads.length} leads</p>
              </div>
              <div className="filter-group">
                {['all', 'new', 'emailed', 'replied'].map(f => (
                  <button
                    key={f}
                    className={`filter-btn ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Domain</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Sent At</th>
                    <th style={{ textAlign: 'center' }}>Opened</th>
                    <th style={{ textAlign: 'center' }}>Clicked</th>
                    <th style={{ textAlign: 'center' }}>Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        No leads found
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead, i) => {
                      const emailLead = emailStats?.leads?.find(l => l.domain === lead.domain);
                      return (
                        <tr key={lead.domain || i}>
                          <td className="cell-name">{lead.businessName || lead.businessNameEn || '-'}</td>
                          <td className="cell-domain">{lead.domain || '-'}</td>
                          <td className="cell-email">{lead.email || '-'}</td>
                          <td><StatusBadge status={lead.status} /></td>
                          <td>{formatDate(lead.emailSentAt || emailLead?.sentAt)}</td>
                          <td style={{ textAlign: 'center' }}><BoolIcon value={lead.emailOpened || emailLead?.pixelOpen} /></td>
                          <td style={{ textAlign: 'center' }}><BoolIcon value={lead.emailClicked || emailLead?.clicked} /></td>
                          <td style={{ textAlign: 'center' }}>{lead.emailClickCount || emailLead?.clickCount || 0}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Email tracking detail (from /api/email/stats) */}
          {emailStats?.leads?.length > 0 && (
            <div className="table-section" style={{ marginTop: '32px' }}>
              <div className="table-header">
                <div>
                  <h2 className="table-title">Email Tracking Detail</h2>
                  <p className="table-desc">{emailStats.leads.length} tracked &mdash; {emailStats.pixelOpenNote}</p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Domain</th>
                      <th>Status</th>
                      <th>Sent At</th>
                      <th style={{ textAlign: 'center' }}>Pixel Open</th>
                      <th style={{ textAlign: 'center' }}>Clicked</th>
                      <th style={{ textAlign: 'center' }}>Click Count</th>
                      <th>First Click</th>
                      <th>Last Click</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailStats.leads.map((lead, i) => (
                      <tr key={lead.domain || i}>
                        <td className="cell-name">{lead.name}</td>
                        <td className="cell-domain">{lead.domain}</td>
                        <td><StatusBadge status={lead.status} /></td>
                        <td>{formatDate(lead.sentAt)}</td>
                        <td style={{ textAlign: 'center' }}><BoolIcon value={lead.pixelOpen} /></td>
                        <td style={{ textAlign: 'center' }}><BoolIcon value={lead.clicked} /></td>
                        <td style={{ textAlign: 'center' }}>{lead.clickCount || 0}</td>
                        <td>{formatDate(lead.firstClick)}</td>
                        <td>{formatDate(lead.lastClick)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
