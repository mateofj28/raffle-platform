"use client";

import { useState, useMemo } from "react";
import { DEFAULT_PAGE_SIZE } from "@/constants/statuses";

interface UsePaginationOptions {
    initialPage?: number;
    initialPageSize?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
    const {
        initialPage = 1,
        initialPageSize = DEFAULT_PAGE_SIZE,
    } = options;

    const [page, setPage] = useState(initialPage);
    const [pageSize, setPageSize] = useState(initialPageSize);

    const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

    return {
        page,
        pageSize,
        setPage,
        setPageSize,
        offset,
    };
}
