export interface OrderFilters {
  page?: number;
  limit?: number;
  sortByDate?: 'asc' | 'desc';
  customerName?: string;
  customerEmail?: string;
  status?: string[];
  trackingStatus?: string[];
}
