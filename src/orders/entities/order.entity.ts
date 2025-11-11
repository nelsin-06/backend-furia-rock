import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OrderStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  VOIDED = 'VOIDED',
  ERROR = 'ERROR',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  reference: string;

  @Column({ nullable: true })
  wompi_transaction_id: string;

  @Column()
  session_id: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'bigint' })
  amount_in_cents: number;

  @Column({ default: 'COP' })
  currency: string;

  @Column()
  customer_email: string;

  // Información del comprador
  @Column({ type: 'json' })
  customer_data: {
    full_name: string;
    email: string;
    phone_number_prefix: string;
    phone_number: string;
    legal_id: string;
    legal_id_type: string;
  };

  // Información de envío
  @Column({ type: 'json' })
  shipping_address: {
    address_line_1: string;
    address_line_2?: string;
    country: string;
    region: string;
    city: string;
    phone_number: string;
    name: string;
  };

  // Carrito completo al momento de la orden
  @Column({ type: 'json' })
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

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @Column({ nullable: true })
  checkout_url: string;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
