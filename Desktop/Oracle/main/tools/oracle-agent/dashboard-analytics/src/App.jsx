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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@relume_io/relume-ui';
import {
  BiBarChartAlt2,
  BiCheckCircle,
  BiCog,
  BiDotsHorizontalRounded,
  BiDollar,
  BiDownArrowAlt,
  BiEnvelope,
  BiErrorCircle,
  BiFile,
  BiGroup,
  BiHelpCircle,
  BiInfoCircle,
  BiPieChartAlt2,
  BiRefresh,
  BiRocket,
  BiSearch,
  BiSearchAlt,
  BiTargetLock,
  BiTime,
  BiTrendingUp,
  BiUpArrowAlt,
  BiXCircle,
} from 'react-icons/bi';

const API = window.location.origin;

// ============ HELPERS ============
function fmtNum(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('th-TH');
}

function fmtDuration(secs) {
  if (!secs) return '0 วิ';
  if (secs < 60) return Math.round(secs) + ' วิ';
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

// ============ SIDEBAR NAV (ApplicationShell3 pattern) ============
const menuItems = [
  { title: 'รายงานเว็บ', url: '/vision/analytics/', icon: BiBarChartAlt2, active: true },
  { title: 'แผนเติบโต', url: '/vision/growthstrategy/', icon: BiRocket },
  { title: 'อีเมลลูกค้า', url: '/vision/email/', icon: BiEnvelope },
  { title: 'ค่าใช้จ่าย', url: '/costs/', icon: BiDollar },
];

const footerItems = [
  { title: 'Support', url: '#', icon: BiHelpCircle },
  { title: 'Settings', url: '#', icon: BiCog },
];

// ============ APP SIDEBAR (ApplicationShell3 exact pattern) ============
function AppSidebar({ children }) {
  return (
    <SidebarProvider>
      <Sidebar className="py-6" closeButtonClassName="fixed top-4 right-4 text-white">
        <SidebarHeader className="hidden lg:block">
          <a href="/vision/analytics/" className="flex items-center gap-2">
            <BiPieChartAlt2 className="size-6" />
            <span className="text-lg font-bold">VXB Report</span>
          </a>
        </SidebarHeader>
        <SidebarContent className="mt-6">
          <SidebarMenu>
            {menuItems.map((item, index) => (
              <SidebarMenuItem key={index}>
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
          <div>
            {footerItems.map((item, index) => (
              <SidebarMenuItem key={index}>
                <SidebarMenuButton asChild>
                  <a href={item.url} className="flex w-full items-center">
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="min-h-screen w-full pt-16 lg:pt-0">{children}</main>
    </SidebarProvider>
  );
}

// ============ TOPBAR (ApplicationShell3 exact pattern) ============
function Topbar({ period, setPeriod, onRefresh, refreshing }) {
  return (
    <>
      <div className="sticky top-0 z-30 hidden h-auto min-h-16 w-full items-center border-b border-border-primary bg-white px-6 md:min-h-18 lg:flex lg:px-8">
        <div className="mx-auto grid size-full grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_max-content] lg:justify-between lg:justify-items-stretch">
          <div className="hidden w-full max-w-md lg:block">
            <h1 className="text-base font-semibold">รายงานเว็บ VisionXBrain</h1>
          </div>
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

      <div className="fixed left-0 right-0 top-0 z-30 flex min-h-16 w-full items-center justify-between border-b border-border-primary bg-white px-6 lg:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <a href="/vision/analytics/" className="flex items-center">
            <span className="text-sm font-bold">VXB Report</span>
          </a>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
          <BiRefresh className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </>
  );
}

// ============ HEALTH (Stat3 pattern — cards with progress bar) ============
function HealthSection({ health, periodLabel }) {
  const stats = [
    {
      title: 'คะแนนสุขภาพเว็บ',
      description: `${health.score}/100`,
      icon: health.score >= 50 ? <BiUpArrowAlt /> : <BiDownArrowAlt />,
      badge: health.score >= 80 ? 'ดี' : health.score >= 50 ? 'ต้องปรับปรุง' : 'ต้องแก้ด่วน',
      progressBar: health.score,
    },
    {
      title: 'ปัญหาที่พบ',
      description: `${health.issues.length} รายการ`,
      icon: health.issues.length === 0 ? <BiUpArrowAlt /> : <BiDownArrowAlt />,
      badge: health.issues.filter(i => i.severity === 'critical').length > 0 ? 'มีเรื่องเร่งด่วน' : 'ไม่มีเรื่องด่วน',
      progressBar: Math.max(0, 100 - health.issues.length * 20),
    },
    {
      title: 'โอกาสเติบโต',
      description: health.score < 50 ? 'สูง' : health.score < 80 ? 'ปานกลาง' : 'ต่ำ',
      icon: <BiTrendingUp />,
      badge: 'แก้ปัญหา = โตทันที',
      progressBar: Math.max(0, 100 - health.score),
    },
  ];

  return (
    <section className="mb-8">
      {/* Stat3 header pattern */}
      <div className="mb-5 grid auto-cols-fr grid-cols-1 items-end gap-4 md:mb-6 md:grid-cols-[1fr_max-content] md:gap-6">
        <div className="w-full max-w-lg">
          <h1 className="text-xl font-bold md:text-2xl">สุขภาพเว็บ VisionXBrain</h1>
          <p className="mt-2">ข้อมูลย้อนหลัง {periodLabel}</p>
        </div>
        <div className="flex items-center justify-between gap-4 md:justify-normal">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <BiDotsHorizontalRounded className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>ดูรายละเอียด</DropdownMenuItem>
              <DropdownMenuItem>ส่งออกรายงาน</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Stat3 cards pattern */}
      <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="flex flex-col justify-between border border-border-primary p-6 md:justify-normal">
            <p className="mb-1">{stat.title}</p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold md:text-2xl">{stat.description}</h2>
              <div className="flex items-center gap-1">
                {stat.icon}
                <p className="text-sm">{stat.badge}</p>
              </div>
            </div>
            <div className="relative mt-3 h-1 bg-background-secondary md:mt-4">
              <div
                className="absolute left-0 top-0 h-full bg-background-alternative"
                style={{ width: `${stat.progressBar}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {/* Issues list */}
      {health.issues.length > 0 && (
        <div className="mt-4 border border-border-primary p-6">
          <p className="mb-3 text-sm font-semibold">ปัญหาที่พบ:</p>
          <div className="flex flex-col gap-2">
            {health.issues.map((issue, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {issue.severity === 'critical' && <BiErrorCircle className="size-4 shrink-0 text-system-error-red" />}
                {issue.severity === 'warning' && <BiErrorCircle className="size-4 shrink-0 text-orange-500" />}
                {issue.severity === 'info' && <BiInfoCircle className="size-4 shrink-0 text-blue-500" />}
                <span>{issue.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ============ KPI CARDS (Stat2 exact pattern — horizontal with trend) ============
function KpiCards({ traffic, periodLabel }) {
  const bounce = Math.round((traffic.bounceRate || 0) * 100);

  const stats = [
    {
      title: 'คนเข้าชม',
      description: fmtNum(traffic.totalUsers || 0),
      icon: <BiUpArrowAlt />,
      badge: `ใน ${periodLabel}`,
      comparisonText: `${fmtNum(traffic.sessions || 0)} sessions`,
    },
    {
      title: 'หน้าที่ถูกดู',
      description: fmtNum(traffic.screenPageViews || 0),
      icon: <BiUpArrowAlt />,
      badge: `${traffic.totalUsers ? ((traffic.screenPageViews || 0) / traffic.totalUsers).toFixed(1) : '0'} หน้า/คน`,
      comparisonText: 'เฉลี่ย',
    },
    {
      title: 'เวลาอยู่ในเว็บ',
      description: fmtDuration(traffic.averageSessionDuration || 0),
      icon: (traffic.averageSessionDuration || 0) > 60 ? <BiUpArrowAlt /> : <BiDownArrowAlt />,
      badge: 'เฉลี่ยต่อคน',
      comparisonText: '',
    },
    {
      title: 'ออกทันที (Bounce)',
      description: `${bounce}%`,
      icon: bounce > 60 ? <BiDownArrowAlt /> : <BiUpArrowAlt />,
      badge: bounce > 60 ? 'สูงกว่าปกติ' : 'ดี',
      comparisonText: bounce > 60 ? 'ควร < 40%' : '',
    },
  ];

  return (
    <section className="mb-8">
      {/* Stat2 cards pattern */}
      <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border border-border-primary p-6">
            <div className="flex flex-col items-start">
              <p className="mb-1">{stat.title}</p>
              <h2 className="text-xl font-bold md:text-2xl">{stat.description}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-1 lg:gap-1">
                <div className="flex items-center gap-0.5">
                  {stat.icon}
                  <p className="text-sm">{stat.badge}</p>
                </div>
                {stat.comparisonText && <p className="text-sm">{stat.comparisonText}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============ TREND CHART (custom — Relume has no chart component) ============
function TrendChart({ trends }) {
  const rows = (trends?.rows || []).slice(-14);
  const max = Math.max(...rows.map(r => r.sessions || 0), 1);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (r.sessions || 0), 0) / rows.length) : 0;

  return (
    <section className="mb-8">
      {/* CardHeader1 pattern for header */}
      <div className="grid grid-cols-1 items-end justify-between gap-4 border border-b-0 border-border-primary p-6 md:grid-cols-[1fr_max-content] md:gap-6">
        <div className="max-w-lg">
          <h2 className="text-xl font-bold md:text-2xl">คนเข้าเว็บรายวัน</h2>
          <p className="mt-1">จำนวนคนเข้าเว็บในแต่ละวัน</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary">เฉลี่ย {avg} คน/วัน</Badge>
        </div>
      </div>
      <div className="flex items-end gap-1 border border-t-0 border-border-primary px-6 py-5" style={{ height: 200 }}>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
            <span className="mb-1 text-[10px] font-semibold">{r.sessions}</span>
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
    </section>
  );
}

// ============ ACTION ITEMS (CardHeader1 + custom content) ============
function ActionItems({ allPages, landing, gscQueries, traffic }) {
  const bounceLandings = (landing?.rows || []).filter(r =>
    r.sessions >= 2 && r.bounceRate >= 0.9 && r.landingPage && r.landingPage !== '' && r.landingPage !== '(not set)'
  );
  const notFound = (allPages?.rows || []).filter(r => r.pageTitle === 'Not Found');
  const hasConversions = landing?.rows?.some(r => r.keyEvents > 0);
  const lowCTR = (gscQueries || []).filter(q => q.impressions >= 50 && q.ctr < 3);

  const actions = [];
  if (!hasConversions) actions.push({
    priority: 'ด่วนมาก', color: 'text-system-error-red',
    title: 'ติดตั้งระบบนับลูกค้า',
    desc: 'ตอนนี้ไม่รู้เลยว่าคนกดติดต่อ/กรอกฟอร์มกี่คน',
    how: 'ตั้ง Google Analytics Events ให้ track เมื่อคนกดปุ่มติดต่อ, กรอกฟอร์ม, หรือเข้าหน้า Thank You',
    pages: [],
  });
  if (notFound.length > 0) actions.push({
    priority: 'ด่วนมาก', color: 'text-system-error-red',
    title: `แก้หน้าที่พัง (${notFound.length} หน้า)`,
    desc: 'มีหน้าเว็บที่เปิดไม่ได้ คนคลิกจาก Google มาเจอหน้าเปล่า',
    how: 'Redirect URL เก่าไปหน้าที่ถูกต้อง หรือสร้าง content ใหม่',
    pages: notFound.map(p => p.pagePath),
  });
  if (bounceLandings.length > 0) actions.push({
    priority: 'ควรแก้', color: 'text-orange-600',
    title: `หน้าที่คนเข้าแล้วออกทันที (${bounceLandings.length} หน้า)`,
    desc: 'คน Google เข้ามาแล้วไม่อ่านต่อ',
    how: 'เพิ่มปุ่ม CTA ให้ชัดเจน ปรับ content ให้ตรง keyword',
    pages: bounceLandings.slice(0, 4).map(r => `${r.landingPage} (${r.sessions} คน)`),
  });
  if (lowCTR.length > 0) actions.push({
    priority: 'โอกาส', color: 'text-blue-600',
    title: 'เว็บขึ้น Google แล้ว แต่คนไม่คลิก',
    desc: 'มีคำค้นที่เว็บขึ้นแสดงแล้วแต่ชื่อไม่ดึงดูดพอ',
    how: 'เขียน Title และคำอธิบายใหม่ให้น่าคลิก',
    pages: [],
  });

  return (
    <section className="mb-8">
      {/* CardHeader1 pattern */}
      <div className="grid grid-cols-1 items-end justify-between gap-4 border border-border-primary p-6 md:grid-cols-[1fr_max-content] md:gap-6">
        <div className="max-w-lg">
          <h2 className="text-xl font-bold md:text-2xl">สิ่งที่ต้องทำ</h2>
          <p className="mt-1">รายการที่ต้องแก้ไขเพื่อปรับปรุงเว็บ</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge>{actions.length} รายการ</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <BiDotsHorizontalRounded className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>ดูทั้งหมด</DropdownMenuItem>
              <DropdownMenuItem>ส่งออก</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Table1 pattern for action items */}
      {actions.length > 0 && (
        <Table className="border-collapse">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ความสำคัญ</TableHead>
              <TableHead className="w-[250px]">ปัญหา</TableHead>
              <TableHead>รายละเอียด</TableHead>
              <TableHead className="w-[300px]">วิธีแก้</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((a, i) => (
              <TableRow key={i}>
                <TableCell>
                  <span className={`text-sm font-bold ${a.color}`}>{a.priority}</span>
                </TableCell>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell>
                  <p className="text-sm">{a.desc}</p>
                  {a.pages.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.pages.map((p, j) => (
                        <Badge key={j} variant="secondary" className="font-mono text-xs">{p}</Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{a.how}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {actions.length === 0 && (
        <div className="border border-t-0 border-border-primary p-6 text-sm text-system-success-green">
          <BiCheckCircle className="mr-1 inline size-4" /> ไม่พบปัญหาเร่งด่วน
        </div>
      )}
    </section>
  );
}

// ============ SOURCES (Stat2 pattern — horizontal cards) ============
function SourcesSection({ topSources, devices, countries }) {
  const total = topSources.reduce((s, x) => s + (x.sessions || 0), 0) || 1;

  const sourceLabel = (s) => {
    if (s.sessionSource === '(direct)') return 'พิมพ์ URL เข้ามาเอง';
    if (s.sessionSource === 'google' && s.sessionMedium === 'organic') return 'ค้น Google';
    if (s.sessionMedium?.includes('referral')) return `จากเว็บ ${s.sessionSource}`;
    if (s.sessionSource === '(not set)') return 'ไม่ทราบแหล่ง';
    return `${s.sessionSource} (${s.sessionMedium})`;
  };

  const deviceLabel = (d) => {
    if (d === 'desktop') return 'คอมพิวเตอร์';
    if (d === 'mobile') return 'มือถือ';
    return 'แท็บเล็ต';
  };

  // Stat2 pattern — sources as horizontal cards
  const sourceStats = topSources.slice(0, 3).map(s => ({
    title: sourceLabel(s),
    description: `${fmtNum(s.sessions)} คน`,
    icon: <BiUpArrowAlt />,
    badge: `${Math.round((s.sessions / total) * 100)}%`,
    comparisonText: 'ของทั้งหมด',
  }));

  return (
    <section className="mb-8">
      {/* Stat2 header pattern */}
      <div className="grid auto-cols-fr grid-cols-1 items-end gap-4 pb-5 md:grid-cols-[1fr_max-content] md:gap-6 md:pb-6">
        <div className="w-full max-w-lg">
          <h1 className="text-xl font-bold md:text-2xl">คนมาจากไหน</h1>
          <p className="mt-2">แหล่งที่มาของผู้เข้าชมเว็บ</p>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <BiDotsHorizontalRounded className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>ดูทั้งหมด</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Stat2 cards */}
      <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
        {sourceStats.map((stat, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border border-border-primary p-6">
            <div className="flex flex-col items-start">
              <p className="mb-1">{stat.title}</p>
              <h2 className="text-xl font-bold md:text-2xl">{stat.description}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-1 lg:gap-1">
                <div className="flex items-center gap-0.5">
                  {stat.icon}
                  <p className="text-sm">{stat.badge}</p>
                </div>
                <p className="text-sm">{stat.comparisonText}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Devices + Countries — 2-column grid with Stat3 style */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <div className="border border-border-primary">
          <div className="border-b border-border-primary p-6">
            <h3 className="font-bold">อุปกรณ์</h3>
          </div>
          <div className="p-6">
            {devices.map((d, i) => (
              <div key={i} className="flex items-center justify-between border-b border-background-secondary py-3 text-sm last:border-0">
                <span>{deviceLabel(d.deviceCategory)}</span>
                <span className="font-semibold">{fmtNum(d.sessions)} คน</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-border-primary">
          <div className="border-b border-border-primary p-6">
            <h3 className="font-bold">ประเทศ</h3>
          </div>
          <div className="p-6">
            {countries.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between border-b border-background-secondary py-3 text-sm last:border-0">
                <span>{c.country}</span>
                <span className="font-semibold">{fmtNum(c.sessions)} คน</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ TOP PAGES (Table1 exact pattern) ============
function PagesTable({ allPages }) {
  const rows = (allPages?.rows || []).filter(r => r.screenPageViews >= 1).slice(0, 10);

  return (
    <section className="mb-8">
      {/* Table1 header pattern */}
      <div className="flex flex-col items-start justify-between gap-4 border border-b-0 border-border-primary p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-1 text-md font-semibold md:text-lg">หน้ายอดนิยม</h1>
          <p>หน้าเว็บที่มีคนเข้าชมมากที่สุด</p>
        </div>
        <div className="flex gap-4">
          <Button variant="secondary" size="sm" title="ดูทั้งหมด">ดูทั้งหมด</Button>
        </div>
      </div>
      {/* Table1 table pattern */}
      <Table className="border-collapse">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px] pr-4">หน้าเว็บ</TableHead>
            <TableHead className="w-[80px] pr-4">Views</TableHead>
            <TableHead className="w-[80px] pr-4">คน</TableHead>
            <TableHead className="w-[100px] pr-4">เวลาอยู่</TableHead>
            <TableHead className="w-[80px] pr-4">Bounce</TableHead>
            <TableHead className="w-[80px] pr-4 text-center">สถานะ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const bounce = Math.round((row.bounceRate || 0) * 100);
            return (
              <TableRow key={i}>
                <TableCell className="font-medium">{row.pagePath}</TableCell>
                <TableCell>{fmtNum(row.screenPageViews)}</TableCell>
                <TableCell>{fmtNum(row.totalUsers)}</TableCell>
                <TableCell>{fmtDuration(row.averageSessionDuration)}</TableCell>
                <TableCell>{bounce}%</TableCell>
                <TableCell className="text-center">
                  {row.pageTitle === 'Not Found' ? (
                    <Badge className="bg-system-error-red-light text-system-error-red">404</Badge>
                  ) : bounce > 80 ? (
                    <Badge variant="secondary">สูง</Badge>
                  ) : (
                    <Badge>ดี</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}

// ============ GOOGLE SEARCH (Table1 exact pattern) ============
function GoogleSearchTable({ gscPages, gscQueries }) {
  const pages = (gscPages || []).filter(p => p.clicks >= 1).sort((a, b) => b.clicks - a.clicks).slice(0, 8);
  const opps = (gscQueries || []).filter(q => q.impressions >= 10 && q.keys?.[0]?.length < 60).sort((a, b) => b.impressions - a.impressions).slice(0, 8);

  return (
    <section className="mb-8">
      {/* Table1 header pattern */}
      <div className="flex flex-col items-start justify-between gap-4 border border-b-0 border-border-primary p-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-1 text-md font-semibold md:text-lg">ผลลัพธ์จาก Google Search</h1>
          <p>หน้าที่คนจาก Google เข้ามา + คำค้นที่เว็บขึ้นแสดง</p>
        </div>
        <div className="flex gap-4">
          <Badge variant="secondary">{pages.length} หน้า</Badge>
        </div>
      </div>
      {/* Top pages from Google */}
      <Table className="border-collapse">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[320px] pr-4">หน้า/คำค้น</TableHead>
            <TableHead className="w-[80px] pr-4">คลิก</TableHead>
            <TableHead className="w-[100px] pr-4">ขึ้น Google</TableHead>
            <TableHead className="w-[80px] pr-4">อันดับ</TableHead>
            <TableHead className="w-[80px] pr-4 text-center">CTR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((p, i) => {
            const path = p.keys?.[0]?.replace('https://www.visionxbrain.com', '') || '';
            return (
              <TableRow key={i}>
                <TableCell className="font-medium">{path}</TableCell>
                <TableCell>{p.clicks}</TableCell>
                <TableCell>{fmtNum(p.impressions)}</TableCell>
                <TableCell>{p.position?.toFixed(0)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={p.ctr > 5 ? 'default' : 'secondary'}>{p.ctr}%</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Opportunities - keywords with low CTR */}
      {opps.length > 0 && (
        <>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 border border-b-0 border-border-primary p-6 sm:flex-row sm:items-center">
            <div>
              <h1 className="mb-1 text-md font-semibold md:text-lg">โอกาสที่พลาดไป</h1>
              <p>คำค้นที่เว็บขึ้น Google แล้วแต่คนไม่คลิก</p>
            </div>
          </div>
          <Table className="border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px] pr-4">คำค้น</TableHead>
                <TableHead className="w-[100px] pr-4">ขึ้น Google</TableHead>
                <TableHead className="w-[80px] pr-4">คลิก</TableHead>
                <TableHead className="w-[80px] pr-4">อันดับ</TableHead>
                <TableHead className="w-[80px] pr-4 text-center">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opps.map((q, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">"{q.keys?.[0]}"</TableCell>
                  <TableCell>{fmtNum(q.impressions)}</TableCell>
                  <TableCell>{q.clicks}</TableCell>
                  <TableCell>{q.position?.toFixed(0)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{q.ctr}%</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
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
          <div className="container px-6 py-8 md:px-8 md:py-10 lg:py-12">
            <div className="grid grid-cols-1 gap-0">
              <HealthSection health={health} periodLabel={periodLabel} />
              <KpiCards traffic={traffic} periodLabel={periodLabel} />
              <TrendChart trends={trends} />
              <ActionItems allPages={allPages} landing={landing} gscQueries={gscQueries} traffic={traffic} />
              <SourcesSection topSources={topSources} devices={devices} countries={countries} />
              <PagesTable allPages={allPages} />
              <GoogleSearchTable gscPages={gscPages} gscQueries={gscQueries} />
            </div>
          </div>
        </div>
      </div>
    </AppSidebar>
  );
}
