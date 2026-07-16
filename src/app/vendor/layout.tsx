"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { ROLES } from "@/constants/roles";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { LayoutDashboard, Ticket, CreditCard, LogOut } from "lucide-react";
import { Button } from "@heroui/react";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const VENDOR_NAV = [
    { href: "/vendor/dashboard", label: "Mi Panel", icon: LayoutDashboard },
    { href: "/vendor/tickets", label: "Mis Boletas", icon: Ticket },
    { href: "/vendor/payments", label: "Pagos", icon: CreditCard },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    return (
        <AuthGuard requiredRole={ROLES.VENDOR}>
            <div className="min-h-dvh flex flex-col">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-divider bg-content1 px-4">
                    <span className="font-semibold">Raffle Platform</span>
                    <nav className="flex-1 flex items-center gap-1 ml-6">
                        {VENDOR_NAV.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                        isActive ? "bg-primary/10 text-primary" : "text-default-600 hover:bg-default-100"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                    <ThemeToggle />
                    <span className="text-sm text-default-500 hidden md:inline">{user?.displayName || user?.email}</span>
                    <Button variant="ghost" size="sm" isIconOnly onPress={() => logout()} aria-label="Cerrar sesión">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </header>
                <main className="flex-1 p-4 md:p-6">{children}</main>
            </div>
        </AuthGuard>
    );
}
