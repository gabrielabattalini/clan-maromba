import Link from "next/link";

import { precoEmReais, quandoAcontece } from "@/lib/formato";
import type { Live } from "@/lib/tipos";

/**
 * O selo mostra o que interessa ao público: está no ar agora, já acabou, ou
 * ainda vem. Quem diz se está no ar é a Cloudflare (veja `lib/ao-vivo.ts`),
 * não um botão do painel.
 */
export function SeloEstado({ estado, noAr }: { estado: Live["estado"]; noAr: boolean }) {
  if (noAr) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destaque/15 px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-destaque">
        <span className="size-1.5 animate-pulse rounded-full bg-destaque" />
        Ao vivo agora
      </span>
    );
  }

  if (estado === "encerrada") {
    return (
      <span className="inline-flex rounded-full bg-painel px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-texto-fraco">
        Encerrada
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-painel px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-texto-fraco">
      Em breve
    </span>
  );
}

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
      className="cartao flex flex-col gap-3 p-5 transition hover:border-destaque/60"
    >
      <div className="flex items-center justify-between gap-3">
        <SeloEstado estado={live.estado} noAr={noAr} />
        {comprada ? (
          <span className="text-xs font-semibold text-ok">✓ Você tem acesso</span>
        ) : (
          <span className="text-sm font-bold">{precoEmReais(live.preco_centavos)}</span>
        )}
      </div>

      <h2 className="text-lg font-bold leading-snug">{live.titulo}</h2>

      {live.descricao ? (
        <p className="line-clamp-2 text-sm text-texto-fraco">{live.descricao}</p>
      ) : null}

      <p className="mt-auto text-xs text-texto-fraco">{quandoAcontece(live)}</p>
    </Link>
  );
}
