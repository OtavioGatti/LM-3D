import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section">
      <div className="page-container confirmation-panel">
        <h1>Pagina nao encontrada</h1>
        <p>O endereco pode ter mudado ou ainda sera criado nas proximas fases.</p>
        <Link href="/" className="button button-primary">
          Voltar para a home
        </Link>
      </div>
    </main>
  );
}
