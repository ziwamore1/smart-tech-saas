import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/timetable',
})
export class TimetableGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TimetableGateway.name);
  private schoolRooms: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    for (const [schoolId, clients] of this.schoolRooms.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        client.leave(`school:${schoolId}`);
      }
    }
  }

  @SubscribeMessage('joinSchool')
  handleJoinSchool(client: Socket, schoolId: string) {
    client.join(`school:${schoolId}`);

    if (!this.schoolRooms.has(schoolId)) {
      this.schoolRooms.set(schoolId, new Set());
    }
    this.schoolRooms.get(schoolId)!.add(client.id);

    this.logger.log(`Client ${client.id} joined school room: ${schoolId}`);
    return { event: 'joined', schoolId };
  }

  @SubscribeMessage('leaveSchool')
  handleLeaveSchool(client: Socket, schoolId: string) {
    client.leave(`school:${schoolId}`);

    if (this.schoolRooms.has(schoolId)) {
      this.schoolRooms.get(schoolId)!.delete(client.id);
    }

    this.logger.log(`Client ${client.id} left school room: ${schoolId}`);
    return { event: 'left', schoolId };
  }

  broadcastToSchool(schoolId: string, data: any) {
    this.server.to(`school:${schoolId}`).emit('timetableEvent', data);
  }

  broadcastSlotUpdate(slot: any) {
    this.server.emit('slotUpdated', slot);
  }

  broadcastTimetableGenerated(schoolId: string, classId: string) {
    this.server.to(`school:${schoolId}`).emit('timetableGenerated', {
      type: 'timetableGenerated',
      classId,
      message: 'Timetable has been updated',
    });
  }

  broadcastGenerationProgress(
    schoolId: string,
    progress: number,
    message: string,
  ) {
    this.server.to(`school:${schoolId}`).emit('generationProgress', {
      type: 'generationProgress',
      progress,
      message,
    });
  }
}
