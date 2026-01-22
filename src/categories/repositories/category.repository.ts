import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CategoryFilters } from './category.repository.entity';
import { PaginationHelper } from '../../common/utils/pagination.util';

@Injectable()
export class CategoryRepository {
  constructor(
    @InjectRepository(Category)
    private readonly repository: Repository<Category>,
  ) {}

  async findWithFilters(filters: CategoryFilters) {
    const queryBuilder = this.repository.createQueryBuilder('category');
    
    // Por defecto, filtrar solo categorías padre (sin parentId)
    if (!filters.includeChildren) {
      queryBuilder.where('category.parentId IS NULL');
    }
    
    this.applyFilters(queryBuilder, filters);
    this.applySorting(queryBuilder, filters.sort);

    return await PaginationHelper.executePaginatedQuery(queryBuilder, filters);
  }

  async findChildrenByParentId(parentId: string): Promise<Category[]> {
    return this.repository.find({
      where: { parentId, active: true },
      order: { name: 'ASC' },
    });
  }

  async findByIds(ids: string[]): Promise<Category[]> {
    if (ids.length === 0) return [];
    return this.repository.findByIds(ids);
  }

  async findDefaultCategory(): Promise<Category | null> {
    return this.repository.findOne({ where: { default: true, active: true } });
  }

  async setAsDefault(categoryId: string): Promise<void> {
    // First, remove default from all categories
    await this.repository.update({ default: true }, { default: false });
    // Then set the specified category as default
    await this.repository.update({ id: categoryId }, { default: true });
  }

  create(entityLike: Partial<Category>): Category {
    return this.repository.create(entityLike);
  }

  save(entity: Category): Promise<Category> {
    return this.repository.save(entity);
  }

  findOne(options: any): Promise<Category | null> {
    return this.repository.findOne(options);
  }

  update(id: string, updateData: Partial<Category>): Promise<any> {
    return this.repository.update(id, updateData);
  }

  delete(id: string): Promise<any> {
    return this.repository.delete(id);
  }

  find(): Promise<Category[]> {
    return this.repository.find();
  }

  async count(filters?: Partial<CategoryFilters>): Promise<number> {
    const queryBuilder = this.repository.createQueryBuilder('category');
    
    if (filters) {
      this.applyFilters(queryBuilder, filters);
    }
    
    return queryBuilder.getCount();
  }

  async countByParentId(parentId: string): Promise<number> {
    return this.repository.count({
      where: { parentId }
    });
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Category>, filters: CategoryFilters) {
    if (filters.q) {
      queryBuilder.andWhere('category.name LIKE :search', {
        search: `%${filters.q}%`,
      });
    }

    if (filters.active !== undefined) {
      queryBuilder.andWhere('category.active = :active', { active: filters.active });
    }

    if (filters.default !== undefined) {
      queryBuilder.andWhere('category.default = :default', { default: filters.default });
    }
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Category>, sort?: string) {
    if (sort) {
      const [field, direction] = sort.split(':');
      const validFields = ['name', 'default', 'active', 'createdAt', 'updatedAt'];
      const validDirections = ['ASC', 'DESC'];

      if (validFields.includes(field) && validDirections.includes(direction?.toUpperCase())) {
        queryBuilder.orderBy(`category.${field}`, direction.toUpperCase() as 'ASC' | 'DESC');
        return;
      }
    }

    // Default sorting: default categories first, then by name
    queryBuilder.orderBy('category.default', 'DESC');
    queryBuilder.addOrderBy('category.name', 'ASC');
  }
}