import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = {
  title: "Admin"
};

export default function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
