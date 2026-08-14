// O chat roda enquanto o dono está comentando ao vivo — ele não vai estar
// moderando. Quem segura a bagunça são estas regras, sozinhas. A mais séria
// é o filtro de link: basta alguém colar o endereço de uma transmissão
// pirata para o público que pagou ir embora, dentro da página do próprio
// dono.
//
// Roda com: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

const { pareceLink, limparMensagem, estaGritando, avaliarMensagem, segundosDeEspera } =
  await import("@/lib/chat-regras");

test("pega link escrito do jeito normal", () => {
  assert.equal(pareceLink("olha https://pirata.com/olympia"), true);
  assert.equal(pareceLink("www.pirata.net"), true);
  assert.equal(pareceLink("entra no t.me/grupogratis"), true);
  assert.equal(pareceLink("chama no wa.me/5511999999999"), true);
});

test("pega link disfarçado, que é como as pessoas fogem do filtro", () => {
  assert.equal(pareceLink("pirata ponto com"), true);
  assert.equal(pareceLink("pirata (ponto) com"), true);
  assert.equal(pareceLink("pirata . com"), true);
  assert.equal(pareceLink("PIRATA.COM"), true);
});

test("pega link escondido com caractere invisível", () => {
  assert.equal(pareceLink("pirata​.com"), true);
});

test("não confunde conversa normal com link", () => {
  assert.equal(pareceLink("o Derek tá monstro hoje"), false);
  assert.equal(pareceLink("acho que o Hadi leva, mas o Nick tá gigante"), false);
  assert.equal(pareceLink("boa noite pessoal!"), false);
});

test("junta espaço e quebra de linha, para ninguém empurrar o chat", () => {
  assert.equal(limparMensagem("oi\n\n\n\n\n\n\n\ngente"), "oi gente");
  assert.equal(limparMensagem("   muito     bom   "), "muito bom");
});

test("corta mensagem gigante no limite", () => {
  assert.equal(limparMensagem("a".repeat(500)).length, 300);
});

test("reconhece grito só quando é grito mesmo", () => {
  assert.equal(estaGritando("VAMOOOO QUE É HOJE CARALHO"), true);
  assert.equal(estaGritando("VAI"), false); // curto: pode ser só empolgação
  assert.equal(estaGritando("O Derek está muito bem hoje"), false);
});

test("mensagem com link é recusada, com motivo", () => {
  const r = avaliarMensagem("assiste de graça em pirata.com", false);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.motivo, /Link/);
});

test("o dono pode mandar link — é ele que divulga o bolão no meio da live", () => {
  const r = avaliarMensagem("palpite em clanmaromba.com/bolao", true);
  assert.equal(r.ok, true);
});

test("mensagem vazia não passa", () => {
  assert.equal(avaliarMensagem("   ", false).ok, false);
  assert.equal(avaliarMensagem("\n\n", false).ok, false);
});

test("grito passa, mas com o tom abaixado", () => {
  const r = avaliarMensagem("VAMOOO QUE É HOJE PESSOAL", false);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.texto, "Vamooo que é hoje pessoal");
});

test("mensagem comum passa intacta", () => {
  const r = avaliarMensagem("o Samson tá com uma densidade absurda", false);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.texto, "o Samson tá com uma densidade absurda");
});

test("modo lento conta o tempo desde a última mensagem", () => {
  const agora = new Date("2026-09-26T23:00:10-03:00");
  const haDoisSegundos = "2026-09-26T23:00:08-03:00";

  assert.equal(segundosDeEspera(haDoisSegundos, 5, agora), 3);
  assert.equal(segundosDeEspera("2026-09-26T23:00:04-03:00", 5, agora), 0);
});

test("primeira mensagem nunca espera", () => {
  assert.equal(segundosDeEspera(null, 5), 0);
});

test("modo lento desligado libera todo mundo", () => {
  assert.equal(segundosDeEspera("2026-09-26T23:00:09-03:00", 0), 0);
});
