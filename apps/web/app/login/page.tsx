import { LoginCard } from "@/components/auth/login-card";
import { getSafeLocalRedirect } from "@/lib/auth/redirect";

export const metadata = {
  title: "Entrar"
};

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string | string[];
    mode?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const initialMode = mode === "signup" || mode === "recover" ? mode : "signin";

  return (
    <LoginCard
      redirectTo={getSafeLocalRedirect(params.redirect)}
      initialMode={initialMode}
    />
  );
}
