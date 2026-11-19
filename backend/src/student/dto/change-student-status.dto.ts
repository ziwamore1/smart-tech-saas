import { IsEnum } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class ChangeStudentStatusDto {
  @IsEnum(StudentStatus)
  status: StudentStatus;
}
