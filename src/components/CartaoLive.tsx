import Link from "next/link";

import { precoEmReais, quandoAcontece } from "@/lib/formato";
import type { Live } from "@/lib/tipos";

/**
 * O selo diz o que interessa ao público: está no ar agora, já acabou, ou
 * ainda vem. Quem responde se está no ar é a Cloudflare (`lib/ao-vivo.ts`),
 * não um botão do painel.
 */
export function SeloEstado({ estado, noAr }: { estado: Live["estado"]; noAr: boolean }) {
  if (noAr) {
    return (
      <span className="selo selo-vivo">
        <span className="ponto-vivo" aria-hidden />
        Ao vivo agora
      </span>
    );
  }

  return (
    <span className="selo selo-neutro">
      {estado === "encerrada" ? "Encerrada" : "Em breve"}
    </span>
  );
}

/**
 * Cartão-ingresso: a live é um evento avulso que se compra, então a forma
 * empresta a do ingresso — bloco de informação, picote, bloco de preço.
 */
export function CartaoLive({
  live,
  noAr,
  comprada,
}: {
  live: Live;
  noAr: boolean;
  comprada?: boolean;
}) {
  return (
    <Link
      href={`/live/${live.slug}`}
      className="cartao group flex flex-col transition-colors hover:border-borda-forte"
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        <SeloEstado estado={live.estado} noAr={noAr} />

        <h3 className="display text-2xl text-balance transition-colors group-hover:text-destaque">
          {live.titulo}
        </h3>

        {live.descricao ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-texto-fraco">
            {live.descricao}
          </p>
        ) : null}
      </div>

      <div className="picote mx-5" aria-hidden />

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="numero text-xs text-texto-apagado">{quandoAcontece(live)}</span>

        {comprada ? (
          <span className="etiqueta !text-ok">Você tem acesso</span>
        ) : (
          <span className="numero display text-xl leading-none">
            {precoEmReais(live.preco_centavos)}
          </span>
        )}
      </div>
    </Link>
  );
}
