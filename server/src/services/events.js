import { query } from '../db/pool.js';
import { forbidden, notFound } from '../utils/errors.js';

/** Columns every event response includes, with live registration counts. */
export const EVENT_SELECT = `
  e.id, e.organizer_id, e.title, e.description, e.venue, e.starts_at, e.ends_at,
  e.capacity, e.is_published, e.registration_open, e.created_at, e.updated_at,
  u.name AS organizer_name,
  (SELECT count(*)::int FROM registrations r WHERE r.event_id = e.id AND r.status <> 'cancelled') AS registration_count,
  (SELECT count(*)::int FROM registrations r WHERE r.event_id = e.id AND r.status = 'checked_in') AS checked_in_count
`;

export const EVENT_FROM = 'FROM events e JOIN users u ON u.id = e.organizer_id';

/** Convert a DB row to the JSON shape returned by the API. */
export function presentEvent(row, { forOrganizer = false } = {}) {
  const spotsLeft = row.capacity === null ? null : Math.max(0, row.capacity - row.registration_count);
  const now = Date.now();
  const ends = row.ends_at ? new Date(row.ends_at).getTime() : null;
  const hasEnded = ends !== null ? ends < now : new Date(row.starts_at).getTime() + 6 * 3600 * 1000 < now;

  const event = {
    id: row.id,
    title: row.title,
    description: row.description,
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    registrationCount: row.registration_count,
    spotsLeft,
    isPublished: row.is_published,
    registrationOpen: row.registration_open,
    hasEnded,
    canRegister: row.is_published && row.registration_open && !hasEnded && (spotsLeft === null || spotsLeft > 0),
    organizerName: row.organizer_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (forOrganizer) {
    event.organizerId = row.organizer_id;
    event.checkedInCount = row.checked_in_count;
  }
  return event;
}

export async function findEvent(id) {
  const { rows } = await query(`SELECT ${EVENT_SELECT} ${EVENT_FROM} WHERE e.id = $1`, [id]);
  return rows[0] || null;
}

/** Load an event and make sure the current user organises it. */
export async function loadOwnedEvent(req) {
  const event = await findEvent(req.params.id);
  if (!event) throw notFound('Event not found', { code: 'EVENT_NOT_FOUND' });
  if (event.organizer_id !== req.user.id && req.user.role !== 'admin') {
    throw forbidden('You can only manage your own events', { code: 'NOT_OWNER' });
  }
  return event;
}
