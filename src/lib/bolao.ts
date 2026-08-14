import { acertosExatos, apelidoPublico, pontuar, topCinco } from "@/lib/bolao-pontos";
import { supabaseServidorConfigurado } from "@/lib/config";
import { listarIngressos } from "@/lib/ingressos";
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

/**
 * Em quais categorias esta pessoa pode palpitar.
 *
 * São duas condições, e as duas foram decisão do dono:
 *   1. ter ingresso da transmissão — o bolão é vinculado à live;
 *   2. ter o ticket daquela categoria — um ticket vale um bolão, quem quer
 *      as três compra três.
 *
 * O dono passa por cima das duas para conseguir testar antes de vender.
 */
export async function categoriasLiberadas(
  usuarioId: string,
  liveId: string,
  ehAdmin = false,
): Promise<Set<string>> {
  if (!supabaseServidorConfigurado) return new Set();

  const [ingressos, { data: compras }] = await Promise.all([
    listarIngressos(liveId, true),
    clienteAdmin()
      .from("compras")
      .select("ingresso_id")
      .eq("live_id", liveId)
      .eq("usuario_id", usuarioId)
      .eq("status", "aprovada")
      .returns<{ ingresso_id: string | null }[]>(),
  ]);

  if (ehAdmin) {
    return new Set(
      ingressos
        .filter((i) => i.categoria_bolao_id)
        .map((i) => i.categoria_bolao_id as string),
    );
  }

  const meus = new Set((compras ?? []).map((c) => c.ingresso_id));
  const porId = new Map(ingressos.map((i) => [i.id, i]));

  // Compra antiga sem ingresso_id valia a live inteira; conta como ingresso
  // da transmissão para não tirar direito de quem já tinha comprado.
  const temALive =
    (compras ?? []).some((c) => c.ingresso_id === null) ||
    [...meus].some((id) => {
      const ingresso = id ? porId.get(id) : undefined;
      return ingresso ? !ingresso.so_bolao : false;
    });

  if (!temALive) return new Set();

  return new Set(
    [...meus]
      .map((id) => (id ? porId.get(id) : undefined))
      .filter((i) => i?.categoria_bolao_id)
      .map((i) => i!.categoria_bolao_id as string),
  );
}

/** O ticket à venda de cada categoria, se existir. */
export async function ticketsDoBolao(liveId: string) {
  const ingressos = await listarIngressos(liveId);
  return new Map(
    ingressos
      .filter((i) => i.categoria_bolao_id)
      .map((i) => [i.categoria_bolao_id as string, i]),
  );
}

/** Quantos tickets pagos cada categoria vendeu — para o dono fechar a conta. */
export async function vendasPorCategoria(
  liveId: string,
): Promise<Map<string, number>> {
  if (!supabaseServidorConfigurado) return new Map();

  const ingressos = await listarIngressos(liveId, true);
  const doBolao = ingressos.filter((i) => i.categoria_bolao_id);
  if (doBolao.length === 0) return new Map();

  const { data } = await clienteAdmin()
    .from("compras")
    .select("ingresso_id")
    .eq("live_id", liveId)
    .eq("status", "aprovada")
    .returns<{ ingresso_id: string | null }[]>();

  const contagem = new Map<string, number>();
  for (const ingresso of doBolao) {
    const categoria = ingresso.categoria_bolao_id as string;
    const vendidos = (data ?? []).filter((c) => c.ingresso_id === ingresso.id).length;
    contagem.set(categoria, (contagem.get(categoria) ?? 0) + vendidos);
  }
  return contagem;
}

// ------------------------------------------------------------
// Ranking
// ------------------------------------------------------------

/**
 * A classificação de UMA categoria.
 *
 * O ranking é por categoria, e não somado, porque cada categoria virou um
 * bolão pago à parte: quem comprou só o Open não disputa com quem comprou os
 * três. Somar tudo faria o prêmio do Open depender de quanto a pessoa gastou
 * nas outras categorias.
 *
 * Empate desfaz em três degraus, publicados no regulamento: pontos, acertos
 * exatos, e quem palpitou primeiro.
 */
