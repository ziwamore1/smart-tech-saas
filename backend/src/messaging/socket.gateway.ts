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
  cors: {
    origin: '*',
  },
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SocketGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    this.logger.log('Socket.IO initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendWorkflowUpdate(data: {
    workflowId: string;
    documentId: string;
    schoolId: string;
    status: string;
    message: string;
    nextStep?: any;
  }) {
    this.server.emit(`workflow:${data.schoolId}`, data);
    this.server.emit(`workflow:${data.workflowId}`, data);
    this.server.emit('workflow:update', data);
  }

  sendNotification(userId: string, data: any) {
    this.server.emit(`notification:${userId}`, data);
    this.server.emit('notification:new', { userId, ...data });
  }

  sendVerificationUpdate(data: any) {
    this.server.emit('verification:update', data);
  }
}
