// O token que destrava o vídeo é um JWT RS256 assinado com a chave que a
// Cloudflare entrega uma única vez. Se a assinatura ou os campos estiverem
// errados, o player não abre — e a descoberta seria no meio da live, com
// todo mundo que pagou esperando.
//
// Aqui geramos uma chave RSA nossa, no mesmo formato que a Cloudflare usa
// (JWK em base64), assinamos e conferimos com a chave pública.
//
// Roda com: npm test

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

import { importJWK, jwtVerify } from "jose";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const CHAVE_ID = "chave-de-teste-123";
const CODIGO_CLIENTE = "abc123def456";

// A Cloudflare devolve o JWK em base64 — é exatamente assim que o valor
// chega na variável de ambiente.
process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID = CHAVE_ID;
process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK = Buffer.from(
  JSON.stringify(privateKey.export({ format: "jwk" })),
).toString("base64");
process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = CODIGO_CLIENTE;

const { assinarTokenReproducao, enderecoDoManifesto } = await import("@/lib/cloudflare");

const UID_DA_LIVE = "1a2b3c4d5e6f7g8h9i0j";

async function conferir(token: string) {
  const chavePublica = await importJWK(publicKey.export({ format: "jwk" }), "RS256");
  return jwtVerify(token, chavePublica);
}

test("o token é assinado e a assinatura confere", async () => {
  const token = await assinarTokenReproducao(UID_DA_LIVE);
  const { payload } = await conferir(token);
  assert.equal(payload.sub, UID_DA_LIVE);
});

test("o cabeçalho traz o algoritmo e o id da chave que a Cloudflare espera", async () => {
  const token = await assinarTokenReproducao(UID_DA_LIVE);
  const { protectedHeader } = await conferir(token);
  assert.equal(protectedHeader.alg, "RS256");
  assert.equal(protectedHeader.kid, CHAVE_ID);
});

test("o id da chave também vai no corpo, como a Cloudflare exige", async () => {
  const token = await assinarTokenReproducao(UID_DA_LIVE);
  const { payload } = await conferir(token);
  assert.equal(payload.kid, CHAVE_ID);
});

test("vence em 5 minutos por padrão", async () => {
  const antes = Math.floor(Date.now() / 1000);
  const token = await assinarTokenReproducao(UID_DA_LIVE);
  const { payload } = await conferir(token);

  const validade = (payload.exp as number) - antes;
  assert.ok(validade > 280 && validade <= 300, `validade fora do esperado: ${validade}s`);
});

test("dá para pedir uma validade menor", async () => {
  const antes = Math.floor(Date.now() / 1000);
  const token = await assinarTokenReproducao(UID_DA_LIVE, 60);
  const { payload } = await conferir(token);

  const validade = (payload.exp as number) - antes;
  assert.ok(validade > 40 && validade <= 60, `validade fora do esperado: ${validade}s`);
});

test("um token de outra live não serve para esta", async () => {
  const token = await assinarTokenReproducao("outra-live-qualquer");
  const { payload } = await conferir(token);
  assert.notEqual(payload.sub, UID_DA_LIVE);
});

test("assinatura adulterada é recusada", async () => {
  const token = await assinarTokenReproducao(UID_DA_LIVE);
  const [cabecalho, corpo] = token.split(".");
  const falsificado = `${cabecalho}.${corpo}.${"A".repeat(342)}`;

  await assert.rejects(() => conferir(falsificado));
});

test("o token entra no caminho do endereço, não como parâmetro", async () => {
  const token = await assinarTokenReproducao(UID_DA_LIVE);
  const endereco = enderecoDoManifesto(token);

  assert.equal(
    endereco,
    `https://customer-${CODIGO_CLIENTE}.cloudflarestream.com/${token}/manifest/video.m3u8`,
  );
  assert.ok(!endereco.includes("?"), "não deve virar parâmetro de consulta");
});
