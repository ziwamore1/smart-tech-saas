import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.$use(this.schoolIsolationMiddleware);
      this.$use(this.auditLogMiddleware);
      this.logger.log(
        'Database connection established with security middleware',
      );
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database connection closed');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
    }
  }

  private schoolIsolationMiddleware: Prisma.Middleware = async (
    params,
    next,
  ) => {
    const skipModels = ['School', 'AcademicYear', 'Role', 'UserRole', 'User', 'FeatureLock', 'SubscriptionPlan', 'DeviceToken', 'Notification', 'TimetableSlot'];
    const modelName = params.model as string;

    if (skipModels.includes(modelName)) {
      return next(params);
    }

    const request = global.request as {
      user?: { schoolId?: string; roles?: string[] };
    };
    const schoolId = request?.user?.schoolId;
    const isSuperAdmin = request?.user?.roles?.includes('SuperAdmin');

    if (isSuperAdmin || !schoolId) {
      return next(params);
    }

    const schoolIdFieldMap: Record<string, string> = {
      Class: 'schoolId',
      Subject: 'schoolId',
      Teacher: 'schoolId',
      Student: 'schoolId',
      Enrollment: 'schoolId',
      Result: 'schoolId',
      Parent: 'schoolId',
      AssessmentType: 'schoolId',
      AssessmentScore: 'schoolId',
      Timetable: 'schoolId',
      TimetableSlot: 'schoolId',
      LessonRequirement: 'schoolId',
      Classroom: 'schoolId',
      BreakPeriod: 'schoolId',
      TimetableAuditLog: 'schoolId',
      TimetableConstraint: 'schoolId',
      TimetableVersion: 'schoolId',
      NoticeBoard: 'schoolId',
      FeeCategory: 'schoolId',
      FeePayment: 'schoolId',
      GradingSystem: 'schoolId',
      ResultPublication: 'schoolId',
      TeachingAssignment: 'schoolId',
      LevelType: 'schoolId',
      DashboardConfig: 'schoolId',
      AuditLog: 'schoolId',
      Library: 'schoolId',
      Gallery: 'schoolId',
      GalleryPhoto: 'schoolId',
    };

    const schoolField = schoolIdFieldMap[modelName];
    if (!schoolField) {
      return next(params);
    }

    if (params.action === 'findUnique') {
      params.args.where = { ...params.args.where, [schoolField]: schoolId };
    } else if (params.action === 'findFirst' || params.action === 'findMany') {
      params.args.where = { ...params.args.where, [schoolField]: schoolId };
    } else if (params.action === 'update' || params.action === 'updateMany') {
      params.args.where = { ...params.args.where, [schoolField]: schoolId };
    } else if (params.action === 'delete' || params.action === 'deleteMany') {
      params.args.where = { ...params.args.where, [schoolField]: schoolId };
    } else if (params.action === 'count') {
      params.args.where = { ...params.args.where, [schoolField]: schoolId };
    }

    return next(params);
  };

  private auditLogMiddleware: Prisma.Middleware = async (params, next) => {
    const sensitiveModels = ['School', 'Result', 'FeePayment'];
    const sensitiveActions = ['create', 'update', 'delete'];
    const modelName = params.model as string;
    const actionName = params.action as string;

    if (
      !sensitiveModels.includes(modelName) ||
      !sensitiveActions.includes(actionName)
    ) {
      return next(params);
    }

    const request = global.request as {
      user?: { id?: string; schoolId?: string };
    };
    const userId = request?.user?.id;
    const schoolId = request?.user?.schoolId;

    const result = await next(params);

    if (userId && schoolId) {
      try {
        await this.auditLog.create({
          data: {
            userId,
            schoolId,
            action: actionName,
            model: modelName,
            recordId: result?.id || 'unknown',
            changes: JSON.stringify(params.args),
          },
        });
      } catch (error) {
        this.logger.error('Failed to create audit log', error);
      }
    }

    return result;
  };
}
