# Project Proposal – EventPass

*Community Services project, 3rd semester*

## Problem description

Organizing events and campaigns often relies on fragmented, manual registration processes that create unnecessary bottlenecks. Attendees frequently face long queues and delays during check-in due to inefficient, paper-based, or desktop-bound digital systems. Additionally, event organizers struggle to track real-time attendance, manage participant data securely, and provide a seamless, accessible registration experience across mobile devices.

There is a critical need for a streamlined, mobile-responsive solution that simplifies user onboarding and automates on-site attendance tracking to prevent data loss and administrative overload.

## Objectives

1. Provide a seamless, highly responsive mobile registration experience for event and campaign attendees.
2. Eliminate long entry queues and drastically reduce wait times during event check-ins.
3. Automate and digitize attendance tracking using fast, secure QR code generation and scanning.
4. Equip organizers with a centralized, real-time dashboard for monitoring total registrations and live footfall.
5. Reduce administrative overhead, minimize manual data entry errors, and eliminate paper waste.
6. Ensure the secure collection, storage, and management of participant data.

## Proposed solution

A centralized, mobile-first web platform for end-to-end event and campaign management:

- Attendees sign up for events through a responsive, mobile-friendly registration form.
- On submission the system generates a unique QR code ticket and emails it to the attendee.
- On the day of the event, organizers scan tickets with the built-in mobile browser scanner (or a dedicated hardware scanner). Each scan verifies the ticket, prevents duplicate entries and updates the live attendance database.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React.js, HTML, CSS, JavaScript, Tailwind CSS (mobile-first UI) |
| Backend | Node.js with Express.js |
| Database | PostgreSQL |
| Key integrations | `qrcode` (ticket generation), `html5-qrcode` (in-browser scanning), `nodemailer` (ticket delivery) |

## How the implementation meets each objective

| Objective | Implementation |
| --- | --- |
| Mobile registration | Single-column, large-tap-target registration form; 16 px inputs (no iOS zoom); works as a home-screen web app (`manifest.webmanifest`). |
| No queues | Tickets are verified in a single database update (~ms); the scanner de-duplicates repeated scans and gives colour + sound + vibration feedback so staff never look away from the queue. |
| QR automation | `qrcode` renders a PNG for the ticket page and the email; `html5-qrcode` reads it with the phone camera; manual / USB-scanner entry is a fallback. Ticket codes have 50 bits of entropy and are never sequential. |
| Real-time dashboard | Organizer dashboard polls `/api/events/:id/stats` every 5 s: registrations, checked-in, pending, attendance %, arrivals per 15 min, recent check-ins. |
| Less admin work | Registrations export to CSV; duplicate emails are rejected automatically; capacity is enforced in a database transaction; organizers can cancel / undo from the dashboard. |
| Secure data | Passwords hashed with bcrypt; JWT-protected organizer routes; every query parameterised (no SQL injection); rate limiting on public endpoints; helmet security headers + CSP; attendee emails masked on the public ticket page; CSV export guards against spreadsheet formula injection. |
