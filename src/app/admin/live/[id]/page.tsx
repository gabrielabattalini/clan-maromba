import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  alternarBanimento,
  alternarIngresso,
  apagarLive,
  criarCanalDeTransmissao,
  derrubarSessao,
  mudarEstadoDaLive,
} from "@/app/admin/acoes";
import { BotaoApagarLive } from "@/components/BotaoApagarLive";
import { CampoCopiavel } from "@/components/CampoCopiavel";
import { FormularioIngresso } from "@/components/FormularioIngresso";
import { estaTransmitindo } from "@/lib/cloudflare";
import { cloudflareConfigurado } from "@/lib/config";
import { exigirAdmin } from "@/lib/conta";
import { dataCurta, janelaLegivel, precoEmReais, quandoAcontece } from "@/lib/formato";
import { montarVitrine } from "@/lib/ingressos";
import { buscarDadosPrivados, buscarLivePorId } from "@/lib/lives";
import { clienteAdmin } from "@/lib/supabase/admin";
import { ROTULO_ESTADO, ROTULO_STATUS_COMPRA, type StatusCompra } from "@/lib/tipos";

export const metadata: Metadata = { title: "Live" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type LinhaComprador = {
  usuario_id: string;
  status: StatusCompra;
  valor_centavos: number;
  criado_em: string;
  perfis: { nome: string; email: string; banido: boolean } | null;
};

export default async function PaginaLiveAdmin({ params }: Props) {
  await exigirAdmin();
  const { id } = await params;

  const live = await buscarLivePorId(id);
  if (!live) notFound();

  const privado = await buscarDadosPrivados(live.id);
  const transmitindo = privado?.cf_input_uid
    ? await estaTransmitindo(privado.cf_input_uid)
    : false;

  const vitrine = await montarVitrine(live.id);

  const { data: compradores } = await clienteAdmin()
    .from("compras")
    .select("usuario_id, status, valor_centavos, criado_em, perfis(nome, email, banido)")
    .eq("live_id", live.id)
    .order("criado_em", { ascending: false })
    .returns<LinhaComprador[]>();

  const lista = compradores ?? [];
  const pagantes = lista.filter((c) => c.status === "aprovada");
  const faturamento = pagantes.reduce((total, c) => total + c.valor_centavos, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <Link className="text-sm text-texto-fraco hover:text-texto" href="/admin">
        ← Voltar ao painel
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-3xl">{live.titulo}</h1>
          <p className="numero mt-2 text-sm text-texto-apagado">
            {quandoAcontece(live)} · {precoEmReais(live.preco_centavos)} ·{" "}
            <Link className="hover:underline" href={`/live/${live.slug}`}>
              /live/{live.slug}
            </Link>
          </p>
        </div>
        <span className={`selo ${transmitindo ? "selo-vivo" : "selo-neutro"}`}>
          {transmitindo ? (
            <>
              <span className="ponto-vivo" aria-hidden />
              No ar
            </>
          ) : (
            ROTULO_ESTADO[live.estado]
          )}
        </span>
      </header>

      {/* ---------------- Estado da live ---------------- */}
      <section className="cartao mt-8 p-6">
        <h2 className="display text-xl">Situação</h2>
        <p className="mt-1 text-sm text-texto-fraco">
          <strong>Rascunho:</strong> só você vê. <strong>Anunciada:</strong> aparece
          na home e já pode ser comprada.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["rascunho", "anunciada"] as const).map((estado) => (
            <form key={estado} action={mudarEstadoDaLive.bind(null, live.id)}>
              <input type="hidden" name="estado" value={estado} />
              <button
                className={`botao ${live.estado === estado ? "" : "botao-secundario"}`}
                type="submit"
                disabled={live.estado === estado}
              >
                {ROTULO_ESTADO[estado]}
              </button>
            </form>
          ))}
        </div>

        <div className="mt-5 border-t border-borda pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">Transmissão</span>
            <span
              className={`text-sm font-bold ${transmitindo ? "text-ok" : "text-texto-fraco"}`}
            >
              {transmitindo ? "● No ar agora" : "○ Fora do ar"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-texto-fraco">
            Isto é automático: quem responde é a Cloudflare. Assim que o seu OBS
            conectar, o player libera sozinho para quem comprou — e trava sozinho
            quando você desligar. Você não precisa apertar nada no dia da live.
          </p>
        </div>
      </section>

      {/* ---------------- OBS ---------------- */}
      <section className="cartao mt-6 p-6">
        <h2 className="display text-xl">Dados para o OBS</h2>

        {privado?.cf_rtmps_url && privado.cf_stream_key ? (
          <>
            <p className="mt-1 text-sm text-texto-fraco">
              No OBS: <strong>Configurações → Transmissão</strong>, serviço{" "}
              <strong>Personalizado</strong>. Cole os dois campos abaixo.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <CampoCopiavel rotulo="Servidor (URL)" valor={privado.cf_rtmps_url} />
              <CampoCopiavel
                rotulo="Chave de transmissão"
                valor={privado.cf_stream_key}
                secreto
              />
            </div>
            <p className="mt-4 text-xs text-texto-fraco">
              ⚠️ A chave de transmissão é secreta: quem tiver ela consegue
              transmitir no seu lugar. Nunca mostre na tela durante a live.
            </p>
          </>
        ) : (
          <div className="mt-3">
            {cloudflareConfigurado ? (
              <>
                <p className="text-sm text-texto-fraco">
                  O canal de transmissão ainda não foi criado para esta live.
                </p>
                <form
                  className="mt-3"
                  action={criarCanalDeTransmissao.bind(null, live.id)}
                >
                  <button className="botao" type="submit">
                    Criar canal de transmissão
                  </button>
                </form>
              </>
            ) : (
              <p className="aviso aviso-atencao">
                O Cloudflare Stream ainda não foi configurado (Passo 4 da Fase 0).
                Sem ele não há URL nem chave de transmissão.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ---------------- Ingressos ---------------- */}
      <section className="cartao mt-6 p-6">
        <h2 className="display text-xl">Ingressos</h2>
        <p className="mt-1 text-sm text-texto-fraco">
          O que está à venda nesta live. Cada ingresso tem preço e janela de
          acesso próprios — é assim que você vende &ldquo;só o sábado&rdquo; e
          o passe completo ao mesmo tempo.
        </p>

        {vitrine.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-2">
            {vitrine.map(({ ingresso, precoAgora, emPromocao, vendidos, restam }) => (
              <li
                key={ingresso.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda px-4 py-3 ${
                  ingresso.ativo ? "" : "opacity-55"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {ingresso.nome}
                    {!ingresso.ativo ? (
                      <span className="ml-2 text-xs font-bold uppercase text-texto-apagado">
                        fora de venda
                      </span>
                    ) : null}
                  </p>
                  <p className="numero mt-0.5 text-xs text-texto-apagado">
                    {janelaLegivel(ingresso.inicia_em, ingresso.termina_em)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="numero font-semibold">
                      {precoEmReais(precoAgora)}
                      {emPromocao && ingresso.preco_cheio_centavos !== null ? (
                        <span className="ml-2 text-xs font-normal text-texto-apagado line-through">
                          {precoEmReais(ingresso.preco_cheio_centavos)}
                        </span>
                      ) : null}
                    </p>
                    <p className="numero text-xs text-texto-apagado">
                      {vendidos} vendido{vendidos === 1 ? "" : "s"}
                      {restam !== null ? ` · restam ${restam}` : ""}
                    </p>
                  </div>

                  <form
                    action={alternarIngresso.bind(
                      null,
                      live.id,
                      ingresso.id,
                      !ingresso.ativo,
                    )}
                  >
                    <button
                      className="botao botao-secundario !px-3 !py-1.5 !text-xs"
                      type="submit"
                    >
                      {ingresso.ativo ? "Tirar de venda" : "Voltar a vender"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-texto-fraco">
            Nenhum ingresso ainda — sem isso ninguém consegue comprar.
          </p>
        )}

        <div className="mt-6 border-t border-borda pt-6">
          <h3 className="mb-4 text-sm font-semibold">Novo ingresso</h3>
          <FormularioIngresso liveId={live.id} />
        </div>
      </section>

      {/* ---------------- Apagar ---------------- */}
      <section className="cartao mt-6 border-destaque/30 p-6">
        <h2 className="display text-xl">Apagar</h2>
        <p className="mt-1 text-sm text-texto-fraco">
          Serve para limpar live criada por engano ou duplicada. Live que já
          tem compra paga não pode ser apagada — nesse caso o caminho é marcar
          como encerrada.
        </p>
        <div className="mt-4">
          <BotaoApagarLive acao={apagarLive.bind(null, live.id)} titulo={live.titulo} />
        </div>
      </section>

      {/* ---------------- Compradores ---------------- */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="etiqueta !text-texto-fraco">Compradores</h2>
          <p className="numero text-sm text-texto-fraco">
            <strong className="text-texto">{pagantes.length}</strong> pagantes ·{" "}
            <strong className="display text-lg text-texto">
              {precoEmReais(faturamento)}
            </strong>
          </p>
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-texto-fraco">Ninguém comprou ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((compra) => (
              <li
                key={compra.usuario_id}
                className="cartao flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {compra.perfis?.nome || "Sem nome"}
                    {compra.perfis?.banido ? (
                      <span className="ml-2 text-xs font-bold uppercase text-destaque">
                        banido
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-texto-fraco">
                    {compra.perfis?.email} · {ROTULO_STATUS_COMPRA[compra.status]} ·{" "}
                    {dataCurta(compra.criado_em)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <form action={derrubarSessao.bind(null, compra.usuario_id)}>
                    <button
                      className="botao botao-secundario !px-3 !py-1.5 !text-xs"
                      type="submit"
                      title="Desconecta o aparelho em que a pessoa está agora"
                    >
                      Derrubar
                    </button>
                  </form>
                  <form
                    action={alternarBanimento.bind(
                      null,
                      compra.usuario_id,
                      !compra.perfis?.banido,
                    )}
                  >
                    <button
                      className="botao botao-secundario !px-3 !py-1.5 !text-xs"
                      type="submit"
                    >
                      {compra.perfis?.banido ? "Desbanir" : "Banir"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
