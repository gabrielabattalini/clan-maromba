// Depois de entrar, o site manda a pessoa para onde diz o `?voltar=` da URL.
// Como esse valor vem de fora, ele é a porta de entrada do golpe clássico:
// um link com a nossa cara que, logo depois da senha digitada, joga a pessoa
// num site falso. Estes testes trancam essa porta.
//
// Roda com: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

const { destinoSeguro } = await import("@/lib/destino");

test("aceita caminho interno simples", () => {
  assert.equal(destinoSeguro("/minhas-lives"), "/minhas-lives");
});

test("aceita caminho interno com consulta", () => {
  assert.equal(destinoSeguro("/live/treino?pagamento=sucesso"), "/live/treino?pagamento=sucesso");
});

test("recusa endereço de outro site", () => {
  assert.equal(destinoSeguro("https://site-falso.com"), "/");
  assert.equal(destinoSeguro("http://site-falso.com"), "/");
});

test("recusa a forma com duas barras, que também é outro site", () => {
  assert.equal(destinoSeguro("//site-falso.com"), "/");
  assert.equal(destinoSeguro("//site-falso.com/entrar"), "/");
});

test("recusa a barra invertida — o navegador a converte em barra", () => {
  // "/\site-falso.com" vira "//site-falso.com" no navegador.
  assert.equal(destinoSeguro("/\\site-falso.com"), "/");
  assert.equal(destinoSeguro("/\\\\site-falso.com"), "/");
});

test("recusa tentativa de driblar com caractere de controle", () => {
  assert.equal(destinoSeguro("/\t/site-falso.com"), "/");
  assert.equal(destinoSeguro("/\n//site-falso.com"), "/");
  assert.equal(destinoSeguro("/ /site-falso.com"), "/");
});

test("recusa esquema embutido", () => {
  assert.equal(destinoSeguro("javascript:alert(1)"), "/");
  assert.equal(destinoSeguro("data:text/html,<script>"), "/");
});

test("recusa o que não é texto", () => {
  assert.equal(destinoSeguro(null), "/");
  assert.equal(destinoSeguro(undefined), "/");
  assert.equal(destinoSeguro(123), "/");
  assert.equal(destinoSeguro({ toString: () => "/admin" }), "/");
});

test("vazio cai na home", () => {
  assert.equal(destinoSeguro(""), "/");
  assert.equal(destinoSeguro("   "), "/");
});
