export function createStudentExportRows(students) {
  return students.map((student) => ({
    'Student ID': student.siNumber ?? '',
    'Student Name': student.studentName ?? '',
    Gender: student.sex ?? '',
    'Date of Birth': student.dateOfBirth ?? '',
    'Age at Screening': student.age ?? '',
    Class: student.className ?? '',
    Section: student.section ?? '',
    School: student.schoolName ?? '',
    District: student.districtName ?? '',
    Taluk: student.talukName ?? '',
    'Screening Date': student.screeningDate,
    'Screening Status': student.status,
    'Height (cm)': student.heightCm ?? '',
    'Weight (kg)': student.weightKg ?? '',
    BMI: student.bmi ?? '',
    'Skeletal Deformity': student.skeletalDeformity ?? '',
    'Skeletal Observation': student.skeletalObservation ?? '',
    'Skin Thickness (mm)': student.skinThicknessMm ?? '',
    'Mid-Arm Circumference (cm)': student.midArmCircumferenceCm ?? '',
    'Additional Remarks': student.additionalRemarks ?? '',
  }));
}
