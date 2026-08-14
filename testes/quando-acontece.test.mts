// A frase de "quando acontece" precisa aguentar tudo em aberto: sem data, só
// o dia, vários dias, com ou sem horário. E não pode cair na armadilha do
// fuso — "2026-09-18" tem de aparecer como 18, nunca como 17.
//
// Roda com: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

const { quandoAcontece } = await import("@/lib/formato");

const ANO_ATUAL = new Date().getFullYear();
const proximoAno = ANO_ATUAL + 1;

function quando(dia_inicio: string | null, dia_fim: string | null, hora: string | null) {
  return quandoAcontece({ dia_inicio, dia_fim, hora });
}

test("sem nada preenchido, fica em aberto", () => {
  assert.equal(quando(null, null, null), "Data a definir");
});

test("só o horário, sem data", () => {
  assert.equal(quando(null, null, "21:00:00"), "Data a definir, a partir das 21h");
});

test("um dia só, sem horário", () => {
  assert.equal(quando(`${ANO_ATUAL}-09-18`, null, null), "18 de setembro");
});

test("não perde um dia por causa do fuso", () => {
  // new Date("2026-09-18") seria meia-noite em UTC = dia 17 no Brasil.
  assert.match(quando(`${ANO_ATUAL}-09-18`, null, null), /^18 de setembro/);
  assert.match(quando(`${ANO_ATUAL}-01-01`, null, null), /^1 de janeiro/);
});

test("um dia com horário redondo", () => {
  assert.equal(
    quando(`${ANO_ATUAL}-09-18`, null, "21:00:00"),
    "18 de setembro, a partir das 21h",
  );
});

test("um dia com horário quebrado", () => {
  assert.equal(
    quando(`${ANO_ATUAL}-09-18`, null, "21:30:00"),
    "18 de setembro, a partir das 21h30",
  );
});

test("vários dias no mesmo mês", () => {
  assert.equal(quando(`${ANO_ATUAL}-09-18`, `${ANO_ATUAL}-09-21`, null), "18 a 21 de setembro");
});

test("vários dias virando o mês", () => {
  assert.equal(
    quando(`${ANO_ATUAL}-09-28`, `${ANO_ATUAL}-10-02`, null),
    "28 de setembro a 2 de outubro",
  );
});

test("vários dias com horário", () => {
  assert.equal(
    quando(`${ANO_ATUAL}-09-18`, `${ANO_ATUAL}-09-21`, "14:00:00"),
    "18 a 21 de setembro, a partir das 14h",
  );
});

test("dia final igual ao inicial conta como um dia só", () => {
  assert.equal(quando(`${ANO_ATUAL}-09-18`, `${ANO_ATUAL}-09-18`, null), "18 de setembro");
});

test("mostra o ano quando não é o ano corrente", () => {
  assert.equal(
    quando(`${proximoAno}-03-10`, null, null),
    `10 de março de ${proximoAno}`,
  );
});

test("virada de ano mostra os dois anos", () => {
  assert.equal(
    quando(`${proximoAno}-12-30`, `${proximoAno + 1}-01-02`, null),
    `30 de dezembro de ${proximoAno} a 2 de janeiro de ${proximoAno + 1}`,
  );
});

test("data estranha não quebra a página", () => {
  assert.equal(quando("nao-e-uma-data", null, null), "Data a definir");
});
