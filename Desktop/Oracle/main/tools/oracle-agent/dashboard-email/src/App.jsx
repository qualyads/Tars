import { useState, useEffect, useCallback } from 'react';
import {
  AppSidebar, Topbar, StatCard, StatCardProgress, SectionHeader,
  DataTable, LoadingScreen, fmtNum, fmtDateISO, timeAgo,
} from '@oracle/shared';

const API = window.location.origin;

/* ── helpers ─────────────────────────────────────────────── */

function statusLabel(s) {
  const map = {
    emailed: 'ส่งแล้ว',
    bounced: 'Bounce',
    replied: 'ตอบกลับ',
    audit_sent: 'ส่ง Audit แล้ว',
    clicked: 'คลิกลิงก์',
    closed: 'ปิดดีล',
    new: 'ใหม่',
    followedUp: 'Follow-up',
  };
  return map[s] || s;
}

function statusColor(s) {
  const map = {
    emailed: 'bg-blue-100 text-blue-700',
    bounced: 'bg-red-100 text-red-700',
    replied: 'bg-green-100 text-green-700',
    audit_sent: 'bg-emerald-100 text-emerald-700',
    clicked: 'bg-amber-100 text-amber-700',
    closed: 'bg-purple-100 text-purple-700',
    new: 'bg-gray-100 text-gray-600',
  };
  return map[s] || 'bg-gray-100 text-gray-600';
}

function pctOf(part, total) {
  if (!total) return '0%';
  return ((part / total) * 100).toFixed(1) + '%';
}

/* ── Section: Hero KPIs ──────────────────────────────────── */

function HeroKPIs({ leads, email }) {
  const total = leads?.total || 0;
  const emailed = email?.totalEmailed || 0;
  const clicked = email?.totalClicked || 0;
  const replied = leads?.replied || 0;
  const clickRate = emailed ? ((clicked / emailed) * 100).toFixed(1) + '%' : '0%';

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard title="ลีดทั้งหมด" value={fmtNum(total)} badge="all-time" />
      <StatCard title="ส่งอีเมลแล้ว" value={fmtNum(emailed)} badge={pctOf(emailed, total) + ' of total'} />
      <StatCard title="คลิกลิงก์" value={fmtNum(clicked)} badge={clickRate + ' click rate'} />
      <StatCard title="ตอบกลับ" value={fmtNum(replied)} badge={replied > 0 ? pctOf(replied, emailed) + ' reply rate' : 'ยังไม่มี'} />
    </div>
  );
}

/* ── Section: Replies ──────────────────────────────────── */

