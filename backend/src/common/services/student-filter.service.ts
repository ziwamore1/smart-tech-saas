import { Injectable } from '@nestjs/common';
import { Prisma, StudentStatus, EnrollmentStatus } from '@prisma/client';

@Injectable()
export class StudentFilterService {
  activeStudentWhere(): Prisma.StudentWhereInput {
    return { status: StudentStatus.ACTIVE };
  }

  activeEnrollmentWhere(): Prisma.EnrollmentWhereInput {
    return { status: EnrollmentStatus.ACTIVE };
  }

  activeStudentWithEnrollmentWhere(): Prisma.StudentWhereInput {
    return {
      status: StudentStatus.ACTIVE,
      enrollments: {
        some: { status: EnrollmentStatus.ACTIVE },
      },
    };
  }

  excludeTransferredStudentWhere(): Prisma.StudentWhereInput {
    return {
      status: { not: StudentStatus.TRANSFERRED },
    };
  }

  communicationRecipientWhere(): Prisma.StudentWhereInput {
    return {
      status: {
        notIn: [
          StudentStatus.TRANSFERRED,
          StudentStatus.INACTIVE,
          StudentStatus.WITHDRAWN,
          StudentStatus.GRADUATED,
          StudentStatus.DECEASED,
        ],
      },
    };
  }
}
