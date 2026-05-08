import { LoginCard } from "@/components/auth/login-card";

export const metadata = {
  title: "Entrar"
};

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string | string[];
    mode?: string | string[];
  }>;
};

function getSafeRedirect(value: string | string[] | undefined) {
  const redirect = Array.isArray(value) ? value[0] : value;

  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/conta";
  }

  return redirect;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  return (
    <LoginCard
      redirectTo={getSafeRedirect(params.redirect)}
      initialMode={mode === "signup" ? "signup" : "signin"}
    />
  );
}
