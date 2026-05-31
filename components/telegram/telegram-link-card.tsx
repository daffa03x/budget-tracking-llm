// components/telegram/telegram-link-card.tsx
"use client";

import { useState } from "react";

type LinkStatus = {
  linked: boolean;
  telegram_username: string | null;
  telegram_name: string | null;
  linked_at: string | null;
};

type DeepLinkData = {
  deep_link: string;
  expires_in: string;
  already_linked?: boolean;
};

export function TelegramLinkCard({ initialStatus }: { initialStatus: LinkStatus }) {
  const [status, setStatus] = useState<LinkStatus>(initialStatus);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data: DeepLinkData = await res.json();
      if (data.already_linked) {
        await refreshStatus();
      } else {
        setDeepLink(data.deep_link);
        setExpiresIn(data.expires_in);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    const res = await fetch("/api/telegram/link");
    const data: LinkStatus = await res.json();
    setStatus(data);
    if (data.linked) setDeepLink(null);
  }

  async function handleUnlink() {
    if (!confirm("Putuskan koneksi Telegram? Kamu perlu link ulang untuk menggunakan bot.")) return;
    setLoading(true);
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
      setStatus({ linked: false, telegram_username: null, telegram_name: null, linked_at: null });
      setDeepLink(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!deepLink) return;
    await navigator.clipboard.writeText(deepLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (status.linked) {
    const since = status.linked_at
      ? new Date(status.linked_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Telegram Bot</h3>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            ✓ Terhubung
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {status.telegram_name ?? ""}{status.telegram_username ? ` (@${status.telegram_username})` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Terhubung sejak {since}</p>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="text-sm text-destructive hover:underline disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Putuskan Koneksi"}
        </button>
      </div>
    );
  }

  if (deepLink) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-semibold">Telegram Bot</h3>
        <p className="text-sm text-muted-foreground">
          Klik tombol di bawah untuk membuka Telegram dan menghubungkan akun.
        </p>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90"
        >
          Buka di Telegram →
        </a>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={deepLink}
            className="flex-1 text-xs border rounded px-2 py-1 bg-muted truncate"
          />
          <button
            onClick={handleCopy}
            className="text-xs border rounded px-2 py-1 whitespace-nowrap hover:bg-muted"
          >
            {copied ? "Disalin!" : "Salin"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Link berlaku {expiresIn}.</p>
        <button
          onClick={refreshStatus}
          className="text-sm text-primary hover:underline"
        >
          Cek Status Koneksi
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold">Telegram Bot</h3>
      <p className="text-sm text-muted-foreground">
        Catat keuangan via teks, voice note, dan foto struk langsung dari Telegram.
      </p>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Hubungkan Telegram"}
      </button>
    </div>
  );
}
