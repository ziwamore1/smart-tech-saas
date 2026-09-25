export interface CanonicalField {
  key: string;
  label: string;
  scope: 'staff' | 'school';
  type: 'text' | 'date' | 'number' | 'lookup';
  aliases: string[];
}

const staffFields: CanonicalField[] = [
  { key: 'staff.surname', label: 'Surname', scope: 'staff', type: 'text', aliases: ['last name'] },
  { key: 'staff.firstName', label: 'First Name', scope: 'staff', type: 'text', aliases: ['given name'] },
  { key: 'staff.nrcNumber', label: 'NRC Number', scope: 'staff', type: 'text', aliases: ['nrc', 'nrc no.'] },
  { key: 'staff.manTsNumber', label: 'MAN/TS Number', scope: 'staff', type: 'text', aliases: ['man/ts no', 'ts number', 'man ts number'] },
  { key: 'staff.employeeNumber', label: 'Employee Number', scope: 'staff', type: 'text', aliases: ['employee no.', 'employee no'] },
  { key: 'staff.dateOfBirth', label: 'Date of Birth', scope: 'staff', type: 'date', aliases: ['dob'] },
  { key: 'staff.gender', label: 'Sex', scope: 'staff', type: 'lookup', aliases: ['gender'] },
  { key: 'staff.firstAppointmentDate', label: 'Date of First Appointment to the Teaching Service', scope: 'staff', type: 'date', aliases: ['first appointment', 'date of first appointment'] },
  { key: 'staff.currentPostAppointmentDate', label: 'Date of Appointment to the Current Post', scope: 'staff', type: 'date', aliases: ['current post appointment', 'date of present appointment'] },
  { key: 'staff.maritalStatus', label: 'Marital Status', scope: 'staff', type: 'lookup', aliases: ['marital status'] },
  { key: 'staff.differentlyAbled', label: 'Differently Abled', scope: 'staff', type: 'lookup', aliases: ['disability'] },
  { key: 'staff.nationality', label: 'Nationality', scope: 'staff', type: 'lookup', aliases: [] },
  { key: 'staff.substantivePosition', label: 'Substantive Position', scope: 'staff', type: 'lookup', aliases: ['substantive post'] },
  { key: 'staff.currentPosition', label: 'Current Position', scope: 'staff', type: 'lookup', aliases: ['position'] },
  { key: 'staff.highestLevelOfEducation', label: 'Highest Level of Education', scope: 'staff', type: 'lookup', aliases: ['highest academic'] },
  { key: 'staff.highestTeacherQualification', label: 'Highest Teacher Qualification', scope: 'staff', type: 'lookup', aliases: ['professional qualification'] },
  { key: 'staff.additionalResponsibilities', label: 'Additional Responsibilities', scope: 'staff', type: 'lookup', aliases: [] },
  { key: 'staff.inServiceTraining', label: 'Type of In-Service Training Attended (Include CPDs)', scope: 'staff', type: 'lookup', aliases: ['type of in-service training', 'type of in-service training attended'] },
  { key: 'staff.employmentStatus', label: 'Employment Status', scope: 'staff', type: 'lookup', aliases: ['status'] },
  { key: 'staff.mainGradeTaught', label: 'Main Grade Taught', scope: 'staff', type: 'lookup', aliases: ['grade level'] },
  { key: 'staff.staffPresence', label: 'Staff Presence', scope: 'staff', type: 'lookup', aliases: ['staff presence (abscondement)'] },
  { key: 'staff.employer', label: 'Employer', scope: 'staff', type: 'lookup', aliases: [] },
  { key: 'staff.subjectBeingTaughtA', label: 'Subject Being Taught (A)', scope: 'staff', type: 'lookup', aliases: [] },
  { key: 'staff.subjectBeingTaughtB', label: 'Subject Being Taught (B)', scope: 'staff', type: 'lookup', aliases: [] },
  { key: 'staff.subjectQualifiedToTeachA', label: 'Subject Qualified to Teach (A)', scope: 'staff', type: 'lookup', aliases: [] },
  { key: 'staff.subjectQualifiedToTeachB', label: 'Subject Qualified to Teach (B)', scope: 'staff', type: 'lookup', aliases: [] },
  { key: 'staff.numberOfDaysAbsent', label: 'Number of Days Absent', scope: 'staff', type: 'number', aliases: ['days absent'] },
  { key: 'staff.highestAcademicQualification', label: 'Highest Academic Qualification', scope: 'staff', type: 'lookup', aliases: ['academic qualification'] },
];

