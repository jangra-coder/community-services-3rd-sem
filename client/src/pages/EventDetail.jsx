import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { formatEventWhen } from '../lib/format.js';
import AvailabilityBadge from '../components/AvailabilityBadge.jsx';
import { CalendarIcon, MapPinIcon, UsersIcon } from '../components/Icons.jsx';
import { Alert, Button, Card, Field, Input, PageHeader, PageLoader } from '../components/ui.jsx';

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setEvent(null);
    api.events
      .get(id)
      .then((data) => {
        if (!cancelled) setEvent(data.event);
      })
      .catch((err) => {
        if (!cancelled) setError(err.status === 404 ? 'This event does not exist or is not published yet.' : err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg">
        <Alert tone="error" title="Event not found">
          {error}
        </Alert>
        <Button to="/" variant="secondary" className="mt-4">
          Back to events
        </Button>
      </div>
    );
  }
  if (!event) return <PageLoader label="Loading event…" />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ to: '/', label: 'All events' }}
        title={event.title}
        subtitle={
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-slate-400" />
              {formatEventWhen(event.startsAt, event.endsAt)}
            </span>
            {event.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-slate-400" />
                {event.venue}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="h-4 w-4 text-slate-400" />
              {event.registrationCount} registered
              {event.capacity ? ` of ${event.capacity}` : ''}
            </span>
            <AvailabilityBadge event={event} />
          </div>
        }
      />

      {event.description && (
        <Card className="mb-6 whitespace-pre-line text-sm leading-relaxed text-slate-700">{event.description}</Card>
      )}

      <section aria-labelledby="register-heading">
        <h2 id="register-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Register for this event
        </h2>
        {event.canRegister ? (
          <RegistrationForm event={event} />
        ) : (
          <Alert tone="warning" title="Registration is not available">
            {event.hasEnded
              ? 'This event has already taken place.'
              : !event.registrationOpen
                ? 'The organizer has closed registration for this event.'
                : 'All seats have been taken.'}
          </Alert>
        )}
      </section>
      <p className="mt-6 text-sm text-slate-500">
        Organised by <span className="font-medium text-slate-700">{event.organizerName}</span>
      </p>
    </div>
  );
}

function RegistrationForm({ event }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResent(false);
    try {
      const data = await api.events.register(event.id, form);
      navigate(`/ticket/${data.ticket.ticketCode}`, { state: { ...data, justRegistered: true } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION') {
        setFieldErrors(err.fieldErrors);
      } else {
        setError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    try {
      await api.events.resendTicket(event.id, form.email);
      setResent(true);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
      <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
        <Input id="name" name="name" autoComplete="name" required value={form.name} onChange={update('name')} invalid={Boolean(fieldErrors.name)} placeholder="Asha Rao" />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldErrors.email} hint="Your QR ticket will be emailed here.">
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={update('email')} invalid={Boolean(fieldErrors.email)} placeholder="you@example.com" />
      </Field>
      <Field label="Phone" htmlFor="phone" optional error={fieldErrors.phone}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} invalid={Boolean(fieldErrors.phone)} placeholder="+91 98765 43210" />
      </Field>

      {error && (
        <Alert tone={error.code === 'ALREADY_REGISTERED' ? 'warning' : 'error'} title={error.code === 'ALREADY_REGISTERED' ? 'Already registered' : 'Registration failed'}>
          <p>{error.message}</p>
          {error.code === 'ALREADY_REGISTERED' && (
            <div className="mt-2">
              {resent ? (
                <span className="font-medium">Ticket sent – please check your inbox.</span>
              ) : (
                <button type="button" onClick={resend} className="font-semibold underline underline-offset-2">
                  Resend my ticket
                </button>
              )}
            </div>
          )}
        </Alert>
      )}

      <Button type="submit" size="lg" block loading={submitting}>
        {submitting ? 'Registering…' : 'Register & get my QR ticket'}
      </Button>
      <p className="text-center text-xs text-slate-500">Free registration · One ticket per email address</p>
    </form>
  );
}
