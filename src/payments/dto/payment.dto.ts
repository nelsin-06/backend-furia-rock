import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsIn,
  Matches,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTOs de entrada desde el frontend
export class CustomerDataDto {
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]+$/, { message: 'phone_number must contain only numbers' })
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  legal_id: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['CC', 'CE', 'TI', 'NIT', 'PP'], {
    message: 'legal_id_type must be CC, CE, TI, NIT, or PP',
  })
  legal_id_type: string;
}

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  address_line_1: string;

  @IsString()
  @IsOptional()
  address_line_2?: string;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]+$/, { message: 'phone_number must contain only numbers' })
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateCheckoutDto {
  @ValidateNested()
  @Type(() => CustomerDataDto)
  @IsNotEmpty()
  customer_data: CustomerDataDto;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsNotEmpty()
  shipping_address: ShippingAddressDto;

  @IsBoolean()
  @IsNotEmpty()
  collect_shipping: boolean;

}

// DTO de respuesta al frontend (Widget Checkout)
export class CheckoutResponseDto {
  @IsString()
  public_key: string;

  @IsString()
  currency: string;

  amount_in_cents: number;

  @IsString()
  reference: string;

  @IsString()
  'signature:integrity': string;

  @IsString()
  redirect_url: string;

  @IsString()
  customer_email: string;

  customer_data: {
    full_name: string;
    phone_number: string;
    phone_number_prefix: string;
    legal_id: string;
    legal_id_type: string;
  };

  shipping_address: {
    address_line_1: string;
    address_line_2?: string;
    region: string;
    city: string;
    country: string;
    phone_number: string;
    name: string;
  };

  @IsString()
  order_id: string;
}

// DTO para webhook de Wompi (sin validaciones - solo contrato de tipos)
// El webhook debe ser agnóstico y no fallar si Wompi agrega/quita campos
export class WompiWebhookDto {
  event?: string;
  data?: {
    transaction?: {
      id?: string;
      created_at?: string;
      finalized_at?: string;
      amount_in_cents?: number;
      reference?: string;
      customer_email?: string;
      currency?: string;
      payment_method_type?: string;
      payment_method?: any;
      status?: string;
      status_message?: string | null;
      shipping_address?: any;
      redirect_url?: string;
      payment_source_id?: string | null;
      payment_link_id?: string | null;
      customer_data?: any;
      billing_data?: any;
      origin?: any;
    };
  };
  sent_at?: string;
  timestamp?: number;
  signature?: {
    checksum?: string;
    properties?: string[];
  };
  environment?: string;
  
  // Permitir cualquier otro campo que Wompi pueda agregar
  [key: string]: any;
}
