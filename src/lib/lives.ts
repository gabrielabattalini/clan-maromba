import { supabaseServidorConfigurado } from "@/lib/config";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { BlocoProgramacao, Compra, Live, LivePrivado } from "@/lib/tipos";

/** Lives visíveis ao público: tudo que já foi anunciado. */
export async function listarLivesPublicas(): Promise<Live[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data, error } = await clienteAdmin()
    .from("lives")
    .select("*")
    .neq("estado", "rascunho")
    .order("dia_inicio", { ascending: true, nullsFirst: false })
    .returns<Live[]>();

  if (error) {
    console.error("[lives] falha ao listar:", error.message);
    return [];
  }
  return data ?? [];
}

/** Todas as lives, inclusive rascunhos — apenas para o painel do dono. */
export async function listarTodasAsLives(): Promise<Live[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data } = await clienteAdmin()
    .from("lives")
    .select("*")
    .order("criado_em", { ascending: false })
    .returns<Live[]>();

  return data ?? [];
}

export async function buscarLivePorSlug(slug: string): Promise<Live | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("lives")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Live>();

  return data ?? null;
}

export async function buscarLivePorId(id: string): Promise<Live | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("lives")
    .select("*")
    .eq("id", id)
    .maybeSingle<Live>();

  return data ?? null;
}

/** Dados do OBS (URL + chave). Só o painel do dono pode chamar isto. */
export async function buscarDadosPrivados(liveId: string): Promise<LivePrivado | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("lives_privado")
    .select("*")
    .eq("live_id", liveId)
    .maybeSingle<LivePrivado>();

  return data ?? null;
}

export async function buscarCompra(
  usuarioId: string,
  liveId: string,
): Promise<Compra | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("compras")
    .select("*")
    .eq("usuario_id", usuarioId)
    .eq("live_id", liveId)
    .maybeSingle<Compra>();

  return data ?? null;
}

/** Atalho: a pessoa já pagou e pode assistir? */
export async function temAcesso(usuarioId: string, liveId: string): Promise<boolean> {
  const compra = await buscarCompra(usuarioId, liveId);
  return compra?.status === "aprovada";
}

/** Compras aprovadas do usuário, com a live junto — para "Minhas lives". */
export async function listarMinhasLives(
  usuarioId: string,
): Promise<{ compra: Compra; live: Live }[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data } = await clienteAdmin()
    .from("compras")
    .select("*, lives(*)")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .returns<(Compra & { lives: Live | null })[]>();

  return (data ?? [])
    .filter((linha) => linha.lives !== null)
    .map(({ lives, ...compra }) => ({ compra, live: lives as Live }));
}

/**
 * Os blocos da programação de uma live.
 *
 * Vive separado dos ingressos porque horário de evento é informação: o dono
 * pode vender um ingresso único e ainda assim anunciar os quatro dias.
 */
export async function listarProgramacao(
  liveId: string,
): Promise<BlocoProgramacao[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data } = await clienteAdmin()
    .from("blocos_programacao")
    .select("*")
    .eq("live_id", liveId)
    .order("inicia_em", { ascending: true })
    .returns<BlocoProgramacao[]>();

  return data ?? [];
}
