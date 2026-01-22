export interface ProductFilters {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  category?: string[];
  quality?: string[];
  color?: string[];
  minPrice?: number;
  maxPrice?: number;
  active?: boolean;
  isAdmin?: boolean;
}