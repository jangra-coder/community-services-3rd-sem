import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { EVENT_FROM, EVENT_SELECT, findEvent, loadOwnedEvent, presentEvent } from '../services/events.js';
import { toCsv } from '../utils/csv.js';
import { badRequest, notFound } from '../utils/errors.js';

export const eventsRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const eventFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().max(5000).default(''),
  venue: z.string().trim().max(200).default(''),
  startsAt: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid start date and time' }) }),
  endsAt: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid end date and time' }) }).nullable().optional(),
  capacity: z.coerce.number().int().positive('Capacity must be a positive number').nullable().optional(),
  isPublished: z.boolean().optional(),
  registrationOpen: z.boolean().optional(),
};

const refineDates = (data, ctx) => {
  if (data.endsAt && data.startsAt && data.endsAt < data.startsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End must be after the start' });
  }
};

const createSchema = z.object(eventFields).superRefine(refineDates);
const updateSchema = z.object(eventFields).partial().superRefine(refineDates);

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['registered', 'checked_in', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function presentRegistration(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    ticketCode: row.ticket_code,
    status: row.status,
    checkedInAt: row.checked_in_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Public listing
// ---------------------------------------------------------------------------
eventsRouter.get('/', async (_req, res) => {
  const { rows } = await query(
    `SELECT ${EVENT_SELECT} ${EVENT_FROM} WHERE e.is_published = true ORDER BY e.starts_at ASC`,
  );
  res.json({ events: rows.map((row) => presentEvent(row)) });
});

// ---------------------------------------------------------------------------
// Organizer: my events (must be declared before `/:id`)
// ---------------------------------------------------------------------------
eventsRouter.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT ${EVENT_SELECT} ${EVENT_FROM} WHERE e.organizer_id = $1 ORDER BY e.starts_at DESC`,
    [req.user.id],
  );
  res.json({ events: rows.map((row) => presentEvent(row, { forOrganizer: true })) });
});

eventsRouter.post('/', requireAuth, validate(createSchema), async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO events (organizer_id, title, description, venue, starts_at, ends_at, capacity, is_published, registration_open)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      req.user.id,
      b.title,
      b.description,
      b.venue,
      b.startsAt,
      b.endsAt ?? null,
      b.capacity ?? null,
      b.isPublished ?? false,
      b.registrationOpen ?? true,
    ],
  );
  const event = await findEvent(rows[0].id);
  res.status(201).json({ event: presentEvent(event, { forOrganizer: true }) });
});

// ---------------------------------------------------------------------------
// Single event (public if published, always visible to its organizer)
// ---------------------------------------------------------------------------
eventsRouter.get('/:id', optionalAuth, async (req, res) => {
  const event = await findEvent(req.params.id);
  const isOwner = req.user && (req.user.id === event?.organizer_id || req.user.role === 'admin');
  if (!event || (!event.is_published && !isOwner)) {
    throw notFound('Event not found', { code: 'EVENT_NOT_FOUND' });
  }
  res.json({ event: presentEvent(event, { forOrganizer: Boolean(isOwner) }) });
});

eventsRouter.patch('/:id', requireAuth, validate(updateSchema), async (req, res) => {
  const event = await loadOwnedEvent(req);
  const b = req.body;
  const columns = {
    title: b.title,
    description: b.description,
    venue: b.venue,
    starts_at: b.startsAt,
    ends_at: b.endsAt,
    capacity: b.capacity,
    is_published: b.isPublished,
    registration_open: b.registrationOpen,
  };
  const entries = Object.entries(columns).filter(([, value]) => value !== undefined);
  if (entries.length === 0) throw badRequest('Nothing to update', { code: 'EMPTY_UPDATE' });

  const startsAt = b.startsAt ?? event.starts_at;
  const endsAt = b.endsAt === undefined ? event.ends_at : b.endsAt;
  if (endsAt && new Date(endsAt) < new Date(startsAt)) {
    throw badRequest('End must be after the start', {
      code: 'VALIDATION',
      details: [{ path: 'endsAt', message: 'End must be after the start' }],
    });
  }

  const sets = entries.map(([col], i) => `${col} = $${i + 2}`);
  await query(`UPDATE events SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, [
    event.id,
    ...entries.map(([, value]) => value),
  ]);
  const updated = await findEvent(event.id);
  res.json({ event: presentEvent(updated, { forOrganizer: true }) });
});

