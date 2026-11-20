const validSexValues = new Set(['Male', 'Female', 'Other', 'Prefer not to specify']);
const completeDeformityValues = new Set(['No', 'Yes', 'Suspected']);

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function calculateAgeAtScreening(dateOfBirth, screeningDate) {
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const screening = new Date(`${screeningDate}T00:00:00.000Z`);
  let age = screening.getUTCFullYear() - birth.getUTCFullYear();
  const monthDifference = screening.getUTCMonth() - birth.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && screening.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function isFiniteNumber(value, minimum, exclusiveMinimum = false) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && (exclusiveMinimum ? value > minimum : value >= minimum);
}

export function calculateStudentScreeningStatus(student) {
  const requiredText = [
    student.siNumber,
    student.studentName,
    student.className,
    student.section,
    student.sessionId,
    student.districtId,
    student.talukId,
    student.schoolId,
  ];
  const demographicsComplete = requiredText.every((value) => typeof value === 'string' && value.trim() !== '')
    && validSexValues.has(student.sex)
    && isValidDate(student.dateOfBirth)
    && isValidDate(student.screeningDate)
    && student.dateOfBirth <= student.screeningDate
    && Number.isInteger(student.age)
    && student.age >= 0
    && student.age <= 120
    && student.age === calculateAgeAtScreening(student.dateOfBirth, student.screeningDate)
    && isFiniteNumber(student.heightCm, 0, true)
    && isFiniteNumber(student.weightKg, 0, true)
    && isFiniteNumber(student.bmi, 0, true);

  const deformityComplete = completeDeformityValues.has(student.skeletalDeformity)
    && (
      student.skeletalDeformity === 'No'
      || (typeof student.skeletalObservation === 'string' && student.skeletalObservation.trim() !== '')
    );
  const measurementsComplete = isFiniteNumber(student.skinThicknessMm, 0)
    && isFiniteNumber(student.midArmCircumferenceCm, 0);

  return demographicsComplete && deformityComplete && measurementsComplete ? 'Complete' : 'Pending';
}
