"use client";

import { Menu, Ticket } from "lucide-react";
import { Button } from "@heroui/react";
import { useRaffleStore } from "@/store/raffle.store";
import Link from "next/link";

interface HeaderProps {
    onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
    const { activeRaffle } = useRaffleStore();

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-divider/50 bg-background/70 backdrop-blur-xl backdrop-saturate-150 px-4 md:px-6">
            {/* Mobile menu button */}
            <Button
                variant="ghost"
                size="sm"
                onPress={onMenuToggle}
                className="md:hidden"
                aria-label="Abrir menú"
                isIconOnly
            >
                <Menu className="h-5 w-5" />
            </Button>

          {/* Active raffle indicator */}
          {activeRaffle ? (
              <Link href="/raffles" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold truncate max-w-[200px]">{activeRaffle.name}</span>
              </Link>
          ) : (
              <span className="text-sm text-default-500">Sin rifa seleccionada</span>
          )}

          {/* Spacer */}
            <div className="flex-1" />
      </header>
  );
}
