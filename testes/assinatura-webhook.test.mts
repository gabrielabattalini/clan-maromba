// A trava mais importante do sistema: sem ela, qualquer pessoa poderia
// chamar /api/webhooks/mercadopago fingindo um pagamento aprovado e assistir
// de graça. Este teste garante que só passa o que o Mercado Pago assinou.
//
// Roda com: npm test

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

const SEGREDO = "segredo-de-teste-abc123";
// O Mercado Pago tem um segredo para o modo teste e outro para produção, e o
// dono alterna entre os dois. Os dois ficam cadastrados, separados por
// vírgula — é isso que a lista abaixo representa.
const OUTRO_SEGREDO = "segredo-do-modo-producao-xyz";
process.env.MP_WEBHOOK_SECRET = `${SEGREDO}, ${OUTRO_SEGREDO}`;

const { assinaturaValida } = await import("@/lib/mercadopago");

const ID_DADO = "1234567890";
const ID_REQUISICAO = "req-abc-999";
const TS = "1704908010";

/** Monta o cabeçalho x-signature como o Mercado Pago manda. */
function cabecalho(manifesto: string, ts = TS, segredo = SEGREDO): string {
  const v1 = createHmac("sha256", segredo).update(manifesto).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

const MANIFESTO_COMPLETO = `id:${ID_DADO};request-id:${ID_REQUISICAO};ts:${TS};`;

test("aceita a assinatura correta", () => {
  assert.equal(
    assinaturaValida(cabecalho(MANIFESTO_COMPLETO), ID_REQUISICAO, ID_DADO),
    true,
  );
});

test("aceita quando não veio x-request-id (o segmento some do manifesto)", () => {
  const manifesto = `id:${ID_DADO};ts:${TS};`;
  assert.equal(assinaturaValida(cabecalho(manifesto), null, ID_DADO), true);
});

test("compara o id do pagamento em minúsculas", () => {
  const idMisto = "AbCdEf123";
  const manifesto = `id:${idMisto.toLowerCase()};request-id:${ID_REQUISICAO};ts:${TS};`;
  assert.equal(assinaturaValida(cabecalho(manifesto), ID_REQUISICAO, idMisto), true);
});

test("recusa quando não veio cabeçalho de assinatura", () => {
  assert.equal(assinaturaValida(null, ID_REQUISICAO, ID_DADO), false);
});

test("recusa um v1 inventado", () => {
  assert.equal(
    assinaturaValida(`ts=${TS},v1=${"0".repeat(64)}`, ID_REQUISICAO, ID_DADO),
    false,
  );
});

test("recusa assinatura feita com outro segredo", () => {
  assert.equal(
    assinaturaValida(
      cabecalho(MANIFESTO_COMPLETO, TS, "segredo-errado"),
      ID_REQUISICAO,
      ID_DADO,
    ),
    false,
  );
});

test("recusa reaproveitar a assinatura para outro pagamento", () => {
  assert.equal(
    assinaturaValida(cabecalho(MANIFESTO_COMPLETO), ID_REQUISICAO, "9999999999"),
    false,
  );
});

test("recusa quando o ts foi adulterado", () => {
  const assinatura = cabecalho(MANIFESTO_COMPLETO).replace(`ts=${TS}`, "ts=1704999999");
  assert.equal(assinaturaValida(assinatura, ID_REQUISICAO, ID_DADO), false);
});

test("recusa cabeçalho sem v1", () => {
  assert.equal(assinaturaValida(`ts=${TS}`, ID_REQUISICAO, ID_DADO), false);
});

test("recusa v1 de tamanho diferente sem quebrar", () => {
  assert.equal(assinaturaValida(`ts=${TS},v1=abc`, ID_REQUISICAO, ID_DADO), false);
});

// ------------------------------------------------------------
// O id do pagamento chega em lugares diferentes conforme o aviso
// (?data.id= na URL, ?id= na URL, ou dentro do corpo). O Mercado Pago
// assinou UM deles; conferir o errado dá 401 igualzinho a segredo errado.
// ------------------------------------------------------------

test("aceita quando o id assinado foi o da URL e o corpo trouxe outro", () => {
  assert.equal(
    assinaturaValida(cabecalho(MANIFESTO_COMPLETO), ID_REQUISICAO, [
      ID_DADO,
      "id-diferente-do-corpo",
    ]),
    true,
  );
});

test("aceita quando o id assinado veio depois na lista", () => {
  assert.equal(
    assinaturaValida(cabecalho(MANIFESTO_COMPLETO), ID_REQUISICAO, [
      null,
      "outro",
      ID_DADO,
    ]),
    true,
  );
});

test("recusa quando nenhum dos candidatos é o id assinado", () => {
  assert.equal(
    assinaturaValida(cabecalho(MANIFESTO_COMPLETO), ID_REQUISICAO, ["111", "222"]),
    false,
  );
});

// A trava dentro da trava: assinatura sem id só vale quando id nenhum veio.
// Se valesse sempre, uma assinatura capturada serviria para aprovar qualquer
// outro pagamento — bastaria trocar o data.id.
test("não aceita manifesto sem id quando algum id veio na requisição", () => {
  const semId = `request-id:${ID_REQUISICAO};ts:${TS};`;
  assert.equal(assinaturaValida(cabecalho(semId), ID_REQUISICAO, [ID_DADO]), false);
});

test("aceita manifesto sem id quando id nenhum veio", () => {
  const semId = `request-id:${ID_REQUISICAO};ts:${TS};`;
  assert.equal(assinaturaValida(cabecalho(semId), ID_REQUISICAO, [null, null]), true);
});

// ------------------------------------------------------------
// Vários segredos ao mesmo tempo
// ------------------------------------------------------------
// Cadastrar os dois tira o risco de trocar a credencial do Mercado Pago e
// esquecer o segredo: a troca deixaria de liberar acesso, sem nenhuma pista.

test("aceita assinatura feita com o segundo segredo cadastrado", () => {
  assert.equal(
    assinaturaValida(
      cabecalho(MANIFESTO_COMPLETO, TS, OUTRO_SEGREDO),
      ID_REQUISICAO,
      ID_DADO,
    ),
    true,
  );
});

test("continua aceitando o primeiro", () => {
  assert.equal(
    assinaturaValida(cabecalho(MANIFESTO_COMPLETO), ID_REQUISICAO, ID_DADO),
    true,
  );
});

test("recusa um terceiro segredo, que não foi cadastrado", () => {
  assert.equal(
    assinaturaValida(
      cabecalho(MANIFESTO_COMPLETO, TS, "segredo-que-ninguem-cadastrou"),
      ID_REQUISICAO,
      ID_DADO,
    ),
    false,
  );
});
