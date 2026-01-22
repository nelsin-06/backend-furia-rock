export interface CategoryFilters {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  active?: boolean;
  default?: boolean;
  includeChildren?: boolean; // Si es true, incluye todas las categorías (padres e hijas)
}