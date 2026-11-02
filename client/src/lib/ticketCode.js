const CODE_PATTERN = /([A-HJ-NP-Z2-9]{5})-?([A-HJ-NP-Z2-9]{5})/;

/**
 * Extract a canonical `XXXXX-XXXXX` ticket code from scanner output or typed
 * text. Mirrors the server-side normaliser so the UI can de-duplicate scans
 * before they hit the network.
 */
export function normalizeTicketCode(input) {
  if (typeof input !== 'string') return null;
  const match = input.trim().toUpperCase().match(CODE_PATTERN);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Format partially typed input as the user types: uppercase + dash after 5 chars. */
export function formatCodeInput(value) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
}
