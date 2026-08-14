import type { BolaoCategoria, BolaoPalpite, TopCinco } from "@/lib/tipos";

/**
 * Quanto vale cada tipo de acerto.
 *
 * Acertar o top 5 na ordem exata é quase impossível — são milhares de
 * combinações. Se o prêmio dependesse disso, o mais provável é que ninguém
 * ganhasse e o bolão virasse decepção. Pontuar o acerto parcial resolve:
 * quase todo mundo pontua, o ranking se mexe a cada resultado anunciado e
 * sempre existe um campeão.
 */
export const PONTOS = {
  /** Cravar o campeão da categoria. */
  primeiroExato: 10,
  /** Cravar qualquer uma das outras quatro posições. */
  posicaoExata: 6,
  /** Atleta certo no top 5, só que em outra posição. */
  dentroDoTop: 2,
} as const;

export const PONTOS_MAXIMOS_POR_CATEGORIA =
  PONTOS.primeiroExato + PONTOS.posicaoExata * 4;

/** Pontos de um palpite contra o resultado oficial. */
export function pontuar(palpite: TopCinco, oficial: TopCinco): number {
  return palpite.reduce((total, atleta, posicao) => {
    if (atleta === oficial[posicao]) {
      return total + (posicao === 0 ? PONTOS.primeiroExato : PONTOS.posicaoExata);
    }
    if (oficial.includes(atleta)) return total + PONTOS.dentroDoTop;
    return total;
  }, 0);
}

/** Quantas posições o palpite acertou na mosca — o primeiro desempate. */
export function acertosExatos(palpite: TopCinco, oficial: TopCinco): number {
  return palpite.filter((atleta, posicao) => atleta === oficial[posicao]).length;
}

/** As cinco posições de um palpite ou resultado, na ordem. */
export function topCinco(
  linha: Pick<
    BolaoPalpite,
    "atleta_1" | "atleta_2" | "atleta_3" | "atleta_4" | "atleta_5"
  >,
): TopCinco {
  return [
    linha.atleta_1,
    linha.atleta_2,
    linha.atleta_3,
    linha.atleta_4,
    linha.atleta_5,
  ];
}

export function categoriaAberta(
  categoria: BolaoCategoria,
  agora = new Date(),
): boolean {
  return new Date(categoria.fecha_em) > agora;
}

/**
 * Nome curto para a classificação pública.
 *
 * Primeiro nome e a inicial do sobrenome. O ranking fica visível para
 * qualquer visitante, e quem se inscreveu não escolheu expor o nome
 * completo — muito menos o e-mail.
 */
export function apelidoPublico(nome: string, email: string): string {
  const partes = (nome || "").trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) {
    const antesDoArroba = email.split("@")[0] ?? "";
    return antesDoArroba ? `${antesDoArroba.slice(0, 3)}***` : "Participante";
  }
  if (partes.length === 1) return partes[0];

  const ultimo = partes[partes.length - 1];
  return `${partes[0]} ${ultimo[0].toUpperCase()}.`;
}

/**
 * Quem leva o prêmio de uma categoria.
 *
 * Todo mundo que empatar na maior pontuação. Empate no topo é comum em
 * bolão, e escolher um só por critério de desempate seria arbitrário: duas
 * pessoas que acertaram exatamente a mesma coisa merecem o mesmo.
 *
 * O prêmio anunciado é dividido entre eles, então o custo do dono não muda
 * com a quantidade de campeões — cinco dividindo R$ 300 é R$ 60 cada,
 * cinquenta dividindo R$ 300 é R$ 6 cada.
 *
 * Zero ponto não é campeão: ninguém ganha por não ter acertado nada.
 */
export function campeoes<T extends { pontos: number }>(linhas: T[]): T[] {
  const melhor = Math.max(0, ...linhas.map((l) => l.pontos));
  if (melhor === 0) return [];
  return linhas.filter((l) => l.pontos === melhor);
}

/** Quanto cada campeão leva, em centavos, dividindo o prêmio anunciado. */
export function fatiaDoPremio(premioCentavos: number, quantosCampeoes: number): number {
  if (quantosCampeoes <= 0) return 0;
  // Arredonda para baixo: sobra de centavo fica com quem paga, nunca falta.
  return Math.floor(premioCentavos / quantosCampeoes);
}
