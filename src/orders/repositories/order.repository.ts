import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(private dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }

  async findByReference(reference: string): Promise<Order | null> {
    return await this.findOne({ where: { reference } });
  }

  async findByWompiTransactionId(
    wompi_transaction_id: string,
  ): Promise<Order | null> {
    return await this.findOne({ where: { wompi_transaction_id } });
  }

  async findByCustomerEmail(email: string): Promise<Order[]> {
    return await this.find({
      where: { customer_email: email },
      order: { created_at: 'DESC' },
    });
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return await this.find({
      where: { status },
      order: { created_at: 'DESC' },
    });
  }

  async findPendingOrders(): Promise<Order[]> {
    return await this.find({
      where: { status: OrderStatus.PENDING },
      order: { created_at: 'DESC' },
    });
  }
}
