"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

export function AdminSignOut() {
  const router = useRouter();

  async function handleSignOut() {
    if (hasSupabaseBrowserConfig()) {
      await getSupabaseBrowserClient().auth.signOut();
    }

    router.replace("/login");
  }

  return (
    <button className="admin-sign-out" type="button" onClick={handleSignOut}>
      <LogOut aria-hidden="true" size={16} />
      Sair
    </button>
  );
}
