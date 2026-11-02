import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTransport } from '../src/services/mailer.js';

export const app = createApp();

let counter = 0;

/** Create an organizer account and return `{ token, user }`. */
export async function createOrganizer(overrides = {}) {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      name: `Organizer ${counter}`,
      email: `organizer${counter}@example.com`,
      password: 'Password123',
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

export function inDays(days, hours = 0) {
  return new Date(Date.now() + days * 86400000 + hours * 3600000).toISOString();
}

/** Create an event (published by default) and return the event JSON. */
export async function createEvent(token, overrides = {}) {
  const res = await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Blood Donation Camp',
      description: 'Annual community drive',
      venue: 'College Auditorium',
      startsAt: inDays(2),
      endsAt: inDays(2, 6),
      capacity: null,
      isPublished: true,
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`create event failed: ${JSON.stringify(res.body)}`);
  return res.body.event;
}

/** Register an attendee for an event and return the full response. */
export function registerAttendee(eventId, body = {}) {
  return request(app)
    .post(`/api/events/${eventId}/register`)
    .send({ name: 'Asha Rao', email: 'asha@example.com', ...body });
}

/** Replace the mail transport with an in-memory stub and return the outbox. */
export function captureEmails() {
  const outbox = [];
  setTransport({
    async sendMail(message) {
      outbox.push(message);
      return { messageId: `test-${outbox.length}` };
    },
  });
  return outbox;
}
