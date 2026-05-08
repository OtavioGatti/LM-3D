"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type LoginCardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  redirectTo?: string;
  initialMode?: "signin" | "signup";
};

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
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isConfigured = hasSupabaseBrowserConfig();
  const isSignUp = mode === "signup";

  function switchMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
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

    setIsSubmitting(true);

    if (isSignUp) {
      const signUpOptions = {
        data: {
          full_name: fullName.trim()
        },
        ...(typeof window !== "undefined"
          ? { emailRedirectTo: `${window.location.origin}${redirectTo}` }
          : {})
      };

      const { data, error } = await getSupabaseBrowserClient().auth.signUp({
        email,
        password,
        options: signUpOptions
      });

      setIsSubmitting(false);

      if (error) {
        setErrorMessage(error.message || "Não foi possível criar sua conta.");
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
      email,
      password
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage("E-mail ou senha inválidos.");
      return;
    }

    router.replace(redirectTo);
  }

  return (
    <main className="admin-auth-screen">
      <section className="admin-auth-card">
        <LockKeyhole aria-hidden="true" size={30} />
        <span className="eyebrow">{eyebrow}</span>
        <h1>{isSignUp ? "Criar conta" : title}</h1>
        <p>
          {isSignUp
            ? "Crie uma conta para finalizar pedidos e acompanhar tudo em Minha conta."
            : description}
        </p>

        <div className="auth-mode-switch" aria-label="Escolha entre entrar ou criar conta">
          <button
            aria-pressed={!isSignUp}
            className={!isSignUp ? "active" : ""}
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
        </div>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <label>
              Nome completo
              <input
                autoComplete="name"
                name="name"
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </label>
          ) : null}
          <label>
            E-mail
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Senha
            <input
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={6}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          {successMessage ? <p className="form-success">{successMessage}</p> : null}

          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Processando..." : isSignUp ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <Link href="/" className="quiet-link">
          Voltar para a loja
        </Link>
      </section>
    </main>
  );
}
