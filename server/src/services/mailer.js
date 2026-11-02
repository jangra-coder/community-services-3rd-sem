import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { ticketQrPng, ticketUrl } from './tickets.js';

let transport;

function getTransport() {
  if (transport) return transport;
  if (config.smtp.host) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  } else {
    // No SMTP configured: render the message to JSON and log it instead.
    transport = nodemailer.createTransport({ jsonTransport: true });
  }
  return transport;
}

/** Replace the transport (used by tests to capture outgoing mail). */
export function setTransport(custom) {
  transport = custom;
}

function formatDate(date) {
  return new Date(date).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Email the attendee their QR ticket. Never throws – a failed email must not
 * fail the registration itself; the ticket is always visible on the web too.
 */
export async function sendTicketEmail({ registration, event }) {
  const url = ticketUrl(registration.ticket_code);
  const subject = `Your ticket for ${event.title}`;
  const safe = {
    name: escapeHtml(registration.name),
    title: escapeHtml(event.title),
    venue: escapeHtml(event.venue),
    code: escapeHtml(registration.ticket_code),
    app: escapeHtml(config.appName),
  };

  const text = [
    `Hi ${registration.name},`,
    '',
    `You are registered for ${event.title}.`,
    `When: ${formatDate(event.starts_at)}`,
    event.venue ? `Where: ${event.venue}` : null,
    '',
    `Your ticket code: ${registration.ticket_code}`,
    `Show the attached QR code (or open ${url}) at the entrance.`,
    '',
    `— ${config.appName}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
      <h1 style="font-size:22px;margin:0 0 8px">You're registered! 🎉</h1>
      <p style="margin:0 0 20px;color:#444">Hi ${safe.name}, here is your ticket for <strong>${safe.title}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px;margin-bottom:20px">
        <tr><td style="padding:6px 0;color:#666;width:90px">When</td><td style="padding:6px 0">${escapeHtml(formatDate(event.starts_at))}</td></tr>
        ${event.venue ? `<tr><td style="padding:6px 0;color:#666">Where</td><td style="padding:6px 0">${safe.venue}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#666">Ticket</td><td style="padding:6px 0;font-family:ui-monospace,monospace;font-size:18px;letter-spacing:1px">${safe.code}</td></tr>
      </table>
      <div style="text-align:center;padding:16px;border:1px solid #e5e7eb;border-radius:12px">
        <img src="cid:ticket-qr" alt="QR ticket ${safe.code}" width="240" height="240" style="display:block;margin:0 auto 8px" />
        <p style="margin:0;color:#666;font-size:13px">Show this QR code at the entrance</p>
      </div>
      <p style="margin:20px 0 0;font-size:14px"><a href="${url}" style="color:#4f46e5">Open your ticket online</a> if the image does not load.</p>
      <p style="margin:24px 0 0;color:#999;font-size:12px">Sent by ${safe.app}</p>
    </div>`;

  try {
    const png = await ticketQrPng(registration.ticket_code);
    const info = await getTransport().sendMail({
      from: config.smtp.from,
      to: `"${registration.name.replace(/"/g, '')}" <${registration.email}>`,
      subject,
      text,
      html,
      attachments: [{ filename: `ticket-${registration.ticket_code}.png`, content: png, cid: 'ticket-qr' }],
    });
    if (!config.smtp.host && !config.isTest) {
      console.log(`[mail] SMTP not configured – ticket email for ${registration.email} logged instead. Ticket: ${url}`);
    }
    return info;
  } catch (err) {
    console.error(`[mail] Failed to send ticket to ${registration.email}: ${err.message}`);
    return null;
  }
}
