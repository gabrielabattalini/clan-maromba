"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registrar } from "@/lib/auditoria";
import {
  apagarLiveInput,
  criarChaveDeAssinatura,
  criarLiveInput,
} from "@/lib/cloudflare";
import { cloudflareConfigurado } from "@/lib/config";
import { exigirAdmin } from "@/lib/conta";
import { gerarSlug } from "@/lib/formato";
import { ipDoVisitante } from "@/lib/requisicao";
import { clienteAdmin } from "@/lib/supabase/admin";
import type {
  ChaveAssinaturaGerada,
  EstadoFormulario,
  EstadoLive,
} from "@/lib/tipos";

/** "19,90" ou "19.90" ou "19" → 1990 centavos. */
function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!limpo) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

export async function criarLive(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();

  const titulo = String(dados.get("titulo") ?? "").trim();
  const descricao = String(dados.get("descricao") ?? "").trim();
  const precoTexto = String(dados.get("preco") ?? "").trim();

  // Os três campos de data são opcionais: dá para anunciar e vender uma live
  // sem saber ainda quando ela vai ser.
  const diaInicio = String(dados.get("dia_inicio") ?? "").trim() || null;
  const diaFim = String(dados.get("dia_fim") ?? "").trim() || null;
  const hora = String(dados.get("hora") ?? "").trim() || null;

  if (titulo.length < 3) return { erro: "Dê um título para a live." };

  if (diaFim && !diaInicio) {
    return { erro: "Preencha o primeiro dia antes de informar o último." };
  }
  if (diaInicio && diaFim && diaFim < diaInicio) {
    return { erro: "O último dia não pode ser antes do primeiro." };
  }

  const precoCentavos = centavosDeTexto(precoTexto);
  if (precoCentavos === null) return { erro: "Preço inválido. Exemplo: 19,90" };

  const supabase = clienteAdmin();

  // Slug único (o endereço da página da live).
  const base = gerarSlug(titulo) || "live";
  let slug = base;
  for (let tentativa = 2; tentativa <= 50; tentativa++) {
    const { data: existente } = await supabase
      .from("lives")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existente) break;
    slug = `${base}-${tentativa}`;
  }

  const { data: live, error } = await supabase
    .from("lives")
    .insert({
      slug,
      titulo,
      descricao,
      dia_inicio: diaInicio,
      dia_fim: diaFim,
      hora,
      preco_centavos: precoCentavos,
      estado: "rascunho",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !live) {
    return { erro: "Não consegui salvar a live. Tente de novo." };
  }

  // Cria o canal de transmissão na Cloudflare (URL + chave do OBS).
  if (cloudflareConfigurado) {
    try {
      const input = await criarLiveInput(titulo);
      await supabase.from("lives_privado").upsert({
        live_id: live.id,
        cf_input_uid: input.uid,
        cf_rtmps_url: input.rtmpsUrl,
        cf_stream_key: input.streamKey,
        atualizado_em: new Date().toISOString(),
      });
    } catch (erro) {
      console.error("[admin] falha ao criar live input:", erro);
      // A live fica salva mesmo assim; o painel avisa e oferece tentar de novo.
    }
  }

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: live.id,
    acao: "admin_criou_live",
    ip: await ipDoVisitante(),
    detalhes: { titulo, precoCentavos },
  });

  revalidatePath("/admin");
  redirect(`/admin/live/${live.id}`);
}

