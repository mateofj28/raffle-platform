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
          <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-default-500 uppercase tracking-wide">{title}</p>
                  {icon && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
