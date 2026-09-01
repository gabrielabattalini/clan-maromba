import { createHmac } from "node:crypto";

/**
 * Descobre COM QUE chave e COM QUE formato uma assinatura foi feita.
 *
 * Existe porque uma assinatura que não confere não diz nada: chave errada,
 * formato errado e id errado dão exatamente o mesmo 401 mudo. Em 01/09/2026
 * isso custou uma noite de chutes — a simulação do painel do Mercado Pago
 * devolvia 200 e a compra de verdade devolvia 401, no mesmo endereço, com o
 * mesmo segredo.
 *
 * Isto NÃO decide nada. Não libera acesso, não é chamado antes da validação,
 * e nunca imprime o valor de chave nenhuma — só o RÓTULO da combinação que
 * bateu. Quem autoriza continua sendo `assinaturaValida`, com o segredo
 * cadastrado e mais nada.
 */

export type Chave = { rotulo: string; valor: string };

export type PedacosDaAssinatura = {
  ts: string;
  v1: string;
  idRequisicao: string | null;
  /** Todos os ids que vieram: query `data.id`, query `id`, corpo. */
  ids: (string | null)[];
};

/** Os formatos de manifesto que o Mercado Pago já usou ou poderia usar. */
function manifestos(p: PedacosDaAssinatura): { rotulo: string; texto: string }[] {
  const lista: { rotulo: string; texto: string }[] = [];
  const ids = [...new Set(p.ids.filter((i): i is string => Boolean(i?.trim())))];

  const monta = (
    rotulo: string,
    id: string | null,
    comRequestId: boolean,
    comPontoEVirgulaFinal: boolean,
    minusculo: boolean,
  ) => {
    let texto = "";
    if (id) texto += `id:${minusculo ? id.toLowerCase() : id};`;
    if (comRequestId && p.idRequisicao) texto += `request-id:${p.idRequisicao};`;
    texto += comPontoEVirgulaFinal ? `ts:${p.ts};` : `ts:${p.ts}`;
    lista.push({ rotulo, texto });
  };

  for (const [indice, id] of ids.entries()) {
    monta(`id${indice}+rid+;`, id, true, true, true);
    monta(`id${indice}+rid`, id, true, false, true);
    monta(`id${indice}+;`, id, false, true, true);
    monta(`id${indice}+original`, id, true, true, false);
  }
  monta("sem-id+rid+;", null, true, true, true);
  monta("só-ts", null, false, true, true);

  return lista;
}

/**
 * Devolve o rótulo da combinação que bate, ou null.
 *
 * O rótulo diz qual chave e qual formato — o suficiente para corrigir, sem
 * expor nada. Comparação simples: aqui não há decisão de acesso, então não
 * há canal de tempo a proteger.
 */
export function descobrirAssinatura(
  p: PedacosDaAssinatura,
  chaves: Chave[],
): string | null {
  for (const chave of chaves) {
    if (!chave.valor) continue;
    for (const m of manifestos(p)) {
      const hex = createHmac("sha256", chave.valor).update(m.texto).digest("hex");
      if (hex === p.v1) return `${chave.rotulo} / ${m.rotulo}`;
      // Alguns provedores mandam a assinatura em base64 em vez de hex.
      const b64 = createHmac("sha256", chave.valor).update(m.texto).digest("base64");
      if (b64 === p.v1) return `${chave.rotulo} / ${m.rotulo} / base64`;
    }
  }
  return null;
}