export async function mudarEstadoDaLive(liveId: string, dados: FormData): Promise<void> {
  const conta = await exigirAdmin();
  const estado = String(dados.get("estado") ?? "") as EstadoLive;

  // O painel só troca entre estes dois. "No ar" é detectado pela Cloudflare, e
  // "encerrada" é ajustado direto no banco quando o dono quiser tirar de venda.
  const permitidos: EstadoLive[] = ["rascunho", "anunciada"];
  if (!permitidos.includes(estado)) return;

  await clienteAdmin().from("lives").update({ estado }).eq("id", liveId);

  await registrar({
    usuarioId: conta.usuarioId,
    liveId,
    acao: "admin_mudou_estado_da_live",
    ip: await ipDoVisitante(),
    detalhes: { estado },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/live/${liveId}`);
  revalidatePath("/");
}

export async function criarCanalDeTransmissao(liveId: string): Promise<void> {
  const conta = await exigirAdmin();
  if (!cloudflareConfigurado) return;

  const supabase = clienteAdmin();
  const { data: live } = await supabase
    .from("lives")
    .select("titulo")
    .eq("id", liveId)
    .maybeSingle<{ titulo: string }>();

  if (!live) return;

  try {
    const input = await criarLiveInput(live.titulo);
    await supabase.from("lives_privado").upsert({
      live_id: liveId,
      cf_input_uid: input.uid,
      cf_rtmps_url: input.rtmpsUrl,
      cf_stream_key: input.streamKey,
      atualizado_em: new Date().toISOString(),
    });

    await registrar({
      usuarioId: conta.usuarioId,
      liveId,
      acao: "admin_criou_canal_transmissao",
      ip: await ipDoVisitante(),
    });
  } catch (erro) {
    console.error("[admin] falha ao criar canal:", erro);
  }

  revalidatePath(`/admin/live/${liveId}`);
}

/**
 * Cria a chave que assina os tokens de reprodução.
 *
 * A Cloudflare mostra o segredo UMA única vez. Por isso devolvemos o valor
 * para a tela do painel: o dono copia e cola na Vercel na mesma hora.
 * O segredo não é gravado no nosso banco.
 */
export async function gerarChaveDeAssinatura(): Promise<ChaveAssinaturaGerada> {
  const conta = await exigirAdmin();

  if (!cloudflareConfigurado) {
    return { erro: "Configure primeiro o Cloudflare Stream (Passo 4 da Fase 0)." };
  }

  try {
    const chave = await criarChaveDeAssinatura();

    await registrar({
      usuarioId: conta.usuarioId,
      acao: "admin_gerou_chave_de_assinatura",
      ip: await ipDoVisitante(),
      detalhes: { chaveId: chave.id },
    });

    return { id: chave.id, jwk: chave.jwk };
  } catch (erro) {
    console.error("[admin] falha ao gerar chave de assinatura:", erro);
    return {
      erro: "A Cloudflare recusou o pedido. Confira se o token tem permissão de Stream: Edit.",
    };
  }
}

/**
 * Apaga uma live de vez.
 *
 * Recusa quando existe compra paga: o registro de quem pagou tem de
 * sobreviver, mesmo que a live não aconteça mais. Para tirar de venda uma
 * live já vendida, o caminho é marcar `encerrada` no banco.
 */
export async function apagarLive(liveId: string): Promise<EstadoFormulario> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  const { data: live } = await supabase
    .from("lives")
    .select("titulo")
    .eq("id", liveId)
    .maybeSingle<{ titulo: string }>();

  if (!live) return { erro: "Live não encontrada." };

  const { count } = await supabase
    .from("compras")
    .select("id", { count: "exact", head: true })
    .eq("live_id", liveId)
    .in("status", ["aprovada", "reembolsada"]);

  const pagas = count ?? 0;
  if (pagas > 0) {
    return {
      erro:
        `Esta live tem ${pagas} compra${pagas > 1 ? "s" : ""} paga${pagas > 1 ? "s" : ""} ` +
        "e não pode ser apagada — o registro de quem pagou precisa ser guardado. " +
        "Para tirar de venda, marque o estado como \"encerrada\" no Supabase.",
    };
  }

  // Some também com o canal na Cloudflare, senão fica um input órfão lá.
  const { data: privado } = await supabase
    .from("lives_privado")
    .select("cf_input_uid")
    .eq("live_id", liveId)
    .maybeSingle<{ cf_input_uid: string | null }>();

  if (privado?.cf_input_uid && cloudflareConfigurado) {
    try {
      await apagarLiveInput(privado.cf_input_uid);
    } catch (erro) {
      console.error("[admin] falha ao apagar o canal na Cloudflare:", erro);
      // Seguimos assim mesmo: o canal órfão não atrapalha o site.
    }
  }

  const { error } = await supabase.from("lives").delete().eq("id", liveId);
  if (error) {
    console.error("[admin] falha ao apagar a live:", error.message);
    return { erro: "Não consegui apagar a live. Tente de novo." };
  }

  await registrar({
    usuarioId: conta.usuarioId,
    acao: "admin_apagou_live",
    ip: await ipDoVisitante(),
    detalhes: { liveId, titulo: live.titulo },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

export async function derrubarSessao(usuarioId: string): Promise<void> {
  const conta = await exigirAdmin();

  await clienteAdmin().from("sessoes_ativas").delete().eq("usuario_id", usuarioId);

  await registrar({
    usuarioId: conta.usuarioId,
    acao: "admin_derrubou_sessao",
    ip: await ipDoVisitante(),
    detalhes: { alvo: usuarioId },
  });

  revalidatePath("/admin");
}

export async function alternarBanimento(
  usuarioId: string,
  banir: boolean,
): Promise<void> {
  const conta = await exigirAdmin();
  const supabase = clienteAdmin();

  await supabase.from("perfis").update({ banido: banir }).eq("id", usuarioId);
  if (banir) {
    await supabase.from("sessoes_ativas").delete().eq("usuario_id", usuarioId);
  }

  await registrar({
    usuarioId: conta.usuarioId,
    acao: banir ? "admin_baniu_usuario" : "admin_desbaniu_usuario",
    ip: await ipDoVisitante(),
    detalhes: { alvo: usuarioId },
  });

  revalidatePath("/admin");
}
