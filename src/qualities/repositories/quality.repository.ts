import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Quality } from '../entities/quality.entity';
import { QualityFilters } from './quality.repository.entity';
import { PaginationHelper } from '../../common/utils/pagination.util';

@Injectable()
export class QualityRepository {
  constructor(
    @InjectRepository(Quality)
    private readonly repository: Repository<Quality>,
  ) {}

  async findWithFilters(filters: QualityFilters) {
    const queryBuilder = this.repository.createQueryBuilder('quality');
    
    this.applyFilters(queryBuilder, filters);
    this.applySorting(queryBuilder, filters.sort);

    return await PaginationHelper.executePaginatedQuery(queryBuilder, filters);
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Quality>, filters: QualityFilters) {
    if (filters.q) {
      queryBuilder.andWhere(
        '(quality.name LIKE :search OR quality.description LIKE :search)',
        { search: `%${filters.q}%` }
      );
    }

    if (filters.active !== undefined) {
      queryBuilder.andWhere('quality.active = :active', { active: filters.active });
    }
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Quality>, sort?: string) {
    if (sort) {
      const [field, direction] = sort.split(':');
      const validFields = ['name', 'description', 'createdAt', 'active'];
      const validDirections = ['ASC', 'DESC'];

      if (validFields.includes(field) && validDirections.includes(direction?.toUpperCase())) {
        queryBuilder.orderBy(`quality.${field}`, direction.toUpperCase() as 'ASC' | 'DESC');
        return;
      }
    }

    // Default sorting
    queryBuilder.orderBy('quality.name', 'ASC');
  }

  async findAll(): Promise<Quality[]> {
    return this.repository.find({
      where: { active: true },
      order: { name: 'ASC' }
    });
  }

  async findById(id: string): Promise<Quality | null> {
    return this.repository.findOne({ 
      where: { id, active: true } 
    });
  }

  async findByName(name: string): Promise<Quality | null> {
    return this.repository.findOne({ 
      where: { name, active: true } 
    });
  }

  async findByIds(ids: string[]): Promise<Quality[]> {
    return this.repository.findByIds(ids);
  }

  create(entityLike: Partial<Quality>): Quality {
    return this.repository.create(entityLike);
  }

  save(entity: Quality): Promise<Quality> {
    return this.repository.save(entity);
  }

  async update(id: string, updateData: Partial<Quality>): Promise<any> {
    return this.repository.update(id, updateData);
  }

  async delete(id: string): Promise<any> {
    return this.repository.delete(id);
  }

  findOne(options: any): Promise<Quality | null> {
    return this.repository.findOne(options);
  }
}