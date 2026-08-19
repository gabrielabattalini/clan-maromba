import { supabaseServidorConfigurado } from "@/lib/config";
import { clienteAdmin } from "@/lib/supabase/admin";
import type {
  BlocoProgramacao,
  Compra,
  Live,
  LivePrivado,
  MinhaCompra,
} from "@/lib/tipos";

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

/**
 * Compras do usuário, com a live e o ingresso junto — alimenta "Meus acessos".
 *
 * O nome do ingresso vem junto porque a mesma live pode aparecer várias vezes
 * na lista (cada ticket de bolão é uma compra), e `so_bolao` porque quem
 * comprou só o bolão NÃO tem acesso à transmissão: sem essa coluna a home
 * marcaria a live como "você tem acesso" para quem só palpita.
 */
export async function listarMinhasLives(
  usuarioId: string,
): Promise<MinhaCompra[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data } = await clienteAdmin()
    .from("compras")
    .select("*, lives(*), ingressos(nome, so_bolao)")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .returns<
      (Compra & {
        lives: Live | null;
        ingressos: { nome: string; so_bolao: boolean } | null;
      })[]
    >();

  return (data ?? [])
    .filter((linha) => linha.lives !== null)
    .map(({ lives, ingressos, ...compra }) => ({
      compra,
      live: lives as Live,
      ingresso: ingressos,
    }));
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
