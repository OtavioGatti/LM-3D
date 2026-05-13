"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { getFriendlyAuthError } from "@/lib/auth/errors";
import { validateAccountPassword, validatePasswordConfirmation } from "@/lib/auth/password";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { TextField } from "@/components/ui/form-field";

type AuthMode = "signin" | "signup" | "recover";

type LoginCardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  redirectTo?: string;
  initialMode?: AuthMode;
};

function getAppOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

function buildAuthRedirectUrl(path: string) {
  try {
    return new URL(path, getAppOrigin()).toString();
  } catch {
    return path;
  }
}

export function LoginCard({
  eyebrow = "Conta LM-3D",
  title = "Entrar",
  description = "Acesse sua conta para acompanhar pedidos, personalizações e atendimento.",
  redirectTo = "/conta",
  initialMode = "signin"
}: LoginCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isConfigured = hasSupabaseBrowserConfig();
  const isSignUp = mode === "signup";
  const isRecover = mode === "recover";
  const heading = isRecover ? "Recuperar senha" : isSignUp ? "Criar conta" : title;
  const introCopy = isRecover
    ? "Informe seu e-mail e enviaremos um link seguro para criar uma nova senha."
    : isSignUp
      ? "Crie uma conta para finalizar pedidos e acompanhar tudo em Minha conta."
      : description;
  const submitCopy = isSubmitting
    ? "Processando..."
    : isRecover
      ? "Enviar link de recuperação"
      : isSignUp
        ? "Criar conta"
        : "Entrar";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirmation("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isConfigured) {
      setErrorMessage("Configure as variáveis públicas do Supabase antes de entrar.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (isSignUp && fullName.trim().length < 3) {
      setErrorMessage("Informe seu nome completo.");
      return;
    }

    if (isSignUp) {
      const passwordError = validateAccountPassword(password);

      if (passwordError) {
        setErrorMessage(passwordError);
        return;
      }

      const confirmationError = validatePasswordConfirmation(password, passwordConfirmation);

      if (confirmationError) {
        setErrorMessage(confirmationError);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isRecover) {
        const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo: buildAuthRedirectUrl("/redefinir-senha")
          }
        );

        if (error) {
          setErrorMessage(
            getFriendlyAuthError(error.message, "Não foi possível enviar o link de recuperação.")
          );
          return;
        }

        setSuccessMessage(
          "Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha."
        );
        return;
      }

      if (isSignUp) {
        const { data, error } = await getSupabaseBrowserClient().auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim()
            },
            emailRedirectTo: buildAuthRedirectUrl(redirectTo)
          }
        });

        if (error) {
          setErrorMessage(getFriendlyAuthError(error.message, "Não foi possível criar sua conta."));
          return;
        }

        if (data.session) {
          router.replace(redirectTo);
          return;
        }

        setSuccessMessage("Conta criada. Confirme seu e-mail para entrar e finalizar o pedido.");
        return;
      }

      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        setErrorMessage(getFriendlyAuthError(error.message, "E-mail ou senha inválidos."));
        return;
      }

      router.replace(redirectTo);
    } catch {
      setErrorMessage("Não foi possível concluir a autenticação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-screen">
      <section className="admin-auth-card">
        <LockKeyhole aria-hidden="true" size={30} />
        <span className="eyebrow">{eyebrow}</span>
        <h1>{heading}</h1>
        <p>{introCopy}</p>

        <div
          className="auth-mode-switch auth-mode-switch-three"
          aria-label="Escolha uma ação de conta"
        >
          <button
            aria-pressed={mode === "signin"}
            className={mode === "signin" ? "active" : ""}
            onClick={() => switchMode("signin")}
            type="button"
          >
            Entrar
          </button>
          <button
            aria-pressed={isSignUp}
            className={isSignUp ? "active" : ""}
            onClick={() => switchMode("signup")}
            type="button"
          >
            Criar conta
          </button>
          <button
            aria-pressed={isRecover}
            className={isRecover ? "active" : ""}
            onClick={() => switchMode("recover")}
            type="button"
          >
            Recuperar
          </button>
        </div>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <TextField
              autoComplete="name"
              label="Nome completo"
              minLength={3}
              name="name"
              onChange={(event) => setFullName(event.target.value)}
              required
              value={fullName}
            />
          ) : null}
          <TextField
            autoComplete="email"
            inputMode="email"
            label="E-mail"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {!isRecover ? (
            <TextField
              autoComplete={isSignUp ? "new-password" : "current-password"}
              hint={isSignUp ? "Use pelo menos 8 caracteres, com letras e números." : undefined}
              label="Senha"
              minLength={isSignUp ? 8 : 6}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          ) : null}
          {isSignUp ? (
            <TextField
              autoComplete="new-password"
              label="Confirmar senha"
              minLength={8}
              name="password-confirmation"
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              type="password"
              value={passwordConfirmation}
            />
          ) : null}

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {submitCopy}
          </button>
        </form>

        <Link href="/" className="quiet-link">
          Voltar para a loja
        </Link>
      </section>
    </main>
  );
}
