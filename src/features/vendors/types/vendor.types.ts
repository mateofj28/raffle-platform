import type { Vendor, VendorStatus, VendorMetrics } from "@/types/api.types";

export interface CreateVendorInput {
    name: string;
    document: string;
    phone: string;
    whatsapp?: string;
    email: string;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {
    id: string;
    status?: VendorStatus;
}

export interface VendorFilters {
    status?: VendorStatus;
    page?: number;
    pageSize?: number;
}

export type { Vendor, VendorStatus, VendorMetrics };
