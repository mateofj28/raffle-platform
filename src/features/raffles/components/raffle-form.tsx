"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, DatePicker, DateField, Calendar } from "@heroui/react";
import { createRaffleSchema, type CreateRaffleFormData } from "../schemas/raffle.schema";
import { parseDate, today, getLocalTimeZone, type CalendarDate } from "@internationalized/date";

interface RaffleFormProps {
    onSubmit: (data: CreateRaffleFormData) => void;
    isLoading?: boolean;
    defaultValues?: Partial<CreateRaffleFormData>;
}

function formatNumber(value: string): string {
    const num = value.replace(/\D/g, "");
    if (!num) return "";
    return parseInt(num).toLocaleString("es-CO");
}

function CurrencyInput({ value, onChange, placeholder }: { value: number | undefined; onChange: (val: number) => void; placeholder?: string }) {
    const displayValue = value ? value.toLocaleString("es-CO") : "";

    return (
        <input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                onChange(raw ? parseInt(raw) : 0);
            }}
            placeholder={placeholder}
            className="w-full rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm outline-none focus:border-primary"
        />
    );
}

export function RaffleForm({ onSubmit, isLoading, defaultValues }: RaffleFormProps) {
    const { register, handleSubmit, control, watch, formState: { errors } } = useForm<CreateRaffleFormData>({
        resolver: zodResolver(createRaffleSchema),
        defaultValues: {
            numbersPerTicket: 1,
            prizeValue: 0,
            ticketPrice: 60000,
            ...defaultValues,
        },
    });

    const startDateValue = watch("startDate");
    const endDateValue = watch("endDate");

    const todayDate = today(getLocalTimeZone());
    const minEndDate = startDateValue ? parseDate(startDateValue).add({ days: 1 }) : todayDate.add({ days: 1 });
    const minDrawDate = endDateValue ? parseDate(endDateValue) : minEndDate;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Nombre</label>
                    <input
                        {...register("name")}
                        placeholder="Nombre de la rifa"
                        className="w-full rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    {errors.name && <p className="text-sm text-danger mt-1">{errors.name.message}</p>}
                </div>

                {/* Descripción */}
                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Descripción</label>
                    <textarea
                        {...register("description")}
                        placeholder="Descripción de la rifa"
                        className="w-full rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm outline-none focus:border-primary"
                        rows={3}
                    />
                    {errors.description && <p className="text-sm text-danger mt-1">{errors.description.message}</p>}
                </div>

                {/* Premio mayor */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Premio mayor</label>
                    <input
                        {...register("prize")}
                        placeholder="Ej: Casa, Carro, Moto"
                        className="w-full rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    {errors.prize && <p className="text-sm text-danger mt-1">{errors.prize.message}</p>}
                </div>

                {/* Valor del premio */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Valor del premio (en pesos)</label>
                    <Controller
                        name="prizeValue"
                        control={control}
                        render={({ field }) => (
                            <CurrencyInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Ej: 90,000,000"
                            />
                        )}
                    />
                    {errors.prizeValue && <p className="text-sm text-danger mt-1">{errors.prizeValue.message}</p>}
                </div>

                {/* Fecha inicio */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Fecha inicio</label>
                    <Controller
                        name="startDate"
                        control={control}
                        render={({ field }) => (
                            <DatePicker
                                value={field.value ? parseDate(field.value) : null}
                                onChange={(date: CalendarDate | null) => field.onChange(date ? date.toString() : "")}
                                minValue={todayDate}
                                isDateUnavailable={(date) => date.compare(todayDate) < 0}
                            >
                                <DateField.Group>
                                    <DateField.Input>
                                        {(segment) => <DateField.Segment segment={segment} />}
                                    </DateField.Input>
                                    <DatePicker.Trigger>
                                        <DatePicker.TriggerIndicator />
                                    </DatePicker.Trigger>
                                </DateField.Group>
                                <DatePicker.Popover>
                                    <Calendar minValue={todayDate}>
                                        <Calendar.Header>
                                            <Calendar.NavButton slot="previous" />
                                            <Calendar.Heading />
                                            <Calendar.NavButton slot="next" />
                                        </Calendar.Header>
                                        <Calendar.Grid>
                                            <Calendar.GridHeader>
                                                {(day) => <Calendar.HeaderCell />}
                                            </Calendar.GridHeader>
                                            <Calendar.GridBody>
                                                {(date) => <Calendar.Cell date={date} />}
                                            </Calendar.GridBody>
                                        </Calendar.Grid>
                                    </Calendar>
                                </DatePicker.Popover>
                            </DatePicker>
                        )}
                    />
                    {errors.startDate && <p className="text-sm text-danger mt-1">{errors.startDate.message}</p>}
                </div>

                {/* Fecha fin */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Fecha fin</label>
                    <Controller
                        name="endDate"
                        control={control}
                        render={({ field }) => (
                            <DatePicker
                                value={field.value ? parseDate(field.value) : null}
                                onChange={(date: CalendarDate | null) => field.onChange(date ? date.toString() : "")}
                                minValue={minEndDate}
                                isDateUnavailable={(date) => date.compare(minEndDate) < 0}
                            >
                                <DateField.Group>
                                    <DateField.Input>
                                        {(segment) => <DateField.Segment segment={segment} />}
                                    </DateField.Input>
                                    <DatePicker.Trigger>
                                        <DatePicker.TriggerIndicator />
                                    </DatePicker.Trigger>
                                </DateField.Group>
                                <DatePicker.Popover>
                                    <Calendar minValue={minEndDate}>
                                        <Calendar.Header>
                                            <Calendar.NavButton slot="previous" />
                                            <Calendar.Heading />
                                            <Calendar.NavButton slot="next" />
                                        </Calendar.Header>
                                        <Calendar.Grid>
                                            <Calendar.GridHeader>
                                                {(day) => <Calendar.HeaderCell />}
                                            </Calendar.GridHeader>
                                            <Calendar.GridBody>
                                                {(date) => <Calendar.Cell date={date} />}
                                            </Calendar.GridBody>
                                        </Calendar.Grid>
                                    </Calendar>
                                </DatePicker.Popover>
                            </DatePicker>
                        )}
                    />
                    {errors.endDate && <p className="text-sm text-danger mt-1">{errors.endDate.message}</p>}
                </div>

                {/* Fecha sorteo */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Fecha sorteo</label>
                    <Controller
                        name="drawDate"
                        control={control}
                        render={({ field }) => (
                            <DatePicker
                                value={field.value ? parseDate(field.value) : null}
                                onChange={(date: CalendarDate | null) => field.onChange(date ? date.toString() : "")}
                                minValue={minDrawDate}
                                isDateUnavailable={(date) => date.compare(minDrawDate) < 0}
                            >
                                <DateField.Group>
                                    <DateField.Input>
                                        {(segment) => <DateField.Segment segment={segment} />}
                                    </DateField.Input>
                                    <DatePicker.Trigger>
                                        <DatePicker.TriggerIndicator />
                                    </DatePicker.Trigger>
                                </DateField.Group>
                                <DatePicker.Popover>
                                    <Calendar minValue={minDrawDate}>
                                        <Calendar.Header>
                                            <Calendar.NavButton slot="previous" />
                                            <Calendar.Heading />
                                            <Calendar.NavButton slot="next" />
                                        </Calendar.Header>
                                        <Calendar.Grid>
                                            <Calendar.GridHeader>
                                                {(day) => <Calendar.HeaderCell />}
                                            </Calendar.GridHeader>
                                            <Calendar.GridBody>
                                                {(date) => <Calendar.Cell date={date} />}
                                            </Calendar.GridBody>
                                        </Calendar.Grid>
                                    </Calendar>
                                </DatePicker.Popover>
                            </DatePicker>
                        )}
                    />
                    {errors.drawDate && <p className="text-sm text-danger mt-1">{errors.drawDate.message}</p>}
                </div>

                {/* Lotería */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Lotería</label>
                    <input
                        {...register("lottery")}
                        placeholder="Lotería asociada"
                        className="w-full rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    {errors.lottery && <p className="text-sm text-danger mt-1">{errors.lottery.message}</p>}
                </div>

                {/* Precio boleta */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Precio boleta</label>
                    <Controller
                        name="ticketPrice"
                        control={control}
                        render={({ field }) => (
                            <CurrencyInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="60,000"
                            />
                        )}
                    />
                    {errors.ticketPrice && <p className="text-sm text-danger mt-1">{errors.ticketPrice.message}</p>}
                </div>

                {/* Números por boleta */}
                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-2 block">Números por boleta</label>
                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input {...register("numbersPerTicket", { valueAsNumber: true })} type="radio" value={1} defaultChecked className="accent-primary w-4 h-4" />
                            <span className="text-sm">1 número</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input {...register("numbersPerTicket", { valueAsNumber: true })} type="radio" value={2} className="accent-primary w-4 h-4" />
                            <span className="text-sm">2 números</span>
                        </label>
                    </div>
                    {errors.numbersPerTicket && <p className="text-sm text-danger mt-1">{errors.numbersPerTicket.message}</p>}
                </div>
            </div>

            <Button type="submit" variant="primary" isDisabled={isLoading}>
                {isLoading ? "Guardando..." : "Crear Rifa"}
            </Button>
        </form>
    );
}
