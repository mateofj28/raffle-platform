"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveRaffle {
  id: string;
  name: string;
  status: string;
  ticketPrice: number;
  totalTickets: number;
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
