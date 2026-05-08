import { LoginCard } from "@/components/auth/login-card";

export default function AdminLoginPage() {
  return (
    <LoginCard
      eyebrow="Conta LM-3D"
      title="Entrar"
      description="O login é para todos os clientes. Apenas contas autorizadas acessam opções administrativas."
      redirectTo="/conta"
    />
  );
}
