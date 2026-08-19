"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginSchema, type LoginFormData } from "../schemas/login.schema";
import { useAuth } from "../hooks/use-auth";

/**
 * Converts a username to email for Firebase Auth.
 * If the input already contains @, use it as-is.
 * Otherwise, append @rifas.app
 */
function toEmail(username: string): string {
    return username.includes("@") ? username : `${username.toLowerCase().trim()}@rifas.app`;
}

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
            const email = toEmail(data.username);
            await login(email, data.password);
        } catch {
            setServerError("Usuario o contraseña incorrectos.");
        }
    };

    const inputClass = "w-full rounded-xl px-4 py-3 text-sm border border-[#CBD5E1] bg-[#E2E8F0] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0058CD] focus:bg-white transition-colors dark:bg-[#1A2F50] dark:border-[#2A4570] dark:text-[#E2E8F0] dark:placeholder:text-[#6B8AAF] dark:focus:border-[#3B82F6]";

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 w-full max-w-sm">
            <div className="space-y-1.5">
                <input
                    {...register("username")}
                    type="text"
                    placeholder="Usuario"
                    aria-label="Usuario"
                    autoComplete="username"
                    disabled={isSubmitting}
                    className={inputClass}
                />
                {errors.username && (
                    <p className="text-xs text-danger">{errors.username.message}</p>
                )}
            </div>

            <div className="space-y-1.5">
                <div className="relative">
                    <input
                        {...register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="Contraseña"
                        aria-label="Contraseña"
                        autoComplete="current-password"
                        disabled={isSubmitting}
                        className={`${inputClass} pr-10`}
                    />
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                {errors.password && (
                    <p className="text-xs text-danger">{errors.password.message}</p>
                )}
            </div>

            {serverError && (
                <p className="text-xs text-danger text-center">{serverError}</p>
            )}

            <Button
                type="submit"
                variant="primary"
                className="w-full"
                isDisabled={isSubmitting}
            >
                <LogIn size={16} />
                {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
            </Button>
        </form>
    );
}
