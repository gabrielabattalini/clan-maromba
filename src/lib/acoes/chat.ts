"use server";

import { apelidoPublico } from "@/lib/bolao-pontos";
import { registrar } from "@/lib/auditoria";
import { avaliarMensagem, segundosDeEspera } from "@/lib/chat-regras";
import { silenciadoAte, ultimaMensagemDe } from "@/lib/chat";
import { supabaseServidorConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { temAcessoAgora } from "@/lib/ingressos";
import { podeTentar } from "@/lib/limite-taxa";
import { buscarLivePorSlug } from "@/lib/lives";
import { ipDoVisitante } from "@/lib/requisicao";
import { clienteAdmin } from "@/lib/supabase/admin";

export type RespostaChat = { erro?: string } | null;

/**
 * Publica uma mensagem no chat da live.
 *
 * A mensagem aparece para os outros pelo Realtime do Supabase, não por esta
 * resposta: aqui a gente só guarda. Por isso todas as travas vivem deste
 * lado — o navegador nunca escreve direto na tabela.
 */
export async function enviarMensagem(
  slug: string,
  texto: string,
): Promise<RespostaChat> {
  const live = await buscarLivePorSlug(slug);
  if (!live) return { erro: "Live não encontrada." };

  const conta = await contaAtual();
  if (!conta) return { erro: "Entre na sua conta para conversar." };

  if (!supabaseServidorConfigurado) return { erro: "Chat indisponível agora." };
  if (conta.perfil?.banido) return { erro: "Esta conta está bloqueada." };
  if (!live.chat_ligado) return { erro: "O chat está desligado." };

  const ehAdmin = Boolean(conta.perfil?.admin);

  // Quem conversa é quem está assistindo: mesma regra do player.
  if (!ehAdmin && !(await temAcessoAgora(conta.usuarioId, live.id))) {
    return { erro: "Só quem está assistindo pode escrever." };
  }

  const castigo = await silenciadoAte(conta.usuarioId, live.id);
  if (castigo) {
    const minutos = Math.max(1, Math.ceil((castigo.getTime() - Date.now()) / 60000));
    return { erro: `Você está silenciado por mais ${minutos} min.` };
  }

  const avaliacao = avaliarMensagem(texto, ehAdmin);
  if (!avaliacao.ok) return { erro: avaliacao.motivo };

  if (!ehAdmin) {
    const espera = segundosDeEspera(
      await ultimaMensagemDe(conta.usuarioId, live.id),
      live.chat_modo_lento,
    );
    if (espera > 0) return { erro: `Espere ${espera}s para mandar de novo.` };

    // Trava por IP também: o modo lento é por conta, e uma conta por
    // aparelho é justamente o que um espertinho tentaria contornar.
    const ip = await ipDoVisitante();
    if (!(await podeTentar(`chat:${ip}`, 30, 60))) {
      return { erro: "Muitas mensagens. Espere um pouco." };
    }
  }

  const { error } = await clienteAdmin().from("mensagens_chat").insert({
    live_id: live.id,
    usuario_id: conta.usuarioId,
    apelido: apelidoPublico(conta.perfil?.nome ?? "", conta.email),
    do_dono: ehAdmin,
    texto: avaliacao.texto,
  });

  if (error) {
    console.error("[chat] falha ao guardar mensagem:", error.message);
    return { erro: "Não consegui enviar. Tente de novo." };
  }

  return null;
}

/** Tira a mensagem da tela de todo mundo. O registro fica no banco. */
export async function apagarMensagem(
  mensagemId: number,
): Promise<RespostaChat> {
  const conta = await contaAtual();
  if (!conta?.perfil?.admin) return { erro: "Só o dono pode apagar." };

  const { data } = await clienteAdmin()
    .from("mensagens_chat")
    .update({ apagada: true })
    .eq("id", mensagemId)
    .select("live_id, usuario_id")
    .maybeSingle<{ live_id: string; usuario_id: string }>();

  if (data) {
    await registrar({
      usuarioId: conta.usuarioId,
      liveId: data.live_id,
      acao: "admin_apagou_mensagem",
      ip: await ipDoVisitante(),
      detalhes: { mensagem: mensagemId, autor: data.usuario_id },
    });
  }

  return null;
}

/**
 * Cala alguém por um tempo, nesta live.
 *
 * Existe porque banir quem pagou ingresso é desproporcional para quem só
 * está empolgado demais — e devolver o dinheiro depois dá muito mais
 * trabalho que dez minutos de silêncio.
 */
export async function silenciar(
  liveId: string,
  usuarioId: string,
  minutos: number,
): Promise<RespostaChat> {
  const conta = await contaAtual();
  if (!conta?.perfil?.admin) return { erro: "Só o dono pode silenciar." };

  const ate = new Date(Date.now() + minutos * 60 * 1000).toISOString();

  await clienteAdmin()
    .from("chat_silenciados")
    .upsert({ live_id: liveId, usuario_id: usuarioId, ate }, { onConflict: "live_id,usuario_id" });

  await registrar({
    usuarioId: conta.usuarioId,
    liveId,
    acao: "admin_silenciou_no_chat",
    ip: await ipDoVisitante(),
    detalhes: { alvo: usuarioId, minutos },
  });

  return null;
}
