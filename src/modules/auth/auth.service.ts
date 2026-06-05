import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AppConfig } from '../../config/configuration';
import { UserRole } from '../../common/enums';
import { RegisterDto, LoginDto, ResetPasswordDto } from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly mail: MailService,
  ) {}

  private sign(user: { id: string; email: string; role: UserRole }) {
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken: token };
  }

  private sanitize(user: any) {
    const { passwordHash, resetTokenHash, resetTokenExpires, ...rest } = user;
    return rest;
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      name: dto.name,
      role: dto.role ?? UserRole.DESIGNER,
      company: dto.company,
    });

    return { user: this.sanitize(user), ...this.sign(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithSecret(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return { user: this.sanitize(user), ...this.sign(user) };
  }

  async profile(userId: string) {
    return this.sanitize(await this.users.findById(userId));
  }

  /** Generates a reset token, stores its hash, and emails the raw token. */
  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email);
    // Always return success to avoid user enumeration
    if (!user) return { ok: true };

    const rawToken = randomBytes(32).toString('hex');
    const resetTokenHash = createHash('sha256').update(rawToken).digest('hex');
    const ttl = this.config.get('jwt', { infer: true }).resetTokenTtl;
    const resetTokenExpires = new Date(Date.now() + ttl * 1000);

    await this.users.update(user.id, { resetTokenHash, resetTokenExpires });

    const appName = this.config.get('email', { infer: true }).appName;
    await this.mail.send({
      to: user.email,
      subject: `Reset your ${appName} password`,
      text:
        `Use this token to reset your password (valid ${Math.floor(ttl / 60)} min):\n\n` +
        `${rawToken}\n\nEmail: ${user.email}`,
    });

    // In dev (no email provider) surface the token so the flow is testable.
    const devToken =
      this.config.get('env', { infer: true }) !== 'production'
        ? rawToken
        : undefined;
    return { ok: true, devToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.users.findWithResetToken(dto.email);
    if (!user || !user.resetTokenHash || !user.resetTokenExpires) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (user.resetTokenExpires.getTime() < Date.now()) {
      throw new BadRequestException('Reset token has expired');
    }
    const incomingHash = createHash('sha256')
      .update(dto.token)
      .digest('hex');
    if (incomingHash !== user.resetTokenHash) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.users.update(user.id, {
      passwordHash,
      resetTokenHash: null,
      resetTokenExpires: null,
    });
    return { ok: true };
  }
}
