import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSpecial?: boolean;
  prefix?: string;
}

export interface GeneratedPassword {
  password: string;
  hash: string;
  pattern: string;
}

@Injectable()
export class PasswordGenerationService {
  private readonly logger = new Logger(PasswordGenerationService.name);

  generateSecurePassword(options: PasswordOptions = {}): GeneratedPassword {
    const {
      length = 12,
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSpecial = false,
      prefix = 'STS-',
    } = options;

    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()-_=+';

    let chars = '';
    if (includeUppercase) chars += uppercase;
    if (includeLowercase) chars += lowercase;
    if (includeNumbers) chars += numbers;
    if (includeSpecial) chars += special;

    if (!chars) chars = lowercase + numbers;

    const randomBytes = crypto.randomBytes(length);
    let passwordChars = '';
    for (let i = 0; i < length; i++) {
      passwordChars += chars[randomBytes[i] % chars.length];
    }

    let password: string;
    if (prefix) {
      password = `${prefix}${passwordChars}`;
    } else {
      password = passwordChars;
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    return { password, hash, pattern: prefix || 'custom' };
  }

  generateRoleBasedPassword(role: string): GeneratedPassword {
    const rolePrefixes: Record<string, string> = {
      Student: 'STS-Student#',
      Parent: 'STS-Parent#',
      Teacher: 'STS-Teacher#',
      ClassTeacher: 'STS-ClassTeacher#',
      Director: 'STS-Director#',
      Staff: 'STS-Staff#',
      SuperAdmin: 'STS-Admin#',
    };

    const prefix = rolePrefixes[role] || 'STS-User#';
    const suffix = crypto.randomInt(1000, 9999).toString();
    const middle = crypto.randomBytes(4).toString('hex').toUpperCase();
    const password = `${prefix}${middle}${suffix}`;

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return { password, hash, pattern: prefix };
  }

  validatePasswordStrength(password: string): { valid: boolean; score: number; errors: string[] } {
    const errors: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (/[a-z]/.test(password)) score += 15;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;

    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Must include uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Must include lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Must include a number');

    return { valid: errors.length === 0, score, errors };
  }
}
