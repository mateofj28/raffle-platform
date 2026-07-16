import { Skeleton } from "@heroui/react";
import { cn } from "@/utils/cn";

interface LoadingSkeletonProps {
    rows?: number;
    className?: string;
}

export function LoadingSkeleton({ rows = 3, className }: LoadingSkeletonProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {Array.from({ length: rows }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full rounded-lg" />
            ))}
        </div>
    );
}
