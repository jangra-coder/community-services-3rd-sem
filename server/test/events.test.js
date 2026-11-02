import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createEvent, createOrganizer, inDays, registerAttendee } from './helpers.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('events', () => {
  it('requires login to create an event', async () => {
    const res = await request(app).post('/api/events').send({ title: 'Nope', startsAt: inDays(1) });
    expect(res.status).toBe(401);
  });

  it('creates an event with sensible defaults', async () => {
    const { token } = await createOrganizer();
    const res = await request(app)
      .post('/api/events')
      .set(auth(token))
      .send({ title: 'Tree Plantation Drive', startsAt: inDays(5) });

    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      title: 'Tree Plantation Drive',
      description: '',
      venue: '',
      capacity: null,
      isPublished: false,
      registrationOpen: true,
      registrationCount: 0,
      checkedInCount: 0,
      spotsLeft: null,
      canRegister: false,
    });
  });

  it('validates event fields', async () => {
    const { token } = await createOrganizer();
    const res = await request(app)
      .post('/api/events')
      .set(auth(token))
      .send({ title: 'ab', startsAt: 'not a date', endsAt: inDays(1), capacity: -3 });
    expect(res.status).toBe(400);
    const paths = res.body.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'startsAt', 'capacity']));

    const backwards = await request(app)
      .post('/api/events')
      .set(auth(token))
      .send({ title: 'Backwards', startsAt: inDays(3), endsAt: inDays(2) });
    expect(backwards.status).toBe(400);
    expect(backwards.body.details[0].path).toBe('endsAt');
  });

  it('lists only published events publicly, but shows drafts to their organizer', async () => {
    const { token } = await createOrganizer();
    const published = await createEvent(token, { title: 'Published Event' });
    const draft = await createEvent(token, { title: 'Draft Event', isPublished: false });

    const list = await request(app).get('/api/events');
    expect(list.status).toBe(200);
    expect(list.body.events.map((e) => e.title)).toEqual(['Published Event']);
    // public responses never leak organizer-only fields
    expect(list.body.events[0].organizerId).toBeUndefined();

    expect((await request(app).get(`/api/events/${draft.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/events/${published.id}`)).status).toBe(200);

    const asOwner = await request(app).get(`/api/events/${draft.id}`).set(auth(token));
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.event.checkedInCount).toBe(0);
  });

  it('returns 400 for a malformed event id and 404 for an unknown one', async () => {
    expect((await request(app).get('/api/events/not-a-uuid')).status).toBe(400);
    expect((await request(app).get('/api/events/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });

  it('lets only the owner update or delete an event', async () => {
    const owner = await createOrganizer();
    const other = await createOrganizer();
    const event = await createEvent(owner.token, { isPublished: false });

    const forbidden = await request(app)
      .patch(`/api/events/${event.id}`)
      .set(auth(other.token))
      .send({ isPublished: true });
    expect(forbidden.status).toBe(403);

    const updated = await request(app)
      .patch(`/api/events/${event.id}`)
      .set(auth(owner.token))
      .send({ isPublished: true, capacity: 25, venue: 'Hall B' });
    expect(updated.status).toBe(200);
    expect(updated.body.event).toMatchObject({ isPublished: true, capacity: 25, venue: 'Hall B', spotsLeft: 25 });

    const badDates = await request(app)
      .patch(`/api/events/${event.id}`)
      .set(auth(owner.token))
      .send({ endsAt: inDays(-10) });
    expect(badDates.status).toBe(400);

    expect((await request(app).delete(`/api/events/${event.id}`).set(auth(other.token))).status).toBe(403);
    expect((await request(app).delete(`/api/events/${event.id}`).set(auth(owner.token))).status).toBe(204);
    expect((await request(app).get(`/api/events/${event.id}`).set(auth(owner.token))).status).toBe(404);
  });

  it('lists the organizer’s own events with live counts', async () => {
    const { token } = await createOrganizer();
    const event = await createEvent(token, { capacity: 10 });
    await registerAttendee(event.id, { email: 'a@example.com' });
    await registerAttendee(event.id, { email: 'b@example.com' });

    const res = await request(app).get('/api/events/mine').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({ registrationCount: 2, checkedInCount: 0, spotsLeft: 8 });
  });

  it('lists, searches and exports registrations for the owner only', async () => {
    const owner = await createOrganizer();
    const other = await createOrganizer();
    const event = await createEvent(owner.token);
    await registerAttendee(event.id, { name: 'Asha Rao', email: 'asha@example.com' });
    await registerAttendee(event.id, { name: 'Bala Iyer', email: 'bala@example.com', phone: '+91 9876543210' });

    const list = await request(app).get(`/api/events/${event.id}/registrations`).set(auth(owner.token));
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);
    expect(list.body.registrations.map((r) => r.name).sort()).toEqual(['Asha Rao', 'Bala Iyer']);

    const search = await request(app)
      .get(`/api/events/${event.id}/registrations?search=bala`)
      .set(auth(owner.token));
    expect(search.body.total).toBe(1);
    expect(search.body.registrations[0].phone).toBe('+91 9876543210');

    const badQuery = await request(app)
      .get(`/api/events/${event.id}/registrations?status=bogus`)
      .set(auth(owner.token));
    expect(badQuery.status).toBe(400);

    const denied = await request(app).get(`/api/events/${event.id}/registrations`).set(auth(other.token));
    expect(denied.status).toBe(403);

    const csv = await request(app).get(`/api/events/${event.id}/registrations/export`).set(auth(owner.token));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toMatch(/blood-donation-camp-registrations\.csv/);
    const lines = csv.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Name,Email,Phone,Ticket code,Status,Registered at,Checked in at');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^Asha Rao,asha@example\.com,,[A-Z2-9]{5}-[A-Z2-9]{5},registered,/);
  });

  it('lets the owner cancel a registration, freeing the seat', async () => {
    const { token } = await createOrganizer();
    const event = await createEvent(token, { capacity: 1 });
    const first = await registerAttendee(event.id, { email: 'first@example.com' });
    expect(first.status).toBe(201);
    expect((await registerAttendee(event.id, { email: 'second@example.com' })).status).toBe(409);

    const list = await request(app).get(`/api/events/${event.id}/registrations`).set(auth(token));
    const cancel = await request(app)
      .delete(`/api/events/${event.id}/registrations/${list.body.registrations[0].id}`)
      .set(auth(token));
    expect(cancel.status).toBe(200);
    expect(cancel.body.registration.status).toBe('cancelled');

    expect((await registerAttendee(event.id, { email: 'second@example.com' })).status).toBe(201);
  });
});
