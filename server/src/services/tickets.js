import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { config } from '../config.js';

// 32 unambiguous characters: no 0/O, 1/I so codes are easy to read out or type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /([A-HJ-NP-Z2-9]{5})-?([A-HJ-NP-Z2-9]{5})/;

/** Generate a random ticket code such as `K7MQ2-9XHBT` (50 bits of entropy). */
export function generateTicketCode() {
  let raw = '';
  for (let i = 0; i < 10; i += 1) {
    raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/**
 * Turn whatever a scanner or a human produced into a canonical ticket code.
 * Accepts the bare code, a code without the dash, lower-case input, or a full
 * ticket URL (which is what the QR image encodes). Returns null if nothing
 * code-shaped is found.
 */
export function normalizeTicketCode(input) {
  if (typeof input !== 'string') return null;
  const match = input.trim().toUpperCase().match(CODE_PATTERN);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

/** Public page for a ticket – this is the text encoded in the QR image. */
export function ticketUrl(code) {
  return `${config.clientUrl}/ticket/${code}`;
}

const qrOptions = { errorCorrectionLevel: 'M', margin: 2, width: 512 };

/** QR image as a `data:image/png;base64,...` string for use in <img src>. */
export function ticketQrDataUrl(code) {
  return QRCode.toDataURL(ticketUrl(code), qrOptions);
}

/** QR image as a PNG buffer for email attachments. */
export function ticketQrPng(code) {
  return QRCode.toBuffer(ticketUrl(code), { ...qrOptions, type: 'png' });
}
