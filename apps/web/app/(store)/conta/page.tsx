"use client";

import { isOwnerRole } from "@lm-3d/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck, User } from "lucide-react";
import { AccountCustomRequests } from "@/components/account/account-custom-requests";
import { AccountOrders } from "@/components/account/account-orders";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type AccountProfile = {
  full_name: string | null;
  role: string | null;
};

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      if (!hasSupabaseBrowserConfig()) {
        setIsLoading(false);
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

      setEmail(session.user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single();

      setProfile(data ?? null);
      setIsLoading(false);
    }

    void loadAccount();
  }, [router]);

  async function handleSignOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/");
  }

  return (
    <main className="page-container account-page">
      <section className="admin-panel account-panel">
        <User aria-hidden="true" size={28} />
        <div>
          <span className="eyebrow">Minha conta</span>
          <h1>{isLoading ? "Carregando..." : email || "Conta LM-3D"}</h1>
          <p>Acompanhe pedidos, personalizacoes e proximos passos da producao.</p>
        </div>

        {profile && isOwnerRole(profile.role) ? (
          <div className="owner-callout">
            <ShieldCheck aria-hidden="true" size={22} />
            <div>
              <strong>Perfil owner ativo</strong>
              <span>Voce pode acessar as opcoes administrativas da LM-3D.</span>
            </div>
            <Link href="/admin" className="button button-primary">
              Abrir admin
            </Link>
          </div>
        ) : (
          <div className="form-note">
            Conta de cliente ativa. As opcoes administrativas aparecem apenas para owner.
          </div>
        )}

        <button className="button button-secondary" type="button" onClick={handleSignOut}>
          Sair
        </button>
      </section>

      <AccountOrders />
      <AccountCustomRequests />
    </main>
  );
}
