"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@heroui/react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginSchema, type LoginFormData } from "../schemas/login.schema";
import { useAuth } from "../hooks/use-auth";

export function LoginForm() {
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setServerError(null);
        try {
            await login(data.email, data.password);
        } catch {
            setServerError(
                "El correo electrónico o la contraseña son incorrectos."
            );
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full">
            <div className="space-y-2">
                <Input
                    {...register("email")}
                    type="email"
                    placeholder="correo@ejemplo.com"
                    aria-label="Correo electrónico"
                    disabled={isSubmitting}
                />
                {errors.email && (
                    <p className="text-sm text-danger">{errors.email.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <div className="relative">
                    <Input
                        {...register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="Contraseña"
                        aria-label="Contraseña"
                        disabled={isSubmitting}
                    />
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-default-400"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                {errors.password && (
                    <p className="text-sm text-danger">{errors.password.message}</p>
                )}
            </div>

            {serverError && (
                <p className="text-sm text-danger text-center">{serverError}</p>
            )}

            <Button
                type="submit"
                variant="primary"
                className="w-full"
                isDisabled={isSubmitting}
            >
                <LogIn size={18} />
                {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
            </Button>
        </form>
    );
}
