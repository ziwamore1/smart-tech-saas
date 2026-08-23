import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private slugify(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return base ? `${base}-${Math.random().toString(36).slice(2, 6)}` : Math.random().toString(36).slice(2, 10);
  }

  async register(name: string, email: string, password: string) {
    if (!name || !email || !password || password.length < 8) {
      throw new BadRequestException('Name, email and a password of at least 8 characters are required');
    }
    const exists = await this.prisma.organisation.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) throw new ConflictException('An organisation with this email already exists');
    const org = await this.prisma.organisation.create({
      data: {
        name,
        slug: this.slugify(name),
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    await this.prisma.auditLog.create({
      data: { organisationId: org.id, action: 'ORG_REGISTERED', detail: org.slug },
    });
    return this.token(org.id, org.email);
  }

  async login(email: string, password: string) {
    const org = await this.prisma.organisation.findUnique({ where: { email: email.toLowerCase() } });
    if (!org || !(await bcrypt.compare(password, org.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.token(org.id, org.email);
  }

  private token(sub: string, email: string) {
    return {
      accessToken: this.jwt.sign({ sub, email }),
      organisation: { id: sub, email },
    };
  }
}
