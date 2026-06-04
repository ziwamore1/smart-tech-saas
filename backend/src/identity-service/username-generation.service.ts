import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class UsernameGenerationService {
  private readonly logger = new Logger(UsernameGenerationService.name);
  private counter = 0;

  generateUsername(firstName: string, lastName: string, role: string, schoolId?: string): string {
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');

    const rolePrefixes: Record<string, string> = {
      Student: 'stu',
      Parent: 'par',
      Teacher: 'tch',
      ClassTeacher: 'cls',
      Director: 'dir',
      Staff: 'stf',
      SuperAdmin: 'adm',
    };

    const prefix = rolePrefixes[role] || 'usr';
    this.counter = (this.counter + 1) % 99999;
    const uniqueNum = (Date.now() % 100000 + this.counter).toString().padStart(5, '0');

    const username = `${prefix}_${uniqueNum}`;
    return username;
  }

  generateStructuredUsername(firstName: string, lastName: string, role: string, schoolCode?: string): string {
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');

    const roleCodes: Record<string, string> = {
      Student: 'STU',
      Parent: 'PAR',
      Teacher: 'TCH',
      ClassTeacher: 'CLS',
      Director: 'DIR',
      Staff: 'STF',
      SuperAdmin: 'ADM',
    };

    const roleCode = roleCodes[role] || 'USR';
    const year = new Date().getFullYear().toString().slice(-2);
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    const schoolPart = schoolCode ? `${schoolCode}.` : '';

    return `${schoolPart}${roleCode}.${year}.${cleanFirst.charAt(0)}${cleanLast.charAt(0)}${random}`.toLowerCase();
  }

  generateEmailFromUsername(username: string, domain?: string): string {
    const emailDomain = domain || 'smarttech.edu';
    return `${username}@${emailDomain}`;
  }
}
