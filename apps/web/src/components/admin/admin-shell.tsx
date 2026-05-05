import Link from "next/link";
import { BarChart3, Calculator, FolderTree, Package, ShoppingBag, Store } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: FolderTree },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/calculadora", label: "Calculadora", icon: Calculator }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          <Store aria-hidden="true" size={22} />
          <span>LM-3D Admin</span>
        </Link>
        <nav aria-label="Navegacao administrativa">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.href}>
                <Icon aria-hidden="true" size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="admin-security-note">
          Protecao real com Supabase Auth e role de admin entra na Fase 3.
        </p>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
