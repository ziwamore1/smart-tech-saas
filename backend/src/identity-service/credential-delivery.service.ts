import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import { normalizeZambianPhone } from '../common/utils/phone.util';

export interface DeliveryOptions {
  userId: string;
  userCredentialId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  username: string;
  password: string;
  recipientName: string;
  role: string;
  schoolName?: string;
  schoolUrl?: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP';
  email?: string;
}

export interface BundledCredentialOptions {
  parentUserId: string;
  studentUserId: string;
  parentEmail?: string;
  parentPhone?: string;
  parentUsername: string;
  parentPassword: string;
  parentName: string;
  studentUsername: string;
  studentPassword: string;
  studentName: string;
  schoolName?: string;
  schoolUrl?: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'BUNDLED';
  parentUserEmail?: string;
}

@Injectable()
export class CredentialDeliveryService {
  private readonly logger = new Logger(CredentialDeliveryService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private unifiedMessaging: UnifiedMessagingService,
  ) {}

  private getLoginUrl(schoolUrl?: string): string {
    return schoolUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  }

  async deliverCredentials(options: DeliveryOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { channel, recipientEmail, recipientPhone, username, password, recipientName, role, schoolName, schoolUrl, email } = options;

    try {
      let messageId: string | undefined;
      let recipient: string;

      switch (channel) {
        case 'EMAIL':
          if (!recipientEmail) throw new Error('Email recipient required');
          recipient = recipientEmail;
          messageId = await this.sendEmailCredentials({
            to: recipientEmail,
            username,
            password,
            recipientName,
            role,
            schoolName,
            schoolUrl,
            email: email || recipientEmail,
          });
          break;

        case 'SMS':
          recipient = normalizeZambianPhone(recipientPhone);
          if (!recipient) throw new Error('Phone number is invalid or missing. Ask the parent to provide a valid mobile number through their linked child.');
          messageId = await this.sendSmsCredentials({
            to: recipient,
            username,
            password,
            recipientName,
            schoolUrl,
            email: email || recipientEmail,
          });
          break;

        case 'WHATSAPP':
          if (!recipientPhone) throw new Error('Phone recipient required');
          recipient = recipientPhone;
          messageId = await this.sendWhatsAppCredentials({
            to: recipientPhone,
            username,
            password,
            recipientName,
            schoolUrl,
            email: email || recipientEmail,
          });
          break;

        default:
          throw new Error(`Unsupported delivery channel: ${channel}`);
      }

      await this.logDelivery(options, channel, recipient, messageId, 'DELIVERED');

      if (options.userCredentialId) {
        await this.prisma.userCredential.update({
          where: { id: options.userCredentialId },
          data: {
            deliveryStatus: 'DELIVERED',
            deliveredAt: new Date(),
          },
        });
      }

      return { success: true, messageId };
    } catch (error: any) {
      this.logger.error(`Credential delivery failed: ${error.message}`);
      await this.logDelivery(options, channel, recipientEmail || recipientPhone || 'unknown', undefined, 'FAILED', error.message);
      return { success: false, error: error.message };
    }
  }

