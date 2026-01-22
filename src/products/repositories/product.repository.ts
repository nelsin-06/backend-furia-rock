import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductFilters } from './product.repository.entity';
import { PaginationHelper } from '../../common/utils/pagination.util';

@Injectable()
export class ProductRepository {
  constructor(
    @InjectRepository(Product)
    private readonly repository: Repository<Product>,
  ) {}

  async findWithFilters(filters: ProductFilters) {
    const queryBuilder = this.repository.createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.quality', 'quality');
    
    this.applyFilters(queryBuilder, filters);
    this.applySorting(queryBuilder, filters.sort);

    return await PaginationHelper.executePaginatedQuery(queryBuilder, filters);
  }

  create(entityLike: Partial<Product>): Product {
    return this.repository.create(entityLike);
  }

  save(entity: Product): Promise<Product> {
    return this.repository.save(entity);
  }

  findOne(options: any): Promise<Product | null> {
    // Always include categories and quality when finding one product
    if (!options.relations) {
      options.relations = ['categories', 'quality'];
    } else {
      if (!options.relations.includes('categories')) {
        options.relations.push('categories');
      }
      if (!options.relations.includes('quality')) {
        options.relations.push('quality');
      }
    }
    return this.repository.findOne(options);
  }

  update(id: string, updateData: Partial<Product>): Promise<any> {
    return this.repository.update(id, updateData);
  }

  delete(id: string): Promise<any> {
    return this.repository.delete(id);
  }

  find(): Promise<Product[]> {
    return this.repository.find();
  }

  private applyFilters(queryBuilder: SelectQueryBuilder<Product>, filters: ProductFilters) {
    if (filters.q) {
      queryBuilder.andWhere('product.name ILIKE :search', {
        search: `%${filters.q}%`,
      });
    }

    if (filters.category && filters.category.length > 0) {
      queryBuilder.andWhere('categories.id IN (:...categories)', {
        categories: filters.category,
      });
    }

    if (filters.quality && filters.quality.length > 0) {
      queryBuilder.andWhere('product.qualityId IN (:...qualities)', {
        qualities: filters.quality,
      });
    }

    if (filters.color && filters.color.length > 0) {
      // Filter products that have at least one variant with a matching colorId
      // Using json_array_elements since variables column is type 'json' not 'jsonb'
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM json_array_elements(product.variables) AS variant
          WHERE (variant::jsonb)->>'colorId' IN (:...colors)
        )`,
        { colors: filters.color }
      );
    }

    if (filters.minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', {
        minPrice: filters.minPrice,
      });
    }

    if (filters.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }

    // Handle admin vs public product visibility
    if (filters.isAdmin === true) {
      // Admin mode: show all products (both active and inactive)
      if (filters.active !== undefined) {
        queryBuilder.andWhere('product.active = :active', {
          active: filters.active,
        });
      }
      // If isAdmin=true and no active filter, show ALL products
    } else {
      // Public mode: default to active products only
      if (filters.active !== undefined) {
        queryBuilder.andWhere('product.active = :active', {
          active: filters.active,
        });
      } else {
        // Default behavior: only show active products
        queryBuilder.andWhere('product.active = :active', {
          active: true,
        });
      }
    }
  }

  private applySorting(queryBuilder: SelectQueryBuilder<Product>, sort?: string) {
    const orderMap = new Map<string, Record<string, 'ASC' | 'DESC'>>([
      ['priceDesc', { 'product.price': 'DESC' }],
      ['priceAsc', { 'product.price': 'ASC' }],
      ['dateDesc', { 'product.createdAt': 'DESC' }],
      ['dateAsc', { 'product.createdAt': 'ASC' }],
    ]);

    const order = orderMap.get(sort) ?? { 'product.createdAt': 'DESC' };

    Object.entries(order).forEach(([key, direction]) => {
      queryBuilder.addOrderBy(key, direction);
    });
  }
}
