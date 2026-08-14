import type { Metadata } from "next";
import Link from "next/link";

import { destinoSeguro } from "@/lib/destino";

export const metadata: Metadata = {
  title: "Confirmação",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ estado?: string; tipo?: string; proximo?: string }>;
};

export default async function PaginaPronto({ searchParams }: Props) {
  const { estado, tipo, proximo } = await searchParams;
  const deuCerto = estado === "ok";
  const voltar = destinoSeguro(proximo);

  const titulo = !deuCerto
    ? "Link expirado"
    : tipo === "email_change"
      ? "E-mail alterado"
      : "Conta confirmada";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 py-20 sm:py-28">
      <p className="etiqueta">{deuCerto ? "Tudo certo" : "Não deu"}</p>

      <h1 className="display mt-4 text-[clamp(2.25rem,9vw,3.5rem)]">
        {deuCerto ? (
          <>
            {titulo.split(" ")[0]}
            <br />
            <span className="text-destaque">{titulo.split(" ").slice(1).join(" ")}</span>
          </>
        ) : (
          <>
            Link
            <br />
            <span className="text-destaque">expirado</span>
          </>
        )}
      </h1>

      <div className="regua mt-8" />

      {deuCerto ? (
        <>
          <p className="mt-8 text-sm leading-relaxed text-texto-fraco">
            {tipo === "email_change"
              ? "Seu novo e-mail está valendo. Você já está conectado."
              : "Seu e-mail foi confirmado e você já está conectado. Pode comprar e assistir normalmente."}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="botao" href={voltar === "/" ? "/" : voltar}>
              {voltar === "/" ? "Ver a agenda de lives" : "Continuar de onde parei"}
            </Link>
            <Link className="botao botao-secundario" href="/minhas-lives">
              Minhas lives
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-8 text-sm leading-relaxed text-texto-fraco">
            Este link já foi usado ou passou da validade — eles valem por pouco
            tempo, de propósito. Nada de errado com a sua conta.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-texto-fraco">
            Tente entrar normalmente. Se não lembrar a senha, peça uma nova.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="botao" href="/entrar">
              Entrar
            </Link>
            <Link className="botao botao-secundario" href="/recuperar">
              Esqueci minha senha
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
