import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { MP_SEGREDO_WEBHOOK, supabaseServidorConfigurado } from "@/lib/config";
import {
  assinaturaValida,
  buscarPagamento,
  donoDoToken,
  statusDaCompra,
} from "@/lib/mercadopago";
import { podeTentar } from "@/lib/limite-taxa";
import { ipDaRequisicao } from "@/lib/requisicao";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Compra } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/**
 * Aviso automático de pagamento do Mercado Pago.
 *
 * Esta rota é a ÚNICA que libera acesso a uma live sozinha. A volta do
 * comprador pela tela de "pagamento aprovado" não libera nada — ela pode ser
 * forjada digitando um endereço no navegador.
 *
 * Assinatura confere: seguimos direto.
 *
 * Assinatura NÃO confere: em vez de só recusar, tratamos o aviso como um
 * palpite e vamos PERGUNTAR ao Mercado Pago, com o nosso access token, o que
 * aconteceu com aquele pagamento. Quem autoriza passa a ser a resposta dele a
 * uma pergunta nossa, e não a chamada que recebemos — por isso continua não
 * havendo como forjar acesso. Existe porque trocar credencial entre teste e
 * produção abre uma janela em que o aviso chega e não confere, e nessa janela
 * quem pagou ficaria na porta.
 *
 * Sempre respondemos 200 rápido: se devolvermos erro, o Mercado Pago fica
 * reenviando o mesmo aviso por até 4 dias.
 */
