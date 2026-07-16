"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@heroui/react";
import { createRaffleSchema, type CreateRaffleFormData } from "../schemas/raffle.schema";

interface RaffleFormProps {
    onSubmit: (data: CreateRaffleFormData) => void;
    isLoading?: boolean;
    defaultValues?: Partial<CreateRaffleFormData>;
}

export function RaffleForm({ onSubmit, isLoading, defaultValues }: RaffleFormProps) {
    const { register, handleSubmit, formState: { errors } } = useForm<CreateRaffleFormData>({
        resolver: zodResolver(createRaffleSchema),
        defaultValues,
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Nombre</label>
                    <Input {...register("name")} placeholder="Nombre de la rifa" />
                    {errors.name && <p className="text-sm text-danger mt-1">{errors.name.message}</p>}
                </div>

                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Descripción</label>
                    <textarea {...register("description")} placeholder="Descripción" className="w-full rounded-lg border border-default-200 p-2 text-sm" rows={3} />
                    {errors.description && <p className="text-sm text-danger mt-1">{errors.description.message}</p>}
                </div>

                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Premio</label>
                    <Input {...register("prize")} placeholder="Premio principal" />
                    {errors.prize && <p className="text-sm text-danger mt-1">{errors.prize.message}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Fecha inicio</label>
                    <Input {...register("startDate")} type="date" />
                    {errors.startDate && <p className="text-sm text-danger mt-1">{errors.startDate.message}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Fecha fin</label>
                    <Input {...register("endDate")} type="date" />
                    {errors.endDate && <p className="text-sm text-danger mt-1">{errors.endDate.message}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Fecha sorteo</label>
                    <Input {...register("drawDate")} type="date" />
                    {errors.drawDate && <p className="text-sm text-danger mt-1">{errors.drawDate.message}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Lotería</label>
                    <Input {...register("lottery")} placeholder="Lotería asociada" />
                    {errors.lottery && <p className="text-sm text-danger mt-1">{errors.lottery.message}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Precio boleta</label>
                    <Input {...register("ticketPrice", { valueAsNumber: true })} type="number" placeholder="60000" />
                    {errors.ticketPrice && <p className="text-sm text-danger mt-1">{errors.ticketPrice.message}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Total boletas</label>
                    <Input {...register("totalTickets", { valueAsNumber: true })} type="number" placeholder="10000" />
                    {errors.totalTickets && <p className="text-sm text-danger mt-1">{errors.totalTickets.message}</p>}
                </div>
            </div>

            <Button type="submit" variant="primary" isDisabled={isLoading}>
                {isLoading ? "Guardando..." : "Crear Rifa"}
            </Button>
        </form>
    );
}
