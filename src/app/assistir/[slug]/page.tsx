import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Player } from "@/components/Player";
import { liveEstaNoAr } from "@/lib/ao-vivo";
import { registrar } from "@/lib/auditoria";
import { exigirConta } from "@/lib/conta";
import { ipResumido } from "@/lib/formato";
import { buscarCompra, buscarLivePorSlug } from "@/lib/lives";
import { ipDoVisitante, navegadorDoVisitante } from "@/lib/requisicao";
import { conferirSessaoUnica } from "@/lib/sessao";

export const metadata: Metadata = { title: "Assistir" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function PaginaAssistir({ params }: Props) {
  const { slug } = await params;

  const live = await buscarLivePorSlug(slug);
  if (!live) notFound();

  const conta = await exigirConta(`/assistir/${slug}`);

  if (conta.perfil?.banido) {
    return (
      <Recado
        titulo="Conta bloqueada"
        texto="Esta conta está bloqueada. Fale com o suporte."
      />
    );
  }

  const compra = await buscarCompra(conta.usuarioId, live.id);
  if (compra?.status !== "aprovada") {
    redirect(`/live/${slug}`);
  }

  if (!(await liveEstaNoAr(live))) {
    return (
      <Recado
        titulo={live.titulo}
        texto={
          live.estado === "encerrada"
            ? "Esta transmissão foi encerrada."
            : "A transmissão ainda não começou. Assim que o canal entrar no ar, esta página libera sozinha — é só recarregar."
        }
        slug={slug}
      />
    );
  }

  const sessao = await conferirSessaoUnica(conta.usuarioId);
  if (!sessao.valida) {
    return (
      <Recado
        titulo="Sessão aberta em outro aparelho"
        texto="Sua conta está sendo usada em outro lugar. Entre de novo aqui para assumir a sessão — o outro aparelho será desconectado."
        slug={slug}
      />
    );
  }

  const ip = await ipDoVisitante();
  const navegador = await navegadorDoVisitante();

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: live.id,
    acao: "abriu_player",
    ip,
    navegador,
  });

  const nome = conta.perfil?.nome || conta.email;
  const identificacao = `${nome} · ${conta.email} · ${ipResumido(ip)}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{live.titulo}</h1>
          <p className="flex items-center gap-1.5 text-xs text-destaque">
            <span className="size-1.5 animate-pulse rounded-full bg-destaque" />
            Ao vivo
          </p>
        </div>
        <Link className="text-sm text-texto-fraco hover:text-texto" href={`/live/${slug}`}>
          Detalhes da live
        </Link>
      </div>

      <Player slug={slug} identificacao={identificacao} />
    </main>
  );
}

function Recado({
  titulo,
  texto,
  slug,
}: {
  titulo: string;
  texto: string;
  slug?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-20 text-center">
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="mt-3 text-sm text-texto-fraco">{texto}</p>
      <div className="mt-6 flex justify-center gap-3">
        {slug ? (
          <Link className="botao botao-secundario" href={`/live/${slug}`}>
            Ver a live
          </Link>
        ) : null}
        <Link className="botao" href="/">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
