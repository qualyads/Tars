import { useState, useEffect, useCallback } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
} from '@relume_io/relume-ui';
import {
  BiCheckCircle,
  BiEnvelope,
  BiGroup,
  BiLinkAlt,
  BiMailSend,
  BiPlay,
  BiRefresh,
  BiUpArrowAlt,
} from '@oracle/shared/components/Icons';
import {
  AppSidebar,
  Topbar,
  StatCardProgress,
  LoadingScreen,
  fmtDateISO,
} from '@oracle/shared';

const API_BASE = window.location.origin;

// ============ MAIN APP ============
export default function App() {
  const [emailStats, setEmailStats] = useState(null);
  const [leadStats, setLeadStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [finderStatus, setFinderStatus] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [runningManual, setRunningManual] = useState(false);
  const [runResult, setRunResult] = useState(null);

  // DGP Modal state
  const [dgpModalOpen, setDgpModalOpen] = useState(false);
  const [dgpLead, setDgpLead] = useState(null);
  const [dgpGenerating, setDgpGenerating] = useState(false);
  const [dgpPreview, setDgpPreview] = useState('');
  const [dgpSending, setDgpSending] = useState(false);
  const [dgpError, setDgpError] = useState(null);
  const [dgpSuccess, setDgpSuccess] = useState(null);
  const [dgpSubject, setDgpSubject] = useState('');
  const [dgpTab, setDgpTab] = useState('preview');
  const [dgpEditParts, setDgpEditParts] = useState(null);
  const [dgpTrackingId, setDgpTrackingId] = useState('');
  const [dgpEmail, setDgpEmail] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [emailRes, leadStatsRes, leadsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/email/stats`),
        fetch(`${API_BASE}/api/leads/stats`),
        fetch(`${API_BASE}/api/leads`),
        fetch(`${API_BASE}/api/leads/status`),
      ]);
      const [emailData, leadStatsData, leadsData, statusData] = await Promise.all([
        emailRes.json(),
        leadStatsRes.json(),
        leadsRes.json(),
        statusRes.json(),
      ]);
      setEmailStats(emailData);
      setLeadStats(leadStatsData);
      setLeads(Array.isArray(leadsData) ? leadsData : leadsData.leads || []);
      setFinderStatus(statusData);
      setLastRefresh(new Date());
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

  const runLeadFinder = async () => {
    setRunningManual(true);
    setRunResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/leads/run`, { method: 'POST' });
      const data = await res.json();
      setRunResult(data);
      const poll = setInterval(async () => {
        const s = await fetch(`${API_BASE}/api/leads/status`).then(r => r.json());
        setFinderStatus(s);
        if (!s.running) {
          clearInterval(poll);
          setRunningManual(false);
          fetchData();
        }
      }, 10000);
    } catch (e) {
      setRunResult({ error: e.message });
      setRunningManual(false);
    }
  };

  // DGP Handlers
  const handleDgpClick = async (lead) => {
    setDgpLead(lead);
    setDgpModalOpen(true);
    setDgpGenerating(true);
    setDgpPreview('');
    setDgpSubject('');
    setDgpEditParts(null);
    setDgpError(null);
    setDgpSuccess(null);
    setDgpTab('preview');
    setDgpTrackingId('');
    setDgpEmail(lead.email || '');

    try {
      const res = await fetch(`${API_BASE}/api/leads/dgp-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: lead.place_id, domain: lead.domain, email: lead.email }),
      });
      const data = await res.json();
      if (data.error) {
        setDgpError(data.error);
      } else {
        setDgpSubject(data.subject);
        setDgpPreview(data.htmlPreview);
        setDgpEditParts(data.customParts);
        setDgpTrackingId(data.trackingId);
      }
    } catch (e) {
      setDgpError(e.message);
    } finally {
      setDgpGenerating(false);
    }
  };

  const handleDgpSend = async () => {
    if (!dgpEmail || !dgpSubject) return;
    setDgpSending(true);
    setDgpError(null);
    setDgpSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/api/leads/dgp-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: dgpLead.place_id,
          email: dgpEmail,
          subject: dgpSubject,
          htmlBody: dgpPreview,
          customParts: dgpEditParts,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setDgpError(data.error);
      } else {
        setDgpSuccess(`Sent to ${dgpEmail}`);
        fetchData();
      }
    } catch (e) {
      setDgpError(e.message);
    } finally {
      setDgpSending(false);
    }
  };

  const filteredLeads = (filter === 'all' ? leads : leads.filter(l => l.status === filter))
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  const totalLeads = leadStats?.total || leads.length;
  const goodTargets = leadStats?.goodTargets || 0;
  const totalEmailed = emailStats?.totalEmailed || 0;
  const totalClicked = emailStats?.totalClicked || 0;
  const clickRate = emailStats?.clickRate || '0%';
  const replied = leads.filter(l => l.status === 'replied').length;

  const counts = {
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    emailed: leads.filter(l => l.status === 'emailed').length,
    replied: leads.filter(l => l.status === 'replied').length,
    proposal_sent: leads.filter(l => l.status === 'proposal_sent').length,
  };

  if (loading) {
    return <LoadingScreen message="Loading Email Dashboard..." />;
  }

  const isRunning = finderStatus?.running || runningManual;

  return (
    <AppSidebar activePath="/vision/email/">
      <div className="relative flex-1 bg-background-secondary">
        <Topbar title="Email Campaign Report" onRefresh={fetchData} refreshing={false}>
          <Button variant="secondary" size="sm" onClick={runLeadFinder} disabled={isRunning}>
            <BiPlay className="mr-1 size-4" />
            {isRunning ? 'Running...' : 'Run Now'}
          </Button>
          <Button variant="secondary" size="sm" onClick={syncGmailHistory} disabled={syncing}>
            <BiMailSend className="mr-1 size-4" />
            {syncing ? 'Syncing...' : 'Sync Gmail'}
          </Button>
        </Topbar>
        <div className="h-[calc(100vh-4.5rem)] overflow-auto">
          <div className="container px-6 py-8 md:px-8 md:py-10 lg:py-12">

            {error && (
              <div className="mb-4 rounded border border-system-error-red/20 bg-system-error-red-light p-3 text-sm text-system-error-red">
                API Error: {error}
              </div>
            )}

            {/* Sync/Run Results */}
            {(syncResult || runResult) && (
              <div className="mb-4 flex flex-wrap gap-3 text-sm">
                {syncResult && (
                  <span className={syncResult.error ? 'text-system-error-red' : 'text-system-success-green'}>
                    {syncResult.error ? `Error: ${syncResult.error}` : `Synced ${syncResult.synced} leads`}
                  </span>
                )}
                {runResult && (
                  <span className={runResult.error ? 'text-system-error-red' : 'text-system-success-green'}>
                    {runResult.error ? `Error: ${runResult.error}` : runResult.message}
                  </span>
                )}
              </div>
            )}

            {/* System Status Bar */}
            {finderStatus && (
              <section className="mb-8">
                <div className="flex flex-wrap items-center gap-4 rounded-[15px] border border-border-primary bg-white p-4 text-sm shadow-xxs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-system-success-green" />
                    <span>Server: {finderStatus.serverTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block size-2 rounded-full ${finderStatus.lastRun ? 'bg-system-success-green' : 'bg-brand-primary'}`} />
                    <span>Last Run: {finderStatus.lastRun ? fmtDateISO(finderStatus.lastRun) : 'Never'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-brand-primary" />
                    <span>Next: {finderStatus.nextCron}</span>
                  </div>
                  {isRunning && (
                    <div className="flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full bg-system-error-red pulse-dot" />
                      <span className="font-semibold text-system-error-red">Running...</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Stat Cards (Stat3 pattern — with progress bar) */}
            <section className="mb-8">
              <div className="grid auto-cols-fr grid-cols-1 gap-4 md:grid-flow-col md:gap-6">
                <StatCardProgress
                  title="Total Leads"
                  value={`${totalLeads}`}
                  icon={<BiGroup className="size-4" />}
                  badge={`${goodTargets} targets`}
                  progress={100}
                />
                <StatCardProgress
                  title="Emails Sent"
                  value={`${totalEmailed}`}
                  icon={<BiEnvelope className="size-4" />}
                  badge={`${totalLeads ? Math.round((totalEmailed / totalLeads) * 100) : 0}%`}
                  progress={totalLeads ? (totalEmailed / totalLeads) * 100 : 0}
                />
                <StatCardProgress
                  title="Link Clicks"
                  value={`${totalClicked}`}
                  icon={<BiLinkAlt className="size-4" />}
                  badge={clickRate}
                  progress={totalEmailed ? (totalClicked / totalEmailed) * 100 : 0}
                />
                <StatCardProgress
                  title="Replies"
                  value={`${replied}`}
                  icon={<BiCheckCircle className="size-4" />}
                  badge={`${totalEmailed ? Math.round((replied / totalEmailed) * 100) : 0}%`}
                  progress={totalEmailed ? (replied / totalEmailed) * 100 : 0}
                />
              </div>
            </section>

            {/* Lead Table (Table1 pattern) */}
            <section className="mb-8">
              <div className="overflow-hidden rounded-[15px] border border-border-primary bg-white shadow-xxs">
                <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="mb-1 text-md font-semibold md:text-lg">Lead Tracking</h2>
                    <p className="text-sm text-text-secondary">{filteredLeads.length} leads</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['all', 'new', 'emailed', 'replied', 'proposal_sent'].map(f => (
                      <Button
                        key={f}
                        variant={filter === f ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setFilter(f)}
                      >
                        {f === 'all' ? 'All' : f === 'proposal_sent' ? 'Proposal Sent' : f.charAt(0).toUpperCase() + f.slice(1)}
                        <span className="ml-1 rounded-full bg-brand-primary/10 px-1.5 text-xs">{counts[f] || 0}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <Table className="border-collapse border-t border-border-primary">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[220px]">Business</TableHead>
                      <TableHead className="w-[100px]">Industry</TableHead>
                      <TableHead className="w-[180px]">Email</TableHead>
                      <TableHead className="w-[70px] text-center">Priority</TableHead>
                      <TableHead className="w-[80px]">LINE</TableHead>
                      <TableHead className="w-[90px]">Status</TableHead>
                      <TableHead className="w-[130px]">Sent At</TableHead>
                      <TableHead className="w-[60px] text-center">Clicked</TableHead>
                      <TableHead className="w-[60px] text-center">Clicks</TableHead>
                      <TableHead className="w-[70px] text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-sm text-neutral">
                          No leads found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLeads.map((lead, i) => {
                        const emailLead = emailStats?.leads?.find(l =>
                          (l.domain && lead.domain && l.domain === lead.domain) ||
                          (lead.email && l.name && l.name.includes(lead.businessName?.substring(0, 10)))
                        );
                        const domain = lead.domain && lead.domain.length < 40 ? lead.domain : null;
                        const canDgp = lead.email && lead.status !== 'proposal_sent';
                        return (
                          <TableRow key={lead.place_id || lead.email || i}>
                            <TableCell>
                              <div className="font-medium">{lead.businessName || lead.businessNameEn || '-'}</div>
                              {domain && <div className="text-xs text-brand-primary">{domain}</div>}
                            </TableCell>
                            <TableCell className="text-sm text-text-secondary">{lead.industry || '-'}</TableCell>
                            <TableCell className="max-w-[180px] truncate text-sm text-text-secondary">{lead.email || '-'}</TableCell>
                            <TableCell className="text-center">
                              {lead.priorityScore > 0 ? (
                                <Badge
                                  variant={lead.priorityScore >= 60 ? 'default' : 'secondary'}
                                  title={`Web: ${lead.websiteScore || 0}/10`}
                                >
                                  {lead.priorityScore}
                                </Badge>
                              ) : (lead.websiteScore > 0 ? (
                                <Badge variant="secondary">{lead.websiteScore}</Badge>
                              ) : '-')}
                            </TableCell>
                            <TableCell>
                              {lead.lineId ? (
                                <span className="text-xs font-medium text-system-success-green">{lead.lineId}</span>
                              ) : <span className="text-text-secondary">-</span>}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={lead.status} />
                            </TableCell>
                            <TableCell className="text-sm">{fmtDateISO(lead.dgpSentAt || lead.emailSentAt || emailLead?.sentAt)}</TableCell>
                            <TableCell className="text-center">
                              {(lead.emailClicked || emailLead?.clicked) ? (
                                <BiCheckCircle className="mx-auto size-4 text-system-success-green" />
                              ) : <span className="text-text-secondary">-</span>}
                            </TableCell>
                            <TableCell className="text-center text-sm">{lead.emailClickCount || emailLead?.clickCount || 0}</TableCell>
                            <TableCell className="text-center">
                              {canDgp ? (
                                <Button variant="secondary" size="sm" onClick={() => handleDgpClick(lead)}>
                                  DGP
                                </Button>
                              ) : lead.status === 'proposal_sent' ? (
                                <span className="inline-block rounded-full bg-[#6e49f3]/10 px-2 py-0.5 text-xs font-medium text-[#6e49f3]">Sent</span>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* DGP Proposal Dialog */}
      <Dialog open={dgpModalOpen} onOpenChange={setDgpModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              DGP Proposal — {dgpLead?.businessName || dgpLead?.businessNameEn || '-'}
            </DialogTitle>
            <DialogDescription>
              {dgpLead?.industry || '-'} | {dgpLead?.email || '-'}
            </DialogDescription>
          </DialogHeader>

          {/* To + Subject Inputs */}
          <div className="grid grid-cols-1 gap-3 px-1 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">To</label>
              <Input
                type="email"
                value={dgpEmail}
                onChange={(e) => setDgpEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <Input
                value={dgpSubject}
                onChange={(e) => setDgpSubject(e.target.value)}
                placeholder={dgpGenerating ? 'AI generating...' : 'Email subject'}
                disabled={dgpGenerating}
              />
            </div>
          </div>

          {/* Tabs: Preview / Edit */}
          <Tabs value={dgpTab} onValueChange={setDgpTab} className="mt-2">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="max-h-[50vh] overflow-auto rounded border border-border-primary bg-white p-4">
              {dgpGenerating ? (
                <div className="flex items-center justify-center py-20 text-sm text-text-secondary">
                  <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                  AI generating proposal...
                </div>
              ) : dgpPreview ? (
                <div dangerouslySetInnerHTML={{ __html: dgpPreview }} />
              ) : (
                <p className="py-10 text-center text-sm text-text-secondary">No preview available</p>
              )}
            </TabsContent>
            <TabsContent value="edit" className="max-h-[50vh] space-y-3 overflow-auto">
              {dgpEditParts ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">Opening</label>
                    <Textarea
                      rows={3}
                      value={dgpEditParts.opening || ''}
                      onChange={(e) => setDgpEditParts({ ...dgpEditParts, opening: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">Problem & ROI</label>
                    <Textarea
                      rows={3}
                      value={dgpEditParts.problemROI || ''}
                      onChange={(e) => setDgpEditParts({ ...dgpEditParts, problemROI: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">Landing Page Description</label>
                    <Textarea
                      rows={3}
                      value={dgpEditParts.landingPageDesc || ''}
                      onChange={(e) => setDgpEditParts({ ...dgpEditParts, landingPageDesc: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">SEO Autopilot Description</label>
                    <Textarea
                      rows={3}
                      value={dgpEditParts.seoAutopilotDesc || ''}
                      onChange={(e) => setDgpEditParts({ ...dgpEditParts, seoAutopilotDesc: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">Recommendation</label>
                    <Textarea
                      rows={2}
                      value={dgpEditParts.recommendation || ''}
                      onChange={(e) => setDgpEditParts({ ...dgpEditParts, recommendation: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-sm text-text-secondary">
                  {dgpGenerating ? 'Generating...' : 'No editable parts available'}
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <DialogFooter className="flex items-center justify-between gap-3">
            <div className="flex-1 text-sm">
              {dgpError && <span className="text-system-error-red">{dgpError}</span>}
              {dgpSuccess && <span className="text-system-success-green">{dgpSuccess}</span>}
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="secondary" size="sm">Close</Button>
              </DialogClose>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDgpSend}
                disabled={dgpGenerating || dgpSending || !dgpSubject || !dgpEmail || dgpSuccess}
              >
                <BiMailSend className="mr-1 size-4" />
                {dgpSending ? 'Sending...' : 'Send Proposal'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppSidebar>
  );
}

// ============ STATUS BADGE ============
function StatusBadge({ status }) {
  const styles = {
    new: 'bg-system-success-green-light text-system-success-green',
    emailed: 'bg-brand-primary/10 text-brand-primary',
    followed_up: 'bg-brand-primary/10 text-brand-primary',
    replied: 'bg-system-error-red-light text-system-error-red',
    proposal_sent: 'bg-[#6e49f3]/10 text-[#6e49f3]',
    closed: 'bg-brand-primary/10 text-brand-primary',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-background-secondary text-text-secondary'}`}>
      {status === 'proposal_sent' ? 'Proposal Sent' : status || 'unknown'}
    </span>
  );
}
