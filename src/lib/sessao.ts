import { cookies } from "next/headers";

import { clienteAdmin } from "@/lib/supabase/admin";
import { supabaseServidorConfigurado } from "@/lib/config";

/** Nome do cookie que guarda o identificador do aparelho atual. */
export const COOKIE_SESSAO = "cm_sessao";

const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;

/**
 * Sessão única: cada conta tem UMA linha em `sessoes_ativas`.
 *
 * Ao entrar, geramos um identificador novo, gravamos no banco (substituindo
 * o anterior) e guardamos a mesma informação num cookie. A partir daí,
 * o aparelho antigo tem um cookie que não bate mais com o banco — e é
 * desconectado no primeiro heartbeat, em poucos segundos.
 */
export async function abrirSessaoUnica(
  usuarioId: string,
  ip: string | null,
  navegador: string | null,
): Promise<string> {
  const sessaoId = crypto.randomUUID();

  if (supabaseServidorConfigurado) {
    await clienteAdmin().from("sessoes_ativas").upsert(
      {
        usuario_id: usuarioId,
        sessao_id: sessaoId,
        ip,
        navegador,
        visto_em: new Date().toISOString(),
      },
      { onConflict: "usuario_id" },
    );
  }

  const jar = await cookies();
  jar.set(COOKIE_SESSAO, sessaoId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UM_ANO_EM_SEGUNDOS,
  });

  return sessaoId;
}

/** Apaga a marca do aparelho atual (usado ao sair). */
export async function fecharSessaoUnica(usuarioId: string | null): Promise<void> {
  if (usuarioId && supabaseServidorConfigurado) {
    await clienteAdmin().from("sessoes_ativas").delete().eq("usuario_id", usuarioId);
  }

  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
}

export async function sessaoIdDoAparelho(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_SESSAO)?.value ?? null;
}

export type ConfereSessao = {
  valida: boolean;
  motivo: "ok" | "sem_cookie" | "outro_aparelho" | "sem_registro";
};

/**
 * Diz se o aparelho que está pedindo ainda é o aparelho autorizado.
 * Também atualiza o "visto por último" para o admin acompanhar.
 */
export async function conferirSessaoUnica(usuarioId: string): Promise<ConfereSessao> {
  if (!supabaseServidorConfigurado) return { valida: true, motivo: "ok" };

  const sessaoId = await sessaoIdDoAparelho();
  if (!sessaoId) return { valida: false, motivo: "sem_cookie" };

  const supabase = clienteAdmin();
  const { data } = await supabase
    .from("sessoes_ativas")
    .select("sessao_id")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (!data) return { valida: false, motivo: "sem_registro" };
  if (data.sessao_id !== sessaoId) return { valida: false, motivo: "outro_aparelho" };

  await supabase
    .from("sessoes_ativas")
    .update({ visto_em: new Date().toISOString() })
    .eq("usuario_id", usuarioId);

  return { valida: true, motivo: "ok" };
}
