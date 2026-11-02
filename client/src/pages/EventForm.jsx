import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { fromDatetimeLocal, toDatetimeLocal } from '../lib/format.js';
import { TrashIcon } from '../components/Icons.jsx';
import { Alert, Button, Field, Input, PageHeader, PageLoader, Textarea, Toggle } from '../components/ui.jsx';

const empty = {
  title: '',
  description: '',
  venue: '',
  startsAt: '',
  endsAt: '',
  capacity: '',
  isPublished: false,
  registrationOpen: true,
};

export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(isEdit ? null : empty);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    api.events
      .get(id)
      .then(({ event }) => {
        if (cancelled) return;
        setForm({
          title: event.title,
          description: event.description,
          venue: event.venue,
          startsAt: toDatetimeLocal(event.startsAt),
          endsAt: toDatetimeLocal(event.endsAt),
          capacity: event.capacity ?? '',
          isPublished: event.isPublished,
          registrationOpen: event.registrationOpen,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  if (error && !form) return <Alert tone="error">{error}</Alert>;
  if (!form) return <PageLoader />;

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };
  const update = (key) => (e) => set(key, e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title,
      description: form.description,
      venue: form.venue,
      startsAt: fromDatetimeLocal(form.startsAt) ?? form.startsAt,
      endsAt: form.endsAt ? fromDatetimeLocal(form.endsAt) : null,
      capacity: form.capacity === '' ? null : Number(form.capacity),
      isPublished: form.isPublished,
      registrationOpen: form.registrationOpen,
    };
    try {
      const { event } = isEdit ? await api.events.update(id, payload) : await api.events.create(payload);
      navigate(`/organizer/events/${event.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION') setFieldErrors(err.fieldErrors);
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event and all of its registrations? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.events.remove(id);
      navigate('/organizer', { replace: true });
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={isEdit ? { to: `/organizer/events/${id}`, label: 'Event dashboard' } : { to: '/organizer', label: 'My events' }}
        title={isEdit ? 'Edit event' : 'Create an event'}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Field label="Event title" htmlFor="title" error={fieldErrors.title}>
          <Input id="title" required value={form.title} onChange={update('title')} invalid={Boolean(fieldErrors.title)} placeholder="Community Blood Donation Camp" />
        </Field>
        <Field label="Description" htmlFor="description" optional error={fieldErrors.description}>
          <Textarea id="description" value={form.description} onChange={update('description')} placeholder="What should attendees know? Agenda, what to bring, who to contact…" />
        </Field>
        <Field label="Venue" htmlFor="venue" optional error={fieldErrors.venue}>
          <Input id="venue" value={form.venue} onChange={update('venue')} placeholder="College Auditorium, Block A" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Starts" htmlFor="startsAt" error={fieldErrors.startsAt}>
            <Input id="startsAt" type="datetime-local" required value={form.startsAt} onChange={update('startsAt')} invalid={Boolean(fieldErrors.startsAt)} />
          </Field>
          <Field label="Ends" htmlFor="endsAt" optional error={fieldErrors.endsAt}>
            <Input id="endsAt" type="datetime-local" value={form.endsAt} onChange={update('endsAt')} invalid={Boolean(fieldErrors.endsAt)} />
          </Field>
        </div>
        <Field label="Capacity" htmlFor="capacity" optional error={fieldErrors.capacity} hint="Leave empty for unlimited seats.">
          <Input id="capacity" type="number" inputMode="numeric" min={1} value={form.capacity} onChange={update('capacity')} invalid={Boolean(fieldErrors.capacity)} placeholder="e.g. 150" />
        </Field>

        <div className="space-y-3">
          <Toggle
            label="Published"
            description="Published events appear on the home page and accept registrations."
            checked={form.isPublished}
            onChange={(v) => set('isPublished', v)}
          />
          <Toggle
            label="Registration open"
            description="Turn off to stop new registrations while keeping the event visible."
            checked={form.registrationOpen}
            onChange={(v) => set('registrationOpen', v)}
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {isEdit ? (
            <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={handleDelete} loading={deleting}>
              <TrashIcon className="h-4 w-4" /> Delete event
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" loading={saving}>
            {isEdit ? 'Save changes' : 'Create event'}
          </Button>
        </div>
      </form>
    </div>
  );
}
