import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Chat } from "@/components/Chat";
import { Player } from "@/components/Player";
import { liveEstaNoAr } from "@/lib/ao-vivo";
import { registrar } from "@/lib/auditoria";
import { ultimasMensagens } from "@/lib/chat";
import { exigirConta } from "@/lib/conta";
import { ipResumido } from "@/lib/formato";
import { comprouAlgumaCoisa, temAcessoAgora } from "@/lib/ingressos";
import { buscarLivePorSlug } from "@/lib/lives";
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

  if (!(await temAcessoAgora(conta.usuarioId, live.id))) {
    // Comprou, mas de outro dia: merece explicação, não um chute para a
    // página de venda como se nunca tivesse pagado.
    if (await comprouAlgumaCoisa(conta.usuarioId, live.id)) {
      return (
        <Recado
          titulo="Fora da sua janela"
          texto="Seu ingresso não cobre este momento da transmissão. Veja na página da live quais dias você comprou — dá para comprar os outros."
          slug={slug}
        />
      );
    }
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
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="selo selo-vivo">
            <span className="ponto-vivo" aria-hidden />
            Ao vivo
          </span>
          <h1 className="display mt-2 truncate text-2xl">{live.titulo}</h1>
        </div>
        <Link
          className="text-sm text-texto-apagado transition-colors hover:text-texto"
          href={`/live/${slug}`}
        >
          Detalhes da live
        </Link>
      </div>

      {/* O chat fica ao lado do vídeo no computador e embaixo no celular.
          Embaixo, e não sobre o vídeo: numa live de fisiculturismo o que
          importa é ver o palco, e chat por cima come a imagem. */}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Player slug={slug} identificacao={identificacao} />

        <Chat
          slug={slug}
          liveId={live.id}
          usuarioId={conta.usuarioId}
          souAdmin={Boolean(conta.perfil?.admin)}
          ligado={live.chat_ligado}
          modoLento={live.chat_modo_lento}
          iniciais={await ultimasMensagens(live.id)}
        />
      </div>
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
      <h1 className="display text-3xl">{titulo}</h1>
      <p className="mt-4 text-sm leading-relaxed text-texto-fraco">{texto}</p>
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
