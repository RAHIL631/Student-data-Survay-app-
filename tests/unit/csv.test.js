import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeCsv } from '../../src/lib/csv.js';

test('neutralizes spreadsheet formula prefixes in string cells', () => {
  const rows = [
    { value: '=1+1' },
    { value: '+cmd' },
    { value: '-1+1' },
    { value: '@SUM(A1:A2)' },
    { value: '  =1+1' },
    { value: '\t=1+1' },
    { value: '\r\n+cmd' },
    { value: '\u0000@SUM(A1:A2)' },
    { value: '\u00a0-1+1' },
  ];

  assert.equal(
    serializeCsv(rows),
    '"value"\n"\'=1+1"\n"\'+cmd"\n"\'-1+1"\n"\'@SUM(A1:A2)"\n"\'  =1+1"\n"\'\t=1+1"\n"\'\r\n+cmd"\n"\'\u0000@SUM(A1:A2)"\n"\'\u00a0-1+1"',
  );
});

test('neutralizes a realistic HYPERLINK formula', () => {
  assert.equal(
    serializeCsv([{ value: '=HYPERLINK("https://example.com","Open")' }]),
    '"value"\n"\'=HYPERLINK(""https://example.com"",""Open"")"',
  );
});

test('neutralizes a formula preceded by a Unicode BOM', () => {
  assert.equal(
    serializeCsv([{ value: '\uFEFF=1+1' }]),
    '"value"\n"\'\uFEFF=1+1"',
  );
});

test('preserves ordinary text and numeric values', () => {
  assert.equal(
    serializeCsv([{ value: 'Student name', unicode: 'ಸಮೀಕ್ಷೆ', negativeNumber: -12 }]),
    '"value","unicode","negativeNumber"\n"Student name","ಸಮೀಕ್ಷೆ","-12"',
  );
});

test('escapes quotes and preserves commas and multiline content', () => {
  assert.equal(
    serializeCsv([{ value: 'O\'Neil, "Student"\nSecond line' }]),
    '"value"\n"O\'Neil, ""Student""\nSecond line"',
  );
});

test('preserves empty CSV behavior', () => {
  assert.equal(serializeCsv([]), '');
});
