import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import EventCard from '../components/EventCard.jsx';
import { CalendarIcon } from '../components/Icons.jsx';
import { Alert, Button, EmptyState, PageLoader } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.events
      .list()
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

  const upcoming = events?.filter((e) => !e.hasEnded) ?? [];
  const past = events?.filter((e) => e.hasEnded) ?? [];

  return (
    <div>
      <section className="mb-8 rounded-3xl bg-linear-to-br from-indigo-600 to-violet-600 px-6 py-10 text-white shadow-lg sm:px-10 sm:py-14">
        <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
          Register in seconds. <br className="hidden sm:block" />
          Check in instantly.
        </h1>
        <p className="mt-3 max-w-lg text-indigo-100">
          Sign up for an event from your phone, get a QR ticket by email and skip the queue at the entrance.
        </p>
        {!user && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button to="/signup" variant="secondary">
              Organise an event
            </Button>
            <a href="#events" className="inline-flex h-11 items-center px-2 text-sm font-semibold text-white/90 hover:text-white">
              Browse events ↓
            </a>
          </div>
        )}
      </section>

      <section id="events" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="mb-4 text-xl font-bold text-slate-900">
          Upcoming events
        </h2>
        {error ? (
          <Alert tone="error" title="Could not load events">
            {error}
          </Alert>
        ) : events === null ? (
          <PageLoader label="Loading events…" />
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="No upcoming events yet"
            description="Check back soon, or create an account to publish your own event."
            action={!user && <Button to="/signup">Become an organizer</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10" aria-labelledby="past-heading">
          <h2 id="past-heading" className="mb-4 text-lg font-semibold text-slate-700">
            Past events
          </h2>
          <div className="grid gap-4 opacity-75 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