const schoolFields: CanonicalField[] = [
  { key: 'school.name', label: 'School Name', scope: 'school', type: 'text', aliases: ['name of school'] },
  { key: 'school.province', label: 'Province', scope: 'school', type: 'lookup', aliases: [] },
  { key: 'school.district', label: 'District', scope: 'school', type: 'lookup', aliases: [] },
  { key: 'school.constituency', label: 'Constituency', scope: 'school', type: 'lookup', aliases: [] },
  { key: 'school.ward', label: 'Ward', scope: 'school', type: 'lookup', aliases: [] },
  { key: 'school.zone', label: 'Zone', scope: 'school', type: 'lookup', aliases: [] },
  { key: 'school.location', label: 'Location (Rural/Urban)', scope: 'school', type: 'lookup', aliases: ['location'] },
  { key: 'school.runningAgency', label: 'Running Agency', scope: 'school', type: 'lookup', aliases: [] },
  { key: 'school.type', label: 'Type of School (Secondary, Primary, ECE Centre)', scope: 'school', type: 'lookup', aliases: ['school type', 'type of school'] },
  { key: 'school.emisNumber', label: 'EMIS No.', scope: 'school', type: 'text', aliases: ['emis number', 'emis no', 'emis no.'] },
  { key: 'school.distanceFromDebOffice', label: 'DISTANCE FROM DEB OFFICE', scope: 'school', type: 'number', aliases: ['distance from deb office'] },
];

export const CANONICAL_HR_FIELDS = [...schoolFields, ...staffFields];

const normalize = (label: string) => label.toLowerCase().replace(/[^a-z0-9]/g, '');

export function detectCanonicalField(label: string): { field: CanonicalField; confidence: number } | null {
  const candidate = normalize(label);
  if (!candidate) return null;
  let best: { field: CanonicalField; confidence: number } | null = null;
  for (const field of CANONICAL_HR_FIELDS) {
    const aliases = [field.label, field.key.split('.').pop() || '', ...field.aliases].map(normalize);
    const confidence = aliases.includes(candidate) ? 1 : aliases.some((alias) => alias && (candidate.includes(alias) || alias.includes(candidate))) ? 0.82 : 0;
    if (confidence > (best?.confidence || 0)) best = { field, confidence };
  }
  return best?.confidence ? best : null;
}

export const MOE_TEACHING_FIELDS = [
  ['sn', 'SN', false], ...[
    'School Name','Province','District','Constituency','Ward','Zone','Location (Rural/Urban)','Running Agency','Type of School (Secondary, Primary, ECE Centre)','EMIS No.','DISTANCE FROM DEB OFFICE',
    'Surname','First Name','NRC Number','MAN/TS Number','Employee Number','Date of Birth (DD/MM/YYYY)','Sex','Date of First Appointment to the Teaching Service (DD/MM/YYYY)','Date of Appointment to the Current Post (DD/MM/YYYY)','Marital Status','Differently Abled','Nationality','Substantive Position','Current Position','Highest Level of Education','Highest Teacher Qualification','Additional Responsibilities','Type of In-ServiceTraining Attended (Include CPDs)','Employment Status ','Main Grade Taught ','Staff Presence','Employer','Subject Being Taught (A)','Subject Being Taught (B)','Subject Qualified to Teach (A)','Subject Qualified to Teach (B)','Number of Days Absent',
  ].map((label) => [normalize(label), label, label !== 'SN'] as [string, string, boolean]),
];

export const MOE_NON_TEACHING_HEADERS = [
  'SN','School Name','Province','District','Constituency','Ward','Zone','Location (Rural/Urban)','Running Agency','Type of School (Secondary, Primary, ECE Centre)','EMIS No.','DISTANCE FROM DEB OFFICE','Surname','First Name','NRC Number','MAN/TS Number','Employee Number','Date of Birth (DD/MM/YYYY)','Sex','Date of First Appointment to the Teaching Service (DD/MM/YYYY)','Date of Appointment to the Current Post (DD/MM/YYYY)','Marital Status','Differently Abled','Nationality','Substantive Position','Current Position','Highest Level of Education','Employment Status ','Staff Presence ','Employer','Number of Days Absent',
];
