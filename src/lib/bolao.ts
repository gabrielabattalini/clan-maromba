import { acertosExatos, apelidoPublico, pontuar, topCinco } from "@/lib/bolao-pontos";
import { supabaseServidorConfigurado } from "@/lib/config";
import { clienteAdmin } from "@/lib/supabase/admin";
import type {
  BolaoAtleta,
  BolaoCategoria,
  BolaoPalpite,
  BolaoResultado,
  LinhaDoRanking,
} from "@/lib/tipos";

// A conta de pontos mora em `bolao-pontos.ts`, sem nenhum acesso a banco:
// é ela que decide quem leva o prêmio, então precisa rodar nos testes.
export * from "@/lib/bolao-pontos";

// ------------------------------------------------------------
// Leitura do banco
// ------------------------------------------------------------

export async function listarCategorias(liveId: string): Promise<BolaoCategoria[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data } = await clienteAdmin()
    .from("bolao_categorias")
    .select("*")
    .eq("live_id", liveId)
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true })
    .returns<BolaoCategoria[]>();

  return data ?? [];
}

export async function buscarCategoria(id: string): Promise<BolaoCategoria | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("bolao_categorias")
    .select("*")
    .eq("id", id)
    .maybeSingle<BolaoCategoria>();

  return data ?? null;
}

export async function listarAtletas(categoriaIds: string[]): Promise<BolaoAtleta[]> {
  if (!supabaseServidorConfigurado || categoriaIds.length === 0) return [];

  const { data } = await clienteAdmin()
    .from("bolao_atletas")
    .select("*")
    .in("categoria_id", categoriaIds)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true })
    .returns<BolaoAtleta[]>();

  return data ?? [];
}

export async function listarPalpites(categoriaIds: string[]): Promise<BolaoPalpite[]> {
  if (!supabaseServidorConfigurado || categoriaIds.length === 0) return [];

  const { data } = await clienteAdmin()
    .from("bolao_palpites")
    .select("*")
    .in("categoria_id", categoriaIds)
    .returns<BolaoPalpite[]>();

  return data ?? [];
}

export async function listarResultados(
  categoriaIds: string[],
): Promise<BolaoResultado[]> {
  if (!supabaseServidorConfigurado || categoriaIds.length === 0) return [];

  const { data } = await clienteAdmin()
    .from("bolao_resultados")
    .select("*")
    .in("categoria_id", categoriaIds)
    .returns<BolaoResultado[]>();

  return data ?? [];
}

/** Os palpites de uma pessoa, por categoria. */
export async function meusPalpites(
  usuarioId: string,
  categoriaIds: string[],
): Promise<Map<string, BolaoPalpite>> {
  if (!supabaseServidorConfigurado || categoriaIds.length === 0) return new Map();

  const { data } = await clienteAdmin()
    .from("bolao_palpites")
    .select("*")
    .eq("usuario_id", usuarioId)
    .in("categoria_id", categoriaIds)
    .returns<BolaoPalpite[]>();

  return new Map((data ?? []).map((p) => [p.categoria_id, p]));
}

// ------------------------------------------------------------
// Ranking
// ------------------------------------------------------------

/**
 * Soma os pontos de todas as categorias que já têm resultado publicado.
 *
 * Empate desfaz em três degraus, todos publicados no regulamento: pontos,
 * depois acertos exatos, depois quem palpitou primeiro. Chegar até o último
 * critério é raríssimo, mas ter um evita o pior cenário — dois campeões e
 * um prêmio só.
 */
export async function montarRanking(liveId: string): Promise<LinhaDoRanking[]> {
  const categorias = await listarCategorias(liveId);
  const ids = categorias.map((c) => c.id);
  if (ids.length === 0) return [];

  const [palpites, resultados] = await Promise.all([
    listarPalpites(ids),
    listarResultados(ids),
  ]);

  const oficialPorCategoria = new Map(
    resultados.map((r) => [r.categoria_id, topCinco(r)]),
  );
  if (oficialPorCategoria.size === 0) return [];

  const porUsuario = new Map<
    string,
    { pontos: number; exatos: number; desde: string }
  >();

  for (const palpite of palpites) {
    const oficial = oficialPorCategoria.get(palpite.categoria_id);
    if (!oficial) continue; // categoria ainda sem resultado

    const meu = topCinco(palpite);
    const atual = porUsuario.get(palpite.usuario_id) ?? {
      pontos: 0,
      exatos: 0,
      desde: palpite.criado_em,
    };

    porUsuario.set(palpite.usuario_id, {
      pontos: atual.pontos + pontuar(meu, oficial),
      exatos: atual.exatos + acertosExatos(meu, oficial),
      // Vale o palpite mais antigo da pessoa, em qualquer categoria.
      desde: palpite.criado_em < atual.desde ? palpite.criado_em : atual.desde,
    });
  }

  if (porUsuario.size === 0) return [];

  const { data: perfis } = await clienteAdmin()
    .from("perfis")
    .select("id, nome, email")
    .in("id", [...porUsuario.keys()])
    .returns<{ id: string; nome: string; email: string }[]>();

  const nomes = new Map((perfis ?? []).map((p) => [p.id, p]));

  return [...porUsuario.entries()]
    .map(([usuarioId, dados]) => {
      const perfil = nomes.get(usuarioId);
      return {
        usuarioId,
        apelido: apelidoPublico(perfil?.nome ?? "", perfil?.email ?? ""),
        ...dados,
      };
    })
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        b.exatos - a.exatos ||
        a.desde.localeCompare(b.desde),
    );
}
