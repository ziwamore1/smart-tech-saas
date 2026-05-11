import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { RoleModule } from './role/role.module';
import { PaymentModule } from './payment/payment.module';
import { CommunicationModule } from './communication/communication.module';
import { EmailModule } from './email/email.module';
import { FeatureLockModule } from './feature-lock/feature-lock.module';
import { GradingSystemModule } from './grading-system/grading-system.module';
import { AttendanceModule } from './attendance/attendance.module';
import { HomeworkModule } from './homework/homework.module';
import { CalendarSyncModule } from './calendar-sync/calendar-sync.module';
import { WorkloadModule } from './workload/workload.module';
import { MultiSchoolModule } from './multi-school/multi-school.module';
import { PushNotificationModule } from './push-notification/push-notification.module';
import { MobileModule } from './mobile/mobile.module';
import { ExamModule } from './exam/exam.module';
import { MessagingModule } from './messaging/messaging.module';
import { LibraryModule } from './library/library.module';
import { GalleryModule } from './gallery/gallery.module';
import { LessonPlanModule } from './lesson-plan/lesson-plan.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { ReportQueueModule } from './report-queue/report-queue.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    RoleModule,
    PaymentModule,
    CommunicationModule,
    EmailModule,
    FeatureLockModule,
    GradingSystemModule,
    AttendanceModule,
    HomeworkModule,
    CalendarSyncModule,
    WorkloadModule,
    MultiSchoolModule,
    PushNotificationModule,
    MobileModule,
    ExamModule,
    MessagingModule,
    LibraryModule,
    GalleryModule,
    LessonPlanModule,
    IntelligenceModule,
    ReportQueueModule,
    QueuesModule,
  ],
})
export class AppModule {}