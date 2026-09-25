"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { ROLES } from "@/constants/roles";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { LayoutDashboard, Ticket, CreditCard, LogOut, UserPlus } from "lucide-react";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuthStore } from "@/store/auth.store";
import { getDocs, query, where, orderBy } from "firebase/firestore";
import { tenantCollection } from "@/lib/firebase/firestore";

const VENDOR_NAV = [
    { href: "/vendor/dashboard", label: "Mi Panel", icon: LayoutDashboard },
    { href: "/vendor/tickets", label: "Mis Boletas", icon: Ticket },
    { href: "/vendor/payments", label: "Pagos", icon: CreditCard },
    { href: "/vendor/customers/new", label: "Crear Cliente", icon: UserPlus },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const tenantId = useAuthStore((s) => s.user?.tenantId);
    const [isDark, setIsDark] = useState(true);
    // hasRaffle: null mientras se comprueba, luego true/false.
    // Si no hay rifa activa, ocultamos la navegación (no tiene sentido navegar).
    const [hasRaffle, setHasRaffle] = useState<boolean | null>(null);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!tenantId) return;
        let cancelled = false;
        (async () => {
            try {
                const q = query(
                    tenantCollection(tenantId, "raffles"),
                    where("status", "in", ["active", "draft"]),
                    orderBy("createdAt", "desc")
                );
                const snap = await getDocs(q);
                if (!cancelled) setHasRaffle(!snap.empty);
            } catch (e) {
                console.error("No se pudo verificar la rifa activa", e);
                if (!cancelled) setHasRaffle(false);
            }
        })();
        return () => { cancelled = true; };
    }, [tenantId]);

    const showNav = hasRaffle === true;

    // Nombre a mostrar del usuario, corto para no romper el header.
    const displayName = user?.displayName || user?.email || "";

    // Colores del tema (para conservar la paleta actual).
    const headerBg = isDark ? "#001838" : "#FFFFFF";
    const headerBorder = isDark ? "transparent" : "#E8E8E8";
    const logoText = isDark ? "text-white" : "text-[#1F2937]";
    const mutedText = isDark ? "text-[#A0B4C8]" : "text-[#6B7280]";

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

    return (
        <AuthGuard requiredRole={ROLES.VENDOR}>
            <div className="min-h-dvh flex flex-col">
                {/* ===== Header ===== */}
                <header
                    className="sticky top-0 z-30 border-b"
                    style={{ backgroundColor: headerBg, borderColor: headerBorder }}
                >
                    {/* Fila superior: logo + usuario/tema/salir */}
                    <div className="flex h-14 items-center justify-between gap-3 px-4">
                        <Link href="/vendor/dashboard" className="flex items-center gap-2 shrink-0">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "#4A8C82" }}>
                                <Ticket className="h-4 w-4 text-white" />
                            </span>
                            <span className={cn("font-semibold whitespace-nowrap", logoText)}>Raffle Platform</span>
                        </Link>

                        {/* Navegación en ESCRITORIO (centrada) */}
                        {showNav && (
                            <nav className="hidden md:flex items-center gap-1">
                                {VENDOR_NAV.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                                active
                                                    ? (isDark ? "text-white bg-[#4A8C82]" : "text-[#2D6A5F] bg-[#D4E8E4]")
                                                    : (isDark ? "text-[#A0B4C8] hover:bg-white/10 hover:text-white" : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#4A8C82]")
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            <span>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        )}

                        <div className="flex items-center gap-1 shrink-0">
                            <span className={cn("text-sm max-w-[9rem] truncate hidden sm:inline", mutedText)}>{displayName}</span>
                            <ThemeToggle />
                            <button
                                type="button"
                                onClick={() => logout()}
                                aria-label="Cerrar sesión"
                                className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-[#F3F4F6]")}
                            >
                                <LogOut className={cn("h-4 w-4", mutedText)} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* ===== Contenido (con espacio para la barra inferior en móvil) ===== */}
                <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>

                {/* ===== Navegación inferior en MÓVIL (bottom tab bar) ===== */}
                {showNav && (
                    <nav
                        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t"
                        style={{ backgroundColor: headerBg, borderColor: isDark ? "#0E2547" : "#E8E8E8" }}
                    >
                        <div className="grid grid-cols-4">
                            {VENDOR_NAV.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                                            active
                                                ? "text-[#4A8C82]"
                                                : mutedText
                                        )}
                                    >
                                        <span className={cn(
                                            "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                                            active ? (isDark ? "bg-[#4A8C82]/20" : "bg-[#D4E8E4]") : "bg-transparent"
                                        )}>
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span className="leading-none">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                )}
            </div>
        </AuthGuard>
    );
}
