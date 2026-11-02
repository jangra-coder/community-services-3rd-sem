import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createEvent, createOrganizer, registerAttendee } from './helpers.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function setup() {
  const owner = await createOrganizer();
  const event = await createEvent(owner.token);
  const reg = await registerAttendee(event.id, { name: 'Asha Rao', email: 'asha@example.com' });
  return { owner, event, code: reg.body.ticket.ticketCode };
}

const checkin = (event, token, code) =>
  request(app).post(`/api/events/${event.id}/checkin`).set(auth(token)).send({ code });

describe('check-in', () => {
  it('accepts a valid ticket once and flags it as duplicate afterwards', async () => {
    const { owner, event, code } = await setup();

    const first = await checkin(event, owner.token, code);
    expect(first.status).toBe(200);
    expect(first.body.result).toBe('checked_in');
    expect(first.body.attendee).toMatchObject({ name: 'Asha Rao', ticketCode: code, status: 'checked_in' });
    expect(first.body.attendee.checkedInAt).toBeTruthy();

    const second = await checkin(event, owner.token, code);
    expect(second.status).toBe(409);
    expect(second.body.result).toBe('duplicate');
    expect(second.body.message).toMatch(/Already checked in/);

    const ticket = await request(app).get(`/api/tickets/${code}`);
    expect(ticket.body.ticket.status).toBe('checked_in');
  });

  it('accepts the code as scanned from the QR (full URL), lower-case or without the dash', async () => {
    const { owner, event, code } = await setup();
    const url = `http://localhost:5173/ticket/${code}`;
    const res = await checkin(event, owner.token, url);
    expect(res.status).toBe(200);

    const other = await registerAttendee(event.id, { email: 'other@example.com' });
    const loose = other.body.ticket.ticketCode.toLowerCase().replace('-', '');
    expect((await checkin(event, owner.token, ` ${loose} `)).status).toBe(200);
  });

  it('records exactly one check-in when the same ticket is scanned concurrently', async () => {
    const { owner, event, code } = await setup();
    const results = await Promise.all(Array.from({ length: 4 }, () => checkin(event, owner.token, code)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
  });

  it('rejects unknown codes, tickets for other events and cancelled registrations', async () => {
    const { owner, event, code } = await setup();

    const invalid = await checkin(event, owner.token, 'ZZZZZ-ZZZZZ');
    expect(invalid.status).toBe(404);
    expect(invalid.body.result).toBe('invalid');

    const garbage = await checkin(event, owner.token, 'hello world');
    expect(garbage.status).toBe(404);
    expect(garbage.body.result).toBe('invalid');

    const otherEvent = await createEvent(owner.token, { title: 'Workshop' });
    const wrong = await checkin(otherEvent, owner.token, code);
    expect(wrong.status).toBe(409);
    expect(wrong.body.result).toBe('wrong_event');
    expect(wrong.body.message).toContain('Blood Donation Camp');

    const list = await request(app).get(`/api/events/${event.id}/registrations`).set(auth(owner.token));
    await request(app)
      .delete(`/api/events/${event.id}/registrations/${list.body.registrations[0].id}`)
      .set(auth(owner.token));
    const cancelled = await checkin(event, owner.token, code);
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.result).toBe('cancelled');
  });

  it('only lets the event organizer check people in', async () => {
    const { event, code } = await setup();
    const stranger = await createOrganizer();
    expect((await checkin(event, stranger.token, code)).status).toBe(403);
    expect((await request(app).post(`/api/events/${event.id}/checkin`).send({ code })).status).toBe(401);
  });

  it('can undo a check-in', async () => {
    const { owner, event, code } = await setup();
    await checkin(event, owner.token, code);

    const undo = await request(app).delete(`/api/events/${event.id}/checkin/${code}`).set(auth(owner.token));
    expect(undo.status).toBe(200);
    expect(undo.body.attendee.status).toBe('registered');

    const again = await request(app).delete(`/api/events/${event.id}/checkin/${code}`).set(auth(owner.token));
    expect(again.status).toBe(404);

    expect((await checkin(event, owner.token, code)).status).toBe(200);
  });

  it('feeds the live dashboard statistics', async () => {
    const { owner, event, code } = await setup();
    await registerAttendee(event.id, { name: 'Bala Iyer', email: 'bala@example.com' });
    await registerAttendee(event.id, { name: 'Chitra Nair', email: 'chitra@example.com' });
    await checkin(event, owner.token, code);

    const res = await request(app).get(`/api/events/${event.id}/stats`).set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      registrations: 3,
      checkedIn: 1,
      pending: 2,
      cancelled: 0,
      capacity: null,
      attendanceRate: 33,
    });
    expect(res.body.checkInsTimeline).toHaveLength(1);
    expect(res.body.checkInsTimeline[0].count).toBe(1);
    expect(res.body.registrationsByDay).toHaveLength(1);
    expect(res.body.registrationsByDay[0].count).toBe(3);
    expect(res.body.recentCheckIns).toHaveLength(1);
    expect(res.body.recentCheckIns[0]).toMatchObject({ name: 'Asha Rao', ticketCode: code, checkedInBy: owner.user.name });
    expect(res.body.event.checkedInCount).toBe(1);

    const stranger = await createOrganizer();
    expect((await request(app).get(`/api/events/${event.id}/stats`).set(auth(stranger.token))).status).toBe(403);
  });
});
