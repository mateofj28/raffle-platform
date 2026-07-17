"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocs, orderBy, query } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import { useAuthStore } from "@/store/auth.store";
import { vendorService } from "../services/vendor.service";
import type { Vendor } from "@/types/api.types";

export function useVendors() {
    const tenantId = useAuthStore((s) => s.user?.tenantId);

    return useQuery({
        queryKey: ["vendors", tenantId],
        queryFn: async (): Promise<Vendor[]> => {
            if (!tenantId) return [];
            try {
                const col = tenantCollection(tenantId, "vendors");
                const q = query(col, orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Vendor[];
            } catch {
                return [];
            }
        },
        enabled: !!tenantId,
    });
}

export function useCreateVendor() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (data: { name: string; document: string; phone: string; whatsapp?: string; userId?: string }) =>
          vendorService.create({ ...data, userId: data.userId || "" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
}
