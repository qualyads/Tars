import { useState, useEffect, useCallback } from 'react';
import {
  Badge,
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@relume_io/relume-ui';
import {
  BiBarChartAlt2,
  BiCog,
  BiEnvelope,
  BiLineChart,
  BiPieChartAlt2,
  BiRefresh,
  BiRocket,
  BiUpArrowAlt,
  BiDownArrowAlt,
  BiErrorCircle,
  BiCheckCircle,
  BiInfoCircle,
  BiGroup,
  BiFile,
  BiTime,
  BiXCircle,
  BiTrendingUp,
  BiSearchAlt,
  BiTargetLock,
  BiDollar,
} from 'react-icons/bi';

const API = window.location.origin;

// ============ HELPERS ============
function fmtNum(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH');
}

function fmtDuration(secs) {
  if (!secs) return '0 วินาที';
  if (secs < 60) return Math.round(secs) + ' วินาที';
  return Math.floor(secs / 60) + ' นาที';
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}`;
}

// ============ HEALTH CALC ============
function calcHealth(traffic, pagesData, landingData, gscQueries) {
  let score = 100;
  const issues = [];

  const hasConversions = landingData?.rows?.some(r => r.keyEvents > 0);
  if (!hasConversions) {
    score -= 30;
    issues.push({ severity: 'critical', text: 'ยังไม่ได้ติดตั้งระบบนับลูกค้า (Conversion Tracking)' });
  }

  const notFound = (pagesData?.rows || []).filter(r => r.pageTitle === 'Not Found');
  if (notFound.length > 0) {
    score -= 15;
    issues.push({ severity: 'critical', text: `มี ${notFound.length} หน้าที่พัง (เปิดไม่ได้)` });
  }

  if ((traffic.bounceRate || 0) > 0.6) {
    score -= 10;
    issues.push({ severity: 'warning', text: `${Math.round(traffic.bounceRate * 100)}% ของคนเข้ามาแล้วออกทันที` });
  }

  if ((traffic.sessions || 0) < 100) {
    score -= 10;
    issues.push({ severity: 'warning', text: 'จำนวนคนเข้าเว็บยังน้อยมาก' });
  }

  const lowCTR = (gscQueries || []).filter(q => q.impressions >= 50 && q.ctr < 3);
  if (lowCTR.length > 0) {
    score -= 5;
    issues.push({ severity: 'info', text: `เว็บขึ้น Google แล้ว แต่คนไม่คลิกเข้ามา (${lowCTR.length} คำ)` });
  }

  const highBounce = (landingData?.rows || []).filter(r =>
    r.sessions >= 2 && r.bounceRate >= 0.9 && r.landingPage && r.landingPage !== '(not set)'
  );
  if (highBounce.length > 0) {
    score -= 10;
    issues.push({ severity: 'warning', text: `${highBounce.length} หน้าที่คน Google เข้ามาแล้วออกทันที` });
  }

  return { score: Math.max(score, 0), issues };
}

const PERIOD_LABELS = {
  '7daysAgo': '7 วัน',
  '14daysAgo': '14 วัน',
  '28daysAgo': '28 วัน',
  '90daysAgo': '90 วัน',
};

// ============ SIDEBAR NAV ============
const sidebarMenu = [
  { title: 'รายงานเว็บ', url: '/vision/analytics/', icon: BiBarChartAlt2, active: true },
  { title: 'แผนเติบโต', url: '/vision/growthstrategy/', icon: BiRocket },
  { title: 'อีเมลลูกค้า', url: '/vision/email/', icon: BiEnvelope },
  { title: 'ค่าใช้จ่าย', url: '/costs/', icon: BiDollar },
];

// ============ APP SIDEBAR (Shell 3 Pattern) ============
function AppSidebar({ children }) {
  return (
    <SidebarProvider>
      <Sidebar className="py-6" closeButtonClassName="fixed top-4 right-4 text-white">
        <SidebarHeader className="hidden lg:block">
          <a href="/vision/analytics/" className="flex items-center gap-2 text-lg font-bold">
            <BiPieChartAlt2 className="size-6 text-neutral-dark" />
            <span>VXB Report</span>
          </a>
        </SidebarHeader>
        <SidebarContent className="mt-6">
          <SidebarMenu>
            {sidebarMenu.map((item, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuButton asChild data-active={item.active || false}>
                  <a href={item.url} className="flex w-full items-center">
                    <item.icon className="size-5" />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="pb-6 lg:pb-0">
          <div className="px-2 text-center text-xs text-neutral">
            Oracle Agent — VisionXBrain
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="min-h-screen w-full pt-16 lg:pt-0">{children}</main>
    </SidebarProvider>
  );
}

// ============ TOPBAR (Shell 3 Pattern) ============
function Topbar({ period, setPeriod, onRefresh, refreshing }) {
  return (
    <>
      {/* Desktop topbar */}
      <div className="sticky top-0 z-30 hidden h-auto min-h-16 w-full items-center border-b border-border-primary bg-white px-6 md:min-h-18 lg:flex lg:px-8">
        <div className="mx-auto grid size-full grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_max-content] lg:justify-between lg:justify-items-stretch">
          <div className="text-base font-semibold">รายงานเว็บ VisionXBrain</div>
          <div className="flex items-center gap-3">
            <select
              className="rounded border border-border-primary bg-white px-3 py-2 text-sm"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            >
              <option value="7daysAgo">7 วัน</option>
              <option value="14daysAgo">14 วัน</option>
              <option value="28daysAgo">28 วัน</option>
              <option value="90daysAgo">90 วัน</option>
            </select>
            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
              <BiRefresh className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="ml-1">{refreshing ? 'กำลังโหลด...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile topbar */}
      <div className="fixed left-0 right-0 top-0 z-30 flex min-h-16 w-full items-center justify-between border-b border-border-primary bg-white px-6 lg:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <span className="text-sm font-semibold">VXB Report</span>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
          <BiRefresh className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </>
  );
}

// ============ HEALTH HERO ============
function HealthHero({ health, periodLabel }) {
  const color = health.score >= 80 ? 'text-system-success-green' : health.score >= 50 ? 'text-orange-600' : 'text-system-error-red';
  const bgColor = health.score >= 80 ? 'bg-system-success-green-light' : health.score >= 50 ? 'bg-orange-50' : 'bg-system-error-red-light';
  const borderColor = health.score >= 80 ? 'border-system-success-green' : health.score >= 50 ? 'border-orange-400' : 'border-system-error-red';
  const label = health.score >= 80 ? 'ดี' : health.score >= 50 ? 'ต้องปรับปรุง' : 'ต้องแก้ด่วน';
  const emoji = health.score >= 80 ? '✅' : health.score >= 50 ? '⚠️' : '🔴';

  return (
    <div className={`mb-6 flex items-center gap-8 rounded-xl border-2 ${borderColor} ${bgColor} p-8`}>
      <div className={`health-ring flex size-24 flex-shrink-0 flex-col items-center justify-center rounded-full border-4 ${borderColor}`}>
        <span className={`text-3xl font-extrabold ${color}`}>{health.score}</span>
        <span className={`text-xs ${color}`}>คะแนน</span>
      </div>
      <div className="flex-1">
        <h1 className={`mb-1 text-xl font-bold md:text-2xl ${color}`}>
          {emoji} สุขภาพเว็บ: {label}
        </h1>
        <p className="mb-3 text-sm text-neutral">ข้อมูลย้อนหลัง {periodLabel}</p>
        <div className="flex flex-col gap-1.5">
          {health.issues.map((issue, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {issue.severity === 'critical' && <BiErrorCircle className="size-4 shrink-0 text-system-error-red" />}
              {issue.severity === 'warning' && <BiErrorCircle className="size-4 shrink-0 text-orange-500" />}
              {issue.severity === 'info' && <BiInfoCircle className="size-4 shrink-0 text-blue-500" />}
              <span>{issue.text}</span>
            </div>
          ))}
          {health.issues.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-system-success-green">
              <BiCheckCircle className="size-4" /> ไม่พบปัญหา
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ KPI CARDS (Stat Card pattern) ============
function KpiCards({ traffic, periodLabel }) {
  const bounce = Math.round((traffic.bounceRate || 0) * 100);
  const cards = [
    { icon: <BiGroup className="size-7" />, num: fmtNum(traffic.totalUsers || 0), label: 'คนเข้าชม', sub: `ใน ${periodLabel}` },
    { icon: <BiFile className="size-7" />, num: fmtNum(traffic.screenPageViews || 0), label: 'หน้าที่ถูกดู', sub: `เฉลี่ย ${traffic.totalUsers ? ((traffic.screenPageViews || 0) / traffic.totalUsers).toFixed(1) : '0'} หน้า/คน` },
    { icon: <BiTime className="size-7" />, num: fmtDuration(traffic.averageSessionDuration || 0), label: 'เวลาอยู่ในเว็บ', sub: 'เฉลี่ยต่อคน' },
    { icon: bounce > 60 ? <BiDownArrowAlt className="size-7 text-system-error-red" /> : <BiUpArrowAlt className="size-7 text-system-success-green" />, num: `${bounce}%`, label: 'ออกทันที', sub: bounce > 60 ? 'สูงกว่าปกติ (ควร < 40%)' : 'อยู่ในเกณฑ์' },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-flow-col md:auto-cols-fr md:gap-6">
      {cards.map((c, i) => (
        <div key={i} className="flex flex-col items-center border border-border-primary bg-white p-6 text-center">
          <div className="mb-2 text-neutral-dark">{c.icon}</div>
          <h2 className="text-2xl font-bold md:text-3xl">{c.num}</h2>
          <p className="mt-1 text-sm font-semibold">{c.label}</p>
          <p className="text-xs text-neutral">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ============ TREND CHART ============
function TrendChart({ trends }) {
  const rows = (trends?.rows || []).slice(-14);
  const max = Math.max(...rows.map(r => r.sessions || 0), 1);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (r.sessions || 0), 0) / rows.length) : 0;

  return (
    <div className="mb-6 border border-border-primary bg-white">
      <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
        <h2 className="text-base font-bold">คนเข้าเว็บรายวัน</h2>
        <Badge variant="secondary">เฉลี่ย {avg} คน/วัน</Badge>
      </div>
      <div className="flex items-end gap-1 px-6 py-5" style={{ height: 180 }}>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
            <span className="mb-1 text-[10px] font-semibold text-neutral">{r.sessions}</span>
            <div
              className="trend-bar-animated w-full max-w-[40px] rounded-t"
              style={{
                height: `${Math.max((r.sessions / max) * 100, 3)}%`,
                background: r.sessions >= max * 0.7 ? '#000' : r.sessions >= max * 0.3 ? '#666' : '#ddd',
              }}
            />
            <span className="mt-1 text-[10px] text-neutral">{formatDate(r.date)}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="flex w-full items-center justify-center py-8 text-sm text-neutral">ยังไม่มีข้อมูล</div>
        )}
      </div>
    </div>
  );
}

// ============ ACTION ITEMS ============
function ActionItems({ allPages, landing, gscQueries, traffic }) {
  const bounceLandings = (landing?.rows || []).filter(r =>
    r.sessions >= 2 && r.bounceRate >= 0.9 && r.landingPage && r.landingPage !== '' && r.landingPage !== '(not set)'
  );
  const notFound = (allPages?.rows || []).filter(r => r.pageTitle === 'Not Found');
  const hasConversions = landing?.rows?.some(r => r.keyEvents > 0);
  const lowCTR = (gscQueries || []).filter(q => q.impressions >= 50 && q.ctr < 3);

  const actions = [];
  if (!hasConversions) actions.push({
    priority: 'ด่วนมาก', bg: 'bg-system-error-red-light', border: 'border-system-error-red', color: 'text-system-error-red',
    title: 'ติดตั้งระบบนับลูกค้า',
    desc: 'ตอนนี้ไม่รู้เลยว่าคนกดติดต่อ/กรอกฟอร์มกี่คน เหมือนขายของแต่ไม่นับเงิน',
    how: 'ตั้ง Google Analytics Events ให้ track เมื่อคนกดปุ่มติดต่อ, กรอกฟอร์ม, หรือเข้าหน้า Thank You',
  });
  if (notFound.length > 0) actions.push({
    priority: 'ด่วนมาก', bg: 'bg-system-error-red-light', border: 'border-system-error-red', color: 'text-system-error-red',
    title: `แก้หน้าที่พัง (${notFound.length} หน้า)`,
    desc: 'มีหน้าเว็บที่เปิดไม่ได้ คนคลิกจาก Google มาเจอหน้าเปล่า',
    pages: notFound.map(p => p.pagePath),
    how: 'Redirect URL เก่าไปหน้าที่ถูกต้อง หรือสร้าง content ใหม่',
  });
  if (bounceLandings.length > 0) actions.push({
    priority: 'ควรแก้', bg: 'bg-orange-50', border: 'border-orange-400', color: 'text-orange-600',
    title: `หน้าที่คนเข้าแล้วออกทันที (${bounceLandings.length} หน้า)`,
    desc: 'คน Google เข้ามาแล้วไม่อ่านต่อ อาจเป็นเพราะ content ไม่ตรงที่คนหา',
    pages: bounceLandings.slice(0, 4).map(r => `${r.landingPage} (${r.sessions} คน)`),
    how: 'เพิ่มปุ่ม "ติดต่อเรา" / "ดูผลงาน" ให้ชัดเจน ปรับ content ให้ตรง keyword',
  });
  if (lowCTR.length > 0) actions.push({
    priority: 'โอกาส', bg: 'bg-blue-50', border: 'border-blue-400', color: 'text-blue-600',
    title: 'เว็บขึ้น Google แล้ว แต่คนไม่คลิก',
    desc: 'มีคำค้นที่เว็บขึ้นแสดงแล้วแต่ชื่อไม่ดึงดูดพอ คนเห็นแล้วเลื่อนผ่าน',
    how: 'เขียน Title และคำอธิบายใหม่ให้น่าคลิก ใส่ตัวเลขหรือ benefit ที่ชัดเจน',
  });
  if ((traffic.sessions || 0) < 100) actions.push({
    priority: 'โอกาส', bg: 'bg-blue-50', border: 'border-blue-400', color: 'text-blue-600',
    title: 'คนเข้าเว็บยังน้อย',
    desc: 'ส่วนใหญ่เป็นคนที่รู้จักเว็บอยู่แล้ว ยังไม่มีช่องทางดึงคนใหม่เข้ามา',
    how: 'โพสต์ใน LinkedIn / เขียน Blog ที่ตรง keyword / ลอง Google Ads ทดสอบ',
  });

  return (
    <div className="mb-6 border border-border-primary bg-white">
      <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <BiTargetLock className="size-5" /> สิ่งที่ต้องทำ
        </h2>
        <Badge>{actions.length} รายการ</Badge>
      </div>
      <div className="flex flex-col gap-4 p-6">
        {actions.map((a, i) => (
          <div key={i} className={`rounded-lg border-l-4 ${a.border} ${a.bg} p-5`}>
            <span className={`text-xs font-bold uppercase tracking-wide ${a.color}`}>{a.priority}</span>
            <h3 className="mt-1 text-sm font-bold">{a.title}</h3>
            <p className="mt-1 text-sm text-neutral-dark">{a.desc}</p>
            {a.pages && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.pages.map((p, j) => (
                  <Badge key={j} variant="secondary" className="font-mono text-xs">{p}</Badge>
                ))}
              </div>
            )}
            <div className="mt-3 rounded-md bg-white/70 px-3 py-2 text-sm">
              <strong>วิธีแก้:</strong> {a.how}
            </div>
          </div>
        ))}
        {actions.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-system-success-green">
            <BiCheckCircle className="size-5" /> ไม่พบปัญหาเร่งด่วน
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SOURCES + DEVICES ============
function SourcesAndDevices({ topSources, devices, countries }) {
  const total = topSources.reduce((s, x) => s + (x.sessions || 0), 0) || 1;

  const sourceLabel = (s) => {
    if (s.sessionSource === '(direct)') return 'พิมพ์ URL เข้ามาเอง';
    if (s.sessionSource === 'google' && s.sessionMedium === 'organic') return 'ค้น Google';
    if (s.sessionMedium?.includes('referral')) return `จากเว็บ ${s.sessionSource}`;
    if (s.sessionSource === '(not set)') return 'ไม่ทราบแหล่ง';
    return `${s.sessionSource} (${s.sessionMedium})`;
  };

  const deviceLabel = (d) => {
    if (d === 'desktop') return '🖥️ คอมพิวเตอร์';
    if (d === 'mobile') return '📱 มือถือ';
    return '📟 แท็บเล็ต';
  };

  const countryLabel = (c) => {
    const map = { Thailand: '🇹🇭 ไทย', 'United States': '🇺🇸 สหรัฐฯ', China: '🇨🇳 จีน', Singapore: '🇸🇬 สิงคโปร์' };
    return map[c] || c;
  };

  return (
    <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="border border-border-primary bg-white">
        <div className="border-b border-border-primary px-6 py-4">
          <h2 className="text-base font-bold">คนมาจากไหน</h2>
        </div>
        <div className="p-6">
          {topSources.map((s, i) => {
            const pct = Math.round((s.sessions / total) * 100);
            return (
              <div key={i} className="mb-4 last:mb-0">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{sourceLabel(s)}</span>
                  <span className="text-neutral">{s.sessions} คน</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-background-secondary">
                  <div className="h-full rounded-full bg-neutral-darkest transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-border-primary bg-white">
        <div className="border-b border-border-primary px-6 py-4">
          <h2 className="text-base font-bold">อุปกรณ์ & ประเทศ</h2>
        </div>
        <div className="p-6">
          {devices.map((d, i) => (
            <div key={i} className="flex items-center justify-between border-b border-background-secondary py-3 text-sm last:border-0">
              <span>{deviceLabel(d.deviceCategory)}</span>
              <span className="font-semibold">{fmtNum(d.sessions)} คน</span>
            </div>
          ))}
          <div className="my-3 h-px bg-border-primary" />
          {countries.slice(0, 4).map((c, i) => (
            <div key={i} className="flex items-center justify-between border-b border-background-secondary py-3 text-sm last:border-0">
              <span>{countryLabel(c.country)}</span>
              <span className="font-semibold">{fmtNum(c.sessions)} คน</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ TOP PAGES FROM GOOGLE ============
function TopFromGoogle({ gscPages }) {
  const pages = (gscPages || []).filter(p => p.clicks >= 1).sort((a, b) => b.clicks - a.clicks).slice(0, 6);

  return (
    <div className="mb-6 border border-border-primary bg-white">
      <div className="border-b border-border-primary px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <BiSearchAlt className="size-5" /> หน้าที่คนจาก Google เข้ามามากสุด
        </h2>
      </div>
      <div className="divide-y divide-background-secondary">
        {pages.map((p, i) => {
          const path = p.keys?.[0]?.replace('https://www.visionxbrain.com', '') || '';
          return (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background-secondary text-sm font-bold">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{path}</p>
                <p className="text-xs text-neutral">
                  {p.clicks} คลิก &middot; {fmtNum(p.impressions)} ครั้งที่ขึ้น Google &middot; อันดับ {p.position?.toFixed(0)}
                </p>
              </div>
              <Badge variant={p.ctr > 5 ? 'default' : 'secondary'}>
                {p.ctr}% คลิก
              </Badge>
            </div>
          );
        })}
        {pages.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-neutral">ยังไม่มีข้อมูลจาก Google</div>
        )}
      </div>
    </div>
  );
}

// ============ OPPORTUNITIES ============
function Opportunities({ gscQueries }) {
  const opps = (gscQueries || [])
    .filter(q => q.impressions >= 10 && q.keys?.[0]?.length < 60)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8);

  return (
    <div className="mb-6 border border-border-primary bg-white">
      <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <BiTrendingUp className="size-5" /> โอกาสที่พลาดไป
        </h2>
        <Badge variant="secondary">คำค้นที่เว็บขึ้น Google แล้วแต่คนไม่คลิก</Badge>
      </div>
      <div className="divide-y divide-background-secondary">
        {opps.map((q, i) => (
          <div key={i} className="px-6 py-4">
            <p className="text-sm font-semibold">"{q.keys?.[0]}"</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral">
              <span>ขึ้น Google <strong className="text-text-primary">{fmtNum(q.impressions)}</strong> ครั้ง</span>
              <span>คลิกแค่ <strong className="text-text-primary">{q.clicks}</strong> ครั้ง ({q.ctr}%)</span>
              <span>อันดับ {q.position?.toFixed(0)}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-background-secondary">
              <div className="h-full rounded-full bg-neutral" style={{ width: `${Math.min(q.ctr * 5, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ GOOD vs PROBLEM PAGES ============
function PageHealth({ allPages }) {
  const good = (allPages?.rows || []).filter(r => r.pageTitle !== 'Not Found' && r.bounceRate < 0.9 && r.screenPageViews >= 2);
  const problem = (allPages?.rows || []).filter(r => r.pageTitle === 'Not Found' || r.bounceRate >= 0.9);

  return (
    <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="border border-border-primary bg-white">
        <div className="border-b border-border-primary px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <BiCheckCircle className="size-5 text-system-success-green" /> หน้าที่ทำได้ดี
          </h2>
        </div>
        <div className="divide-y divide-background-secondary">
          {good.slice(0, 6).map((p, i) => (
            <div key={i} className="px-6 py-3">
              <p className="truncate text-sm font-medium">{p.pagePath}</p>
              <p className="text-xs text-neutral">{fmtNum(p.screenPageViews)} views &middot; อ่านนาน {fmtDuration(p.averageSessionDuration)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="border border-border-primary bg-white">
        <div className="border-b border-border-primary px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <BiXCircle className="size-5 text-system-error-red" /> หน้าที่มีปัญหา
          </h2>
        </div>
        <div className="divide-y divide-background-secondary">
          {problem.slice(0, 6).map((p, i) => (
            <div key={i} className="px-6 py-3">
              <div className="flex items-center gap-2">
                {p.pageTitle === 'Not Found' && <Badge className="bg-system-error-red-light text-system-error-red">404</Badge>}
                {p.pageTitle !== 'Not Found' && <Badge variant="secondary">ออกทันที</Badge>}
                <p className="truncate text-sm font-medium">{p.pagePath}</p>
              </div>
              <p className="mt-0.5 text-xs text-neutral">
                {p.pageTitle === 'Not Found' ? 'หน้าไม่มีอยู่แล้ว' : `${fmtNum(p.sessions)} คนเข้า แต่ไม่ทำอะไร`}
              </p>
            </div>
          ))}
          {problem.length === 0 && (
            <div className="px-6 py-4 text-sm text-system-success-green">ไม่มีหน้าที่มีปัญหา 🎉</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('28daysAgo');

  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [allPages, setAllPages] = useState(null);
  const [landing, setLanding] = useState(null);
  const [gscQueries, setGscQueries] = useState([]);
  const [gscPages, setGscPages] = useState([]);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="loader-spinner" />
        <p className="text-sm text-neutral">กำลังโหลดรายงาน...</p>
      </div>
    );
  }

  const traffic = summary?.traffic || summary?.totals || {};
  const topSources = summary?.topSources || [];
  const devices = summary?.devices || [];
  const countries = summary?.countries || [];
  const health = calcHealth(traffic, allPages, landing, gscQueries);
  const periodLabel = PERIOD_LABELS[period] || '28 วัน';

  return (
    <AppSidebar>
      <div className="relative flex-1 bg-background-secondary">
        <Topbar period={period} setPeriod={setPeriod} onRefresh={() => fetchData(false)} refreshing={refreshing} />
        <div className="h-[calc(100vh-4.5rem)] overflow-auto">
          <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-8">
            <HealthHero health={health} periodLabel={periodLabel} />
            <KpiCards traffic={traffic} periodLabel={periodLabel} />
            <TrendChart trends={trends} />
            <ActionItems allPages={allPages} landing={landing} gscQueries={gscQueries} traffic={traffic} />
            <SourcesAndDevices topSources={topSources} devices={devices} countries={countries} />
            <TopFromGoogle gscPages={gscPages} />
            <Opportunities gscQueries={gscQueries} />
            <PageHealth allPages={allPages} />
          </div>
        </div>
      </div>
    </AppSidebar>
  );
}
