import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderFilters } from './order.repository.entity';
import { PaginationHelper } from '../../common/utils/pagination.util';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(private dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }

  async findWithFilters(filters: OrderFilters) {
    const queryBuilder = this.createQueryBuilder('order');

    this.applyFilters(queryBuilder, filters);
    this.applySorting(queryBuilder, filters.sortByDate);

    return await PaginationHelper.executePaginatedQuery(queryBuilder, filters);
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Order>, filters: OrderFilters) {
    if (filters.customerEmail) {
      queryBuilder.andWhere('order.customer_email ILIKE :email', {
        email: `%${filters.customerEmail}%`,
      });
    }

    if (filters.customerName) {
      queryBuilder.andWhere("order.customer_data->>'full_name' ILIKE :name", {
        name: `%${filters.customerName}%`,
      });
    }

    if (filters.status && filters.status.length > 0) {
      queryBuilder.andWhere('order.status IN (:...statuses)', {
        statuses: filters.status,
      });
    }

    if (filters.trackingStatus && filters.trackingStatus.length > 0) {
      queryBuilder.andWhere('order.tracking_status IN (:...trackingStatuses)', {
        trackingStatuses: filters.trackingStatus,
      });
    }
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Order>, sortByDate?: string) {
    const direction = sortByDate === 'asc' ? 'ASC' : 'DESC';
    queryBuilder.addOrderBy('order.created_at', direction);
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
