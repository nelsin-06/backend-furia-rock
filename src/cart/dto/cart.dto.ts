import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
} from 'class-validator';
import { CartStatus } from '../entities/cart.entity';

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  variantId: string;

  @IsString()
  talla: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CartItemResponseDto {
  id: string;
  productId: string;
  variantId: string;
  talla: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export class CartResponseDto {
  id: string;
  sessionId: string;
  status: CartStatus;
  subtotal: number;
  discountTotal: number;
  total: number;
  expiresAt: Date;
  items: CartItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
