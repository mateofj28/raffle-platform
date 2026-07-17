"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocs, orderBy, query } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";
import { useAuthStore } from "@/store/auth.store";
import { customerService } from "../services/customer.service";
import type { Customer } from "@/types/api.types";

export function useCustomers() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);

  return useQuery({
    queryKey: ["customers", tenantId],
    queryFn: async (): Promise<Customer[]> => {
      if (!tenantId) return [];
      try {
        const col = tenantCollection(tenantId, "customers");
        const q = query(col, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Customer[];
      } catch {
        return [];
      }
    },
    enabled: !!tenantId,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; document: string; phone: string; whatsapp?: string; address?: string; city?: string }) =>
      customerService.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}
