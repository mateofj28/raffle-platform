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
    X,
} from "lucide-react";
import { cn } from "@/utils/cn";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const NAV_ITEMS = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/raffles", label: "Rifas", icon: Ticket },
    { href: "/vendors", label: "Vendedores", icon: Users },
    { href: "/customers", label: "Clientes", icon: UserCircle },
    { href: "/payments", label: "Pagos", icon: CreditCard },
    { href: "/reports", label: "Reportes", icon: BarChart3 },
    { href: "/audit", label: "Auditoría", icon: Shield },
    { href: "/settings", label: "Configuración", icon: Settings },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

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
                    "fixed top-0 left-0 z-50 h-dvh w-64 bg-content1 border-r border-divider flex flex-col transition-transform duration-200",
                    "md:translate-x-0 md:static md:z-auto",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-divider">
                    <span className="text-lg font-semibold">Raffle Platform</span>
                    <button
                        onClick={onClose}
                        className="md:hidden p-1 rounded-md hover:bg-default-100"
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
                                                ? "bg-primary/10 text-primary"
                                                : "text-default-600 hover:bg-default-100 hover:text-foreground"
                                        )}
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
