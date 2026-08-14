import { clienteAdmin } from "@/lib/supabase/admin";
import { supabaseServidorConfigurado } from "@/lib/config";

export type EventoAuditoria = {
  usuarioId?: string | null;
  liveId?: string | null;
  acao: string;
  ip?: string | null;
  navegador?: string | null;
  detalhes?: Record<string, unknown>;
};

/**
 * Grava uma linha no diário de auditoria.
 *
 * Nunca lança erro: registro de log não pode derrubar uma compra ou um
 * login. Se falhar, avisa no console do servidor e segue a vida.
 */
export async function registrar(evento: EventoAuditoria): Promise<void> {
  if (!supabaseServidorConfigurado) return;

  try {
    await clienteAdmin().from("logs_auditoria").insert({
      usuario_id: evento.usuarioId ?? null,
      live_id: evento.liveId ?? null,
      acao: evento.acao,
      ip: evento.ip ?? null,
      navegador: evento.navegador ?? null,
      detalhes: evento.detalhes ?? null,
    });
  } catch (erro) {
    console.error("[auditoria] não foi possível gravar o log:", erro);
  }
}
