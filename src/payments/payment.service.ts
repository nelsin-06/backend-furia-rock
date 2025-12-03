import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { CreateCheckoutDto, CheckoutResponseDto } from './dto/payment.dto';
import { OrderRepository } from '../orders/repositories/order.repository';
import { CartService } from '../cart/cart.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { ProductService } from '../products/products.service';
import { MailService } from '../mail/mail.service';
import { TelegramService } from '../telegram/telegram.service';
import { ColorsService } from '../colors/colors.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly wompiPublicKey: string;
  private readonly wompiPrivateKey: string;
  private readonly wompiIntegritySecret: string;
  private readonly wompiEventsSecret: string;
  private readonly wompiBaseUrl: string;
  private readonly redirectUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderRepository: OrderRepository,
    private readonly cartService: CartService,
    private readonly productService: ProductService,
    private readonly mailService: MailService,
    private readonly telegramService: TelegramService,
    private readonly colorsService: ColorsService,
  ) {
    this.wompiPublicKey = this.configService.get<string>('WOMPI_PUBLIC_KEY');
    this.wompiPrivateKey = this.configService.get<string>('WOMPI_PRIVATE_KEY');
    this.wompiIntegritySecret = this.configService.get<string>(
      'WOMPI_INTEGRITY_SECRET',
    );
    this.wompiEventsSecret = this.configService.get<string>(
      'WOMPI_EVENTS_SECRET',
    );
    this.wompiBaseUrl = this.configService.get<string>('WOMPI_BASE_URL');
    this.redirectUrl = this.configService.get<string>('REDIRECT_URL');

    if (
      !this.wompiPublicKey ||
      !this.wompiIntegritySecret ||
      !this.wompiBaseUrl
    ) {
      throw new Error(
        'Wompi configuration is missing. Check environment variables.',
      );
    }

    if (!this.wompiEventsSecret) {
      this.logger.warn(
        '⚠️  WOMPI_EVENTS_SECRET not configured. Webhook signature validation will be skipped.',
      );
    }
  }

  async createCheckout(
    createCheckoutDto: CreateCheckoutDto,
    sessionId: string,
  ): Promise<CheckoutResponseDto> {
    try {
      // 1. Obtener el carrito del usuario
      const cart = await this.cartService.getCart(sessionId);

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // 2. Validar que todos los productos existan y estén activos
      const cartSnapshot = {
        items: [],
        subtotal: 0,
        discountTotal: 0,
        total: 0,
      };

      for (const item of cart.items) {
        const product = await this.productService.findOne(item.productId);

        if (!product) {
          throw new BadRequestException(`Product ${item.productId} not found`);
        }

        if (!product.active) {
          throw new BadRequestException(
            `Product ${product.name} is not available`,
          );
        }

        // Validar que la variante exista
        const variant = product.variables.find(
          (v) => v.variantId === item.variantId,
        );

        if (!variant) {
          throw new BadRequestException(
            `Variant ${item.variantId} not found in product ${product.name}`,
          );
        }

        // Calcular el precio actual del producto
        const currentPrice = Number(product.price);
        const itemTotal = item.quantity * (currentPrice - item.discount);

        // Obtener la primera imagen de la variante (URL de Cloudinary)
        const imageUrl = variant.images && variant.images.length > 0 ? variant.images[0] : null;

        // Obtener el nombre del color desde la base de datos
        let colorName = 'N/A';
        if (variant.colorId) {
          const colors = await this.colorsService.findByIds([variant.colorId]);
          if (colors.length > 0) {
            colorName = colors[0].name;
          }
        }

        // Obtener el nombre de la calidad del producto
        const qualityName = product.quality?.name || 'N/A';

        cartSnapshot.items.push({
          productId: item.productId,
          variantId: item.variantId,
          talla: item.talla,
          quantity: item.quantity,
          price: currentPrice,
          discount: item.discount,
          total: itemTotal,
          productName: product.name,
          colorName: colorName,
          qualityName: qualityName,
          imageUrl: imageUrl,
        });

        cartSnapshot.subtotal += currentPrice * item.quantity;
        cartSnapshot.discountTotal += item.discount * item.quantity;
      }

      cartSnapshot.total = cartSnapshot.subtotal - cartSnapshot.discountTotal;

      // 3. Calcular el monto en centavos (recalculado en backend, no confiar en frontend)
      const amount_in_cents = Math.round(cartSnapshot.total * 100);

      if (amount_in_cents <= 0) {
        throw new BadRequestException('Invalid cart total amount');
      }

      // 4. Generar referencia única
      const reference = uuidv4();

      // 5. Calcular la firma de integridad
      const signature = await this.generateIntegritySignature(
        reference,
        amount_in_cents,
        'COP',
      );

      // 6. Preparar datos con valores estáticos
      const customer_data = {
        ...createCheckoutDto.customer_data,
        phone_number_prefix: '57', // Estático para Colombia
      };

      const shipping_address = {
        ...createCheckoutDto.shipping_address,
        country: 'CO', // Estático para Colombia
      };

      // 7. Calcular tiempo de expiración (15 minutos) - opcional
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      // 8. Crear orden en base de datos con estado PENDING
      const order = this.orderRepository.create({
        reference,
        status: OrderStatus.PENDING,
        amount_in_cents,
        currency: 'COP',
        customer_email: customer_data.email,
        customer_data,
        shipping_address,
        cart_snapshot: cartSnapshot,
        expires_at: expiresAt,
        session_id: sessionId,
      });

      await this.orderRepository.save(order);

      this.logger.log(
        `Payment session created for reference: ${reference} | Amount: ${amount_in_cents} COP`,
      );

      // 9. Retornar parámetros para el Widget Checkout de Wompi
      return {
        public_key: this.wompiPublicKey,
        currency: 'COP',
        amount_in_cents,
        reference,
        'signature:integrity': signature,
        redirect_url: this.redirectUrl,
        customer_email: customer_data.email,
        customer_data: {
          full_name: customer_data.full_name,
          phone_number: customer_data.phone_number,
          phone_number_prefix: customer_data.phone_number_prefix,
          legal_id: customer_data.legal_id,
          legal_id_type: customer_data.legal_id_type,
        },
        shipping_address,
        order_id: order.id,
      };
    } catch (error) {
      this.logger.error(
        `Error creating checkout session: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Unexpected error creating payment session. Please try again.',
      );
    }
  }

  async updateOrderStatus(
    reference: string,
    status: OrderStatus,
    wompi_transaction_id?: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findByReference(reference);

    if (!order) {
      throw new NotFoundException(
        `Order with reference ${reference} not found`,
      );
    }

    order.status = status;

    if (wompi_transaction_id) {
      order.wompi_transaction_id = wompi_transaction_id;
    }

    const savedOrder = await this.orderRepository.save(order);

    // Enviar notificaciones cuando el pago es APPROVED
    if (status === OrderStatus.APPROVED) {
      // 1. Notificar al equipo interno por Telegram
      try {
        await this.telegramService.sendOrderNotification(savedOrder);
        this.logger.log(
          `✅ Telegram notification sent for order ${reference}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to send Telegram notification for order ${reference}: ${error.message}`,
        );
      }

      // 2. Enviar correo de confirmación al cliente
      if (order.customer_email) {
        try {
          await this.mailService.sendOrderConfirmation(savedOrder);
          this.logger.log(
            `✅ Confirmation email sent to ${order.customer_email} for order ${reference}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Failed to send confirmation email for order ${reference}: ${error.message}`,
          );
        }
      }
    }

    return savedOrder;
  }

  async getOrderByReference(reference: string): Promise<Order> {
    const order = await this.orderRepository.findByReference(reference);

    if (!order) {
      throw new NotFoundException(
        `Order with reference ${reference} not found`,
      );
    }

    return order;
  }

  async getOrderById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }

    return order;
  }

  // Generar firma de integridad según documentación de Wompi
  private async generateIntegritySignature(
    reference: string,
    amount_in_cents: number,
    currency: string,
  ): Promise<string> {
    const concatenatedString = `${reference}${amount_in_cents}${currency}${this.wompiIntegritySecret}`;

    // Usar crypto.subtle para generar SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(concatenatedString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return hashHex;
  }

  // Verificar firma de webhook según documentación de Wompi
  async verifyWebhookSignature(webhookData: any): Promise<boolean> {
    // Si no hay evento secret configurado, loggear warning y permitir
    if (!this.wompiEventsSecret) {
      this.logger.warn(
        '⚠️  Webhook signature validation skipped - WOMPI_EVENTS_SECRET not configured',
      );
      return true;
    }

    try {
      // Validar que existan los campos necesarios para verificar la firma
      if (!webhookData?.signature?.checksum) {
        this.logger.error('Webhook without signature.checksum');
        return false;
      }

      if (!webhookData?.signature?.properties) {
        this.logger.error('Webhook without signature.properties');
        return false;
      }

      if (!webhookData?.timestamp) {
        this.logger.error('Webhook without timestamp');
        return false;
      }

      const { checksum, properties } = webhookData.signature;
      this.logger.debug(
        `🚀 ~ PaymentService ~ verifyWebhookSignature ~ checksum: ${checksum}`,
      );
      this.logger.debug(
        `🚀 ~ PaymentService ~ verifyWebhookSignature ~ properties: ${JSON.stringify(properties)}`,
      );
      const timestamp = webhookData.timestamp;
      this.logger.debug(
        `🚀 ~ PaymentService ~ verifyWebhookSignature ~ webhookData: ${JSON.stringify(webhookData)}`,
      );

      // 1. Extraer los valores de los campos especificados en signature.properties
      const values: string[] = [];

      for (const propertyPath of properties) {
        this.logger.debug(
          `🚀 ~ PaymentService ~ verifyWebhookSignature ~ propertyPath: ${propertyPath}`,
        );
        const value = this.getNestedProperty(webhookData.data, propertyPath);
        this.logger.debug(
          `🚀 ~ PaymentService ~ verifyWebhookSignature ~ value: ${value}`,
        );

        if (value === undefined || value === null) {
          this.logger.error(
            `Property ${propertyPath} not found in webhook data`,
          );
          return false;
        }

        values.push(String(value));
      }

      // 2. Concatenar los valores en el orden especificado
      let concatenated = values.join('');
      this.logger.debug(
        `🚀 ~ PaymentService ~ verifyWebhookSignature ~ concatenated: ${concatenated}`,
      );

      // 3. Agregar el timestamp
      concatenated += String(timestamp);

      // 4. Agregar el evento secret
      concatenated += this.wompiEventsSecret;
      this.logger.debug(
        `🚀 ~ PaymentService ~ verifyWebhookSignature ~ concatenated: ${concatenated}`,
      );

      this.logger.debug(`Signature concatenated string: ${concatenated}`);

      // 5. Calcular SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(concatenated);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedChecksum = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      this.logger.debug(`Calculated checksum: ${calculatedChecksum}`);
      this.logger.debug(`Received checksum: ${checksum}`);

      // 6. Comparar con el checksum recibido
      const isValid = calculatedChecksum === checksum;

      if (isValid) {
        this.logger.log('✅ Webhook signature verified successfully');
      } else {
        this.logger.error('❌ Webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error verifying webhook signature: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  // Helper para extraer propiedades anidadas de un objeto
  private getNestedProperty(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }
}
