import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf;
  private readonly chatId: string;
  private isEnabled = false;

  constructor(private readonly configService: ConfigService) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (!botToken || !this.chatId) {
      this.logger.warn(
        '⚠️ Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable notifications.',
      );
      return;
    }

    this.bot = new Telegraf(botToken);
    this.isEnabled = true;
  }

  async onModuleInit() {
    if (!this.isEnabled) return;

    try {
      const botInfo = await this.bot.telegram.getMe();
      this.logger.log(`✅ Telegram bot connected: @${botInfo.username}`);
    } catch (error) {
      this.logger.error(`❌ Failed to connect Telegram bot: ${error.message}`);
      this.isEnabled = false;
    }
  }

  async sendOrderNotification(order: Order): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn('Telegram notifications disabled - skipping');
      return false;
    }

    try {
      const message = this.formatOrderMessage(order);
      await this.bot.telegram.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
      });
      this.logger.log(`✅ Telegram notification sent for order ${order.reference}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send Telegram notification: ${error.message}`,
      );
      return false;
    }
  }

  private formatOrderMessage(order: Order): string {
    const totalFormatted = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(order.amount_in_cents / 100);

    const itemsList = order.cart_snapshot.items
      .map(
        (item) =>
          `  • ${item.productName || 'Producto'} (${item.talla}) x${item.quantity}`,
      )
      .join('\n');

    const message = `
🎸 <b>¡NUEVA ORDEN PAGADA!</b> 🎸

📋 <b>Referencia:</b> <code>${order.reference}</code>
💰 <b>Total:</b> ${totalFormatted}
📅 <b>Fecha:</b> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}

👤 <b>CLIENTE</b>
• Nombre: ${order.customer_data.full_name}
• Email: ${order.customer_email}
• Teléfono: +${order.customer_data.phone_number_prefix} ${order.customer_data.phone_number}
• Documento: ${order.customer_data.legal_id_type} ${order.customer_data.legal_id}

📦 <b>PRODUCTOS (${order.cart_snapshot.items.length})</b>
${itemsList}

🚚 <b>DIRECCIÓN DE ENVÍO</b>
• ${order.shipping_address.name}
• ${order.shipping_address.address_line_1}
• ${order.shipping_address.city}, ${order.shipping_address.region}
• Tel: ${order.shipping_address.phone_number}

🔗 <b>Wompi ID:</b> <code>${order.wompi_transaction_id || 'N/A'}</code>
    `.trim();

    return message;
  }
}
