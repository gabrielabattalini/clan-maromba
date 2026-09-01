// O diagnóstico existe para acabar com o 401 mudo: ele diz COM QUE chave e
// COM QUE formato uma assinatura foi feita. Estes testes garantem que ele
// acha a combinação certa — e, principalmente, que ele NÃO inventa uma
// quando não existe (senão mandaria a gente consertar a coisa errada).

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import { descobrirAssinatura } from "@/lib/mp-diagnostico";

const TS = "1788234958";
const RID = "6e083565-ae26-4e45-b78a-517fff6afe41";
const ID = "176627268674";

function assinar(texto: string, chave: string, formato: "hex" | "base64" = "hex") {
  return createHmac("sha256", chave).update(texto).digest(formato);
}

const pedacos = (v1: string) => ({ ts: TS, v1, idRequisicao: RID, ids: [ID] });

test("acha o formato padrão do Mercado Pago", () => {
  const v1 = assinar(`id:${ID};request-id:${RID};ts:${TS};`, "chave-certa");
  assert.equal(
    descobrirAssinatura(pedacos(v1), [{ rotulo: "segredo0", valor: "chave-certa" }]),
    "segredo0 / id0+rid+;",
  );
});

test("acha quando o manifesto não tem o ponto e vírgula final", () => {
  const v1 = assinar(`id:${ID};request-id:${RID};ts:${TS}`, "chave-certa");
  assert.equal(
    descobrirAssinatura(pedacos(v1), [{ rotulo: "segredo0", valor: "chave-certa" }]),
    "segredo0 / id0+rid",
  );
});

test("acha quando o manifesto não tem o request-id", () => {
  const v1 = assinar(`id:${ID};ts:${TS};`, "chave-certa");
  assert.equal(
    descobrirAssinatura(pedacos(v1), [{ rotulo: "segredo0", valor: "chave-certa" }]),
    "segredo0 / id0+;",
  );
});

test("acha quando a assinatura vem em base64 em vez de hex", () => {
  const v1 = assinar(`id:${ID};request-id:${RID};ts:${TS};`, "chave-certa", "base64");
  assert.equal(
    descobrirAssinatura(pedacos(v1), [{ rotulo: "segredo0", valor: "chave-certa" }]),
    "segredo0 / id0+rid+; / base64",
  );
});

test("diz qual das chaves cadastradas foi a usada", () => {
  const v1 = assinar(`id:${ID};request-id:${RID};ts:${TS};`, "a-segunda");
  assert.equal(
    descobrirAssinatura(pedacos(v1), [
      { rotulo: "segredo0", valor: "a-primeira" },
      { rotulo: "segredo1", valor: "a-segunda" },
    ]),
    "segredo1 / id0+rid+;",
  );
});

test("não inventa combinação quando nenhuma bate", () => {
  const v1 = assinar(`id:${ID};request-id:${RID};ts:${TS};`, "chave-que-ninguem-tem");
  assert.equal(
    descobrirAssinatura(pedacos(v1), [{ rotulo: "segredo0", valor: "chave-certa" }]),
    null,
  );
});

test("ignora chave vazia sem quebrar", () => {
  const v1 = assinar(`id:${ID};request-id:${RID};ts:${TS};`, "chave-certa");
  assert.equal(
    descobrirAssinatura(pedacos(v1), [
      { rotulo: "vazia", valor: "" },
      { rotulo: "segredo0", valor: "chave-certa" },
    ]),
    "segredo0 / id0+rid+;",
  );
});
