import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly configured: boolean;

  constructor(private configService: ConfigService) {
    const keyStr = this.configService.get<string>('COMMUNICATIONS_ENCRYPTION_KEY');
    if (keyStr) {
      this.key = crypto.scryptSync(keyStr, 'commcloud-salt', 32);
      this.configured = true;
    } else {
      this.logger.warn('COMMUNICATIONS_ENCRYPTION_KEY not set - using dev-only fallback key');
      this.key = crypto.scryptSync('dev-fallback-key-for-comm-cloud', 'commcloud-salt', 32);
      this.configured = false;
    }
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted text format');
    const [ivHex, authTagHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
