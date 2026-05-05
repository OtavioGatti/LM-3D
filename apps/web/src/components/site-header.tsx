import Link from "next/link";
import { ShoppingCart, UserCog } from "lucide-react";

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
        <div className="header-actions">
          <Link href="/admin" className="icon-button" aria-label="Acessar painel admin">
            <UserCog aria-hidden="true" size={20} />
          </Link>
          <Link href="/carrinho" className="button button-primary">
            <ShoppingCart aria-hidden="true" size={18} />
            Carrinho
          </Link>
        </div>
      </div>
    </header>
  );
}
