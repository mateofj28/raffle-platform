import { Card, CardContent } from "@heroui/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

export function StatCard({ title, value, icon, trend }: StatCardProps) {
    return (
        <Card>
            <CardContent className="flex flex-row items-center gap-4 p-4">
                {icon && (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {icon}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-default-500 truncate">{title}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
                {trend && (
                    <div
                        className={cn(
                            "flex items-center gap-1 text-sm font-medium",
                            trend.isPositive ? "text-success" : "text-danger"
                        )}
                    >
                        {trend.isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                        ) : (
                            <TrendingDown className="h-4 w-4" />
                        )}
                        <span>{trend.value}%</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
