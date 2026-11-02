import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/utils/csv.js';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
];

function line(row) {
  return toCsv(columns, [row]).replace(/^\uFEFF/, '').trim().split('\r\n')[1];
}

function cells(row) {
  return line(row).split(',');
}

describe('toCsv', () => {
  it('writes a header row, CRLF line endings and a BOM for Excel', () => {
    const csv = toCsv(columns, [{ name: 'Asha', phone: null }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFName,Phone\r\nAsha,\r\n');
  });

  it('quotes cells containing commas, quotes or newlines', () => {
    expect(line({ name: 'Rao, Asha', phone: '' })).toBe('"Rao, Asha",');
    expect(line({ name: 'Asha "AJ" Rao', phone: '' })).toBe('"Asha ""AJ"" Rao",');
  });

  it('leaves phone numbers and negative numbers intact', () => {
    expect(cells({ name: 'x', phone: '+91 98765 43210' })[1]).toBe('+91 98765 43210');
    expect(cells({ name: 'x', phone: '+1 (555) 010-9999' })[1]).toBe('+1 (555) 010-9999');
    expect(cells({ name: '-5', phone: '' })[0]).toBe('-5');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(cells({ name: '=SUM(A1:A9)', phone: '' })[0]).toBe("'=SUM(A1:A9)");
    expect(cells({ name: '@cmd', phone: '' })[0]).toBe("'@cmd");
    expect(cells({ name: "+cmd|'/c calc'!A0", phone: '' })[0]).toBe("'+cmd|'/c calc'!A0");
    expect(cells({ name: '-cmd|x', phone: '' })[0]).toBe("'-cmd|x");
  });
});
