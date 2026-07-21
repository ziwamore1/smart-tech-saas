import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/school',
})
export class SchoolEventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SchoolEventsGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('SchoolEventsGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  joinSchool(client: Socket, schoolId: string) {
    client.join(`school:${schoolId}`);
  }

  leaveSchool(client: Socket, schoolId: string) {
    client.leave(`school:${schoolId}`);
  }

  emitToSchool(schoolId: string, event: string, data: any) {
    if (this.server) {
      this.server.to(`school:${schoolId}`).emit(event, data);
      this.logger.debug(`Emitted ${event} to school:${schoolId}`);
    }
  }

  emitResultsPublished(schoolId: string, data: { classId: string; termId: string; publishedBy: string }) {
    this.emitToSchool(schoolId, 'results:published', data);
  }

  emitAttendanceUpdated(schoolId: string, data: { classId: string; date: string; markedBy: string }) {
    this.emitToSchool(schoolId, 'attendance:updated', data);
  }

  emitExamPublished(schoolId: string, data: { examId: string; publishedBy: string }) {
    this.emitToSchool(schoolId, 'exam:published', data);
  }

  emitStudentEnrolled(schoolId: string, data: { studentId: string; classId: string }) {
    this.emitToSchool(schoolId, 'student:enrolled', data);
  }

  emitStudentStatusChanged(schoolId: string, data: { studentId: string; status: string }) {
    this.emitToSchool(schoolId, 'student:status-changed', data);
  }

  emitTeacherCreated(schoolId: string, data: { teacherId: string; userId: string }) {
    this.emitToSchool(schoolId, 'teacher:created', data);
  }

  emitReportCardGenerated(schoolId: string, data: { classId: string; termId: string }) {
    this.emitToSchool(schoolId, 'reportcard:generated', data);
  }
}
