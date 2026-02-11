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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
} from '@relume_io/relume-ui';
import {
  BiBarChartAlt2,
  BiCheck,
  BiCheckCircle,
  BiDownload,
  BiEdit,
  BiEnvelope,
  BiError,
  BiErrorCircle,
  BiLinkAlt,
  BiLinkExternal,
  BiPieChartAlt2,
  BiRefresh,
  BiRocket,
  BiSearch,
  BiSearchAlt,
  BiShield,
  BiTargetLock,
  BiTime,
  BiUpArrowAlt,
  BiX,
  BiXCircle,
} from 'react-icons/bi';

const API = window.location.origin;

// ============ SIDEBAR NAV ============
const sidebarNav = [
  { label: 'Email Pipeline', icon: BiEnvelope, href: '/vision/email/' },
  { label: 'Analytics', icon: BiBarChartAlt2, href: '/vision/analytics/' },
  { label: '404 Check', icon: BiErrorCircle, href: '/vision/404check/', active: true },
];

// ============ APP ============
export default function App() {
  const [results, setResults] = useState(null);
  const [jobStatus, setJobStatus] = useState({ status: 'idle' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [editIdx, setEditIdx] = useState(null);
  const [editTarget, setEditTarget] = useState('');
  const [matching, setMatching] = useState(false);
  const [validating, setValidating] = useState(false);
  const [siteUrl, setSiteUrl] = useState('sc-domain:visionxbrain.com');

  // Fetch results
  const fetchResults = useCallback(async () => {
    try {
      const [resResults, resStatus] = await Promise.all([
        fetch(`${API}/api/404check/results`),
        fetch(`${API}/api/404check/status`),
      ]);
      const [dataResults, dataStatus] = await Promise.all([
        resResults.json(),
        resStatus.json(),
      ]);
      if (!dataResults.empty) setResults(dataResults);
      setJobStatus(dataStatus);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 5000);
    return () => clearInterval(interval);
  }, [fetchResults]);

  // Actions
  const startScan = async () => {
    try {
      await fetch(`${API}/api/404check/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      });
      setJobStatus({ status: 'scanning', progress: 0 });
    } catch (e) { setError(e.message); }
  };

  const runMatch = async () => {
    setMatching(true);
    try {
      await fetch(`${API}/api/404check/match`, { method: 'POST' });
      await fetchResults();
    } catch (e) { setError(e.message); }
    setMatching(false);
  };

  const runValidate = async () => {
    setValidating(true);
    try {
      await fetch(`${API}/api/404check/validate`, { method: 'POST' });
      await fetchResults();
    } catch (e) { setError(e.message); }
    setValidating(false);
  };

  const downloadCSV = () => {
    window.open(`${API}/api/404check/csv`, '_blank');
  };

  const saveEdit = async (index) => {
    try {
      await fetch(`${API}/api/404check/redirect/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: editTarget }),
      });
      setEditIdx(null);
      await fetchResults();
    } catch (e) { setError(e.message); }
  };

  // Computed
  const redirects = results?.redirects || [];
  const errors404 = results?.errors404 || [];
  const matched = redirects.filter(r => r.status === 'matched').length;
  const unmatched = redirects.filter(r => r.status === 'unmatched').length;
  const review = redirects.filter(r => r.status === 'review').length;
  const homepage = redirects.filter(r => r.matchType === 'homepage').length;
  const validCount = redirects.filter(r => r.targetValid === true).length;
  const totalRedirects = redirects.length;

  const filteredRedirects = redirects.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'matched') return r.status === 'matched';
    if (filter === 'unmatched') return r.status === 'unmatched';
    if (filter === 'review') return r.status === 'review';
    if (filter === 'homepage') return r.matchType === 'homepage';
    return true;
  });

  const isScanning = jobStatus.status === 'scanning' || jobStatus.status === 'checking';

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="loader-spinner mx-auto mb-4" />
          <p className="text-sm text-text-secondary">Loading 404 Check Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Sidebar — Relume pattern */}
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <BiShield className="size-6" />
              <span className="text-lg font-bold">VXB Vision</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {sidebarNav.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={item.active}>
                    <a href={item.href} className="flex items-center gap-3">
                      <item.icon className="size-5" />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <p className="text-xs text-text-secondary">Oracle Agent v6</p>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="border-b border-border-primary px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-xl font-bold md:text-2xl">404 Check Dashboard</h1>
                  <p className="text-sm text-text-secondary">Scan GSC → Auto-Match Redirects → Download CSV</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isScanning && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-block size-2 rounded-full bg-yellow-500 pulse-dot" />
                    <span>Scanning {jobStatus.progress || 0}/{jobStatus.total || '?'}</span>
                  </div>
                )}
                <Button variant="secondary" size="sm" onClick={fetchResults}>
                  <BiRefresh className="mr-1 size-4" /> Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Section 1: Stat Cards — Relume Stat1 pattern */}
            <section className="mb-8">
              <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
                <StatCard
                  icon={<BiErrorCircle className="size-6 text-red-500" />}
                  label="404 Errors Found"
                  value={errors404.length}
                  badge={results?.scannedAt ? `Last: ${fmtDate(results.scannedAt)}` : 'No scan yet'}
                  color="red"
                />
                <StatCard
                  icon={<BiCheckCircle className="size-6 text-green-600" />}
                  label="Matched Redirects"
                  value={matched}
                  badge={totalRedirects > 0 ? `${Math.round(matched / totalRedirects * 100)}%` : '-'}
                  color="green"
                />
                <StatCard
                  icon={<BiXCircle className="size-6 text-yellow-600" />}
                  label="Need Manual Review"
                  value={unmatched + review}
                  badge={homepage > 0 ? `${homepage} → homepage` : '-'}
                  color="yellow"
                />
                <StatCard
                  icon={<BiShield className="size-6 text-blue-600" />}
                  label="Targets Validated"
                  value={results?.validated ? `${validCount}/${totalRedirects}` : 'Not yet'}
                  badge={results?.validatedAt ? fmtDate(results.validatedAt) : 'Pending'}
                  color="blue"
                />
              </div>
            </section>

            {/* Section 2: Scan Controls */}
            <section className="mb-8">
              <div className="flex flex-col items-start justify-between gap-4 border border-border-primary p-6 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <BiSearch className="size-5 text-text-secondary" />
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium">GSC Site URL</label>
                    <Input
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      placeholder="sc-domain:visionxbrain.com"
                      className="max-w-md"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={startScan}
                  disabled={isScanning}
                >
                  <BiRocket className="mr-1 size-4" />
                  {isScanning ? `Scanning... ${jobStatus.progress || 0}/${jobStatus.total || '?'}` : 'Scan GSC'}
                </Button>
              </div>
              {isScanning && jobStatus.total > 0 && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-black transition-all duration-500"
                    style={{ width: `${(jobStatus.progress / jobStatus.total) * 100}%` }}
                  />
                </div>
              )}
            </section>

            {/* Section 3: Redirect Table — Relume Table1 pattern */}
            {totalRedirects > 0 && (
              <section className="mb-8">
                <div className="flex flex-col items-start justify-between gap-4 border border-b-0 border-border-primary p-6 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="mb-1 text-md font-semibold md:text-lg">Redirect Mappings</h2>
                    <p className="text-sm text-text-secondary">
                      {matched} matched · {review} review · {unmatched} unmatched · {homepage} homepage
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['all', 'matched', 'review', 'unmatched', 'homepage'].map(f => (
                      <Button
                        key={f}
                        variant={filter === f ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setFilter(f)}
                      >
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className="ml-1 rounded-full bg-black/10 px-1.5 text-xs">
                          {f === 'all' ? totalRedirects :
                           f === 'matched' ? matched :
                           f === 'review' ? review :
                           f === 'unmatched' ? unmatched :
                           homepage}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table className="border-collapse">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Status</TableHead>
                        <TableHead className="w-[300px]">Source URL</TableHead>
                        <TableHead className="w-[300px]">Target URL</TableHead>
                        <TableHead className="w-[100px]">Match</TableHead>
                        <TableHead className="w-[80px]">Valid</TableHead>
                        <TableHead className="w-[100px] text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRedirects.map((r, idx) => {
                        const realIdx = redirects.indexOf(r);
                        const isEditing = editIdx === realIdx;
                        return (
                          <TableRow key={realIdx}>
                            <TableCell>
                              <MatchBadge status={r.status} matchType={r.matchType} />
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <span className="block truncate text-sm font-medium" title={r.sourcePath}>
                                {r.sourcePath}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={editTarget}
                                    onChange={(e) => setEditTarget(e.target.value)}
                                    className="flex-1 text-sm"
                                    autoFocus
                                  />
                                  <button onClick={() => saveEdit(realIdx)} className="text-green-600 hover:text-green-800">
                                    <BiCheck className="size-5" />
                                  </button>
                                  <button onClick={() => setEditIdx(null)} className="text-gray-400 hover:text-gray-600">
                                    <BiX className="size-5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="block truncate text-sm" title={r.target}>
                                  {shortUrl(r.target)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-text-secondary">{r.matchType}</span>
                              {r.confidence > 0 && r.confidence < 1 && (
                                <span className="ml-1 text-xs text-text-secondary">({Math.round(r.confidence * 100)}%)</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {r.targetValid === true && <BiCheckCircle className="size-4 text-green-600" />}
                              {r.targetValid === false && <BiXCircle className="size-4 text-red-500" />}
                              {r.targetValid === undefined && <span className="text-xs text-text-secondary">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => { setEditIdx(realIdx); setEditTarget(r.target); }}
                                className="rounded p-1 text-text-secondary hover:bg-gray-100 hover:text-black"
                                title="Edit target"
                              >
                                <BiEdit className="size-4" />
                              </button>
                              <a
                                href={r.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 inline-block rounded p-1 text-text-secondary hover:bg-gray-100 hover:text-black"
                                title="Open source URL"
                              >
                                <BiLinkExternal className="size-4" />
                              </a>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}

            {/* Section 4: Action Bar */}
            <section>
              <div className="flex flex-wrap items-center gap-3 border border-border-primary p-6">
                <Button variant="secondary" size="sm" onClick={runMatch} disabled={matching || errors404.length === 0}>
                  <BiTargetLock className="mr-1 size-4" />
                  {matching ? 'Matching...' : 'Auto-Match'}
                </Button>
                <Button variant="secondary" size="sm" onClick={runValidate} disabled={validating || totalRedirects === 0}>
                  <BiShield className="mr-1 size-4" />
                  {validating ? 'Validating...' : 'Validate All'}
                </Button>
                <Button size="sm" onClick={downloadCSV} disabled={totalRedirects === 0}>
                  <BiDownload className="mr-1 size-4" />
                  Download CSV
                </Button>
                <div className="ml-auto text-sm text-text-secondary">
                  {results?.totalPages ? `${results.totalPages} pages scanned` : 'No scan data'}
                  {results?.healthyCount ? ` · ${results.healthyCount} healthy` : ''}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

// ============ COMPONENTS ============

function StatCard({ icon, label, value, badge, color = 'gray' }) {
  const borderColors = {
    red: 'border-l-red-500',
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    blue: 'border-l-blue-500',
    gray: 'border-l-gray-300',
  };

  return (
    <div className={`flex flex-col justify-between border border-border-primary border-l-4 ${borderColors[color]} p-6`}>
      <div className="mb-3 flex items-center justify-between gap-4">
        {icon}
      </div>
      <p className="mb-1 text-sm text-text-secondary">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold md:text-2xl">{value}</h2>
        <span className="rounded-full border border-border-primary px-2 py-0.5 text-xs text-text-secondary">
          {badge}
        </span>
      </div>
    </div>
  );
}

function MatchBadge({ status, matchType }) {
  const styles = {
    matched: matchType === 'exact' ? 'bg-green-100 text-green-800' :
             matchType === 'manual' ? 'bg-purple-100 text-purple-800' :
             'bg-blue-100 text-blue-800',
    review: 'bg-yellow-100 text-yellow-800',
    unmatched: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ============ HELPERS ============

function fmtDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function shortUrl(url) {
  if (!url) return '-';
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
