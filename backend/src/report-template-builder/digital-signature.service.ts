import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class DigitalSignatureService {
  constructor(private prisma: PrismaService) {}

  async getSignatures(schoolId: string) {
    return this.prisma.digitalSignature.findMany({ where: { schoolId }, orderBy: { updatedAt: 'desc' } });
  }

  async createSignature(schoolId: string, data: {
    name: string; title?: string; email?: string; imageUrl?: string; signatureData?: string; isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await this.prisma.digitalSignature.updateMany({ where: { schoolId, isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.digitalSignature.create({
      data: {
        schoolId, name: data.name, title: data.title, email: data.email,
        imageUrl: data.imageUrl, signatureData: data.signatureData,
        isDefault: data.isDefault || false,
        certificate: crypto.randomBytes(32).toString('hex'),
      },
    });
  }

  async updateSignature(schoolId: string, id: string, data: any) {
    const s = await this.prisma.digitalSignature.findFirst({ where: { id, schoolId } });
    if (!s) throw new NotFoundException('Signature not found');
    if (data.isDefault && !s.isDefault) {
      await this.prisma.digitalSignature.updateMany({ where: { schoolId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.digitalSignature.update({ where: { id }, data });
  }

  async deleteSignature(schoolId: string, id: string) {
    const s = await this.prisma.digitalSignature.findFirst({ where: { id, schoolId } });
    if (!s) throw new NotFoundException('Signature not found');
    return this.prisma.digitalSignature.delete({ where: { id } });
  }

  async signDocument(schoolId: string, signatureId: string, documentHash: string): Promise<string> {
    const sig = await this.prisma.digitalSignature.findFirst({ where: { id: signatureId, schoolId } });
    if (!sig) throw new NotFoundException('Signature not found');
    const hash = crypto.createHash('sha256').update(documentHash + sig.certificate).digest('hex');
    return `${sig.id}:${hash.substring(0, 16)}:${Date.now()}`;
  }

  async verifySignature(signatureToken: string): Promise<boolean> {
    const [sigId] = signatureToken.split(':');
    const sig = await this.prisma.digitalSignature.findUnique({ where: { id: sigId } });
    return !!sig;
  }
}
