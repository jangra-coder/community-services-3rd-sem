import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app, captureEmails, createEvent, createOrganizer, inDays, registerAttendee } from './helpers.js';

const CODE = /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/;

describe('attendee registration', () => {
  it('registers an attendee, returns a QR ticket and emails it', async () => {
    const outbox = captureEmails();
    const { token } = await createOrganizer();
    const event = await createEvent(token, { capacity: 100 });

    const res = await registerAttendee(event.id, { name: 'Asha Rao', email: 'Asha@Example.com', phone: '+91 98765 43210' });
    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@example.com',
      status: 'registered',
      event: { id: event.id, title: 'Blood Donation Camp' },
    });
    expect(res.body.ticket.ticketCode).toMatch(CODE);
    expect(res.body.ticket.ticketUrl).toBe(`http://localhost:5173/ticket/${res.body.ticket.ticketCode}`);
    expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    await vi.waitFor(() => expect(outbox).toHaveLength(1));
    const mail = outbox[0];
    expect(mail.to).toContain('asha@example.com');
    expect(mail.subject).toBe('Your ticket for Blood Donation Camp');
    expect(mail.text).toContain(res.body.ticket.ticketCode);
    expect(mail.html).toContain(res.body.ticket.ticketUrl);
    expect(mail.attachments[0]).toMatchObject({ cid: 'ticket-qr', filename: `ticket-${res.body.ticket.ticketCode}.png` });

    const detail = await request(app).get(`/api/events/${event.id}`);
    expect(detail.body.event).toMatchObject({ registrationCount: 1, spotsLeft: 99 });
  });

  it('validates the registration form', async () => {
    const { token } = await createOrganizer();
    const event = await createEvent(token);
    const res = await registerAttendee(event.id, { name: 'X', email: 'bad', phone: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.path).sort()).toEqual(['email', 'name', 'phone']);
  });

  it('prevents the same email registering twice for one event', async () => {
    const { token } = await createOrganizer();
    const event = await createEvent(token);
    expect((await registerAttendee(event.id, { email: 'twice@example.com' })).status).toBe(201);

    const dup = await registerAttendee(event.id, { email: 'TWICE@example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('ALREADY_REGISTERED');

    // ...but the same person can register for a different event
    const otherEvent = await createEvent(token, { title: 'Another Event' });
    expect((await registerAttendee(otherEvent.id, { email: 'twice@example.com' })).status).toBe(201);
  });

  it('refuses registrations once capacity is reached', async () => {
    const { token } = await createOrganizer();
    const event = await createEvent(token, { capacity: 2 });
    expect((await registerAttendee(event.id, { email: 'one@example.com' })).status).toBe(201);
    expect((await registerAttendee(event.id, { email: 'two@example.com' })).status).toBe(201);

    const full = await registerAttendee(event.id, { email: 'three@example.com' });
    expect(full.status).toBe(409);
    expect(full.body.code).toBe('EVENT_FULL');

    const detail = await request(app).get(`/api/events/${event.id}`);
    expect(detail.body.event).toMatchObject({ spotsLeft: 0, canRegister: false });
  });

  it('never oversells the last seat under concurrent requests', async () => {
    const { token } = await createOrganizer();
    const event = await createEvent(token, { capacity: 1 });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => registerAttendee(event.id, { email: `race${i}@example.com` })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
  });

  it('refuses closed, ended, unpublished or unknown events', async () => {
    const { token } = await createOrganizer();

    const closed = await createEvent(token, { registrationOpen: false });
    const closedRes = await registerAttendee(closed.id);
    expect(closedRes.status).toBe(409);
    expect(closedRes.body.code).toBe('REGISTRATION_CLOSED');

    const ended = await createEvent(token, { startsAt: inDays(-2), endsAt: inDays(-1) });
    const endedRes = await registerAttendee(ended.id);
    expect(endedRes.status).toBe(409);
    expect(endedRes.body.code).toBe('EVENT_ENDED');

    // No end time: the event counts as over six hours after it started (same rule the UI uses)
    const openEnded = await createEvent(token, { startsAt: inDays(0, -7), endsAt: null });
    const openEndedRes = await registerAttendee(openEnded.id);
    expect(openEndedRes.status).toBe(409);
    expect(openEndedRes.body.code).toBe('EVENT_ENDED');
    expect((await request(app).get(`/api/events/${openEnded.id}`)).body.event.hasEnded).toBe(true);

    const stillRunning = await createEvent(token, { startsAt: inDays(0, -5), endsAt: null });
    expect((await registerAttendee(stillRunning.id)).status).toBe(201);

    const draft = await createEvent(token, { isPublished: false });
    expect((await registerAttendee(draft.id)).status).toBe(404);

    expect((await registerAttendee('00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await registerAttendee('nope')).status).toBe(400);
  });
});

describe('ticket lookup', () => {
  it('returns the ticket with a masked email for any code format', async () => {
    const { token } = await createOrganizer();
    const event = await createEvent(token);
    const reg = await registerAttendee(event.id, { name: 'Bala Iyer', email: 'bala.iyer@example.com' });
    const code = reg.body.ticket.ticketCode;

    const res = await request(app).get(`/api/tickets/${code}`);
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ ticketCode: code, name: 'Bala Iyer', status: 'registered' });
    expect(res.body.ticket.email).toMatch(/^ba\*+@example\.com$/);
    expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // lower-case, without the dash, or as the full ticket URL
    expect((await request(app).get(`/api/tickets/${code.toLowerCase()}`)).status).toBe(200);
    expect((await request(app).get(`/api/tickets/${code.replace('-', '')}`)).status).toBe(200);
    expect((await request(app).get(`/api/tickets/${encodeURIComponent(`http://localhost:5173/ticket/${code}`)}`)).status).toBe(200);
  });

  it('returns 404 for unknown or malformed codes', async () => {
    expect((await request(app).get('/api/tickets/ABCDE-FGHJK')).status).toBe(404);
    expect((await request(app).get('/api/tickets/hello')).status).toBe(404);
  });
});

describe('resend ticket', () => {
  it('re-sends the email for a registered address and reveals nothing otherwise', async () => {
    const outbox = captureEmails();
    const { token } = await createOrganizer();
    const event = await createEvent(token);
    await registerAttendee(event.id, { email: 'resend@example.com' });
    await vi.waitFor(() => expect(outbox).toHaveLength(1));

    const known = await request(app).post(`/api/events/${event.id}/resend-ticket`).send({ email: 'RESEND@example.com' });
    expect(known.status).toBe(200);
    await vi.waitFor(() => expect(outbox).toHaveLength(2));

    const unknown = await request(app).post(`/api/events/${event.id}/resend-ticket`).send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    await new Promise((r) => setTimeout(r, 50));
    expect(outbox).toHaveLength(2);
  });
});
