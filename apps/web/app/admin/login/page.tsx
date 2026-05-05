"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isConfigured = hasSupabaseBrowserConfig();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!isConfigured) {
      setErrorMessage("Configure as variaveis publicas do Supabase antes de entrar.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email,
      password
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage("E-mail ou senha invalidos.");
      return;
    }

    router.replace("/admin");
  }

  return (
    <main className="admin-auth-screen">
      <section className="admin-auth-card">
        <LockKeyhole aria-hidden="true" size={30} />
        <span className="eyebrow">Painel do Lucas</span>
        <h1>Entrar no admin</h1>
        <p>Use a conta cadastrada no Supabase com role admin ou owner.</p>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <Link href="/" className="quiet-link">
          Voltar para a loja
        </Link>
      </section>
    </main>
  );
}
