import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { listarCategorias, rankingDaCategoria } from "@/lib/bolao";
import { contaAtual } from "@/lib/conta";
import { buscarLivePorSlug } from "@/lib/lives";
import type { LinhaDoRanking } from "@/lib/tipos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const live = await buscarLivePorSlug(slug);
  if (!live || live.estado === "rascunho") return { title: "Classificação" };
  return { title: `Classificação · ${live.titulo}` };
}

export default async function PaginaDoRanking({ params }: Props) {
  const { slug } = await params;

  const live = await buscarLivePorSlug(slug);
  if (!live) notFound();

  const conta = await contaAtual();
  if (live.estado === "rascunho" && !conta?.perfil?.admin) notFound();

  const categorias = await listarCategorias(live.id);
  if (categorias.length === 0) notFound();

  // Uma classificação por categoria: cada uma é um bolão à parte, com ticket
  // e prêmio próprios. Somar tudo faria quem comprou os três disputar contra
  // quem comprou um.
  const porCategoria = await Promise.all(
    categorias.map(async (categoria) => ({
      categoria,
      linhas: await rankingDaCategoria(categoria.id),
    })),
  );

  const apuradas = porCategoria.filter((c) => c.linhas.length > 0);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
      <Link
        className="text-sm text-texto-apagado transition-colors hover:text-texto"
        href={`/bolao/${live.slug}`}
      >
        ← Bolão
      </Link>

      <h1 className="display mt-5 text-[clamp(2.25rem,7vw,3.75rem)]">Classificação</h1>
      <p className="numero mt-3 text-sm text-texto-fraco">
        {apuradas.length} de {categorias.length}{" "}
        {categorias.length === 1 ? "categoria apurada" : "categorias apuradas"}
      </p>

      {apuradas.length === 0 ? (
        <p className="aviso aviso-atencao mt-8">
          A classificação aparece assim que a primeira categoria for apurada.
        </p>
      ) : (
        apuradas.map(({ categoria, linhas }) => (
          <section key={categoria.id} className="mt-10">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-2xl">{categoria.nome}</h2>
              {categoria.premio ? (
                <span className="text-xs text-texto-apagado">{categoria.premio}</span>
              ) : null}
            </div>

            <ol className="flex flex-col gap-2">
              {linhas.map((linha, indice) => (
                <Linha
                  key={linha.usuarioId}
                  linha={linha}
                  indice={indice}
                  souEu={conta?.usuarioId === linha.usuarioId}
                />
              ))}
            </ol>
          </section>
        ))
      )}

      <p className="mt-8 text-xs leading-relaxed text-texto-apagado">
        Cada categoria tem a sua classificação e o seu prêmio. Empate desfaz
        por acertos de posição exata e, depois, por quem palpitou primeiro. Os
        nomes aparecem abreviados de propósito — esta página é pública.
      </p>
    </main>
  );
}

function Linha({
  linha,
  indice,
  souEu,
}: {
  linha: LinhaDoRanking;
  indice: number;
  souEu: boolean;
}) {
  return (
    <li
      className={`cartao flex items-center gap-4 px-4 py-3 ${
        souEu ? "border-destaque/60" : ""
      }`}
    >
      <span
        className={`numero display w-8 shrink-0 text-center text-xl ${
          indice < 3 ? "text-destaque" : "text-texto-apagado"
        }`}
      >
        {indice + 1}
      </span>

      <span className="min-w-0 flex-1 truncate font-medium">
        {linha.apelido}
        {souEu ? (
          <span className="ml-2 text-xs font-bold uppercase text-destaque">você</span>
        ) : null}
      </span>

      <span className="shrink-0 text-right">
        <span className="numero display text-lg">{linha.pontos}</span>
        <span className="ml-1 text-xs text-texto-apagado">pts</span>
        <span className="numero block text-xs text-texto-apagado">
          {linha.exatos} {linha.exatos === 1 ? "exato" : "exatos"}
        </span>
      </span>
    </li>
  );
}
