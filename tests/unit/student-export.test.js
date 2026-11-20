import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeCsv } from '../../src/lib/csv.js';
import { createStudentExportRows } from '../../src/lib/studentExport.js';

const student = {
  id: 'student-row-id',
  sessionId: 'session-1',
  siNumber: 'ST-1',
  studentName: 'Test Student',
  className: '5',
  section: 'A',
  sex: 'Female',
  dateOfBirth: '2016-11-20',
  age: 10,
  heightCm: 130,
  weightKg: 30,
  bmi: 17.75,
  skeletalDeformity: 'Not assessed',
  skeletalObservation: null,
  skinThicknessMm: null,
  midArmCircumferenceCm: 0,
  additionalRemarks: null,
  districtId: 'district-1',
  talukId: 'taluk-1',
  schoolId: 'school-1',
  districtName: 'District One',
  talukName: 'Taluk One',
  schoolName: 'School One',
  screeningDate: '2026-11-20',
  status: 'Pending',
};

test('CSV export includes the required labels, saved observations, and both status values', () => {
  const rows = createStudentExportRows([
    student,
    {
      ...student,
      siNumber: 'ST-2',
      skeletalDeformity: 'Yes',
      skeletalObservation: 'Observed',
      skinThicknessMm: 4.2,
      midArmCircumferenceCm: 18.5,
      additionalRemarks: 'Follow up',
      status: 'Complete',
    },
  ]);
  const csv = serializeCsv(rows);

  for (const heading of [
    'Student ID',
    'Student Name',
    'Gender',
    'Date of Birth',
    'Age at Screening',
    'School',
    'District',
    'Taluk',
    'Screening Date',
    'Screening Status',
    'Skeletal Deformity',
    'Skin Thickness (mm)',
    'Mid-Arm Circumference (cm)',
    'Additional Remarks',
  ]) {
    assert.ok(csv.includes(`"${heading}"`), `Missing CSV heading: ${heading}`);
  }

  assert.ok(csv.includes('"Not assessed"'));
  assert.ok(csv.includes('"Pending"'));
  assert.ok(csv.includes('"Complete"'));
  assert.ok(csv.includes('"4.2"'));
  assert.ok(csv.includes('"18.5"'));
  assert.ok(csv.includes('"Follow up"'));
});

test('missing measurement values export as blank instead of zero', () => {
  const [row] = createStudentExportRows([student]);
  assert.equal(row['Skin Thickness (mm)'], '');
  assert.equal(row['Mid-Arm Circumference (cm)'], 0);
  const csv = serializeCsv([row]);
  assert.match(csv, /"Skin Thickness \(mm\)","Mid-Arm Circumference \(cm\)"/);
  assert.match(csv, /,"","0",/);
});
