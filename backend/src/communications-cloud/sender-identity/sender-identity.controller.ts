import {
  Controller, Get, Post, Put, Delete, Param, Query, Body,
} from '@nestjs/common';
import { SenderIdentityService } from './sender-identity.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

@Controller('communications-cloud/sender-identities')
export class SenderIdentityController {
  constructor(private readonly identityService: SenderIdentityService) {}

  @Get()
  async getAll(
    @Query('channel') channel?: string,
    @Query('scope') scope?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.identityService.getIdentities(channel, scope, schoolId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.identityService.getIdentity(id);
  }

  @Post()
  async create(@Body() data: {
    name: string;
    channel: CommCloudChannel;
    senderId?: string;
    senderName?: string;
    senderEmail?: string;
    senderPhone?: string;
    businessAccountId?: string;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
  }) {
    return this.identityService.createIdentity(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: {
    name?: string;
    channel?: CommCloudChannel;
    senderId?: string;
    senderName?: string;
    senderEmail?: string;
    senderPhone?: string;
    businessAccountId?: string;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
    isActive?: boolean;
    isVerified?: boolean;
    verificationStatus?: string;
  }) {
    return this.identityService.updateIdentity(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.identityService.deleteIdentity(id);
  }

  @Post(':id/default')
  async setDefault(@Param('id') id: string) {
    return this.identityService.setDefault(id);
  }

  @Post(':id/verify')
  async verify(@Param('id') id: string) {
    return this.identityService.updateIdentity(id, {
      isVerified: true,
      verificationStatus: 'verified',
    });
  }
}
