import { useState, useEffect, useCallback } from 'react';
import { Badge, Button } from '@relume_io/relume-ui';
import {
  BiCheckCircle,
  BiDownArrowAlt,
  BiPlay,
  BiRocket,
  BiTargetLock,
  BiUpArrowAlt,
} from '@oracle/shared/components/Icons';
import {
  AppSidebar,
  Topbar,
  StatCard,
  StatCardProgress,
  LoadingScreen,
  timeAgo,
} from '@oracle/shared';

const API_BASE = window.location.origin;

// ============ Phase 1 Progress (Stat3 pattern) ============
function PhaseProgress({ ideas }) {
  const retainerPlans = ideas.filter(i => i.type === 'retainer-sales' || (i.name || '').toLowerCase().includes('retainer'));
  const doNowCount = ideas.filter(i => i.score?.recommendation === 'DO NOW').length;

  const stats = [
    {
      title: 'แผน Retainer',
      value: `${retainerPlans.length}`,
      icon: <BiTargetLock />,
      badge: 'เป้า: 5 ราย',
      progress: Math.min((retainerPlans.length / 5) * 100, 100),
    },
    {
      title: 'DO NOW',
      value: `${doNowCount}`,
      icon: <BiUpArrowAlt />,
      badge: 'ทำได้เลย',
      progress: doNowCount > 0 ? Math.min(doNowCount * 20, 100) : 0,
    },
    {
      title: 'แผนทั้งหมด',
      value: `${ideas.length}`,
      icon: <BiRocket />,
      badge: 'Oracle คิดให้',
      progress: Math.min(ideas.length * 10, 100),
    },
  ];

  const checklist = [
    'หน้า /services/seo-services',
    'หน้า /services/monthly-growth-packages',
    'หน้า /services/content-marketing',
    'หน้า /services/digital-growth-partner',
    'Case study มี ROI ตัวเลข',
    'ลูกค้า retainer ราย 1',
  ];

  return (
    <section className="mb-8">
      <div className="mb-5 grid auto-cols-fr grid-cols-1 items-end gap-4 md:mb-6 md:grid-cols-[1fr_max-content] md:gap-6">
        <div className="w-full max-w-lg">
          <h1 className="text-xl font-bold md:text-2xl">Phase 1 — เป้า 500K/เดือน</h1>
          <p className="mt-2 text-text-secondary">เดือน 1-3</p>
        </div>
      </div>
      <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
        {stats.map((stat, i) => (
          <StatCardProgress key={i} {...stat} />
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
        <div className="p-6">
          <p className="mb-3 text-sm font-semibold">Checklist สิ่งที่ยังขาด</p>
          <div className="flex flex-col gap-2">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="size-4 shrink-0 text-brand-primary">&#9675;</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ Score Bar ============
function ScoreBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-text-secondary">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-background-secondary">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${value || 0}%`, background: color || '#1b1c1b' }}
        />
      </div>
      <span className="w-6 text-right text-xs font-semibold">{value || 0}</span>
    </div>
  );
}

// ============ Action Card (Relume border style) ============
function ActionCard({ idea, toggleState, onToggle, onExecute, executing }) {
  const score = idea.score || {};
  const s = score.scores || {};
  const rec = score.recommendation || 'PLAN';

  const badgeVariant = rec === 'DO NOW' ? 'default' : 'secondary';
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
    <div className="overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
      <div className="p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
            <span className="font-bold">{idea.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariant}>{rec}</Badge>
            <span className="text-sm font-bold">{score.totalScore || 0}</span>
          </div>
        </div>

        {idea.tagline && <p className="mb-3 text-sm italic text-text-secondary">{idea.tagline}</p>}

      <div className="mb-4 space-y-1 text-sm">
        {idea.problem && <p><strong>Pain:</strong> {idea.problem}</p>}
        {idea.solution && <p><strong>ขายอะไร:</strong> {idea.solution}</p>}
        {idea.targetClient && <p><strong>ขายใคร:</strong> {idea.targetClient}</p>}
        {idea.revenueTarget && <p><strong>เป้ารายได้:</strong> {idea.revenueTarget}</p>}
        {idea.timeToRevenue && <p><strong>เห็นเงินใน:</strong> {idea.timeToRevenue}</p>}
      </div>

      {idea.steps && idea.steps.length > 0 && (
        <div className="mb-4 space-y-2">
          {idea.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {(idea.oracleCanDo || idea.tarMustDo) && (
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {idea.oracleCanDo && (
            <div className="rounded bg-system-success-green-light p-3 text-sm">
              <strong>Oracle:</strong> {idea.oracleCanDo}
            </div>
          )}
          {idea.tarMustDo && (
            <div className="rounded bg-brand-primary/5 p-3 text-sm">
              <strong>Tar:</strong> {idea.tarMustDo}
            </div>
          )}
        </div>
      )}

      {/* Score bars */}
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        <ScoreBar label="Speed" value={s.speedToRevenue} color="#b42318" />
        <ScoreBar label="Feasibility" value={s.feasibility} color="#027a48" />
        <ScoreBar label="Revenue" value={s.revenuePotential} color="#eb3f43" />
        <ScoreBar label="Demand" value={s.marketDemand} color="#df6c68" />
        <ScoreBar label="VXB Fit" value={s.vxbFit} color="#eb3f43" />
      </div>

      {score.nextStep && (
        <div className="mb-4 rounded bg-brand-primary/5 p-3 text-sm font-semibold text-brand-primary">
          Next: {score.nextStep}
        </div>
      )}

        <div className="flex items-center justify-between border-t border-border-primary pt-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Auto-execute</span>
            <input
              type="checkbox"
              className="size-4 accent-[#eb3f43]"
              checked={toggleState !== false}
              onChange={() => onToggle(ideaKey, toggleState === false)}
            />
          </label>
          <Button size="sm" onClick={() => onExecute(idea.name)} disabled={executing}>
            <BiPlay className="mr-1 size-4" />
            {executing ? 'Running...' : 'Execute'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
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
    return <LoadingScreen message="Loading Growth Tracker..." />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h3 className="text-lg font-bold text-system-error-red">Error</h3>
        <p className="text-sm">{error}</p>
        <Button onClick={fetchData}>Retry</Button>
      </div>
    );
  }

  const doNow = ideas.filter(i => i.score?.recommendation === 'DO NOW')
    .sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));
  const planLater = ideas.filter(i => i.score?.recommendation !== 'DO NOW')
    .sort((a, b) => (b.score?.totalScore || 0) - (a.score?.totalScore || 0));

  return (
    <AppSidebar activePath="/vision/growthstrategy/">
      <div className="relative flex-1 bg-background-secondary">
        <Topbar title="VXB Growth Tracker" onRefresh={fetchData} refreshing={false}>
          <label className="flex items-center gap-2 text-sm">
            <span>Auto-Execute</span>
            <input
              type="checkbox"
              className="size-4 accent-[#eb3f43]"
              checked={masterSwitch}
              onChange={handleMasterToggle}
            />
          </label>
        </Topbar>
        <div className="h-[calc(100vh-4.5rem)] overflow-auto">
          <div className="container px-6 py-8 md:px-8 md:py-10 lg:py-12">

            {/* Stats bar */}
            <section className="mb-8">
              <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
                <StatCard
                  title="Last Scan"
                  value={timeAgo(status?.lastThinking)}
                  badge="Auto"
                />
                <StatCard
                  title="Actions"
                  value={`${status?.total || 0}`}
                  badge={`${doNow.length} DO NOW`}
                />
                <StatCard
                  title="Auto-Execute"
                  value={masterSwitch ? 'ON' : 'OFF'}
                  icon={masterSwitch ? <BiUpArrowAlt /> : <BiDownArrowAlt />}
                  badge={masterSwitch ? 'Active' : 'Inactive'}
                />
              </div>
            </section>

            {/* Phase 1 Progress */}
            <PhaseProgress ideas={ideas} />

            {/* DO NOW section */}
            {doNow.length > 0 && (
              <section className="mb-8">
                <div className="mb-4 flex items-center gap-2 border-b-2 border-system-success-green pb-2">
                  <BiCheckCircle className="size-5 text-system-success-green" />
                  <h2 className="font-bold text-system-success-green">DO NOW — ทำได้เลยวันนี้</h2>
                </div>
                <div className="flex flex-col gap-4">
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
              </section>
            )}

            {/* PLAN section */}
            {planLater.length > 0 && (
              <section className="mb-8">
                <div className="mb-4 border-b-2 border-border-primary pb-2">
                  <h2 className="font-bold text-text-secondary">PLAN — วางแผนก่อน</h2>
                </div>
                <div className="flex flex-col gap-4">
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
              </section>
            )}

            {ideas.length === 0 && (
              <div className="py-16 text-center">
                <h3 className="mb-2 text-lg font-bold">ยังไม่มีแผน</h3>
                <p className="text-sm text-text-secondary">กด "Scan Now" ให้ Oracle คิดแผนหาเงินให้</p>
              </div>
            )}

            {/* Force think */}
            <div className="flex justify-center py-6">
              <Button onClick={handleForceThink} disabled={thinking}>
                <BiRocket className="mr-2 size-4" />
                {thinking ? 'กำลังคิด...' : 'Scan Now — หาโอกาสใหม่'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="toast-notification">{toast}</div>}
    </AppSidebar>
  );
}
