"use client";

import { MessageCircle } from "lucide-react";
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
      <img
        src={assetPath("/images/lm-3d-footer-texture.png")}
        alt=""
        aria-hidden="true"
        className="footer-bg-image"
      />
      <div className="page-container footer-grid">
        <div className="footer-brand-block">
          <Link href="/" className="brand-mark">
            <span className="brand-logo-frame">
              <img src={assetPath("/images/lm-3d-symbol.png")} alt="" aria-hidden="true" />
            </span>
            <span>LM-3D</span>
          </Link>
          <p>Peças personalizadas com qualidade, criatividade e tecnologia.</p>
        </div>
        <div>
          <h2>Navegação</h2>
          <Link href="/">Início</Link>
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/#materiais">Materiais</Link>
          <Link href="/#sobre">Sobre</Link>
          <Link href="/#como-funciona">Como funciona</Link>
        </div>
        <div>
          <h2>Comprar</h2>
          <Link href="/pedido-personalizado">Pedido personalizado</Link>
          <Link href="/carrinho">Carrinho</Link>
          {isSignedIn === false ? <Link href="/login">Entrar</Link> : null}
          <Link href="/conta">Minha conta</Link>
        </div>
        <div className="footer-contact">
          <h2>Fale conosco</h2>
          <span>Envie sua ideia para Lucas avaliar material, prazo e viabilidade.</span>
          <Link href="/pedido-personalizado" className="footer-quote-link">
            <MessageCircle aria-hidden="true" size={18} />
            Pedir orçamento
          </Link>
        </div>
      </div>
    </footer>
  );
}
