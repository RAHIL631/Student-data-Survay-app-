function sameNumber(actual, expected) {
  if (actual == null || expected == null) {
    return actual == null && expected == null;
  }
  return Number(actual) === expected;
}

export function isSameSavedStudentSubmission(row, input) {
  const student = input.student;
  return row.organization_id === input.organizationId &&
    row.created_by === input.userId &&
    row.session_id === input.sessionId &&
    row.district_id === student.districtId &&
    row.taluk_id === student.talukId &&
    row.school_id === student.schoolId &&
    row.si_number === student.siNumber &&
    row.student_name === student.studentName &&
    row.class_name === student.className &&
    row.section === student.section &&
    row.sex === student.sex &&
    row.date_of_birth === student.dateOfBirth &&
    Number(row.age) === student.age &&
    sameNumber(row.height_cm, student.heightCm) &&
    sameNumber(row.weight_kg, student.weightKg) &&
    sameNumber(row.bmi, student.bmi) &&
    row.skeletal_deformity === student.skeletalDeformity &&
    row.skeletal_observation === student.skeletalObservation &&
    sameNumber(row.skin_thickness_mm, student.skinThicknessMm) &&
    sameNumber(row.mid_arm_circumference_cm, student.midArmCircumferenceCm) &&
    row.additional_remarks === student.additionalRemarks &&
    row.screening_date === student.screeningDate &&
    row.status === student.status;
}

export class DuplicateStudentSubmissionError extends Error {
  constructor(message, code, conflictType, serverRecord) {
    super(message);
    this.name = 'DuplicateStudentSubmissionError';
    this.code = code;
    this.status = 409;
    this.conflictType = conflictType;
    this.serverRecord = serverRecord ? {
      id: serverRecord.id,
      studentName: serverRecord.student_name,
      siNumber: serverRecord.si_number,
      dateOfBirth: serverRecord.date_of_birth,
      sessionId: serverRecord.session_id,
      screeningDate: serverRecord.screening_date,
      status: serverRecord.status,
      heightCm: serverRecord.height_cm === null ? null : Number(serverRecord.height_cm),
      weightKg: serverRecord.weight_kg === null ? null : Number(serverRecord.weight_kg),
    } : undefined;
  }
}

export async function verifyDuplicateStudentSubmission(input, findById, findBySiNumber) {
  if (input.idempotencyKey) {
    const rowById = await findById(input.organizationId, input.idempotencyKey);
    if (rowById) {
      if (isSameSavedStudentSubmission(rowById, input)) {
        return;
      }

      throw new DuplicateStudentSubmissionError(
        'The server record using this submission ID no longer matches the original offline submission. Review both records before deciding what to keep.',
        'IDEMPOTENCY_KEY_CONFLICT',
        'server_record_changed',
        rowById,
      );
    }
  }

  const rowBySiNumber = await findBySiNumber(input.organizationId, input.student.siNumber);
  if (rowBySiNumber && isSameSavedStudentSubmission(rowBySiNumber, input)) {
    return;
  }

  throw new DuplicateStudentSubmissionError(
    rowBySiNumber
      ? `SI Number ${input.student.siNumber} already belongs to a different student record in this organization. Review both records; neither was overwritten.`
      : `SI Number ${input.student.siNumber} is already in use, but this account cannot read the existing record. Ask an organization administrator to review it; the offline record is preserved.`,
    rowBySiNumber ? 'STUDENT_SI_NUMBER_CONFLICT' : 'DUPLICATE_NOT_VERIFIABLE',
    rowBySiNumber ? 'si_number_conflict' : 'duplicate_unverified',
    rowBySiNumber ?? undefined,
  );
}
