function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  // Neutralise spreadsheet formulas (=SUM(), @cmd, +cmd|…, -cmd|…) while leaving
  // ordinary values such as phone numbers ("+91 …") and negative numbers intact.
  if (/^[=@\t\r]/.test(text) || /^[+-](?![\d\s(])/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Build a CSV document from column definitions and row objects. */
export function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','));
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}
