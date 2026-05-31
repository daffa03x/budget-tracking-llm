// app/(dashboard)/settings/page.tsx
import { SettingsManager } from "@/components/settings/settings-manager";
import { TelegramLinkCard } from "@/components/telegram/telegram-link-card";
import { getSharingOverview } from "@/lib/services/sharing.service";
import { getUserProfile } from "@/lib/services/user.service";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const profile = await getUserProfile(userId);

  if (!profile) {
    throw new Error("User profile not found.");
  }

  const [sharing, telegramLink] = await Promise.all([
    getSharingOverview(userId),
    prisma.telegramLink.findFirst({
      where: { userId, linked: true },
      select: { linked: true, username: true, firstName: true, createdAt: true },
    }),
  ]);

  const initialTelegramStatus = {
    linked: !!telegramLink,
    telegram_username: telegramLink?.username ?? null,
    telegram_name: telegramLink?.firstName ?? null,
    linked_at: telegramLink?.createdAt?.toISOString() ?? null,
  };

  return (
    <div className="space-y-6">
      <SettingsManager initialProfile={profile} initialSharing={sharing} />
      <TelegramLinkCard initialStatus={initialTelegramStatus} />
    </div>
  );
}
