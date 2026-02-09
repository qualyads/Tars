import { useState, useEffect, useCallback } from 'react';

const API_BASE = window.location.origin;

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

function ScoreBar({ label, value, color }) {
  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <div className="score-bar-bg">
        <div
          className="score-bar-fill"
          style={{ width: `${value || 0}%`, background: color || 'var(--purple)' }}
        />
      </div>
      <span className="score-value">{value || 0}</span>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="toggle-slider" />
    </label>
  );
}

// Phase 1 Progress Card
function PhaseProgress({ ideas }) {
  const phase1Target = { retainer: 5, projects: 5, revenue: 500000 };

  // Count by type
  const retainerPlans = ideas.filter(i => i.type === 'retainer-sales' || (i.name || '').toLowerCase().includes('retainer'));
  const projectPlans = ideas.filter(i => i.type === 'project-closing');
  const doNowCount = ideas.filter(i => (i.score?.recommendation === 'DO NOW')).length;

  return (
    <div className="phase-card">
      <div className="phase-header">
        <h2>Phase 1 — เป้า 500K/เดือน</h2>
        <span className="phase-timeline">เดือน 1-3</span>
      </div>
      <div className="phase-targets">
        <div className="target-item">
          <div className="target-number">{retainerPlans.length}</div>
          <div className="target-label">แผน Retainer</div>
          <div className="target-goal">เป้า: {phase1Target.retainer} ราย</div>
        </div>
        <div className="target-item">
          <div className="target-number">{doNowCount}</div>
          <div className="target-label">DO NOW</div>
          <div className="target-goal">ทำได้เลย</div>
        </div>
        <div className="target-item">
          <div className="target-number">{ideas.length}</div>
          <div className="target-label">แผนทั้งหมด</div>
          <div className="target-goal">Oracle คิดให้</div>
        </div>
      </div>
      <div className="phase-checklist">
        <h4>Checklist สิ่งที่ยังขาด</h4>
        <div className="checklist-item pending">หน้า /services/seo-services</div>
        <div className="checklist-item pending">หน้า /services/monthly-growth-packages</div>
        <div className="checklist-item pending">หน้า /services/content-marketing</div>
        <div className="checklist-item pending">หน้า /services/digital-growth-partner</div>
        <div className="checklist-item pending">Case study มี ROI ตัวเลข</div>
        <div className="checklist-item pending">ลูกค้า retainer ราย 1</div>
      </div>
    </div>
  );
}

