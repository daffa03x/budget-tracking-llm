"use client";

import { type FormEvent, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  MailPlus,
  MonitorCheck,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  type SharingOverview,
  SharingApiError,
  useCreateSharingInvitation,
  useDeleteSharingConnection,
  useSharing,
  useUpdateSharingInvitation,
} from "@/hooks/useSharing";
import {
  ApiRequestError,
  type UserProfile,
  useDeleteUserAccount,
  useDeleteUserTransactions,
  useUpdateUserPassword,
  useUpdateUserProfile,
  useUserProfile,
} from "@/hooks/useUserProfile";

type SettingsManagerProps = {
  initialProfile: UserProfile;
  initialSharing: SharingOverview;
};

type FieldErrors = Record<string, string | undefined>;
type SettingsTab = "profile" | "security" | "sharing" | "danger";

const currencies = [
  { value: "IDR", label: "IDR" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "SGD", label: "SGD" },
  { value: "JPY", label: "JPY" },
];

const settingsTabs: Array<{
  value: SettingsTab;
  label: string;
  icon: typeof UserRound;
}> = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "security", label: "Security", icon: KeyRound },
  { value: "sharing", label: "Sharing", icon: UsersRound },
  { value: "danger", label: "Danger Zone", icon: AlertTriangle },
];

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getMutationError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getFieldErrors(error: unknown) {
  const requestError =
    error instanceof ApiRequestError || error instanceof SharingApiError ? error : null;

  if (!requestError?.fields) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(requestError.fields).map(([key, messages]) => [key, messages?.[0]]),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}

