export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  dateOfBirth?: string;
  gender?: string;
  grade?: string;
  className?: string;
  schoolId: string;
  transferIn?: boolean;
  previousSchool?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  photoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}
