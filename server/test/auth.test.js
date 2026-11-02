import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createOrganizer } from './helpers.js';
import { config } from '../src/config.js';

describe('auth', () => {
  it('creates an organizer account and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Priya Organizer', email: 'Priya@Example.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Priya Organizer', email: 'priya@example.com', role: 'organizer' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate emails regardless of case', async () => {
    await createOrganizer({ email: 'dup@example.com' });
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Someone Else', email: 'DUP@example.com', password: 'Password123' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('validates sign-up input', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
    expect(res.body.details.map((d) => d.path).sort()).toEqual(['email', 'name', 'password']);
  });

  it('enforces the organizer sign-up code when configured', async () => {
    config.organizerSignupCode = 'CLUB-2026';
    try {
      const denied = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'No Code', email: 'nocode@example.com', password: 'Password123' });
      expect(denied.status).toBe(403);

      const allowed = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'With Code', email: 'code@example.com', password: 'Password123', signupCode: 'CLUB-2026' });
      expect(allowed.status).toBe(201);
    } finally {
      config.organizerSignupCode = '';
    }
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await createOrganizer({ email: 'login@example.com', password: 'Password123' });

    const ok = await request(app).post('/api/auth/login').send({ email: 'LOGIN@example.com', password: 'Password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));

    const bad = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong-pass' });
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('BAD_CREDENTIALS');

    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Password123' });
    expect(unknown.status).toBe(401);
  });

  it('returns the current user for a valid token and 401 otherwise', async () => {
    const { token, user } = await createOrganizer();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.id);

    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(401);

    const garbage = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(garbage.status).toBe(401);
  });
});
