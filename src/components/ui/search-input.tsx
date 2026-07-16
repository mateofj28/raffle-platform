"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { SearchField, SearchFieldGroup, SearchFieldInput, SearchFieldSearchIcon } from "@heroui/react";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function SearchInput({
    value,
    onChange,
    placeholder = "Buscar...",
}: SearchInputProps) {
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const debouncedOnChange = useCallback(
        (newValue: string) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                onChange(newValue);
            }, 300);
        },
        [onChange]
    );

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <SearchField
            value={localValue}
            onChange={(val) => {
                setLocalValue(val);
                debouncedOnChange(val);
            }}
            className="max-w-xs"
            aria-label={placeholder}
        >
            <SearchFieldGroup>
                <SearchFieldSearchIcon />
                <SearchFieldInput placeholder={placeholder} />
            </SearchFieldGroup>
        </SearchField>
    );
}
