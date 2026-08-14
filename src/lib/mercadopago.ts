import { createHmac, timingSafeEqual } from "node:crypto";

import { MP_SEGREDO_WEBHOOK, MP_TOKEN, enderecoDoSite } from "@/lib/config";

const API = "https://api.mercadopago.com";

export type DadosPreferencia = {
  compraId: string;
  titulo: string;
  descricao: string;
  precoCentavos: number;
  slugDaLive: string;
  emailComprador: string;
};

/**
 * Cria a "preferência" de pagamento e devolve o endereço do Checkout Pro.
 *
 * `external_reference` leva o id da compra no nosso banco — é por ele que o
 * webhook descobre depois qual acesso liberar.
 */
export async function criarPreferencia(dados: DadosPreferencia): Promise<string> {
  if (!MP_TOKEN) throw new Error("MP_ACCESS_TOKEN não configurado.");

  const site = enderecoDoSite();
  const retorno = `${site}/live/${dados.slugDaLive}`;

  const resposta = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          id: dados.compraId,
          title: dados.titulo.slice(0, 250),
          description: (dados.descricao || dados.titulo).slice(0, 250),
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number((dados.precoCentavos / 100).toFixed(2)),
        },
      ],
      payer: { email: dados.emailComprador },
      external_reference: dados.compraId,
      back_urls: {
        success: `${retorno}?pagamento=sucesso`,
        pending: `${retorno}?pagamento=pendente`,
        failure: `${retorno}?pagamento=falhou`,
      },
      auto_return: "approved",
      // Boleto fora: demora dias para compensar e a live é hoje.
      payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
      notification_url: `${site}/api/webhooks/mercadopago`,
      statement_descriptor: "CLANMAROMBA",
    }),
    cache: "no-store",
  });

  const corpo = (await resposta.json().catch(() => null)) as
    | { init_point?: string; message?: string }
    | null;

  if (!resposta.ok || !corpo?.init_point) {
    throw new Error(
      `Mercado Pago recusou a preferência: ${corpo?.message ?? resposta.status}`,
    );
  }

  // Com credenciais de teste o próprio init_point já abre o sandbox.
  return corpo.init_point;
}

export type PagamentoMP = {
  id: string;
  status: string;
  externalReference: string | null;
  valorCentavos: number | null;
};

export async function buscarPagamento(idPagamento: string): Promise<PagamentoMP | null> {
  if (!MP_TOKEN) return null;

  const resposta = await fetch(`${API}/v1/payments/${idPagamento}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
    cache: "no-store",
  });

  if (!resposta.ok) return null;

  const corpo = (await resposta.json()) as {
    id?: number | string;
    status?: string;
    external_reference?: string | null;
    transaction_amount?: number;
  };

  return {
    id: String(corpo.id ?? idPagamento),
    status: corpo.status ?? "desconhecido",
    externalReference: corpo.external_reference ?? null,
    valorCentavos:
      typeof corpo.transaction_amount === "number"
        ? Math.round(corpo.transaction_amount * 100)
        : null,
  };
}

/**
 * Confere a assinatura `x-signature` do webhook.
 *
 * Esta é a trava mais importante do sistema: sem ela, qualquer pessoa
 * poderia chamar nosso endereço fingindo um pagamento aprovado e ganhar
 * acesso de graça.
 */
export function assinaturaValida(
  cabecalhoAssinatura: string | null,
  idRequisicao: string | null,
  idDado: string | null,
): boolean {
  if (!MP_SEGREDO_WEBHOOK || !cabecalhoAssinatura) return false;

  let ts = "";
  let v1 = "";
  for (const parte of cabecalhoAssinatura.split(",")) {
    const [chave, valor] = parte.split("=", 2);
    if (!chave || !valor) continue;
    if (chave.trim() === "ts") ts = valor.trim();
    if (chave.trim() === "v1") v1 = valor.trim();
  }

  if (!ts || !v1) return false;

  // O manifesto omite por completo os pedaços que não vieram na requisição.
  let manifesto = "";
  if (idDado) manifesto += `id:${idDado.toLowerCase()};`;
  if (idRequisicao) manifesto += `request-id:${idRequisicao};`;
  manifesto += `ts:${ts};`;

  const esperado = createHmac("sha256", MP_SEGREDO_WEBHOOK).update(manifesto).digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/** Traduz o status do Mercado Pago para o status da nossa tabela. */
export function statusDaCompra(
  statusMP: string,
): "pendente" | "aprovada" | "recusada" | "reembolsada" {
  switch (statusMP) {
    case "approved":
    case "authorized":
      return "aprovada";
    case "refunded":
    case "charged_back":
    case "cancelled":
      return statusMP === "cancelled" ? "recusada" : "reembolsada";
    case "rejected":
      return "recusada";
    default:
      return "pendente";
  }
}
