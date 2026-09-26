"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, DatePicker, DateField, Calendar } from "@heroui/react";
import { Pencil } from "lucide-react";
import { createRaffleSchema, type CreateRaffleFormData } from "../schemas/raffle.schema";
import { parseDate, today, getLocalTimeZone, type CalendarDate } from "@internationalized/date";
import { makeCapitalizedRegister } from "@/utils/capitalize-field";

/** Nombre por defecto de la rifa. Siempre es el mismo; lo que cambia es el
 *  semestre/año, la descripción y los premios. Se puede editar si algún día
 *  se decide cambiarlo (botón del lápiz). */
const DEFAULT_RAFFLE_NAME = "Las dos primas del año";

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
    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<CreateRaffleFormData>({
        resolver: zodResolver(createRaffleSchema),
        defaultValues: {
            name: DEFAULT_RAFFLE_NAME,
            numbersPerTicket: 1,
            prizeValue: 0,
            ticketPrice: 60000,
            ...defaultValues,
        },
    });

    // register que capitaliza la primera letra (solo campos de texto).
    const capRegister = makeCapitalizedRegister(register, setValue);

    // El nombre arranca en solo lectura (siempre "Las dos primas del año").
    // El lápiz lo habilita por si algún día se quiere cambiar.
    const [nameEditable, setNameEditable] = useState(false);

    const startDateValue = watch("startDate");

    const todayDate = today(getLocalTimeZone());
    const minEndDate = startDateValue ? parseDate(startDateValue).add({ days: 1 }) : todayDate.add({ days: 1 });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Nombre</label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setNameEditable((v) => !v)}
                            aria-label={nameEditable ? "Bloquear nombre" : "Editar nombre"}
                            title={nameEditable ? "Bloquear nombre" : "Editar nombre"}
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${nameEditable ? "border-primary bg-primary/10 text-primary" : "border-default-200 bg-default-50 text-default-500 hover:text-primary hover:border-primary/40"}`}
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        <input
                            {...capRegister("name")}
                            readOnly={!nameEditable}
                            placeholder="Nombre de la rifa"
                            className={`w-full rounded-lg border border-default-200 px-3 py-2 text-sm outline-none focus:border-primary ${nameEditable ? "bg-default-50" : "bg-default-100 text-default-600 cursor-default"}`}
                        />
                    </div>
                    {!nameEditable && (
                        <p className="text-xs text-default-400 mt-1">El nombre es fijo. Usa el lápiz solo si necesitas cambiarlo.</p>
                    )}
                    {errors.name && <p className="text-sm text-danger mt-1">{errors.name.message}</p>}
                </div>

                {/* Descripción */}
                <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Descripción</label>
                    <textarea
                        {...capRegister("description")}
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
                        {...capRegister("prize")}
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

                {/* Lotería */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Lotería</label>
                    <input
                        {...capRegister("lottery")}
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
                    <Controller
                        name="numbersPerTicket"
                        control={control}
                        render={({ field }) => (
                            <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={field.name}
                                        checked={field.value === 1}
                                        onChange={() => field.onChange(1)}
                                        className="accent-primary w-4 h-4"
                                    />
                                    <span className="text-sm">1 número</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={field.name}
                                        checked={field.value === 2}
                                        onChange={() => field.onChange(2)}
                                        className="accent-primary w-4 h-4"
                                    />
                                    <span className="text-sm">2 números</span>
                                </label>
                            </div>
                        )}
                    />
                    {errors.numbersPerTicket && <p className="text-sm text-danger mt-1">{errors.numbersPerTicket.message}</p>}
                </div>
            </div>

            <Button type="submit" variant="primary" isDisabled={isLoading}>
                {isLoading ? "Guardando..." : "Crear Rifa"}
            </Button>
        </form>
    );
}
