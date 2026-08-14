import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { MP_SEGREDO_WEBHOOK, supabaseServidorConfigurado } from "@/lib/config";
import { assinaturaValida, buscarPagamento, statusDaCompra } from "@/lib/mercadopago";
import { ipDaRequisicao } from "@/lib/requisicao";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Compra } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/**
 * Aviso automático de pagamento do Mercado Pago.
 *
 * Esta rota é a ÚNICA que libera acesso a uma live. A volta do comprador
 * pela tela de "pagamento aprovado" não libera nada — ela pode ser forjada
 * digitando um endereço no navegador.
 *
 * Sempre respondemos 200 rápido: se devolvermos erro, o Mercado Pago fica
 * reenviando o mesmo aviso por até 4 dias.
 */
export async function POST(requisicao: Request) {
  const ip = ipDaRequisicao(requisicao);
  const url = new URL(requisicao.url);

  // O id do pagamento vem na query (?data.id=) ou no corpo.
  let idDado = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  let corpo: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    corpo = (await requisicao.json()) as typeof corpo;
  } catch {
    // Alguns avisos chegam sem corpo — seguimos com o que veio na query.
  }

  if (!idDado && corpo.data?.id) idDado = String(corpo.data.id);

  if (!MP_SEGREDO_WEBHOOK) {
    console.error("[webhook-mp] MP_WEBHOOK_SECRET não configurado — aviso ignorado.");
    return NextResponse.json({ recebido: true }, { status: 200 });
  }

  const valida = assinaturaValida(
    requisicao.headers.get("x-signature"),
    requisicao.headers.get("x-request-id"),
    idDado,
  );

  if (!valida) {
    await registrar({
      acao: "webhook_mp_assinatura_invalida",
      ip,
      detalhes: { idDado, tipo: corpo.type ?? null },
    });
    // 401 porque a chamada não é confiável — não é um erro nosso para reenviar.
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  const tipo = corpo.type ?? url.searchParams.get("type");
  if (tipo && tipo !== "payment") {
    return NextResponse.json({ recebido: true }, { status: 200 });
  }

  if (!idDado || !supabaseServidorConfigurado) {
    return NextResponse.json({ recebido: true }, { status: 200 });
  }

  try {
    const pagamento = await buscarPagamento(idDado);
    if (!pagamento?.externalReference) {
      return NextResponse.json({ recebido: true }, { status: 200 });
    }

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
      return NextResponse.json({ recebido: true }, { status: 200 });
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

    await supabase
      .from("compras")
      .update({
        status: novoStatus,
        mp_payment_id: pagamento.id,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", compra.id);

    await registrar({
      usuarioId: compra.usuario_id,
      liveId: compra.live_id,
      acao: `pagamento_${novoStatus}`,
      ip,
      detalhes: {
        idPagamento: pagamento.id,
        statusMercadoPago: pagamento.status,
        valorCentavos: pagamento.valorCentavos,
      },
    });
  } catch (erro) {
    console.error("[webhook-mp] falha ao processar:", erro);
  }

  return NextResponse.json({ recebido: true }, { status: 200 });
}

/** O Mercado Pago às vezes faz um GET de teste ao salvar a configuração. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
