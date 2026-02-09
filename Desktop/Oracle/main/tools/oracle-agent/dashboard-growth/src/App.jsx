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

function IdeaCard({ idea, toggleState, onToggle, onExecute, executing }) {
  const score = idea.score || {};
  const s = score.scores || {};
  const rec = score.recommendation || 'MAYBE';
  const badgeClass = rec === 'GO' ? 'badge-go' : rec === 'SKIP' ? 'badge-skip' : 'badge-maybe';
  const ideaKey = (idea.name || '').toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="idea-card">
      <div className="idea-header">
        <div>
          <span className="idea-name">{idea.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`idea-badge ${badgeClass}`}>{rec}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple)' }}>
            {score.totalScore || 0}/100
          </span>
        </div>
      </div>

      <div className="idea-meta">
        {idea.category && <span>Category: {idea.category}</span>}
        {idea.generatedAt && <span>Generated: {timeAgo(idea.generatedAt)}</span>}
      </div>

      <div className="idea-details">
        {idea.problem && <p><strong>Problem:</strong> {idea.problem}</p>}
        {idea.solution && <p><strong>Service:</strong> {idea.solution}</p>}
        {idea.targetUsers && <p><strong>Target:</strong> {idea.targetUsers}</p>}
        {idea.monetization && <p><strong>Revenue:</strong> {idea.monetization}</p>}
        {idea.mvpScope && <p><strong>MVP:</strong> {idea.mvpScope}</p>}
      </div>

      <div className="score-bars">
        <ScoreBar label="Feasibility" value={s.feasibility} color="#4caf50" />
        <ScoreBar label="Market" value={s.marketDemand} color="#2196f3" />
        <ScoreBar label="Revenue" value={s.revenuePotential} color="#ff9800" />
        <ScoreBar label="VXB Fit" value={s.vxbFit} color="var(--purple)" />
        <ScoreBar label="Scale" value={s.scalability} color="#e91e63" />
      </div>

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
          {executing ? 'Executing...' : 'Execute Now'}
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
      showToast(`Master auto-execute: ${newVal ? 'ON' : 'OFF'}`);
    } catch {
      setMasterSwitch(!newVal);
      showToast('Error toggling master switch');
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
      showToast(`${ideaKey}: ${enabled ? 'ON' : 'OFF'}`);
    } catch {
      setToggles(prev => ({ ...prev, [ideaKey]: !enabled }));
      showToast('Error toggling idea');
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
      if (data.success) {
        showToast(`Executed: ${name}`);
        fetchData();
      } else {
        showToast(`Error: ${data.error}`);
      }
    } catch {
      showToast('Execution failed');
    } finally {
      setExecuting(null);
    }
  };

  const handleForceThink = async () => {
    setThinking(true);
    showToast('Oracle is thinking...');
    try {
      const res = await fetch(`${API_BASE}/api/ideas/think`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Thinking complete! Refreshing...');
        fetchData();
      } else {
        showToast(`Think error: ${data.error}`);
      }
    } catch {
      showToast('Thinking failed');
    } finally {
      setThinking(false);
    }
  };

  if (loading) {
    return (
      <div className="loader-wrap">
        <div className="loader" />
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading Growth Strategies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-wrap">
        <h3>Error loading data</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-title">
            <span>VXB</span> Growth Strategy Engine
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
          <span>Last thinking: <strong>{timeAgo(status?.lastThinking)}</strong></span>
          <span>Ideas: <strong>{status?.total || 0}</strong></span>
          <span>Executed: <strong>{status?.executed || 0}</strong></span>
          <span>Master: <strong style={{ color: masterSwitch ? '#4caf50' : '#f44336' }}>
            {masterSwitch ? 'ON' : 'OFF'}
          </strong></span>
        </div>
      </div>

      {/* Content */}
      <div className="content">
        {ideas.length === 0 ? (
          <div className="empty-state">
            <h3>No ideas yet</h3>
            <p>Oracle hasn't generated any growth strategies yet. Click "Force Think Now" to start.</p>
          </div>
        ) : (
          <div className="idea-grid">
            {ideas
              .sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0))
              .map((idea, i) => {
                const ideaKey = (idea.name || '').toLowerCase().replace(/\s+/g, '-');
                return (
                  <IdeaCard
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
        )}

        {/* Force Think */}
        <div className="force-think-bar">
          <button
            className="btn btn-outline"
            onClick={handleForceThink}
            disabled={thinking}
          >
            {thinking ? 'Thinking...' : 'Force Think Now'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
