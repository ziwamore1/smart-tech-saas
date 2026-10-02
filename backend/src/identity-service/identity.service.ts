import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordGenerationService } from './password-generation.service';
import { UsernameGenerationService } from './username-generation.service';
import { CredentialDeliveryService, DeliveryOptions } from './credential-delivery.service';
import { OtpService } from './otp.service';
import { AccountRecoveryService } from './account-recovery.service';
import { SessionManagementService } from './session-management.service';
import { SecurityAuditService } from './security-audit.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { normalizeZambianPhone, validateZambianPhone } from '../common/utils/phone.util';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private prisma: PrismaService,
    private passwordGenService: PasswordGenerationService,
    private usernameGenService: UsernameGenerationService,
    private credentialDeliveryService: CredentialDeliveryService,
    private otpService: OtpService,
    private accountRecoveryService: AccountRecoveryService,
    private sessionManagementService: SessionManagementService,
    private securityAuditService: SecurityAuditService,
  ) {}

  async getPasswordHubData(adminId: string, schoolId?: string, filters?: {
    role?: string; search?: string; accountStatus?: string; schoolId?: string;
  }) {
    const effectiveSchoolId = schoolId || filters?.schoolId || null;

    const where: any = {};
    if (effectiveSchoolId) {
      where.OR = [
        { schoolId: effectiveSchoolId },
        { schoolUsers: { some: { schoolId: effectiveSchoolId } } },
      ];
    }
    if (filters?.role) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { userRoles: { some: { role: { name: filters.role } } } },
          { schoolUsers: { some: { SchoolRoleAssignment: { some: { role: filters.role, isActive: true } } } } },
          { platformRoleAssignments: { some: { role: filters.role, isActive: true } } },
        ],
      });
    }
    if (filters?.accountStatus) where.accountStatus = filters.accountStatus;
    if (filters?.search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { username: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        userRoles: { include: { role: true } },
        schoolUsers: {
          where: effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined,
          include: {
            SchoolRoleAssignment: { where: { isActive: true }, select: { role: true } },
          },
        },
        userCredentials: { orderBy: { generatedAt: 'desc' }, take: 1 },
        credentialDeliveries: { orderBy: { createdAt: 'desc' }, take: 1 },
        loginSessions: { where: { isActive: true }, select: { id: true, lastActivity: true, deviceType: true } },
        deviceSessions: { where: { isActive: true }, select: { id: true, deviceName: true, lastUsedAt: true, deviceType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parentRecords = await this.prisma.parent.findMany({
      where: effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined,
      include: {
        credentialDeliveries: { orderBy: { createdAt: 'desc' }, take: 1 },
        children: {
          include: {
            student: { include: { user: { select: { id: true, username: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const parentsByUserId = new Map(parentRecords.filter(parent => parent.userId).map(parent => [parent.userId!, parent]));
    const parentsByEmail = new Map(parentRecords.map(parent => [parent.email.trim().toLowerCase(), parent]));
    const usersByEmail = new Set(users.map(user => user.email.trim().toLowerCase()));
    const isParentRole = (roles: string[]) => roles.some(role => role.toLowerCase().replace(/[^a-z]/g, '') === 'parent');

    const mappedUsers = users.map(user => {
      const legacyRoles = user.userRoles.map(ur => ur.role.name);
      const schoolRoles = (user.schoolUsers || []).flatMap(su =>
        su.SchoolRoleAssignment.map(sra => sra.role)
      );
      const allRoles = [...new Set([...legacyRoles, ...schoolRoles])];
      const roles = allRoles.length > 0 ? allRoles : legacyRoles;
      const parent = isParentRole(roles) ? parentsByUserId.get(user.id) || parentsByEmail.get(user.email.trim().toLowerCase()) : undefined;
      const phone = parent?.phone || user.phone;
      const phoneCheck = validateZambianPhone(phone);

      return {
        id: user.id,
        schoolId: user.schoolId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone,
        username: user.username,
        roles,
        accountStatus: user.accountStatus,
        mustChangePassword: user.mustChangePassword,
        mfaEnabled: user.mfaEnabled,
        failedAttempts: user.failedAttempts,
        lastLogin: user.lastLogin,
        lastPasswordChange: user.lastPasswordChange,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastCredential: user.userCredentials[0] || null,
        lastDelivery: user.credentialDeliveries[0] || null,
        parentRecordId: parent?.id || null,
        parentPhoneStatus: isParentRole(roles) ? (parent ? phoneCheck.status : 'UNLINKED') : undefined,
        parentPhoneGuidance: isParentRole(roles)
          ? parent
            ? (phoneCheck.status !== 'VALID' ? phoneCheck.reason : undefined)
            : 'This Parent login is not linked to a parent record and children. Link it in the Staff/Parent records before sending credentials.'
          : undefined,
        phoneCorrectionRequestedAt: parent?.phoneCorrectionRequestedAt || null,
        credentialDeliveryStatus: parent?.credentialDeliveryStatus || null,
        credentialDeliveryError: parent?.credentialDeliveryError || null,
        parentDeliveryHistory: parent?.credentialDeliveries || [],
        linkedChildren: parent?.children.map(link => ({
          id: link.student.id,
          firstName: link.student.firstName,
          lastName: link.student.lastName,
          admissionNumber: link.student.admissionNumber,
          username: link.student.user?.username || null,
          userId: link.student.user?.id || null,
        })) || [],
        activeSessions: user.loginSessions.length,
        activeDevices: user.deviceSessions.length,
      };
    });

    const parentOnly = parentRecords
      .filter(parent => !parent.userId && !usersByEmail.has(parent.email.trim().toLowerCase()))
      .filter(parent => !filters?.role || filters.role === 'Parent')
      .filter(parent => !filters?.accountStatus || filters.accountStatus === 'ACTIVE')
      .filter(parent => !filters?.search || `${parent.firstName} ${parent.lastName} ${parent.email} ${parent.phone || ''}`.toLowerCase().includes(filters.search.toLowerCase()))
      .map(parent => {
        const phoneCheck = validateZambianPhone(parent.phone);
        return {
          id: `parent:${parent.id}`,
          schoolId: parent.schoolId,
          parentRecordId: parent.id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          email: parent.email.endsWith('@internal.smarttech.edu') ? null : parent.email,
          username: null,
          phone: parent.phone,
          roles: ['Parent'],
          accountStatus: 'ACTIVE',
          mustChangePassword: true,
          mfaEnabled: false,
          failedAttempts: 0,
          lastLogin: null,
          lastPasswordChange: null,
          isActive: true,
          createdAt: parent.createdAt,
          lastCredential: null,
          lastDelivery: null,
          parentPhoneStatus: phoneCheck.status,
          parentPhoneGuidance: phoneCheck.status !== 'VALID' ? phoneCheck.reason : undefined,
          phoneCorrectionRequestedAt: parent.phoneCorrectionRequestedAt,
          credentialDeliveryStatus: parent.credentialDeliveryStatus,
          credentialDeliveryError: parent.credentialDeliveryError,
          parentDeliveryHistory: parent.credentialDeliveries,
          linkedChildren: parent.children.map(link => ({
            id: link.student.id,
            firstName: link.student.firstName,
            lastName: link.student.lastName,
            admissionNumber: link.student.admissionNumber,
            username: link.student.user?.username || null,
            userId: link.student.user?.id || null,
          })),
          activeSessions: 0,
          activeDevices: 0,
        };
      });

    return [...mappedUsers, ...parentOnly];
  }

  async generateAndDeliverCredentials(
    userId: string,
    adminId: string,
    channel: 'SMS' | 'EMAIL' | 'WHATSAPP' = 'EMAIL',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('User not found');

    const role = user.userRoles[0]?.role?.name || 'User';
    const normalizedRole = role.toLowerCase();
    if (user.studentId || normalizedRole === 'student') return this.deliverStudentCredentialsToParents(userId, adminId);
    const parentRecord = await this.prisma.parent.findFirst({
      where: { OR: [{ userId }, { email: user.email }], ...(user.schoolId ? { schoolId: user.schoolId } : {}) },
      select: { id: true },
    });
    if (normalizedRole === 'parent' || parentRecord) {
      if (!parentRecord) throw new BadRequestException('This parent login is not linked to a parent record. Link it to the parent and children before sending credentials.');
      return this.deliverParentCredentialsBySms(parentRecord.id, adminId, user.schoolId || undefined);
    }
    if (channel === 'SMS' && !normalizeZambianPhone(user.phone)) {
      const reason = 'The account has no valid mobile number. Update the phone number before sending SMS credentials. No SMS was sent.';
      await this.prisma.credentialDeliveryLog.create({
        data: { userId, channel: 'SMS', recipient: user.phone || 'MISSING', status: 'BLOCKED_INVALID_PHONE', errorMessage: reason },
      });
      return { success: false, blocked: true, deliveryStatus: 'BLOCKED_INVALID_PHONE', error: reason };
    }
    const generatedPassword = this.passwordGenService.generateRoleBasedPassword(role);
    const username = user.username || this.usernameGenService.generateUsername(
      user.firstName, user.lastName, role, user.schoolId,
    );

    if (!user.username) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { username },
      });
    }

    const credential = await this.prisma.userCredential.create({
      data: {
        userId,
        generatedUsername: username,
        generatedPasswordHash: generatedPassword.hash,
        deliveryChannel: channel,
        deliveryStatus: 'PENDING',
        generatedById: adminId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const hashedPassword = await bcrypt.hash(generatedPassword.password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    const school = user.schoolId ? await this.prisma.school.findUnique({ where: { id: user.schoolId } }) : null;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const schoolUrl = school ? `${frontendUrl}/login?school=${school.id}` : `${frontendUrl}/login`;

    let recipientEmail = user.email || undefined;
    let recipientName = `${user.firstName} ${user.lastName}`;

    let studentId = user.studentId;
    if (studentId) {
      let parentStudent = await this.prisma.parentStudent.findFirst({
        where: { studentId },
        include: { parent: true },
      });
      if (!parentStudent) {
        const student = await this.prisma.student.findUnique({
          where: { id: studentId },
          include: { parents: { include: { parent: true } } },
        });
        if (student?.parents?.length) {
          parentStudent = student.parents[0] as any;
        }
      }
      if (parentStudent?.parent?.email) {
        recipientEmail = parentStudent.parent.email;
        recipientName = `${parentStudent.parent.firstName} ${parentStudent.parent.lastName}`;
      }
    } else {
      // studentId is null — try to find student by matching name/school
      const matchingStudent = await this.prisma.student.findFirst({
        where: { firstName: user.firstName, lastName: user.lastName, schoolId: user.schoolId || undefined },
        include: { parents: { include: { parent: true } } },
      });
      if (matchingStudent?.parents?.length && matchingStudent.parents[0].parent.email) {
        recipientEmail = matchingStudent.parents[0].parent.email;
        recipientName = `${matchingStudent.parents[0].parent.firstName} ${matchingStudent.parents[0].parent.lastName}`;
      }
    }

    const deliveryResult = await this.credentialDeliveryService.deliverCredentials({
      userId,
      userCredentialId: credential.id,
      recipientEmail,
      recipientPhone: user.phone || undefined,
      username,
      password: generatedPassword.password,
      recipientName,
      role,
      schoolName: school?.name,
      schoolUrl,
      channel,
      email: user.email || undefined,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: true },
    });

    await this.securityAuditService.log({
      userId,
      action: 'CREDENTIALS_GENERATED',
      details: `Credentials generated and delivered via ${channel} by admin ${adminId}`,
    });

    return {
      success: deliveryResult.success,
      credentialId: credential.id,
      username,
      deliveryChannel: channel,
      deliveryStatus: deliveryResult.success ? 'DELIVERED' : 'FAILED',
      error: deliveryResult.error,
      requiresPasswordChange: true,
    };
  }

  async requestParentPhoneCorrection(parentId: string, requestedById: string, schoolId?: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, ...(schoolId ? { schoolId } : {}) },
    });
    if (!parent) throw new NotFoundException('Parent record not found');
    const phoneCheck = validateZambianPhone(parent.phone);
    const guidance = phoneCheck.status === 'MISSING'
      ? 'No phone is recorded. Ask the linked child to bring a correct parent/guardian mobile number to the school office.'
      : 'The recorded phone number is not valid. Ask the linked child to bring the correct parent/guardian mobile number to the school office.';
    await this.prisma.parent.update({
      where: { id: parentId },
      data: {
        phoneStatus: phoneCheck.status,
        phoneStatusReason: guidance,
        phoneValidatedAt: new Date(),
        phoneCorrectionRequestedAt: new Date(),
        phoneCorrectionRequestedById: requestedById,
      },
    });
    await this.prisma.parentCredentialDelivery.create({
      data: {
        parentId,
        requestedById: await this.getCredentialActorUserId(requestedById),
        recipientPhone: parent.phone,
        status: 'PHONE_CORRECTION_REQUESTED',
        errorMessage: guidance,
        childCount: await this.prisma.parentStudent.count({ where: { parentId } }),
      },
    });
    return { success: true, parentId, phoneStatus: phoneCheck.status, correctionRequestedAt: new Date(), guidance };
  }

  async deliverParentCredentialsForStudent(studentId: string, requestedById: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, parents: { include: { parent: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    const parents = student.parents.map(link => link.parent);
    if (!parents.length) {
      return { success: false, blocked: true, deliveryStatus: 'NO_LINKED_PARENT', guidance: 'No parent is linked to this student. Link a parent with a valid mobile number before generating student credentials.' };
    }

    const validParents = parents.filter(parent => normalizeZambianPhone(parent.phone));
    const blockedParents = parents.filter(parent => !normalizeZambianPhone(parent.phone));
    for (const parent of blockedParents) {
      await this.recordParentPhoneIssue(parent, requestedById, 'BLOCKED_INVALID_PHONE', 'Student credentials were not sent because this parent has no valid mobile number. Ask the linked child to provide a correct number.');
    }
    if (!validParents.length) {
      return { success: false, blocked: true, deliveryStatus: 'BLOCKED_INVALID_PHONE', blockedParents: blockedParents.length, guidance: 'No student credentials were changed or sent. Request a valid parent/guardian phone number through the linked child.' };
    }

    const generated = this.passwordGenService.generateRoleBasedPassword('Student');
    const username = student.user?.username || this.usernameGenService.generateUsername(student.firstName, student.lastName, 'Student', student.schoolId);
    const passwordHash = await bcrypt.hash(generated.password, 10);
    const studentUser = student.user
      ? await this.prisma.user.update({ where: { id: student.user.id }, data: { username, password: passwordHash, mustChangePassword: true, lastPasswordChange: new Date() } })
      : await this.prisma.user.create({
          data: {
            firstName: student.firstName,
            lastName: student.lastName,
            email: `${username}@student.smarttech.edu`,
            username,
            password: passwordHash,
            schoolId: student.schoolId,
            studentId: student.id,
            mustChangePassword: true,
          },
        });
    await this.ensureUserRole(studentUser.id, 'Student');
    const generatedById = await this.getCredentialActorUserId(requestedById) || studentUser.id;
    const credential = await this.prisma.userCredential.create({
      data: { userId: studentUser.id, generatedUsername: username, generatedPasswordHash: generated.hash, deliveryChannel: 'SMS', deliveryStatus: 'PENDING', generatedById, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    const school = await this.prisma.school.findUnique({ where: { id: student.schoolId }, select: { name: true } });
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?school=${student.schoolId}`;
    const message = `Smart Tech${school?.name ? ` - ${school.name}` : ''}. Student: ${student.firstName} ${student.lastName}${student.admissionNumber ? ` (${student.admissionNumber})` : ''}. Username: ${username}. Password: ${generated.password}. Login: ${loginUrl}. Change the password after first login. Keep these credentials private.`;
    const deliveryResults = [];
    for (const parent of validParents) {
      const phone = normalizeZambianPhone(parent.phone)!;
      const parentUser = await this.ensureParentUser(parent);
      const sendResult = await this.credentialDeliveryService.sendSmsMessage(phone, message);
      const status = sendResult.success ? 'STUDENT_CREDENTIALS_DELIVERED' : 'STUDENT_CREDENTIALS_FAILED';
      const errorMessage = sendResult.error || null;
      await this.prisma.parentCredentialDelivery.create({
        data: { parentId: parent.id, requestedById: await this.getCredentialActorUserId(requestedById), recipientPhone: phone, status, errorMessage, messageId: sendResult.messageId, childCount: 1, deliveredAt: sendResult.success ? new Date() : undefined },
      });
      await this.prisma.parent.update({
        where: { id: parent.id },
        data: { userId: parentUser.id, phone, phoneStatus: 'VALID', phoneStatusReason: null, phoneValidatedAt: new Date(), credentialDeliveryStatus: sendResult.success ? 'DELIVERED' : 'FAILED', credentialDeliveryError: errorMessage, credentialDeliveryUpdatedAt: new Date() },
      });
      await this.prisma.credentialDeliveryLog.create({
        data: { userId: studentUser.id, userCredentialId: credential.id, channel: 'SMS', recipient: phone, status: sendResult.success ? 'DELIVERED' : 'FAILED', messageId: sendResult.messageId, errorMessage: errorMessage || undefined, deliveredAt: sendResult.success ? new Date() : undefined },
      });
      deliveryResults.push({ parentId: parent.id, success: sendResult.success, error: sendResult.error });
    }
    const deliveredCount = deliveryResults.filter(result => result.success).length;
    await this.prisma.userCredential.update({ where: { id: credential.id }, data: { deliveryStatus: deliveredCount ? 'DELIVERED' : 'FAILED', deliveredAt: deliveredCount ? new Date() : undefined } });
    return {
      success: deliveredCount > 0,
      deliveryStatus: deliveredCount ? 'DELIVERED' : 'FAILED',
      deliveredToParents: deliveredCount,
      blockedParents: blockedParents.length,
      guidance: deliveredCount ? 'Student credentials were sent only to linked parents with validated mobile numbers.' : 'No SMS provider delivered the credentials. Review Password Hub delivery records before retrying.',
      results: deliveryResults,
    };
  }

  private async recordParentPhoneIssue(parent: any, requestedById: string, status: string, reason: string) {
    const phoneCheck = validateZambianPhone(parent.phone);
    await this.prisma.parent.update({
      where: { id: parent.id },
      data: { phoneStatus: phoneCheck.status, phoneStatusReason: reason, phoneValidatedAt: new Date(), credentialDeliveryStatus: status, credentialDeliveryError: reason, credentialDeliveryUpdatedAt: new Date() },
    });
    await this.prisma.parentCredentialDelivery.create({
      data: { parentId: parent.id, requestedById: await this.getCredentialActorUserId(requestedById), recipientPhone: parent.phone, status, errorMessage: reason },
    });
  }

  async deliverParentCredentialsBySms(parentId: string, requestedById: string, schoolId?: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, ...(schoolId ? { schoolId } : {}) },
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
        children: { include: { student: { include: { user: true } } } },
      },
    });
    if (!parent) throw new NotFoundException('Parent record not found');

    const phoneCheck = validateZambianPhone(parent.phone || parent.user?.phone);
    if (!phoneCheck.normalized) {
      const guidance = phoneCheck.status === 'MISSING'
        ? 'No SMS was sent because the parent has no phone number. Request a correct mobile number through the linked child.'
        : 'No SMS was sent because the parent phone number is invalid. Request the correct mobile number through the linked child.';
      await this.prisma.parent.update({ where: { id: parent.id }, data: { phoneStatus: phoneCheck.status, phoneStatusReason: guidance, phoneValidatedAt: new Date(), credentialDeliveryStatus: 'BLOCKED_INVALID_PHONE', credentialDeliveryError: guidance, credentialDeliveryUpdatedAt: new Date() } });
      await this.prisma.parentCredentialDelivery.create({
        data: { parentId, requestedById: await this.getCredentialActorUserId(requestedById), recipientPhone: parent.phone, status: 'BLOCKED_INVALID_PHONE', errorMessage: guidance, childCount: parent.children.length },
      });
      return { success: false, blocked: true, deliveryStatus: 'BLOCKED_INVALID_PHONE', parentId, phoneStatus: phoneCheck.status, guidance };
    }

    const parentUser = await this.ensureParentUser(parent);
    const generatorId = await this.getCredentialActorUserId(requestedById) || parentUser.id;
    const parentGenerated = this.passwordGenService.generateRoleBasedPassword('Parent');
    const parentUsername = parentUser.username || this.usernameGenService.generateUsername(parent.firstName, parent.lastName, 'Parent', parent.schoolId);
    const parentHash = await bcrypt.hash(parentGenerated.password, 10);
    const parentUpdated = await this.prisma.user.update({
      where: { id: parentUser.id },
      data: { username: parentUsername, phone: phoneCheck.normalized, password: parentHash, mustChangePassword: true, lastPasswordChange: new Date() },
    });
    await this.prisma.parent.update({
      where: { id: parent.id },
      data: { userId: parentUser.id, phone: phoneCheck.normalized, password: parentHash, phoneStatus: 'VALID', phoneStatusReason: null, phoneValidatedAt: new Date(), credentialDeliveryStatus: 'PENDING', credentialDeliveryError: null, credentialDeliveryUpdatedAt: new Date() },
    });

    const generatedChildren: Array<{ student: any; user: any; username: string; password: string; credentialId: string }> = [];
    for (const link of parent.children) {
      const student = link.student;
      const generated = this.passwordGenService.generateRoleBasedPassword('Student');
      const username = student.user?.username || this.usernameGenService.generateUsername(student.firstName, student.lastName, 'Student', parent.schoolId);
      const hash = await bcrypt.hash(generated.password, 10);
      const childUser = student.user
        ? await this.prisma.user.update({ where: { id: student.user.id }, data: { username, password: hash, mustChangePassword: true, lastPasswordChange: new Date() } })
        : await this.prisma.user.create({
            data: {
              firstName: student.firstName,
              lastName: student.lastName,
              email: `${username}@student.smarttech.edu`,
              username,
              password: hash,
              schoolId: parent.schoolId,
              studentId: student.id,
              mustChangePassword: true,
            },
          });
      await this.ensureUserRole(childUser.id, 'Student');
      const childCredential = await this.prisma.userCredential.create({
        data: { userId: childUser.id, generatedUsername: username, generatedPasswordHash: generated.hash, deliveryChannel: 'SMS', deliveryStatus: 'PENDING', generatedById: generatorId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
      generatedChildren.push({ student, user: childUser, username, password: generated.password, credentialId: childCredential.id });
    }

    const parentCredential = await this.prisma.userCredential.create({
      data: { userId: parentUpdated.id, generatedUsername: parentUsername, generatedPasswordHash: parentGenerated.hash, deliveryChannel: 'SMS', deliveryStatus: 'PENDING', generatedById: generatorId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    const school = await this.prisma.school.findUnique({ where: { id: parent.schoolId }, select: { name: true } });
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?school=${parent.schoolId}`;
    const childCredentialLines = generatedChildren.length
      ? generatedChildren.map(({ student, username, password }) => `Child ${student.firstName} ${student.lastName}${student.admissionNumber ? ` (${student.admissionNumber})` : ''}: ${username} / ${password}`).join('\n')
      : 'No children are currently linked to this parent account.';
    const message = [
      `Smart Tech${school?.name ? ` - ${school.name}` : ''}`,
      `Parent: ${parent.firstName} ${parent.lastName}`,
      `Parent login: ${parentUsername} / ${parentGenerated.password}`,
      childCredentialLines,
      `Login: ${loginUrl}`,
      'Change each password after first login. Keep this message private.',
    ].join('\n');
    const delivered = await this.credentialDeliveryService.sendParentBundleSms({
      parentUserId: parentUpdated.id,
      parentId: parent.id,
      requestedById: await this.getCredentialActorUserId(requestedById),
      to: phoneCheck.normalized,
      message,
      childCount: generatedChildren.length,
      parentCredentialId: parentCredential.id,
    });
    const deliveryStatus = delivered.success ? 'DELIVERED' : 'FAILED';
    await this.prisma.userCredential.updateMany({ where: { id: { in: [parentCredential.id, ...generatedChildren.map(child => child.credentialId)] } }, data: { deliveryStatus, ...(delivered.success ? { deliveredAt: new Date() } : {}) } });
    for (const child of generatedChildren) {
      await this.prisma.credentialDeliveryLog.create({
        data: { userId: child.user.id, userCredentialId: child.credentialId, channel: 'SMS', recipient: phoneCheck.normalized, status: deliveryStatus, messageId: delivered.messageId, errorMessage: delivered.error },
      });
    }
    await this.securityAuditService.log({ userId: parentUpdated.id, action: 'PARENT_BUNDLED_CREDENTIALS_SENT', details: `Parent and ${generatedChildren.length} linked child credential(s) ${deliveryStatus.toLowerCase()} by ${requestedById}` });
    return {
      success: delivered.success,
      parentId: parent.id,
      deliveryStatus,
      phoneStatus: 'VALID',
      childCount: generatedChildren.length,
      messageId: delivered.messageId,
      error: delivered.error,
      guidance: delivered.success ? 'Parent and linked child login credentials were sent by SMS to the validated parent phone.' : 'Credentials were prepared but SMS delivery failed. Check the delivery record before retrying.',
    };
  }

  async deliverStudentCredentialsToParents(studentUserId: string, requestedById: string) {
    const user = await this.prisma.user.findUnique({ where: { id: studentUserId }, include: { student: { include: { parents: { include: { parent: true } } } } } });
    if (!user?.student) throw new NotFoundException('Student user account is not linked to a student record');
    return this.deliverParentCredentialsForStudent(user.student.id, requestedById);
  }

  private async ensureParentUser(parent: any) {
    let user = parent.user || await this.prisma.user.findFirst({ where: { email: parent.email } });
    if (!user) {
      const username = this.usernameGenService.generateUsername(parent.firstName, parent.lastName, 'Parent', parent.schoolId);
      user = await this.prisma.user.create({
        data: { firstName: parent.firstName, lastName: parent.lastName, email: parent.email, username, phone: parent.phone, password: parent.password, schoolId: parent.schoolId, mustChangePassword: true },
      });
    }
    if (parent.userId !== user.id) await this.prisma.parent.update({ where: { id: parent.id }, data: { userId: user.id } });
    await this.ensureUserRole(user.id, 'Parent');
    return user;
  }

  private async ensureUserRole(userId: string, roleName: string) {
    const role = await this.prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`${roleName} role is not configured`);
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  private async getCredentialActorUserId(actorId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { id: true } });
    return actor?.id || null;
  }

  async bulkGenerateCredentials(
    userIds: string[],
    adminId: string,
    channel: 'SMS' | 'EMAIL' | 'WHATSAPP' = 'EMAIL',
  ) {
    const results = [];
    for (const userId of userIds) {
      try {
        const result = await this.generateAndDeliverCredentials(userId, adminId, channel);
        results.push({ userId, success: true, ...result });
      } catch (error: any) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    return { total: userIds.length, succeeded: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
  }

  async resendCredentials(userId: string, adminId: string, channel: 'SMS' | 'EMAIL' | 'WHATSAPP') {
    return this.generateAndDeliverCredentials(userId, adminId, channel);
  }

  async resetPassword(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('User not found');

    const role = user.userRoles[0]?.role?.name || 'User';
    if (user.studentId || role.toLowerCase() === 'student') return this.deliverStudentCredentialsToParents(userId, adminId);
    if (role.toLowerCase() === 'parent') {
      const parent = await this.prisma.parent.findFirst({ where: { OR: [{ userId }, { email: user.email }], ...(user.schoolId ? { schoolId: user.schoolId } : {}) } });
      if (!parent) throw new BadRequestException('Parent account is not linked to a parent contact record.');
      return this.deliverParentCredentialsBySms(parent.id, adminId, user.schoolId || undefined);
    }
    const generatedPassword = this.passwordGenService.generateRoleBasedPassword(role);
    const hashedPassword = await bcrypt.hash(generatedPassword.password, 10);

    await this.prisma.$transaction([
      this.prisma.passwordHistory.create({
        data: { userId, passwordHash: user.password },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
          lastPasswordChange: new Date(),
        },
      }),
    ]);

    await this.securityAuditService.log({
      userId,
      action: 'PASSWORD_RESET_BY_ADMIN',
      details: `Password reset by admin ${adminId}`,
    });

    return { message: 'Password reset successfully', newPassword: generatedPassword.password };
  }

  async lockAccount(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'LOCKED' },
    });

    await this.sessionManagementService.invalidateAllUserSessions(userId);

    await this.securityAuditService.log({
      userId,
      action: 'ACCOUNT_LOCKED_BY_ADMIN',
      details: `Account locked by admin ${adminId}. Reason: ${reason || 'No reason provided'}`,
    });

    return { message: 'Account locked successfully' };
  }

  async unlockAccount(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: 'ACTIVE',
        failedAttempts: 0,
        lockoutUntil: null,
      },
    });

    await this.securityAuditService.log({
      userId,
      action: 'ACCOUNT_UNLOCKED_BY_ADMIN',
      details: `Account unlocked by admin ${adminId}. Reason: ${reason || 'No reason provided'}`,
    });

    return { message: 'Account unlocked successfully' };
  }

  async toggleMfa(userId: string, adminId: string, enable: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: enable },
    });

    await this.securityAuditService.log({
      userId,
      action: enable ? 'MFA_ENABLED' : 'MFA_DISABLED',
      details: `MFA ${enable ? 'enabled' : 'disabled'} by admin ${adminId}`,
    });

    return { message: `MFA ${enable ? 'enabled' : 'disabled'} successfully` };
  }

  async forceLogoutAllDevices(userId: string, adminId: string) {
    const count = await this.sessionManagementService.invalidateAllUserSessions(userId);

    await this.securityAuditService.log({
      userId,
      action: 'FORCE_LOGOUT_ALL',
      details: `All ${count} sessions invalidated by admin ${adminId}`,
    });

    return { message: `Logged out from ${count} device(s)` };
  }

  async getSecurityLogs(userId: string) {
    return this.securityAuditService.getSecuritySummary(userId);
  }

  async getAuditLogs(query: any) {
    return this.securityAuditService.getAuditLogs(query, { page: query.page || 1, limit: query.limit || 50 });
  }

  async getActiveSessions(userId: string) {
    return this.sessionManagementService.getActiveSessions(userId);
  }

  async getDevices(userId: string) {
    return this.prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async registerDevice(userId: string, data: any) {
    const existing = await this.prisma.deviceSession.findUnique({
      where: { userId_deviceId: { userId, deviceId: data.deviceId } },
    });

    if (existing) {
      return this.prisma.deviceSession.update({
        where: { id: existing.id },
        data: {
          deviceName: data.deviceName,
          deviceType: data.deviceType,
          platform: data.platform,
          os: data.os,
          browser: data.browser,
          pushToken: data.pushToken,
          lastUsedAt: new Date(),
        },
      });
    }

    return this.prisma.deviceSession.create({
      data: {
        userId,
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        deviceType: data.deviceType || 'UNKNOWN',
        platform: data.platform || 'WEB',
        os: data.os,
        browser: data.browser,
        pushToken: data.pushToken,
      },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    await this.prisma.deviceSession.deleteMany({
      where: { userId, deviceId },
    });

    await this.securityAuditService.log({
      userId,
      action: 'DEVICE_REMOVED',
      details: `Device ${deviceId} removed`,
    });

    return { message: 'Device removed successfully' };
  }

  async getDeliveryHistory(userId: string) {
    return this.prisma.credentialDeliveryLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getAccountCenterData(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        deviceSessions: { where: { isActive: true } },
        loginSessions: { where: { isActive: true } },
      },
    });

    if (!user) {
      const sysUser = await this.prisma.systemUser.findUnique({
        where: { id: userId },
      });

      if (!sysUser) throw new NotFoundException('User not found');

      return {
        profile: {
          id: sysUser.id,
          firstName: sysUser.fullName,
          lastName: '',
          email: sysUser.email,
          phone: sysUser.phone || '',
          username: sysUser.email,
          roles: ['SUPER_ADMIN'],
        },
        security: {
          accountStatus: 'ACTIVE',
          mustChangePassword: false,
          mfaEnabled: false,
          lastLogin: null,
          lastPasswordChange: null,
          failedAttempts: 0,
        },
        sessions: {
          activeSessions: 0,
          activeDevices: 0,
        },
      };
    }

    return {
      profile: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        roles: user.userRoles.map(ur => ur.role.name),
      },
      security: {
        accountStatus: user.accountStatus,
        mustChangePassword: user.mustChangePassword,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin,
        lastPasswordChange: user.lastPasswordChange,
        failedAttempts: user.failedAttempts,
      },
      sessions: {
        activeSessions: user.loginSessions.length,
        activeDevices: user.deviceSessions.length,
      },
    };
  }

  async updateProfile(userId: string, data: { email?: string; phone?: string; firstName?: string; lastName?: string }) {
    const updateData: any = {};
    const normalizedEmail = data.email === undefined ? undefined : data.email.trim().toLowerCase();
    if (normalizedEmail !== undefined && !normalizedEmail) throw new BadRequestException('Email address cannot be blank');
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail;
    if (data.phone !== undefined) updateData.phone = data.phone.trim() || null;
    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();

    const existingUser = await this.prisma.user.findUnique({ where: { id: userId } });

    if (existingUser) {
      const parent = await this.prisma.parent.findFirst({
        where: { OR: [{ userId }, { email: existingUser.email }] },
      });
      if (normalizedEmail) {
        const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Email already in use');
        }
        const existingParent = await this.prisma.parent.findUnique({ where: { email: normalizedEmail } });
        if (existingParent && existingParent.id !== parent?.id) throw new BadRequestException('Email already in use by a parent account');
      }

      const user = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({ where: { id: userId }, data: updateData });
        if (parent && (normalizedEmail !== undefined || data.phone !== undefined || data.firstName !== undefined || data.lastName !== undefined)) {
          const phoneCheck = data.phone === undefined ? null : validateZambianPhone(data.phone);
          await tx.parent.update({
            where: { id: parent.id },
            data: {
              ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
              ...(data.phone !== undefined ? {
                phone: data.phone.trim() || null,
                phoneStatus: phoneCheck!.status,
                phoneStatusReason: phoneCheck!.reason,
                phoneValidatedAt: new Date(),
              } : {}),
              ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
              ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
            },
          });
        }
        return updatedUser;
      });

      await this.securityAuditService.log({
        userId,
        action: 'PROFILE_UPDATED',
        details: 'Profile updated by user',
      });

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      };
    }

    const sysUser = await this.prisma.systemUser.findUnique({ where: { id: userId } });
    if (!sysUser) throw new NotFoundException('User not found');

    const sysUpdateData: any = {};
    if (normalizedEmail !== undefined) sysUpdateData.email = normalizedEmail;
    if (data.phone !== undefined) sysUpdateData.phone = data.phone.trim() || null;
    if (data.firstName) sysUpdateData.fullName = data.firstName + (data.lastName ? ` ${data.lastName}` : '');
    if (data.lastName && !data.firstName) {
      const current = sysUser;
      sysUpdateData.fullName = `${current.fullName} ${data.lastName}`;
    }

    if (normalizedEmail) {
      const existing = await this.prisma.systemUser.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Email already in use');
      }
    }

    const updated = await this.prisma.systemUser.update({
      where: { id: userId },
      data: sysUpdateData,
    });

    return {
      id: updated.id,
      firstName: updated.fullName,
      lastName: '',
      email: updated.email,
      phone: updated.phone || '',
    };
  }

  async setPassword(userId: string, newPassword: string) {
    const validation = this.passwordGenService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const roles = await this.prisma.userRole.findMany({ where: { userId }, include: { role: { select: { name: true } } } });
    if (user.studentId || roles.some(({ role }) => ['student', 'parent'].includes(role.name.toLowerCase()))) {
      throw new BadRequestException('Student and parent passwords must be delivered through Password Hub to a validated parent phone.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.passwordHistory.create({
        data: { userId, passwordHash: user.password },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
          lastPasswordChange: new Date(),
        },
      }),
    ]);

    await this.securityAuditService.log({
      userId,
      action: 'PASSWORD_SET',
      details: 'Password set by admin',
    });

    return { message: 'Password set successfully' };
  }
}
