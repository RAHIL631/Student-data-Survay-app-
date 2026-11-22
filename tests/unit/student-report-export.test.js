import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDENT_REPORT_HEADINGS,
  createStudentExcelWorkbook,
  createStudentPdfDocument,
  getStudentReportFilename,
} from '../../src/services/export/studentReport.js';

const student = {
  id: 'row-1', sessionId: 'session-1', siNumber: 'SI-001', studentName: 'Test Student',
  className: '5', section: 'A', sex: 'Female', dateOfBirth: '2016-11-20', age: 10,
  heightCm: 130, weightKg: 30, bmi: 17.75, skeletalDeformity: 'Not assessed',
  skeletalObservation: null, skinThicknessMm: null, midArmCircumferenceCm: 18.5,
  additionalRemarks: 'Routine check', districtId: 'district-1', talukId: 'taluk-1',
  schoolId: 'school-1', districtName: 'District One', talukName: 'Taluk One',
  schoolName: 'School One', screeningDate: '2026-11-20', status: 'Pending',
};

test('Excel workbook has report columns, readable formatting, observations, and safe formula text', async () => {
  const maliciousStudent = { ...student, studentName: '=HYPERLINK("https://example.invalid")' };
  const workbook = await createStudentExcelWorkbook([student, maliciousStudent]);
  const sheet = workbook.getWorksheet('Student Screenings');

  assert.ok(sheet);
  assert.equal(sheet.columnCount, STUDENT_REPORT_HEADINGS.length);
  assert.deepEqual(sheet.getRow(1).values.slice(1), [...STUDENT_REPORT_HEADINGS]);
  assert.equal(sheet.getCell('B2').value, 'Test Student');
  assert.equal(sheet.getCell('B2').type, 3); // ExcelJS string cell
  assert.equal(sheet.getCell('B3').value, '\'=HYPERLINK("https://example.invalid")');
  assert.equal(sheet.getCell('B3').type, 3);
  assert.equal(sheet.getCell('L2').value, 'Pending');
  assert.equal(sheet.getCell('M2').value, 130);
  assert.equal(sheet.getCell('R2').value, '');
  assert.equal(sheet.getCell('S2').value, 18.5);
  assert.equal(sheet.getRow(1).height, 32);
  assert.equal(sheet.getCell('A1').font.bold, true);
  assert.equal(sheet.views[0].ySplit, 1);
  assert.equal(sheet.autoFilter.to, `T${sheet.rowCount}`);
});

test('Excel output handles an empty report with headings and no student rows', async () => {
  const workbook = await createStudentExcelWorkbook([]);
  const sheet = workbook.getWorksheet('Student Screenings');
  assert.equal(sheet.rowCount, 1);
  assert.deepEqual(sheet.getRow(1).values.slice(1), [...STUDENT_REPORT_HEADINGS]);
  const summaryBytes = await workbook.xlsx.writeBuffer();
  assert.ok(summaryBytes.byteLength > 0);
});

test('PDF output includes readable table data and handles an empty dataset', async () => {
  const doc = await createStudentPdfDocument([student], new Date('2026-11-22T00:00:00.000Z'));
  assert.ok(doc.internal.pages.length >= 2);
  assert.equal(doc.lastAutoTable.settings.startY, 33);
  assert.equal(doc.lastAutoTable.body.length, 1);
  const pdf = doc.output();
  assert.ok(pdf.includes('Student Health Screening Report'));
  assert.ok(pdf.includes('Test Student'));
  assert.ok(pdf.includes('Pending'));

  const emptyDoc = await createStudentPdfDocument([], new Date('2026-11-22T00:00:00.000Z'));
  assert.ok(emptyDoc.internal.pages.length >= 2);
  assert.ok(emptyDoc.output().includes('0 student records'));
});

test('report filenames use a district-safe label and avoid student names', () => {
  assert.equal(getStudentReportFilename([student], 'pdf'), 'Student_Health_Screening_District_One_2026-11-20.pdf');
  assert.equal(getStudentReportFilename([], 'xlsx', new Date('2026-11-22T00:00:00.000Z')), 'Student_Health_Screening_All_2026-11-22.xlsx');
  assert.equal(getStudentReportFilename([{ ...student, districtName: 'D1' }, { ...student, districtName: 'D2' }], 'pdf', new Date('2026-11-22T00:00:00.000Z')), 'Student_Health_Screening_Multiple_Districts_2026-11-20.pdf');
});
