"use client";

import Link from "next/link";
import { Button, Card, CardContent } from "@heroui/react";
import { Ticket, Users, DollarSign, BarChart3, Shield, Zap, ArrowRight, CheckCircle } from "lucide-react";

const STATS = [
  { value: "10,000", label: "Boletas por rifa" },
  { value: "30%", label: "Comisión automática" },
  { value: "100%", label: "Auditoría digital" },
  { value: "$0", label: "Boletas perdidas" },
];

const FEATURES = [
  {
    icon: Ticket,
    color: "text-amber-400 bg-amber-400/10",
    title: "Control total de boletas",
    description: "Asigna, vende, cobra y rastrea cada boleta. Ve en tiempo real cuáles están disponibles, vendidas o pagadas.",
  },
  {
    icon: Users,
    color: "text-blue-400 bg-blue-400/10",
    title: "Vendedores organizados",
    description: "Cada vendedor ve solo sus boletas. Las comisiones se calculan solas. Sabes exactamente cuánto deben entregar.",
  },
  {
    icon: DollarSign,
    color: "text-emerald-400 bg-emerald-400/10",
    title: "Finanzas sin errores",
    description: "Pagos, abonos y reversiones con registro inmutable. Nunca se pierde un movimiento financiero.",
  },
  {
    icon: BarChart3,
    color: "text-purple-400 bg-purple-400/10",
    title: "Dashboard inteligente",
    description: "Métricas de venta, progreso, recaudo y ganancias actualizadas en tiempo real para cada rifa.",
  },
  {
    icon: Shield,
    color: "text-rose-400 bg-rose-400/10",
    title: "Seguridad y auditoría",
    description: "Cada operación queda registrada: quién, cuándo y qué hizo. Datos protegidos por tenant.",
  },
  {
    icon: Zap,
    color: "text-cyan-400 bg-cyan-400/10",
    title: "Rápido y moderno",
    description: "Interfaz profesional, responsive, modo oscuro. Carga en segundos, funciona en cualquier dispositivo.",
  },
];

const STEPS = [
  { number: "1", title: "Crea tu rifa", description: "Define el premio, precio de boleta y cantidad. Las boletas se generan automáticamente." },
  { number: "2", title: "Asigna vendedores", description: "Toca las boletas y asígnalas. Cada vendedor solo ve lo suyo." },
  { number: "3", title: "Cobra y gana", description: "Registra pagos y abonos. Las comisiones y ganancias se calculan solas." },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Ticket className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Raffle Platform</span>
        </div>
        <Link href="/login">
          <Button variant="primary" size="sm">Iniciar sesión</Button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <Zap className="h-3 w-3" /> Plataforma de administración de rifas
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
          Deja la libreta.<br />
          <span className="text-primary">Administra tus rifas</span> como un profesional.
        </h1>
        <p className="text-lg text-default-500 max-w-2xl mx-auto mb-10">
          Controla boletas, vendedores, pagos y comisiones desde un solo panel.
          Sin errores, sin boletas perdidas, sin cuentas en papel.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login">
            <Button variant="primary" size="lg">
              Comenzar ahora <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center p-6 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="text-xs text-default-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Todo lo que necesitas</h2>
          <p className="text-default-500">Una sola plataforma para administrar todo tu negocio de rifas</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border border-zinc-800">
                <CardContent className="p-6">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg mb-4 ${feature.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-default-500">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Así de simple</h2>
          <p className="text-default-500">Tres pasos para tener tu rifa bajo control</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-bold mb-4">
                {step.number}
              </div>
              <h3 className="font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-default-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-20 max-w-3xl mx-auto text-center">
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="p-10">
            <h2 className="text-2xl font-bold mb-3">¿Listo para dejar el papel?</h2>
            <p className="text-default-500 mb-6">
              Empieza a administrar tus rifas de forma profesional. Sin costo de instalación.
            </p>
            <Link href="/login">
              <Button variant="primary" size="lg">
                Iniciar sesión <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6 text-center">
        <p className="text-xs text-default-500">
          © 2026 Raffle Platform. Administración integral de rifas.
        </p>
      </footer>
    </div>
  );
}
