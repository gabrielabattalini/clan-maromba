// A pontuação do bolão decide quem leva o prêmio. Se ela errar, o dono
// premia a pessoa errada na frente de todo mundo — e não tem como desfazer
// depois de anunciado ao vivo. Por isso ela é função pura e tem teste.
//
// Roda com: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

const {
  pontuar,
  acertosExatos,
  apelidoPublico,
  campeoes,
  categoriaAberta,
  fatiaDoPremio,
  topCinco,
  PONTOS_MAXIMOS_POR_CATEGORIA,
} =
  await import("@/lib/bolao-pontos");

// Cinco atletas, nomeados por letra para o teste ficar legível.
const [a, b, c, d, e, f] = ["a", "b", "c", "d", "e", "f"] as const;
const oficial = [a, b, c, d, e] as [string, string, string, string, string];

test("cravar o top 5 inteiro dá a pontuação máxima", () => {
  assert.equal(pontuar([a, b, c, d, e], oficial), PONTOS_MAXIMOS_POR_CATEGORIA);
  assert.equal(pontuar([a, b, c, d, e], oficial), 34);
});

test("errar tudo, com atletas de fora, dá zero", () => {
  assert.equal(pontuar([f, "g", "h", "i", "j"], oficial), 0);
});

test("acertar só o campeão vale 10", () => {
  assert.equal(pontuar([a, "g", "h", "i", "j"], oficial), 10);
});

test("acertar uma posição do meio vale 6", () => {
  assert.equal(pontuar(["g", "h", c, "i", "j"], oficial), 6);
});

test("atleta certo na posição errada vale 2", () => {
  assert.equal(pontuar([b, "g", "h", "i", "j"], oficial), 2);
});

test("o campeão vale mais que qualquer outra posição", () => {
  const soPrimeiro = pontuar([a, "g", "h", "i", "j"], oficial);
  const soSegundo = pontuar(["g", b, "h", "i", "j"], oficial);
  assert.ok(soPrimeiro > soSegundo);
});

test("top 5 certo na ordem trocada pontua, mas bem menos que cravar", () => {
  const invertido = pontuar([e, d, c, b, a], oficial);
  // c fica no lugar certo (posição 3), os outros quatro contam 2 cada.
  assert.equal(invertido, 6 + 2 * 4);
  assert.ok(invertido < PONTOS_MAXIMOS_POR_CATEGORIA);
});

test("conta os acertos exatos, que é o primeiro desempate", () => {
  assert.equal(acertosExatos([a, b, c, d, e], oficial), 5);
  assert.equal(acertosExatos([a, "g", c, "h", "i"], oficial), 2);
  assert.equal(acertosExatos([e, d, c, b, a], oficial), 1);
  assert.equal(acertosExatos(["g", "h", "i", "j", "k"], oficial), 0);
});

test("dois palpites com os mesmos pontos podem ter exatos diferentes", () => {
  // 10 + 2 + 2 = 14 de um lado; 6 + 6 + 2 = 14 do outro.
  const comCampeao = [a, c, b, "x", "y"] as [string, string, string, string, string];
  const semCampeao = ["x", b, c, "y", a] as [string, string, string, string, string];

  assert.equal(pontuar(comCampeao, oficial), 14);
  assert.equal(pontuar(semCampeao, oficial), 14);
  assert.ok(acertosExatos(semCampeao, oficial) > acertosExatos(comCampeao, oficial));
});

test("lê as cinco posições de uma linha do banco na ordem certa", () => {
  assert.deepEqual(
    topCinco({ atleta_1: a, atleta_2: b, atleta_3: c, atleta_4: d, atleta_5: e }),
    [a, b, c, d, e],
  );
});

test("a categoria fecha na hora marcada, nem antes nem depois", () => {
  const categoria = {
    id: "1",
    live_id: "1",
    nome: "Open",
    fecha_em: "2026-09-26T22:00:00-03:00",
    premio: "",
    ordem: 0,
    criado_em: "2026-08-01T00:00:00Z",
  };

  assert.equal(categoriaAberta(categoria, new Date("2026-09-26T21:59:00-03:00")), true);
  assert.equal(categoriaAberta(categoria, new Date("2026-09-26T22:00:00-03:00")), false);
  assert.equal(categoriaAberta(categoria, new Date("2026-09-26T22:01:00-03:00")), false);
});

test("o ranking público mostra o primeiro nome e a inicial do sobrenome", () => {
  assert.equal(apelidoPublico("Gabriel Battaglini", "g@x.com"), "Gabriel B.");
  assert.equal(apelidoPublico("Ana Paula de Souza", "a@x.com"), "Ana S.");
});

test("o ranking público nunca mostra o e-mail inteiro", () => {
  const apelido = apelidoPublico("", "gabrielbattaglini@gmail.com");
  assert.ok(!apelido.includes("@"));
  assert.ok(!apelido.includes("gmail"));
  assert.equal(apelido, "gab***");
});

test("quem não pôs nome ainda aparece com algum rótulo", () => {
  assert.equal(apelidoPublico("", ""), "Participante");
  assert.equal(apelidoPublico("Rafa", "r@x.com"), "Rafa");
});

test("campeão é todo mundo que empatou na maior pontuação", () => {
  const linhas = [
    { usuarioId: "a", pontos: 22 },
    { usuarioId: "b", pontos: 22 },
    { usuarioId: "c", pontos: 18 },
  ];
  assert.deepEqual(
    campeoes(linhas).map((l) => l.usuarioId),
    ["a", "b"],
  );
});

test("um só no topo é campeão sozinho", () => {
  const linhas = [
    { usuarioId: "a", pontos: 30 },
    { usuarioId: "b", pontos: 22 },
  ];
  assert.deepEqual(campeoes(linhas).map((l) => l.usuarioId), ["a"]);
});

test("ninguém pontuou, ninguém é campeão", () => {
  assert.deepEqual(campeoes([{ usuarioId: "a", pontos: 0 }]), []);
  assert.deepEqual(campeoes([]), []);
});

test("o prêmio anunciado é dividido entre os campeões", () => {
  assert.equal(fatiaDoPremio(30000, 1), 30000);
  assert.equal(fatiaDoPremio(30000, 5), 6000);
  assert.equal(fatiaDoPremio(30000, 50), 600);
});

test("sobra de centavo fica com quem paga, para nunca faltar", () => {
  // R$ 100 para 3 pessoas: 33,33 cada, e sobram 1 centavo.
  assert.equal(fatiaDoPremio(10000, 3), 3333);
  assert.equal(fatiaDoPremio(10000, 0), 0);
});
