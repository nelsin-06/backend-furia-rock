import { SelectQueryBuilder } from 'typeorm';

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export class PaginationHelper {
  /**
   * Applies pagination to a TypeORM query builder
   * @param queryBuilder - The TypeORM SelectQueryBuilder
   * @param options - Pagination options (page and limit)
   */
  static applyPagination<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options: PaginationOptions
  ): void {
    if (options.limit && options.page) {
      const skip = (options.page - 1) * options.limit;
      queryBuilder.skip(skip).take(options.limit);
    }
  }

  /**
   * Executes a paginated query and returns the result with metadata
   * @param queryBuilder - The TypeORM SelectQueryBuilder
   * @param options - Pagination options (page and limit)
   * @returns Promise with data and pagination metadata
   */
  static async executePaginatedQuery<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options: PaginationOptions
  ): Promise<PaginatedResult<T>> {
    const total = await queryBuilder.getCount();
    
    this.applyPagination(queryBuilder, options);
    
    const data = await queryBuilder.getMany();
    console.log("🚀 ~ PaginationHelper ~ executePaginatedQuery ~ data:", data[0])

    return {
      data,
      meta: {
        total,
        page: options.page || 1,
        limit: options.limit || total,
      },
    };
  }
}