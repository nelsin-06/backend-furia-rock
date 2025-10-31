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

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly wompiPublicKey: string;
  private readonly wompiPrivateKey: string;
  private readonly wompiIntegritySecret: string;
  private readonly wompiBaseUrl: string;
  private readonly redirectUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly orderRepository: OrderRepository,
    private readonly cartService: CartService,
    private readonly productService: ProductService,
  ) {
    this.wompiPublicKey = this.configService.get<string>('WOMPI_PUBLIC_KEY');
    this.wompiPrivateKey = this.configService.get<string>('WOMPI_PRIVATE_KEY');
    this.wompiIntegritySecret = this.configService.get<string>(
      'WOMPI_INTEGRITY_SECRET',
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
          throw new BadRequestException(
            `Product ${item.productId} not found`,
          );
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

        cartSnapshot.items.push({
          productId: item.productId,
          variantId: item.variantId,
          talla: item.talla,
          quantity: item.quantity,
          price: currentPrice,
          discount: item.discount,
          total: itemTotal,
          productName: product.name,
          colorName: variant.colorId,
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
      this.logger.error(`Error creating checkout session: ${error.message}`, error.stack);
      
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
      throw new NotFoundException(`Order with reference ${reference} not found`);
    }

    order.status = status;
    
    if (wompi_transaction_id) {
      order.wompi_transaction_id = wompi_transaction_id;
    }

    return await this.orderRepository.save(order);
  }

  async getOrderByReference(reference: string): Promise<Order> {
    const order = await this.orderRepository.findByReference(reference);

    if (!order) {
      throw new NotFoundException(`Order with reference ${reference} not found`);
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

  // Verificar firma de webhook
  async verifyWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedSignature = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return calculatedSignature === signature;
  }
}
