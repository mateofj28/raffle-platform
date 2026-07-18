"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { ROLES } from "@/constants/roles";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { useRaffleStore } from "@/store/raffle.store";

export default function AdminLayout({
    children,
}: {
        children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { activeRaffle } = useRaffleStore();
    const pathname = usePathname();

    // Pages that don't need the full admin shell (sidebar/header)
    const isRaffleSelection = pathname === "/raffles" || pathname === "/raffles/new";
    const showShell = activeRaffle && !isRaffleSelection;

    return (
        <AuthGuard requiredRole={ROLES.ADMIN}>
          {showShell ? (
              <div className="flex min-h-dvh">
                  <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                  <div className="flex flex-1 flex-col">
                      <Header onMenuToggle={() => setSidebarOpen(true)} />
                      <main className="flex-1 p-4 md:p-6">
                          <div className="mb-4"><Breadcrumbs /></div>
                          {children}
                      </main>
                  </div>
              </div>
          ) : (
              <div className="min-h-dvh bg-background">
                  <main className="max-w-5xl mx-auto p-6 md:p-10">
                          {children}
                      </main>
                  </div>
          )}
      </AuthGuard>
  );
}
