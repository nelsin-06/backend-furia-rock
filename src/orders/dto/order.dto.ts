import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrderStatus, TrackingStatus } from '../entities/order.entity';

// DTO for query parameters (GET /orders)
export class OrderQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toLowerCase())
  sortByDate?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    return value;
  })
  status?: OrderStatus[];

  @IsOptional()
  @IsArray()
  @IsEnum(TrackingStatus, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    return value;
  })
  trackingStatus?: TrackingStatus[];
}

// DTO for order summary in list response (excludes shipping and full cart details)
export class OrderSummaryDto {
  id: string;
  reference: string;
  status: OrderStatus;
  tracking_status: TrackingStatus;
  amount_in_cents: number;
  currency: string;
  customer_email: string;
  customer_data: {
    full_name: string;
    phone_number: string;
  };
  items_count: number;
  created_at: Date;
  updated_at: Date;
}

// DTO for full order detail response
export class OrderDetailDto {
  id: string;
  reference: string;
  session_id: string;
  wompi_transaction_id: string;
  status: OrderStatus;
  amount_in_cents: number;
  currency: string;
  customer_email: string;
  customer_data: {
    full_name: string;
    email: string;
    phone_number_prefix: string;
    phone_number: string;
    legal_id: string;
    legal_id_type: string;
  };
  shipping_address: {
    address_line_1: string;
    address_line_2?: string;
    country: string;
    region: string;
    city: string;
    phone_number: string;
    name: string;
  };
  cart_snapshot: {
    items: Array<{
      productId: string;
      variantId: string;
      talla: string;
      quantity: number;
      price: number;
      discount: number;
      total: number;
      productName?: string;
      colorName?: string;
    }>;
    subtotal: number;
    discountTotal: number;
    total: number;
  };
  expires_at: Date;
  checkout_url: string;
  error_message: string;
  tracking_status: TrackingStatus;
  tracking_number: string;
  tracking_notes: string;
  shipped_at: Date;
  delivered_at: Date;
  created_at: Date;
  updated_at: Date;
}

// DTO para actualizar el estado de seguimiento
export class UpdateTrackingDto {
  @IsEnum(TrackingStatus)
  tracking_status: TrackingStatus;

  @IsOptional()
  @IsString()
  tracking_number?: string;

  @IsOptional()
  @IsString()
  tracking_notes?: string;
}