function ActionCard({ idea, toggleState, onToggle, onExecute, executing }) {
  const score = idea.score || {};
  const s = score.scores || {};
  const rec = score.recommendation || 'PLAN';
  const badgeClass = rec === 'DO NOW' ? 'badge-go' : rec === 'SKIP' ? 'badge-skip' : 'badge-maybe';
  const ideaKey = (idea.name || '').toLowerCase().replace(/\s+/g, '-');

  const typeLabels = {
    'retainer-sales': 'Retainer',
    'project-closing': 'Project',
    'service-page': 'Service Page',
    'case-study': 'Case Study',
    'outbound': 'Outbound',
  };
  const typeLabel = typeLabels[idea.type] || idea.type || 'Action';

  return (
    <div className="idea-card">
      <div className="idea-header">
        <div>
          <span className="type-tag">{typeLabel}</span>
          <span className="idea-name">{idea.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`idea-badge ${badgeClass}`}>{rec}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple)' }}>
            {score.totalScore || 0}
          </span>
        </div>
      </div>

      {idea.tagline && <p className="idea-tagline">{idea.tagline}</p>}

      <div className="idea-details">
        {idea.problem && <p><strong>Pain:</strong> {idea.problem}</p>}
        {idea.solution && <p><strong>ขายอะไร:</strong> {idea.solution}</p>}
        {idea.targetClient && <p><strong>ขายใคร:</strong> {idea.targetClient}</p>}
        {idea.revenueTarget && <p><strong>เป้ารายได้:</strong> {idea.revenueTarget}</p>}
        {idea.timeToRevenue && <p><strong>เห็นเงินใน:</strong> {idea.timeToRevenue}</p>}
      </div>

      {/* Steps */}
      {idea.steps && idea.steps.length > 0 && (
        <div className="steps-list">
          {idea.steps.map((step, i) => (
            <div key={i} className="step-item">
              <span className="step-num">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Who does what */}
      {(idea.oracleCanDo || idea.tarMustDo) && (
        <div className="who-does">
          {idea.oracleCanDo && (
            <div className="who-item oracle">
              <strong>Oracle:</strong> {idea.oracleCanDo}
            </div>
          )}
          {idea.tarMustDo && (
            <div className="who-item tar">
              <strong>Tar:</strong> {idea.tarMustDo}
            </div>
          )}
        </div>
      )}

      {/* Score bars */}
      <div className="score-bars">
        <ScoreBar label="Speed" value={s.speedToRevenue} color="#f44336" />
        <ScoreBar label="Feasibility" value={s.feasibility} color="#4caf50" />
        <ScoreBar label="Revenue" value={s.revenuePotential} color="#ff9800" />
        <ScoreBar label="Demand" value={s.marketDemand} color="#2196f3" />
        <ScoreBar label="VXB Fit" value={s.vxbFit} color="var(--purple)" />
      </div>

      {score.nextStep && (
        <div className="next-step">
          Next: {score.nextStep}
        </div>
      )}

      <div className="idea-actions">
        <div className="master-toggle">
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Auto-execute</span>
          <Toggle
            checked={toggleState !== false}
            onChange={() => onToggle(ideaKey, toggleState === false)}
          />
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onExecute(idea.name)}
          disabled={executing}
        >
          {executing ? 'Running...' : 'Execute'}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [ideas, setIdeas] = useState([]);
  const [toggles, setToggles] = useState({});
  const [masterSwitch, setMasterSwitch] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [executing, setExecuting] = useState(null);
  const [thinking, setThinking] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [ideasRes, togglesRes] = await Promise.all([
        fetch(`${API_BASE}/api/ideas`),
        fetch(`${API_BASE}/api/ideas/toggles`),
      ]);

      if (!ideasRes.ok || !togglesRes.ok) throw new Error('API Error');

      const ideasData = await ideasRes.json();
      const togglesData = await togglesRes.json();

      setIdeas(ideasData.ideas || []);
      setStatus({
        total: ideasData.total,
        executed: ideasData.executed,
        lastThinking: ideasData.lastThinking,
      });
      setToggles(togglesData.toggles || {});
      setMasterSwitch(togglesData.masterAutoExecute || false);
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

  const handleMasterToggle = async () => {
    const newVal = !masterSwitch;
    setMasterSwitch(newVal);
    try {
      await fetch(`${API_BASE}/api/ideas/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master: newVal }),
      });
      showToast(`Auto-execute: ${newVal ? 'ON' : 'OFF'}`);
    } catch {
      setMasterSwitch(!newVal);
      showToast('Error toggling');
    }
  };

  const handleIdeaToggle = async (ideaKey, enabled) => {
    setToggles(prev => ({ ...prev, [ideaKey]: enabled }));
    try {
      await fetch(`${API_BASE}/api/ideas/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ideaKey, enabled }),
      });
    } catch {
      setToggles(prev => ({ ...prev, [ideaKey]: !enabled }));
    }
  };

  const handleExecute = async (name) => {
    setExecuting(name);
    showToast(`Executing: ${name}...`);
    try {
      const res = await fetch(`${API_BASE}/api/ideas/execute/${encodeURIComponent(name)}`, {
        method: 'POST',
      });
      const data = await res.json();
      showToast(data.success ? `Done: ${name}` : `Error: ${data.error}`);
      fetchData();
    } catch {
      showToast('Execution failed');
    } finally {
      setExecuting(null);
    }
  };

  const handleForceThink = async () => {
    setThinking(true);
    showToast('Oracle กำลังคิดแผน...');
    try {
      const res = await fetch(`${API_BASE}/api/ideas/think`, { method: 'POST' });
      const data = await res.json();
      showToast(data.success ? 'คิดเสร็จ! กำลังโหลด...' : `Error: ${data.error}`);
      fetchData();
    } catch {
      showToast('Failed');
    } finally {
      setThinking(false);
    }
  };

  if (loading) {
    return (
      <div className="loader-wrap">
        <div className="loader" />
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading Growth Tracker...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-wrap">
        <h3>Error</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchData}>Retry</button>
      </div>
    );
  }

  // Separate DO NOW vs PLAN
  const doNow = ideas.filter(i => i.score?.recommendation === 'DO NOW')
    .sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));
  const planLater = ideas.filter(i => i.score?.recommendation !== 'DO NOW')
    .sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-title">
            <span>VXB</span> Growth Tracker
          </div>
          <div className="navbar-actions">
            <div className="master-toggle">
              <span>Auto-Execute</span>
              <Toggle checked={masterSwitch} onChange={handleMasterToggle} />
            </div>
          </div>
        </div>
      </nav>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stats-inner">
          <span>Last scan: <strong>{timeAgo(status?.lastThinking)}</strong></span>
          <span>Actions: <strong>{status?.total || 0}</strong></span>
          <span>DO NOW: <strong style={{ color: '#2e7d32' }}>{doNow.length}</strong></span>
          <span>Auto: <strong style={{ color: masterSwitch ? '#4caf50' : '#f44336' }}>
            {masterSwitch ? 'ON' : 'OFF'}
          </strong></span>
        </div>
      </div>

      {/* Content */}
      <div className="content">
        {/* Phase 1 Progress */}
        <PhaseProgress ideas={ideas} />

        {/* DO NOW section */}
        {doNow.length > 0 && (
          <>
            <h3 className="section-title do-now-title">DO NOW — ทำได้เลยวันนี้</h3>
            <div className="idea-grid">
              {doNow.map((idea, i) => {
                const ideaKey = (idea.name || '').toLowerCase().replace(/\s+/g, '-');
                return (
                  <ActionCard
                    key={ideaKey + i}
                    idea={idea}
                    toggleState={toggles[ideaKey]}
                    onToggle={handleIdeaToggle}
                    onExecute={handleExecute}
                    executing={executing === idea.name}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* PLAN section */}
        {planLater.length > 0 && (
          <>
            <h3 className="section-title">PLAN — วางแผนก่อน</h3>
            <div className="idea-grid">
              {planLater.map((idea, i) => {
                const ideaKey = (idea.name || '').toLowerCase().replace(/\s+/g, '-');
                return (
                  <ActionCard
                    key={ideaKey + i}
                    idea={idea}
                    toggleState={toggles[ideaKey]}
                    onToggle={handleIdeaToggle}
                    onExecute={handleExecute}
                    executing={executing === idea.name}
                  />
                );
              })}
            </div>
          </>
        )}

        {ideas.length === 0 && (
          <div className="empty-state">
            <h3>ยังไม่มีแผน</h3>
            <p>กด "Scan Now" ให้ Oracle คิดแผนหาเงินให้</p>
          </div>
        )}

        <div className="force-think-bar">
          <button
            className="btn btn-primary"
            onClick={handleForceThink}
            disabled={thinking}
          >
            {thinking ? 'กำลังคิด...' : 'Scan Now — หาโอกาสใหม่'}
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
