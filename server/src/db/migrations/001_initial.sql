-- ---------------------------------------------------------------------------
-- EventPass initial schema
-- ---------------------------------------------------------------------------

-- Organizer accounts -------------------------------------------------------
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  role          text        NOT NULL DEFAULT 'organizer'
                            CHECK (role IN ('organizer', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Emails are unique regardless of letter case
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Events / campaigns -------------------------------------------------------
CREATE TABLE events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  description       text        NOT NULL DEFAULT '',
  venue             text        NOT NULL DEFAULT '',
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz,
  capacity          integer     CHECK (capacity IS NULL OR capacity > 0),
  is_published      boolean     NOT NULL DEFAULT false,
  registration_open boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX events_organizer_idx ON events (organizer_id);
CREATE INDEX events_starts_at_idx ON events (starts_at);

-- Attendee registrations (one row = one ticket) ----------------------------
CREATE TABLE registrations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  email         text        NOT NULL,
  phone         text,
  ticket_code   text        NOT NULL,
  status        text        NOT NULL DEFAULT 'registered'
                            CHECK (status IN ('registered', 'checked_in', 'cancelled')),
  checked_in_at timestamptz,
  checked_in_by uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- The code printed in the QR ticket must be globally unique
CREATE UNIQUE INDEX registrations_ticket_code_key ON registrations (ticket_code);
-- One registration per email address per event
CREATE UNIQUE INDEX registrations_event_email_key ON registrations (event_id, lower(email));
CREATE INDEX registrations_event_status_idx ON registrations (event_id, status);
CREATE INDEX registrations_checked_in_at_idx ON registrations (event_id, checked_in_at);
