import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  Param,
  Headers,
  All,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import {
  CreateCheckoutDto,
  CheckoutResponseDto,
} from './dto/payment.dto';
import { OrderStatus } from '../orders/entities/order.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService
  ) {}

  @Post('create-session')
  @HttpCode(HttpStatus.OK)
  async createSession(
    @Headers('x-session-id') sessionId: string,
    @Body() createCheckoutDto: CreateCheckoutDto,
  ): Promise<CheckoutResponseDto> {
    this.logger.log('Creating payment session for widget checkout');
    return await this.paymentService.createCheckout(createCheckoutDto, sessionId);
  }

  @All('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() webhookData: any): Promise<void> {
    this.logger.log(`Webhook received from Wompi`);
    this.logger.debug(`Webhook payload: ${JSON.stringify(webhookData)}`);

    try {
      // 1. VALIDAR FIRMA DEL WEBHOOK (SEGURIDAD)
      const isValidSignature = await this.paymentService.verifyWebhookSignature(
        webhookData,
      );

      if (!isValidSignature) {
        this.logger.error('❌ Invalid webhook signature - Possible fraud attempt');
        // Responder 200 OK pero no procesar el webhook
        return;
      }

      // 2. Validación defensiva: verificar que existan los campos mínimos necesarios
      if (!webhookData?.event) {
        this.logger.warn('Webhook received without event field');
        return;
      }

      if (!webhookData?.data?.transaction) {
        this.logger.warn('Webhook received without transaction data');
        return;
      }

      const event = webhookData.event;
      const transaction = webhookData.data.transaction;

      // 3. Verificar que el evento sea de transacción
      if (event !== 'transaction.updated') {
        this.logger.warn(`Unhandled webhook event: ${event}`);
        return;
      }

      // 4. Extraer campos necesarios
      const reference = transaction.reference;
      const wompi_transaction_id = transaction.id;
      const status = transaction.status;

      if (!reference) {
        this.logger.error('Webhook transaction without reference');
        return;
      }

      this.logger.log(
        `Processing webhook for reference: ${reference} | Status: ${status} | Transaction ID: ${wompi_transaction_id}`,
      );

      // 5. Mapear status de Wompi a nuestro OrderStatus
      let orderStatus: OrderStatus;

      switch (status?.toUpperCase()) {
        case 'APPROVED':
          orderStatus = OrderStatus.APPROVED;
          break;
        case 'DECLINED':
          orderStatus = OrderStatus.DECLINED;
          break;
        case 'VOIDED':
          orderStatus = OrderStatus.VOIDED;
          break;
        case 'ERROR':
          orderStatus = OrderStatus.ERROR;
          break;
        default:
          orderStatus = OrderStatus.PENDING;
      }

      // 6. Actualizar estado de la orden
      await this.paymentService.updateOrderStatus(
        reference,
        orderStatus,
        wompi_transaction_id,
      );

      this.logger.log(
        `✅ Order ${reference} updated to status: ${orderStatus}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing webhook: ${error.message}`,
        error.stack,
      );
      // No lanzar error para evitar que Wompi reintente innecesariamente
      // El error queda registrado en logs para investigación
    }
  }

  @Get('order/:reference')
  async getOrderByReference(@Param('reference') reference: string) {
    this.logger.log(`Getting order by reference: ${reference}`);
    return await this.paymentService.getOrderByReference(reference);
  }
}