export function SettingsManager({ initialProfile, initialSharing }: SettingsManagerProps) {
  const { update: updateSession } = useSession();
  const profileQuery = useUserProfile(initialProfile);
  const sharingQuery = useSharing(initialSharing);
  const updateProfile = useUpdateUserProfile();
  const updatePassword = useUpdateUserPassword();
  const deleteTransactions = useDeleteUserTransactions();
  const deleteAccount = useDeleteUserAccount();
  const createSharingInvitation = useCreateSharingInvitation();
  const updateSharingInvitation = useUpdateSharingInvitation();
  const deleteSharingConnection = useDeleteSharingConnection();
  const profile = profileQuery.data;
  const sharing = sharingQuery.data;

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [preferencesErrors, setPreferencesErrors] = useState<FieldErrors>({});
  const [preferencesMessage, setPreferencesMessage] = useState<string | null>(null);
  const [sharingErrors, setSharingErrors] = useState<FieldErrors>({});
  const [sharingMessage, setSharingMessage] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [wipeErrors, setWipeErrors] = useState<FieldErrors>({});
  const [wipeMessage, setWipeMessage] = useState<string | null>(null);
  const [accountErrors, setAccountErrors] = useState<FieldErrors>({});
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextEmail = formText(formData, "email").toLowerCase();
    const emailChanged = nextEmail !== profile.email;

    setProfileErrors({});
    setProfileMessage(null);

    try {
      const nextProfile = await updateProfile.mutateAsync({
        name: formText(formData, "name"),
        image: formText(formData, "image"),
        ...(emailChanged
          ? {
              email: nextEmail,
              confirmEmail: formText(formData, "confirmEmail").toLowerCase(),
              currentPassword: formText(formData, "currentPassword"),
            }
          : {}),
      });

      await updateSession({
        user: {
          name: nextProfile.name,
          email: nextProfile.email,
          image: nextProfile.image,
          currency: nextProfile.currency,
        },
      });
      form.reset();
      setProfileMessage("Profil tersimpan.");
      toast.success("Profil tersimpan.");
    } catch (error) {
      setProfileErrors(getFieldErrors(error));
      setProfileMessage(getMutationError(error, "Profil gagal disimpan."));
      toast.error(getMutationError(error, "Profil gagal disimpan."));
    }
  }

  async function handlePreferencesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setPreferencesErrors({});
    setPreferencesMessage(null);

    try {
      const nextProfile = await updateProfile.mutateAsync({
        currency: formText(formData, "currency"),
      });

      await updateSession({
        user: {
          name: nextProfile.name,
          email: nextProfile.email,
          image: nextProfile.image,
          currency: nextProfile.currency,
        },
      });
      setPreferencesMessage("Preferensi tersimpan.");
      toast.success("Preferensi tersimpan.");
    } catch (error) {
      setPreferencesErrors(getFieldErrors(error));
      setPreferencesMessage(getMutationError(error, "Preferensi gagal disimpan."));
      toast.error(getMutationError(error, "Preferensi gagal disimpan."));
    }
  }

  async function handleSharingInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSharingErrors({});
    setSharingMessage(null);

    try {
      await createSharingInvitation.mutateAsync({
        email: formText(formData, "email"),
      });

      form.reset();
      setSharingMessage("Undangan koneksi dikirim.");
      toast.success("Undangan koneksi dikirim.");
    } catch (error) {
      setSharingErrors(getFieldErrors(error));
      setSharingMessage(getMutationError(error, "Undangan gagal dikirim."));
      toast.error(getMutationError(error, "Undangan gagal dikirim."));
    }
  }

  async function handleSharingAction(id: string, action: "accept" | "reject") {
    setSharingMessage(null);

    try {
      await updateSharingInvitation.mutateAsync({ id, data: { action } });
      const message =
        action === "accept" ? "Koneksi akun diterima." : "Undangan koneksi ditolak.";

      setSharingMessage(message);
      toast.success(message);
    } catch (error) {
      setSharingMessage(getMutationError(error, "Aksi sharing gagal."));
      toast.error(getMutationError(error, "Aksi sharing gagal."));
    }
  }

  async function handleSharingDelete(id: string) {
    setSharingMessage(null);

    try {
      await deleteSharingConnection.mutateAsync(id);
      setSharingMessage("Koneksi sharing dihapus.");
      toast.success("Koneksi sharing dihapus.");
    } catch (error) {
      setSharingMessage(getMutationError(error, "Koneksi gagal dihapus."));
      toast.error(getMutationError(error, "Koneksi gagal dihapus."));
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setPasswordErrors({});
    setPasswordMessage(null);

    try {
      await updatePassword.mutateAsync({
        currentPassword: formText(formData, "currentPassword"),
        newPassword: formText(formData, "newPassword"),
        confirmPassword: formText(formData, "confirmPassword"),
      });

      form.reset();
      setPasswordMessage("Password diperbarui.");
      toast.success("Password diperbarui.");
    } catch (error) {
      setPasswordErrors(getFieldErrors(error));
      setPasswordMessage(getMutationError(error, "Password gagal diperbarui."));
      toast.error(getMutationError(error, "Password gagal diperbarui."));
    }
  }

  async function handleWipeTransactionsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setWipeErrors({});
    setWipeMessage(null);

    try {
      const result = await deleteTransactions.mutateAsync({
        confirmation: formText(formData, "confirmation"),
      });

      form.reset();
      setWipeMessage(`${result.transactionCount} transaksi dihapus.`);
      toast.success("Data transaksi dihapus.");
    } catch (error) {
      setWipeErrors(getFieldErrors(error));
      setWipeMessage(getMutationError(error, "Transaksi gagal dihapus."));
      toast.error(getMutationError(error, "Transaksi gagal dihapus."));
    }
  }

  async function handleDeleteAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setAccountErrors({});
    setAccountMessage(null);

    try {
      await deleteAccount.mutateAsync({
        password: formText(formData, "password"),
        confirmation: formText(formData, "confirmation"),
      });

      toast.success("Akun dihapus.");
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      setAccountErrors(getFieldErrors(error));
      setAccountMessage(getMutationError(error, "Akun gagal dihapus."));
      toast.error(getMutationError(error, "Akun gagal dihapus."));
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Settings className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Settings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Kelola profil, preferensi akun, keamanan, dan data pribadi.
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2 text-sm">
          <p className="font-medium">{profile.name ?? profile.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{profile.currency}</p>
        </div>
      </div>

      {profileQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {getMutationError(profileQuery.error, "Profil gagal dimuat.")}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-2 text-card-foreground md:grid-cols-4">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-pressed={isActive}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {activeTab === "profile" ? (
          <>
          <section className="rounded-lg border bg-card text-card-foreground">
            <div className="flex items-start gap-3 border-b p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Profil</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nama, email, dan avatar akun.
                </p>
              </div>
            </div>

            <form key={profile.updatedAt} onSubmit={handleProfileSubmit} className="space-y-4 p-5">
              {profileMessage ? (
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">{profileMessage}</p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium" htmlFor="settings-name">
                  <span>Nama</span>
                  <input
                    id="settings-name"
                    name="name"
                    defaultValue={profile.name ?? ""}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    aria-invalid={Boolean(profileErrors.name)}
                  />
                  <FieldError message={profileErrors.name} />
                </label>

                <label className="space-y-2 text-sm font-medium" htmlFor="settings-email">
                  <span>Email</span>
                  <input
                    id="settings-email"
                    name="email"
                    type="email"
                    defaultValue={profile.email}
                    autoComplete="email"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    aria-invalid={Boolean(profileErrors.email)}
                  />
                  <FieldError message={profileErrors.email} />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium" htmlFor="settings-confirm-email">
                  <span>Konfirmasi email baru</span>
                  <input
                    id="settings-confirm-email"
                    name="confirmEmail"
                    type="email"
                    autoComplete="off"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    aria-invalid={Boolean(profileErrors.confirmEmail)}
                  />
                  <FieldError message={profileErrors.confirmEmail} />
                </label>

                <label className="space-y-2 text-sm font-medium" htmlFor="settings-current-password">
                  <span>Password saat ini</span>
                  <input
                    id="settings-current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    aria-invalid={Boolean(profileErrors.currentPassword)}
                  />
                  <FieldError message={profileErrors.currentPassword} />
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium" htmlFor="settings-image">
                <span>URL avatar</span>
                <input
                  id="settings-image"
                  name="image"
                  type="url"
                  defaultValue={profile.image ?? ""}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(profileErrors.image)}
                />
                <FieldError message={profileErrors.image} />
              </label>

              <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Simpan profil
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border bg-card text-card-foreground">
            <div className="flex items-start gap-3 border-b p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Settings className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Preferensi</h2>
                <p className="mt-1 text-sm text-muted-foreground">Mata uang default akun.</p>
              </div>
            </div>

            <form onSubmit={handlePreferencesSubmit} className="space-y-4 p-5">
              {preferencesMessage ? (
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">{preferencesMessage}</p>
              ) : null}

              <label className="space-y-2 text-sm font-medium" htmlFor="settings-currency">
                <span>Mata uang</span>
                <select
                  id="settings-currency"
                  name="currency"
                  defaultValue={profile.currency}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(preferencesErrors.currency)}
                >
                  {currencies.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
                <FieldError message={preferencesErrors.currency} />
              </label>

              <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Simpan preferensi
                </Button>
              </div>
            </form>
          </section>
          </>
        ) : null}

        {activeTab === "sharing" ? (
          <section className="rounded-lg border bg-card text-card-foreground">
            <div className="flex items-start gap-3 border-b p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UsersRound className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Sharing Akun</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hubungkan akun lain agar budget tracking bisa dipakai bersama.
                </p>
              </div>
            </div>

            <form onSubmit={handleSharingInviteSubmit} className="space-y-4 p-5">
              {sharingMessage ? (
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">{sharingMessage}</p>
              ) : null}
              {sharingQuery.isError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {getMutationError(sharingQuery.error, "Data sharing gagal dimuat.")}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-2 text-sm font-medium" htmlFor="sharing-email">
                  <span>Email akun partner</span>
                  <input
                    id="sharing-email"
                    name="email"
                    type="email"
                    placeholder="partner@email.com"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    aria-invalid={Boolean(sharingErrors.email)}
                  />
                  <FieldError message={sharingErrors.email} />
                </label>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={createSharingInvitation.isPending}
                  >
                    {createSharingInvitation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <MailPlus className="size-4" aria-hidden="true" />
                    )}
                    Undang
                  </Button>
                </div>
              </div>
            </form>

            <div className="space-y-4 border-t p-5">
              <div>
                <h3 className="text-sm font-semibold">Akun Terhubung</h3>
                <div className="mt-3 space-y-2">
                  {sharingQuery.isLoading ? (
                    <div className="h-14 animate-pulse rounded-md bg-muted" />
                  ) : (sharing?.connections.length ?? 0) === 0 ? (
                    <p className="rounded-md border bg-background px-3 py-3 text-sm text-muted-foreground">
                      Belum ada akun yang terhubung.
                    </p>
                  ) : (
                    sharing?.connections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex flex-col gap-3 rounded-md border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {connection.partner.name ?? connection.partner.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {connection.partner.email}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSharingDelete(connection.id)}
                          disabled={deleteSharingConnection.isPending}
                        >
                          <XCircle className="size-4" aria-hidden="true" />
                          Putuskan
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Undangan Masuk</h3>
                <div className="mt-3 space-y-2">
                  {(sharing?.incomingInvitations.length ?? 0) === 0 ? (
                    <p className="rounded-md border bg-background px-3 py-3 text-sm text-muted-foreground">
                      Tidak ada undangan masuk.
                    </p>
                  ) : (
                    sharing?.incomingInvitations.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex flex-col gap-3 rounded-md border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {connection.partner.name ?? connection.partner.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {connection.partner.email}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleSharingAction(connection.id, "reject")}
                            disabled={updateSharingInvitation.isPending}
                          >
                            <XCircle className="size-4" aria-hidden="true" />
                            Tolak
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleSharingAction(connection.id, "accept")}
                            disabled={updateSharingInvitation.isPending}
                          >
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            Terima
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Undangan Terkirim</h3>
                <div className="mt-3 space-y-2">
                  {(sharing?.outgoingInvitations.length ?? 0) === 0 ? (
                    <p className="rounded-md border bg-background px-3 py-3 text-sm text-muted-foreground">
                      Tidak ada undangan terkirim.
                    </p>
                  ) : (
                    sharing?.outgoingInvitations.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex flex-col gap-3 rounded-md border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {connection.partner.name ?? connection.partner.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {connection.partner.email}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleSharingDelete(connection.id)}
                          disabled={deleteSharingConnection.isPending}
                        >
                          <XCircle className="size-4" aria-hidden="true" />
                          Batalkan
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "security" ? (
          <section className="rounded-lg border bg-card text-card-foreground">
            <div className="flex items-start gap-3 border-b p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <KeyRound className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Keamanan</h2>
                <p className="mt-1 text-sm text-muted-foreground">Password dan sesi aktif.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 p-5">
              {passwordMessage ? (
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">{passwordMessage}</p>
              ) : null}

              <label className="space-y-2 text-sm font-medium" htmlFor="password-current">
                <span>Password saat ini</span>
                <input
                  id="password-current"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(passwordErrors.currentPassword)}
                />
                <FieldError message={passwordErrors.currentPassword} />
              </label>

              <label className="space-y-2 text-sm font-medium" htmlFor="password-new">
                <span>Password baru</span>
                <input
                  id="password-new"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                />
                <FieldError message={passwordErrors.newPassword} />
              </label>

              <label className="space-y-2 text-sm font-medium" htmlFor="password-confirm">
                <span>Konfirmasi password</span>
                <input
                  id="password-confirm"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(passwordErrors.confirmPassword)}
                />
                <FieldError message={passwordErrors.confirmPassword} />
              </label>

              <div className="flex justify-end border-t pt-4">
                <Button type="submit" disabled={updatePassword.isPending}>
                  {updatePassword.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Ganti password
                </Button>
              </div>
            </form>

            <div className="border-t p-5">
              <div className="flex items-start gap-3">
                <MonitorCheck className="mt-0.5 size-5 text-emerald-600" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">Sesi aktif</p>
                  <p className="mt-1 break-words text-muted-foreground">{profile.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Update terakhir {formatDateTime(profile.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "danger" ? (
          <section className="rounded-lg border border-destructive/30 bg-card text-card-foreground">
            <div className="flex items-start gap-3 border-b border-destructive/20 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Danger Zone</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aksi ini mengubah atau menghapus data permanen.
                </p>
              </div>
            </div>

            <form onSubmit={handleWipeTransactionsSubmit} className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold">Hapus semua transaksi</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Budget akan disetel ulang ke pemakaian nol.
                  </p>
                </div>
              </div>
              {wipeMessage ? (
                <p className="rounded-md border bg-muted px-3 py-2 text-sm">{wipeMessage}</p>
              ) : null}
              <label className="space-y-2 text-sm font-medium" htmlFor="wipe-confirmation">
                <span>Konfirmasi</span>
                <input
                  id="wipe-confirmation"
                  name="confirmation"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(wipeErrors.confirmation)}
                />
                <FieldError message={wipeErrors.confirmation} />
              </label>
              <div className="flex justify-end border-t pt-4">
                <Button type="submit" variant="destructive" disabled={deleteTransactions.isPending}>
                  {deleteTransactions.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Hapus transaksi
                </Button>
              </div>
            </form>

            <form
              onSubmit={handleDeleteAccountSubmit}
              className="space-y-4 border-t border-destructive/20 p-5"
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-destructive" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold">Hapus akun</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Akun dan semua data finansial akan dihapus.
                  </p>
                </div>
              </div>
              {accountMessage ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {accountMessage}
                </p>
              ) : null}
              <label className="space-y-2 text-sm font-medium" htmlFor="account-password">
                <span>Password</span>
                <input
                  id="account-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(accountErrors.password)}
                />
                <FieldError message={accountErrors.password} />
              </label>
              <label className="space-y-2 text-sm font-medium" htmlFor="account-confirmation">
                <span>Konfirmasi</span>
                <input
                  id="account-confirmation"
                  name="confirmation"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  aria-invalid={Boolean(accountErrors.confirmation)}
                />
                <FieldError message={accountErrors.confirmation} />
              </label>
              <div className="flex justify-end border-t border-destructive/20 pt-4">
                <Button type="submit" variant="destructive" disabled={deleteAccount.isPending}>
                  {deleteAccount.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Hapus akun
                </Button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </section>
  );
}
