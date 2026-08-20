import type { Metadata } from "next";
import Link from "next/link";

import { AcessoGarantido } from "@/components/AcessoGarantido";
import { BotaoComprar } from "@/components/BotaoComprar";
import { SeloEstado } from "@/components/CartaoLive";
import { ListaDeIngressos } from "@/components/ListaDeIngressos";
import { liveEstaNoAr } from "@/lib/ao-vivo";
import { comprarIngresso } from "@/lib/acoes/compra";
import { entradasPorCategoria, listarCategorias, ticketsDoBolao } from "@/lib/bolao";
import { mercadoPagoConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { precoEmReais, quandoAcontece } from "@/lib/formato";
import { montarVitrine } from "@/lib/ingressos";
import { listarLivesPublicas, listarMinhasLives } from "@/lib/lives";
import type { Live } from "@/lib/tipos";

export const metadata: Metadata = {
  title: "Loja",
  description: "Ingressos das transmissões e entradas do bolão do Clan Maromba.",
};
export const dynamic = "force-dynamic";

export default async function Loja() {
  // A loja é pública de propósito: quem ainda não tem conta precisa ver o
  // preço antes de se cadastrar. Comprar é que exige entrar.
  const conta = await contaAtual();

  const lives = (await listarLivesPublicas()).filter((l) => l.estado !== "encerrada");

  const prateleiras = await Promise.all(
    lives.map(async (live) => {
      const [vitrine, categorias, tickets, entradas, noAr] = await Promise.all([
        montarVitrine(live.id, conta?.usuarioId),
        listarCategorias(live.id),
        ticketsDoBolao(live.id),
        conta
          ? entradasPorCategoria(conta.usuarioId, live.id)
          : Promise.resolve(new Map()),
        liveEstaNoAr(live),
      ]);

      return { live, vitrine, categorias, tickets, entradas, noAr };
    }),
  );

  // "Meus acessos" é por LIVE, não por compra: quem levou três tickets de
  // bolão tem três compras do mesmo evento, e três cartões iguais na tela
  // não diriam nada a mais.
  const minhasCompras = conta ? await listarMinhasLives(conta.usuarioId) : [];
  const pagas = minhasCompras.filter((i) => i.compra.status === "aprovada");

  const porLive = new Map<string, { live: Live; itens: string[] }>();
  for (const { live, ingresso } of pagas) {
    const grupo = porLive.get(live.id) ?? { live, itens: [] };
    grupo.itens.push(ingresso?.nome ?? "Acesso à live");
    porLive.set(live.id, grupo);
  }

  const meusAcessos = [...porLive.values()].map(({ live, itens }) => ({
    live,
    itens: contar(itens),
    noAr: prateleiras.find((p) => p.live.id === live.id)?.noAr ?? false,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <h1 className="display text-4xl">Loja</h1>
      <p className="mt-3 text-sm text-texto-fraco">
        Ingressos das transmissões e entradas do bolão.
      </p>

      {/* ---------------- O que eu já tenho ---------------- */}
      {meusAcessos.length > 0 ? (
        <section className="mt-8">
          <h2 className="etiqueta mb-3">Meus acessos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {meusAcessos.map(({ live, itens, noAr }) => (
              <div key={live.id}>
                <p className="mb-2 truncate font-medium">{live.titulo}</p>
                <AcessoGarantido
                  slugDaLive={live.slug}
                  itens={itens}
                  noAr={noAr}
                  podeAssistirAgora={noAr}
                  linkDaLive
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------- Prateleiras ---------------- */}
      {prateleiras.length === 0 ? (
        <div className="cartao mt-8 p-8 text-center">
          <p className="display text-xl">Nada à venda agora</p>
          <p className="mt-2 text-sm text-texto-fraco">
            Não há transmissão anunciada. Volte em breve.
          </p>
          <Link className="botao mt-5" href="/">
            Ir para a página inicial
          </Link>
        </div>
      ) : (
        prateleiras.map(({ live, vitrine, categorias, tickets, entradas, noAr }) => {
          const daTransmissao = vitrine.filter((i) => !i.ingresso.so_bolao);

          return (
            <section key={live.id} className="mt-10">
              <div className="flex flex-wrap items-center gap-3">
                <SeloEstado estado={live.estado} noAr={noAr} />
              </div>

              <h2 className="display mt-3 text-2xl">
                <Link className="hover:text-destaque" href={`/live/${live.slug}`}>
                  {live.titulo}
                </Link>
              </h2>
              <p className="numero mt-1.5 text-sm text-texto-apagado">
                {quandoAcontece(live)}
              </p>

              <div className="regua my-6" />

              <h3 className="etiqueta mb-3">Assistir</h3>
              <ListaDeIngressos
                itens={daTransmissao}
                slugDaLive={live.slug}
                logado={Boolean(conta)}
                pagamentoLigado={mercadoPagoConfigurado}
              />

              {categorias.length > 0 ? (
                <>
                  <h3 className="etiqueta mb-1 mt-8">Bolão</h3>
                  <p className="mb-3 text-sm text-texto-fraco">
                    Uma entrada por categoria. Precisa ter o ingresso da
                    transmissão, e o palpite não muda depois de enviado.
                  </p>

                  <div className="flex flex-col gap-3">
                    {categorias.map((categoria) => (
                      <TicketDoBolao
                        key={categoria.id}
                        nome={categoria.nome}
                        premio={categoria.premio}
                        ticket={tickets.get(categoria.id)}
                        entradas={entradas.get(categoria.id)?.compradas ?? 0}
                        logado={Boolean(conta)}
                        pagamentoLigado={mercadoPagoConfigurado}
                      />
                    ))}
                  </div>

                  <p className="mt-3 text-sm text-texto-fraco">
                    Comprou?{" "}
                    <Link
                      className="font-semibold text-destaque hover:underline"
                      href={`/bolao/${live.slug}`}
                    >
                      Faça seu palpite
                    </Link>
                  </p>
                </>
              ) : null}
            </section>
          );
        })
      )}
    </main>
  );
}

function TicketDoBolao({
  nome,
  premio,
  ticket,
  entradas,
  logado,
  pagamentoLigado,
}: {
  nome: string;
  premio: string;
  ticket: { id: string; preco_centavos: number } | undefined;
  entradas: number;
  logado: boolean;
  pagamentoLigado: boolean;
}) {
  return (
    <div className="cartao flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-40 flex-1">
        <h4 className="font-semibold">{nome}</h4>
        {premio ? (
          <p className="mt-0.5 text-sm text-texto-fraco">Prêmio: {premio}</p>
        ) : null}
        {entradas > 0 ? (
          <p className="numero mt-1 text-xs text-ok">
            Você tem {entradas} {entradas === 1 ? "entrada" : "entradas"}
          </p>
        ) : null}
      </div>

      <div className="text-right">
        {!ticket ? (
          <span className="text-sm text-texto-apagado">Ainda não está à venda</span>
        ) : (
          <>
            <p className="numero display text-2xl leading-none">
              {precoEmReais(ticket.preco_centavos)}
            </p>
            <div className="mt-2">
              {!logado ? (
                <Link
                  className="botao botao-secundario !px-3 !py-1.5 !text-xs"
                  href={`/entrar?voltar=${encodeURIComponent("/loja")}`}
                >
                  Entrar para comprar
                </Link>
              ) : !pagamentoLigado ? (
                <span className="text-xs text-texto-apagado">
                  Pagamento desligado
                </span>
              ) : (
                <BotaoComprar
                  acao={comprarIngresso.bind(null, ticket.id)}
                  rotulo={entradas > 0 ? "Comprar outra" : "Comprar entrada"}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** ["Passe", "Bolão", "Bolão"] → ["Passe", "Bolão ×2"] */
function contar(nomes: string[]): string[] {
  const quantos = new Map<string, number>();
  for (const nome of nomes) quantos.set(nome, (quantos.get(nome) ?? 0) + 1);
  return [...quantos].map(([nome, n]) => (n > 1 ? `${nome} ×${n}` : nome));
}
