# EventPass – mobile event registration & QR check-in

EventPass is a mobile-first web platform for community events and campaigns. Attendees register from their phone in seconds and instantly receive a QR code ticket by email; on the day, organizers scan tickets with their phone camera (or any USB/Bluetooth scanner) and watch registrations and live footfall on a real-time dashboard.

Built for the *Community Services* course (3rd semester). See [`docs/PROPOSAL.md`](docs/PROPOSAL.md) for the problem statement and objectives and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design and API reference.

| Home | Ticket | Scanner | Dashboard |
| --- | --- | --- | --- |
| ![Home](docs/screenshots/home.png) | ![Ticket](docs/screenshots/ticket.png) | ![Scanner](docs/screenshots/scanner-success.png) | ![Dashboard](docs/screenshots/dashboard.png) |

## Features

**For attendees**
- Browse published events and register with name, email and (optional) phone – one ticket per email per event.
- QR ticket shown immediately and emailed with the QR image attached; "Resend my ticket" if the mail is lost.
- Ticket page works as a home-screen app and updates to "Checked in" automatically after scanning.

**For organizers**
- Create, publish, edit and delete events; optional capacity (enforced even under concurrent sign-ups) and a registration on/off switch.
- Scanner page: camera scanning via `html5-qrcode`, plus a text box for manual entry or keyboard-wedge hardware scanners. Colour-coded result (checked in / already used / wrong event / invalid) with beep and vibration.
- Live dashboard: registered, checked-in, pending, attendance %, arrivals per 15 minutes, recent check-ins – refreshed every 5 seconds.
- Searchable registration list with manual check-in, undo and cancel; one-click CSV export; copy-to-clipboard public link.

**Security**
- bcrypt password hashing, JWT sessions, parameterised SQL, helmet + CSP, rate limiting, masked emails on public pages, optional organizer sign-up code.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router 7, Tailwind CSS 4, Vite 7, `html5-qrcode` |
| Backend | Node.js 22, Express 5, `pg`, `qrcode`, `nodemailer`, `zod`, `jsonwebtoken`, `bcryptjs`, `helmet` |
| Database | PostgreSQL 16 (plain SQL migrations) |
| Tooling | npm workspaces, Vitest, Supertest, Testing Library, ESLint, Docker Compose, GitHub Actions |

## Project structure

```
.
├── client/                 React app (Vite)
│   └── src/
│       ├── components/     Layout, UI primitives, ticket card, event card…
│       ├── lib/            API client, auth context, formatting, ticket-code parser
│       └── pages/          Home, EventDetail, TicketPage, Login, Signup,
│                           OrganizerDashboard, EventForm, EventDashboard, Scanner
├── server/                 Express API
│   ├── scripts/seed.js     Demo data
│   ├── src/
│   │   ├── db/             pg pool, migration runner, migrations/*.sql
│   │   ├── middleware/     auth (JWT), validation (zod), rate limits, error handler
│   │   ├── routes/         auth, events, registrations & tickets, checkin
│   │   └── services/       ticket codes + QR, mailer, event helpers
│   └── test/               integration tests (Vitest + Supertest)
├── docs/                   proposal, architecture, screenshots
├── docker-compose.yml      PostgreSQL + Mailpit (+ optional app container)
└── Dockerfile              production image (API + built client)
```

## Getting started

### Prerequisites

