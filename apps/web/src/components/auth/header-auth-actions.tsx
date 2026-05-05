"use client";

import { isOwnerRole } from "@lm-3d/shared";
import { ShoppingCart, User, UserCog } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type AuthState = {
  isSignedIn: boolean;
  role: string | null;
};

export function HeaderAuthActions() {
  const [authState, setAuthState] = useState<AuthState>({ isSignedIn: false, role: null });

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!hasSupabaseBrowserConfig()) {
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setAuthState({ isSignedIn: false, role: null });
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!cancelled) {
        setAuthState({ isSignedIn: true, role: profile?.role ?? null });
      }
    }

    void loadSession();

    if (!hasSupabaseBrowserConfig()) {
      return;
    }

    const {
      data: { subscription }
    } = getSupabaseBrowserClient().auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="header-actions">
      {isOwnerRole(authState.role) ? (
        <Link href="/admin" className="icon-button" aria-label="Acessar painel admin">
          <UserCog aria-hidden="true" size={20} />
        </Link>
      ) : null}
      <Link href={authState.isSignedIn ? "/conta" : "/login"} className="icon-button" aria-label="Conta">
        <User aria-hidden="true" size={20} />
      </Link>
      <Link href="/carrinho" className="button button-primary">
        <ShoppingCart aria-hidden="true" size={18} />
        Carrinho
      </Link>
    </div>
  );
}
