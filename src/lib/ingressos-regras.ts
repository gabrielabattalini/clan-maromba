import type { Ingresso } from "@/lib/tipos";

/**
 * Este ingresso dá acesso ao vídeo neste momento?
 *
 * A janela é conferida em data-e-hora justamente porque as finais atravessam
 * a meia-noite: quem comprou "sábado" continua vendo às 2h da manhã de
 * domingo. Os dois extremos nulos significam passe completo.
 */
export function ingressoValeAgora(ingresso: Ingresso, agora = new Date()): boolean {
  if (ingresso.inicia_em && new Date(ingresso.inicia_em) > agora) return false;
  if (ingresso.termina_em && new Date(ingresso.termina_em) <= agora) return false;
  return true;
}

/**
 * Este ingresso abre o player?
 *
 * O ingresso do bolão custa poucos reais e não tem janela nenhuma. Sem esta
 * checagem, `ingressoValeAgora` o leria como passe completo e ele liberaria
 * a transmissão inteira por R$ 5 — o buraco mais caro que este projeto
 * poderia ter. Por isso a regra é uma função separada, e testada.
 */
export function daAcessoAoVideo(ingresso: Ingresso, agora = new Date()): boolean {
  if (ingresso.so_bolao) return false;
  return ingressoValeAgora(ingresso, agora);
}
