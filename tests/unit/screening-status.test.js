import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStudentScreeningStatus } from '../../src/lib/screeningStatus.js';

const completeRecord = {
  siNumber: 'ST-1',
  studentName: 'Test Student',
  className: '5',
  section: 'A',
  sex: 'Other',
  dateOfBirth: '2016-11-20',
  age: 10,
  heightCm: 130,
  weightKg: 30,
  bmi: 17.75,
  skeletalDeformity: 'No',
  skeletalObservation: null,
  skinThicknessMm: 0,
  midArmCircumferenceCm: 0,
  sessionId: 'session-1',
  districtId: 'district-1',
  talukId: 'taluk-1',
  schoolId: 'school-1',
  screeningDate: '2026-11-20',
};

test('all supported deformity answers and zero measurements follow the completion rule', () => {
  assert.equal(calculateStudentScreeningStatus(completeRecord), 'Complete');
  for (const skeletalDeformity of ['Yes', 'Suspected']) {
    assert.equal(
      calculateStudentScreeningStatus({
        ...completeRecord,
        skeletalDeformity,
        skeletalObservation: 'Observation recorded',
      }),
      'Complete',
    );
  }
});

test('unanswered or not-assessed deformity remains pending', () => {
  for (const skeletalDeformity of [null, 'Not assessed']) {
    assert.equal(
      calculateStudentScreeningStatus({ ...completeRecord, skeletalDeformity }),
      'Pending',
    );
  }
});

test('required observation and measurements keep a record pending until present', () => {
  assert.equal(
    calculateStudentScreeningStatus({ ...completeRecord, skeletalDeformity: 'Yes', skeletalObservation: '  ' }),
    'Pending',
  );
  assert.equal(calculateStudentScreeningStatus({ ...completeRecord, skinThicknessMm: null }), 'Pending');
  assert.equal(calculateStudentScreeningStatus({ ...completeRecord, midArmCircumferenceCm: null }), 'Pending');
  assert.equal(calculateStudentScreeningStatus({ ...completeRecord, skinThicknessMm: Number.NaN }), 'Pending');
});

test('missing or invalid mandatory demographics keep a record pending', () => {
  assert.equal(calculateStudentScreeningStatus({ ...completeRecord, studentName: null }), 'Pending');
  assert.equal(calculateStudentScreeningStatus({ ...completeRecord, age: 11 }), 'Pending');
  assert.equal(calculateStudentScreeningStatus({ ...completeRecord, dateOfBirth: '2027-01-01' }), 'Pending');
  assert.equal(calculateStudentScreeningStatus({ ...completeRecord, heightCm: null }), 'Pending');
});

test('removing a required value from a complete record returns it to pending', () => {
  const updated = { ...completeRecord, skeletalDeformity: 'No', skinThicknessMm: null };
  assert.equal(calculateStudentScreeningStatus(updated), 'Pending');
});
