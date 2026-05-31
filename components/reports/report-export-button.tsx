"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

type ReportExportButtonProps = {
  href: string;
  className?: string;
};

export function ReportExportButton({ href, className }: ReportExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  return (
    <a
      href={href}
      onClick={() => {
        setIsExporting(true);
        window.setTimeout(() => setIsExporting(false), 2500);
      }}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
        className,
      )}
    >
      <Download className="size-4" aria-hidden="true" />
      {isExporting ? "Menyiapkan" : "Export CSV"}
    </a>
  );
}
