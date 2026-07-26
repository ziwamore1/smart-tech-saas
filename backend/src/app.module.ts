import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationModule } from './notification/notification.module';
import { DirectorModule } from './director/director.module';
import { AcademicYearModule } from './academic-year/academic-year.module';
import { TermModule } from './term/term.module';
import { StudentModule } from './student/student.module';
import { LevelTypeModule } from './level-type/level-type.module';
import { ClassModule } from './class/class.module';
import { SubjectModule } from './subject/subject.module';
import { ClassSubjectModule } from './class-subject/class-subject.module';
import { ClassroomModule } from './classroom/classroom.module';
import { TeachingAssignmentModule } from './teaching-assignment/teaching-assignment.module';
import { TeacherModule } from './teacher/teacher.module';
import { ResultModule } from './result/result.module';
import { ReportCardModule } from './report-card/report-card.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SchoolModule } from './school/school.module';
import { PublishingModule } from './publishing/publishing.module';
import { ParentModule } from './parent/parent.module';
import { AssessmentModule } from './assessment/assessment.module';
import { TimetableModule } from './timetable/timetable.module';
import { ConstraintsModule } from './constraints/constraints.module';
import { DashboardConfigModule } from './dashboard-config/dashboard-config.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { LandingMockupModule } from './landing-mockup/landing-mockup.module';
import { RoleModule } from './role/role.module';
import { PaymentModule } from './payment/payment.module';
import { CommunicationModule } from './communication/communication.module';
import { SystemCommunicationsModule } from './system-communications/system-communications.module';
import { EmailModule } from './email/email.module';
import { FeatureLockModule } from './feature-lock/feature-lock.module';
import { GradingSystemModule } from './grading-system/grading-system.module';
import { AttendanceModule } from './attendance/attendance.module';
import { HomeworkModule } from './homework/homework.module';
import { CalendarSyncModule } from './calendar-sync/calendar-sync.module';
import { WorkloadModule } from './workload/workload.module';
import { MultiSchoolModule } from './multi-school/multi-school.module';
import { PushNotificationModule } from './push-notification/push-notification.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FirebaseModule } from './firebase/firebase.module';
import { MobileModule } from './mobile/mobile.module';
import { ExamModule } from './exam/exam.module';
import { MessagingModule } from './messaging/messaging.module';
import { LibraryModule } from './library/library.module';
import { GalleryModule } from './gallery/gallery.module';
import { LessonPlanModule } from './lesson-plan/lesson-plan.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { ReportQueueModule } from './report-queue/report-queue.module';
import { QueuesModule } from './queues/queues.module';
import { PgQueuesModule } from './queues/pg-queues.module';
import { ReportTemplateBuilderModule } from './report-template-builder/report-template-builder.module';
import { ProfileModule } from './profile/profile.module';
import { StudentPhotoModule } from './student-photo/student-photo.module';
import { CommonModule } from './common/common.module';
import { SystemModule } from './system/system.module';
import { StampsModule } from './stamps/stamps.module';
import { SigningModule } from './signing-service/signing.module';
import { BlockchainModule } from './blockchain-service/blockchain.module';
import { MinistryGatewayModule } from './ministry-gateway/ministry-gateway.module';
import { QrModule } from './qr-service/qr.module';
import { CertificateValidationModule } from './certificate-validation-service/certificate-validation.module';
import { VerificationModule } from './verification-service/verification.module';
import { ApprovalModule } from './approval-service/approval.module';
import { BeemModule } from './beem/beem.module';
import { TwilioModule } from './twilio/twilio.module';
import { AssessmentEngineModule } from './assessment-engine/assessment-engine.module';
import { GradingEngineModule } from './grading-engine/grading-engine.module';
import { ResultAnalyticsModule } from './result-analytics/result-analytics.module';
import { ResultsManagementModule } from './results-management/results-management.module';
import { SyncEngineModule } from './sync-engine/sync-engine.module';
import { ReportCardEngineModule } from './report-card-engine/report-card-engine.module';
import { RankingModule } from './ranking-service/ranking.module';
import { IdentityModule } from './identity-service/identity.module';
import { CurriculumModule } from './curriculum-service/curriculum.module';
import { CurriculumIntelligenceModule } from './curriculum-intelligence/curriculum-intelligence.module';
import { CompositeSubjectModule } from './composite-subject/composite-subject.module';
import { InstitutionModule } from './institution/institution.module';
import { PrimarySchoolModule } from './primary-school/primary-grading.module';
import { Grade7EczModule } from './grade7-ecz/grade7-ecz.module';
import { StaffSyncEngineModule } from './shared/staff-sync-engine/staff-sync-engine.module';
import { StaffRecordsModule } from './premium/staff-records-service/staff-records.module';
import { StaffPositionModule } from './staff-position/staff-position.module';
import { ContactModule } from './contact/contact.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CommunicationsCloudModule } from './communications-cloud/communications-cloud.module';
import { AdmissionNumberModule } from './admission-number/admission-number.module';
import { HealthModule } from './common/health.module';
import { ProductionLogger } from './common/production-logger';
import { SchoolMembershipModule } from './school-membership/school-membership.module';
import { PlatformRoleModule } from './platform-role/platform-role.module';
import { ClassTeacherAssignmentModule } from './class-teacher-assignment/class-teacher-assignment.module';
import { ResultsSmsModule } from './results-sms/results-sms.module';
import { HolidayModule } from './holiday/holiday.module';
import { ReportEngineModule } from './report-engine/report-engine.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(() => {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) return [];
      try {
        const url = new URL(redisUrl);
        return [BullModule.forRoot({
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password ? decodeURIComponent(url.password) : undefined,
            tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
            retryStrategy: () => null,
            lazyConnect: true,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            connectTimeout: 5000,
            commandTimeout: 5000,
          },
        })];
      } catch {
        console.error('[BullModule] Invalid REDIS_URL');
        return [];
      }
    })(),
    CommonModule,
    AuthModule,
    PrismaModule,
    NotificationModule,
    DirectorModule,
    AcademicYearModule,
    TermModule,
    StudentModule,
    LevelTypeModule,
    ClassModule,
    SubjectModule,
    ClassSubjectModule,
    ClassroomModule,
    TeachingAssignmentModule,
    TeacherModule,
    ResultModule,
    ReportCardModule,
    EnrollmentModule,
    AnalyticsModule,
    SchoolModule,
    PublishingModule,
    ParentModule,
    AssessmentModule,
    TimetableModule,
    ConstraintsModule,
    DashboardConfigModule,
    SuperAdminModule,
    LandingMockupModule,
    RoleModule,
    PaymentModule,
    CommunicationModule,
    SystemCommunicationsModule,
    EmailModule,
    FeatureLockModule,
    GradingSystemModule,
    AttendanceModule,
    HomeworkModule,
    CalendarSyncModule,
    WorkloadModule,
    MultiSchoolModule,
    PushNotificationModule,
    NotificationsModule,
    FirebaseModule,
    MobileModule,
    ExamModule,
    MessagingModule,
    LibraryModule,
    GalleryModule,
    LessonPlanModule,
    IntelligenceModule,
    ReportQueueModule,
    QueuesModule,
    PgQueuesModule,
    ReportTemplateBuilderModule,
    ProfileModule,
    StudentPhotoModule,
    SystemModule,
    StampsModule,
    SigningModule,
    BlockchainModule,
    MinistryGatewayModule,
    QrModule,
    CertificateValidationModule,
    VerificationModule,
    ApprovalModule,
    BeemModule,
    TwilioModule,
    AssessmentEngineModule,
    GradingEngineModule,
    ResultAnalyticsModule,
    ResultsManagementModule,
    SyncEngineModule,
    ReportCardEngineModule,
    RankingModule,
    IdentityModule,
    CurriculumModule,
    CurriculumIntelligenceModule,
    CompositeSubjectModule,
    PrimarySchoolModule,
    Grade7EczModule,
    StaffSyncEngineModule,
    StaffRecordsModule,
    StaffPositionModule,
    HealthModule,
    InstitutionModule,
    ContactModule,
    CloudinaryModule,
    CommunicationsCloudModule,
    SchoolMembershipModule,
    PlatformRoleModule,
    ClassTeacherAssignmentModule,
    ResultsSmsModule,
    HolidayModule,
    ReportEngineModule,
  ],
  providers: [ProductionLogger],
})
export class AppModule {}
