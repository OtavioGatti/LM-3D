"use client";

import { formatBrazilianPhone } from "@lm-3d/shared";
import { LockKeyhole, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createCustomRequest } from "@/lib/api/custom-requests";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { TextareaField, TextField } from "@/components/ui/form-field";

type CustomOrderFormState = {
  name: string;
  contact: string;
  title: string;
  description: string;
  quantity: string;
  material: string;
  colors: string;
  deadline: string;
  referenceUrl: string;
};

const emptyForm: CustomOrderFormState = {
  name: "",
  contact: "",
  title: "",
  description: "",
  quantity: "1",
  material: "",
  colors: "",
  deadline: "",
  referenceUrl: ""
};

type CustomOrderAuthStatus = "checking" | "signed-in" | "signed-out" | "unconfigured";

function contactFields(contact: string) {
  const trimmed = contact.trim();
  const looksLikeEmail = trimmed.includes("@");
  const formattedPhone = looksLikeEmail ? null : formatBrazilianPhone(trimmed);

  return {
    customer_email: looksLikeEmail ? trimmed : null,
    customer_phone: formattedPhone
  };
}

function formatContactInput(value: string) {
  if (value.includes("@") || /[a-zA-Z]/.test(value)) {
    return value;
  }

  return formatBrazilianPhone(value);
}

export function CustomOrderForm() {
  const [form, setForm] = useState<CustomOrderFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [authStatus, setAuthStatus] = useState<CustomOrderAuthStatus>("checking");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!hasSupabaseBrowserConfig()) {
        setAuthStatus("unconfigured");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setAuthStatus("signed-out");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      setForm((current) => ({
        ...current,
        name:
          current.name ||
          profile?.full_name ||
          (typeof session.user.user_metadata.full_name === "string"
            ? session.user.user_metadata.full_name
            : ""),
        contact: current.contact || session.user.email || ""
      }));
      setAuthStatus("signed-in");
    }

    void loadSession().catch(() => setAuthStatus("signed-out"));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (authStatus !== "signed-in") {
      setMessage("Entre ou crie uma conta para enviar e acompanhar seu orçamento.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createCustomRequest({
        customer_name: form.name,
        customer_contact: form.contact,
        ...contactFields(form.contact),
        title: form.title,
        description: form.description,
        quantity: Number(form.quantity || 1),
        desired_material: form.material || null,
        desired_colors: form.colors || null,
        deadline: form.deadline || null,
        reference_url: form.referenceUrl || null
      });

      setForm(emptyForm);
      setMessage(`Pedido personalizado enviado. Código: ${response.request.code}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar sua ideia.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authStatus === "checking") {
    return (
      <div className="lead-form custom-order-auth-card">
        <LockKeyhole aria-hidden="true" size={32} />
        <h2>Verificando sua conta</h2>
        <p>Estamos conferindo seu login para vincular o orçamento ao seu perfil.</p>
      </div>
    );
  }

  if (authStatus !== "signed-in") {
    return (
      <div className="lead-form custom-order-auth-card">
        <UserPlus aria-hidden="true" size={32} />
        <h2>Entre para pedir orçamento</h2>
        <p>
          Assim o Lucas consegue responder pelo painel e você acompanha status, preço e pagamento
          em Minha conta.
        </p>
        <div className="checkout-auth-actions">
          <Link href="/login?redirect=/pedido-personalizado" className="button button-primary">
            Entrar
          </Link>
          <Link
            href="/login?redirect=/pedido-personalizado&mode=signup"
            className="button button-secondary"
          >
            Criar conta
          </Link>
        </div>
        {authStatus === "unconfigured" ? (
          <p className="form-note">Login indisponível: configure o Supabase público no ambiente.</p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <TextField
        autoComplete="name"
        label="Nome"
        onChange={(event) => setForm({ ...form, name: event.target.value })}
        placeholder="Seu nome"
        required
        value={form.name}
      />
      <TextField
        autoComplete="email tel"
        hint="Pode ser WhatsApp ou e-mail. Usaremos para responder o orçamento."
        label="Contato"
        onChange={(event) => setForm({ ...form, contact: formatContactInput(event.target.value) })}
        placeholder="(11) 99999-9999 ou seu e-mail"
        required
        value={form.contact}
      />
      <TextField
        label="Nome da ideia"
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        placeholder="Ex.: suporte de controle com logo"
        required
        value={form.title}
      />
      <TextareaField
        hint="Inclua tamanho, uso, encaixes, nomes, acabamento e referências."
        label="O que você quer imprimir?"
        onChange={(event) => setForm({ ...form, description: event.target.value })}
        placeholder="Descreva sua ideia com os detalhes principais."
        required
        rows={6}
        value={form.description}
      />
      <div className="form-grid">
        <TextField
          label="Quantidade"
          min="1"
          onChange={(event) => setForm({ ...form, quantity: event.target.value })}
          required
          type="number"
          value={form.quantity}
        />
        <TextField
          label="Material desejado"
          onChange={(event) => setForm({ ...form, material: event.target.value })}
          placeholder="PLA, PETG..."
          value={form.material}
        />
      </div>
      <TextField
        label="Cores ou acabamento"
        onChange={(event) => setForm({ ...form, colors: event.target.value })}
        placeholder="Ex.: preto fosco, branco, pintura..."
        value={form.colors}
      />
      <TextField
        label="Prazo desejado"
        onChange={(event) => setForm({ ...form, deadline: event.target.value })}
        placeholder="Ex.: sexta-feira, sem pressa, presente..."
        value={form.deadline}
      />
      <TextField
        label="Link de referência"
        onChange={(event) => setForm({ ...form, referenceUrl: event.target.value })}
        placeholder="URL de imagem, modelo 3D ou inspiração"
        type="url"
        value={form.referenceUrl}
      />

      {message ? <p className="form-note">{message}</p> : null}

      <button className="button button-primary" disabled={isSubmitting} type="submit">
        <Send aria-hidden="true" size={18} />
        {isSubmitting ? "Enviando..." : "Enviar ideia"}
      </button>
      <p>Lucas recebe a solicitação no admin, avalia viabilidade e responde com prazo e preço.</p>
    </form>
  );
}
