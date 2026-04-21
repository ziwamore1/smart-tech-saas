import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private prisma: PrismaService) {}

  async getConversations(userId: string, schoolId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        schoolId,
        participants: { has: userId },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((c) => ({
      id: c.id,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.messages.filter((m) => !m.isRead && m.senderId !== userId).length,
      participants: c.participants,
    }));
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.participants.includes(userId)) {
      throw new BadRequestException('You are not part of this conversation');
    }

    return conversation;
  }

  async createConversation(schoolId: string, participants: string[], message: string, senderId: string) {
    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        schoolId,
        participants: { hasEvery: participants },
      },
    });

    if (existingConversation) {
      return this.sendMessage(existingConversation.id, senderId, message);
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        schoolId,
        participants,
        lastMessage: message,
      },
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content: message,
      },
    });

    return conversation;
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (!conversation.participants.includes(senderId)) {
      throw new BadRequestException('You are not part of this conversation');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content,
        lastMessageAt: new Date(),
      },
    });

    return message;
  }

  async markAsRead(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation || !conversation.participants.includes(userId)) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  async getUnreadCount(userId: string, schoolId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        schoolId,
        participants: { has: userId },
      },
      include: {
        messages: true,
      },
    });

    let totalUnread = 0;
    for (const conv of conversations) {
      const unread = conv.messages.filter(
        (m) => !m.isRead && m.senderId !== userId,
      ).length;
      totalUnread += unread;
    }

    return { unreadCount: totalUnread };
  }
}
