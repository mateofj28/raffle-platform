"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService } from "../services/vendor.service";

export function useCreateVendor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; document: string; phone: string; whatsapp?: string; userId: string }) =>
            vendorService.create(data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
    });
}

export function useVendorMetrics(vendorId: string) {
    return useQuery({
        queryKey: ["vendor-metrics", vendorId],
        queryFn: () => vendorService.getMetrics(vendorId),
        enabled: !!vendorId,
    });
}
