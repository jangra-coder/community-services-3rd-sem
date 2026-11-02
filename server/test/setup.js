import { afterAll, beforeEach } from 'vitest';
import { closePool, query } from '../src/db/pool.js';

beforeEach(async () => {
  await query('TRUNCATE TABLE registrations, events, users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await closePool();
});
