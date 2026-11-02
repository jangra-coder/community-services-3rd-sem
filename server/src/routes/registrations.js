import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { registrationLimiter } from '../middleware/rateLimit.js';
import { findEvent, presentEvent } from '../services/events.js';
import { sendTicketEmail } from '../services/mailer.js';
import { generateTicketCode, normalizeTicketCode, ticketQrDataUrl, ticketUrl } from '../services/tickets.js';
import { conflict, notFound } from '../utils/errors.js';

export const registrationsRouter = Router();
export const ticketsRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d][\d\s\-()]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
});

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
});

function maskEmail(email) {
  const [user, domain] = email.split('@');
  const visible = user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, user.length - 2))}@${domain}`;
}

export function presentTicket(registration, event, { full = false } = {}) {
  return {
    ticketCode: registration.ticket_code,
    ticketUrl: ticketUrl(registration.ticket_code),
    name: registration.name,
    email: full ? registration.email : maskEmail(registration.email),
    status: registration.status,
    checkedInAt: registration.checked_in_at,
    registeredAt: registration.created_at,
    event: presentEvent(event),
  };
}

// ---------------------------------------------------------------------------
// POST /api/events/:id/register  – public attendee registration
// ---------------------------------------------------------------------------
registrationsRouter.post('/:id/register', registrationLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, phone } = req.body;

  const registration = await withTransaction(async (client) => {
    // Lock the event row so two people cannot take the last seat at once.
    const { rows } = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [req.params.id]);
    const event = rows[0];
    if (!event || !event.is_published) throw notFound('Event not found', { code: 'EVENT_NOT_FOUND' });
    if (!event.registration_open) {
      throw conflict('Registration for this event is closed', { code: 'REGISTRATION_CLOSED' });
    }
    const ended = event.ends_at ? new Date(event.ends_at) < new Date() : false;
    if (ended) throw conflict('This event has already ended', { code: 'EVENT_ENDED' });

    // Count in a separate statement *after* the lock is held: it runs with a
    // fresh snapshot, so it sees seats taken by transactions that just committed.
    if (event.capacity !== null) {
      const taken = await client.query(
        `SELECT count(*)::int AS count FROM registrations WHERE event_id = $1 AND status <> 'cancelled'`,
        [event.id],
      );
      if (taken.rows[0].count >= event.capacity) {
        throw conflict('Sorry, this event is full', { code: 'EVENT_FULL' });
      }
    }

    const existing = await client.query(
      'SELECT 1 FROM registrations WHERE event_id = $1 AND lower(email) = $2',
      [event.id, email],
    );
    if (existing.rowCount > 0) {
      throw conflict('This email is already registered for this event. Use "Resend my ticket" to get it again.', {
        code: 'ALREADY_REGISTERED',
      });
    }

    // Retry on the (astronomically unlikely) ticket-code collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await client.query('SAVEPOINT ticket');
      try {
        const inserted = await client.query(
          `INSERT INTO registrations (event_id, name, email, phone, ticket_code)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [event.id, name, email, phone || null, generateTicketCode()],
        );
        return inserted.rows[0];
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT ticket');
        if (err.code !== '23505' || err.constraint !== 'registrations_ticket_code_key') throw err;
      }
    }
    throw new Error('Could not allocate a unique ticket code');
  });

  const event = await findEvent(registration.event_id);
  // Email delivery runs in the background; the response never waits for SMTP.
  sendTicketEmail({ registration, event });

  res.status(201).json({
    ticket: presentTicket(registration, event, { full: true }),
    qrDataUrl: await ticketQrDataUrl(registration.ticket_code),
  });
});

// ---------------------------------------------------------------------------
// POST /api/events/:id/resend-ticket – email the ticket again
// Always answers 200 so the endpoint cannot be used to discover attendees.
// ---------------------------------------------------------------------------
registrationsRouter.post('/:id/resend-ticket', registrationLimiter, validate(resendSchema), async (req, res) => {
  const event = await findEvent(req.params.id);
  if (!event || !event.is_published) throw notFound('Event not found', { code: 'EVENT_NOT_FOUND' });

  const { rows } = await query(
    `SELECT * FROM registrations WHERE event_id = $1 AND lower(email) = $2 AND status <> 'cancelled'`,
    [event.id, req.body.email],
  );
  if (rows[0]) sendTicketEmail({ registration: rows[0], event });

  res.json({ message: 'If this email is registered, the ticket has been sent again.' });
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:code – public ticket page data (QR + status)
// ---------------------------------------------------------------------------
ticketsRouter.get('/:code', async (req, res) => {
  const code = normalizeTicketCode(req.params.code);
  const { rows } = code
    ? await query('SELECT * FROM registrations WHERE ticket_code = $1', [code])
    : { rows: [] };
  const registration = rows[0];
  if (!registration) throw notFound('Ticket not found', { code: 'TICKET_NOT_FOUND' });

  const event = await findEvent(registration.event_id);
  res.json({
    ticket: presentTicket(registration, event),
    qrDataUrl: await ticketQrDataUrl(registration.ticket_code),
  });
});
