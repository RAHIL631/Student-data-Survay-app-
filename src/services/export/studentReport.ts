import type { ScreeningSession, StudentRecord } from '../../types';

export const OFFICIAL_STUDENT_HEADINGS = [
  'SI NO',
  'NAME OF THE SCHOOL',
  'STUDENT NAME',
  'CLASS & SEC',
  'SEX',
  'DOB',
  'AGE IN YEARS',
  'HEIGHT',
  'WEIGHT',
  'BMI',
  'SKELETAL DEFORMITY',
  'SKIN THICKNESS',
  'MID ARM CIRCUMFERENCE',
  'HEAD MASTER',
  'SCREENING FACULTY',
  'OTHERS',
] as const;

function formatDate(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function safeFilenamePart(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'All';
}

function getReportRows(students: StudentRecord[], sessions: ScreeningSession[]) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  return students.map((student) => {
    const session = sessionById.get(student.sessionId);
    return {
      student,
      session,
      values: [
        student.siNumber,
        session?.schoolName ?? student.schoolId,
        student.studentName,
        `${student.className}${student.section ? ` - ${student.section}` : ''}`,
        student.sex,
        formatDate(student.dateOfBirth),
        student.age,
        student.heightCm,
        student.weightKg,
        student.bmi,
        student.skeletalDeformity,
        student.skinThicknessMm ?? '',
        student.midArmCircumferenceCm ?? '',
        session?.headMasterName ?? '',
        session?.screeningFacultyName ?? '',
        student.additionalRemarks,
      ],
    };
  });
}

function getSummary(students: StudentRecord[]) {
  const averageBmi = students.length
    ? Number((students.reduce((total, student) => total + (student.bmi ?? 0), 0) / students.length).toFixed(2))
    : 0;
  const countBy = (key: 'className' | 'sex' | 'skeletalDeformity') => {
    const counts = new Map<string, number>();
    for (const student of students) {
      const value = student[key] ?? 'Not recorded';
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  };
  return { averageBmi, byClass: countBy('className'), bySex: countBy('sex'), byDeformity: countBy('skeletalDeformity') };
}

function getFilenameDistrict(students: StudentRecord[], sessions: ScreeningSession[]): string {
  const districtNames = new Set(
    students.map((student) => sessions.find((session) => session.id === student.sessionId)?.districtName ?? student.districtId),
  );
  return districtNames.size === 1 ? safeFilenamePart([...districtNames][0]) : 'Multiple_Districts';
}

function getFilenameDate(students: StudentRecord[]): string {
  const dates = new Set(students.map((student) => student.screeningDate));
  return dates.size === 1 ? [...dates][0] : new Date().toISOString().slice(0, 10);
}

function downloadExcel(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportStudentExcel(students: StudentRecord[], sessions: ScreeningSession[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const rows = getReportRows(students, sessions);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Student Health Hub';

  const worksheet = workbook.addWorksheet('Student Screenings', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  worksheet.addRow([...OFFICIAL_STUDENT_HEADINGS]);
  rows.forEach(({ values }) => worksheet.addRow(values));
  worksheet.autoFilter = { from: 'A1', to: `P${Math.max(rows.length + 1, 1)}` };
  worksheet.columns = OFFICIAL_STUDENT_HEADINGS.map((heading) => ({
    header: heading,
    width: Math.max(14, Math.min(heading.length + 4, 28)),
  }));
  worksheet.getRow(1).height = 30;
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

  const summary = workbook.addWorksheet('Summary');
  const statistics = getSummary(students);
  summary.addRows([
    ['Metric', 'Value'],
    ['Students screened', students.length],
    ['Average BMI (informational)', statistics.averageBmi],
    [],
    ['Class', 'Student count'],
    ...statistics.byClass,
    [],
    ['Sex', 'Student count'],
    ...statistics.bySex,
    [],
    ['Skeletal deformity observation', 'Student count'],
    ...statistics.byDeformity,
  ]);
  summary.views = [{ state: 'frozen', ySplit: 1 }];
  summary.columns = [{ width: 36 }, { width: 24 }];
  summary.eachRow((row, rowNumber) => {
    const isHeader = rowNumber === 1 || row.getCell(2).value === 'Student count';
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD7DEE5' } },
        left: { style: 'thin', color: { argb: 'FFD7DEE5' } },
        bottom: { style: 'thin', color: { argb: 'FFD7DEE5' } },
        right: { style: 'thin', color: { argb: 'FFD7DEE5' } },
      };
      if (isHeader) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
      }
    });
  });

  const administrativeDetails = workbook.addWorksheet('Administrative Details');
  administrativeDetails.addRow(['DISTRICT', 'TALUK', 'NAME OF THE SCHOOL', 'SCREENING DATE', 'BEO', 'HEAD MASTER', 'SCREENING FACULTY']);
  const selectedSessionIds = new Set(students.map((student) => student.sessionId));
  sessions.filter((session) => selectedSessionIds.has(session.id)).forEach((session) => {
    administrativeDetails.addRow([
      session.districtName,
      session.talukName,
      session.schoolName,
      formatDate(session.date),
      session.beoName,
      session.headMasterName,
      session.screeningFacultyName,
    ]);
  });
  administrativeDetails.views = [{ state: 'frozen', ySplit: 1 }];
  administrativeDetails.columns = [18, 18, 34, 18, 24, 28, 28].map((width) => ({ width }));
  administrativeDetails.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  administrativeDetails.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
  administrativeDetails.eachRow((row) => row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD7DEE5' } },
      left: { style: 'thin', color: { argb: 'FFD7DEE5' } },
      bottom: { style: 'thin', color: { argb: 'FFD7DEE5' } },
      right: { style: 'thin', color: { argb: 'FFD7DEE5' } },
    };
  }));

  const content = await workbook.xlsx.writeBuffer();
  downloadExcel(content as ArrayBuffer, `Student_Health_Screening_${getFilenameDistrict(students, sessions)}_${getFilenameDate(students)}.xlsx`);
}

export async function exportStudentPdf(students: StudentRecord[], sessions: ScreeningSession[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const rows = getReportRows(students, sessions);
  const summary = getSummary(students);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const sessionNames = [...new Set(rows.map(({ session }) => session?.schoolName).filter(Boolean))];
  const title = sessionNames.length === 1 ? sessionNames[0] ?? 'Student Health Screening Report' : 'Student Health Screening Report';

  doc.setFontSize(15);
  doc.text('Student Health Screening Report', 14, 14);
  doc.setFontSize(11);
  doc.text(title, 14, 21);
  doc.setFontSize(8);
  doc.text(
    `${students.length} students | Average BMI (informational): ${summary.averageBmi} | Generated ${formatDate(new Date().toISOString().slice(0, 10))}`,
    14,
    27,
  );
  const sexSummary = summary.bySex.map(([label, count]) => `${label}: ${count}`).join(' | ') || 'No records';
  const deformitySummary = summary.byDeformity.map(([label, count]) => `${label}: ${count}`).join(' | ') || 'No records';
  doc.text(`By sex: ${sexSummary}`, 14, 32, { maxWidth: 268 });
  doc.text(`Deformity observation: ${deformitySummary}`, 14, 37, { maxWidth: 268 });
  autoTable(doc, {
    startY: 42,
    head: [[...OFFICIAL_STUDENT_HEADINGS]],
    body: rows.map(({ values }) => values.map((value) => String(value ?? ''))),
    styles: { fontSize: 5.5, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [23, 50, 77] },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: [0, 1, 2],
  });
  doc.save(`Student_Health_Screening_${getFilenameDistrict(students, sessions)}_${getFilenameDate(students)}.pdf`);
}
