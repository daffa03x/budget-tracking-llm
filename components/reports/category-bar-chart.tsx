"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CategoryBreakdownPoint } from "@/lib/services/report.service";
import { formatCurrency } from "@/lib/utils";

type CategoryBarChartProps = {
  data: CategoryBreakdownPoint[];
  currency: string;
};

export function CategoryBarChart({ data, currency }: CategoryBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-md border border-dashed p-6 text-center">
        <p className="max-w-xs text-sm leading-6 text-muted-foreground">
          Belum ada pengeluaran per kategori pada periode ini.
        </p>
      </div>
    );
  }

  const chartHeight = Math.max(320, data.length * 46);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[620px]" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value) => `${Number(value) / 1000}k`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={140}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value), currency), "Pengeluaran"]}
              labelClassName="font-medium"
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.categoryId ?? "uncategorized"} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
