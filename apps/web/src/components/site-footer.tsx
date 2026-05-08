"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { assetPath } from "@/lib/assets";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

export function SiteFooter() {
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!hasSupabaseBrowserConfig()) {
        setIsSignedIn(false);
        return;
      }

      const {
        data: { session }
      } = await getSupabaseBrowserClient().auth.getSession();

      if (!cancelled) {
        setIsSignedIn(Boolean(session));
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
    <footer className="site-footer">
      <div className="page-container footer-grid">
        <div>
          <Link href="/" className="brand-mark">
            <span className="brand-logo-frame">
              <img src={assetPath("/images/lm-3d-symbol.png")} alt="" aria-hidden="true" />
            </span>
            <span>LM-3D</span>
          </Link>
          <p>Produtos impressos em 3D com cuidado, clareza de prazo e atendimento direto.</p>
        </div>
        <div>
          <h2>Comprar</h2>
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/pedido-personalizado">Pedido personalizado</Link>
          <Link href="/carrinho">Carrinho</Link>
        </div>
        <div>
          <h2>Conta</h2>
          {isSignedIn === false ? <Link href="/login">Entrar</Link> : null}
          <Link href="/conta">Minha conta</Link>
          <span>Pagamentos via Mercado Pago nas próximas fases.</span>
        </div>
      </div>
    </footer>
  );
}
