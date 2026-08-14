import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FormularioAtletas, FormularioResultado } from "@/components/FormularioBolao";
import {
  categoriaAberta,
  buscarCategoria,
  listarAtletas,
  listarPalpites,
  listarResultados,
  topCinco,
} from "@/lib/bolao";
import { exigirAdmin } from "@/lib/conta";
import { janelaLegivel } from "@/lib/formato";
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

  const [atletas, palpites, resultados] = await Promise.all([
    listarAtletas([categoria.id]),
    listarPalpites([categoria.id]),
    listarResultados([categoria.id]),
  ]);

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

      <p className="mt-6 text-sm text-texto-fraco">
        Classificação pública:{" "}
        <Link className="hover:underline" href={`/bolao/${live.slug}/ranking`}>
          /bolao/{live.slug}/ranking
        </Link>
      </p>
    </main>
  );
}
