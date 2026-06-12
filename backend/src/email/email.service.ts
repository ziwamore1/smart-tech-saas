import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private useSendgrid = false;
  private useSmtp = false;

  constructor() {
    const sgApiKey = process.env.SENDGRID_API_KEY || '';
    const smtpPass = process.env.EMAIL_PASSWORD || process.env.ZOHO_SMTP_PASSWORD || '';

    if (sgApiKey) {
      sgMail.setApiKey(sgApiKey);
      this.useSendgrid = true;
      console.log('[EmailService] using SendGrid HTTP API');
    }

    if (smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: 'noreply@smarttechsaas.com',
          pass: smtpPass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
        tls: { rejectUnauthorized: false },
      });
      this.useSmtp = true;
    }

    if (!sgApiKey && !smtpPass) {
      console.warn('[EmailService] no email credentials configured (SENDGRID_API_KEY or EMAIL_PASSWORD)');
    }
  }

  async sendMail(to: string, subject: string, html: string) {
    const from = { name: 'Smart Tech', email: 'noreply@smarttechsaas.com' };

    if (this.useSendgrid) {
      try {
        await sgMail.send({ to, from, subject, html });
        return;
      } catch (err) {
        console.error('[EmailService] SendGrid failed, trying SMTP fallback:', (err as Error).message);
      }
    }

    if (this.useSmtp && this.transporter) {
      await this.transporter.sendMail({ from: '"Smart Tech" <noreply@smarttechsaas.com>', to, subject, html });
      return;
    }

    throw new Error('No email provider configured');
  }

  async sendOtpEmail(to: string, otp: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello,</p>
          <p style="color: #6b7280; font-size: 16px;">Your verification code is:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This code expires in <strong>5 minutes</strong>.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Your OTP Code - Smart Tech', html);
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello,</p>
          <p style="color: #6b7280; font-size: 16px;">Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This link expires in <strong>1 hour</strong>.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">If you didn't request a password reset, please ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Reset Your Password - Smart Tech', html);
  }

  async sendWelcomeEmail(to: string, name: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Welcome to Smart Tech!</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${name},</p>
          <p style="color: #6b7280; font-size: 16px;">Thank you for joining Smart Tech. Your account has been successfully created.</p>
          <p style="color: #6b7280; font-size: 16px;">You can now:</p>
          <ul style="color: #6b7280; font-size: 16px; line-height: 1.8;">
            <li>Manage students and classes</li>
            <li>Track attendance and results</li>
            <li>Generate report cards</li>
            <li>And much more...</li>
          </ul>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Welcome to Smart Tech!', html);
  }

  async sendCredentialsEmail(to: string, data: {
    recipientName: string;
    username: string;
    password: string;
    role: string;
    schoolName?: string;
    loginUrl?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ea6645 0%, #f59e0b 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #fef3c7; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Your Account Credentials</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">Your <strong>${data.role}</strong> account has been created. Here are your login credentials:</p>
          <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #ea6645;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Username:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-family: monospace;">${data.username}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Password:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-family: monospace;">${data.password}</td></tr>
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.loginUrl || 'https://smarttechsaas.com/login'}" style="background: #ea6645; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Sign In Now</a>
          </div>
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
            <p style="color: #92400e; font-size: 14px; margin: 0;"><strong>Important:</strong> Please change your password after your first login for security.</p>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Your Login Credentials - Smart Tech', html);
  }

  async sendAttendanceAlert(to: string, data: {
    studentName: string;
    date: string;
    status: string;
    schoolName?: string;
  }) {
    const statusColor = data.status === 'absent' ? '#ef4444' : data.status === 'late' ? '#f59e0b' : '#059669';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Attendance Alert</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello,</p>
          <p style="color: #6b7280; font-size: 16px;">This is an attendance notification for <strong>${data.studentName}</strong>:</p>
          <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${statusColor};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.date}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Status:</strong></td><td style="padding: 8px 0; color: ${statusColor}; font-size: 14px; font-weight: bold; text-transform: capitalize;">${data.status}</td></tr>
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Attendance Alert - Smart Tech', html);
  }

  async sendResultNotification(to: string, data: {
    studentName: string;
    term: string;
    subject?: string;
    grade?: string;
    schoolName?: string;
    reportUrl?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #d1fae5; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Results Published</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello,</p>
          <p style="color: #6b7280; font-size: 16px;">Results have been published for <strong>${data.studentName}</strong>:</p>
          <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #059669;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Term:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.term}</td></tr>
              ${data.subject ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Subject:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.subject}</td></tr>` : ''}
              ${data.grade ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Grade:</strong></td><td style="padding: 8px 0; color: #059669; font-size: 14px; font-weight: bold;">${data.grade}</td></tr>` : ''}
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          ${data.reportUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${data.reportUrl}" style="background: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Full Report</a></div>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Results Published - Smart Tech', html);
  }

  async sendFeeReminder(to: string, data: {
    studentName: string;
    amount: string;
    dueDate: string;
    schoolName?: string;
    paymentUrl?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #fef3c7; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Fee Payment Reminder</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello,</p>
          <p style="color: #6b7280; font-size: 16px;">This is a friendly reminder about pending fees for <strong>${data.studentName}</strong>:</p>
          <div style="background: #fef3c7; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #92400e; font-size: 14px; width: 120px;"><strong>Amount Due:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.amount}</td></tr>
              <tr><td style="padding: 8px 0; color: #92400e; font-size: 14px;"><strong>Due Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.dueDate}</td></tr>
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #92400e; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          ${data.paymentUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${data.paymentUrl}" style="background: #f59e0b; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Pay Now</a></div>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Fee Payment Reminder - Smart Tech', html);
  }

  async sendApprovalNotification(to: string, data: {
    approverName: string;
    documentType: string;
    documentName: string;
    actionRequired: string;
    approvalUrl?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ede9fe; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Approval Required</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.approverName},</p>
          <p style="color: #6b7280; font-size: 16px;">A ${data.documentType} requires your ${data.actionRequired}:</p>
          <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #7c3aed;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;"><strong>Document:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.documentName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Type:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.documentType}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Action:</strong></td><td style="padding: 8px 0; color: #7c3aed; font-size: 14px; font-weight: bold;">${data.actionRequired}</td></tr>
            </table>
          </div>
          ${data.approvalUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${data.approvalUrl}" style="background: #7c3aed; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Review & Approve</a></div>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Approval Required - Smart Tech', html);
  }

  async sendExamScheduleNotification(to: string, data: {
    recipientName: string;
    studentName?: string;
    examName: string;
    examDate: string;
    subject?: string;
    time?: string;
    venue?: string;
    schoolName?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #fecaca; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Exam Schedule Notification</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},${data.studentName ? `</p><p style="color: #6b7280; font-size: 16px;">This is to inform you about the upcoming exam for <strong>${data.studentName}</strong>:</p>` : '</p><p style="color: #6b7280; font-size: 16px;">This is to inform you about the upcoming exam:</p>'}
          <div style="background: #fef2f2; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #dc2626;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Exam:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.examName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.examDate}</td></tr>
              ${data.subject ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Subject:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.subject}</td></tr>` : ''}
              ${data.time ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Time:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.time}</td></tr>` : ''}
              ${data.venue ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Venue:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.venue}</td></tr>` : ''}
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Please ensure the student arrives on time with all necessary materials.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Exam Schedule - Smart Tech', html);
  }

  async sendHomeworkNotification(to: string, data: {
    recipientName: string;
    studentName?: string;
    subject: string;
    title: string;
    description?: string;
    dueDate: string;
    teacherName?: string;
    schoolName?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #cffafe; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">New Homework Assignment</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},${data.studentName ? `</p><p style="color: #6b7280; font-size: 16px;">A new homework assignment has been given to <strong>${data.studentName}</strong>:</p>` : '</p><p style="color: #6b7280; font-size: 16px;">A new homework assignment has been given:</p>'}
          <div style="background: #ecfeff; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #0891b2;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Subject:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.subject}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Title:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.title}</td></tr>
              ${data.description ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Details:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.description}</td></tr>` : ''}
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Due Date:</strong></td><td style="padding: 8px 0; color: #0891b2; font-size: 14px; font-weight: bold;">${data.dueDate}</td></tr>
              ${data.teacherName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Teacher:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.teacherName}</td></tr>` : ''}
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Please ensure the homework is completed and submitted by the due date.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'New Homework Assignment - Smart Tech', html);
  }

  async sendHomeworkReminder(to: string, data: {
    recipientName: string;
    studentName?: string;
    subject: string;
    title: string;
    dueDate: string;
    daysRemaining: number;
  }) {
    const urgencyColor = data.daysRemaining <= 1 ? '#ef4444' : data.daysRemaining <= 3 ? '#f59e0b' : '#0891b2';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ffffffcc; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Homework Due Soon</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},${data.studentName ? `</p><p style="color: #6b7280; font-size: 16px;">This is a reminder that homework for <strong>${data.studentName}</strong> is due soon:</p>` : '</p><p style="color: #6b7280; font-size: 16px;">This is a reminder that the following homework is due soon:</p>'}
          <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${urgencyColor};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Subject:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.subject}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Title:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.title}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Due Date:</strong></td><td style="padding: 8px 0; color: ${urgencyColor}; font-size: 14px; font-weight: bold;">${data.dueDate}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Time Left:</strong></td><td style="padding: 8px 0; color: ${urgencyColor}; font-size: 14px; font-weight: bold;">${data.daysRemaining} day${data.daysRemaining !== 1 ? 's' : ''}</td></tr>
            </table>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Homework Reminder - Smart Tech', html);
  }

  async sendLibraryNotification(to: string, data: {
    recipientName: string;
    studentName?: string;
    notificationType: 'overdue' | 'due-soon' | 'new-arrival' | 'reservation-ready';
    bookTitle: string;
    author?: string;
    dueDate?: string;
    daysOverdue?: number;
    fineAmount?: string;
    schoolName?: string;
  }) {
    const typeConfig = {
      'overdue': { color: '#ef4444', bg: '#fef2f2', title: 'Overdue Book Notice', subject: 'Overdue Book - Smart Tech' },
      'due-soon': { color: '#f59e0b', bg: '#fffbeb', title: 'Book Due Soon', subject: 'Book Due Soon - Smart Tech' },
      'new-arrival': { color: '#059669', bg: '#ecfdf5', title: 'New Book Available', subject: 'New Library Book - Smart Tech' },
      'reservation-ready': { color: '#7c3aed', bg: '#f5f3ff', title: 'Reserved Book Ready', subject: 'Reservation Ready - Smart Tech' },
    };
    const config = typeConfig[data.notificationType];
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ffffffcc; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">${config.title}</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},${data.studentName ? `</p><p style="color: #6b7280; font-size: 16px;">This notification is regarding <strong>${data.studentName}</strong>:</p>` : '</p>'}
          <div style="background: ${config.bg}; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${config.color};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;"><strong>Book:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.bookTitle}</td></tr>
              ${data.author ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Author:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.author}</td></tr>` : ''}
              ${data.dueDate ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Due Date:</strong></td><td style="padding: 8px 0; color: ${config.color}; font-size: 14px; font-weight: bold;">${data.dueDate}</td></tr>` : ''}
              ${data.daysOverdue !== undefined ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Days Overdue:</strong></td><td style="padding: 8px 0; color: #ef4444; font-size: 14px; font-weight: bold;">${data.daysOverdue} day${data.daysOverdue !== 1 ? 's' : ''}</td></tr>` : ''}
              ${data.fineAmount ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Fine:</strong></td><td style="padding: 8px 0; color: #ef4444; font-size: 14px; font-weight: bold;">${data.fineAmount}</td></tr>` : ''}
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          ${data.notificationType === 'overdue' ? '<p style="color: #6b7280; font-size: 14px;">Please return the book as soon as possible to avoid additional fines.</p>' : ''}
          ${data.notificationType === 'reservation-ready' ? '<p style="color: #6b7280; font-size: 14px;">Your reserved book is ready for pickup at the library.</p>' : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, config.subject, html);
  }

  async sendNoticeBoardNotification(to: string, data: {
    recipientName: string;
    noticeTitle: string;
    noticeContent: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    issuedBy?: string;
    schoolName?: string;
    expiryDate?: string;
  }) {
    const priorityConfig = {
      'low': { color: '#6b7280', bg: '#f9fafb', label: 'Low' },
      'medium': { color: '#2563eb', bg: '#eff6ff', label: 'Medium' },
      'high': { color: '#f59e0b', bg: '#fffbeb', label: 'High' },
      'urgent': { color: '#ef4444', bg: '#fef2f2', label: 'Urgent' },
    };
    const priority = priorityConfig[data.priority || 'medium'];
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${priority.color} 0%, ${priority.color}dd 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ffffffcc; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">New Notice: ${data.noticeTitle}</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <div style="background: ${priority.bg}; padding: 12px 16px; border-radius: 6px; margin: 16px 0; display: inline-block;">
            <span style="color: ${priority.color}; font-size: 12px; font-weight: bold; text-transform: uppercase;">Priority: ${priority.label}</span>
          </div>
          <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${priority.color};">
            <p style="color: #1f2937; font-size: 16px; margin: 0 0 16px; font-weight: bold;">${data.noticeTitle}</p>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">${data.noticeContent}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            ${data.issuedBy ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Issued By:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.issuedBy}</td></tr>` : ''}
            ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            ${data.expiryDate ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Valid Until:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.expiryDate}</td></tr>` : ''}
          </table>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, `Notice: ${data.noticeTitle} - Smart Tech`, html);
  }

  async sendCalendarEventReminder(to: string, data: {
    recipientName: string;
    eventTitle: string;
    eventDescription?: string;
    eventDate: string;
    eventTime?: string;
    location?: string;
    organizer?: string;
    schoolName?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ede9fe; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Event Reminder</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">This is a reminder for the upcoming event:</p>
          <div style="background: #f5f3ff; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #8b5cf6;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Event:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.eventTitle}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.eventDate}</td></tr>
              ${data.eventTime ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Time:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.eventTime}</td></tr>` : ''}
              ${data.location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Location:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.location}</td></tr>` : ''}
              ${data.organizer ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Organizer:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.organizer}</td></tr>` : ''}
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          ${data.eventDescription ? `<p style="color: #6b7280; font-size: 14px; font-style: italic;">${data.eventDescription}</p>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, `Event Reminder: ${data.eventTitle} - Smart Tech`, html);
  }

  async sendMaintenanceNotification(to: string, data: {
    recipientName: string;
    maintenanceType: string;
    startDate: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    description?: string;
    impact?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ffedd5; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">System Maintenance Notification</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">We will be performing scheduled maintenance on our system:</p>
          <div style="background: #fff7ed; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f97316;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;"><strong>Type:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.maintenanceType}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Start Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.startDate}</td></tr>
              ${data.startTime ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Start Time:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.startTime}</td></tr>` : ''}
              ${data.endDate ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>End Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.endDate}</td></tr>` : ''}
              ${data.endTime ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>End Time:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.endTime}</td></tr>` : ''}
              ${data.impact ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Impact:</strong></td><td style="padding: 8px 0; color: #f97316; font-size: 14px; font-weight: bold;">${data.impact}</td></tr>` : ''}
            </table>
          </div>
          ${data.description ? `<p style="color: #6b7280; font-size: 14px;">${data.description}</p>` : ''}
          <p style="color: #6b7280; font-size: 14px;">We apologize for any inconvenience this may cause.</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'System Maintenance - Smart Tech', html);
  }

  async sendBulkImportResult(to: string, data: {
    recipientName: string;
    importType: string;
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
    errors?: string[];
    importDate: string;
  }) {
    const successRate = Math.round((data.successfulRecords / data.totalRecords) * 100);
    const statusColor = successRate >= 90 ? '#059669' : successRate >= 70 ? '#f59e0b' : '#ef4444';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ffffffcc; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Bulk Import Results</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">Your bulk import of <strong>${data.importType}</strong> has been completed:</p>
          <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${statusColor};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;"><strong>Total Records:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.totalRecords}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Successful:</strong></td><td style="padding: 8px 0; color: #059669; font-size: 14px; font-weight: bold;">${data.successfulRecords}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Failed:</strong></td><td style="padding: 8px 0; color: #ef4444; font-size: 14px; font-weight: bold;">${data.failedRecords}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Success Rate:</strong></td><td style="padding: 8px 0; color: ${statusColor}; font-size: 14px; font-weight: bold;">${successRate}%</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Import Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.importDate}</td></tr>
            </table>
          </div>
          ${data.errors && data.errors.length > 0 ? `
            <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="color: #991b1b; font-size: 14px; font-weight: bold; margin: 0 0 8px;">Errors Encountered:</p>
              <ul style="color: #991b1b; font-size: 13px; margin: 0; padding-left: 20px;">
                ${data.errors.slice(0, 10).map(error => `<li>${error}</li>`).join('')}
                ${data.errors.length > 10 ? `<li>...and ${data.errors.length - 10} more errors</li>` : ''}
              </ul>
            </div>
          ` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Bulk Import Results - Smart Tech', html);
  }

  async sendReportCardReady(to: string, data: {
    recipientName: string;
    studentName: string;
    term: string;
    academicYear: string;
    schoolName?: string;
    downloadUrl?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #d1fae5; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Report Card Ready</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">The report card for <strong>${data.studentName}</strong> is now available:</p>
          <div style="background: #ecfdf5; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #059669;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;"><strong>Student:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.studentName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Term:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.term}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Academic Year:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.academicYear}</td></tr>
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          ${data.downloadUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${data.downloadUrl}" style="background: #059669; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Download Report Card</a></div>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Report Card Ready - Smart Tech', html);
  }

  async sendTimetableChangeNotification(to: string, data: {
    recipientName: string;
    studentName?: string;
    className: string;
    changeType: 'new' | 'modified' | 'cancelled';
    subject?: string;
    teacherName?: string;
    dayOfWeek?: string;
    timeSlot?: string;
    effectiveDate: string;
    schoolName?: string;
  }) {
    const changeConfig = {
      'new': { color: '#059669', bg: '#ecfdf5', label: 'New Class Added', subject: 'New Timetable Entry - Smart Tech' },
      'modified': { color: '#f59e0b', bg: '#fffbeb', label: 'Schedule Changed', subject: 'Timetable Change - Smart Tech' },
      'cancelled': { color: '#ef4444', bg: '#fef2f2', label: 'Class Cancelled', subject: 'Class Cancelled - Smart Tech' },
    };
    const config = changeConfig[data.changeType];
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #ffffffcc; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Timetable Update</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},${data.studentName ? `</p><p style="color: #6b7280; font-size: 16px;">There has been a change to the timetable for <strong>${data.studentName}</strong>:</p>` : '</p><p style="color: #6b7280; font-size: 16px;">There has been a change to the timetable:</p>'}
          <div style="background: ${config.bg}; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid ${config.color};">
            <div style="display: inline-block; background: ${config.color}; color: #ffffff; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 16px;">${config.label}</div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Class:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.className}</td></tr>
              ${data.subject ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Subject:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.subject}</td></tr>` : ''}
              ${data.teacherName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Teacher:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.teacherName}</td></tr>` : ''}
              ${data.dayOfWeek ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Day:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.dayOfWeek}</td></tr>` : ''}
              ${data.timeSlot ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Time:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.timeSlot}</td></tr>` : ''}
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Effective:</strong></td><td style="padding: 8px 0; color: ${config.color}; font-size: 14px; font-weight: bold;">${data.effectiveDate}</td></tr>
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, config.subject, html);
  }

  async sendAccountDeactivationWarning(to: string, data: {
    recipientName: string;
    accountType: string;
    daysUntilDeactivation: number;
    reason?: string;
    loginUrl?: string;
    supportEmail?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #fecaca; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Account Deactivation Warning</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">Your <strong>${data.accountType}</strong> account will be deactivated in <strong style="color: #ef4444;">${data.daysUntilDeactivation} days</strong>.</p>
          <div style="background: #fef2f2; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #ef4444;">
            ${data.reason ? `<p style="color: #991b1b; font-size: 14px; margin: 0 0 12px;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
            <p style="color: #991b1b; font-size: 14px; margin: 0;">Please log in to your account before this date to prevent deactivation.</p>
          </div>
          ${data.loginUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${data.loginUrl}" style="background: #ef4444; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Login Now</a></div>` : ''}
          ${data.supportEmail ? `<p style="color: #6b7280; font-size: 14px; margin-top: 24px;">If you have any questions, please contact us at <a href="mailto:${data.supportEmail}" style="color: #2563eb;">${data.supportEmail}</a></p>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Account Deactivation Warning - Smart Tech', html);
  }

  async sendExamResultPublished(to: string, data: {
    recipientName: string;
    studentName: string;
    examName: string;
    term: string;
    totalSubjects?: number;
    overallGrade?: string;
    schoolName?: string;
    viewUrl?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #d1fae5; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Exam Results Published</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">The exam results for <strong>${data.studentName}</strong> have been published:</p>
          <div style="background: #ecfdf5; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #10b981;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;"><strong>Student:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.studentName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Exam:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.examName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Term:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.term}</td></tr>
              ${data.totalSubjects ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Subjects:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.totalSubjects}</td></tr>` : ''}
              ${data.overallGrade ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Overall Grade:</strong></td><td style="padding: 8px 0; color: #059669; font-size: 14px; font-weight: bold;">${data.overallGrade}</td></tr>` : ''}
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          ${data.viewUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${data.viewUrl}" style="background: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Results</a></div>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Exam Results Published - Smart Tech', html);
  }

  async sendParentTeacherMeetingInvite(to: string, data: {
    recipientName: string;
    studentName: string;
    meetingDate: string;
    meetingTime: string;
    location?: string;
    teacherName?: string;
    agenda?: string;
    schoolName?: string;
    rsvpUrl?: string;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smart Tech</h1>
          <p style="color: #e0e7ff; margin: 10px 0 0;">Education Management System</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #1f2937; margin-top: 0;">Parent-Teacher Meeting Invitation</h2>
          <p style="color: #6b7280; font-size: 16px;">Hello ${data.recipientName},</p>
          <p style="color: #6b7280; font-size: 16px;">You are invited to a parent-teacher meeting for <strong>${data.studentName}</strong>:</p>
          <div style="background: #eef2ff; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #6366f1;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;"><strong>Student:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: bold;">${data.studentName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Date:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.meetingDate}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Time:</strong></td><td style="padding: 8px 0; color: #6366f1; font-size: 14px; font-weight: bold;">${data.meetingTime}</td></tr>
              ${data.location ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Location:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.location}</td></tr>` : ''}
              ${data.teacherName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Teacher:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.teacherName}</td></tr>` : ''}
              ${data.schoolName ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>School:</strong></td><td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${data.schoolName}</td></tr>` : ''}
            </table>
          </div>
          ${data.agenda ? `<p style="color: #6b7280; font-size: 14px;"><strong>Agenda:</strong> ${data.agenda}</p>` : ''}
          ${data.rsvpUrl ? `<div style="text-align: center; margin: 24px 0;"><a href="${data.rsvpUrl}" style="background: #6366f1; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">RSVP Now</a></div>` : ''}
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Smart Tech. All rights reserved.</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Parent-Teacher Meeting Invitation - Smart Tech', html);
  }
}
