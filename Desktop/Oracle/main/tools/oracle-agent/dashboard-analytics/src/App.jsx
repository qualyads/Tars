import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@relume_io/relume-ui';
import {
  BiDownArrowAlt,
  BiTrendingUp,
  BiUpArrowAlt,
} from '@oracle/shared/components/Icons';
import {
  AppSidebar,
  Topbar,
  StatCard,
  SectionHeader,
  LoadingScreen,
  fmtNum,
} from '@oracle/shared';

const API = window.location.origin;
const GSC_SITE = 'sc-domain:visionxbrain.com';

const PERIOD_LABELS = {
  'today': 'วันนี้',
  'yesterday': 'เมื่อวาน',
  '7daysAgo': '7 วัน',
  '14daysAgo': '14 วัน',
  '28daysAgo': '28 วัน',
  '90daysAgo': '90 วัน',
};

// ============ HELPERS ============
function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function trendFromRows(rows, key = 'sessions') {
  if (!rows || rows.length < 4) return { direction: 'flat', pct: 0 };
  const mid = Math.floor(rows.length / 2);
  const firstHalf = rows.slice(0, mid).reduce((s, r) => s + (r[key] || 0), 0);
  const secondHalf = rows.slice(mid).reduce((s, r) => s + (r[key] || 0), 0);
  const pct = pctChange(secondHalf, firstHalf);
  return { direction: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat', pct };
}

function velocityLabel(pct) {
  if (pct > 10) return { text: 'กำลังโต', color: 'bg-green-100 text-green-700' };
  if (pct < -10) return { text: 'ชะลอตัว', color: 'bg-red-100 text-red-700' };
  return { text: 'คงที่', color: 'bg-gray-100 text-gray-600' };
}

function sourceLabel(s) {
  if (s.sessionSource === '(direct)') return 'Direct';
  if (s.sessionSource === 'google' && s.sessionMedium === 'organic') return 'Organic';
  if (s.sessionMedium?.includes('referral')) return `Referral (${s.sessionSource})`;
  if (s.sessionMedium === 'social' || ['facebook', 'instagram', 'twitter', 'linkedin'].includes(s.sessionSource)) return 'Social';
  if (s.sessionSource === '(not set)') return 'Other';
  return `${s.sessionSource}`;
}

function channelGroup(sources) {
  const groups = { Organic: 0, Direct: 0, Referral: 0, Social: 0 };
  (sources || []).forEach(s => {
    const label = sourceLabel(s);
    if (label === 'Organic') groups.Organic += s.sessions || 0;
    else if (label === 'Direct') groups.Direct += s.sessions || 0;
    else if (label.startsWith('Referral')) groups.Referral += s.sessions || 0;
    else if (label === 'Social') groups.Social += s.sessions || 0;
  });
  return groups;
}

// ============ 1. HERO KPIs ============
function HeroKPIs({ traffic, leads, costs, trendRows, emailStats }) {
  const trafficTrend = trendFromRows(trendRows, 'sessions');
  const totalVisitors = traffic.totalUsers || traffic.sessions || 0;
  const totalLeads = leads?.total || 0;
  const engagementPct = Math.round((traffic.engagementRate || 0) * 100);
  const engagedCount = Math.round(totalVisitors * (traffic.engagementRate || 0));
  const costPerLead = totalLeads > 0 && costs?.currentUsage
    ? (costs.currentUsage.totalUsd / totalLeads).toFixed(2)
    : '-';
  const emailed = leads?.emailed || 0;
  const replied = leads?.replied || 0;
  const emailClickRate = emailStats?.totalEmailed > 0
    ? Math.round((emailStats.totalClicked / emailStats.totalEmailed) * 100)
    : 0;

  const stats = [
    {
      title: 'คนเข้าเว็บ',
      value: fmtNum(totalVisitors),
      icon: trafficTrend.direction === 'up' ? <BiUpArrowAlt /> : trafficTrend.direction === 'down' ? <BiDownArrowAlt /> : <BiTrendingUp />,
      badge: `${trafficTrend.pct >= 0 ? '+' : ''}${trafficTrend.pct}%`,
      comparisonText: 'vs ช่วงก่อน',
    },
    {
      title: 'ลีดทั้งหมด',
      value: fmtNum(totalLeads),
      icon: totalLeads > 0 ? <BiUpArrowAlt /> : <BiDownArrowAlt />,
      badge: `${emailed} ส่งแล้ว, ${replied} ตอบ`,
      comparisonText: 'all-time',
    },
    {
      title: 'Engaged',
      value: `${fmtNum(engagedCount)} / ${fmtNum(totalVisitors)} คน`,
      icon: engagementPct > 40 ? <BiUpArrowAlt /> : <BiDownArrowAlt />,
      badge: `${engagementPct}%`,
      comparisonText: 'อยู่นาน >10 วิ หรือดู 2+ หน้า',
    },
    {
      title: 'ต้นทุน/ลีด',
      value: costPerLead === '-' ? '-' : `$${costPerLead}`,
      icon: costPerLead !== '-' && parseFloat(costPerLead) < 2 ? <BiUpArrowAlt /> : <BiDownArrowAlt />,
      badge: costs?.currentUsage ? `รวม $${costs.currentUsage.totalUsd}` : '-',
      comparisonText: costPerLead !== '-' ? `~${Math.round(parseFloat(costPerLead) * 34)}฿/ลีด` : '',
    },
  ];

  return (
    <section className="mb-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {stats.map((stat, i) => <StatCard key={i} {...stat} />)}
      </div>
    </section>
  );
}

// ============ 2. VXB BUSINESS FUNNEL (2 Tracks) ============
function BusinessFunnel({ traffic, gscSummary, leads, emailStats, period }) {
  const impressions = gscSummary?.totalImpressions || 0;
  const gscClicks = gscSummary?.totalClicks || 0;
  const visitors = traffic.totalUsers || traffic.sessions || 0;
  const engaged = Math.round(visitors * (traffic.engagementRate || 0));

  const totalLeads = leads?.total || 0;
  const emailed = emailStats?.totalEmailed || leads?.emailed || 0;
  const clicked = emailStats?.totalClicked || 0;
  const replied = leads?.replied || 0;

  // GSC data is always 7-day — hide when viewing today/yesterday to avoid mixing time periods
  const showGsc = period !== 'today' && period !== 'yesterday';

  const webStages = showGsc
    ? [
        { label: 'Impressions', value: impressions, color: '#d4d4d4' },
        { label: 'คลิก GSC', value: gscClicks, color: '#a3a3a3' },
        { label: 'เข้าเว็บ', value: visitors, color: '#737373' },
        { label: 'Engaged', value: engaged, color: '#525252' },
      ]
    : [
        { label: 'เข้าเว็บ', value: visitors, color: '#737373' },
        { label: 'Engaged', value: engaged, color: '#525252' },
      ];

  const outreachStages = [
    { label: 'ลีด', value: totalLeads, color: '#df6c68' },
    { label: 'ส่งอีเมล', value: emailed, color: '#eb3f43' },
    { label: 'คลิกอีเมล', value: clicked, color: '#d63539' },
    { label: 'ตอบกลับ', value: replied, color: '#b91c1c' },
  ];

  const renderFunnel = (stages, label) => {
    const logMax = Math.log10(Math.max(...stages.map(s => s.value), 1) + 1);
    return (
      <div>
        <p className="mb-3 text-xs font-semibold text-text-secondary">{label}</p>
        <div className="flex items-end gap-2" style={{ height: 200 }}>
          {stages.map((stage, i) => {
            const logH = stage.value > 0 ? (Math.log10(stage.value + 1) / logMax) * 100 : 0;
            const dropOff = i > 0 && stages[i - 1].value > 0
              ? Math.round((1 - stage.value / stages[i - 1].value) * 100)
              : null;
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                {dropOff !== null && dropOff > 0 && (
                  <span className="mb-1 text-[9px] text-red-400">-{dropOff}%</span>
                )}
                <span className={`mb-1 text-xs font-bold ${stage.value === 0 ? 'text-gray-400' : ''}`}>{fmtNum(stage.value)}</span>
                {stage.value > 0 && (
                  <div
                    className="trend-bar-animated w-full max-w-[48px] rounded-t"
                    style={{ height: `${Math.max(logH, 5)}%`, backgroundColor: stage.color }}
                  />
                )}
                {stage.value === 0 && (
                  <div className="w-full max-w-[48px] border-t-2 border-dashed border-gray-300" />
                )}
                <span className="mt-2 text-center text-[10px] leading-tight text-neutral">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="mb-8">
      <div className="overflow-hidden rounded-[15px] shadow-xxs">
        <SectionHeader title="VXB Business Funnel" description="2 ช่องทาง: เว็บ (Google) + Outreach (ลีด)" />
        <div className="grid grid-cols-1 gap-6 rounded-b-[15px] border border-t-0 border-border-primary bg-white px-4 py-6 md:grid-cols-2 md:px-6">
          {renderFunnel(webStages, showGsc ? 'Website (GSC 7d → GA4)' : 'Website (GA4)')}
          {renderFunnel(outreachStages, 'Outreach (ลีด → อีเมล) — all-time')}
        </div>
      </div>
    </section>
  );
}

// ============ 3. GROWTH VELOCITY ============
function GrowthVelocity({ trends }) {
  // Use all available rows (GA4 may return fewer than expected for new sites)
  const rows = trends?.rows || [];
  const max = Math.max(...rows.map(r => r.sessions || 0), 1);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (r.sessions || 0), 0) / rows.length) : 0;
  const trend = trendFromRows(rows, 'sessions');
  const vel = velocityLabel(trend.pct);

  return (
    <section className="mb-8">
      <div className="overflow-hidden rounded-[15px] shadow-xxs">
        <SectionHeader title="Growth Velocity" description={`คนเข้าเว็บรายวัน (${rows.length} วันที่มีข้อมูล)`}>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${vel.color}`}>
            {vel.text} ({trend.pct >= 0 ? '+' : ''}{trend.pct}%)
          </span>
          <Badge variant="secondary">เฉลี่ย {avg} คน/วัน</Badge>
        </SectionHeader>
        <div className="flex items-end gap-2 rounded-b-[15px] border border-t-0 border-border-primary bg-white px-6 py-5" style={{ height: 200 }}>
          {rows.map((r, i) => {
            const h = Math.max(((r.sessions || 0) / max) * 100, 3);
            const aboveAvg = (r.sessions || 0) >= avg;
            return (
              <div key={i} className="relative flex flex-col items-center justify-end" style={{ height: '100%', minWidth: 44, flex: '1 1 0' }}>
                <span className="mb-1 text-[10px] font-semibold">{r.sessions}</span>
                <div
                  className="trend-bar-animated w-full max-w-[48px] rounded-t"
                  style={{
                    height: `${h}%`,
                    background: aboveAvg ? '#eb3f43' : '#d4d4d4',
                  }}
                />
                {/* Dashed average line */}
                <div
                  className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-gray-400"
                  style={{ bottom: `${Math.max((avg / max) * 100, 2)}%` }}
                />
                <span className="mt-1 text-[10px] text-neutral">
                  {r.date ? `${r.date.slice(6, 8)}/${r.date.slice(4, 6)}` : ''}
                </span>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="flex w-full items-center justify-center py-8 text-sm text-neutral">ยังไม่มีข้อมูล</div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============ 4. CHANNEL PERFORMANCE ============
function ChannelPerformance({ topSources }) {
  const total = topSources.reduce((s, x) => s + (x.sessions || 0), 0) || 1;
  const top5 = topSources.slice(0, 5);
  const groups = channelGroup(topSources);

  const channelCards = [
    { title: 'Organic', value: fmtNum(groups.Organic), icon: <BiUpArrowAlt />, badge: `${Math.round((groups.Organic / total) * 100)}%`, comparisonText: 'ของทั้งหมด' },
    { title: 'Direct', value: fmtNum(groups.Direct), icon: <BiUpArrowAlt />, badge: `${Math.round((groups.Direct / total) * 100)}%`, comparisonText: 'ของทั้งหมด' },
    { title: 'Referral', value: fmtNum(groups.Referral), icon: <BiUpArrowAlt />, badge: `${Math.round((groups.Referral / total) * 100)}%`, comparisonText: 'ของทั้งหมด' },
    { title: 'Social', value: fmtNum(groups.Social), icon: <BiUpArrowAlt />, badge: `${Math.round((groups.Social / total) * 100)}%`, comparisonText: 'ของทั้งหมด' },
  ];

  return (
    <section className="mb-8">
      <div className="overflow-hidden rounded-[15px] shadow-xxs">
        <SectionHeader title="Channel Performance" description="แหล่งที่มาของผู้เข้าชม" />
        <div className="grid grid-cols-1 gap-6 rounded-b-[15px] border border-t-0 border-border-primary bg-white p-6 md:grid-cols-2">
          {/* Left: horizontal bars */}
          <div className="flex flex-col gap-3">
            <p className="mb-1 text-sm font-semibold text-text-secondary">Top 5 Sources</p>
            {top5.map((s, i) => {
              const pct = Math.round((s.sessions / total) * 100);
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{sourceLabel(s)}</span>
                    <span className="font-semibold">{fmtNum(s.sessions)} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: i === 0 ? '#eb3f43' : i === 1 ? '#df6c68' : '#a3a3a3',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Right: 4 mini StatCards */}
          <div className="grid grid-cols-2 gap-3">
            {channelCards.map((c, i) => (
              <div key={i} className="rounded-[12px] border border-border-primary p-4">
                <p className="mb-0.5 text-xs text-text-secondary">{c.title}</p>
                <p className="text-lg font-bold">{c.value}</p>
                <div className="mt-0.5 flex items-center gap-1 text-xs">
                  <span className="text-brand-primary">{c.icon}</span>
                  <span>{c.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ 5. TOP 3 ACTIONS ============
function TopActions({ leads, emailStats, gscQueries, traffic, costs, topSources }) {
  const actions = [];
  const totalLeads = leads?.total || 0;
  const totalVisitors = traffic.totalUsers || traffic.sessions || 0;
  const bounce = Math.round((traffic.bounceRate || 0) * 100);
  const engagement = Math.round((traffic.engagementRate || 0) * 100);
  const clickRate = emailStats?.totalEmailed > 0
    ? Math.round((emailStats.totalClicked / emailStats.totalEmailed) * 100)
    : 0;
  const replyRate = leads?.emailed > 0
    ? Math.round(((leads.replied || 0) / leads.emailed) * 100)
    : 0;
  const lowCTR = (gscQueries || []).filter(q => q.impressions >= 50 && q.ctr < 3);
  const costPerLead = totalLeads > 0 && costs?.currentUsage
    ? costs.currentUsage.totalUsd / totalLeads
    : 0;
  const totalSessions = (topSources || []).reduce((s, x) => s + (x.sessions || 0), 0) || 1;
  const groups = channelGroup(topSources || []);
  const organicPct = Math.round((groups.Organic / totalSessions) * 100);

  // Email click rate low
  if (emailStats?.totalEmailed > 5 && clickRate < 15) {
    actions.push({
      impact: 90,
      title: 'ปรับ Email Subject / Body',
      desc: `Click rate แค่ ${clickRate}% (${emailStats.totalClicked}/${emailStats.totalEmailed}) — ใส่ชื่อธุรกิจ + pain point ที่ชัด`,
      badge: 'DO NOW',
      badgeColor: 'bg-red-100 text-red-700',
    });
  }

  // No replies
  if (leads?.emailed > 10 && replyRate === 0) {
    actions.push({
      impact: 85,
      title: 'ยังไม่มีลูกค้าตอบกลับ',
      desc: `ส่ง ${leads.emailed} อีเมลแล้ว แต่ 0 ตอบ — ปรับ follow-up sequence หรือเปลี่ยน offer`,
      badge: 'DO NOW',
      badgeColor: 'bg-red-100 text-red-700',
    });
  }

  // High bounce
  if (bounce > 55) {
    actions.push({
      impact: 75,
      title: 'ลด Bounce Rate',
      desc: `Bounce ${bounce}% — เพิ่ม CTA ชัดเจน, ปรับ content ให้ตรง keyword, ลด load time`,
      badge: 'DO NOW',
      badgeColor: 'bg-red-100 text-red-700',
    });
  }

  // Low engagement
  if (engagement > 0 && engagement < 40) {
    actions.push({
      impact: 70,
      title: 'เพิ่ม Engagement',
      desc: `แค่ ${engagement}% ของคนเข้าเว็บสนใจจริง — ปรับ above-the-fold content ให้ hook ทันที`,
      badge: 'CONSIDER',
      badgeColor: 'bg-yellow-100 text-yellow-700',
    });
  }

  // GSC CTR low
  if (lowCTR.length >= 1) {
    actions.push({
      impact: 65,
      title: 'ปรับ Title / Meta',
      desc: `${lowCTR.length} คำค้นขึ้น Google แต่ CTR ต่ำ — เขียน Title ใหม่ให้น่าคลิก`,
      badge: 'CONSIDER',
      badgeColor: 'bg-yellow-100 text-yellow-700',
    });
  }

  // Low organic traffic
  if (organicPct < 30 && totalSessions > 10) {
    actions.push({
      impact: 60,
      title: 'เพิ่ม Organic Traffic',
      desc: `Organic แค่ ${organicPct}% — เน้น SEO content + blog เพื่อลดการพึ่ง direct/paid`,
      badge: 'CONSIDER',
      badgeColor: 'bg-yellow-100 text-yellow-700',
    });
  }

  // Lead volume low
  if (totalLeads < 10) {
    actions.push({
      impact: 55,
      title: 'ขยาย Lead Pipeline',
      desc: `มีลีดแค่ ${totalLeads} ราย — เพิ่ม Google Maps search queries หรือเปิด industry ใหม่`,
      badge: 'CONSIDER',
      badgeColor: 'bg-yellow-100 text-yellow-700',
    });
  }

  // Cost per lead high
  if (costPerLead > 3) {
    actions.push({
      impact: 50,
      title: 'ลดต้นทุน/ลีด',
      desc: `$${costPerLead.toFixed(2)}/lead — ตัด channel ที่ไม่ convert, เน้น organic`,
      badge: 'CONSIDER',
      badgeColor: 'bg-yellow-100 text-yellow-700',
    });
  }

  // Sort by impact, show top 3
  const top3 = actions.sort((a, b) => b.impact - a.impact).slice(0, 3);

  return (
    <section className="mb-8">
      <div className="overflow-hidden rounded-[15px] shadow-xxs">
        <SectionHeader title="Top 3 Actions" description="สิ่งที่ควรทำตอนนี้ — เรียงตาม impact" />
        <div className="grid grid-cols-1 gap-4 rounded-b-[15px] border border-t-0 border-border-primary bg-white p-6 md:grid-cols-3">
          {top3.length === 0 && (
            <div className="col-span-full py-6 text-center text-sm text-green-600">
              ไม่มี action item เร่งด่วน
            </div>
          )}
          {top3.map((a, i) => (
            <div key={i} className="flex gap-4 rounded-[12px] border border-border-primary p-5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="font-bold">{a.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.badgeColor}`}>{a.badge}</span>
                </div>
                <p className="text-sm text-text-secondary">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ 6. GOOGLE SEARCH (CONDENSED) ============
function GoogleSearchCondensed({ gscSummary, gscQueries }) {
  // Use queries from dedicated endpoint, fallback to summary's topQueries
  const allQueries = (gscQueries && gscQueries.length > 0) ? gscQueries : (gscSummary?.topQueries || []);
  const topClicks = allQueries
    .filter(q => q.clicks >= 1)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 3);
  const topOpps = allQueries
    .filter(q => q.impressions >= 20 && q.ctr < 5)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 3);

  return (
    <section className="mb-8">
      <div className="overflow-hidden rounded-[15px] shadow-xxs">
        <SectionHeader title="Google Search" description="สรุปผลจาก Search Console" />
        <div className="rounded-b-[15px] border border-t-0 border-border-primary bg-white p-6">
          {/* 2 StatCards */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <StatCard
              title="Clicks"
              value={fmtNum(gscSummary?.totalClicks || 0)}
              icon={<BiUpArrowAlt />}
              badge={`CTR ${gscSummary?.avgCtr?.toFixed(1) || 0}%`}
              comparisonText={gscSummary?.period || '7 วัน'}
            />
            <StatCard
              title="Impressions"
              value={fmtNum(gscSummary?.totalImpressions || 0)}
              icon={<BiUpArrowAlt />}
              badge={`${(gscSummary?.topQueries || []).length} คำค้น`}
              comparisonText={gscSummary?.period || '7 วัน'}
            />
          </div>
          {/* 2 mini lists side by side */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold">Top 3 คำค้นที่คลิก</p>
              {topClicks.length === 0 && <p className="text-sm text-neutral">ยังไม่มีข้อมูล</p>}
              {topClicks.map((q, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0">
                  <span className="max-w-[200px] truncate">"{q.keys?.[0]}"</span>
                  <span className="font-semibold">{q.clicks} คลิก</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Top 3 โอกาส (สูง impressions, ต่ำ CTR)</p>
              {topOpps.length === 0 && <p className="text-sm text-neutral">ยังไม่มีข้อมูล</p>}
              {topOpps.map((q, i) => (
                <div key={i} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0">
                  <span className="max-w-[200px] truncate">"{q.keys?.[0]}"</span>
                  <span className="text-text-secondary">{fmtNum(q.impressions)} imp, {q.ctr}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ 7. AI RECOMMENDATIONS ============
function AIRecommendations({ ideas }) {
  const items = (ideas?.ideas || []).slice(0, 5);

  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="overflow-hidden rounded-[15px] shadow-xxs">
        <SectionHeader title="AI Recommendations" description="ไอเดียจาก Oracle thinking engine" />
        <div className="flex flex-col gap-3 rounded-b-[15px] border border-t-0 border-border-primary bg-white p-6">
          {items.map((idea, i) => {
            const isUrgent = i < 2 || idea.priority === 'high' || idea.category === 'revenue';
            return (
              <div key={i} className="flex items-start gap-3 rounded-[10px] border border-border-primary p-4">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isUrgent ? 'DO NOW' : 'CONSIDER'}
                </span>
                <div className="flex-1">
                  <h4 className="text-sm font-bold">{idea.name || idea.title || 'Idea'}</h4>
                  <p className="mt-0.5 text-xs text-text-secondary">{idea.description || idea.reason || ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('28daysAgo');

  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [gscSummary, setGscSummary] = useState(null);
  const [gscQueries, setGscQueries] = useState([]);
  const [leads, setLeads] = useState(null);
  const [emailStats, setEmailStats] = useState(null);
  const [costs, setCosts] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [conversions, setConversions] = useState(null);
  const [sources, setSources] = useState(null);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    const endDate = period === 'yesterday' ? 'yesterday' : 'today';
    try {
      const [
        sumRes, trendRes, convRes, srcRes,
        gscSumRes, gscQRes,
        leadRes, emailRes, costRes, ideasRes,
      ] = await Promise.all([
        fetch(`${API}/api/ga4/summary?startDate=${period}&endDate=${endDate}`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/ga4/trends?startDate=${period}&endDate=${endDate}`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/ga4/conversions?startDate=${period}&endDate=${endDate}`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/ga4/sources?startDate=${period}&endDate=${endDate}`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/search-console/summary?site=${GSC_SITE}`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/search-console/queries?site=${GSC_SITE}&limit=20`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/leads/stats`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/email/stats`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/costs`).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/ideas`).then(r => r.json()).catch(() => null),
      ]);
      setSummary(sumRes);
      setTrends(trendRes);
      setConversions(convRes);
      setSources(srcRes);
      setGscSummary(gscSumRes);
      setGscQueries(Array.isArray(gscQRes?.queries) ? gscQRes.queries : Array.isArray(gscQRes) ? gscQRes : []);
      setLeads(leadRes);
      setEmailStats(emailRes);
      setCosts(costRes);
      setIdeas(ideasRes);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetchData(true); }, [fetchData]);

  if (loading) {
    return <LoadingScreen message="กำลังโหลด Executive Dashboard..." />;
  }

  const traffic = summary?.traffic || summary?.totals || {};
  const topSources = sources?.rows || sources?.topSources || summary?.topSources || [];
  const periodLabel = PERIOD_LABELS[period] || '28 วัน';

  return (
    <AppSidebar activePath="/vision/analytics/">
      <div className="relative flex-1 bg-background-secondary">
        <Topbar title="Executive Dashboard" onRefresh={() => fetchData(false)} refreshing={refreshing}>
          <select
            className="rounded border border-border-primary bg-white px-3 py-2 text-sm"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="today">วันนี้</option>
            <option value="yesterday">เมื่อวาน</option>
            <option value="7daysAgo">7 วัน</option>
            <option value="14daysAgo">14 วัน</option>
            <option value="28daysAgo">28 วัน</option>
            <option value="90daysAgo">90 วัน</option>
          </select>
        </Topbar>
        <div className="h-[calc(100vh-4.5rem)] overflow-auto">
          <div className="container px-6 py-8 md:px-8 md:py-10 lg:py-12">
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">VisionXBrain — {periodLabel}</h1>
              <p className="mt-1 text-text-secondary">Revenue first, funnel thinking, action-oriented</p>
            </div>

            <HeroKPIs traffic={traffic} leads={leads} costs={costs} trendRows={trends?.rows} emailStats={emailStats} />
            <BusinessFunnel traffic={traffic} gscSummary={gscSummary} leads={leads} emailStats={emailStats} period={period} />
            <GrowthVelocity trends={trends} />
            <ChannelPerformance topSources={topSources} />
            <TopActions leads={leads} emailStats={emailStats} gscQueries={gscQueries} traffic={traffic} costs={costs} topSources={topSources} />
            <GoogleSearchCondensed gscSummary={gscSummary} gscQueries={gscQueries} />
            <AIRecommendations ideas={ideas} />
          </div>
        </div>
      </div>
    </AppSidebar>
  );
}
