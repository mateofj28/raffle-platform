"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveRaffle {
  id: string;
  name: string;
  status: string;
  ticketPrice: number;
  totalTickets: number;
  semester?: 1 | 2;
  /** Fecha del sorteo (YYYY-MM-DD). Se usa para el bloqueo del día del sorteo. */
  endDate?: string;
  /** Números por boleta: 1 (número simple) o 2 (pareja). */
  numbersPerTicket?: number;
  /** Cierre manual del admin: true = cerrada de inmediato. */
  manualClosed?: boolean;
  /** Cierre programado (hora Colombia) "YYYY-MM-DDTHH:mm"; null/ausente = sin programar. */
  closeAt?: string | null;
}

interface RaffleStore {
  activeRaffle: ActiveRaffle | null;
  setActiveRaffle: (raffle: ActiveRaffle | null) => void;
  clearActiveRaffle: () => void;
}

export const useRaffleStore = create<RaffleStore>()(
  persist(
    (set) => ({
      activeRaffle: null,
      setActiveRaffle: (raffle) => set({ activeRaffle: raffle }),
      clearActiveRaffle: () => set({ activeRaffle: null }),
    }),
    {
      name: "raffle-active-storage",
    }
  )
);
