import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async submit(@Body() dto: CreateContactDto) {
    await this.contactService.submit(dto);
    return {
      success: true,
      message: 'Thank you for your message! We will get back to you within 24 hours.',
    };
  }
}
