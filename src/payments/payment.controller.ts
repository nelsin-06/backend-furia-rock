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
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import {
  CreateCheckoutDto,
  CheckoutResponseDto,
  OrderStatusResponseDto,
} from './dto/payment.dto';
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
    this.logger.log('Creating payment session for redirect checkout');
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
      const timestamp = webhookData?.timestamp;
      const eventId =
        webhookData?.id ||
        webhookData?.event_id ||
        `${reference || 'unknown'}-${timestamp || Date.now()}`;

      if (!reference) {
        this.logger.error('Webhook transaction without reference');
        return;
      }

      this.logger.log(
        JSON.stringify({
          message: 'Processing Wompi webhook',
          reference,
          transaction_id: wompi_transaction_id,
          status,
          event_id: eventId,
          timestamp,
        }),
      );

      // 5. Mapear status de Wompi a nuestro OrderStatus
      const orderStatus = this.paymentService.mapWompiStatusToOrderStatus(status);

      // 6. Actualizar estado de la orden
      const updatedOrder = await this.paymentService.updateOrderStatus(
        reference,
        orderStatus,
        wompi_transaction_id,
        eventId,
        timestamp,
      );

      this.logger.log(
        JSON.stringify({
          message: 'Order updated from webhook',
          reference,
          order_id: updatedOrder.id,
          session_id: updatedOrder.session_id,
          transaction_id: updatedOrder.wompi_transaction_id,
          status: updatedOrder.status,
          source: 'webhook',
          event_id: eventId,
          timestamp,
        }),
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
  async getOrderByReference(
    @Param('reference') reference: string,
    @Headers('x-session-id') sessionId: string,
  ): Promise<OrderStatusResponseDto> {
    if (!sessionId) {
      throw new BadRequestException('x-session-id header is required');
    }

    this.logger.log(`Getting order by reference: ${reference}`);
    return await this.paymentService.getOrderStatusByReference(
      reference,
      sessionId,
    );
  }
}
