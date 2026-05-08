"use client";

import { isOwnerRole } from "@lm-3d/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type GateState = "checking" | "ready" | "missing-config" | "denied";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function verifyAdminAccess() {
      if (pathname.endsWith("/admin/login")) {
        setState("ready");
        return;
      }

      if (!hasSupabaseBrowserConfig()) {
        setState("missing-config");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (cancelled) {
        return;
      }

      if (error || !profile || !isOwnerRole(profile.role)) {
        setState("denied");
        return;
      }

      setState("ready");
    }

    void verifyAdminAccess();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (state === "ready") {
    return children;
  }

  if (state === "missing-config") {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-card">
          <ShieldAlert aria-hidden="true" size={28} />
          <h1>Supabase ainda não configurado</h1>
          <p>
            Preencha <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para ativar o login do painel.
          </p>
          <Link href="/" className="button button-secondary">
            Voltar para a loja
          </Link>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-card">
          <ShieldAlert aria-hidden="true" size={28} />
          <h1>Acesso restrito</h1>
          <p>Esta conta está logada, mas não tem role owner no perfil Supabase.</p>
          <Link href="/conta" className="button button-secondary">
            Ver minha conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-auth-screen">
      <div className="admin-auth-card">
        <ShieldCheck aria-hidden="true" size={28} />
        <h1>Verificando acesso</h1>
        <p>Conferindo sessão e permissão administrativa.</p>
      </div>
    </div>
  );
}
