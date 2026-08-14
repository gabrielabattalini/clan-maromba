/**
 * As regras do chat que não dependem de banco — logo, testáveis.
 *
 * Elas existem porque, no dia da live, o dono está comentando: ele não vai
 * estar olhando o chat para moderar. O que segura a bagunça é o que roda
 * sozinho.
 */

export const TAMANHO_MAXIMO = 300;

/** Padrão de link, incluindo os disfarçados ("site ponto com", "site .com"). */
const LINK =
  /(https?:\/\/|www\.|t\.me\/|wa\.me\/|[a-z0-9-]+\s*(\.|\(?ponto\)?)\s*(com|net|org|br|tv|io|me|gg|xyz|live|shop|club|site|link|app|info|top|vip)\b)/i;

/**
 * Tem link?
 *
 * É a regra mais importante do chat de uma live paga. Sem ela, basta uma
 * pessoa colar o endereço de uma transmissão pirata para o público que
 * pagou ir embora — dentro da própria página que o dono vende.
 */
export function pareceLink(texto: string): boolean {
  // Tira acentos e caracteres invisíveis usados para escapar do filtro.
  const limpo = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, "");

  return LINK.test(limpo);
}

/**
 * Arruma a mensagem antes de guardar.
 *
 * Junta quebras de linha e espaços repetidos: sem isso, uma mensagem com
 * quarenta linhas em branco empurra o chat inteiro para fora da tela — o
 * jeito mais fácil de estragar a conversa de todo mundo.
 */
export function limparMensagem(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAXIMO);
}

/** Grito: mais de 12 letras e quase tudo maiúsculo. */
export function estaGritando(texto: string): boolean {
  const letras = texto.replace(/[^a-z\u00c0-\u00ff]/gi, "");
  if (letras.length < 12) return false;

  const maiusculas = letras.replace(/[^A-Z\u00c0-\u00de]/g, "").length;
  return maiusculas / letras.length > 0.7;
}

export type Recusa =
  | { ok: true; texto: string }
  | { ok: false; motivo: string };

/**
 * Decide se a mensagem entra, e com que texto.
 *
 * `ehAdmin` passa por cima do filtro de link: o dono precisa poder mandar o
 * endereço do bolão e do próprio site no meio da transmissão.
 */
export function avaliarMensagem(bruto: string, ehAdmin: boolean): Recusa {
  const texto = limparMensagem(bruto);

  if (texto.length === 0) return { ok: false, motivo: "Escreva alguma coisa." };

  if (!ehAdmin && pareceLink(texto)) {
    return {
      ok: false,
      motivo: "Link não é permitido no chat.",
    };
  }

  // Gritar não é motivo para recusar a mensagem — só para baixar o tom dela.
  return { ok: true, texto: estaGritando(texto) ? abaixarOTom(texto) : texto };
}

function abaixarOTom(texto: string): string {
  const minusculo = texto.toLocaleLowerCase("pt-BR");
  return minusculo.charAt(0).toLocaleUpperCase("pt-BR") + minusculo.slice(1);
}

/**
 * Quanto falta para a pessoa poder mandar outra mensagem, em segundos.
 *
 * Zero quer dizer que já pode. O modo lento é por live e vale para todo
 * mundo menos o dono.
 */
export function segundosDeEspera(
  ultimaMensagemEm: string | null,
  modoLentoSegundos: number,
  agora = new Date(),
): number {
  if (!ultimaMensagemEm || modoLentoSegundos <= 0) return 0;

  const desde = (agora.getTime() - new Date(ultimaMensagemEm).getTime()) / 1000;
  return Math.max(0, Math.ceil(modoLentoSegundos - desde));
}
