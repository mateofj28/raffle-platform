"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Ticket,
    Users,
    UserCircle,
    CreditCard,
    BarChart3,
    Shield,
    Settings,
    UserCog,
    X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useRaffleStore } from "@/store/raffle.store";
import { useAuthStore } from "@/store/auth.store";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const { activeRaffle } = useRaffleStore();
    const userRole = useAuthStore((s) => s.user?.role);
    const isAdmin = userRole === "admin";

    const NAV_ITEMS = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "cashier"] },
        { href: activeRaffle ? `/raffles/${activeRaffle.id}` : "/raffles", label: "Boletas", icon: Ticket, roles: ["admin", "cashier"] },
        { href: "/vendors", label: "Vendedores", icon: Users, roles: ["admin", "cashier"] },
        { href: "/customers", label: "Clientes", icon: UserCircle, roles: ["admin", "cashier"] },
        { href: "/payments", label: "Pagos", icon: CreditCard, roles: ["admin", "cashier"] },
        { href: "/cashiers", label: "Cajeros", icon: UserCog, roles: ["admin"] },
        { href: "/reports", label: "Reportes", icon: BarChart3, roles: ["admin"] },
        { href: "/audit", label: "Auditoría", icon: Shield, roles: ["admin"] },
        { href: "/settings", label: "Configuración", icon: Settings, roles: ["admin"] },
    ].filter(item => item.roles.includes(userRole || ""));

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed top-0 left-0 z-50 h-dvh w-64 flex flex-col transition-transform duration-200",
                    "md:translate-x-0 md:static md:z-auto",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
                style={{ backgroundColor: "#001838" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
                    <span className="text-lg font-semibold" style={{ color: "#E0E0E0" }}>Raffle Platform</span>
                    <button
                        onClick={onClose}
                        className="md:hidden p-1 rounded-md hover:bg-white/10"
                        style={{ color: "#E0E0E0" }}
                        aria-label="Cerrar menú"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-3">
                    <ul className="space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const isActive =
                                pathname === item.href ||
                                (item.href !== "/dashboard" &&
                                    pathname.startsWith(item.href));
                            const Icon = item.icon;

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={onClose}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                            isActive
                                                ? "text-white"
                                                : "hover:bg-white/5"
                                        )}
                                        style={{
                                            color: isActive ? "#FFFFFF" : "#E0E0E0",
                                            backgroundColor: isActive ? "#0058D0" : undefined,
                                        }}
                                    >
                                        <Icon className="h-5 w-5 shrink-0" />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>
        </>
    );
}
