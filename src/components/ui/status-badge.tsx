import { Chip } from "@heroui/react";
import { RAFFLE_STATUSES, TICKET_STATUSES } from "@/constants/statuses";

const DEFAULT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    ...RAFFLE_STATUSES,
    ...TICKET_STATUSES,
};

interface StatusBadgeProps {
    status: string;
    statusConfig?: Record<string, { label: string; color: string }>;
}

export function StatusBadge({
    status,
    statusConfig = DEFAULT_STATUS_CONFIG,
}: StatusBadgeProps) {
    const config = statusConfig[status] || {
        label: status,
        color: "default",
    };

    const colorMap: Record<string, "default" | "success" | "danger" | "warning" | "accent"> = {
        default: "default",
        primary: "accent",
        secondary: "accent",
        success: "success",
        warning: "warning",
        danger: "danger",
    };

    const chipColor = colorMap[config.color] || "default";

    return (
        <Chip
            size="sm"
            color={chipColor}
            variant="soft"
        >
            {config.label}
        </Chip>
    );
}
