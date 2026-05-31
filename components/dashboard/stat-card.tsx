import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone?: string;
};

export function StatCard({ label, value, helper, icon: Icon, tone }: StatCardProps) {
  return (
    <article className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={cn("size-5 text-muted-foreground", tone)} aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </article>
  );
}
