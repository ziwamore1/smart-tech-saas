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
  { key: 'staff.phoneNumber', label: 'Contact Phone Number', scope: 'staff', type: 'text', aliases: ['phone', 'mobile', 'contact number'] },
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

export const INSTITUTIONAL_LOOKUP_SEEDS: { category: string; code: string; label: string; parentCode?: string; sortOrder?: number }[] = [
  ...['Head Teacher', 'Deputy Head', 'Senior Teacher', 'Subject Teacher', 'Class Teacher', 'Assistant Teacher', 'Bursar', 'Librarian', 'Lab Assistant', 'Driver', 'Clerical officer', 'CDEs', 'Untrained Teacher', 'Mentor', 'Guidance/counselling teacher', 'Care Giver'].map((label, sortOrder) => ({ category: 'POSITION', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['Certificate', 'Diploma', 'Advanced Diploma', 'First Degree', "Master's Degree", 'PhD'].map((label, sortOrder) => ({ category: 'QUALIFICATION', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['ECE Teacher Certificate', 'Primary Teacher Certificate', 'Certificate in Special Education', 'ECE Diploma', 'Primary Diploma', 'Secondary Diploma', 'Special Education Diploma', "Education Bachelor's Degree", 'Primary Degree', 'Secondary Degree', "Master's Degree", 'PHD', 'None'].map((label, sortOrder) => ({ category: 'TEACHER_QUALIFICATION', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['English Language', 'Local / Zambian Language(s)', 'Mathematics', 'Science / Integrated Science', 'Social Studies / Social & Development Studies', 'Creative & Technology Studies', 'Religious / Moral Education', 'Physical Education', 'Health Education', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography'].map((label, sortOrder) => ({ category: 'SUBJECT', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['Rural', 'Urban', 'Remote'].map((label, sortOrder) => ({ category: 'LOCATION', code: label.toUpperCase(), label, sortOrder })),
  ...['Female', 'Male'].map((label, sortOrder) => ({ category: 'GENDER', code: label.toUpperCase(), label, sortOrder })),
  ...['Single', 'Married', 'Separated', 'Divorced', 'Widowed'].map((label, sortOrder) => ({ category: 'MARITAL_STATUS', code: label.toUpperCase(), label, sortOrder })),
  ...['Active', 'On Leave', 'Seconded', 'Retired', 'Resigned', 'Contract', 'Temporary', 'Volunteer', 'Probation'].map((label, sortOrder) => ({ category: 'EMPLOYMENT_STATUS', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['Yes', 'No'].map((label, sortOrder) => ({ category: 'DIFFERENTLY_ABLED', code: label.toUpperCase(), label, sortOrder })),
  ...['GRZ', 'Grant Aided', 'Community', 'Private', 'Volunteer', 'PTC/PCC'].map((label, sortOrder) => ({ category: 'EMPLOYER', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['On Station', 'Currently Teaching', 'Study Leave', 'Suspension', 'Extended Sick Leave', 'Maternity Leave', 'Vacation Leave', 'Compassionate Leave'].map((label, sortOrder) => ({ category: 'STAFF_PRESENCE', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['ECE', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6', 'Grade 10', 'Grade 11', 'Grade 12'].map((label, sortOrder) => ({ category: 'MAIN_GRADE_TAUGHT', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
  ...['Zambia', 'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros', 'Congo', "Cote d'Ivoire", 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zimbabwe'].map((label, sortOrder) => ({ category: 'NATIONALITY', code: label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label, sortOrder })),
];

const ZAMBIA_GEOGRAPHY: Record<string, string[]> = {
  Central: ['Chibombo', 'Chisamba', 'Chitambo', 'Kabwe', 'Kapiri Mposhi', 'Luano', 'Mkushi', 'Mumbwa', 'Ngabwe', 'Serenje', 'Shibuyunji'],
  Copperbelt: ['Chililabombwe', 'Chingola', 'Kalulushi', 'Kitwe', 'Luanshya', 'Lufwanyama', 'Masaiti', 'Mpongwe', 'Mufulira', 'Ndola'],
  Eastern: ['Chadiza', 'Chipangali', 'Chipata', 'Kasenengwa', 'Katete', 'Lumezi', 'Lundazi', 'Mambwe', 'Nyimba', 'Petauke', 'Sinda', 'Vubwi'],
  Luapula: ['Chembe', 'Chiengi', 'Chifunabuli', 'Chipili', 'Kawambwa', 'Lunga', 'Mansa', 'Milenge', 'Mwansabombwe', 'Mwense', 'Nchelenge', 'Samfya'],
  Lusaka: ['Chilanga', 'Chongwe', 'Kafue', 'Luangwa', 'Lusaka', 'Rufunsa'],
  Muchinga: ['Chinsali', 'Isoka', 'Kanchibiya', 'Lavushimanda', 'Mafinga', 'Mpika', 'Nakonde', "Shiwang'andu"],
  Northern: ['Chilubi', 'Kaputa', 'Kasama', 'Lunte', 'Lupososhi', 'Mbala', 'Mporokoso', 'Mungwi', 'Nsama'],
  'North-Western': ['Chavuma', 'Ikelenge', 'Kabompo', 'Kalumbila', 'Kasempa', 'Manyinga', 'Mufumbwe', 'Mushindamo', 'Mwinilunga', 'Solwezi', 'Zambezi'],
  Southern: ['Chikankata', 'Chirundu', 'Choma', 'Gwembe', 'Itezhi-Tezhi', 'Kalomo', 'Kazungula', 'Livingstone', 'Mazabuka', 'Monze', 'Namwala', 'Pemba', 'Siavonga', 'Sinazongwe', 'Zimba'],
  Western: ['Kalabo', 'Kaoma', 'Limulunga', 'Lukulu', 'Luampa', 'Mitete', 'Mongu', 'Mulobezi', 'Mwandi', 'Nalolo', 'Nkeyema', 'Senanga', 'Sesheke', "Shang'ombo", 'Sikongo', 'Sioma'],
};

export const ZAMBIA_GEOGRAPHY_SEEDS = Object.entries(ZAMBIA_GEOGRAPHY).flatMap(([province, districts], provinceIndex) => [
  { category: 'PROVINCE', code: province.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label: province, sortOrder: provinceIndex },
  ...districts.map((district, districtIndex) => ({ category: 'DISTRICT', code: district.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), label: district, parentCode: province.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), sortOrder: districtIndex })),
]);
