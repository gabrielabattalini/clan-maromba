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

/**
 * Os palpites de uma pessoa, agrupados por categoria.
 *
 * É uma LISTA por categoria, e não um só: quem compra três tickets do Open
 * tem três palpites concorrendo ali.
 */
export async function meusPalpites(
  usuarioId: string,
  categoriaIds: string[],
): Promise<Map<string, BolaoPalpite[]>> {
  if (!supabaseServidorConfigurado || categoriaIds.length === 0) return new Map();

  const { data } = await clienteAdmin()
    .from("bolao_palpites")
    .select("*")
    .eq("usuario_id", usuarioId)
    .in("categoria_id", categoriaIds)
    .order("criado_em", { ascending: true })
    .returns<BolaoPalpite[]>();

  const porCategoria = new Map<string, BolaoPalpite[]>();
  for (const palpite of data ?? []) {
    porCategoria.set(palpite.categoria_id, [
      ...(porCategoria.get(palpite.categoria_id) ?? []),
      palpite,
    ]);
  }
  return porCategoria;
}

/** O que a pessoa tem em cada categoria: entradas compradas e ainda livres. */
export type MinhasEntradas = {
  /** Tickets pagos desta categoria. */
  compradas: number;
  /** Compras que ainda não viraram palpite — cada uma dá direito a um. */
  livres: string[];
};

/**
 * Quantas entradas a pessoa tem em cada categoria, e quantas ainda pode usar.
 *
 * Duas condições para valer alguma coisa, e as duas são decisão do dono:
 *   1. ter ingresso da transmissão — o bolão é vinculado à live;
 *   2. ter ticket daquela categoria — um ticket vale uma entrada.
 *
 * E cada entrada é usada UMA vez: o palpite não pode ser alterado depois de
 * enviado, então quem quiser palpitar de novo compra outro ticket.
 *
 * O dono não recebe entradas de brinde: para testar, ele compra igual a
 * todo mundo (em modo de teste do Mercado Pago não custa nada).
 */
export async function entradasPorCategoria(
  usuarioId: string,
  liveId: string,
): Promise<Map<string, MinhasEntradas>> {
  const vazio = new Map<string, MinhasEntradas>();
  if (!supabaseServidorConfigurado) return vazio;

  const [ingressos, { data: compras }, palpites] = await Promise.all([
    listarIngressos(liveId, true),
    clienteAdmin()
      .from("compras")
      .select("id, ingresso_id")
      .eq("live_id", liveId)
      .eq("usuario_id", usuarioId)
      .eq("status", "aprovada")
      .returns<{ id: string; ingresso_id: string | null }[]>(),
    listarPalpitesDoUsuario(usuarioId, liveId),
  ]);

  const porId = new Map(ingressos.map((i) => [i.id, i]));
  const minhasCompras = compras ?? [];

  // Compra antiga sem ingresso_id valia a live inteira — conta como ingresso
  // da transmissão para não tirar direito de quem já tinha comprado.
  const temALive = minhasCompras.some((c) => {
    if (c.ingresso_id === null) return true;
    const ingresso = porId.get(c.ingresso_id);
    return ingresso ? !ingresso.so_bolao : false;
  });

  if (!temALive) return vazio;

  const usadas = new Set(palpites.map((p) => p.compra_id).filter(Boolean));

  for (const compra of minhasCompras) {
    const ingresso = compra.ingresso_id ? porId.get(compra.ingresso_id) : undefined;
    const categoria = ingresso?.categoria_bolao_id;
    if (!categoria) continue;

    const atual = vazio.get(categoria) ?? { compradas: 0, livres: [] };
    atual.compradas += 1;
    if (!usadas.has(compra.id)) atual.livres.push(compra.id);
    vazio.set(categoria, atual);
  }

  return vazio;
}

/** Todos os palpites que a pessoa fez nesta live. */
export async function listarPalpitesDoUsuario(
  usuarioId: string,
  liveId: string,
): Promise<BolaoPalpite[]> {
  if (!supabaseServidorConfigurado) return [];

  const categorias = await listarCategorias(liveId);
  if (categorias.length === 0) return [];

  const { data } = await clienteAdmin()
    .from("bolao_palpites")
    .select("*")
    .eq("usuario_id", usuarioId)
    .in(
      "categoria_id",
      categorias.map((c) => c.id),
    )
    .order("criado_em", { ascending: true })
    .returns<BolaoPalpite[]>();

  return data ?? [];
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
        palpiteId: palpite.id,
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
  palpiteId: string;
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
        palpiteId: palpite.id,
        usuarioId: palpite.usuario_id,
        nome: perfil?.nome || "(sem nome)",
        email: perfil?.email ?? "",
        pontos: oficial ? pontuar(meu, oficial) : 0,
        exatos: oficial ? acertosExatos(meu, oficial) : 0,
        palpitouEm: palpite.criado_em,
        alteradoEm: palpite.atualizado_em,
        // O palpite é imutável, então na prática os dois horários são o
        // mesmo. A checagem olha o maior dos dois assim mesmo: se um dia
        // alguém alterar por dentro do banco, aparece aqui.
        depoisDeFechar: maisTarde(palpite) > categoria.fecha_em,
        depoisDoResultado: resultado
          ? maisTarde(palpite) > resultado.publicado_em
          : false,
      };
    })
    .sort((a, b) => b.pontos - a.pontos || b.exatos - a.exatos);
}

/** O instante que vale para conferência: o mais recente entre os dois. */
function maisTarde(palpite: BolaoPalpite): string {
  return palpite.atualizado_em > palpite.criado_em
    ? palpite.atualizado_em
    : palpite.criado_em;
}
