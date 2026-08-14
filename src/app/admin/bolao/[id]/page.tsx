import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ajustarFechamentoDoBolao } from "@/app/admin/acoes";
import {
  FormularioAtletas,
  FormularioFechamento,
  FormularioPremioDaCategoria,
  FormularioResultado,
  FormularioTicketDoBolao,
} from "@/components/FormularioBolao";
import {
  buscarCategoria,
  categoriaAberta,
  listarAtletas,
  listarPalpites,
  campeoes,
  conferenciaDaCategoria,
  listarResultados,
  rankingDaCategoria,
  ticketsDoBolao,
  topCinco,
  vendasPorCategoria,
} from "@/lib/bolao";
import { exigirAdmin } from "@/lib/conta";
import { dataCurta, janelaLegivel, precoEmReais } from "@/lib/formato";
import { buscarLivePorId } from "@/lib/lives";

export const metadata: Metadata = { title: "Bolão" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PaginaCategoriaAdmin({ params }: Props) {
  await exigirAdmin();
  const { id } = await params;

  const categoria = await buscarCategoria(id);
  if (!categoria) notFound();

  const live = await buscarLivePorId(categoria.live_id);
  if (!live) notFound();

  const [atletas, palpites, resultados, tickets, vendas, classificacao] =
    await Promise.all([
      listarAtletas([categoria.id]),
      listarPalpites([categoria.id]),
      listarResultados([categoria.id]),
      ticketsDoBolao(live.id),
      vendasPorCategoria(live.id),
      rankingDaCategoria(categoria.id),
    ]);

  const vencedores = campeoes(classificacao);
  const conferencia = await conferenciaDaCategoria(categoria.id);
  const suspeitos = conferencia.filter((l) => l.depoisDoResultado || l.depoisDeFechar);

  const ticket = tickets.get(categoria.id);
  const vendidos = vendas.get(categoria.id) ?? 0;

  const resultado = resultados[0] ?? null;
  const aberta = categoriaAberta(categoria);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Link
        className="text-sm text-texto-fraco hover:text-texto"
        href={`/admin/live/${live.id}`}
      >
        ← {live.titulo}
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl">{categoria.nome}</h1>
          <p className="numero mt-2 text-sm text-texto-apagado">
            Fecha {janelaLegivel(categoria.fecha_em, null).replace("A partir de ", "")}{" "}
            · {palpites.length} {palpites.length === 1 ? "palpite" : "palpites"}
          </p>
        </div>
        <span className={`selo ${aberta ? "selo-vivo" : "selo-neutro"}`}>
          {aberta ? "Aberta" : "Fechada"}
        </span>
      </header>

      {/* ---------------- Venda e prêmio ---------------- */}
      <section className="cartao mt-8 p-6">
        <h2 className="display text-xl">Ticket e prêmio</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-borda p-4">
            <p className="etiqueta">Tickets vendidos</p>
            <p className="numero display mt-1 text-3xl">{vendidos}</p>
            {ticket ? (
              <p className="numero mt-1 text-xs text-texto-apagado">
                {precoEmReais(ticket.preco_centavos)} cada ·{" "}
                {precoEmReais(vendidos * ticket.preco_centavos)} no total
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-borda p-4">
            <p className="etiqueta">Palpites feitos</p>
            <p className="numero display mt-1 text-3xl">{palpites.length}</p>
            <p className="mt-1 text-xs text-texto-apagado">
              Quem comprou o ticket e ainda não palpitou entra na diferença.
            </p>
          </div>
        </div>

        {ticket ? (
          <p className="mt-4 text-sm text-texto-fraco">
            À venda por <strong>{precoEmReais(ticket.preco_centavos)}</strong> na
            página do bolão. Para mudar o preço, tire este de venda na seção
            Ingressos da live e crie outro.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-texto-fraco">
              Esta categoria ainda não tem ticket à venda — ninguém consegue
              palpitar nela.
            </p>
            <FormularioTicketDoBolao categoriaId={categoria.id} />
          </>
        )}

        {vencedores.length > 0 ? (
          <div className="mt-5 rounded-lg border border-destaque/40 bg-destaque/5 p-4">
            <p className="etiqueta !text-destaque-fraco">Quem ganhou</p>
            <p className="mt-1 text-sm">
              <strong className="display text-xl">{vencedores.length}</strong>{" "}
              {vencedores.length === 1 ? "campeão" : "campeões empatados"} com{" "}
              <strong>{vencedores[0].pontos} pontos</strong>. O prêmio anunciado
              é dividido entre eles.
            </p>
            <ul className="mt-2 flex flex-col gap-0.5 text-sm text-texto-fraco">
              {vencedores.map((v) => (
                <li key={v.usuarioId}>★ {v.apelido}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-texto-apagado">
              Os nomes completos e os e-mails estão na lista de compradores da
              live, para você conseguir pagar.
            </p>
          </div>
        ) : null}

        <div className="mt-6 border-t border-borda pt-5">
          <h3 className="text-sm font-semibold">Prêmio desta categoria</h3>
          <FormularioPremioDaCategoria
            categoriaId={categoria.id}
            premioAtual={categoria.premio}
          />
        </div>
      </section>

      {/* ---------------- Fechamento ---------------- */}
      <section className="cartao mt-8 p-6">
        <h2 className="display text-xl">Quando fecha</h2>
        <p className="mt-1 text-sm leading-relaxed text-texto-fraco">
          O horário marcado fecha sozinho, mesmo que você esteja no meio da
          transmissão. Se o evento atrasar, adie; se começar antes, feche agora.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <form action={ajustarFechamentoDoBolao.bind(null, categoria.id, "agora")}>
            <button className="botao" type="submit" disabled={!aberta}>
              Fechar agora
            </button>
          </form>
          {[15, 30, 60].map((minutos) => (
            <form
              key={minutos}
              action={ajustarFechamentoDoBolao.bind(null, categoria.id, minutos)}
            >
              <button className="botao botao-secundario" type="submit">
                +{minutos} min
              </button>
            </form>
          ))}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-texto-apagado">
          Adiar uma categoria já fechada reabre os palpites — conta a partir de
          agora. Cuidado para não reabrir depois que o resultado começou a
          circular.
        </p>

        <div className="mt-5 border-t border-borda pt-5">
          <FormularioFechamento
            categoriaId={categoria.id}
            fechaEm={categoria.fecha_em}
          />
        </div>
      </section>

      {/* ---------------- Atletas ---------------- */}
      <section className="cartao mt-8 p-6">
        <h2 className="display text-xl">Lista de atletas</h2>
        <p className="mt-1 text-sm text-texto-fraco">
          É a lista que aparece para quem vai palpitar. A organização costuma
          divulgar na semana do evento.
        </p>
        <FormularioAtletas
          categoriaId={categoria.id}
          listaAtual={atletas.map((a) => a.nome).join("\n")}
        />
      </section>

      {/* ---------------- Resultado ---------------- */}
      <section className="cartao mt-6 p-6">
        <h2 className="display text-xl">Resultado oficial</h2>

        {atletas.length < 5 ? (
          <p className="aviso aviso-atencao mt-3">
            Cadastre a lista de atletas primeiro.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-texto-fraco">
              {resultado
                ? "Já publicado. Mudar aqui recalcula o ranking na hora."
                : "Preencha depois que a organização anunciar o pódio."}
            </p>
            <FormularioResultado
              categoriaId={categoria.id}
              atletas={atletas}
              resultadoAtual={resultado ? topCinco(resultado) : []}
            />
          </>
        )}
      </section>

      {/* ---------------- Conferência ---------------- */}
      {conferencia.length > 0 ? (
        <section className="cartao mt-6 p-6">
          <h2 className="display text-xl">Conferência</h2>
          <p className="mt-1 text-sm leading-relaxed text-texto-fraco">
            Todos os palpites desta categoria, com a hora da última alteração.
            Serve para você conferir antes de pagar: se esquecer de fechar e
            alguém mexer no palpite depois do resultado, aparece marcado aqui.
          </p>

          {suspeitos.length > 0 ? (
            <p className="aviso aviso-erro mt-4">
              <strong>{suspeitos.length}</strong>{" "}
              {suspeitos.length === 1 ? "palpite mexido" : "palpites mexidos"} depois
              da hora. Estão marcados na lista — devolva o dinheiro deles antes de
              apurar.
            </p>
          ) : (
            <p className="aviso aviso-ok mt-4">
              Nenhum palpite foi mexido depois da hora. O bolão está limpo.
            </p>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-lg border-collapse text-sm">
              <thead>
                <tr className="border-b border-borda text-left">
                  <th className="py-2 pr-3 font-semibold">Quem</th>
                  <th className="py-2 pr-3 text-right font-semibold">Pts</th>
                  <th className="py-2 pr-3 font-semibold">Palpitou</th>
                  <th className="py-2 font-semibold">Última alteração</th>
                </tr>
              </thead>
              <tbody>
                {conferencia.map((linha) => {
                  const foraDaHora = linha.depoisDoResultado || linha.depoisDeFechar;

                  return (
                    <tr
                      key={linha.usuarioId}
                      className={`border-b border-borda/60 ${
                        foraDaHora ? "text-destaque" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <span className="font-medium">{linha.nome}</span>
                        <span className="block text-xs text-texto-apagado">
                          {linha.email}
                        </span>
                      </td>
                      <td className="numero py-2 pr-3 text-right">
                        {linha.pontos}
                        <span className="block text-xs text-texto-apagado">
                          {linha.exatos} ex.
                        </span>
                      </td>
                      <td className="numero py-2 pr-3 text-xs">
                        {dataCurta(linha.palpitouEm)}
                      </td>
                      <td className="numero py-2 text-xs">
                        {dataCurta(linha.alteradoEm)}
                        {linha.depoisDoResultado ? (
                          <span className="block text-xs font-bold uppercase">
                            depois do resultado
                          </span>
                        ) : linha.depoisDeFechar ? (
                          <span className="block text-xs font-bold uppercase">
                            depois de fechar
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-sm text-texto-fraco">
        Classificação pública:{" "}
        <Link className="hover:underline" href={`/bolao/${live.slug}/ranking`}>
          /bolao/{live.slug}/ranking
        </Link>
      </p>
    </main>
  );
}
