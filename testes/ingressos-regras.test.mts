// O ingresso do bolão custa poucos reais e não tem janela de acesso. Se a
// regra do player o tratasse como "sem janela = vale sempre", ele viraria um
// passe completo baratinho e abriria a transmissão inteira. É o buraco mais
// caro possível neste projeto, então tem teste.
//
// Roda com: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

const { daAcessoAoVideo, ingressoValeAgora } = await import("@/lib/ingressos-regras");

type Ingresso = Parameters<typeof daAcessoAoVideo>[0];

function ingresso(extra: Partial<Ingresso>): Ingresso {
  return {
    id: "i1",
    live_id: "l1",
    nome: "Ingresso",
    descricao: "",
    preco_centavos: 990,
    preco_cheio_centavos: null,
    promocao_ate: null,
    inicia_em: null,
    termina_em: null,
    limite: null,
    so_bolao: false,
    ordem: 0,
    ativo: true,
    criado_em: "2026-08-01T00:00:00Z",
    ...extra,
  };
}

const sabadoDeNoite = new Date("2026-09-26T23:00:00-03:00");

test("ingresso do bolão NUNCA abre o player, nem sem janela nenhuma", () => {
  const doBolao = ingresso({ so_bolao: true, preco_centavos: 500 });
  assert.equal(daAcessoAoVideo(doBolao, sabadoDeNoite), false);
});

test("ingresso do bolão não abre o player nem com janela aberta", () => {
  const esquisito = ingresso({
    so_bolao: true,
    inicia_em: "2026-09-24T00:00:00-03:00",
    termina_em: "2026-09-28T00:00:00-03:00",
  });
  assert.equal(daAcessoAoVideo(esquisito, sabadoDeNoite), false);
});

test("passe completo (sem janela) abre o player", () => {
  assert.equal(daAcessoAoVideo(ingresso({}), sabadoDeNoite), true);
});

test("ingresso de dia abre só dentro da janela dele", () => {
  const dia3 = ingresso({
    inicia_em: "2026-09-26T12:00:00-03:00",
    termina_em: "2026-09-27T05:00:00-03:00",
  });

  assert.equal(daAcessoAoVideo(dia3, sabadoDeNoite), true);
  // A final atravessa a madrugada: 2h de domingo ainda é o Dia 3.
  assert.equal(daAcessoAoVideo(dia3, new Date("2026-09-27T02:00:00-03:00")), true);
  // Antes de abrir e depois de fechar, não.
  assert.equal(daAcessoAoVideo(dia3, new Date("2026-09-26T11:59:00-03:00")), false);
  assert.equal(daAcessoAoVideo(dia3, new Date("2026-09-27T05:00:00-03:00")), false);
});

test("a janela sozinha continua valendo para quem não é do bolão", () => {
  const dia1 = ingresso({
    inicia_em: "2026-09-24T13:00:00-03:00",
    termina_em: "2026-09-25T00:00:00-03:00",
  });

  assert.equal(ingressoValeAgora(dia1, new Date("2026-09-24T20:00:00-03:00")), true);
  assert.equal(ingressoValeAgora(dia1, sabadoDeNoite), false);
});
