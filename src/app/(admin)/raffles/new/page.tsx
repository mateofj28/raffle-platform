"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { RaffleForm } from "@/features/raffles/components/raffle-form";
import { useCreateRaffle } from "@/features/raffles/hooks/use-raffles";
import type { CreateRaffleFormData } from "@/features/raffles/schemas/raffle.schema";

export default function NewRafflePage() {
    const router = useRouter();
    const createRaffle = useCreateRaffle();

    const handleSubmit = async (data: CreateRaffleFormData) => {
        await createRaffle.mutateAsync(data);
        router.push("/raffles");
    };

    return (
        <div>
            <PageHeader title="Nueva Rifa" description="Crea una nueva rifa" />
            <RaffleForm onSubmit={handleSubmit} isLoading={createRaffle.isPending} />
        </div>
    );
}
