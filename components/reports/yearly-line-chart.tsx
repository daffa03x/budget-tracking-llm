"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyReportPoint } from "@/lib/services/report.service";
import { formatCurrency } from "@/lib/utils";

type YearlyLineChartProps = {
  data: MonthlyReportPoint[];
  currency: string;
};

export function YearlyLineChart({ data, currency }: YearlyLineChartProps) {
  if (data.every((point) => point.expense === 0 && point.netBalance === 0)) {
    return (
      <div className="flex h-80 items-center justify-center rounded-md border border-dashed p-6 text-center">
        <p className="max-w-xs text-sm leading-6 text-muted-foreground">
          Belum ada tren transaksi pada periode ini.
        </p>
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(value) => `${Number(value) / 1000}k`}
            width={46}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value), currency),
              name === "expense" ? "Pengeluaran" : "Saldo bersih",
            ]}
            labelClassName="font-medium"
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="#E11D48"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="netBalance"
            stroke="#2563EB"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
