import { supabaseServidorConfigurado } from "@/lib/config";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { MensagemChat, MensagemNaTela } from "@/lib/tipos";

/** Quantas mensagens antigas a tela carrega ao abrir. */
export const HISTORICO = 60;

/**
 * As últimas mensagens da live, já com o nome de quem escreveu.
 *
 * O navegador recebe daqui só o que vai aparecer: apelido curto, texto e
 * hora. Nada de e-mail — o chat é entre estranhos que compraram o mesmo
 * ingresso, não entre amigos.
 */
export async function ultimasMensagens(liveId: string): Promise<MensagemNaTela[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data } = await clienteAdmin()
    .from("mensagens_chat")
    .select("id, usuario_id, apelido, do_dono, texto, criado_em")
    .eq("live_id", liveId)
    .eq("apagada", false)
    .order("id", { ascending: false })
    .limit(HISTORICO)
    .returns<
      Pick<
        MensagemChat,
        "id" | "usuario_id" | "apelido" | "do_dono" | "texto" | "criado_em"
      >[]
    >();

  return (data ?? []).reverse().map((m) => ({
    id: m.id,
    usuarioId: m.usuario_id,
    apelido: m.apelido,
    doDono: m.do_dono,
    texto: m.texto,
    criadoEm: m.criado_em,
  }));
}

/** Quando a pessoa mandou a última mensagem nesta live. */
export async function ultimaMensagemDe(
  usuarioId: string,
  liveId: string,
): Promise<string | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("mensagens_chat")
    .select("criado_em")
    .eq("live_id", liveId)
    .eq("usuario_id", usuarioId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<{ criado_em: string }>();

  return data?.criado_em ?? null;
}

/** Até quando esta pessoa está silenciada nesta live (ou `null`). */
export async function silenciadoAte(
  usuarioId: string,
  liveId: string,
): Promise<Date | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("chat_silenciados")
    .select("ate")
    .eq("live_id", liveId)
    .eq("usuario_id", usuarioId)
    .maybeSingle<{ ate: string }>();

  if (!data) return null;

  const ate = new Date(data.ate);
  return ate > new Date() ? ate : null;
}
