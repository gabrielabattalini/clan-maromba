import { estaTransmitindo } from "@/lib/cloudflare";
import { buscarDadosPrivados } from "@/lib/lives";
import type { Live } from "@/lib/tipos";

/**
 * A live está no ar AGORA?
 *
 * Quem responde é a Cloudflare, não um botão no painel: assim que o OBS
 * conecta, o player libera para quem comprou; quando o OBS desliga, trava
 * sozinho. Isso evita o pior erro possível no dia da live — esquecer de
 * apertar um botão e deixar os compradores na porta.
 *
 * Os dois estados que o dono controla continuam mandando:
 * - `rascunho` e `encerrada` nunca ficam no ar, mesmo com o OBS ligado;
 * - `no_ar` gravado à mão no banco funciona como liberação manual, para o
 *   caso de a detecção falhar bem na hora da transmissão.
 */
export async function liveEstaNoAr(live: Live): Promise<boolean> {
  if (live.estado === "rascunho" || live.estado === "encerrada") return false;
  if (live.estado === "no_ar") return true;

  const privado = await buscarDadosPrivados(live.id);
  if (!privado?.cf_input_uid) return false;

  return estaTransmitindo(privado.cf_input_uid);
}

/** O mesmo para uma lista, em paralelo (usado na home). */
export async function marcarQuaisEstaoNoAr(
  lives: Live[],
): Promise<{ live: Live; noAr: boolean }[]> {
  return Promise.all(
    lives.map(async (live) => ({ live, noAr: await liveEstaNoAr(live) })),
  );
}
