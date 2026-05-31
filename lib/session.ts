import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export const getSession = cache(async () => auth());

export async function requireUserId() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user.id;
}
