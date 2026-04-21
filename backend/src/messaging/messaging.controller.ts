import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private messagingService: MessagingService) {}

  @Get()
  getConversations(@Req() req: any) {
    return this.messagingService.getConversations(
      req.user.id,
      req.user.schoolId,
    );
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: any) {
    return this.messagingService.getUnreadCount(
      req.user.id,
      req.user.schoolId,
    );
  }

  @Get(':conversationId')
  getConversation(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ) {
    return this.messagingService.getConversation(conversationId, req.user.id);
  }

  @Post()
  createConversation(
    @Body() data: { participants: string[]; message: string },
    @Req() req: any,
  ) {
    return this.messagingService.createConversation(
      req.user.schoolId,
      data.participants,
      data.message,
      req.user.id,
    );
  }

  @Post(':conversationId')
  sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() data: { content: string },
    @Req() req: any,
  ) {
    return this.messagingService.sendMessage(
      conversationId,
      req.user.id,
      data.content,
    );
  }

  @Patch(':conversationId/read')
  markAsRead(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ) {
    return this.messagingService.markAsRead(conversationId, req.user.id);
  }
}
