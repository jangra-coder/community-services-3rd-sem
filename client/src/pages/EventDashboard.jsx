import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, downloadRegistrationsCsv } from '../lib/api.js';
import { formatDateTime, formatEventWhen, formatRelative, formatTime } from '../lib/format.js';
import { CheckIcon, DownloadIcon, EditIcon, LinkIcon, RefreshIcon, ScanIcon, SearchIcon, UsersIcon } from '../components/Icons.jsx';
import { cx } from '../lib/cx.js';
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, PageLoader, Select, Stat } from '../components/ui.jsx';

const POLL_MS = 5000;
const PAGE_SIZE = 25;

export default function EventDashboard() {
  const { id } = useParams();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.events.stats(id);
      setStats(data);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(err.status === 403 ? 'You can only view dashboards for your own events.' : err.message);
    }
  }, [id]);

  useEffect(() => {
    loadStats();
    const poll = setInterval(loadStats, POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [loadStats]);

  const copyLink = async () => {
    const url = `${window.location.origin}/events/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the public event link:', url);
    }
  };

  if (error && !stats) return <Alert tone="error">{error}</Alert>;
  if (!stats) return <PageLoader label="Loading dashboard…" />;

  const { event, totals } = stats;

  return (
    <div>
      <PageHeader
        back={{ to: '/organizer', label: 'My events' }}
        title={event.title}
        subtitle={
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span>{formatEventWhen(event.startsAt, event.endsAt)}</span>
            {event.venue && <span>· {event.venue}</span>}
            {event.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
            {!event.registrationOpen && <Badge tone="amber">Registration closed</Badge>}
          </div>
        }
        actions={
          <>
            <Button to={`/organizer/events/${id}/scan`}>
              <ScanIcon className="h-4 w-4" /> Scan tickets
            </Button>
            <Button variant="secondary" onClick={copyLink}>
              <LinkIcon className="h-4 w-4" /> {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <Button variant="secondary" to={`/organizer/events/${id}/edit`}>
              <EditIcon className="h-4 w-4" /> Edit
            </Button>
          </>
        }
      />

      {!event.isPublished && (
        <Alert tone="warning" className="mb-5">
          This event is a draft. Publish it from the edit page so attendees can register.
        </Alert>
      )}

      <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
        Live · updated {updatedAt ? formatRelative(updatedAt) : '…'}
        {error && <span className="text-red-600">· {error}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered" value={totals.registrations} hint={totals.capacity ? `of ${totals.capacity} seats` : 'unlimited seats'} />
        <Stat label="Checked in" value={totals.checkedIn} tone="green" hint="live footfall" />
        <Stat label="Yet to arrive" value={totals.pending} tone="amber" />
        <Stat label="Attendance" value={`${totals.attendanceRate}%`} tone="gray" hint={totals.cancelled ? `${totals.cancelled} cancelled` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="font-semibold text-slate-900">Check-ins over time</h2>
          <p className="text-xs text-slate-500">Arrivals per 15 minutes</p>
          <Timeline buckets={stats.checkInsTimeline} />
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-semibold text-slate-900">Recent check-ins</h2>
          {stats.recentCheckIns.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No one has been checked in yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {stats.recentCheckIns.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{r.name}</p>
                    <p className="truncate font-mono text-xs text-slate-400">{r.ticketCode}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{formatTime(r.checkedInAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <RegistrationsTable eventId={id} eventTitle={event.title} refreshKey={totals.registrations + totals.checkedIn * 1000} onChanged={loadStats} />
    </div>
  );
}

function Timeline({ buckets }) {
  if (buckets.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">The chart fills in as attendees are scanned at the entrance.</p>;
  }
  const max = Math.max(...buckets.map((b) => b.count));
  return (
    <div className="mt-4 flex h-44 gap-1 overflow-x-auto">
      {buckets.map((b) => (
        <div key={b.bucket} className="flex h-full min-w-8 flex-1 flex-col items-center" title={`${b.count} at ${formatTime(b.bucket)}`}>
          {/* flex-1 gives this box a definite height, so the bar's % height resolves */}
          <div className="flex w-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-semibold text-slate-600">{b.count}</span>
            <div className="w-full rounded-t-md bg-indigo-500" style={{ height: `${Math.max(4, (b.count / max) * 80)}%` }} />
          </div>
          <span className="mt-1 text-[10px] text-slate-400">{formatTime(b.bucket)}</span>
        </div>
      ))}
    </div>
  );
}

const statusBadge = {
  registered: <Badge tone="indigo">Registered</Badge>,
  checked_in: <Badge tone="green">Checked in</Badge>,
  cancelled: <Badge tone="red">Cancelled</Badge>,
};

function RegistrationsTable({ eventId, eventTitle, refreshKey, onChanged }) {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const debounce = useRef();

  const load = useCallback(
    async (offset = 0) => {
      try {
        const data = await api.events.registrations(eventId, { search, status, limit: PAGE_SIZE, offset });
        setRows((prev) => (offset === 0 ? data.registrations : [...(prev || []), ...data.registrations]));
        setTotal(data.total);
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    },
    [eventId, search, status],
  );

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(0), search ? 300 : 0);
    return () => clearTimeout(debounce.current);
  }, [load, refreshKey, search]);

  const act = async (row, action) => {
    setBusy(row.id);
    setError(null);
    try {
      if (action === 'checkin') await api.events.checkin(eventId, row.ticketCode);
      if (action === 'undo') await api.events.undoCheckin(eventId, row.ticketCode);
      if (action === 'cancel') {
        if (!window.confirm(`Cancel ${row.name}'s registration?`)) return;
        await api.events.cancelRegistration(eventId, row.id);
      }
      await Promise.all([load(0), onChanged()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadRegistrationsCsv(eventId, `${eventTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-registrations.csv`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="mt-8" aria-labelledby="registrations-heading">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="registrations-heading" className="text-lg font-semibold text-slate-900">
          Registrations <span className="text-sm font-normal text-slate-500">({total})</span>
        </h2>
        <Button variant="secondary" size="sm" onClick={exportCsv} loading={exporting}>
          <DownloadIcon className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search name, email or ticket code" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search registrations" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="registered">Registered</option>
          <option value="checked_in">Checked in</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      {rows === null ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No registrations found" description={search || status ? 'Try a different search or filter.' : 'Share the event link to start collecting registrations.'} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className={cx('flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between', busy === row.id && 'opacity-60')}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    {statusBadge[row.status]}
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {row.email}
                    {row.phone ? ` · ${row.phone}` : ''}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {row.ticketCode} · registered {formatDateTime(row.createdAt)}
                    {row.checkedInAt ? ` · checked in ${formatTime(row.checkedInAt)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {row.status === 'registered' && (
                    <Button size="sm" variant="success" onClick={() => act(row, 'checkin')} disabled={busy === row.id}>
                      <CheckIcon className="h-4 w-4" /> Check in
                    </Button>
                  )}
                  {row.status === 'checked_in' && (
                    <Button size="sm" variant="secondary" onClick={() => act(row, 'undo')} disabled={busy === row.id}>
                      <RefreshIcon className="h-4 w-4" /> Undo
                    </Button>
                  )}
                  {row.status !== 'cancelled' && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => act(row, 'cancel')} disabled={busy === row.id}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {rows.length < total && (
            <div className="border-t border-slate-100 p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => load(rows.length)}>
                Load more ({total - rows.length} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
