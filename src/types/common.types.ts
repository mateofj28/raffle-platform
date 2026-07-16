// ==========================================
// Common Types
// ==========================================

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface ApiError {
    code: string;
    message: string;
    fields?: Record<string, string>;
}

export interface SelectOption {
    label: string;
    value: string;
}

export interface DateRange {
    startDate: string;
    endDate: string;
}
