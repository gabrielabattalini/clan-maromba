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
  return { title: live?.titulo ?? "Live" };
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
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Link className="text-sm text-texto-fraco hover:text-texto" href="/">
        ← Todas as lives
      </Link>

      <div className="mt-5 flex items-center gap-3">
        <SeloEstado estado={live.estado} noAr={noAr} />
        {live.estado === "rascunho" ? (
          <span className="text-xs font-semibold text-alerta">
            Rascunho — só você enxerga esta página
          </span>
        ) : null}
      </div>

      <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{live.titulo}</h1>
      <p className="mt-2 text-sm text-texto-fraco">{quandoAcontece(live)}</p>

      {live.descricao ? (
        <p className="mt-6 whitespace-pre-line leading-relaxed text-texto-fraco">
          {live.descricao}
        </p>
      ) : null}

      {/* Recado de volta do Checkout Pro. Repare que ele não libera nada:
          quem libera é o webhook. Aqui é só conversa com o comprador. */}
      {pagamento === "sucesso" && !temAcesso ? (
        <p className="aviso aviso-ok mt-6">
          Pagamento recebido! A confirmação do Mercado Pago chega em alguns
          segundos — atualize a página se o botão de assistir não aparecer.
        </p>
      ) : null}
      {pagamento === "pendente" ? (
        <p className="aviso aviso-atencao mt-6">
          Seu pagamento está em análise. Assim que for aprovado, o acesso é
          liberado automaticamente aqui.
        </p>
      ) : null}
      {pagamento === "falhou" ? (
        <p className="aviso aviso-erro mt-6">
          O pagamento não foi concluído. Você pode tentar de novo abaixo.
        </p>
      ) : null}

      <section className="cartao mt-8 flex flex-col items-center gap-4 p-6">
        {temAcesso ? (
          <>
            <p className="text-center font-semibold text-ok">✓ Você tem acesso a esta live</p>
            {noAr ? (
              <Link className="botao w-full !py-3 !text-base" href={`/assistir/${live.slug}`}>
                Assistir agora
              </Link>
            ) : live.estado === "encerrada" ? (
              <p className="text-center text-sm text-texto-fraco">
                Esta transmissão foi encerrada.
              </p>
            ) : (
              <p className="text-center text-sm text-texto-fraco">
                Volte aqui no horário da live — o botão de assistir aparece
                sozinho quando a transmissão começar.
              </p>
            )}
          </>
        ) : live.estado === "encerrada" ? (
          <p className="text-center text-sm text-texto-fraco">
            Esta live já foi encerrada e não está mais à venda.
          </p>
        ) : (
          <>
            <p className="text-3xl font-black">{precoEmReais(live.preco_centavos)}</p>
            <p className="-mt-2 text-xs text-texto-fraco">acesso individual a esta live</p>

            {!conta ? (
              <Link
                className="botao w-full !py-3 !text-base"
                href={`/entrar?voltar=${encodeURIComponent(`/live/${live.slug}`)}`}
              >
                Entrar para comprar
              </Link>
            ) : !mercadoPagoConfigurado ? (
              <p className="aviso aviso-atencao w-full text-center">
                O pagamento ainda não foi ligado neste site.
              </p>
            ) : (
              <BotaoComprar
                acao={comprarAcesso.bind(null, live.slug)}
                rotulo={
                  compra?.status === "pendente"
                    ? "Retomar pagamento"
                    : `Comprar acesso · ${precoEmReais(live.preco_centavos)}`
                }
              />
            )}
          </>
        )}
      </section>

      <ul className="mt-8 flex flex-col gap-2 text-sm text-texto-fraco">
        <li>• O acesso é individual: um aparelho conectado por vez.</li>
        <li>• O vídeo tem marca d&apos;água com seus dados — não compartilhe.</li>
        <li>• Dúvida com o pagamento? Fale com o suporte antes de comprar de novo.</li>
      </ul>
    </main>
  );
}
