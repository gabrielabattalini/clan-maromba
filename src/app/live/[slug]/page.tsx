import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BotaoComprar } from "@/components/BotaoComprar";
import { SeloEstado } from "@/components/CartaoLive";
import { comprarAcesso } from "@/lib/acoes/compra";
import { liveEstaNoAr } from "@/lib/ao-vivo";
import { mercadoPagoConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { precoEmReais, quandoAcontece } from "@/lib/formato";
import { buscarCompra, buscarLivePorSlug } from "@/lib/lives";

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

  // Rascunho é invisível para o público.
  if (live.estado === "rascunho" && !ehAdmin) notFound();

  const compra = conta ? await buscarCompra(conta.usuarioId, live.id) : null;
  const temAcesso = compra?.status === "aprovada";
  const noAr = await liveEstaNoAr(live);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <Link
        className="text-sm text-texto-apagado transition-colors hover:text-texto"
        href="/"
      >
        ← Todas as lives
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
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

        {/* ---------------- Compra ---------------- */}
        <aside className="lg:sticky lg:top-24">
          {/* Recado de volta do Checkout Pro. Repare que ele não libera nada:
              quem libera é o webhook. Aqui é só conversa com o comprador. */}
          {pagamento === "sucesso" && !temAcesso ? (
            <p className="aviso aviso-ok mb-4">
              Pagamento recebido. A confirmação chega em alguns segundos —
              atualize a página se o botão de assistir não aparecer.
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

          <div className="cartao overflow-hidden">
            {temAcesso ? (
              <div className="flex flex-col items-center gap-4 p-6 text-center">
                <span className="etiqueta !text-ok">✓ Acesso liberado</span>

                {noAr ? (
                  <>
                    <p className="display text-2xl">A live começou</p>
                    <Link
                      className="botao w-full !py-3 !text-base"
                      href={`/assistir/${live.slug}`}
                    >
                      Assistir agora
                    </Link>
                  </>
                ) : live.estado === "encerrada" ? (
                  <p className="text-sm text-texto-fraco">
                    Esta transmissão foi encerrada.
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-texto-fraco">
                    O botão de assistir aparece sozinho quando a transmissão
                    começar. Não precisa ficar recarregando — é só voltar no
                    horário.
                  </p>
                )}
              </div>
            ) : live.estado === "encerrada" ? (
              <div className="p-6 text-center">
                <p className="display text-xl">Encerrada</p>
                <p className="mt-2 text-sm text-texto-fraco">
                  Esta live não está mais à venda.
                </p>
              </div>
            ) : (
              <>
                <div className="p-6 text-center">
                  <p className="etiqueta">Acesso individual</p>
                  <p className="numero display mt-2 text-[2.75rem] leading-none">
                    {precoEmReais(live.preco_centavos)}
                  </p>
                  <p className="mt-2 text-xs text-texto-apagado">
                    pagamento único, só desta live
                  </p>
                </div>

                <div className="picote mx-6" aria-hidden />

                <div className="p-6">
                  {!conta ? (
                    <>
                      <Link
                        className="botao w-full !py-3 !text-base"
                        href={`/entrar?voltar=${encodeURIComponent(`/live/${live.slug}`)}`}
                      >
                        Entrar para comprar
                      </Link>
                      <p className="mt-3 text-center text-xs text-texto-apagado">
                        Ainda não tem conta?{" "}
                        <Link
                          className="text-destaque hover:underline"
                          href={`/cadastro?voltar=${encodeURIComponent(`/live/${live.slug}`)}`}
                        >
                          Criar em 30 segundos
                        </Link>
                      </p>
                    </>
                  ) : !mercadoPagoConfigurado ? (
                    <p className="aviso aviso-atencao text-center">
                      O pagamento ainda não foi ligado neste site.
                    </p>
                  ) : (
                    <BotaoComprar
                      acao={comprarAcesso.bind(null, live.slug)}
                      rotulo={
                        compra?.status === "pendente"
                          ? "Retomar pagamento"
                          : "Comprar acesso"
                      }
                    />
                  )}
                </div>
              </>
            )}
          </div>
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
