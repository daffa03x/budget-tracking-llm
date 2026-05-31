import {
  Banknote,
  Briefcase,
  Car,
  CircleEllipsis,
  Clapperboard,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Plane,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const fallbackColor = "#64748B";

export const categoryIconMap: Record<string, LucideIcon> = {
  Banknote,
  Briefcase,
  Car,
  CircleEllipsis,
  Clapperboard,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Plane,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
};

export const categoryIconOptions = Object.keys(categoryIconMap);

type CategoryBadgeProps = {
  name: string;
  icon?: string | null;
  color?: string | null;
  className?: string;
};

export function CategoryBadge({ name, icon, color, className }: CategoryBadgeProps) {
  const Icon = icon ? (categoryIconMap[icon] ?? Tag) : Tag;
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
