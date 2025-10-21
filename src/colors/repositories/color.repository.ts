import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Color } from '../entities/color.entity';
import { ColorFilters } from './color.repository.entity';
import { PaginationHelper } from '../../common/utils/pagination.util';

@Injectable()
export class ColorRepository {
  constructor(
    @InjectRepository(Color)
    private readonly repository: Repository<Color>,
  ) {}

  async findWithFilters(filters: ColorFilters) {
    const queryBuilder = this.repository.createQueryBuilder('color');
    
    this.applyFilters(queryBuilder, filters);
    this.applySorting(queryBuilder, filters.sort);

    return await PaginationHelper.executePaginatedQuery(queryBuilder, filters);
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Color>, filters: ColorFilters) {
    if (filters.q) {
      queryBuilder.andWhere(
        '(color.name LIKE :search OR color.hexCode LIKE :search)',
        { search: `%${filters.q}%` }
      );
    }

    if (filters.active !== undefined) {
      queryBuilder.andWhere('color.active = :active', { active: filters.active });
    }
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Color>, sort?: string) {
    if (sort) {
      const [field, direction] = sort.split(':');
      const validFields = ['name', 'hexCode', 'createdAt', 'active'];
      const validDirections = ['ASC', 'DESC'];

      if (validFields.includes(field) && validDirections.includes(direction?.toUpperCase())) {
        queryBuilder.orderBy(`color.${field}`, direction.toUpperCase() as 'ASC' | 'DESC');
        return;
      }
    }

    // Default sorting
    queryBuilder.orderBy('color.createdAt', 'DESC');
  }

  findOne(options: any): Promise<Color | null> {
    return this.repository.findOne(options);
  }

  find(): Promise<Color[]> {
    return this.repository.find();
  }

  async findByIds(ids: string[]): Promise<Color[]> {
    if (ids.length === 0) return [];
    return this.repository.findByIds(ids);
  }
}