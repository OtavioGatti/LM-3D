import Link from "next/link";
import { HeaderAuthActions } from "@/components/auth/header-auth-actions";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/catalogo", label: "Catalogo" },
  { href: "/pedido-personalizado", label: "Pedido personalizado" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-container site-header-inner">
        <Link href="/" className="brand-mark" aria-label="LM-3D Home">
          LM-3D
        </Link>
        <nav aria-label="Navegacao principal">
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