  async deliverBundledCredentials(options: BundledCredentialOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { parentEmail, parentPhone, parentUsername, parentPassword, parentName, studentUsername, studentPassword, studentName, schoolName, schoolUrl, parentUserEmail } = options;

    const loginUrl = this.getLoginUrl(schoolUrl);

    try {
      let recipient: string;
      let messageId: string;

      recipient = normalizeZambianPhone(parentPhone);
      if (!recipient) {
        await this.recordParentDeliveryFailure(options.parentUserId, parentPhone, 'INVALID_PHONE', 'No SMS was sent. The parent phone is missing or invalid; ask the parent to provide a correct mobile number through their linked child.');
        return { success: false, error: 'Parent phone number is missing or invalid. No SMS was sent; request a correct number through the linked child.' };
      }
      messageId = await this.sendBundledSms({
        to: recipient,
        parentName,
        parentUsername,
        parentPassword,
        studentName,
        studentUsername,
        studentPassword,
        loginUrl,
        parentUserEmail,
      });

      this.logger.log(`[Bundled Credentials] Sent to ${recipient} for ${parentName} & ${studentName}`);
      return { success: true, messageId };
    } catch (error: any) {
      this.logger.error(`Bundled credential delivery failed: ${error.message}`);
      await this.recordParentDeliveryFailure(options.parentUserId, parentPhone, 'FAILED', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendSmsMessage(to: string, message: string) {
    const recipient = normalizeZambianPhone(to);
    if (!recipient) return { success: false, error: 'Phone number is missing or invalid. No SMS was sent.' };
    const result = await this.unifiedMessaging.sendSMS(recipient, message);
    if (!result.success) return { success: false, error: result.error || 'SMS provider failed to deliver the message.' };
    return { success: true, messageId: result.messageId };
  }

  async sendParentBundleSms(input: {
    parentUserId: string;
    parentId: string;
    requestedById?: string | null;
    to: string;
    message: string;
    childCount: number;
    parentCredentialId?: string;
  }) {
    const recipient = normalizeZambianPhone(input.to);
    if (!recipient) return { success: false, error: 'Parent phone number is missing or invalid. No SMS was sent.' };
    try {
      const result = await this.unifiedMessaging.sendSMS(recipient, input.message);
      const success = Boolean(result.success);
      const errorMessage = success ? null : result.error || 'SMS provider failed to deliver the message.';
      await this.prisma.parentCredentialDelivery.create({
        data: {
          parentId: input.parentId,
          requestedById: input.requestedById,
          recipientPhone: recipient,
          status: success ? 'DELIVERED' : 'FAILED',
          errorMessage,
          messageId: result.messageId,
          childCount: input.childCount,
          deliveredAt: success ? new Date() : undefined,
        },
      });
      await this.prisma.parent.update({
        where: { id: input.parentId },
        data: {
          phone: recipient,
          phoneStatus: 'VALID',
          phoneStatusReason: null,
          phoneValidatedAt: new Date(),
          credentialDeliveryStatus: success ? 'DELIVERED' : 'FAILED',
          credentialDeliveryError: errorMessage,
          credentialDeliveryUpdatedAt: new Date(),
        },
      });
      await this.prisma.credentialDeliveryLog.create({
        data: {
          userId: input.parentUserId,
          userCredentialId: input.parentCredentialId,
          channel: 'SMS',
          recipient,
          status: success ? 'DELIVERED' : 'FAILED',
          messageId: result.messageId,
          errorMessage: errorMessage || undefined,
          deliveredAt: success ? new Date() : undefined,
        },
      });
      return { success, messageId: result.messageId, error: errorMessage || undefined };
    } catch (error: any) {
      await this.recordParentDeliveryFailure(input.parentUserId, recipient, 'FAILED', error?.message || String(error), input.parentId, input.requestedById, input.childCount);
      return { success: false, error: error?.message || 'SMS delivery failed.' };
    }
  }

  async recordParentDeliveryFailure(
    parentUserId: string,
    phone: string | null | undefined,
    status: string,
    errorMessage: string,
    parentId?: string,
    requestedById?: string,
    childCount = 0,
  ) {
    const normalized = normalizeZambianPhone(phone);
    if (parentId) {
      await this.prisma.parentCredentialDelivery.create({
        data: { parentId, requestedById, recipientPhone: phone || null, status, errorMessage, childCount },
      });
      await this.prisma.parent.update({
        where: { id: parentId },
        data: {
          phoneStatus: normalized ? 'VALID' : phone?.trim() ? 'INVALID' : 'MISSING',
          phoneStatusReason: normalized ? null : errorMessage,
          phoneValidatedAt: new Date(),
          credentialDeliveryStatus: status,
          credentialDeliveryError: errorMessage,
          credentialDeliveryUpdatedAt: new Date(),
        },
      });
    }
    if (parentUserId) {
      await this.prisma.credentialDeliveryLog.create({
        data: { userId: parentUserId, channel: 'SMS', recipient: phone || 'MISSING', status, errorMessage },
      });
    }
  }

  private async sendBundledEmail(data: {
    to: string;
    parentName: string;
    parentUsername: string;
    parentPassword: string;
    studentName: string;
    studentUsername: string;
    studentPassword: string;
    schoolName?: string;
    loginUrl: string;
    parentUserEmail?: string;
  }): Promise<string> {
    const displayName = data.schoolName || 'SmartTech';
    const subject = `Your ${displayName} Login Credentials — Action Required`;
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #2563eb 100%); padding:40px 30px; border-radius:16px 16px 0 0; text-align:center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td style="width:48px;height:48px;background:#2563eb;border-radius:12px;text-align:center;vertical-align:middle;font-size:24px;color:#fff;font-weight:700;line-height:48px;">ST</td>
                      <td style="padding-left:14px;">
                        <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Smart Tech</div>
                        <div style="color:#93c5fd;font-size:12px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">Education Platform</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Accent bar -->
              <tr>
                <td style="height:4px;background:linear-gradient(90deg,#2563eb,#06b6d4,#2563eb);"></td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background:#ffffff;padding:40px 36px;">
                  <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:700;">Welcome, ${data.parentName}</h1>
                  <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
                    Your parent account and your child <strong style="color:#1e40af;">${data.studentName}</strong>'s account have been created for <strong>${displayName}</strong>.
                  </p>

                  <!-- Parent Credentials -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
                    <tr>
                      <td style="background:#1e40af;padding:14px 20px;">
                        <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">👤 Parent Account</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Username</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.parentUsername}</td>
                          </tr>
                          <tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                          <tr>
                            <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Password</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.parentPassword}</td>
                          </tr>
                          ${data.parentUserEmail ? `<tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                          <tr>
                            <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Email</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.parentUserEmail}</td>
                          </tr>` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Student Credentials -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
                    <tr>
                      <td style="background:#0f766e;padding:14px 20px;">
                        <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">🎓 Student Account — ${data.studentName}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Username</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.studentUsername}</td>
                          </tr>
                          <tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                          <tr>
                            <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Password</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.studentPassword}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Warning -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;margin-bottom:28px;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align:top;padding-right:12px;font-size:18px;">⚠️</td>
                            <td style="color:#92400e;font-size:14px;line-height:1.5;">
                              <strong>Important:</strong> Both accounts require a password change on first login. You can login using your username${data.parentUserEmail ? ` or email (${data.parentUserEmail})` : ''}. Do not share these credentials.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Login button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                    <tr>
                      <td style="border-radius:10px;background:linear-gradient(135deg,#1e40af,#2563eb);box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                        <a href="${data.loginUrl}" target="_blank" style="display:inline-block;padding:16px 48px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                          Login to Portal →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc;padding:28px 36px;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom:12px;">
                        <span style="font-size:14px;font-weight:700;color:#1e40af;">Smart Tech</span>
                        <span style="color:#cbd5e1;padding:0 8px;">|</span>
                        <span style="font-size:12px;color:#94a3b8;">Education Management Platform</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="font-size:12px;color:#94a3b8;line-height:1.6;">
                        This is an automated message. Please do not reply to this email.<br>
                        If you did not expect this email, contact your school administrator.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;
    await this.emailService.sendMail(data.to, subject, html);
    return `bundle-email-${Date.now()}`;
  }

  private async sendBundledSms(data: {
    to: string;
    parentName: string;
    parentUsername: string;
    parentPassword: string;
    studentName: string;
    studentUsername: string;
    studentPassword: string;
    loginUrl: string;
    parentUserEmail?: string;
  }): Promise<string> {
    const message =
      `Hello ${data.parentName},\n\n` +
      `Your account: User: ${data.parentUsername}, Pass: ${data.parentPassword}\n` +
      (data.parentUserEmail ? `You can also login with email: ${data.parentUserEmail}\n\n` : '\n') +
      `Student (${data.studentName}) account: User: ${data.studentUsername}, Pass: ${data.studentPassword}\n\n` +
      `Login: ${data.loginUrl}\n\nChange passwords on first login. - SmartTech`;
    const result = await this.sendSmsMessage(data.to, message);
    if (!result.success) throw new Error(result.error || 'SMS delivery failed');
    if (!result.messageId) throw new Error('SMS provider did not return a delivery reference.');
    return result.messageId;
  }

  async deliverStudentCredentialsOnRequest(options: DeliveryOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    void options;
    return { success: false, error: 'Student credentials cannot be sent directly to students. Deliver them to linked parents with validated mobile numbers through Password Hub.' };

    const { channel, recipientEmail, username, password, recipientName, role, schoolName, schoolUrl, email } = options;
    const loginUrl = this.getLoginUrl(schoolUrl);

    try {
      let messageId: string;
      let recipient: string;

      if (channel === 'EMAIL' && recipientEmail) {
        recipient = recipientEmail;
        const displayName = schoolName || 'SmartTech';
        const subject = `Your ${displayName} Student Login Credentials — Action Required`;
        const emailNote = email ? `<tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                              <tr>
                                <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Email</td>
                                <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${email}</td>
                              </tr>` : '';
        const emailLoginNote = email ? ` You can also login with your email (${email}).` : '';
        const html = `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
              <tr><td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #2563eb 100%); padding:40px 30px; border-radius:16px 16px 0 0; text-align:center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td style="width:48px;height:48px;background:#2563eb;border-radius:12px;text-align:center;vertical-align:middle;font-size:24px;color:#fff;font-weight:700;line-height:48px;">ST</td>
                          <td style="padding-left:14px;">
                            <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Smart Tech</div>
                            <div style="color:#93c5fd;font-size:12px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">Education Platform</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Accent bar -->
                  <tr>
                    <td style="height:4px;background:linear-gradient(90deg,#2563eb,#06b6d4,#2563eb);"></td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="background:#ffffff;padding:40px 36px;">
                      <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:700;">Hello, ${recipientName}</h1>
                      <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
                        Your student login credentials for <strong>${displayName}</strong> are ready. Use them to access the portal.
                      </p>

                      <!-- Credentials card -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
                        <tr>
                          <td style="background:#0f766e;padding:14px 20px;">
                            <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">🎓 Student Login Credentials</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:24px 20px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Role</td>
                                <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${role}</td>
                              </tr>
                              <tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                              <tr>
                                <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Username</td>
                                <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${username}</td>
                              </tr>
                              <tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                              <tr>
                                <td style="padding:8px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Password</td>
                                <td style="padding:8px 0;color:#0f172a;font-size:14px;font-family:'Courier New',monospace;background:#e0f2fe;padding:8px 14px;border-radius:6px;border:1px solid #bae6fd;">${password}</td>
                              </tr>
                              ${emailNote}
                            </table>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                        <strong>Login using:</strong> You can use your <strong>username</strong>${emailLoginNote}
                      </p>

                      <!-- Warning -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;margin-bottom:28px;">
                        <tr>
                          <td style="padding:16px 20px;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="vertical-align:top;padding-right:12px;font-size:18px;">⚠️</td>
                                <td style="color:#92400e;font-size:14px;line-height:1.5;">
                                  <strong>Important:</strong> You will be required to change your password on first login. Keep these credentials safe.
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Login button -->
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td style="border-radius:10px;background:linear-gradient(135deg,#1e40af,#2563eb);box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                            <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:16px 48px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                              Login to Portal →
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#f8fafc;padding:28px 36px;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding-bottom:12px;">
                            <span style="font-size:14px;font-weight:700;color:#1e40af;">Smart Tech</span>
                            <span style="color:#cbd5e1;padding:0 8px;">|</span>
                            <span style="font-size:12px;color:#94a3b8;">Education Management Platform</span>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="font-size:12px;color:#94a3b8;line-height:1.6;">
                            This is an automated message. Please do not reply to this email.<br>
                            If you did not expect this email, contact your school administrator.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td></tr>
            </table>
          </body>
          </html>`;
        await this.emailService.sendMail(recipientEmail, subject, html);
        messageId = `student-email-${Date.now()}`;
      } else if (recipientPhone) {
        return { success: false, error: 'Student credentials can only be delivered to a linked parent using a valid parent phone number. No SMS was sent.' };
      } else {
        throw new Error('Recipient email or phone required');
      }

      return { success: true, messageId };
    } catch (error: any) {
      this.logger.error(`Student credential delivery failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async sendEmailCredentials(data: {
    to: string;
    username: string;
    password: string;
    recipientName: string;
    role: string;
    schoolName?: string;
    schoolUrl?: string;
    email?: string;
  }): Promise<string> {
    const loginUrl = this.getLoginUrl(data.schoolUrl);
    const displayName = data.schoolName || 'SmartTech';
    const subject = `Your ${displayName} Account Credentials — Action Required`;
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #2563eb 100%); padding:40px 30px; border-radius:16px 16px 0 0; text-align:center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td style="width:48px;height:48px;background:#2563eb;border-radius:12px;text-align:center;vertical-align:middle;font-size:24px;color:#fff;font-weight:700;line-height:48px;">ST</td>
                      <td style="padding-left:14px;">
                        <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Smart Tech</div>
                        <div style="color:#93c5fd;font-size:12px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">Education Platform</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Accent bar -->
              <tr>
                <td style="height:4px;background:linear-gradient(90deg,#2563eb,#06b6d4,#2563eb);"></td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background:#ffffff;padding:40px 36px;">
                  <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:700;">Welcome, ${data.recipientName}</h1>
                  <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
                    Your <strong style="color:#1e40af;">${data.role}</strong> account for <strong>${displayName}</strong> has been created. Use the credentials below to log in.
                  </p>

                  <!-- Credentials card -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
                    <tr>
                      <td style="background:#1e40af;padding:14px 20px;">
                        <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">🔐 Login Credentials</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:10px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Username</td>
                            <td style="padding:10px 0;color:#0f172a;font-size:15px;font-family:'Courier New',monospace;background:#e0f2fe;padding:10px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.username}</td>
                          </tr>
                          <tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                          <tr>
                            <td style="padding:10px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Password</td>
                            <td style="padding:10px 0;color:#0f172a;font-size:15px;font-family:'Courier New',monospace;background:#e0f2fe;padding:10px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.password}</td>
                          </tr>
                          ${data.email ? `<tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                          <tr>
                            <td style="padding:10px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Email</td>
                            <td style="padding:10px 0;color:#0f172a;font-size:15px;font-family:'Courier New',monospace;background:#e0f2fe;padding:10px 14px;border-radius:6px;border:1px solid #bae6fd;">${data.email}</td>
                          </tr>` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Warning -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;margin-bottom:28px;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align:top;padding-right:12px;font-size:18px;">⚠️</td>
                            <td style="color:#92400e;font-size:14px;line-height:1.5;">
                              <strong>Important:</strong> You will be required to change your password on first login. Do not share these credentials with anyone.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Login button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                    <tr>
                      <td style="border-radius:10px;background:linear-gradient(135deg,#1e40af,#2563eb);box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                        <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:16px 48px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                          Login to Portal →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Steps -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;">
                    <tr>
                      <td style="padding:20px 20px;background:#f0f9ff;border-radius:10px;border:1px solid #e0f2fe;">
                        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">Getting Started</p>
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:5px 0;color:#1e40af;font-size:14px;font-weight:600;padding-right:10px;vertical-align:top;">1.</td>
                            <td style="padding:5px 0;color:#475569;font-size:14px;">Click the login button above or visit the portal</td>
                          </tr>
                          <tr>
                            <td style="padding:5px 0;color:#1e40af;font-size:14px;font-weight:600;padding-right:10px;vertical-align:top;">2.</td>
                            <td style="padding:5px 0;color:#475569;font-size:14px;">Enter your username${data.email ? ` or email (${data.email})` : ''} and password</td>
                          </tr>
                          <tr>
                            <td style="padding:5px 0;color:#1e40af;font-size:14px;font-weight:600;padding-right:10px;vertical-align:top;">3.</td>
                            <td style="padding:5px 0;color:#475569;font-size:14px;">Set a new secure password when prompted</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc;padding:28px 36px;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom:12px;">
                        <span style="font-size:14px;font-weight:700;color:#1e40af;">Smart Tech</span>
                        <span style="color:#cbd5e1;padding:0 8px;">|</span>
                        <span style="font-size:12px;color:#94a3b8;">Education Management Platform</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="font-size:12px;color:#94a3b8;line-height:1.6;">
                        This is an automated message. Please do not reply to this email.<br>
                        If you did not expect this email, contact your school administrator.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    await this.emailService.sendMail(data.to, subject, html);
    return `email-${Date.now()}`;
  }

  private async sendSmsCredentials(data: {
    to: string;
    username: string;
    password: string;
    recipientName: string;
    schoolUrl?: string;
    email?: string;
  }): Promise<string> {
    const loginUrl = this.getLoginUrl(data.schoolUrl);
    const emailNote = data.email ? ` You can also login with email: ${data.email}.` : '';
    const message = `Welcome ${data.recipientName}! Your SmartTech account has been created. Username: ${data.username}, Password: ${data.password}.${emailNote} Login at: ${loginUrl}. Please change your password on first login.`;
    const result = await this.sendSmsMessage(data.to, message);
    if (!result.success) throw new Error(result.error || 'SMS delivery failed');
    if (!result.messageId) throw new Error('SMS provider did not return a delivery reference.');
    return result.messageId;
  }

  private async sendWhatsAppCredentials(data: {
    to: string;
    username: string;
    password: string;
    recipientName: string;
    schoolUrl?: string;
    email?: string;
  }): Promise<string> {
    const loginUrl = this.getLoginUrl(data.schoolUrl);
    const emailNote = data.email ? `\nYou can also login with email: ${data.email}` : '';
    const message = `Hello ${data.recipientName},\n\nYour SmartTech Education account has been created.\n\nUsername: ${data.username}\nPassword: ${data.password}${emailNote}\n\nLogin: ${loginUrl}\n\nPlease change your password on first login.\n\n- SmartTech Team`;
    const result = await this.unifiedMessaging.sendWhatsApp(data.to, message);
    if (!result.success) throw new Error(result.error || 'WhatsApp delivery failed');
    if (!result.messageId) throw new Error('WhatsApp provider did not return a delivery reference.');
    return result.messageId;
  }

  private async logDelivery(
    options: DeliveryOptions,
    channel: string,
    recipient: string,
    messageId?: string,
    status: string = 'PENDING',
    errorMessage?: string,
  ) {
    await this.prisma.credentialDeliveryLog.create({
      data: {
        userCredentialId: options.userCredentialId,
        userId: options.userId,
        channel,
        recipient,
        status,
        messageId,
        errorMessage,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }
}
