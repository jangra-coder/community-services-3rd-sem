import { describe, expect, it } from 'vitest';
import { formatCodeInput, normalizeTicketCode } from './ticketCode.js';

describe('normalizeTicketCode', () => {
  it('accepts a canonical code', () => {
    expect(normalizeTicketCode('K7MQ2-9XHBT')).toBe('K7MQ2-9XHBT');
  });

  it('accepts lower-case, missing dash and surrounding whitespace', () => {
    expect(normalizeTicketCode('  k7mq29xhbt ')).toBe('K7MQ2-9XHBT');
  });

  it('extracts the code from the URL encoded in the QR image', () => {
    expect(normalizeTicketCode('https://eventpass.example.com/ticket/K7MQ2-9XHBT')).toBe('K7MQ2-9XHBT');
  });

  it('returns null for anything else', () => {
    expect(normalizeTicketCode('hello world')).toBeNull();
    expect(normalizeTicketCode('ABC')).toBeNull();
    expect(normalizeTicketCode('')).toBeNull();
    expect(normalizeTicketCode(undefined)).toBeNull();
    // 0, O, 1 and I are never part of a ticket code
    expect(normalizeTicketCode('K0MQ2-9XHBT')).toBeNull();
  });
});

describe('formatCodeInput', () => {
  it('upper-cases and inserts the dash after five characters', () => {
    expect(formatCodeInput('k7m')).toBe('K7M');
    expect(formatCodeInput('k7mq29')).toBe('K7MQ2-9');
    expect(formatCodeInput('k7mq2-9xhbt')).toBe('K7MQ2-9XHBT');
  });

  it('drops anything beyond ten characters', () => {
    expect(formatCodeInput('K7MQ29XHBTZZZ')).toBe('K7MQ2-9XHBT');
  });
});
