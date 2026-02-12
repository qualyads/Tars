import { useState, useEffect, useCallback } from 'react';
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@relume_io/relume-ui';
import {
  BiCheck,
  BiCheckCircle,
  BiDownload,
  BiEdit,
  BiLinkExternal,
  BiRefresh,
  BiRocket,
  BiSearch,
  BiShield,
  BiTargetLock,
  BiX,
  BiXCircle,
  BiErrorCircle,
} from '@oracle/shared/components/Icons';
import { AppSidebar, Topbar, LoadingScreen, fmtDateISO } from '@oracle/shared';

const API = window.location.origin;

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

  if (loading) {
    return <LoadingScreen message="Loading 404 Check Dashboard..." />;
  }

  return (
    <AppSidebar activePath="/vision/404check/">
      <div className="relative flex-1 bg-background-secondary">
        <Topbar title="404 Check Dashboard" onRefresh={fetchResults} refreshing={false}>
          {isScanning && (
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block size-2 rounded-full bg-brand-primary pulse-dot" />
              <span>Scanning {jobStatus.progress || 0}/{jobStatus.total || '?'}</span>
            </div>
          )}
        </Topbar>
        <div className="h-[calc(100vh-4.5rem)] overflow-auto">
          <div className="container px-6 py-8 md:px-8 md:py-10 lg:py-12">
            {error && (
              <div className="mb-4 rounded border border-system-error-red/20 bg-system-error-red-light p-3 text-sm text-system-error-red">
                {error}
              </div>
            )}

            {/* Stat Cards */}
            <section className="mb-8">
              <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
                <StatCard404
                  icon={<BiErrorCircle className="size-6 text-system-error-red" />}
                  label="404 Errors Found"
                  value={errors404.length}
                  badge={results?.scannedAt ? `Last: ${fmtDateISO(results.scannedAt)}` : 'No scan yet'}
                  color="red"
                />
                <StatCard404
                  icon={<BiCheckCircle className="size-6 text-system-success-green" />}
                  label="Matched Redirects"
                  value={matched}
                  badge={totalRedirects > 0 ? `${Math.round(matched / totalRedirects * 100)}%` : '-'}
                  color="green"
                />
                <StatCard404
                  icon={<BiXCircle className="size-6 text-brand-primary" />}
                  label="Need Manual Review"
                  value={unmatched + review}
                  badge={homepage > 0 ? `${homepage} → homepage` : '-'}
                  color="yellow"
                />
                <StatCard404
                  icon={<BiShield className="size-6 text-brand-primary" />}
                  label="Targets Validated"
                  value={results?.validated ? `${validCount}/${totalRedirects}` : 'Not yet'}
                  badge={results?.validatedAt ? fmtDateISO(results.validatedAt) : 'Pending'}
                  color="blue"
                />
              </div>
            </section>

            {/* Scan Controls */}
            <section className="mb-8">
              <div className="overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
                <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
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
                  <div className="px-6 pb-6">
                    <div className="h-2 overflow-hidden rounded-full bg-background-secondary">
                      <div
                        className="h-full rounded-full bg-brand-primary transition-all duration-500"
                        style={{ width: `${(jobStatus.progress / jobStatus.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Redirect Table */}
            {totalRedirects > 0 && (
              <section className="mb-8">
                <div className="overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
                  <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
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
                          <span className="ml-1 rounded-full bg-brand-primary/10 px-1.5 text-xs">
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
                  <Table className="border-collapse border-t border-border-primary">
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
                                  <button onClick={() => saveEdit(realIdx)} className="text-system-success-green hover:text-system-success-green">
                                    <BiCheck className="size-5" />
                                  </button>
                                  <button onClick={() => setEditIdx(null)} className="text-text-secondary hover:text-text-secondary">
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
                              {r.targetValid === true && <BiCheckCircle className="size-4 text-system-success-green" />}
                              {r.targetValid === false && <BiXCircle className="size-4 text-system-error-red" />}
                              {r.targetValid === undefined && <span className="text-xs text-text-secondary">-</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => { setEditIdx(realIdx); setEditTarget(r.target); }}
                                className="rounded p-1 text-text-secondary hover:bg-background-secondary hover:text-brand-black"
                                title="Edit target"
                              >
                                <BiEdit className="size-4" />
                              </button>
                              <a
                                href={r.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 inline-block rounded p-1 text-text-secondary hover:bg-background-secondary hover:text-brand-black"
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

            {/* Action Bar */}
            <section>
              <div className="flex flex-wrap items-center gap-3 rounded-[15px] border border-border-primary bg-white p-6 shadow-xxs">
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
        </div>
      </div>
    </AppSidebar>
  );
}

// ============ LOCAL COMPONENTS ============

function StatCard404({ icon, label, value, badge, color = 'gray' }) {
  const borderColors = {
    red: 'border-l-red-500',
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    blue: 'border-l-blue-500',
    gray: 'border-l-gray-300',
  };

  return (
    <div className={`flex flex-col justify-between rounded-[15px] border border-border-primary border-l-4 ${borderColors[color]} bg-white p-6 shadow-xxs`}>
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
    matched: matchType === 'exact' ? 'bg-system-success-green-light text-system-success-green' :
             matchType === 'manual' ? 'bg-brand-primary/10 text-brand-primary' :
             'bg-brand-primary/10 text-brand-primary',
    review: 'bg-brand-primary/10 text-brand-primary',
    unmatched: 'bg-system-error-red-light text-system-error-red',
  };

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-background-secondary text-text-secondary'}`}>
      {status}
    </span>
  );
}

function shortUrl(url) {
  if (!url) return '-';
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
