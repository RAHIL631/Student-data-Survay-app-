export const STUDENT_REPORT_HEADINGS = [
  'SI NO',
  'STUDENT NAME',
  'SCHOOL',
  'DISTRICT',
  'TALUK',
  'CLASS',
  'SECTION',
  'SEX',
  'DATE OF BIRTH',
  'AGE AT SCREENING',
  'SCREENING DATE',
  'SCREENING STATUS',
  'HEIGHT (CM)',
  'WEIGHT (KG)',
  'BMI',
  'SKELETAL DEFORMITY',
  'SKELETAL OBSERVATION',
  'SKIN THICKNESS (MM)',
  'MID-ARM CIRCUMFERENCE (CM)',
  'ADDITIONAL REMARKS',
];

const formulaPrefix = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/;

function safeSpreadsheetText(value) {
  const text = String(value ?? '');
  return formulaPrefix.test(text) ? `'${text}` : text;
}

function safeFilenamePart(value) {
  return String(value ?? '').trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'All';
}

function rowsFor(students) {
  return students.map((student) => [
    student.siNumber,
    student.studentName,
    student.schoolName,
    student.districtName,
    student.talukName,
    student.className,
    student.section,
    student.sex,
    student.dateOfBirth,
    student.age,
    student.screeningDate,
    student.status,
    student.heightCm,
    student.weightKg,
    student.bmi,
    student.skeletalDeformity,
    student.skeletalObservation,
    student.skinThicknessMm,
    student.midArmCircumferenceCm,
    student.additionalRemarks,
  ]);
}

export function getStudentReportFilename(students, extension, now = new Date()) {
  const districts = new Set(students.map((student) => student.districtName).filter(Boolean));
  const district = districts.size === 1 ? [...districts][0] : districts.size === 0 ? 'All' : 'Multiple_Districts';
  const dates = new Set(students.map((student) => student.screeningDate).filter(Boolean));
  const date = dates.size === 1 ? [...dates][0] : now.toISOString().slice(0, 10);
  return `Student_Health_Screening_${safeFilenamePart(district)}_${date}.${extension}`;
}

export async function createStudentExcelWorkbook(students) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Student Health Hub';

  const worksheet = workbook.addWorksheet('Student Screenings', { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.addRow([...STUDENT_REPORT_HEADINGS]);
  rowsFor(students).forEach((values) => {
    worksheet.addRow(values.map((value) => (typeof value === 'string' ? safeSpreadsheetText(value) : value ?? '')));
  });
  worksheet.autoFilter = { from: 'A1', to: `T${Math.max(students.length + 1, 1)}` };
  worksheet.columns = STUDENT_REPORT_HEADINGS.map((heading) => ({
    header: heading,
    width: Math.max(14, Math.min(heading.length + 4, 30)),
  }));
  worksheet.getRow(1).height = 32;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD7DEE5' } },
        left: { style: 'thin', color: { argb: 'FFD7DEE5' } },
        bottom: { style: 'thin', color: { argb: 'FFD7DEE5' } },
        right: { style: 'thin', color: { argb: 'FFD7DEE5' } },
      };
      if (rowNumber > 1) cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });

  return workbook;
}

export async function createStudentPdfDocument(students, generatedAt = new Date()) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const districtNames = new Set(students.map((student) => student.districtName).filter(Boolean));
  const subtitle = districtNames.size === 1 ? [...districtNames][0] : 'Authorized student screening records';

  doc.setFontSize(15);
  doc.text('Student Health Screening Report', 14, 14);
  doc.setFontSize(10);
  doc.text(String(subtitle), 14, 21, { maxWidth: 260 });
  doc.setFontSize(8);
  doc.text(`${students.length} student records | Generated ${generatedAt.toISOString().slice(0, 10)}`, 14, 27);
  autoTable(doc, {
    startY: 33,
    head: [[...STUDENT_REPORT_HEADINGS]],
    body: rowsFor(students).map((row) => row.map((value) => String(value ?? ''))),
    styles: { fontSize: 5.5, cellPadding: 1.4, overflow: 'linebreak' },
    headStyles: { fillColor: [23, 50, 77] },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: [0, 1, 2],
    showHead: 'everyPage',
  });
  return doc;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportStudentExcel(students) {
  const workbook = await createStudentExcelWorkbook(students);
  const content = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    getStudentReportFilename(students, 'xlsx'),
  );
}

export async function exportStudentPdf(students, generatedAt = new Date()) {
  const doc = await createStudentPdfDocument(students, generatedAt);
  doc.save(getStudentReportFilename(students, 'pdf', generatedAt));
}
