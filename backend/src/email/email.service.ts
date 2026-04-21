import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: 'noreply@smarttechsaas.com',
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  async sendMail(to: string, subject: string, html: string) {
    return this.transporter.sendMail({
      from: '"Smart Tech" <noreply@smarttechsaas.com>',
      to,
      subject,
      html,
    });
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
}
