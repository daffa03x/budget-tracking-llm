import { Wallet } from "lucide-react";

import { categoryIconMap, categoryIconOptions } from "@/components/common/category-badge";
import { cn } from "@/lib/utils";

const fallbackColor = "#2563EB";

export const pocketIconOptions = categoryIconOptions;

type PocketBadgeProps = {
  name: string;
  icon?: string | null;
  color?: string | null;
  className?: string;
};

export function PocketBadge({ name, icon, color, className }: PocketBadgeProps) {
  const Icon = icon ? (categoryIconMap[icon] ?? Wallet) : Wallet;
  const accentColor = color ?? fallbackColor;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground",
        className,
      )}
    >
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-white"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      >
        <Icon className="size-3.5" />
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}
