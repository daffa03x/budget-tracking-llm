import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type MonthSelectorProps = {
  month: number;
  year: number;
};

function getMonthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function addMonths(month: number, year: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function hrefFor(month: number, year: number) {
  return `/?month=${month}&year=${year}`;
}

export function MonthSelector({ month, year }: MonthSelectorProps) {
  const previous = addMonths(month, year, -1);
  const next = addMonths(month, year, 1);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-1 text-card-foreground">
      <Link
        href={hrefFor(previous.month, previous.year)}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Bulan sebelumnya"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
      <div className="flex h-8 min-w-44 items-center justify-center gap-2 px-2 text-sm font-medium">
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>{getMonthLabel(month, year)}</span>
      </div>
      <Link
        href={hrefFor(next.month, next.year)}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Bulan berikutnya"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