function RepliesSection({ replies, loading: repliesLoading }) {
  if (repliesLoading) {
    return (
      <section className="mb-8 overflow-hidden rounded-[15px] border-2 border-green-200 bg-white shadow-xxs">
        <SectionHeader title="ข้อความตอบกลับ" description="กำลังโหลด..." />
        <div className="p-6 text-center text-text-secondary">กำลังดึงข้อความ...</div>
      </section>
    );
  }

  if (!replies || replies.length === 0) {
    return (
      <section className="mb-8 overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
        <SectionHeader title="ข้อความตอบกลับ" description="ยังไม่มีใครตอบกลับ" />
        <div className="p-6 text-center text-text-secondary">ยังไม่มีการตอบกลับ — ระบบจะเช็คทุก 3 ชม.</div>
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-[15px] border-2 border-green-300 bg-white shadow-xxs">
      <div className="flex items-center gap-2 border-b border-border-primary bg-green-50 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white text-sm font-bold">
          {replies.length}
        </div>
        <div>
          <h3 className="text-base font-bold text-green-800">ข้อความตอบกลับ</h3>
          <p className="text-xs text-green-600">ลูกค้าที่ตอบกลับ email ของเรา</p>
        </div>
      </div>
      <div className="divide-y divide-border-primary">
        {replies.map((r, i) => (
          <div key={i} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-text-primary">{r.businessName}</h4>
                  {r.classification === 'interested' && (
                    <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">สนใจ</span>
                  )}
                  {r.classification === 'declined' && (
                    <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">ปฏิเสธ</span>
                  )}
                  {r.classification === 'auto_reply' && (
                    <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Auto-reply</span>
                  )}
                  {r.auditSentAt && (
                    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Audit ส่งแล้ว</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {r.industry && (
                    <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{r.industry}</span>
                  )}
                  <span className="text-xs text-text-secondary">{r.email}</span>
                  {r.domain && (
                    <a href={`https://${r.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-primary hover:underline">{r.domain}</a>
                  )}
                </div>
              </div>
              <span className="text-xs text-text-secondary whitespace-nowrap">
                {r.repliedAt ? timeAgo(r.repliedAt) : ''}
              </span>
            </div>
            {r.replySubject && (
              <p className="mb-2 text-sm font-medium text-text-primary">Re: {r.replySubject}</p>
            )}
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
              {r.replyBody ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                  {r.replyBody.length > 500 ? r.replyBody.substring(0, 500) + '...' : r.replyBody}
                </p>
              ) : r.replySnippet ? (
                <p className="text-sm leading-relaxed text-text-secondary italic">{r.replySnippet}</p>
              ) : (
                <p className="text-sm text-text-secondary italic">เปิดดูใน Gmail เพื่ออ่านข้อความเต็ม</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Section: Lead Pipeline Funnel ───────────────────────── */

function PipelineFunnel({ leads, email }) {
  const stages = [
    { label: 'ลีดทั้งหมด', value: leads?.total || 0, color: '#d4d4d4' },
    { label: 'เป้าหมายดี', value: leads?.goodTargets || 0, color: '#a3a3a3' },
    { label: 'ส่งอีเมล', value: email?.totalEmailed || 0, color: '#737373' },
    { label: 'คลิกลิงก์', value: email?.totalClicked || 0, color: '#eb3f43' },
    { label: 'ตอบกลับ', value: leads?.replied || 0, color: '#027a48' },
    { label: 'ปิดดีล', value: leads?.closed || 0, color: '#7c3aed' },
  ];

  const maxVal = Math.max(...stages.map(s => s.value), 1);

  return (
    <section className="mb-8 overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
      <SectionHeader title="Lead Pipeline" description="จาก Lead ทั้งหมดถึงปิดดีล (all-time)" />
      <div className="flex items-end gap-3 p-6 pt-2" style={{ minHeight: 200 }}>
        {stages.map((s, i) => {
          const pct = s.value > 0 ? Math.max((Math.log10(s.value + 1) / Math.log10(maxVal + 1)) * 100, 5) : 0;
          const dropOff = i > 0 && stages[i - 1].value > 0
            ? '-' + ((1 - s.value / stages[i - 1].value) * 100).toFixed(0) + '%'
            : '';
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-bold">{fmtNum(s.value)}</span>
              {dropOff && <span className="text-[10px] text-text-secondary">{dropOff}</span>}
              {s.value > 0 ? (
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{ height: `${pct}%`, minHeight: 16, backgroundColor: s.color }}
                />
              ) : (
                <div className="flex w-full items-center justify-center" style={{ minHeight: 16 }}>
                  <div className="h-px w-full border-t border-dashed border-gray-300" />
                </div>
              )}
              <span className="mt-1 text-center text-xs text-text-secondary">{s.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Section: Email Timeline ─────────────────────────────── */

function EmailTimeline({ emailLeads }) {
  if (!emailLeads || emailLeads.length === 0) return null;

  // Group by date
  const byDate = {};
  emailLeads.forEach(l => {
    if (!l.sentAt) return;
    const d = l.sentAt.slice(0, 10);
    if (!byDate[d]) byDate[d] = { sent: 0, clicked: 0, bounced: 0 };
    byDate[d].sent++;
    if (l.clicked) byDate[d].clicked++;
    if (l.status === 'bounced') byDate[d].bounced++;
  });

  const days = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);

  if (days.length === 0) return null;

  const maxSent = Math.max(...days.map(([, v]) => v.sent), 1);

  return (
    <section className="mb-8 overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
      <SectionHeader title="Email Timeline" description={`ล่าสุด ${days.length} วัน`} />
      <div className="flex items-end gap-1 p-6 pt-2" style={{ minHeight: 160 }}>
        {days.map(([date, v], i) => {
          const h = Math.max((v.sent / maxSent) * 100, 8);
          const clickH = v.clicked > 0 ? Math.max((v.clicked / maxSent) * 100, 4) : 0;
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold">{v.sent}</span>
              <div className="relative w-full" style={{ height: h }}>
                <div
                  className="absolute bottom-0 w-full rounded-t-sm bg-gray-300"
                  style={{ height: '100%' }}
                />
                {clickH > 0 && (
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm bg-brand-primary"
                    style={{ height: `${clickH}%` }}
                  />
                )}
              </div>
              <span className="mt-1 text-[9px] text-text-secondary">
                {date.slice(5).replace('-', '/')}
              </span>
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-[10px] text-white group-hover:block">
                ส่ง {v.sent} | คลิก {v.clicked} | bounce {v.bounced}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 border-t border-border-primary px-6 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gray-300" />
          <span className="text-xs text-text-secondary">ส่งแล้ว</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-brand-primary" />
          <span className="text-xs text-text-secondary">คลิกลิงก์</span>
        </div>
      </div>
    </section>
  );
}

/* ── Section: Status Breakdown ───────────────────────────── */

function StatusBreakdown({ emailLeads }) {
  if (!emailLeads || emailLeads.length === 0) return null;

  const counts = {};
  emailLeads.forEach(l => {
    const s = l.status || 'unknown';
    counts[s] = (counts[s] || 0) + 1;
  });

  const total = emailLeads.length;
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);

  return (
    <section className="mb-8 overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
      <SectionHeader title="สถานะอีเมล" description={`จาก ${fmtNum(total)} ฉบับที่ส่ง`} />
      <div className="space-y-3 p-6 pt-2">
        {sorted.map(([status, count]) => {
          const pct = ((count / total) * 100).toFixed(1);
          return (
            <div key={status}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(status)}`}>
                    {statusLabel(status)}
                  </span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
                <span className="text-xs text-text-secondary">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-background-secondary">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all"
                  style={{ width: `${pct}%`, opacity: status === 'bounced' ? 0.4 : 1 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Section: Top Engaged (clicked) ──────────────────────── */

function TopEngaged({ emailLeads }) {
  const clicked = (emailLeads || []).filter(l => l.clicked).sort((a, b) => (b.clickCount || 1) - (a.clickCount || 1));
  if (clicked.length === 0) return null;

  return (
    <section className="mb-8 overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
      <SectionHeader
        title="Engaged Leads"
        description={`${clicked.length} คนที่คลิกลิงก์ — ควร follow-up ทันที`}
      />
      <div className="divide-y divide-border-primary">
        {clicked.map((l, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-3">
            <div>
              <p className="text-sm font-semibold">{l.name}</p>
              {l.domain && (
                <a href={`https://${l.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-link-primary hover:underline">
                  {l.domain}
                </a>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{l.clickCount || 1} คลิก</p>
              <p className="text-xs text-text-secondary">ล่าสุด {timeAgo(l.lastClick || l.firstClick)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Section: Leads Table ────────────────────────────────── */

function LeadsTable({ emailLeads }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const leads = (emailLeads || [])
    .filter(l => filter === 'all' || l.status === filter)
    .filter(l => !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.domain?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    {
      label: 'ธุรกิจ',
      key: 'name',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.name}</p>
          {row.domain && <p className="text-xs text-text-secondary">{row.domain}</p>}
        </div>
      ),
    },
    {
      label: 'สถานะ',
      key: 'status',
      render: (row) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(row.status)}`}>
          {statusLabel(row.status)}
        </span>
      ),
    },
    {
      label: 'ส่งเมื่อ',
      key: 'sentAt',
      render: (row) => <span className="text-sm">{fmtDateISO(row.sentAt)}</span>,
    },
    {
      label: 'คลิก',
      key: 'clicked',
      render: (row) => (
        <span className={`text-sm font-medium ${row.clicked ? 'text-brand-primary' : 'text-text-secondary'}`}>
          {row.clicked ? `${row.clickCount || 1}x` : '-'}
        </span>
      ),
    },
  ];

  const filters = ['all', 'emailed', 'clicked', 'bounced', 'replied'];

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-brand-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'ทั้งหมด' : statusLabel(f)}
            {f !== 'all' && ` (${(emailLeads || []).filter(l => l.status === f).length})`}
          </button>
        ))}
        <input
          type="text"
          placeholder="ค้นหา..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto rounded-full border border-border-primary px-3 py-1 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>
      <DataTable
        title={`รายชื่อลีด (${fmtNum(leads.length)})`}
        description="ลีดที่ส่งอีเมลแล้ว — sort ตามวันที่ส่งล่าสุด"
        columns={columns}
        rows={leads.sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''))}
      />
    </section>
  );
}

/* ── Section: Action Items ───────────────────────────────── */

function ActionItems({ leads, email, emailLeads }) {
  const actions = [];
  const emailed = email?.totalEmailed || 0;
  const clicked = email?.totalClicked || 0;
  const replied = leads?.replied || 0;
  const bounced = (emailLeads || []).filter(l => l.status === 'bounced').length;
  const clickRate = emailed > 0 ? (clicked / emailed) * 100 : 0;
  const bounceRate = emailed > 0 ? (bounced / emailed) * 100 : 0;

  if (replied === 0 && emailed > 20) {
    actions.push({
      priority: 'DO NOW',
      title: 'ยังไม่มีคนตอบกลับเลย',
      desc: `ส่งไป ${emailed} ฉบับ ไม่มีใครตอบ — ลองปรับ subject line ให้ personal มากขึ้น หรือเพิ่ม follow-up อัตโนมัติ`,
    });
  }

  if (clicked > 0 && replied === 0) {
    actions.push({
      priority: 'DO NOW',
      title: `มี ${clicked} คนคลิกลิงก์แต่ยังไม่ตอบ`,
      desc: 'คนเหล่านี้สนใจแต่ยังไม่ action — ควรส่ง follow-up email หรือโทรหาโดยตรง',
    });
  }

  if (bounceRate > 15) {
    actions.push({
      priority: 'DO NOW',
      title: `Bounce rate สูง ${bounceRate.toFixed(0)}%`,
      desc: 'อีเมลหลายฉบับไม่ถึง — ตรวจสอบคุณภาพ email list และลบอีเมลที่ bounce',
    });
  }

  if (clickRate < 3 && emailed > 10) {
    actions.push({
      priority: 'CONSIDER',
      title: `Click rate ต่ำ (${clickRate.toFixed(1)}%)`,
      desc: 'ลูกค้าเปิดอ่านแต่ไม่คลิกลิงก์ — ปรับ CTA ใน email ให้ชัดเจนขึ้น หรือเพิ่ม value proposition',
    });
  }

  if (leads?.goodTargets && emailed < leads.goodTargets * 0.3) {
    actions.push({
      priority: 'CONSIDER',
      title: `ยังส่งแค่ ${pctOf(emailed, leads.goodTargets)} ของเป้าหมายดี`,
      desc: `มีเป้าหมายดี ${fmtNum(leads.goodTargets)} คน แต่ส่งไปแค่ ${fmtNum(emailed)} — เพิ่มปริมาณการส่ง`,
    });
  }

  if (actions.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-bold">สิ่งที่ควรทำ</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {actions.slice(0, 3).map((a, i) => (
          <div key={i} className="rounded-[15px] border border-border-primary bg-white p-5 shadow-xxs">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                a.priority === 'DO NOW' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {a.priority}
              </span>
            </div>
            <h3 className="mb-1 text-sm font-bold">{a.title}</h3>
            <p className="text-xs text-text-secondary">{a.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── DGP Proposal Tab ─────────────────────────────────────── */

function DgpProposalTab() {
  const [form, setForm] = useState({ bizName: '', industry: '', domain: '', email: '', context: '' });
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [customParts, setCustomParts] = useState(null);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('form'); // form | preview

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/dgp/sent`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleGenerate = async () => {
    if (!form.bizName) return setError('ต้องใส่ชื่อธุรกิจ');
    setGenerating(true); setError(null); setSent(null);
    try {
      const res = await fetch(`${API}/api/dgp/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Generate failed');
      setPreview(data.htmlPreview);
      setCustomParts(data.customParts);
      setSubject(data.subject);
      setView('preview');
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  };

  const handleSend = async () => {
    if (!form.email) return setError('ต้องใส่ email');
    setSending(true); setError(null);
    try {
      const res = await fetch(`${API}/api/dgp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bizName: form.bizName, email: form.email, subject, customParts,
          industry: form.industry, domain: form.domain,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Send failed');
      setSent(data);
      fetchHistory();
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  const handleReset = () => {
    setForm({ bizName: '', industry: '', domain: '', email: '', context: '' });
    setPreview(null); setCustomParts(null); setSubject('');
    setSent(null); setError(null); setView('form');
  };

  return (
    <>
      {/* DGP Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title="Proposals ส่งแล้ว" value={fmtNum(history.length)} badge="all-time" />
        <StatCard
          title="ส่งล่าสุด"
          value={history.length > 0 ? history[history.length - 1].bizName : '-'}
          badge={history.length > 0 ? timeAgo(history[history.length - 1].sentAt) : '-'}
        />
      </div>

      {/* Generate / Preview */}
      <section className="mt-8 overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
        <SectionHeader
          title={view === 'form' ? 'สร้าง DGP Proposal' : 'Preview & Send'}
          description={view === 'form' ? 'กรอกข้อมูล → AI generate proposal ให้' : subject}
        />

        {/* Errors / Success */}
        {error && (
          <div className="mx-6 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {sent && (
          <div className="mx-6 mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            ส่งแล้ว → {sent.to} {sent.attachment !== 'none' ? '(PDF แนบ)' : ''}
          </div>
        )}

        {view === 'form' ? (
          <div className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">ชื่อธุรกิจ *</label>
                <input
                  className="w-full rounded-full border border-border-primary px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                  placeholder="Duke Language School"
                  value={form.bizName}
                  onChange={e => setForm(f => ({ ...f, bizName: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Industry</label>
                <input
                  className="w-full rounded-full border border-border-primary px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                  placeholder="โรงเรียนสอนภาษา"
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Domain</label>
                <input
                  className="w-full rounded-full border border-border-primary px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                  placeholder="dukelanguage.com"
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Email *</label>
                <input
                  className="w-full rounded-full border border-border-primary px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                  type="email"
                  placeholder="contact@business.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Context (สิ่งที่คุยกับลูกค้า)</label>
              <textarea
                className="w-full rounded-2xl border border-border-primary px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                rows={3}
                placeholder="ตามที่คุยกัน เน้น ED Visa ลูกค้าต่างชาติ..."
                value={form.context}
                onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating || !form.bizName}
                className="rounded-full bg-background-alternative px-8 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
              >
                {generating ? 'AI กำลังเขียน...' : 'Generate Proposal'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-6">
            {/* Subject + To */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Subject</label>
                <input
                  className="w-full rounded-full border border-border-primary px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">To</label>
                <input
                  className="w-full rounded-full border border-border-primary px-4 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            {/* HTML Preview */}
            <div
              className="max-h-[500px] overflow-auto rounded-2xl border border-border-primary bg-white p-6"
              dangerouslySetInnerHTML={{ __html: preview }}
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleReset}
                className="rounded-full border border-border-primary bg-white px-6 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                สร้างใหม่
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sent || !form.email}
                className={`rounded-full px-8 py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-40 ${
                  sent ? 'bg-green-600' : 'bg-background-alternative'
                }`}
              >
                {sent ? 'ส่งแล้ว!' : sending ? 'กำลังส่ง...' : 'ส่ง Proposal'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Sent History */}
      {history.length > 0 && (
        <section className="mt-8">
          <DataTable
            title={`ประวัติส่ง DGP (${history.length})`}
            description="Proposals ที่ส่งไปแล้ว — ส่งซ้ำไม่ได้"
            columns={[
              { label: 'ธุรกิจ', key: 'bizName', render: r => <span className="text-sm font-medium">{r.bizName}</span> },
              { label: 'Email', key: 'email', render: r => <span className="text-sm">{r.email}</span> },
              { label: 'Subject', key: 'subject', render: r => <span className="max-w-[200px] truncate text-sm">{r.subject}</span> },
              { label: 'ส่งเมื่อ', key: 'sentAt', render: r => <span className="text-sm">{fmtDateISO(r.sentAt)}</span> },
            ]}
            rows={[...history].reverse()}
          />
        </section>
      )}
    </>
  );
}

/* ── Main App ────────────────────────────────────────────── */

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('cold');
  const [replies, setReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [emailRes, leadsRes] = await Promise.all([
        fetch(`${API}/api/email/stats`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/leads/stats`).then(r => r.json()).catch(() => null),
      ]);
      setData({ email: emailRes, leads: leadsRes });
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Fetch replies separately (may be slower due to Gmail API calls)
    try {
      setRepliesLoading(true);
      const repliesRes = await fetch(`${API}/api/leads/replies`).then(r => r.json()).catch(() => null);
      if (repliesRes?.replies) setReplies(repliesRes.replies);
    } catch (err) {
      console.error('Replies fetch error:', err);
    } finally {
      setRepliesLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingScreen message="กำลังโหลด Email Dashboard..." />;

  const { email, leads } = data || {};
  const emailLeads = email?.leads || [];

  return (
    <AppSidebar activePath="/vision/email/">
      <div className="relative flex-1 bg-background-secondary">
        <Topbar title="Email & Proposal" onRefresh={() => fetchData()} refreshing={refreshing} />
        <div className="h-[calc(100vh-4.5rem)] overflow-auto">
          <div className="container px-6 py-8 md:px-8 md:py-10 lg:py-12">
            {/* Page title + Tab switcher */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  {activeTab === 'cold' ? 'Email Campaign' : 'DGP Proposal'}
                </h1>
                <p className="mt-1 text-text-secondary">
                  {activeTab === 'cold'
                    ? 'Lead pipeline, email performance, engagement tracking'
                    : 'สร้าง + ส่ง proposal หลังโทรคุยกับลูกค้า'}
                </p>
              </div>
              <div className="flex rounded-full bg-background-primary border border-border-primary p-1">
                <button
                  onClick={() => setActiveTab('cold')}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    activeTab === 'cold'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Cold Email
                </button>
                <button
                  onClick={() => setActiveTab('dgp')}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    activeTab === 'dgp'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  DGP Proposal
                </button>
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'cold' ? (
              <>
                <HeroKPIs leads={leads} email={email} />

                <div className="mt-8">
                  <RepliesSection replies={replies} loading={repliesLoading} />
                </div>

                <div className="mt-8">
                  <ActionItems leads={leads} email={email} emailLeads={emailLeads} />
                </div>

                <PipelineFunnel leads={leads} email={email} />

                <div className="grid gap-8 md:grid-cols-2">
                  <EmailTimeline emailLeads={emailLeads} />
                  <StatusBreakdown emailLeads={emailLeads} />
                </div>

                <TopEngaged emailLeads={emailLeads} />

                <LeadsTable emailLeads={emailLeads} />
              </>
            ) : (
              <DgpProposalTab />
            )}
          </div>
        </div>
      </div>
    </AppSidebar>
  );
}
