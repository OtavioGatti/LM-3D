import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section">
      <div className="page-container confirmation-panel">
        <h1>Página não encontrada</h1>
        <p>O endereço pode ter mudado ou ainda será criado nas próximas fases.</p>
        <Link href="/" className="button button-primary">
          Voltar para a home
        </Link>
      </div>
    </main>
  );
}
