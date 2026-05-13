"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { getFriendlyAuthError } from "@/lib/auth/errors";
import { buildLoginHref } from "@/lib/auth/redirect";
import { validateAccountPassword, validatePasswordConfirmation } from "@/lib/auth/password";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type ResetPasswordCardProps = {
  loginRedirectTo?: string;
};

export function ResetPasswordCard({ loginRedirectTo = "/conta" }: ResetPasswordCardProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isConfigured = hasSupabaseBrowserConfig();
  const loginHref = useMemo(() => buildLoginHref(loginRedirectTo), [loginRedirectTo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isConfigured) {
      setErrorMessage("Configure as variaveis publicas do Supabase antes de redefinir a senha.");
      return;
    }

    const passwordError =
      validateAccountPassword(password) ||
      validatePasswordConfirmation(password, passwordConfirmation);

    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMessage("Link expirado ou ja utilizado. Solicite uma nova recuperacao de senha.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(getFriendlyAuthError(error.message, "Nao foi possivel atualizar a senha."));
        return;
      }

      setPassword("");
      setPasswordConfirmation("");
      setSuccessMessage("Senha atualizada. Entre novamente com a nova senha.");

      await supabase.auth.signOut();
      window.setTimeout(() => router.replace(loginHref), 1200);
    } catch {
      setErrorMessage("Nao foi possivel atualizar a senha. Solicite um novo link e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-screen">
      <section className="admin-auth-card">
        <KeyRound aria-hidden="true" size={30} />
        <span className="eyebrow">Conta LM-3D</span>
        <h1>Redefinir senha</h1>
        <p>Crie uma nova senha para voltar a acessar sua conta com seguranca.</p>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
          <label>
            Nova senha
            <input
              autoComplete="new-password"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <small className="field-hint">Use pelo menos 8 caracteres, com letras e numeros.</small>
          </label>
          <label>
            Confirmar nova senha
            <input
              autoComplete="new-password"
              minLength={8}
              name="password-confirmation"
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              type="password"
              value={passwordConfirmation}
            />
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Atualizando..." : "Atualizar senha"}
          </button>
        </form>

        <Link href={loginHref} className="quiet-link">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
