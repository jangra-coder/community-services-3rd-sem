import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loadOwnedEvent } from '../services/events.js';
import { normalizeTicketCode } from '../services/tickets.js';
import { notFound } from '../utils/errors.js';

export const checkinRouter = Router();

const checkinSchema = z.object({
  code: z.string().trim().min(1, 'Scan or type a ticket code').max(500),
});

function presentAttendee(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    ticketCode: row.ticket_code,
    status: row.status,
    checkedInAt: row.checked_in_at,
    registeredAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// POST /api/events/:id/checkin  – organizer scans a ticket
//   200 { result: 'checked_in' }      ticket accepted, attendance recorded
//   404 { result: 'invalid' }         no such ticket
//   409 { result: 'duplicate' }       ticket was already used
//   409 { result: 'wrong_event' }     ticket belongs to another event
//   409 { result: 'cancelled' }       registration was cancelled
// ---------------------------------------------------------------------------
checkinRouter.post('/:id/checkin', requireAuth, validate(checkinSchema), async (req, res) => {
  const event = await loadOwnedEvent(req);
  const code = normalizeTicketCode(req.body.code);
  if (!code) {
    return res.status(404).json({ result: 'invalid', message: 'That does not look like a valid ticket code.' });
  }

  // Atomic: only one request can move the ticket from registered → checked_in.
  const updated = await query(
    `UPDATE registrations
        SET status = 'checked_in', checked_in_at = now(), checked_in_by = $3
      WHERE event_id = $1 AND ticket_code = $2 AND status = 'registered'
      RETURNING *`,
    [event.id, code, req.user.id],
  );
  if (updated.rows[0]) {
    return res.json({
      result: 'checked_in',
      message: `Welcome, ${updated.rows[0].name}!`,
      attendee: presentAttendee(updated.rows[0]),
    });
  }

  // Work out why the ticket was not accepted.
  const { rows } = await query(
    `SELECT r.*, e.title AS event_title, e.organizer_id AS event_organizer_id
       FROM registrations r JOIN events e ON e.id = r.event_id
      WHERE r.ticket_code = $1`,
    [code],
  );
  const ticket = rows[0];
  if (!ticket) {
    return res.status(404).json({ result: 'invalid', message: 'Ticket not found. Please check the code.' });
  }
  if (ticket.event_id !== event.id) {
    // Only reveal who the ticket belongs to when the other event is also ours;
    // another organizer's attendee data must never leak through the scanner.
    const ours = ticket.event_organizer_id === req.user.id || req.user.role === 'admin';
    return res.status(409).json({
      result: 'wrong_event',
      message: ours
        ? `This ticket is for "${ticket.event_title}", not this event.`
        : 'This ticket belongs to a different event.',
      ...(ours ? { attendee: presentAttendee(ticket) } : {}),
    });
  }
  if (ticket.status === 'cancelled') {
    return res.status(409).json({
      result: 'cancelled',
      message: 'This registration was cancelled.',
      attendee: presentAttendee(ticket),
    });
  }
  return res.status(409).json({
    result: 'duplicate',
    message: `Already checked in at ${new Date(ticket.checked_in_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: config.timeZone,
    })}.`,
    attendee: presentAttendee(ticket),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/events/:id/checkin/:code – undo a check-in made by mistake
// ---------------------------------------------------------------------------
checkinRouter.delete('/:id/checkin/:code', requireAuth, async (req, res) => {
  const event = await loadOwnedEvent(req);
  const code = normalizeTicketCode(req.params.code);
  const { rows } = await query(
    `UPDATE registrations SET status = 'registered', checked_in_at = NULL, checked_in_by = NULL
      WHERE event_id = $1 AND ticket_code = $2 AND status = 'checked_in' RETURNING *`,
    [event.id, code],
  );
  if (!rows[0]) throw notFound('No checked-in ticket with that code', { code: 'TICKET_NOT_FOUND' });
  res.json({ result: 'undone', attendee: presentAttendee(rows[0]) });
});
