import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { AppConfig } from '../../config/configuration';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Email sender backed by Resend (https://resend.com).
 * If RESEND_API_KEY is unset we log to the console instead, so notification
 * flows stay observable in development without extra setup.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly cfg: AppConfig['email'];
  private readonly resend: Resend | null;

  constructor(config: ConfigService<AppConfig, true>) {
    this.cfg = config.get('email', { infer: true });
    this.resend = this.cfg.resendApiKey
      ? new Resend(this.cfg.resendApiKey)
      : null;
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not set — emails will be logged to the console.',
      );
    }
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.resend) {
      this.logger.log(
        `[email:console] to=${message.to} · subject="${message.subject}"`,
      );
      this.logger.debug(message.text);
      return;
    }

    const { data, error } = await this.resend.emails.send({
      from: this.cfg.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (error) {
      // Non-fatal by design: callers treat email as best-effort.
      this.logger.error(
        `[email:resend] failed to=${message.to} · ${error.name}: ${error.message}`,
      );
      return;
    }
    this.logger.log(`[email:resend] sent to=${message.to} · id=${data?.id}`);
  }
}
