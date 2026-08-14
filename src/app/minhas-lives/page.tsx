import type { Metadata } from "next";
import Link from "next/link";

import { SeloEstado } from "@/components/CartaoLive";
import { liveEstaNoAr } from "@/lib/ao-vivo";
import { exigirConta } from "@/lib/conta";
import { precoEmReais, quandoAcontece } from "@/lib/formato";
import { listarMinhasLives } from "@/lib/lives";
import { ROTULO_STATUS_COMPRA } from "@/lib/tipos";

export const metadata: Metadata = { title: "Minhas lives" };
export const dynamic = "force-dynamic";

export default async function MinhasLives() {
  const conta = await exigirConta("/minhas-lives");
  const itens = await Promise.all(
    (await listarMinhasLives(conta.usuarioId)).map(async (item) => ({
      ...item,
      noAr: await liveEstaNoAr(item.live),
    })),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold">Minhas lives</h1>
      <p className="mt-1 text-sm text-texto-fraco">
        Tudo o que você comprou fica aqui.
      </p>

      {itens.length === 0 ? (
        <p className="mt-10 text-sm text-texto-fraco">
          Você ainda não comprou nenhuma live.{" "}
          <Link className="text-destaque hover:underline" href="/">
            Ver a agenda
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {itens.map(({ compra, live, noAr }) => (
            <li key={compra.id} className="cartao p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SeloEstado estado={live.estado} noAr={noAr} />
                <span
                  className={`text-xs font-semibold ${
                    compra.status === "aprovada" ? "text-ok" : "text-texto-fraco"
                  }`}
                >
                  {ROTULO_STATUS_COMPRA[compra.status]} ·{" "}
                  {precoEmReais(compra.valor_centavos)}
                </span>
              </div>

              <h2 className="mt-3 font-bold">{live.titulo}</h2>
              <p className="mt-1 text-xs text-texto-fraco">
                {quandoAcontece(live)}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {compra.status === "aprovada" && noAr ? (
                  <Link className="botao" href={`/assistir/${live.slug}`}>
                    Assistir agora
                  </Link>
                ) : null}
                <Link className="botao botao-secundario" href={`/live/${live.slug}`}>
                  Detalhes
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
