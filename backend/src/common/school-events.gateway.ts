import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
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

  private clientMeta = new Map<string, { schoolId?: string; userId?: string }>();

  afterInit() {
    this.logger.log('SchoolEventsGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const meta = this.clientMeta.get(client.id);
    this.clientMeta.delete(client.id);
  }

  @SubscribeMessage('joinSchool')
  handleJoinSchool(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { schoolId: string; userId?: string } | string,
  ) {
    const schoolId = typeof data === 'string' ? data : data?.schoolId;
    const userId = typeof data === 'object' ? data?.userId : undefined;

    if (!schoolId) {
      this.logger.warn(`Client ${client.id} attempted joinSchool without schoolId`);
      return { event: 'joinSchool', data: { error: 'schoolId required' } };
    }
    client.join(`school:${schoolId}`);
    this.clientMeta.set(client.id, { schoolId, userId });
    this.logger.log(`Client ${client.id} joined school:${schoolId}`);
    return { event: 'joinSchool', data: { schoolId, joined: true } };
  }

  @SubscribeMessage('leaveSchool')
  handleLeaveSchool(
    @ConnectedSocket() client: Socket,
    @MessageBody() schoolId: string,
  ) {
    if (!schoolId) return { event: 'leaveSchool', data: { error: 'schoolId required' } };
    client.leave(`school:${schoolId}`);
    this.clientMeta.delete(client.id);
    this.logger.log(`Client ${client.id} left school:${schoolId}`);
    return { event: 'leaveSchool', data: { schoolId, left: true } };
  }

  @SubscribeMessage('presence:heartbeat')
  handlePresenceHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; page?: string },
  ) {
    const meta = this.clientMeta.get(client.id);
    if (meta?.schoolId && data?.userId) {
      return { event: 'presence:heartbeat', data: { received: true } };
    }
  }

  joinSchool(client: Socket, schoolId: string) {
    client.join(`school:${schoolId}`);
  }

  leaveSchool(client: Socket, schoolId: string) {
    client.leave(`school:${schoolId}`);
  }

  getClientMeta(clientId: string) {
    return this.clientMeta.get(clientId);
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

  emitResultsLive(schoolId: string, data: any) {
    this.emitToSchool(schoolId, 'results:live', data);
  }

  emitResultsSaved(schoolId: string, data: { classId: string; termId: string; subjectId?: string; savedBy: string; count: number }) {
    this.emitToSchool(schoolId, 'results:saved', data);
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

  emitProfileUpdated(schoolId: string, data: { userId: string; updatedBy: string; changes: string[] }) {
    this.emitToSchool(schoolId, 'profile:updated', data);
  }

  emitUserUpdated(schoolId: string, data: { userId: string; updatedBy: string }) {
    this.emitToSchool(schoolId, 'user:updated', data);
  }
}
