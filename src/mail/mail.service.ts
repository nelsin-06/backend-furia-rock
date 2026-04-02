import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Resend } from 'resend';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend?: Resend;

  constructor(private readonly configService: ConfigService) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.logger.log('✅ Mail service configured with Resend API');
      return;
    }

    this.logger.warn('⚠️ RESEND_API_KEY is not configured. Emails will not be sent.');
  }

  private loadTemplate(templateName: string, variables: Record<string, any>): string {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    return template(variables);
  }

  private formatPrice(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  async sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    try {
      const from = this.configService.get<string>('RESEND_FROM') || 'noreply@furia-rock.com';
      if (this.resend) {
        const { data, error } = await this.resend.emails.send({
          from,
          to,
          subject,
          text,
          html: html || undefined,
        });

        if (error) {
          this.logger.error(`❌ Failed to send email to ${to} with Resend: ${error.message}`);
          return false;
        }

        this.logger.log(`✅ Email sent to ${to} | Resend ID: ${data?.id || 'unknown'}`);
        return true;
      }

      this.logger.error('❌ No email provider configured. Set RESEND_API_KEY variable');
      return false;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${to}: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendOrderConfirmation(order: Order): Promise<boolean> {
    try {
      // Preparar los items con formato de precio
      const formattedItems = order.cart_snapshot.items.map((item) => ({
        ...item,
        totalFormatted: this.formatPrice(item.total),
      }));

      // Preparar variables para el template
      const templateVariables = {
        customerName: order.customer_data?.full_name || 'Cliente',
        orderReference: order.reference,
        orderDate: new Date(order.created_at).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        items: formattedItems,
        subtotal: this.formatPrice(order.cart_snapshot?.subtotal || 0),
        total: this.formatPrice(order.amount_in_cents / 100),
        shippingAddress: order.shipping_address,
        year: new Date().getFullYear(),
      };

      // Cargar y compilar template
      const html = this.loadTemplate('order-confirmation', templateVariables);

      // Texto plano como fallback
      const text = `
¡Gracias por tu compra, ${templateVariables.customerName}!

Referencia de pedido: #${order.reference}
Fecha: ${templateVariables.orderDate}
Total: ${templateVariables.total}

Te notificaremos cuando tu pedido sea enviado.

© ${templateVariables.year} Furia Rock
      `.trim();

      const subject = `Confirmación de Pedido #${order.reference} - Furia Rock`;

      return await this.sendMail(order.customer_email, subject, text, html);
    } catch (error) {
      this.logger.error(
        `❌ Failed to send order confirmation email: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
