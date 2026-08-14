import Link from "next/link";

import { SeloEstado } from "@/components/CartaoLive";
import { Contador } from "@/components/Contador";
import { janelaLegivel, precoEmReais, quandoAcontece } from "@/lib/formato";
import type { IngressoNaVitrine, Live } from "@/lib/tipos";

type Props = {
  live: Live;
  noAr: boolean;
  comprada: boolean;
  vitrine: IngressoNaVitrine[];
};

/**
 * O evento principal ocupando a home inteira.
 *
 * Tudo que aparece aqui — programação, preço, desconto, quantos restam — sai
 * dos próprios ingressos. Não há texto de propaganda escrito à mão: se o dono
 * mudar um horário no painel, a propaganda muda junto. É o que impede a home
 * de anunciar uma coisa e o acesso valer outra.
 */
export function DestaqueDaLive({ live, noAr, comprada, vitrine }: Props) {
  const disponiveis = vitrine.filter((i) => !i.esgotado || i.jaTenho);

  // Passe completo = sem janela nenhuma, vale a transmissão inteira.
  const passe = vitrine.find(
    (i) => i.ingresso.inicia_em === null && i.ingresso.termina_em === null,
  );
  const porDia = vitrine.filter(
    (i) => i.ingresso.inicia_em !== null || i.ingresso.termina_em !== null,
  );

  const maisBarato =
    disponiveis.length > 0
      ? Math.min(...disponiveis.map((i) => i.precoAgora))
      : null;

  return (
    <section className="surgir py-14 sm:py-20">
      {/* No celular a ordem é outra de propósito: nome do evento, preço, e só
          então a programação. O preço é o que decide a compra — enterrá-lo
          embaixo de uma tabela de quatro dias seria perder quem chega pelo
          telefone, que é a maioria. */}
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[1fr_23rem]">
        {/* ---------------- O evento ---------------- */}
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-3">
            <SeloEstado estado={live.estado} noAr={noAr} />
            {comprada ? (
              <span className="selo selo-neutro !text-ok">✓ Você já comprou</span>
            ) : null}
          </div>

          <h2 className="display mt-5 text-[clamp(2.5rem,9vw,5.5rem)] text-balance">
            {live.titulo}
          </h2>

          <p className="numero mt-4 text-sm text-texto-fraco">{quandoAcontece(live)}</p>

          {live.descricao ? (
            <p className="mt-6 max-w-prose whitespace-pre-line leading-relaxed text-texto-fraco">
              {live.descricao}
            </p>
          ) : null}
        </div>

        {/* ---------------- A oferta ---------------- */}
        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24">
          <div className="cartao overflow-hidden">
            {passe ? (
              <>
                <p className="bg-destaque/12 px-5 py-1.5 text-center text-[0.6875rem] font-bold uppercase tracking-widest text-destaque-fraco">
                  Melhor escolha · todos os dias
                </p>

                <div className="p-6 text-center">
                  <h3 className="display text-xl">{passe.ingresso.nome}</h3>

                  {passe.emPromocao && passe.ingresso.preco_cheio_centavos !== null ? (
                    <p className="numero mt-4 text-sm text-texto-apagado line-through">
                      {precoEmReais(passe.ingresso.preco_cheio_centavos)}
                    </p>
                  ) : null}

                  <p className="numero display mt-1 text-[3.25rem] leading-none">
                    {precoEmReais(passe.precoAgora)}
                  </p>

                  {passe.restam !== null && passe.restam > 0 ? (
                    <p className="numero mt-3 text-xs font-semibold text-alerta">
                      {passe.restam === 1
                        ? "Resta 1 ingresso"
                        : `Restam ${passe.restam} ingressos`}
                    </p>
                  ) : null}
                  {passe.esgotado ? (
                    <p className="mt-3 text-xs font-semibold text-texto-apagado">
                      Esgotado
                    </p>
                  ) : null}
                </div>

                {passe.emPromocao && passe.ingresso.promocao_ate ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borda bg-fundo-2 px-5 py-2.5 text-xs">
                    <span className="text-texto-fraco">Este preço acaba em</span>
                    <Contador ate={passe.ingresso.promocao_ate} />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-6 text-center">
                <p className="etiqueta">Acesso</p>
                <p className="numero display mt-2 text-[3.25rem] leading-none">
                  {precoEmReais(maisBarato ?? live.preco_centavos)}
                </p>
              </div>
            )}

            <div className="border-t border-borda p-5">
              <Link className="botao w-full !py-3 !text-base" href={`/live/${live.slug}`}>
                {comprada ? "Ver meu acesso" : "Garantir meu acesso"}
              </Link>

              {porDia.length > 0 && maisBarato !== null ? (
                <p className="mt-3 text-center text-xs leading-relaxed text-texto-apagado">
                  Prefere só um dia? Também dá, a partir de{" "}
                  <strong className="text-texto-fraco">{precoEmReais(maisBarato)}</strong>.
                </p>
              ) : null}
            </div>
          </div>

          <ul className="mt-5 flex flex-col gap-2 text-xs leading-relaxed text-texto-apagado">
            <li>Pagou pelo Pix ou cartão, o acesso entra na conta sozinho.</li>
            <li>Assiste do celular, do computador ou da TV.</li>
            <li>Uma conta, um aparelho por vez.</li>
          </ul>
        </aside>

        {/* ---------------- Programação ---------------- */}
        {porDia.length > 0 ? (
          <div className="lg:col-start-1 lg:row-start-2">
            <h3 className="etiqueta">Programação · horário de Brasília</h3>

            <ul className="mt-4 flex flex-col">
              {porDia.map(({ ingresso }) => (
                <li
                  key={ingresso.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-borda py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{ingresso.nome}</p>
                    {ingresso.descricao ? (
                      <p className="mt-0.5 text-sm text-texto-fraco">
                        {ingresso.descricao}
                      </p>
                    ) : null}
                  </div>
                  <p className="numero shrink-0 text-sm text-texto-fraco">
                    {janelaLegivel(ingresso.inicia_em, ingresso.termina_em)}
                  </p>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs leading-relaxed text-texto-apagado">
              Os horários já estão convertidos para o Brasil. As finais
              atravessam a madrugada — o seu acesso não corta à meia-noite.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
