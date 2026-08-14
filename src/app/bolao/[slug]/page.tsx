import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BotaoComprar } from "@/components/BotaoComprar";
import { FormularioPalpite } from "@/components/FormularioPalpite";
import { comprarIngresso } from "@/lib/acoes/compra";
import {
  PONTOS,
  PONTOS_MAXIMOS_POR_CATEGORIA,
  categoriaAberta,
  categoriasLiberadas,
  listarAtletas,
  listarCategorias,
  listarResultados,
  meusPalpites,
  pontuar,
  ticketsDoBolao,
  topCinco,
} from "@/lib/bolao";
import { mercadoPagoConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { janelaLegivel, precoEmReais } from "@/lib/formato";
import { comprouAlgumaCoisa } from "@/lib/ingressos";
import { buscarLivePorSlug } from "@/lib/lives";
import type { Ingresso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const live = await buscarLivePorSlug(slug);
  if (!live || live.estado === "rascunho") return { title: "Bolão" };
  return { title: `Bolão · ${live.titulo}` };
}

export default async function PaginaDoBolao({ params }: Props) {
  const { slug } = await params;

  const live = await buscarLivePorSlug(slug);
  if (!live) notFound();

  const conta = await contaAtual();
  if (live.estado === "rascunho" && !conta?.perfil?.admin) notFound();

  const categorias = await listarCategorias(live.id);
  if (categorias.length === 0) notFound();

  const ids = categorias.map((c) => c.id);
  const ehAdmin = Boolean(conta?.perfil?.admin);

  const [atletas, resultados, meus, tickets, liberadas, temALive] = await Promise.all([
    listarAtletas(ids),
    listarResultados(ids),
    conta ? meusPalpites(conta.usuarioId, ids) : Promise.resolve(new Map()),
    ticketsDoBolao(live.id),
    conta
      ? categoriasLiberadas(conta.usuarioId, live.id, ehAdmin)
      : Promise.resolve(new Set<string>()),
    conta
      ? comprouAlgumaCoisa(conta.usuarioId, live.id)
      : Promise.resolve(false),
  ]);

  const nomeDoAtleta = new Map(atletas.map((a) => [a.id, a.nome]));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
      <Link
        className="text-sm text-texto-apagado transition-colors hover:text-texto"
        href={`/live/${live.slug}`}
      >
        ← {live.titulo}
      </Link>

      <h1 className="display mt-5 text-[clamp(2.25rem,7vw,3.75rem)]">Bolão</h1>
      <p className="mt-3 max-w-prose leading-relaxed text-texto-fraco">
        Diga quem fica no top 5 de cada categoria. Quem somar mais pontos
        naquela categoria leva o prêmio dela. Cada categoria é disputada
        separado, com o seu ticket.
      </p>

      {!temALive && !ehAdmin ? (
        <p className="aviso aviso-atencao mt-6">
          O bolão é para quem tem ingresso da transmissão. Pegue o seu na{" "}
          <Link className="font-semibold hover:underline" href={`/live/${live.slug}`}>
            página da live
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="botao botao-secundario" href={`/bolao/${live.slug}/ranking`}>
          Ver classificação
        </Link>
        {!conta ? (
          <Link
            className="botao"
            href={`/entrar?voltar=${encodeURIComponent(`/bolao/${live.slug}`)}`}
          >
            Entrar para palpitar
          </Link>
        ) : null}
      </div>

      {/* ---------------- Categorias ---------------- */}
      {categorias.map((categoria) => {
        const daCategoria = atletas.filter((a) => a.categoria_id === categoria.id);
        const meu = meus.get(categoria.id);
        const aberta = categoriaAberta(categoria);

        const ticket = tickets.get(categoria.id);
        const liberada = liberadas.has(categoria.id);

        const oficial = resultados.find((r) => r.categoria_id === categoria.id);
        // Quanto a pessoa fez nesta categoria. Sem isso ela vê o pódio e o
        // próprio palpite lado a lado, mas tem de contar os pontos na mão.
        const meusPontos =
          oficial && meu ? pontuar(topCinco(meu), topCinco(oficial)) : null;

        return (
          <section key={categoria.id} className="cartao mt-6 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="display text-xl">{categoria.nome}</h2>
                {categoria.premio ? (
                  <p className="mt-1 text-sm text-texto-fraco">
                    <span className="etiqueta !text-destaque-fraco">Prêmio</span>{" "}
                    {categoria.premio}
                  </p>
                ) : null}
              </div>
              <span
                className={`numero text-xs font-bold uppercase tracking-wider ${
                  aberta ? "text-ok" : "text-texto-apagado"
                }`}
              >
                {aberta
                  ? `Fecha ${janelaLegivel(categoria.fecha_em, null).replace("A partir de ", "")}`
                  : "Palpites fechados"}
              </span>
            </div>

            {oficial ? (
              <ResultadoOficial posicoes={topCinco(oficial)} nomes={nomeDoAtleta} />
            ) : null}

            {meu ? (
              <div className="mt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="etiqueta !text-ok">✓ Seu palpite</p>
                  {meusPontos !== null ? (
                    <p className="numero text-sm">
                      <strong className="display text-lg text-destaque">
                        {meusPontos}
                      </strong>{" "}
                      <span className="text-texto-apagado">
                        de {PONTOS_MAXIMOS_POR_CATEGORIA} pontos aqui
                      </span>
                    </p>
                  ) : null}
                </div>

                <ol className="numero mt-2 flex flex-col gap-1 text-sm">
                  {topCinco(meu).map((atletaId, indice) => {
                    const acertouNaMosca =
                      oficial && topCinco(oficial)[indice] === atletaId;
                    const estaNoTop = oficial && topCinco(oficial).includes(atletaId);

                    return (
                      <li
                        key={atletaId}
                        className={acertouNaMosca ? "text-ok" : undefined}
                      >
                        <span className="text-texto-apagado">{indice + 1}º</span>{" "}
                        {nomeDoAtleta.get(atletaId) ?? "—"}
                        {acertouNaMosca ? (
                          <span className="ml-2 text-xs font-bold uppercase">
                            na mosca
                          </span>
                        ) : estaNoTop ? (
                          <span className="ml-2 text-xs text-texto-apagado">
                            no top 5
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}

            {!aberta ? (
              meu ? null : (
                <p className="mt-4 text-sm text-texto-fraco">
                  Esta categoria fechou antes de você palpitar.
                </p>
              )
            ) : daCategoria.length < 5 ? (
              <p className="aviso aviso-atencao mt-4">
                A lista de atletas ainda não foi publicada. Volte mais perto do
                evento.
              </p>
            ) : !conta ? (
              <p className="mt-4 text-sm text-texto-fraco">
                Entre na sua conta para palpitar.
              </p>
            ) : !temALive ? (
              <p className="mt-4 text-sm text-texto-fraco">
                Primeiro o ingresso da transmissão.{" "}
                <Link className="text-destaque hover:underline" href={`/live/${live.slug}`}>
                  Ver ingressos
                </Link>
              </p>
            ) : !liberada ? (
              <TicketDaCategoria ticket={ticket} pagamentoLigado={mercadoPagoConfigurado} />
            ) : (
              <>
                {meu ? (
                  <p className="mt-5 text-sm text-texto-fraco">Quer mudar?</p>
                ) : null}
                <FormularioPalpite
                  categoriaId={categoria.id}
                  atletas={daCategoria}
                  escolhaAtual={meu ? topCinco(meu) : []}
                />
              </>
            )}
          </section>
        );
      })}

      {/* ---------------- Regulamento ---------------- */}
      <section className="mt-10">
        <h2 className="etiqueta">Como pontua</h2>
        <ul className="mt-4 flex flex-col gap-2 text-sm text-texto-fraco">
          <Regra pontos={PONTOS.primeiroExato}>Acertar o campeão da categoria</Regra>
          <Regra pontos={PONTOS.posicaoExata}>
            Acertar o 2º, 3º, 4º ou 5º na posição exata
          </Regra>
          <Regra pontos={PONTOS.dentroDoTop}>
            Colocar no top 5 alguém que ficou no top 5, em outra posição
          </Regra>
        </ul>
        <p className="mt-3 text-xs text-texto-apagado">
          Máximo de {PONTOS_MAXIMOS_POR_CATEGORIA} pontos por categoria.
        </p>

        <div className="regua my-7" />

        <h2 className="etiqueta">Regras</h2>
        <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-texto-fraco">
          <li>
            Palpitar é um extra de quem tem ingresso desta live. Não se cobra
            nada a mais para participar, e o prêmio não sai do bolso de
            ninguém que palpitou.
          </li>
          <li>
            Cada categoria fecha no horário mostrado acima. Depois disso o
            palpite não pode mais ser mudado.
          </li>
          <li>
            Empate: vence quem tiver mais acertos de posição exata; se persistir,
            quem palpitou primeiro.
          </li>
          <li>
            O prêmio sai do bolso do organizador e é entregue depois do resultado
            oficial da organização do evento.
          </li>
        </ul>
      </section>
    </main>
  );
}

function Regra({ pontos, children }: { pontos: number; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="numero display w-8 shrink-0 text-lg text-destaque">
        {pontos}
      </span>
      <span>{children}</span>
    </li>
  );
}

function ResultadoOficial({
  posicoes,
  nomes,
}: {
  posicoes: string[];
  nomes: Map<string, string>;
}) {
  return (
    <div className="mt-4 rounded-lg border border-borda bg-fundo-2 p-4">
      <p className="etiqueta">Resultado oficial</p>
      <ol className="numero mt-2 flex flex-col gap-1 text-sm">
        {posicoes.map((atletaId, indice) => (
          <li key={atletaId}>
            <span className="text-texto-apagado">{indice + 1}º</span>{" "}
            <strong>{nomes.get(atletaId) ?? "—"}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** O convite para comprar o ticket daquela categoria. */
function TicketDaCategoria({
  ticket,
  pagamentoLigado,
}: {
  ticket: Ingresso | undefined;
  pagamentoLigado: boolean;
}) {
  if (!ticket) {
    return (
      <p className="mt-4 text-sm text-texto-fraco">
        O ticket desta categoria ainda não está à venda.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-borda bg-fundo-2 p-4">
      <p className="text-sm text-texto-fraco">
        Para palpitar nesta categoria você precisa do ticket dela.
      </p>
      <p className="numero display mt-1 text-2xl">
        {precoEmReais(ticket.preco_centavos)}
      </p>

      <div className="mt-3">
        {pagamentoLigado ? (
          <BotaoComprar
            acao={comprarIngresso.bind(null, ticket.id)}
            rotulo={`Comprar ticket · ${precoEmReais(ticket.preco_centavos)}`}
          />
        ) : (
          <p className="aviso aviso-atencao">
            O pagamento ainda não foi ligado neste site.
          </p>
        )}
      </div>
    </div>
  );
}
