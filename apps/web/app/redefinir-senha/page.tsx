import { ResetPasswordCard } from "@/components/auth/reset-password-card";
import { getSafeLocalRedirect } from "@/lib/auth/redirect";

export const metadata = {
  title: "Redefinir senha"
};

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    redirect?: string | string[];
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = searchParams ? await searchParams : {};

  return <ResetPasswordCard loginRedirectTo={getSafeLocalRedirect(params.redirect)} />;
}