export async function POST(requisicao: Request) {
  const ip = ipDaRequisicao(requisicao);
  const url = new URL(requisicao.url);

  // O id do pagamento vem na query (?data.id=) ou no corpo.
  const idNaQuery = url.searchParams.get("data.id");
  const idAlternativoNaQuery = url.searchParams.get("id");

  let corpo: {
    type?: string;
    action?: string;
    data?: { id?: string | number };
    user_id?: number | string;
    live_mode?: boolean;
    api_version?: string;
  } = {};
  try {
    corpo = (await requisicao.json()) as typeof corpo;
  } catch {
    // Alguns avisos chegam sem corpo — seguimos com o que veio na query.
  }

  const idNoCorpo = corpo.data?.id != null ? String(corpo.data.id) : null;

  // Para BUSCAR o pagamento, qualquer um serve, nesta ordem de confiança.
  const idDado = idNaQuery ?? idAlternativoNaQuery ?? idNoCorpo;
  // Para CONFERIR a assinatura, o Mercado Pago usou um deles — não dá para
  // saber qual sem tentar (veja `assinaturaValida`).
  const idsParaAssinatura = [idNaQuery, idAlternativoNaQuery, idNoCorpo];

  if (!MP_SEGREDO_WEBHOOK) {
    console.error("[webhook-mp] MP_WEBHOOK_SECRET não configurado — aviso ignorado.");
    return NextResponse.json({ recebido: true }, { status: 200 });
  }

  const valida = assinaturaValida(
    requisicao.headers.get("x-signature"),
    requisicao.headers.get("x-request-id"),
    idsParaAssinatura,
  );

  if (!valida) {
    // O que veio na requisição fica registrado: é com isto que se descobre se
    // o problema é o segredo cadastrado ou o formato do aviso.
    // De QUEM é este aviso? O `user_id` do corpo é a conta do Mercado Pago que
    // gerou a notificação. Se ele não for o dono do nosso access token, o
    // aviso vem de outra aplicação — e aí nenhuma chave nossa confere nunca,
    // por mais que se acerte o formato do manifesto. É a diferença entre
    // "configurei errado" e "estou olhando a aplicação errada".
    const dono = await donoDoToken();
    console.error("[webhook-mp] aviso recusado", {
      query: Object.fromEntries(url.searchParams),
      temAssinatura: Boolean(requisicao.headers.get("x-signature")),
      temRequestId: Boolean(requisicao.headers.get("x-request-id")),
      tipo: corpo.type ?? corpo.action ?? null,
      idNoCorpo,
      quemMandou: corpo.user_id ?? null,
      ehAmbienteDeTeste: corpo.live_mode === false,
      donoDoNossoToken: dono ? `${dono.id} (${dono.apelido})` : "não consegui saber",
    });
    await registrar({
      acao: "webhook_mp_assinatura_invalida",
      ip,
      detalhes: { idDado, tipo: corpo.type ?? null },
    });

    // Um aviso sem assinatura vira apenas um PALPITE: "vá olhar o pagamento
    // tal". Quem decide é a resposta do Mercado Pago a uma pergunta nossa,
    // feita com o nosso access token, logo abaixo. Antes disso, um limite por
    // IP — sem ele, este endereço serviria de sonda e queimaria a cota da API
    // do Mercado Pago.
    const liberadoAConferir = await podeTentar(`webhook-sem-assinatura:${ip ?? "sem-ip"}`, 30, 300);
    if (!liberadoAConferir) {
      return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
    }
  }

  // `type` é o webhook novo; `topic` é o IPN antigo. O Mercado Pago manda os
  // dois para o mesmo endereço, e o de merchant_order traz um id que NÃO é de
  // pagamento — buscá-lo dá erro à toa.
  const tipo =
    corpo.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");

  // Nada a fazer com este aviso. Se ele veio assinado, respondemos 200 para o
  // Mercado Pago não reenviar por quatro dias; se não veio, continua sendo uma
  // chamada em que não se confia, e a resposta é 401.
  const nadaAFazer = (tipo && tipo !== "payment") || !idDado || !supabaseServidorConfigurado;
  if (nadaAFazer) {
    return valida
      ? NextResponse.json({ recebido: true }, { status: 200 })
      : NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  const liberou = await conferirNoMercadoPagoEAtualizar(idDado, ip, !valida);

  // O caminho sem assinatura só vale se a conferência aprovou de fato. Se não
  // aprovou, o aviso continua sendo o que era: uma chamada que não dá para
  // confiar, e que leva 401.
  if (!valida && !liberou) {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  return NextResponse.json({ recebido: true }, { status: 200 });
}

/**
 * Pergunta ao Mercado Pago o que aconteceu com um pagamento e atualiza a
 * compra. Devolve `true` se terminou com a compra aprovada.
 *
 * `semAssinatura` marca o caminho de resgate: o aviso chegou sem assinatura
 * válida e, em vez de simplesmente recusar, nós vamos conferir. Duas
 * restrições valem só nesse caminho, e são o que o mantêm seguro:
 *
 * - **Nunca deixa uma compra paga virar "pendente".** É o único rebaixamento
 *   que poderia vir de uma leitura atrasada do Mercado Pago, e cortaria quem
 *   pagou. Reembolso e contestação passam: ali o MP está afirmando uma
 *   reversão, e a resposta veio para uma pergunta NOSSA.
 * - **Quem recebe o acesso é o dono da compra no NOSSO banco**, não quem
 *   mandou o aviso. Inventar um número de pagamento não leva a nada: ou ele
 *   não existe, ou não é da nossa conta (nosso token não lê), ou não aponta
 *   para compra nenhuma nossa.
 */
async function conferirNoMercadoPagoEAtualizar(
  idDado: string,
  ip: string | null,
  semAssinatura: boolean,
): Promise<boolean> {
  try {
    const pagamento = await buscarPagamento(idDado);
    if (!pagamento?.externalReference) return false;

    const supabase = clienteAdmin();
    const { data: compra } = await supabase
      .from("compras")
      .select("*")
      .eq("id", pagamento.externalReference)
      .maybeSingle<Compra>();

    if (!compra) {
      await registrar({
        acao: "webhook_mp_compra_desconhecida",
        ip,
        detalhes: { idDado, referencia: pagamento.externalReference },
      });
      return false;
    }

    let novoStatus = statusDaCompra(pagamento.status);

    // Confere o valor antes de liberar. O preço vai para o Mercado Pago pelo
    // servidor, então em uso normal isto sempre bate — mas se algum dia bater
    // menos, é sinal de que a preferência foi adulterada no caminho, e nesse
    // caso o acesso não sai. Um centavo de folga cobre arredondamento.
    if (
      novoStatus === "aprovada" &&
      typeof pagamento.valorCentavos === "number" &&
      pagamento.valorCentavos < compra.valor_centavos - 1
    ) {
      novoStatus = "pendente";
      await registrar({
        usuarioId: compra.usuario_id,
        liveId: compra.live_id,
        acao: "pagamento_recusado_valor_menor",
        ip,
        detalhes: {
          idPagamento: pagamento.id,
          cobrado: compra.valor_centavos,
          pago: pagamento.valorCentavos,
        },
      });
    }

    // Compra paga não é derrubada por um pagamento QUE NÃO É O DELA.
    //
    // A pessoa pode ter tentado e falhado antes de conseguir pagar; as duas
    // tentativas carregam a mesma `external_reference`. Sem esta trava, o
    // aviso da tentativa recusada chegava depois e tirava o acesso de quem
    // já tinha pago. Reembolso e contestação são outra coisa — ali é uma
    // reversão de verdade, e valem sempre.
    const ehReversao = ["refunded", "charged_back"].includes(pagamento.status);
    const outroPagamento =
      Boolean(compra.mp_payment_id) && compra.mp_payment_id !== pagamento.id;

    if (
      compra.status === "aprovada" &&
      novoStatus !== "aprovada" &&
      !ehReversao &&
      outroPagamento
    ) {
      await registrar({
        usuarioId: compra.usuario_id,
        liveId: compra.live_id,
        acao: "webhook_mp_ignorou_status_de_outra_tentativa",
        ip,
        detalhes: {
          idPagamento: pagamento.id,
          statusMercadoPago: pagamento.status,
          pagamentoQueLiberou: compra.mp_payment_id,
        },
      });
      return false;
    }

    // Aviso sem assinatura não rebaixa para "pendente": esse é o único
    // rebaixamento que pode nascer de leitura atrasada, e cortaria quem pagou.
    if (semAssinatura && novoStatus === "pendente") return false;

    await supabase
      .from("compras")
      .update({
        status: novoStatus,
        mp_payment_id: pagamento.id,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", compra.id);

    // Perdeu o acesso: a sessão cai junto. Sem isto, quem está com o player
    // aberto continuaria assistindo até o token vencer — até 3 minutos e meio
    // depois de o reembolso ter sido pedido.
    if (compra.status === "aprovada" && novoStatus !== "aprovada") {
      await supabase.from("sessoes_ativas").delete().eq("usuario_id", compra.usuario_id);
    }

    await registrar({
      usuarioId: compra.usuario_id,
      liveId: compra.live_id,
      acao: semAssinatura
        ? "pagamento_aprovado_conferido_no_mp"
        : `pagamento_${novoStatus}`,
      ip,
      detalhes: {
        idPagamento: pagamento.id,
        statusMercadoPago: pagamento.status,
        valorCentavos: pagamento.valorCentavos,
        semAssinatura,
      },
    });

    return novoStatus === "aprovada";
  } catch (erro) {
    console.error("[webhook-mp] falha ao processar:", erro);
    return false;
  }
}

/** O Mercado Pago às vezes faz um GET de teste ao salvar a configuração. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
