import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { assinarTokenReproducao, enderecoDoManifesto } from "@/lib/cloudflare";
import { assinaturaConfigurada } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { podeTentar } from "@/lib/limite-taxa";
import { buscarCompra, buscarDadosPrivados, buscarLivePorSlug } from "@/lib/lives";
import { ipDaRequisicao } from "@/lib/requisicao";
import { conferirSessaoUnica } from "@/lib/sessao";

export const dynamic = "force-dynamic";

const DURACAO_SEGUNDOS = 300; // 5 minutos

/**
 * Entrega o token curto que destrava o vídeo.
 *
 * Só passa quem cumpre TODAS as condições: está logado, não está banido,
 * é o aparelho autorizado no momento, e pagou por esta live específica.
 */
export async function POST(requisicao: Request) {
  const ip = ipDaRequisicao(requisicao);

  let slug = "";
  try {
    const corpo = (await requisicao.json()) as { slug?: string };
    slug = String(corpo.slug ?? "");
  } catch {
    return NextResponse.json({ erro: "requisição inválida" }, { status: 400 });
  }

  const conta = await contaAtual();
  if (!conta) {
    return NextResponse.json({ erro: "não autenticado", motivo: "sem_login" }, { status: 401 });
  }

  if (conta.perfil?.banido) {
    return NextResponse.json({ erro: "conta bloqueada", motivo: "banido" }, { status: 403 });
  }

  // No máximo 40 tokens a cada 5 minutos por conta (o player pede 1 a cada ~4).
  const liberado = await podeTentar(`token:${conta.usuarioId}`, 40, 300);
  if (!liberado) {
    return NextResponse.json(
      { erro: "muitos pedidos", motivo: "excesso" },
      { status: 429 },
    );
  }

  const sessao = await conferirSessaoUnica(conta.usuarioId);
  if (!sessao.valida) {
    await registrar({
      usuarioId: conta.usuarioId,
      acao: "token_negado_sessao",
      ip,
      detalhes: { motivo: sessao.motivo },
    });
    return NextResponse.json(
      { erro: "sessão aberta em outro aparelho", motivo: "outro_aparelho" },
      { status: 409 },
    );
  }

  const live = await buscarLivePorSlug(slug);
  if (!live) {
    return NextResponse.json({ erro: "live não encontrada" }, { status: 404 });
  }

  if (live.estado !== "no_ar") {
    return NextResponse.json(
      { erro: "a live não está no ar", motivo: "fora_do_ar" },
      { status: 409 },
    );
  }

  const compra = await buscarCompra(conta.usuarioId, live.id);
  if (compra?.status !== "aprovada") {
    await registrar({
      usuarioId: conta.usuarioId,
      liveId: live.id,
      acao: "token_negado_sem_compra",
      ip,
    });
    return NextResponse.json(
      { erro: "você não comprou esta live", motivo: "sem_compra" },
      { status: 403 },
    );
  }

  const privado = await buscarDadosPrivados(live.id);
  if (!privado?.cf_input_uid) {
    return NextResponse.json(
      { erro: "transmissão ainda não preparada", motivo: "sem_canal" },
      { status: 503 },
    );
  }

  if (!assinaturaConfigurada) {
    return NextResponse.json(
      { erro: "proteção do vídeo não configurada", motivo: "sem_assinatura" },
      { status: 503 },
    );
  }

  try {
    const token = await assinarTokenReproducao(privado.cf_input_uid, DURACAO_SEGUNDOS);

    await registrar({
      usuarioId: conta.usuarioId,
      liveId: live.id,
      acao: "token_emitido",
      ip,
      navegador: requisicao.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        url: enderecoDoManifesto(token),
        validoPorSegundos: DURACAO_SEGUNDOS,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (erro) {
    console.error("[token] falha ao assinar:", erro);
    return NextResponse.json({ erro: "falha ao gerar o token" }, { status: 500 });
  }
}