eventsRouter.delete('/:id', requireAuth, async (req, res) => {
  const event = await loadOwnedEvent(req);
  await query('DELETE FROM events WHERE id = $1', [event.id]);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Organizer: live statistics for the dashboard
// ---------------------------------------------------------------------------
eventsRouter.get('/:id/stats', requireAuth, async (req, res) => {
  const event = await loadOwnedEvent(req);

  const [totals, timeline, byDay, recent] = await Promise.all([
    query(
      `SELECT
         count(*) FILTER (WHERE status <> 'cancelled')::int AS total,
         count(*) FILTER (WHERE status = 'checked_in')::int  AS checked_in,
         count(*) FILTER (WHERE status = 'registered')::int  AS pending,
         count(*) FILTER (WHERE status = 'cancelled')::int   AS cancelled
       FROM registrations WHERE event_id = $1`,
      [event.id],
    ),
    query(
      `SELECT to_timestamp(floor(extract(epoch FROM checked_in_at) / 900) * 900) AS bucket, count(*)::int AS count
       FROM registrations WHERE event_id = $1 AND status = 'checked_in'
       GROUP BY 1 ORDER BY 1`,
      [event.id],
    ),
    query(
      `SELECT date_trunc('day', created_at) AS day, count(*)::int AS count
       FROM registrations WHERE event_id = $1 AND status <> 'cancelled'
       GROUP BY 1 ORDER BY 1`,
      [event.id],
    ),
    query(
      `SELECT r.id, r.name, r.email, r.ticket_code, r.checked_in_at, u.name AS checked_in_by
       FROM registrations r LEFT JOIN users u ON u.id = r.checked_in_by
       WHERE r.event_id = $1 AND r.status = 'checked_in'
       ORDER BY r.checked_in_at DESC LIMIT 10`,
      [event.id],
    ),
  ]);

  const t = totals.rows[0];
  res.json({
    event: presentEvent(event, { forOrganizer: true }),
    totals: {
      registrations: t.total,
      checkedIn: t.checked_in,
      pending: t.pending,
      cancelled: t.cancelled,
      capacity: event.capacity,
      attendanceRate: t.total ? Math.round((t.checked_in / t.total) * 100) : 0,
    },
    checkInsTimeline: timeline.rows.map((r) => ({ bucket: r.bucket, count: r.count })),
    registrationsByDay: byDay.rows.map((r) => ({ day: r.day, count: r.count })),
    recentCheckIns: recent.rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      ticketCode: r.ticket_code,
      checkedInAt: r.checked_in_at,
      checkedInBy: r.checked_in_by,
    })),
    generatedAt: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Organizer: registrations list, export, cancel
// ---------------------------------------------------------------------------
function registrationFilters(eventId, q) {
  const where = ['event_id = $1'];
  const params = [eventId];
  if (q.status) {
    params.push(q.status);
    where.push(`status = $${params.length}`);
  }
  if (q.search) {
    params.push(`%${q.search}%`);
    const p = `$${params.length}`;
    where.push(`(name ILIKE ${p} OR email ILIKE ${p} OR ticket_code ILIKE ${p})`);
  }
  return { where: where.join(' AND '), params };
}

eventsRouter.get('/:id/registrations', requireAuth, validate(listQuerySchema, 'query'), async (req, res) => {
  const event = await loadOwnedEvent(req);
  const q = req.validatedQuery;
  const { where, params } = registrationFilters(event.id, q);

  const [list, count] = await Promise.all([
    query(
      `SELECT * FROM registrations WHERE ${where}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, q.offset],
    ),
    query(`SELECT count(*)::int AS total FROM registrations WHERE ${where}`, params),
  ]);

  res.json({
    registrations: list.rows.map(presentRegistration),
    total: count.rows[0].total,
    limit: q.limit,
    offset: q.offset,
  });
});

eventsRouter.get('/:id/registrations/export', requireAuth, async (req, res) => {
  const event = await loadOwnedEvent(req);
  const { rows } = await query(
    'SELECT * FROM registrations WHERE event_id = $1 ORDER BY created_at ASC',
    [event.id],
  );
  const csv = toCsv(
    [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'ticket_code', label: 'Ticket code' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Registered at' },
      { key: 'checked_in_at', label: 'Checked in at' },
    ],
    rows,
  );
  const filename = `${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-registrations.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

eventsRouter.delete('/:id/registrations/:registrationId', requireAuth, async (req, res) => {
  const event = await loadOwnedEvent(req);
  const { rows } = await query(
    `UPDATE registrations SET status = 'cancelled', checked_in_at = NULL, checked_in_by = NULL
     WHERE id = $1 AND event_id = $2 RETURNING *`,
    [req.params.registrationId, event.id],
  );
  if (!rows[0]) throw notFound('Registration not found', { code: 'REGISTRATION_NOT_FOUND' });
  res.json({ registration: presentRegistration(rows[0]) });
});
