export interface ProductFilters {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  category?: string[];
  quality?: string[];
  minPrice?: number;
  maxPrice?: number;
  active?: boolean;
  isAdmin?: boolean;
}