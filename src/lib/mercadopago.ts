import { createHmac, timingSafeEqual } from "node:crypto";

import { MP_SEGREDOS_WEBHOOK, MP_TOKEN, enderecoDoSite } from "@/lib/config";
import { descobrirAssinatura } from "@/lib/mp-diagnostico";

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
      // NÃO mande `notification_url` aqui.
      //
      // Pedir o aviso dentro da cobrança faz o Mercado Pago mandar por um
      // segundo caminho, e esse não é assinado com o segredo do painel. Em
      // 01/09/2026 isso travou o teste de ponta a ponta: a simulação do
      // painel devolvia 200 e a compra de verdade devolvia 401 na mesma
      // publicação, com o mesmo segredo. Sem esta linha, o aviso vem só pelo
      // webhook cadastrado no painel — o caminho assinado, o único em que
      // dá para confiar.
      back_urls: {
        success: `${retorno}?pagamento=sucesso`,
        pending: `${retorno}?pagamento=pendente`,
        failure: `${retorno}?pagamento=falhou`,
      },
      auto_return: "approved",
      // Boleto fora: demora dias para compensar e a live é hoje.
      payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
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

/**
 * Procura no Mercado Pago o pagamento de uma compra nossa.
 *
 * É o caminho de PUXAR, para quando o aviso não chega ou não pode ser
 * conferido. Diferente do webhook, aqui quem pergunta somos nós, com o nosso
 * access token — não há assinatura para validar porque não há ninguém de
 * fora falando: a resposta vem direto do Mercado Pago.
 *
 * A busca é por `external_reference`, que é o id da nossa compra e vai na
 * preferência desde sempre.
 */
export async function buscarPagamentoDaCompra(
  compraId: string,
): Promise<PagamentoMP | null> {
  if (!MP_TOKEN) return null;

  const endereco = `${API}/v1/payments/search?sort=date_created&criteria=desc&external_reference=${encodeURIComponent(compraId)}`;

  const resposta = await fetch(endereco, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
    cache: "no-store",
  });
  if (!resposta.ok) return null;

  const corpo = (await resposta.json()) as {
    results?: {
      id?: number | string;
      status?: string;
      external_reference?: string | null;
      transaction_amount?: number;
    }[];
  };

  const achados = corpo.results ?? [];
  if (achados.length === 0) return null;

  // Entre vários, o aprovado manda: a pessoa pode ter tentado e falhado antes
  // de conseguir pagar, e é o que valeu que interessa.
  const bruto =
    achados.find((p) => p.status === "approved" || p.status === "authorized") ??
    achados[0];

  return {
    id: String(bruto.id ?? ""),
    status: bruto.status ?? "desconhecido",
    externalReference: bruto.external_reference ?? null,
    valorCentavos:
      typeof bruto.transaction_amount === "number"
        ? Math.round(bruto.transaction_amount * 100)
        : null,
  };
}

/**
 * De quem é a conta do nosso access token?
 *
 * Serve para o diagnóstico do webhook: se o `user_id` que vem no aviso não
 * for este id, o aviso é de OUTRA aplicação/conta do Mercado Pago — e aí
 * nenhuma chave nossa vai conferir nunca, por mais que se acerte o formato.
 */
export async function donoDoToken(): Promise<{ id: number; apelido: string } | null> {
  if (!MP_TOKEN) return null;

  try {
    const resposta = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
      cache: "no-store",
    });
    if (!resposta.ok) return null;

    const corpo = (await resposta.json()) as { id?: number; nickname?: string };
    if (typeof corpo.id !== "number") return null;

    return { id: corpo.id, apelido: corpo.nickname ?? "" };
  } catch {
    return null;
  }
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
/** Compara um manifesto com o v1 que veio no cabeçalho, sem vazar tempo. */
function confere(manifesto: string, v1: string, segredo: string): boolean {
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * A assinatura do aviso do Mercado Pago é de verdade?
 *
 * `idDado` aceita uma lista porque o id do pagamento chega em lugares
 * diferentes conforme o aviso: `?data.id=` na URL, `?id=` na URL, ou dentro
 * do corpo. O manifesto que o Mercado Pago assinou usa UM deles, e assinar o
 * errado dá exatamente o mesmo resultado de segredo errado — 401 sem pista.
 * Testamos os candidatos que chegaram; todos exigem o segredo, então
 * nenhuma tentativa a mais afrouxa a trava.
 *
 * O que NÃO fazemos é aceitar manifesto sem id nenhum quando algum id veio:
 * seria abrir mão de amarrar a assinatura ao pagamento.
 */
export function assinaturaValida(
  cabecalhoAssinatura: string | null,
  idRequisicao: string | null,
  idDado: string | null | (string | null)[],
): boolean {
  if (MP_SEGREDOS_WEBHOOK.length === 0 || !cabecalhoAssinatura) return false;

  let ts = "";
  let v1 = "";
  for (const parte of cabecalhoAssinatura.split(",")) {
    const [chave, valor] = parte.split("=", 2);
    if (!chave || !valor) continue;
    if (chave.trim() === "ts") ts = valor.trim();
    if (chave.trim() === "v1") v1 = valor.trim();
  }

  if (!ts || !v1) return false;

  const candidatos: (string | null)[] = [];
  for (const id of Array.isArray(idDado) ? idDado : [idDado]) {
    const limpo = id?.trim() || null;
    if (limpo && !candidatos.includes(limpo)) candidatos.push(limpo);
  }
  // Nenhum id veio: o manifesto do Mercado Pago também não tem o segmento.
  if (candidatos.length === 0) candidatos.push(null);

  const tentados: string[] = [];
  for (const id of candidatos) {
    // O manifesto omite por completo os pedaços que não vieram na requisição.
    let manifesto = "";
    if (id) manifesto += `id:${id.toLowerCase()};`;
    if (idRequisicao) manifesto += `request-id:${idRequisicao};`;
    manifesto += `ts:${ts};`;

    for (const segredo of MP_SEGREDOS_WEBHOOK) {
      if (confere(manifesto, v1, segredo)) return true;
    }
    tentados.push(manifesto);
  }

  // Sem isto, um segredo errado e um id errado dão o mesmo 401 mudo, e a
  // única saída é adivinhar. Nada aqui é segredo: o manifesto é público e do
  // segredo sai só o tamanho, que é o que denuncia um "colar" pela metade.
  if (process.env.NODE_ENV === "production") {
    // Descobre com QUE chave e QUE formato o aviso foi assinado. Não decide
    // nada — só devolve o rótulo da combinação, para o erro parar de ser mudo.
    const combinacao = descobrirAssinatura(
      { ts, v1, idRequisicao, ids: Array.isArray(idDado) ? idDado : [idDado] },
      [
        ...MP_SEGREDOS_WEBHOOK.map((valor, i) => ({ rotulo: `segredo${i}`, valor })),
        { rotulo: "sem-chave", valor: " " },
        { rotulo: "access-token", valor: MP_TOKEN },
      ],
    );

    console.error("[webhook-mp] assinatura não confere", {
      manifestosTentados: tentados,
      v1Recebido: v1.slice(0, 12),
      segredosCadastrados: MP_SEGREDOS_WEBHOOK.map((s) => s.length),
      combinacaoQueBate: combinacao ?? "nenhuma das testadas",
    });
  }

  return false;
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
