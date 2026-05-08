"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Calculator, ClipboardList, FolderTree, Package, ShoppingBag, TicketPercent } from "lucide-react";
import { assetPath } from "@/lib/assets";
import { AdminAuthGate } from "./admin-auth-gate";
import { AdminSignOut } from "./admin-sign-out";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: FolderTree },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/orcamentos", label: "Orçamentos", icon: ClipboardList },
  { href: "/admin/cupons", label: "Cupons", icon: TicketPercent },
  { href: "/admin/calculadora", label: "Calculadora", icon: Calculator }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.endsWith("/admin/login")) {
    return <AdminAuthGate>{children}</AdminAuthGate>;
  }

  return (
    <AdminAuthGate>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link href="/" className="admin-brand">
            <span className="brand-logo-frame">
              <img src={assetPath("/images/lm-3d-symbol.png")} alt="" aria-hidden="true" />
            </span>
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
            Acesso protegido por Supabase Auth, RLS e role owner.
          </p>
          <AdminSignOut />
        </aside>
        <main className="admin-content">{children}</main>
      </div>
    </AdminAuthGate>
  );
}
