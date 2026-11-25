import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Karnataka district migration seeds the current canonical 31 districts once', async () => {
  const migration = await readFile(
    new URL('../../supabase/migrations/20261207000000_karnataka_districts.sql', import.meta.url),
    'utf8',
  );
  const districtValues = migration.match(/FROM \(VALUES([\s\S]*?)\) AS district\(name, code\)/)?.[1];
  assert.ok(districtValues, 'district seed values should be present');

  const districts = [...districtValues.matchAll(/\('([^']+)', '([^']+)'\)/g)];
  assert.equal(districts.length, 31);
  assert.equal(new Set(districts.map(([, name]) => name)).size, 31, 'district names should be unique');
  assert.equal(new Set(districts.map(([, , code]) => code)).size, 31, 'district codes should be unique');
  assert.ok(districts.some(([, name]) => name === 'Bengaluru South'));
  assert.ok(districts.some(([, name]) => name === 'Vijayanagara'));
  assert.ok(!districts.some(([, name]) => name === 'Ramanagara'));
  assert.match(migration, /row_number\(\) OVER \([\s\S]*PARTITION BY candidates\.organization_id, candidates\.canonical_code/);
});
