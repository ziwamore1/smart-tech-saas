import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly emailService: EmailService) {}

  async submit(dto: CreateContactDto): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0F4C81, #00AEEF); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Contact Inquiry</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 100px;">Name:</td><td style="padding: 8px 0; color: #111827;">${dto.firstName} ${dto.lastName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Email:</td><td style="padding: 8px 0; color: #111827;"><a href="mailto:${dto.email}">${dto.email}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Subject:</td><td style="padding: 8px 0; color: #111827;">${dto.subject}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <h3 style="color: #374151; margin: 0 0 10px;">Message:</h3>
          <p style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${dto.message}</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Sent from SMART_TECH website contact form</p>
        </div>
      </div>
    `;

    try {
      await this.emailService.sendMail('support@smarttechsaas.com', `Contact Form: ${dto.subject}`, html);
      this.logger.log(`Contact inquiry from ${dto.email}: ${dto.subject}`);
    } catch (err) {
      this.logger.error(`Failed to send contact email: ${(err as Error).message}`);
      throw new Error('Failed to send your message. Please try again later.');
    }
  }
}
