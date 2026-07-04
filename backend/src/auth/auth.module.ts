import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { PushNotificationModule } from '../push-notification/push-notification.module';
import { EmailModule } from '../email/email.module';
import { InstitutionModule } from '../institution/institution.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Global()
@Module({
  imports: [
    PrismaModule,
    PushNotificationModule,
    EmailModule,
    InstitutionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET') || 'default-secret-key',
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '7d') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}