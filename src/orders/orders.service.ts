import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderRepository } from './repositories/order.repository';
import { OrderFilters } from './repositories/order.repository.entity';
import { OrderSummaryDto, OrderDetailDto, UpdateTrackingDto } from './dto/order.dto';
import { Order, OrderStatus, TrackingStatus } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(private readonly orderRepository: OrderRepository) {}

  async findAll(filters: OrderFilters) {
    const result = await this.orderRepository.findWithFilters(filters);

    // Map to summary DTO (exclude shipping and full cart details)
    const summaries = result.data.map((order) => this.mapToSummaryDto(order));

    return {
      ...result,
      data: summaries,
    };
  }

  async findOne(id: string): Promise<OrderDetailDto> {
    const order = await this.orderRepository.findOne({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.mapToDetailDto(order);
  }

  async updateTracking(id: string, updateTrackingDto: UpdateTrackingDto): Promise<OrderDetailDto> {
    const order = await this.orderRepository.findOne({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Solo se puede hacer seguimiento a ordenes APPROVED
    if (order.status !== OrderStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot update tracking for order with status ${order.status}. Only APPROVED orders can be tracked.`,
      );
    }

    // Actualizar campos de tracking
    order.tracking_status = updateTrackingDto.tracking_status;

    if (updateTrackingDto.tracking_number !== undefined) {
      order.tracking_number = updateTrackingDto.tracking_number;
    }

    if (updateTrackingDto.tracking_notes !== undefined) {
      order.tracking_notes = updateTrackingDto.tracking_notes;
    }

    // Actualizar timestamps según el estado
    if (updateTrackingDto.tracking_status === TrackingStatus.SHIPPED && !order.shipped_at) {
      order.shipped_at = new Date();
    }

    if (updateTrackingDto.tracking_status === TrackingStatus.DELIVERED && !order.delivered_at) {
      order.delivered_at = new Date();
    }

    const savedOrder = await this.orderRepository.save(order);
    return this.mapToDetailDto(savedOrder);
  }

  private mapToSummaryDto(order: Order): OrderSummaryDto {
    return {
      id: order.id,
      reference: order.reference,
      status: order.status,
      tracking_status: order.tracking_status,
      amount_in_cents: order.amount_in_cents,
      currency: order.currency,
      customer_email: order.customer_email,
      customer_data: {
        full_name: order.customer_data?.full_name || '',
        phone_number: order.customer_data?.phone_number || '',
      },
      items_count: order.cart_snapshot?.items?.length || 0,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }

  private mapToDetailDto(order: Order): OrderDetailDto {
    return {
      id: order.id,
      reference: order.reference,
      session_id: order.session_id,
      wompi_transaction_id: order.wompi_transaction_id,
      status: order.status,
      amount_in_cents: order.amount_in_cents,
      currency: order.currency,
      customer_email: order.customer_email,
      customer_data: order.customer_data,
      shipping_address: order.shipping_address,
      cart_snapshot: order.cart_snapshot,
      expires_at: order.expires_at,
      checkout_url: order.checkout_url,
      error_message: order.error_message,
      tracking_status: order.tracking_status,
      tracking_number: order.tracking_number,
      tracking_notes: order.tracking_notes,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }
}
