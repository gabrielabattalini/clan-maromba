import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false },
};

/**
 * Sem esta página o Next mostra o 404 de fábrica dele — fundo branco e texto
 * em inglês, no meio de um site escuro e em português.
 */
export default function NaoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-start px-5 py-24 sm:py-32">
      <p className="etiqueta">Erro 404</p>

      <h1 className="display mt-4 text-[clamp(2.5rem,10vw,4.5rem)]">
        Essa página
        <br />
        <span className="text-destaque">não existe</span>
      </h1>

      <div className="regua mt-8 w-full" />

      <p className="mt-8 text-sm leading-relaxed text-texto-fraco">
        O endereço pode estar errado, ou a live que estava aqui foi removida.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link className="botao" href="/">
          Ver a agenda de lives
        </Link>
        <Link className="botao botao-secundario" href="/loja">
          Loja
        </Link>
      </div>
    </main>
  );
}
