import { supabaseServidorConfigurado } from "@/lib/config";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Compra, Ingresso, IngressoNaVitrine } from "@/lib/tipos";

/**
 * O preço que vale AGORA.
 *
 * Enquanto a promoção estiver de pé, é o preço promocional. Passou do prazo,
 * o site cobra o preço cheio de verdade. Isso é o que torna o contador na
 * tela honesto: ele não é enfeite, ele conta para uma coisa que acontece.
 */
export function precoAgora(ingresso: Ingresso, agora = new Date()): number {
  const promoAcabou =
    ingresso.promocao_ate !== null && new Date(ingresso.promocao_ate) <= agora;

  if (promoAcabou && ingresso.preco_cheio_centavos !== null) {
    return ingresso.preco_cheio_centavos;
  }
  return ingresso.preco_centavos;
}

export function emPromocao(ingresso: Ingresso, agora = new Date()): boolean {
  if (ingresso.preco_cheio_centavos === null) return false;
  if (ingresso.preco_cheio_centavos <= ingresso.preco_centavos) return false;
  if (ingresso.promocao_ate === null) return true;
  return new Date(ingresso.promocao_ate) > agora;
}

/**
 * Este ingresso dá acesso ao vídeo neste momento?
 *
 * Os dois extremos nulos significam passe completo. A janela é conferida em
 * data-e-hora justamente porque as finais atravessam a meia-noite: quem
 * comprou "sábado" continua vendo às 2h da manhã de domingo.
 */
export function ingressoValeAgora(ingresso: Ingresso, agora = new Date()): boolean {
  if (ingresso.inicia_em && new Date(ingresso.inicia_em) > agora) return false;
  if (ingresso.termina_em && new Date(ingresso.termina_em) <= agora) return false;
  return true;
}

export async function listarIngressos(
  liveId: string,
  incluirInativos = false,
): Promise<Ingresso[]> {
  if (!supabaseServidorConfigurado) return [];

  let consulta = clienteAdmin().from("ingressos").select("*").eq("live_id", liveId);
  if (!incluirInativos) consulta = consulta.eq("ativo", true);

  const { data } = await consulta
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: true })
    .returns<Ingresso[]>();

  return data ?? [];
}

export async function buscarIngresso(id: string): Promise<Ingresso | null> {
  if (!supabaseServidorConfigurado) return null;

  const { data } = await clienteAdmin()
    .from("ingressos")
    .select("*")
    .eq("id", id)
    .maybeSingle<Ingresso>();

  return data ?? null;
}

/** Compras pagas de uma live, para contar vendidos e saber o que já é meu. */
async function comprasPagas(liveId: string): Promise<Compra[]> {
  if (!supabaseServidorConfigurado) return [];

  const { data } = await clienteAdmin()
    .from("compras")
    .select("*")
    .eq("live_id", liveId)
    .eq("status", "aprovada")
    .returns<Compra[]>();

  return data ?? [];
}

/**
 * A vitrine: cada ingresso com preço atual, quantos restam e se já é meu.
 */
export async function montarVitrine(
  liveId: string,
  usuarioId?: string | null,
): Promise<IngressoNaVitrine[]> {
  const [ingressos, pagas] = await Promise.all([
    listarIngressos(liveId),
    comprasPagas(liveId),
  ]);

  const agora = new Date();

  return ingressos.map((ingresso) => {
    const vendidos = pagas.filter((c) => c.ingresso_id === ingresso.id).length;
    const restam = ingresso.limite === null ? null : Math.max(0, ingresso.limite - vendidos);
    const jaTenho = usuarioId
      ? pagas.some((c) => c.ingresso_id === ingresso.id && c.usuario_id === usuarioId)
      : false;

    return {
      ingresso,
      precoAgora: precoAgora(ingresso, agora),
      emPromocao: emPromocao(ingresso, agora),
      vendidos,
      restam,
      esgotado: restam !== null && restam <= 0,
      jaTenho,
    };
  });
}

/**
 * A pessoa pode assistir AGORA?
 *
 * Precisa de uma compra paga de algum ingresso desta live cuja janela
 * cubra este momento. Quem comprou só o Dia 1 não entra no Dia 3.
 */
export async function temAcessoAgora(
  usuarioId: string,
  liveId: string,
  agora = new Date(),
): Promise<boolean> {
  if (!supabaseServidorConfigurado) return false;

  const pagas = (await comprasPagas(liveId)).filter((c) => c.usuario_id === usuarioId);
  if (pagas.length === 0) return false;

  // Compra antiga, de antes dos ingressos: valia a live inteira.
  if (pagas.some((c) => c.ingresso_id === null)) return true;

  const ingressos = await listarIngressos(liveId, true);
  const meus = new Set(pagas.map((c) => c.ingresso_id));

  return ingressos.some((i) => meus.has(i.id) && ingressoValeAgora(i, agora));
}

/** Comprou alguma coisa desta live, mesmo que a janela ainda não tenha aberto. */
export async function comprouAlgumaCoisa(
  usuarioId: string,
  liveId: string,
): Promise<boolean> {
  const pagas = await comprasPagas(liveId);
  return pagas.some((c) => c.usuario_id === usuarioId);
}
