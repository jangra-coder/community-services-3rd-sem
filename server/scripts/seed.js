/**
 * Seed the database with a demo organizer, two events and some registrations
 * so the dashboard has something to show.
 *
 *   npm run db:seed            (from the repository root)
 *
 * Demo login:  organizer@example.com / Password123
 */
import bcrypt from 'bcryptjs';
import { runMigrations } from '../src/db/migrate.js';
import { closePool, query } from '../src/db/pool.js';
import { generateTicketCode } from '../src/services/tickets.js';

const DEMO_EMAIL = 'organizer@example.com';
const DEMO_PASSWORD = 'Password123';

const FIRST = ['Aarav', 'Diya', 'Ishaan', 'Kavya', 'Rohan', 'Sneha', 'Arjun', 'Meera', 'Vikram', 'Ananya',
  'Karan', 'Priya', 'Rahul', 'Nisha', 'Siddharth', 'Pooja', 'Aditya', 'Riya', 'Manish', 'Tanvi'];
const LAST = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Singh', 'Iyer', 'Nair', 'Gupta', 'Joshi', 'Mehta'];

function daysFromNow(days, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  await runMigrations();

  const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [DEMO_EMAIL]);
  if (existing.rows[0]) {
    console.log(`Demo data already exists (${DEMO_EMAIL}). Nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows: users } = await query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    ['Demo Organizer', DEMO_EMAIL, passwordHash],
  );
  const organizerId = users[0].id;

  const { rows: events } = await query(
    `INSERT INTO events (organizer_id, title, description, venue, starts_at, ends_at, capacity, is_published)
     VALUES
       ($1, 'Community Blood Donation Camp',
        'Join us for the annual blood donation drive organised with the district hospital. Every donor receives a certificate and refreshments. Please carry a valid ID.',
        'College Auditorium, Block A', $2, $3, 150, true),
       ($1, 'Digital Literacy Workshop for Senior Citizens',
        'A hands-on session teaching smartphone basics, UPI payments and staying safe online. Volunteers will assist every participant one-on-one.',
        'Computer Lab 2', $4, $5, 40, true),
       ($1, 'Tree Plantation Drive (draft)',
        'Planning in progress – details to be announced.',
        'Riverside Park', $6, NULL, NULL, false)
     RETURNING id, title`,
    [organizerId, daysFromNow(3, 9), daysFromNow(3, 16), daysFromNow(10, 11), daysFromNow(10, 14), daysFromNow(30, 8)],
  );

  const [camp, workshop] = events;
  let n = 0;
  for (let i = 0; i < 48; i += 1) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[Math.floor(i / FIRST.length + i) % LAST.length];
    const checkedIn = i < 21;
    await query(
      `INSERT INTO registrations (event_id, name, email, phone, ticket_code, status, checked_in_at, checked_in_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - ($9 || ' hours')::interval)`,
      [
        camp.id,
        `${first} ${last}`,
        `${first}.${last}${i}@example.com`.toLowerCase(),
        `+91 98${String(10000000 + i * 7919).slice(0, 8)}`,
        generateTicketCode(),
        checkedIn ? 'checked_in' : 'registered',
        checkedIn ? new Date(Date.now() - (21 - i) * 4 * 60 * 1000) : null,
        checkedIn ? organizerId : null,
        String(72 - i),
      ],
    );
    n += 1;
  }
  for (let i = 0; i < 12; i += 1) {
    const first = FIRST[(i * 3) % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    await query(
      `INSERT INTO registrations (event_id, name, email, ticket_code, created_at)
       VALUES ($1, $2, $3, $4, now() - ($5 || ' hours')::interval)`,
      [workshop.id, `${first} ${last}`, `${first}.${last}.w${i}@example.com`.toLowerCase(), generateTicketCode(), String(30 - i * 2)],
    );
    n += 1;
  }

  console.log(`Seeded ${events.length} events and ${n} registrations.`);
  console.log(`Organizer login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
