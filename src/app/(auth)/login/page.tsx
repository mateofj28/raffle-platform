"use client";

import { LoginForm } from "@/features/auth/components/login-form";
import { Ticket, BarChart3, Users, Shield, Zap, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

const BENEFITS = [
    {
        icon: Ticket,
        title: "Miles de boletas",
        description: "Administra hasta 50,000 boletas por rifa con seguimiento en tiempo real.",
    },
    {
        icon: Users,
        title: "Gestión de vendedores",
        description: "Asigna boletas, rastrea ventas y calcula comisiones automáticamente.",
    },
    {
        icon: DollarSign,
        title: "Control financiero",
        description: "Pagos, abonos y reversiones con auditoría completa. Sin perder un peso.",
    },
    {
        icon: BarChart3,
        title: "Reportes en vivo",
        description: "Dashboard con métricas actualizadas: ventas, recaudo y progreso.",
    },
];

export default function LoginPage() {
    return (
      <div className="flex min-h-dvh">
          {/* Left: Login Form */}
          <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16">
              <div className="w-full max-w-md mx-auto">
                  {/* Logo */}
                  <div className="flex items-center gap-2 mb-10">
                      <div className="p-2 rounded-lg bg-primary/10">
                          <Ticket className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-xl font-bold">Raffle Platform</span>
                  </div>

                  {/* Welcome text */}
                  <h1 className="text-3xl font-bold mb-2">Bienvenido</h1>
                  <p className="text-default-500 mb-8">Ingresa tus credenciales para continuar</p>

                  {/* Form */}
                  <LoginForm />
              </div>
          </div>

          {/* Right: Benefits panel (hidden on mobile) */}
          <div className="hidden lg:flex lg:flex-1 flex-col justify-center bg-zinc-900/50 border-l border-divider/30 px-12 py-12">
              <div className="max-w-lg">
                  <h2 className="text-2xl font-bold mb-2">Administra tus rifas como un profesional</h2>
                  <p className="text-default-500 mb-10">
                      Todo lo que necesitas para gestionar boletas, vendedores, pagos y comisiones en un solo lugar.
                  </p>

                  <div className="space-y-6">
                      {BENEFITS.map((benefit) => {
                          const Icon = benefit.icon;
                          return (
                              <div key={benefit.title} className="flex gap-4">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                      <Icon className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                      <h3 className="font-semibold text-sm">{benefit.title}</h3>
                                      <p className="text-xs text-default-500 mt-0.5">{benefit.description}</p>
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  {/* Footer quote */}
                  <div className="mt-12 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <p className="text-sm text-default-400 italic">
                          "Pasamos de una libreta a controlar todo digitalmente. Las comisiones se calculan solas y nunca perdemos una boleta."
                      </p>
                      <p className="text-xs text-default-500 mt-2 font-medium">— Organizador de rifas</p>
                  </div>
              </div>
          </div>
      </div>
  );
}
