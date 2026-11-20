const formulaPrefix = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/;

function escapeCsvCell(value) {
  let text = String(value ?? '');
  if (typeof value === 'string' && formulaPrefix.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeCsv(rows) {
  if (!rows.length) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  return [headers.map(escapeCsvCell).join(',')]
    .concat(rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')))
    .join('\n');
}