export async function rankingDaCategoria(
  categoriaId: string,
): Promise<LinhaDoRanking[]> {
  const [palpites, resultados] = await Promise.all([
    listarPalpites([categoriaId]),
    listarResultados([categoriaId]),
  ]);

  const resultado = resultados[0];
  if (!resultado || palpites.length === 0) return [];

  const oficial = topCinco(resultado);

  const { data: perfis } = await clienteAdmin()
    .from("perfis")
    .select("id, nome, email")
    .in("id", [...new Set(palpites.map((p) => p.usuario_id))])
    .returns<{ id: string; nome: string; email: string }[]>();

  const nomes = new Map((perfis ?? []).map((p) => [p.id, p]));

  return palpites
    .map((palpite) => {
      const meu = topCinco(palpite);
      const perfil = nomes.get(palpite.usuario_id);
      return {
        usuarioId: palpite.usuario_id,
        apelido: apelidoPublico(perfil?.nome ?? "", perfil?.email ?? ""),
        pontos: pontuar(meu, oficial),
        exatos: acertosExatos(meu, oficial),
        desde: palpite.criado_em,
      };
    })
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        b.exatos - a.exatos ||
        a.desde.localeCompare(b.desde),
    );
}

/** Uma linha da conferência do dono: com nome, e-mail e horários. */
export type LinhaDeConferencia = {
  usuarioId: string;
  nome: string;
  email: string;
  pontos: number;
  exatos: number;
  /** Primeiro envio do palpite. */
  palpitouEm: string;
  /** Última alteração — é este que diz se valeu. */
  alteradoEm: string;
  /** Mexeu no palpite depois de a categoria fechar. */
  depoisDeFechar: boolean;
  /** Mexeu no palpite depois de o resultado sair. */
  depoisDoResultado: boolean;
};

/**
 * A classificação com nome, e-mail e horários — só para o painel.
 *
 * Serve para o dono conferir se o bolão foi limpo antes de pagar. O caso que
 * ele quer pegar: esquecer de fechar a categoria e alguém palpitar já sabendo
 * o resultado. Vale o `atualizado_em`, e não o `criado_em`: corrigir o
 * palpite depois do resultado é o mesmo golpe que palpitar depois.
 */
export async function conferenciaDaCategoria(
  categoriaId: string,
): Promise<LinhaDeConferencia[]> {
  const [categoria, palpites, resultados] = await Promise.all([
    buscarCategoria(categoriaId),
    listarPalpites([categoriaId]),
    listarResultados([categoriaId]),
  ]);

  if (!categoria || palpites.length === 0) return [];

  const resultado = resultados[0];
  const oficial = resultado ? topCinco(resultado) : null;

  const { data: perfis } = await clienteAdmin()
    .from("perfis")
    .select("id, nome, email")
    .in("id", [...new Set(palpites.map((p) => p.usuario_id))])
    .returns<{ id: string; nome: string; email: string }[]>();

  const porId = new Map((perfis ?? []).map((p) => [p.id, p]));

  return palpites
    .map((palpite) => {
      const meu = topCinco(palpite);
      const perfil = porId.get(palpite.usuario_id);

      return {
        usuarioId: palpite.usuario_id,
        nome: perfil?.nome || "(sem nome)",
        email: perfil?.email ?? "",
        pontos: oficial ? pontuar(meu, oficial) : 0,
        exatos: oficial ? acertosExatos(meu, oficial) : 0,
        palpitouEm: palpite.criado_em,
        alteradoEm: palpite.atualizado_em,
        depoisDeFechar: palpite.atualizado_em > categoria.fecha_em,
        depoisDoResultado: resultado
          ? palpite.atualizado_em > resultado.publicado_em
          : false,
      };
    })
    .sort((a, b) => b.pontos - a.pontos || b.exatos - a.exatos);
}
