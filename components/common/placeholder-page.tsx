import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type PlaceholderPageProps = {
  title: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  children?: ReactNode;
};

export function PlaceholderPage({
  title,
  description,
  eyebrow,
  icon: Icon,
  children,
}: PlaceholderPageProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}
