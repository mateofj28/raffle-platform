"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { RaffleForm } from "@/features/raffles/components/raffle-form";
import { useCreateRaffle } from "@/features/raffles/hooks/use-raffles";
import type { CreateRaffleFormData } from "@/features/raffles/schemas/raffle.schema";

export default function NewRafflePage() {
    const router = useRouter();
    const createRaffle = useCreateRaffle();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (data: CreateRaffleFormData) => {
      setError(null);
      try {
        await createRaffle.mutateAsync(data);
        router.push("/raffles");
    } catch (err) {
        const message = err instanceof Error ? err.message : "Error al crear la rifa";
        setError(message);
    }
  };

    return (
        <div>
            <PageHeader title="Nueva Rifa" description="Crea una nueva rifa" />
          {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                  {error}
              </div>
          )}
          <RaffleForm onSubmit={handleSubmit} isLoading={createRaffle.isPending} />
      </div>
  );
}
