import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateCheckoutDto,
  CheckoutResponseDto,
  OrderStatusResponseDto,
} from './dto/payment.dto';
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
  private readonly wompiCheckoutUrl: string;
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
    this.wompiPublicKey = this.getRequiredConfig('WOMPI_PUBLIC_KEY');
    this.wompiPrivateKey = this.getRequiredConfig('WOMPI_PRIVATE_KEY');
    this.wompiIntegritySecret = this.getRequiredConfig('WOMPI_INTEGRITY_SECRET');
    this.wompiEventsSecret = this.getRequiredConfig('WOMPI_EVENTS_SECRET');
    this.wompiBaseUrl = this.getRequiredConfig('WOMPI_BASE_URL');
    this.wompiCheckoutUrl =
      this.configService.get<string>('WOMPI_CHECKOUT_URL') ||
      'https://checkout.wompi.co/p/';
    this.redirectUrl = this.getRequiredConfig('REDIRECT_URL');
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

      // 5. Calcular tiempos de expiración
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // Expiración corta Wompi
      const autoExpireAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Expiración operativa
      const expirationTime = expiresAt.toISOString();

      // 6. Calcular la firma de integridad (incluyendo expiration-time)
      const signature = await this.generateIntegritySignature(
        reference,
        amount_in_cents,
        'COP',
        expirationTime,
      );

      // 7. Preparar datos con valores estáticos
      const customer_data = {
        ...createCheckoutDto.customer_data,
        phone_number_prefix: '57', // Estático para Colombia
      };

      const shipping_address = {
        ...createCheckoutDto.shipping_address,
        country: 'CO', // Estático para Colombia
      };

      // 8. Construir URLs de retorno y checkout de Wompi
      const redirectUrlWithReference = this.appendReferenceToRedirectUrl(
        this.redirectUrl,
        reference,
      );

      const checkout_url = this.buildCheckoutUrl({
        'public-key': this.wompiPublicKey,
        currency: 'COP',
        'amount-in-cents': amount_in_cents,
        reference,
        'signature:integrity': signature,
        'redirect-url': redirectUrlWithReference,
        'expiration-time': expirationTime,
        'collect-shipping': createCheckoutDto.collect_shipping,
        'customer-data:email': customer_data.email,
        'customer-data:full-name': customer_data.full_name,
        'customer-data:phone-number': customer_data.phone_number,
        'customer-data:phone-number-prefix':
          customer_data.phone_number_prefix,
        'customer-data:legal-id': customer_data.legal_id,
        'customer-data:legal-id-type': customer_data.legal_id_type,
        'shipping-address:address-line-1': shipping_address.address_line_1,
        'shipping-address:address-line-2': shipping_address.address_line_2,
        'shipping-address:country': shipping_address.country,
        'shipping-address:region': shipping_address.region,
        'shipping-address:city': shipping_address.city,
        'shipping-address:phone-number': shipping_address.phone_number,
        'shipping-address:name': shipping_address.name,
      });

      // 9. Crear orden en base de datos con estado PENDING
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
        auto_expire_at: autoExpireAt,
        session_id: sessionId,
        checkout_url,
      });

      await this.orderRepository.save(order);

      this.logger.log(
        JSON.stringify({
          message: 'Payment session created',
          reference,
          session_id: sessionId,
          cart_id: cart.id,
          order_id: order.id,
          status: OrderStatus.PENDING,
          source: 'redirect',
          amount_in_cents,
          timestamp: new Date().toISOString(),
        }),
      );

      // 10. Retornar metadata de sesión para Web Checkout (redirect)
      return {
        public_key: this.wompiPublicKey,
        currency: 'COP',
        amount_in_cents,
        reference,
        'signature:integrity': signature,
        redirect_url: redirectUrlWithReference,
        checkout_url,
        expiration_time: expirationTime,
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
    webhookEventId?: string,
    webhookTimestamp?: number,
  ): Promise<Order> {
    const order = await this.orderRepository.findByReference(reference);

    if (!order) {
      throw new NotFoundException(
        `Order with reference ${reference} not found`,
      );
    }

    const previousStatus = order.status;

    const isDuplicateEvent =
      previousStatus === status &&
      (!wompi_transaction_id ||
        wompi_transaction_id === order.wompi_transaction_id);

    if (isDuplicateEvent) {
      this.logger.log(
        JSON.stringify({
          message: 'Duplicate webhook ignored',
          reference,
          status,
          wompi_transaction_id,
          event_id: webhookEventId,
          timestamp: webhookTimestamp,
        }),
      );
      return order;
    }

    if (previousStatus === OrderStatus.APPROVED && status !== OrderStatus.APPROVED) {
      this.logger.warn(
        JSON.stringify({
          message: 'Ignoring status downgrade for approved order',
          reference,
          previous_status: previousStatus,
          incoming_status: status,
          wompi_transaction_id,
          event_id: webhookEventId,
          timestamp: webhookTimestamp,
        }),
      );
      return order;
    }

    if (
      previousStatus === OrderStatus.EXPIRED &&
      status === OrderStatus.APPROVED
    ) {
      this.logger.log(
        JSON.stringify({
          message: 'Late approved webhook received for expired order',
          reference,
          previous_status: previousStatus,
          incoming_status: status,
          wompi_transaction_id,
          event_id: webhookEventId,
          timestamp: webhookTimestamp,
        }),
      );
    }

    order.status = status;

    if (wompi_transaction_id) {
      order.wompi_transaction_id = wompi_transaction_id;
    }

    const savedOrder = await this.orderRepository.save(order);

    this.logger.log(
      JSON.stringify({
        message: 'Order status updated from webhook',
        reference,
        previous_status: previousStatus,
        status,
        wompi_transaction_id,
        event_id: webhookEventId,
        timestamp: webhookTimestamp,
      }),
    );

    // Enviar notificaciones cuando el pago es APPROVED
    if (status === OrderStatus.APPROVED && previousStatus !== OrderStatus.APPROVED) {
      // 0. Cerrar el carrito asociado (via session_id)
      // Esto garantiza que aunque el frontend no llame a POST /cart/complete,
      // el carrito no quede ACTIVE después de un pago exitoso.
      if (savedOrder.session_id) {
        try {
          await this.cartService.completeCart(savedOrder.session_id);
          this.logger.log(
            `✅ Cart closed for session ${savedOrder.session_id} after APPROVED payment (reference: ${reference})`,
          );
        } catch (cartError) {
          // No fallar el webhook si el carrito ya fue cerrado por el frontend o no existe
          this.logger.warn(
            `⚠️  Could not close cart for session ${savedOrder.session_id} (reference: ${reference}): ${cartError.message}`,
          );
        }
      }

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

  async getOrderStatusByReference(
    reference: string,
    sessionId: string,
  ): Promise<OrderStatusResponseDto> {
    const order = await this.orderRepository.findByReferenceAndSession(
      reference,
      sessionId,
    );

    if (!order) {
      this.logger.warn(
        JSON.stringify({
          message: 'Order lookup denied or not found for session',
          reference,
          session_id: sessionId,
          source: 'redirect',
          timestamp: new Date().toISOString(),
        }),
      );

      throw new NotFoundException(
        `Order with reference ${reference} not found for this session`,
      );
    }

    const isExpired =
      order.status === OrderStatus.PENDING &&
      !!order.expires_at &&
      order.expires_at.getTime() <= Date.now();

    return {
      order_id: order.id,
      reference: order.reference,
      status: order.status,
      currency: order.currency,
      amount_in_cents: Number(order.amount_in_cents),
      wompi_transaction_id: order.wompi_transaction_id,
      is_expired: isExpired,
      updated_at: order.updated_at,
    };
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

  mapWompiStatusToOrderStatus(status?: string): OrderStatus {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return OrderStatus.APPROVED;
      case 'DECLINED':
        return OrderStatus.DECLINED;
      case 'VOIDED':
        return OrderStatus.VOIDED;
      case 'ERROR':
        return OrderStatus.ERROR;
      default:
        return OrderStatus.PENDING;
    }
  }

  private appendReferenceToRedirectUrl(
    redirectUrl: string,
    reference: string,
  ): string {
    try {
      const url = new URL(redirectUrl);
      url.searchParams.set('reference', reference);
      return url.toString();
    } catch {
      const joiner = redirectUrl.includes('?') ? '&' : '?';
      return `${redirectUrl}${joiner}reference=${encodeURIComponent(reference)}`;
    }
  }

  private buildCheckoutUrl(
    params: Record<string, string | number | boolean | undefined>,
  ): string {
    try {
      const url = new URL(this.wompiCheckoutUrl);

      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }

        url.searchParams.set(key, String(value));
      });

      return url.toString();
    } catch {
      const query = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }

        query.set(key, String(value));
      });

      const separator = this.wompiCheckoutUrl.includes('?') ? '&' : '?';
      return `${this.wompiCheckoutUrl}${separator}${query.toString()}`;
    }
  }

  // Generar firma de integridad según documentación de Wompi
  private async generateIntegritySignature(
    reference: string,
    amount_in_cents: number,
    currency: string,
    expirationTime?: string,
  ): Promise<string> {
    const concatenatedString = expirationTime
      ? `${reference}${amount_in_cents}${currency}${expirationTime}${this.wompiIntegritySecret}`
      : `${reference}${amount_in_cents}${currency}${this.wompiIntegritySecret}`;

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

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(
        `Missing required environment variable for Wompi integration: ${key}`,
      );
    }

    return value;
  }
}
