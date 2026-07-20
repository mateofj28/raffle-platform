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

    const isRaffleSelection = pathname === "/raffles" || pathname === "/raffles/new";
    const showShell = activeRaffle && !isRaffleSelection;

    return (
        <AuthGuard requiredRole={ROLES.ADMIN}>
            {showShell ? (
              <div className="flex h-dvh overflow-hidden">
                  {/* Sidebar: fixed height, scrolls internally if needed */}
                  <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                  {/* Right panel: header fixed + content scrolls */}
                  <div className="flex flex-1 flex-col h-dvh overflow-hidden">
                      <Header onMenuToggle={() => setSidebarOpen(true)} />
                      <main className="flex-1 overflow-y-auto p-4 md:p-6">
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
