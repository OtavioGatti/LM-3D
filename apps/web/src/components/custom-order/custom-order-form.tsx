"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { createCustomRequest } from "@/lib/api/custom-requests";

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

function contactFields(contact: string) {
  const trimmed = contact.trim();
  const looksLikeEmail = trimmed.includes("@");

  return {
    customer_email: looksLikeEmail ? trimmed : null,
    customer_phone: looksLikeEmail ? null : trimmed
  };
}

export function CustomOrderForm() {
  const [form, setForm] = useState<CustomOrderFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
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
      setMessage(`Pedido personalizado enviado. Codigo: ${response.request.code}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar sua ideia.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <label>
        Nome
        <input
          autoComplete="name"
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Seu nome"
          required
          value={form.name}
        />
      </label>
      <label>
        WhatsApp ou e-mail
        <input
          autoComplete="email tel"
          onChange={(event) => setForm({ ...form, contact: event.target.value })}
          placeholder="Como Lucas pode falar com voce"
          required
          value={form.contact}
        />
      </label>
      <label>
        Nome da ideia
        <input
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Ex.: suporte de controle com logo"
          required
          value={form.title}
        />
      </label>
      <label>
        O que voce quer imprimir?
        <textarea
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Descreva tamanho, uso, quantidade, encaixes, nomes, acabamento e referencias."
          required
          rows={6}
          value={form.description}
        />
      </label>
      <div className="form-grid">
        <label>
          Quantidade
          <input
            min="1"
            onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            required
            type="number"
            value={form.quantity}
          />
        </label>
        <label>
          Material desejado
          <input
            onChange={(event) => setForm({ ...form, material: event.target.value })}
            placeholder="PLA, PETG..."
            value={form.material}
          />
        </label>
      </div>
      <label>
        Cores ou acabamento
        <input
          onChange={(event) => setForm({ ...form, colors: event.target.value })}
          placeholder="Ex.: preto fosco, branco, pintura..."
          value={form.colors}
        />
      </label>
      <label>
        Prazo desejado
        <input
          onChange={(event) => setForm({ ...form, deadline: event.target.value })}
          placeholder="Ex.: ate sexta, sem pressa, presente de aniversario..."
          value={form.deadline}
        />
      </label>
      <label>
        Link de referencia
        <input
          onChange={(event) => setForm({ ...form, referenceUrl: event.target.value })}
          placeholder="URL de imagem, modelo 3D ou inspiracao"
          type="url"
          value={form.referenceUrl}
        />
      </label>

      {message ? <p className="form-note">{message}</p> : null}

      <button className="button button-primary" disabled={isSubmitting} type="submit">
        <Send aria-hidden="true" size={18} />
        {isSubmitting ? "Enviando..." : "Enviar ideia"}
      </button>
      <p>
        Lucas recebe a solicitacao no admin, avalia viabilidade e responde com prazo e preco.
      </p>
    </form>
  );
}
