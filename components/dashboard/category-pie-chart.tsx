"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CategoryBreakdownPoint } from "@/lib/services/report.service";
import { formatCurrency } from "@/lib/utils";

type CategoryPieChartProps = {
  data: CategoryBreakdownPoint[];
  currency: string;
};

export function CategoryPieChart({ data, currency }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed p-6 text-center">
        <p className="max-w-xs text-sm leading-6 text-muted-foreground">
          Belum ada pengeluaran pada bulan ini.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <div className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId ?? "uncategorized"} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value), currency), "Pengeluaran"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.slice(0, 6).map((entry) => (
          <div key={entry.categoryId ?? "uncategorized"} className="flex items-center gap-3">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.name}</p>
              <p className="text-xs text-muted-foreground">{entry.transactionCount} transaksi</p>
            </div>
            <p className="whitespace-nowrap text-sm font-semibold">
              {formatCurrency(entry.amount, currency)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
