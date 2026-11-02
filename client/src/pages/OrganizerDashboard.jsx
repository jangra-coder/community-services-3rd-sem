import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatEventWhen } from '../lib/format.js';
import { CalendarIcon, EditIcon, PlusIcon, ScanIcon } from '../components/Icons.jsx';
import { Alert, Badge, Button, EmptyState, PageHeader, PageLoader } from '../components/ui.jsx';

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.events
      .mine()
      .then((data) => {
        if (!cancelled) setEvents(data.events);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="My events"
        subtitle={`Signed in as ${user.name}`}
        actions={
          <Button to="/organizer/events/new">
            <PlusIcon className="h-4 w-4" /> New event
          </Button>
        }
      />

      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : events === null ? (
        <PageLoader />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="You haven't created any events yet"
          description="Create your first event, publish it and share the link. Attendees get a QR ticket by email."
          action={
            <Button to="/organizer/events/new">
              <PlusIcon className="h-4 w-4" /> Create an event
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-200 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/organizer/events/${event.id}`} className="text-lg font-semibold text-slate-900 hover:text-indigo-700">
                      {event.title}
                    </Link>
                    {event.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
                    {event.hasEnded && <Badge tone="gray">Ended</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{formatEventWhen(event.startsAt, event.endsAt)}{event.venue ? ` · ${event.venue}` : ''}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold">{event.registrationCount}</span> registered
                    {event.capacity ? ` / ${event.capacity}` : ''} ·{' '}
                    <span className="font-semibold text-emerald-700">{event.checkedInCount}</span> checked in
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button to={`/organizer/events/${event.id}/scan`} variant="secondary" size="sm">
                    <ScanIcon className="h-4 w-4" /> Scan
                  </Button>
                  <Button to={`/organizer/events/${event.id}/edit`} variant="ghost" size="sm">
                    <EditIcon className="h-4 w-4" /> Edit
                  </Button>
                  <Button to={`/organizer/events/${event.id}`} size="sm">
                    Dashboard
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
