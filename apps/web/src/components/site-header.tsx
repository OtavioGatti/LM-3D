import Link from "next/link";
import { HeaderAuthActions } from "@/components/auth/header-auth-actions";
import { assetPath } from "@/lib/assets";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/pedido-personalizado", label: "Pedido personalizado" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-container site-header-inner">
        <Link href="/" className="brand-mark" aria-label="LM-3D Home">
          <span className="brand-logo-frame">
            <img src={assetPath("/images/lm-3d-symbol.png")} alt="" aria-hidden="true" />
          </span>
          <span>LM-3D</span>
        </Link>
        <nav aria-label="Navegação principal">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <HeaderAuthActions />
      </div>
    </header>
  );
}
