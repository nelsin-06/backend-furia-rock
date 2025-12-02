import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    // Verificar conexión al iniciar
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('✅ Mail service connected successfully');
    } catch (error) {
      this.logger.warn(
        `⚠️ Mail service connection failed: ${error.message}. Emails will not be sent.`,
      );
    }
  }

  async sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    try {
      const from = this.configService.get<string>('SMTP_FROM') || 'noreply@furia-rock.com';

      const mailOptions = {
        from,
        to,
        subject,
        text,
        html: html || text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Email sent to ${to} | Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${to}: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendOrderConfirmation(email: string, orderReference: string): Promise<boolean> {
    const subject = 'mensaje de test';
    const text = 'hola este es un mensaje de test';
    const html = `
      <h1>hola este es un mensaje de test</h1>
      <p>Referencia de orden: ${orderReference}</p>
    `;

    return this.sendMail(email, subject, text, html);
  }
}
