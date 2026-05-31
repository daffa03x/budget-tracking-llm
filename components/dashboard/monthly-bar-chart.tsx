"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyChartPoint } from "@/lib/services/report.service";
import { formatCurrency } from "@/lib/utils";

type MonthlyBarChartProps = {
  data: MonthlyChartPoint[];
  currency: string;
};

export function MonthlyBarChart({ data, currency }: MonthlyBarChartProps) {
  if (data.every((point) => point.income === 0 && point.expense === 0)) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed p-6 text-center">
        <p className="max-w-xs text-sm leading-6 text-muted-foreground">
          Belum ada transaksi untuk ditampilkan pada grafik bulanan.
        </p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(value) => `${Number(value) / 1000}k`}
            width={44}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value), currency),
              name === "income" ? "Pemasukan" : "Pengeluaran",
            ]}
            labelClassName="font-medium"
          />
          <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="#E11D48" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