- Node.js 20.12 or newer (22 recommended) and npm 10
- PostgreSQL 14+ — easiest via Docker: `docker compose up -d` starts PostgreSQL **and** [Mailpit](https://mailpit.axllent.org/), a fake SMTP server with a web inbox at <http://localhost:8025> so you can see the ticket emails.

### Run it

```bash
git clone <this repository>
cd community-services-3rd-sem
npm install                      # installs server + client (npm workspaces)

docker compose up -d             # PostgreSQL on :5432, Mailpit on :1025/:8025
cp server/.env.example server/.env   # defaults match docker-compose

npm run db:migrate               # create tables
npm run db:seed                  # demo organizer + events + registrations (optional)
npm run dev                      # API on :4000, web app on :5173
```

Open <http://localhost:5173>. Demo organizer login: **organizer@example.com** / **Password123**.

Without Docker: create a database, point `DATABASE_URL` in `server/.env` at it, and leave `SMTP_HOST` empty — ticket emails are then printed to the server console instead of being sent.

### Trying it on a phone

The dev server listens on your LAN (`vite --host`). Open `http://<your-computer-ip>:5173` on a phone in the same Wi-Fi. Browsers only allow camera access on HTTPS or `localhost`, so for camera scanning on a phone expose the app over HTTPS (for example `npx localtunnel --port 5173` or ngrok) or use the manual-entry box. Set `CLIENT_URL` in `server/.env` to the public URL so QR codes link to it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start API (`node --watch`) and Vite dev server together |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API; serves `client/dist` when `NODE_ENV=production` |
| `npm test` | Server integration tests, then client tests |
| `npm run lint` | ESLint for both packages |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Load demo data (safe to re-run) |

## Configuration

All settings are environment variables read by `server/src/config.js` (see [`server/.env.example`](server/.env.example)).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | – (required) | PostgreSQL connection string. Append `?sslmode=require` for hosted databases. |
| `JWT_SECRET` | dev-only value | Signs organizer tokens. **Must** be set to a long random string in production. |
| `CLIENT_URL` | `http://localhost:5173` | Public URL of the web app; used for CORS and the link inside QR codes. |
| `PORT` | `4000` | API port |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM` | Mailpit | Email delivery. Empty `SMTP_HOST` logs emails to the console. |
| `ORGANIZER_SIGNUP_CODE` | empty | When set, creating an organizer account requires this code. |
| `AUTO_MIGRATE` | `true` | Run migrations on start-up |
| `SERVE_CLIENT` | auto | Serve `client/dist` from Express (on by default in production) |
| `TRUST_PROXY` | `0` | Set to `1` behind a reverse proxy so rate limiting sees real IPs |
| `VITE_API_URL` (client) | empty | Only when the frontend is hosted on a different domain than the API |

## Testing

```bash
npm test                      # everything
npm run test -w server        # API tests – needs an empty PostgreSQL database
npm run test -w client        # component / unit tests (jsdom)
```

The server tests default to `postgres://eventpass:eventpass@localhost:5432/eventpass_test` (created automatically by `docker compose`). Override with `TEST_DATABASE_URL`. **The test database schema is dropped and recreated on every run – never point it at real data.**

## Deployment

Fastest route – Render's free tier with the included [Blueprint](render.yaml) (creates the web service and a PostgreSQL database; works once this file is on the default branch):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jangra-coder/community-services-3rd-sem)

Step-by-step instructions for Render, Railway and a self-hosted Docker server, plus free SMTP options, are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

The simplest production setup is one server process that serves both the API and the built client:

```bash
npm ci
npm run build
NODE_ENV=production JWT_SECRET=... DATABASE_URL=... CLIENT_URL=https://your-domain SMTP_HOST=... npm start
```

Or use the included `Dockerfile` (`docker build -t eventpass .`) / `JWT_SECRET=$(openssl rand -hex 48) docker compose --profile app up` — the app refuses to start in production with a missing, short or placeholder `JWT_SECRET`. Free-tier friendly combinations: Render or Railway for the app, Neon or Supabase for PostgreSQL, Brevo or a Gmail app-password for SMTP. Remember to set `TRUST_PROXY=1` behind a platform load balancer.

## Course information

| | |
| --- | --- |
| Course | Community Services (3rd semester) |
| Project | EventPass – Event registration & QR attendance platform |
| Team | *add names and roll numbers here* |
| Guide | *add faculty name here* |
