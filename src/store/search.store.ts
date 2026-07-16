"use client";

import { create } from "zustand";

interface SearchStore {
    query: string;
    isOpen: boolean;
    setQuery: (query: string) => void;
    setOpen: (open: boolean) => void;
    reset: () => void;
}

export const useSearchStore = create<SearchStore>()((set) => ({
    query: "",
    isOpen: false,

    setQuery: (query) => set({ query }),

    setOpen: (open) => set({ isOpen: open }),

    reset: () => set({ query: "", isOpen: false }),
}));
