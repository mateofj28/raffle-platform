import { Card, CardContent } from "@heroui/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/utils/cn";

const ICON_COLORS = [
    { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-600 dark:text-teal-400" },
    { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
    { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
    { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
    { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400" },
    { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400" },
];

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    iconColorIndex?: number;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

export function StatCard({ title, value, icon, iconColorIndex, trend }: StatCardProps) {
    // Auto-assign color based on title hash if not provided
    const colorIdx = iconColorIndex ?? (title.length % ICON_COLORS.length);
    const iconColor = ICON_COLORS[colorIdx];

    return (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-default-500 uppercase tracking-wide">{title}</p>
                  {icon && (
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconColor.bg} ${iconColor.text}`}>
                          {icon}
                      </div>
                  )}
              </div>
              <div className="flex items-end justify-between">
                  <p className="text-2xl font-bold leading-none">{value}</p>
                  {trend && (
                      <div className={cn("flex items-center gap-1 text-xs font-medium", trend.isPositive ? "text-success" : "text-danger")}>
                          {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          <span>{trend.value}%</span>
                      </div>
                  )}
              </div>
          </CardContent>
      </Card>
  );
}
