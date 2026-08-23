import { Injectable } from '@nestjs/common';
import {
  generateKeyPairSync,
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  sign,
  verify,
  createPrivateKey,
  createPublicKey,
} from 'crypto';

/**
 * Ed25519 detached-signature cryptography with the private key encrypted at
 * rest (AES-256-GCM under ENCRYPTION_KEY). The plaintext private key never
 * leaves this class; signing happens server-side over the canonical payload.
 */
@Injectable()
export class CryptoService {
  private masterKey(): Buffer {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length < 64) {
      throw new Error('ENCRYPTION_KEY must be at least 64 hex characters');
    }
    return Buffer.from(hex.slice(0, 64), 'hex');
  }

  generateKeyPair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const fingerprint = createHash('sha256').update(pubPem).digest('hex').slice(0, 32);
    return { publicKey: pubPem, privateKey: privPem, fingerprint };
  }

  encryptPrivate(pem: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey(), iv);
    const enc = Buffer.concat([cipher.update(pem, 'utf8'), cipher.final()]);
    return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
  }

  decryptPrivate(blob: string): string {
    const [ivHex, tagHex, dataHex] = blob.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  }

  canonicalHash(payload: Record<string, unknown>): string {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(canonical).digest('hex');
  }

  sign(privateKeyPem: string, canonicalHash: string): string {
    // Ed25519 signs directly (no pre-hash): crypto.sign(null, data, key)
    const key = createPrivateKey(privateKeyPem);
    return sign(null, Buffer.from(canonicalHash, 'utf8'), key).toString('hex');
  }

  verify(publicKeyPem: string, canonicalHash: string, signatureHex: string): boolean {
    try {
      const key = createPublicKey(publicKeyPem);
      return verify(null, Buffer.from(canonicalHash, 'utf8'), key, Buffer.from(signatureHex, 'hex'));
    } catch {
      return false;
    }
  }
}
