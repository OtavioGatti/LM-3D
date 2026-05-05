import { Clock, MessageCircle, ShieldCheck } from "lucide-react";

export function TrustRail() {
  return (
    <div className="trust-rail" aria-label="Diferenciais da LM-3D">
      <span>
        <ShieldCheck aria-hidden="true" size={16} />
        Compra segura
      </span>
      <span>
        <Clock aria-hidden="true" size={16} />
        Prazo claro
      </span>
      <span>
        <MessageCircle aria-hidden="true" size={16} />
        Atendimento direto
      </span>
    </div>
  );
}
