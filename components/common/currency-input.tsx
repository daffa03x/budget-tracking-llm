"use client";

import { cn } from "@/lib/utils";

type CurrencyInputProps = {
  id?: string;
  value?: number;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  onValueChange: (value: number) => void;
  onBlur?: () => void;
  className?: string;
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function formatInputValue(value?: number) {
  if (!value || value <= 0) {
    return "";
  }

  return numberFormatter.format(value);
}

export function CurrencyInput({
  id,
  value,
  disabled,
  onValueChange,
  onBlur,
  className,
  "aria-invalid": ariaInvalid,
}: CurrencyInputProps) {
  return (
    <div className={cn("flex h-10 overflow-hidden rounded-md border bg-background", className)}>
      <span className="flex h-full items-center border-r bg-muted px-3 text-sm font-medium text-muted-foreground">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={formatInputValue(value)}
        aria-invalid={ariaInvalid}
        onBlur={onBlur}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");

          onValueChange(digits ? Number(digits) : 0);
        }}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      />
    </div>
  );
}
