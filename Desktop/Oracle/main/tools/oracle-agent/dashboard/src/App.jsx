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
    proposal_sent: { bg: '#ede7f6', color: '#6e49f3' },
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

// ============================================
// DGP Proposal Tab
// ============================================
function DgpTab() {
  const [form, setForm] = useState({ bizName: '', industry: '', domain: '', email: '', context: '' });
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [customParts, setCustomParts] = useState(null);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeView, setActiveView] = useState('form'); // form | preview

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/dgp/sent`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleGenerate = async () => {
    if (!form.bizName) return setError('ต้องใส่ชื่อธุรกิจ');
    setGenerating(true);
    setError(null);
    setSent(null);
    try {
      const res = await fetch(`${API_BASE}/api/dgp/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Generate failed');
        return;
      }
      setPreview(data.htmlPreview);
      setCustomParts(data.customParts);
      setSubject(data.subject);
      setActiveView('preview');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!form.email) return setError('ต้องใส่ email');
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/dgp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bizName: form.bizName,
          email: form.email,
          subject,
          customParts,
          industry: form.industry,
          domain: form.domain,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Send failed');
        return;
      }
      setSent(data);
      fetchHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setForm({ bizName: '', industry: '', domain: '', email: '', context: '' });
    setPreview(null);
    setCustomParts(null);
    setSubject('');
    setSent(null);
    setError(null);
    setActiveView('form');
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 16px',
    border: '1px solid rgba(22,22,22,0.15)',
    borderRadius: '100px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const textareaStyle = {
    ...inputStyle,
    borderRadius: '15px',
    minHeight: '80px',
    resize: 'vertical',
  };

  return (
    <div>
      {/* DGP Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '24px' }}>
        <div className="stat-card">
          <p className="stat-label">Proposals Sent</p>
          <div className="stat-row">
            <h2 className="stat-value">{history.length}</h2>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: '100%', background: '#6e49f3' }} />
          </div>
        </div>
        <div className="stat-card">
          <p className="stat-label">Latest Send</p>
          <div className="stat-row">
            <h2 className="stat-value" style={{ fontSize: '16px' }}>
              {history.length > 0 ? history[history.length - 1].bizName : '-'}
            </h2>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: '100%', background: '#eb3f43' }} />
          </div>
        </div>
      </div>

      {/* Generate Form / Preview */}
      <div className="table-section">
        <div className="table-header">
          <div>
            <h2 className="table-title">
              {activeView === 'form' ? 'Generate DGP Proposal' : 'Preview & Send'}
            </h2>
            <p className="table-desc">
              {activeView === 'form'
                ? 'กรอกข้อมูลธุรกิจ → AI จะ generate proposal ให้'
                : `Subject: ${subject}`}
            </p>
          </div>
          {activeView === 'preview' && (
            <button
              onClick={handleReset}
              style={{
                padding: '8px 20px',
                borderRadius: '100px',
                border: '1px solid rgba(22,22,22,0.15)',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              New Proposal
            </button>
          )}
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{ margin: '12px 20px', padding: '10px 16px', background: '#fce4ec', color: '#c62828', borderRadius: '10px', fontSize: '14px' }}>
            {error}
          </div>
        )}
        {sent && (
          <div style={{ margin: '12px 20px', padding: '10px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '10px', fontSize: '14px' }}>
            Sent to {sent.to} — {sent.attachment !== 'none' ? 'PDF attached' : ''}
          </div>
        )}

        {activeView === 'form' ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'block' }}>Business Name *</label>
                <input
                  style={inputStyle}
                  placeholder="Duke Language School"
                  value={form.bizName}
                  onChange={e => setForm(f => ({ ...f, bizName: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'block' }}>Industry</label>
                <input
                  style={inputStyle}
                  placeholder="โรงเรียนสอนภาษา"
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'block' }}>Domain</label>
                <input
                  style={inputStyle}
                  placeholder="dukelanguage.com"
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'block' }}>Email *</label>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="contact@business.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'block' }}>Context (สิ่งที่คุยกับลูกค้า)</label>
              <textarea
                style={textareaStyle}
                placeholder="ตามที่คุยกัน เน้น ED Visa ลูกค้าต่างชาติ..."
                value={form.context}
                onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleGenerate}
                disabled={generating || !form.bizName}
                style={{
                  padding: '12px 32px',
                  borderRadius: '100px',
                  border: 'none',
                  background: generating ? '#ccc' : 'linear-gradient(135deg, #6e49f3, #5a3dd1)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {generating ? 'AI Generating...' : 'Generate Proposal'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px' }}>
            {/* Subject edit */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'block' }}>Subject</label>
              <input
                style={inputStyle}
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: '#666', marginBottom: '4px', display: 'block' }}>To</label>
              <input
                style={inputStyle}
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* HTML Preview */}
            <div
              style={{
                border: '1px solid rgba(22,22,22,0.1)',
                borderRadius: '15px',
                padding: '24px',
                background: '#fff',
                maxHeight: '500px',
                overflow: 'auto',
                marginBottom: '16px',
              }}
              dangerouslySetInnerHTML={{ __html: preview }}
            />

            {/* Send button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '12px 28px',
                  borderRadius: '100px',
                  border: '1px solid rgba(22,22,22,0.15)',
                  background: '#fff',
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sent || !form.email}
                style={{
                  padding: '12px 32px',
                  borderRadius: '100px',
                  border: 'none',
                  background: sent ? '#2e7d32' : sending ? '#ccc' : 'linear-gradient(135deg, #eb3f43, #d63337)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: sending || sent ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {sent ? 'Sent!' : sending ? 'Sending...' : 'Send Proposal'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sent History Table */}
      {history.length > 0 && (
        <div className="table-section" style={{ marginTop: '24px' }}>
          <div className="table-header">
            <div>
              <h2 className="table-title">Sent History</h2>
              <p className="table-desc">{history.length} proposals sent</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Industry</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={h.trackingId || i}>
                    <td className="cell-name">{h.bizName}</td>
                    <td className="cell-email">{h.email}</td>
                    <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.subject}</td>
                    <td>{h.industry || '-'}</td>
                    <td>{formatDate(h.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Cold Email Tab (Original)
// ============================================
function ColdEmailTab() {
  const [emailStats, setEmailStats] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
        <div className="loader-spinner" />
        <p style={{ marginTop: '16px', color: '#999' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="error-banner">API Error: {error}</div>}

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Auto-send outreach tracking — refreshes every 30s</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-sync" onClick={syncGmailHistory} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Gmail History'}
          </button>
          {syncResult && (
            <span style={{ fontSize: '13px', color: syncResult.error ? '#c62828' : '#2e7d32' }}>
              {syncResult.error ? `Error: ${syncResult.error}` : `Synced ${syncResult.synced} leads`}
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
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

      {/* Lead Table */}
      <div className="table-section">
        <div className="table-header">
          <div>
            <h2 className="table-title">Lead Tracking</h2>
            <p className="table-desc">{filteredLeads.length} leads</p>
          </div>
          <div className="filter-group">
            {['all', 'new', 'emailed', 'replied'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No leads found</td>
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

      {/* Email Tracking Detail */}
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
  );
}

// ============================================
// Main App — Tab Switcher
// ============================================
export default function App() {
  const [activeTab, setActiveTab] = useState('cold');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const tabStyle = (isActive) => ({
    padding: '10px 24px',
    borderRadius: '100px',
    border: 'none',
    background: isActive ? '#1b1c1b' : 'transparent',
    color: isActive ? '#fff' : '#666',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  });

  return (
    <div className="app-shell">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <span className="logo-icon">&#x1F4CA;</span>
            <span className="logo-text">Oracle Dashboard</span>
          </div>
          <div className="navbar-right">
            <span className="refresh-info">
              Updated: {lastRefresh.toLocaleTimeString('th-TH')}
            </span>
            <button className="btn-refresh" onClick={() => setLastRefresh(new Date())}>Refresh</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {/* Page Title + Tab Switcher */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Email & Proposal</h1>
            </div>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f0ee', borderRadius: '100px', padding: '4px' }}>
              <button style={tabStyle(activeTab === 'cold')} onClick={() => setActiveTab('cold')}>
                Cold Email
              </button>
              <button style={tabStyle(activeTab === 'dgp')} onClick={() => setActiveTab('dgp')}>
                DGP Proposal
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'cold' ? <ColdEmailTab /> : <DgpTab />}
        </div>
      </main>
    </div>
  );
}
