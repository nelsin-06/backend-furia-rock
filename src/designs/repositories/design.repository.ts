import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Design, DesignStatus } from '../entities/design.entity';
import { AdminDesignQueryDto } from '../dto/design.dto';
import { PaginationHelper } from '../../common/utils/pagination.util';

@Injectable()
export class DesignRepository extends Repository<Design> {
  constructor(private dataSource: DataSource) {
    super(Design, dataSource.createEntityManager());
  }

  async findWithFilters(filters: AdminDesignQueryDto) {
    const queryBuilder = this.createQueryBuilder('design');

    this.applyFilters(queryBuilder, filters);
    queryBuilder.addOrderBy('design.createdAt', 'DESC');

    return await PaginationHelper.executePaginatedQuery(queryBuilder, {
      page: filters.page ? Number(filters.page) : undefined,
      limit: filters.limit ? Number(filters.limit) : undefined,
    });
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Design>,
    filters: AdminDesignQueryDto,
  ) {
    if (filters.status) {
      queryBuilder.andWhere('design.status = :status', {
        status: filters.status,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(design.customerName ILIKE :search OR design.phone ILIKE :search OR design.designName ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('design.createdAt >= :dateFrom', {
        dateFrom: new Date(filters.dateFrom),
      });
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('design.createdAt <= :dateTo', { dateTo });
    }
  }
}
