// Common API and utility types

export interface APIResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

export interface FormErrors {
  [key: string]: string | string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
