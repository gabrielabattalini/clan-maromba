import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeloEstado } from "@/components/CartaoLive";
import { ListaDeIngressos } from "@/components/ListaDeIngressos";
import { liveEstaNoAr } from "@/lib/ao-vivo";
import { listarCategorias } from "@/lib/bolao";
import { mercadoPagoConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { janelaLegivel, quandoAcontece } from "@/lib/formato";
import { montarVitrine, temAcessoAgora } from "@/lib/ingressos";
import { buscarLivePorSlug, listarProgramacao } from "@/lib/lives";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagamento?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const live = await buscarLivePorSlug(slug);

  // O título de um rascunho não sai daqui: esta função roda separada da
  // página, então não é protegida pelo notFound() lá de baixo.
  if (!live || live.estado === "rascunho") return { title: "Live" };

  return { title: live.titulo };
}

export default async function PaginaDaLive({ params, searchParams }: Props) {
  const { slug } = await params;
  const { pagamento } = await searchParams;

  const live = await buscarLivePorSlug(slug);
  if (!live) notFound();

  const conta = await contaAtual();
  const ehAdmin = Boolean(conta?.perfil?.admin);
  if (live.estado === "rascunho" && !ehAdmin) notFound();

  const [vitrine, noAr, podeAssistirAgora, categoriasDoBolao, programacao] =
    await Promise.all([
      montarVitrine(live.id, conta?.usuarioId),
      liveEstaNoAr(live),
      conta ? temAcessoAgora(conta.usuarioId, live.id) : Promise.resolve(false),
      listarCategorias(live.id),
      listarProgramacao(live.id),
    ]);

  // Os tickets do bolão não entram na vitrine da live: eles são vendidos na
  // página do bolão, ao lado da categoria a que pertencem. Misturados aqui,
  // seriam comprados por engano por quem só quer assistir.
  const meus = vitrine.filter((i) => i.jaTenho && !i.ingresso.so_bolao);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <Link
        className="text-sm text-texto-apagado transition-colors hover:text-texto"
        href="/"
      >
        ← Todas as lives
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_23rem] lg:items-start">
        {/* ---------------- Conteúdo ---------------- */}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <SeloEstado estado={live.estado} noAr={noAr} />
            {live.estado === "rascunho" ? (
              <span className="selo selo-neutro !text-alerta">
                Rascunho — só você vê
              </span>
            ) : null}
          </div>

          <h1 className="display mt-4 text-[clamp(2.25rem,7vw,4rem)]">{live.titulo}</h1>
          <p className="numero mt-4 text-sm text-texto-fraco">{quandoAcontece(live)}</p>

          {live.descricao ? (
            <>
              <div className="regua my-8" />
              <p className="max-w-prose whitespace-pre-line leading-relaxed text-texto-fraco">
                {live.descricao}
              </p>
            </>
          ) : null}

          {/* A programação é informação do evento, e não a lista do que está
              à venda: o dono vende um ingresso só e continua anunciando os
              quatro dias. */}
          {programacao.length > 0 ? (
            <>
              <div className="regua my-8" />
              <h2 className="etiqueta">Programação · horário de Brasília</h2>

              <ul className="mt-4 flex flex-col">
                {programacao.map((bloco) => (
                  <li
                    key={bloco.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-borda py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold">{bloco.nome}</span>
                      {bloco.descricao ? (
                        <span className="block text-sm text-texto-fraco">
                          {bloco.descricao}
                        </span>
                      ) : null}
                    </div>
                    <span className="numero text-sm text-texto-fraco">
                      {janelaLegivel(bloco.inicia_em, bloco.termina_em)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {categoriasDoBolao.length > 0 ? (
            <>
              <div className="regua my-8" />
              <div className="cartao flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-52 flex-1">
                  <p className="etiqueta !text-destaque-fraco">Bolão · para quem tem ingresso</p>
                  <p className="mt-1.5 font-semibold">
                    Comprou? Diga quem fica no top 5 e dispute o prêmio
                  </p>
                  {live.bolao_premio ? (
                    <p className="mt-1 text-sm text-texto-fraco">
                      {live.bolao_premio}
                    </p>
                  ) : null}
                </div>
                <Link className="botao botao-secundario" href={`/bolao/${live.slug}`}>
                  Palpitar
                </Link>
              </div>
            </>
          ) : null}

          <div className="regua my-8" />

          <h2 className="etiqueta">Como funciona</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-texto-fraco">
            <Item titulo="Pagou, liberou">
              O acesso entra na sua conta automaticamente assim que o pagamento é
              confirmado. Não precisa mandar comprovante para ninguém.
            </Item>
            <Item titulo="Um aparelho por vez">
              A conta é individual. Se entrar em outro aparelho, o primeiro é
              desconectado em segundos.
            </Item>
            <Item titulo="Vídeo marcado">
              A transmissão leva seu nome e e-mail sobrepostos. Compartilhar ou
              gravar deixa rastro e pode bloquear a conta.
            </Item>
          </ul>
        </div>

        {/* ---------------- Ingressos ---------------- */}
        <aside className="lg:sticky lg:top-24">
          {pagamento === "sucesso" && meus.length === 0 ? (
            <p className="aviso aviso-ok mb-4">
              Pagamento recebido. A confirmação chega em alguns segundos —
              atualize a página se o acesso não aparecer.
            </p>
          ) : null}
          {pagamento === "pendente" ? (
            <p className="aviso aviso-atencao mb-4">
              Seu pagamento está em análise. Assim que for aprovado, o acesso é
              liberado aqui automaticamente.
            </p>
          ) : null}
          {pagamento === "falhou" ? (
            <p className="aviso aviso-erro mb-4">
              O pagamento não foi concluído. Você pode tentar de novo abaixo.
            </p>
          ) : null}

          {podeAssistirAgora && noAr ? (
            <div className="cartao mb-4 flex flex-col items-center gap-3 p-6 text-center">
              <span className="etiqueta !text-ok">✓ Acesso liberado</span>
              <p className="display text-2xl">A transmissão começou</p>
              <Link
                className="botao w-full !py-3 !text-base"
                href={`/assistir/${live.slug}`}
              >
                Assistir agora
              </Link>
            </div>
          ) : meus.length > 0 ? (
            <div className="cartao mb-4 p-5">
              <p className="etiqueta !text-ok">✓ Você já tem</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {meus.map(({ ingresso }) => (
                  <li key={ingresso.id} className="font-medium">
                    {ingresso.nome}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-texto-apagado">
                O botão de assistir aparece sozinho quando a transmissão começar,
                dentro da sua janela.
              </p>
            </div>
          ) : null}

          {live.estado === "encerrada" ? (
            <div className="cartao p-6 text-center">
              <p className="display text-xl">Encerrada</p>
              <p className="mt-2 text-sm text-texto-fraco">
                Esta live não está mais à venda.
              </p>
            </div>
          ) : (
            <>
              <h2 className="etiqueta mb-3">
                {meus.length > 0 ? "Comprar mais dias" : "Escolha seu acesso"}
              </h2>
              <ListaDeIngressos
                itens={vitrine.filter((i) => !i.jaTenho && !i.ingresso.so_bolao)}
                slugDaLive={live.slug}
                logado={Boolean(conta)}
                pagamentoLigado={mercadoPagoConfigurado}
              />
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function Item({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 size-1 shrink-0 rounded-full bg-destaque" aria-hidden />
      <span>
        <strong className="font-semibold text-texto">{titulo}.</strong> {children}
      </span>
    </li>
  );
}
