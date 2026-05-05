import { LoginCard } from "@/components/auth/login-card";

export default function AdminLoginPage() {
  return (
    <LoginCard
      eyebrow="Conta LM-3D"
      title="Entrar"
      description="O login e para todos os clientes. Apenas contas owner acessam opcoes administrativas."
      redirectTo="/conta"
    />
  );
}
