# CLAUDE.md — contexto do projeto

## O que é

**Clan Maromba** — plataforma própria de lives pagas de um criador de conteúdo.
Ele transmite pelo OBS (RTMP), cada live é um evento avulso com preço próprio
(faixa típica R$ 10–30), pagamento via Mercado Pago Checkout Pro (Pix/cartão),
acesso individual com sessão única, player HLS com tokens assinados (~5 min) e
marca d'água dinâmica. Especificação completa: `docs/especificacao.md`.
Decisões técnicas já verificadas na doc oficial: `docs/arquitetura.md`.

## Sobre o dono do projeto

**O dono não programa.** Ao trabalhar aqui:
- Explique tudo em português simples, um passo de cada vez.
- Tome as decisões técnicas por ele (justificando em 1 frase quando importante).
- Instruções de painel/serviço devem dizer exatamente onde clicar e onde colar.
- Nunca coloque chaves/segredos no código — só variáveis de ambiente.
- Ao final de cada etapa, mostre como testar antes de seguir.

## Onde paramos (atualize esta seção ao avançar)

**O código da Fase 1 está mesclado na `main` e no ar** (login, painel, compra,
webhook, player, marca d'água, sessão única, auditoria, limite de tentativas).
O que falta é **configuração**, não programação. O caminho está em
`docs/fase-1-ligar-tudo.md` — 6 passos, cada um com teste.

Situação em 14/08/2026, fim da manhã: **falta só a Cloudflare**. Supabase e
Mercado Pago (token + segredo do webhook) estão preenchidos e valendo em
produção. As 3 variáveis da Cloudflare e as 2 da chave de assinatura são as
únicas vazias — e é por isso que ninguém consegue assistir ainda.

Ordem de dependência (não dá para pular): Supabase → SQL do
`supabase/schema.sql` → virar admin → Mercado Pago → `MP_WEBHOOK_SECRET` →
Cloudflare Stream → chave de assinatura (gerada em `/admin/configuracao`).

Andamento:

- ✅ **Passo 1 (Vercel):** projeto importado e no ar. O dono criou uma conta
  Vercel separada (espaço "CLAN MAROMBA", plano Hobby) para não dividir a cota
  com os outros projetos dele (Praxis e Autoedito). Pendências conhecidas:
  (a) confirmar se o Praxis/Autoedito perderam o auto-deploy — a Vercel amarra
  uma conta GitHub a uma conta Vercel por vez e desvincula a anterior em
  silêncio; (b) o plano Hobby **proíbe uso comercial** (vender ingresso conta
  como comercial), então antes do lançamento é preciso ir para Vercel Pro
  (US$ 20/mês) ou migrar o site para Cloudflare Workers + OpenNext
  (US$ 0–5/mês, uso comercial permitido, e ele já será cliente Cloudflare por
  causa do Stream — esta é a recomendação).
- ✅ **Supabase (chaves)** — projeto `mkzsizdhkgqfhsngenoc`, 3 chaves coladas,
  `/status` verde
- ✅ **Supabase (banco)** — schema rodado, dono é admin. O SQL faz backfill de
  `auth.users` para `perfis`, então rodar depois de já ter conta funciona.
- ✅ **Mercado Pago** — Access Token de teste (`TEST-`) cadastrado
- ✅ **Webhook do MP** — `MP_WEBHOOK_SECRET` cadastrado
- ⬜ **Cloudflare Stream** — 3 chaves (é o passo pago, US$ 5)
- ⬜ **Chave de assinatura** — 2 valores, gerados em `/admin/configuracao`
- 🔄 **Domínio próprio** — `misterolympia2026.online`, comprado em 05/09/2026
  **pela própria Vercel**, então o DNS já é dela e já resolve. Passo a passo em
  `docs/dominio-proprio.md`. **No código não muda nada**: o site descobre o
  endereço por `NEXT_PUBLIC_SITE_URL` e mais nada. O trabalho é em 3 painéis —
  Vercel (ligar o domínio ao projeto + variável + redeploy), Supabase (Site URL
  e Redirect URLs, senão o link de e-mail quebra) e Mercado Pago (URL do
  webhook nas duas abas). O login com Google **não** precisa de ajuste: ele
  volta pelo endereço do Supabase, que não mudou.
  **Não mover o DNS para a Cloudflare.** Foi considerado em 05/09/2026 para
  juntar tudo num painel só, e descartado: o Stream não precisa do domínio lá
  (o vídeo sai de `customer-XXXX.cloudflarestream.com`, que é da conta), e
  trocar nameserver perto do evento arrisca deixar o site fora do ar sem ganho
  nenhum. Se a Cloudflare pedir para apagar `ns1/ns2.vercel-dns.com`, é isso
  que tira o site do ar.

Notas de ambiente (revisado em 14/08/2026): `api.vercel.com` **não está mais
bloqueado** — o 403 que aparecia era a própria Vercel dizendo "falta token", não
o proxy. Com um token de API da Vercel dá para ler e escrever (criar/apagar
variável de ambiente, disparar redeploy). Mesmo assim, **a regra continua sendo
cadastrar as chaves à mão no painel**: token e segredos não devem passar pelo
chat. O conector oficial da Vercel (MCP) segue disponível e é somente leitura
(times, projetos, deployments, logs de build) — use ele para conferir estado.

Decisão do dono (14/08/2026): ele criou um token de API da Vercel e optou por
mantê-lo ativo até o projeto terminar, ciente de que ficou registrado no
histórico do chat. Ele deve ser revogado em
<https://vercel.com/account/tokens> no fim do projeto. Isso **não muda** a
regra das outras chaves: Supabase, Mercado Pago e Cloudflare continuam sendo
coladas só no painel da Vercel.

Dados úteis da conta Vercel (não são segredo): time `CLAN MAROMBA`,
slug `clan-maromba`, id `team_zig0KwdVAkpx5eQnHvEWCmqX`; projeto `clan-maromba`,
id `prj_5js4m3DfI4nNQQgQ6jdWxYIm9JBv`, framework Next.js. As 9 chaves da Fase 0
já existem como variáveis do tipo *sensitive* no projeto (a API não devolve o
valor, então só o painel ou o `/status` diz se estão preenchidas).

## Fases (aprovação do dono entre elas)

- **Fase 0 (concluída no código):** esqueleto + página `/status` +
  guia `docs/fase-0-configuracao.md`.
- **Fase 1 (código pronto, aguardando as chaves):** cadastro/login (Supabase) →
  página da live com compra → Checkout Pro em teste → liberação via webhook
  assinado → player HLS.js com token assinado renovável → marca d'água →
  sessão única → admin (criar live, ver RTMP+key, no ar/encerrada, compradores,
  banir/derrubar) → logs de auditoria. Termina com o teste de ponta a ponta
  descrito em `docs/fase-1-ligar-tudo.md`.
- **Fase 2:** replay pago, cupons, e-mail de confirmação, chat, home com agenda.
- **Fase 3:** credenciais MP de produção, domínio próprio (comprado —
  `misterolympia2026.online`, ver `docs/dominio-proprio.md`), checklist do dia
  da live (OBS: resolução/bitrate/keyframe, abrir/encerrar, plano B).

## Segurança — inegociável

- Acesso liberado SOMENTE via webhook do MP com assinatura `x-signature`
  validada (nunca pelo redirect de volta). A única exceção é a **cortesia**
  (`liberarCortesia`, em `src/app/admin/acoes.ts`): admin logado, valor
  gravado como zero — para não virar faturamento — e linha de auditoria
  dizendo quem liberou para quem.
  A segunda exceção é **"Conferir pagamento"** (`conferirPagamento`): o painel
  pergunta ao Mercado Pago, com o nosso access token, se aquela compra foi
  paga. Não precisa de assinatura porque não há terceiro na conversa — a
  resposta vem do MP pela nossa credencial. Exige admin, confere o valor e
  deixa auditoria. É a rede de segurança do dia da live: se o aviso não
  chegar, o comprador que pagou não fica na porta.
  A terceira é o **resgate do próprio webhook**: quando a assinatura não
  confere, a rota trata o aviso como palpite e PERGUNTA ao Mercado Pago, com
  o nosso token, o que houve com aquele pagamento. Quem autoriza é a resposta
  dele, não a chamada recebida. Nunca deixa uma compra paga cair para
  "pendente" (leitura atrasada cortaria quem pagou), e tem limite por IP para
  o endereço não virar sonda.
- **Reembolso e contestação cortam o acesso na hora**: `refunded` e
  `charged_back` derrubam a compra e apagam a sessão ativa, então o player
  para no próximo heartbeat (30 s) em vez de esperar o token vencer.
  Já uma tentativa RECUSADA não derruba compra paga — as duas tentativas
  carregam a mesma `external_reference`, e sem essa trava o aviso da que
  falhou tirava o acesso de quem tinha pago na segunda.
- RLS em todas as tabelas do Supabase.
- Stream key só no painel admin.
- Token de reprodução só para sessão ativa + compra confirmada da live.
- Rate limiting em login, compra e emissão de token.

Auditoria completa em `docs/seguranca.md` (14/08/2026): o que foi testado, os
6 problemas corrigidos e as 4 pendências que dependem do dono. Ao mexer em
`src/lib/destino.ts`, no webhook do MP ou nos cabeçalhos de `next.config.ts`,
rode `npm test` — essas partes têm teste justamente por serem trava.

## Webhook do Mercado Pago — o que custou uma madrugada (01/09/2026)

O teste de ponta a ponta travou com o pagamento aprovado e o acesso nunca
liberado, e a caçada rendeu três coisas que não podem se perder:

- **Não mande `notification_url` na preferência.** Pedir o aviso dentro da
  cobrança abre um segundo caminho de notificação (formatos antigos,
  `topic=payment` e `topic=merchant_order`) que **não** vem assinado com o
  segredo do painel. O aviso tem de vir só pelo webhook cadastrado no painel
  do MP — nas duas abas, Modo teste e Modo produção, com o evento
  "Pagamentos" marcado.
- **As credenciais de TESTE não são da conta do dono.** O `donoDoTokenMP`
  registrado foi `3616411194 (TESTUSER3714588127755058814)`: o Access Token
  de teste pertence a um usuário de teste que o MP cria junto. O pagamento é
  processado por essa conta, e o aviso dela é assinado com um segredo que não
  é o do painel do dono — por isso a **simulação do painel devolvia 200 e a
  compra devolvia 401**, no mesmo código e com o mesmo segredo. Não há o que
  consertar no código; em produção, com a conta do dono, os dois lados batem.
- **Erro de assinatura não pode ser mudo.** Quando a validação falha,
  `src/lib/mp-diagnostico.ts` testa as chaves plausíveis contra os formatos
  plausíveis (hex e base64) e registra o RÓTULO da que bate — e a rota
  registra `quemMandou` × `donoDoNossoToken`. Sem isso, chave errada, formato
  errado e conta errada dão o mesmo 401 e a única saída é adivinhar. Foram
  duas hipóteses erradas antes disso existir.

`MP_WEBHOOK_SECRET` aceita **vários segredos separados por vírgula**: alternar
entre teste e produção deixa de poder derrubar a liberação de acesso.

**Três chaves passaram pelo chat e precisam ser trocadas** antes de vender
ingresso de verdade:

1. **Token de API da Vercel** (14/08/2026) — dá para trocar
   `MP_ACCESS_TOKEN` e desviar todo o pagamento.
2. ***Secret key* do Supabase** (14/08/2026) — dá para ler e alterar o banco
   inteiro.
3. **Assinatura secreta do webhook do MP** (01/09/2026, num print) — dá para
   forjar um aviso de pagamento e liberar acesso sem pagar. Troca no botão ↻
   ao lado do campo, no painel do MP, e recadastra na Vercel.

O topo de `docs/seguranca.md` tem o passo a passo.

## Quanto o site aguenta (medido em 01/09/2026)

Durante uma transmissão, cada pessoa assistindo pede ao servidor:

| O que | Intervalo | Por hora |
|---|---|---|
| Heartbeat (sessão única) | 30 s | 120 |
| Token do vídeo | 3min30 | 17 |
| Chat, receber | — | 0 (vem do Realtime) |

**O vídeo não passa pela Vercel** — vai da Cloudflare direto para quem
assiste. O chat, ao receber, também não: chega pelo Realtime do Supabase.

Com 500 pessoas: ~17 pedidos por segundo, ~315 mil chamadas nas 5 horas das
finais. Cabe no plano Pro da Vercel (1 milhão/mês incluído; o excedente é da
ordem de US$ 0,60 por milhão).

O gargalo NÃO é a Vercel: é o banco. Cada heartbeat é uma consulta ao
Supabase, então o intervalo do heartbeat é o que governa a carga do dia.
Antes eram 10 s — três vezes mais tráfego — e foi por isso que subiu para
30 s. Se um dia precisar de mais fôlego, é esse número que se mexe primeiro
(`SEGUNDOS_ENTRE_HEARTBEATS`, em `src/components/Player.tsx`).

O cache de "está no ar?" (`SEGUNDOS_DE_CACHE`, em `src/lib/cloudflare.ts`)
existe pelo mesmo motivo, com um limite diferente: a API da Cloudflare tem
teto próprio de chamadas, e o cache vive em cada instância do servidor — num
dia cheio a Vercel sobe várias, e cada uma pergunta por conta própria.

## Comandos

```bash
npm run dev        # desenvolvimento
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # testes (node:test via tsx, pasta testes/)
npm run build      # build de produção
```

CI roda lint + typecheck + testes + build em todo push
(`.github/workflows/ci.yml`). O teste que existe hoje cobre a validação da
assinatura do webhook do Mercado Pago — é a trava que separa acesso pago de
acesso de graça, então não mexa nela sem rodar `npm test`.

## Convenções

- Todo texto voltado ao usuário em pt-BR; código/identificadores em pt-BR
  simples (já usado em `src/lib/env.ts` e `src/lib/checks.ts`).
- Tema escuro fixo, mobile-first; tokens de cor em `src/app/globals.css`.
- A página `/status` nunca exibe valores de chaves — só "ok/erro/faltando".
  Ela se tranca sozinha assim que existe um admin em `perfis` (antes disso
  precisa ficar aberta, senão o dono não consegue conferir o Supabase no
  passo que justamente cria o admin).
- Nada que seja segredo entra em tabela lida pelo navegador: a stream key mora
  em `lives_privado`, que **não tem nenhuma policy de RLS** — só o servidor
  (chave service_role) enxerga.

## Mapa do código (Fase 1)

- `supabase/schema.sql` — tabelas, RLS e a função de limite de tentativas.
  É o arquivo que o dono cola no SQL Editor.
- `src/lib/config.ts` — lê as env vars e expõe os `xConfigurado`. Nenhuma tela
  quebra quando falta chave: elas checam esses booleanos e mostram aviso.
- `src/lib/supabase/` — três clientes: `navegador`, `servidor` (respeita RLS) e
  `admin` (service_role, só no servidor).
- `src/proxy.ts` — o antigo middleware (renomeado no Next 16); renova a sessão.
- `src/lib/sessao.ts` — sessão única (cookie `cm_sessao` × linha no banco).
- `src/lib/cloudflare.ts` — cria live input, assina o JWT RS256, consulta se o
  OBS está conectado.
- `src/lib/mercadopago.ts` — cria a preferência e **valida a assinatura** do
  webhook (a trava que impede liberar acesso de graça).
- `src/app/api/webhooks/mercadopago/route.ts` — única rota que libera acesso.
- `src/app/api/token/route.ts` — emite o token de 5 min do player.
- `src/components/Player.tsx` — HLS.js com loader que troca o token a cada
  pedido, heartbeat de sessão e marca d'água que se recria se for removida.
- `src/lib/ao-vivo.ts` — decide se uma live está no ar. **Não existe botão
  "No ar" no painel**: quem responde é a Cloudflare (`estaTransmitindo`, com
  cache de 10 s). O painel só alterna `rascunho` × `anunciada`. Decisão do dono
  em 14/08/2026 — esquecer de clicar um botão no dia da live deixaria todos os
  compradores na porta. `encerrada` continua existindo e é ajustado direto no
  banco; `no_ar` gravado à mão no banco funciona como liberação manual de
  emergência.

Apagar live existe no painel (`apagarLive`), mas **recusa quando há compra
`aprovada` ou `reembolsada`** — o registro de quem pagou tem de sobreviver à
live. Para tirar de venda uma live já vendida, marcar `encerrada` no banco.
Apagar também remove o live input na Cloudflare, para não deixar órfão.

## Entrar com Google

Existe ao lado do e-mail e senha, não no lugar. Quem entra pelo Google não
tem senha para esquecer nem e-mail de confirmação para esperar — some o
motivo da maior parte do suporte no dia da live. Mas **só Google barraria
quem não tem conta Google** (Hotmail, Outlook, iCloud), e em evento avulso
cada pessoa barrada é uma venda que não volta.

O caminho de volta é o mesmo `/auth/confirmar`, que já trocava `code` por
sessão. O que diferencia é `?fluxo=google`: com ele a rota registra
`login_google` e manda a pessoa direto para onde estava, em vez da tela de
"conta confirmada".

Dois detalhes que mordem calado:

- **O nome vem em campo diferente.** O nosso formulário grava `nome`; o
  Google manda `full_name`. O gatilho de `perfis` lê os dois (e `name`),
  senão todo mundo do Google vira "Sem nome" na lista de compradores e no
  chat.
- **Banimento tem de ser conferido no callback também.** O login por e-mail
  já conferia; sem a mesma checagem em `/auth/confirmar`, bastava entrar pelo
  Google para o banimento deixar de valer.

## Contas: confirmação de e-mail e recuperação de senha

`/auth/confirmar` é onde caem TODOS os links que o Supabase manda por e-mail.
Aceita as duas formas que ele usa (`code` → `exchangeCodeForSession`, ou
`token_hash` + `type` → `verifyOtp`); a segunda é a que funciona quando a
pessoa cadastra no computador e confirma pelo celular. Sempre termina numa
tela nossa: `/auth/pronto` no caso normal, `/nova-senha` quando o tipo é
`recovery`. Link vencido também cai em `/auth/pronto?estado=falhou`, nunca
numa página em branco.

O `signUp` precisa mandar `emailRedirectTo` apontando para lá, senão o
Supabase usa o endereço dele mesmo e a pessoa acha que deu errado.

Trocar a senha chama `abrirSessaoUnica` de novo — é o que derruba quem
estivesse na conta com a senha antiga.

`pedirNovaSenha` responde **a mesma coisa** para e-mail que existe e que não
existe. Se a resposta mudasse, o formulário viraria uma forma de descobrir
quem é cliente do dono.

**Configuração no Supabase** (Authentication → URL Configuration): a
`Site URL` e a lista de `Redirect URLs` precisam conter o endereço do site,
senão o Supabase recusa o `emailRedirectTo` e ignora nossa tela.

## Como uma live guarda a data

`lives` tem três campos **todos opcionais**: `dia_inicio` (date), `dia_fim`
(date) e `hora` (time). Isso cobre "ainda não sei quando", "só o dia", "vários
dias" e "dias + horário" — o dono vende acesso antes de fechar a agenda.
`quandoAcontece()` em `src/lib/formato.ts` monta a frase e é coberta por
testes. Ela lê a data pelo texto, sem `new Date`, porque `new Date("2026-09-18")`
é meia-noite em UTC e viraria dia 17 no Brasil.

## Ingressos (vários produtos por live)

Uma live vende **vários ingressos** (tabela `ingressos`): passe completo e
"só o sábado" ao mesmo tempo. `src/lib/ingressos.ts` é o cérebro.

- **O preço nunca vem do navegador.** `comprarIngresso` recalcula com
  `precoAgora()` antes de criar a preferência no Mercado Pago, e o webhook
  ainda confere se o valor pago bate.
- **`preco_cheio_centavos` + `promocao_ate`** são o riscado e o contador. Passado
  o prazo, `precoAgora()` **passa a cobrar o preço cheio de verdade** — foi a
  condição para existir o riscado: preço fictício só de enfeite engana o
  comprador e é infração ao CDC. Sem `promocao_ate`, não há contador.
- **`inicia_em`/`termina_em` são instantes (timestamptz), não dias.** As finais
  do Olympia começam 22h de sábado e terminam de madrugada; cortar acesso à
  meia-noite seria o pior erro possível. Os dois nulos = passe completo.
- **`limite`** é o "restam N". Duas compras simultâneas na última vaga podem
  passar as duas — de propósito: vender uma a mais é melhor que recusar quem
  já pagou.
- Quem pode assistir agora é `temAcessoAgora()` (compra paga **e** janela
  aberta) — é o que `/api/token` pergunta. Compra antiga sem `ingresso_id`
  vale a live inteira.
- A **programação** (`blocos_programacao`) é informação do evento e vive
  separada dos ingressos. Era gerada a partir das janelas dos ingressos de
  dia; quando o dono passou a vender um ingresso único, a tabela de horários
  sumiria junto. Horário de evento é propaganda, não produto — e o schema faz
  backfill dos blocos a partir dos ingressos de dia que já existiam.

O evento do dono já está pronto para colar em `docs/mister-olympia-2026.md`.

## Bolão

Palpite no top 5 de cada categoria, com ranking por pontos. **É benefício de
quem tem ingresso**, não produto avulso.
`src/lib/bolao-pontos.ts` tem a conta (função pura, com teste) e
`src/lib/bolao.ts` o acesso ao banco.

- **Cada categoria é um bolão à parte, com ticket e prêmio próprios.** Um
  ticket vale uma categoria (`ingressos.categoria_bolao_id`); quem quer as
  três compra três. Por isso o **ranking é por categoria**
  (`rankingDaCategoria`) e não somado: somar faria quem comprou três disputar
  contra quem comprou um.
- **Palpitar exige as duas coisas**: ingresso da transmissão (o bolão é
  vinculado à live) e o ticket daquela categoria. Quem decide é
  `categoriasLiberadas`.
- **`conferenciaDaCategoria`** é a tela de conferência do dono: todo palpite
  com nome, e-mail e hora da última alteração, marcando quem mexeu depois de
  a categoria fechar ou depois de o resultado sair. Ele confere isso antes de
  pagar e devolve o dinheiro de quem entrou fora da hora. Vale o
  `atualizado_em`, não o `criado_em` — corrigir o palpite depois do resultado
  é o mesmo golpe que palpitar depois.
- **`vendasPorCategoria`** alimenta o painel com quantos tickets cada
  categoria vendeu. É informação de venda; o prêmio continua sendo fixo e
  anunciado antes, no campo `bolao_categorias.premio`.
- **O ingresso do bolão (`ingressos.so_bolao`) é produto à parte.** Ele dá
  direito a palpitar e **não abre o player** — a regra vive em
  `src/lib/ingressos-regras.ts`, com teste, porque ele não tem janela e sem
  essa checagem `ingressoValeAgora` o leria como passe completo, liberando a
  transmissão inteira por R$ 5. A vitrine, o painel e a home também o
  excluem do "passe completo" e do "a partir de".
- **O prêmio é fixo, anunciado antes e pago pelo dono.** É o que separa
  concurso de banca. Prêmio que é "o bolo arrecadado" não entra aqui. Cobrar
  entrada e pagar o vencedor com o bolo arrecadado é aposta: exige licença
  federal e é proibido pelos termos do Mercado Pago — o risco real é a conta
  que recebe os ingressos ser bloqueada. O dono pediu a versão paga duas
  vezes em 14/08/2026 (R$ 5 por entrada). Na terceira ele argumentou, como
  advogado, que vender ingresso de R$ 15 com bolão incluso e vender R$ 9,90 +
  R$ 5 à parte é a mesma troca — e está certo, desde que o prêmio seja fixo e
  sempre pago. Com isso o ingresso do bolão à parte foi construído.
- Quem libera o palpite é `comprouAlgumaCoisa`, e não `temAcessoAgora`: quem
  comprou só o domingo palpita na quinta, muito antes da janela dele abrir.
- **Pontuação**: 10 pelo campeão, 6 por outra posição exata, 2 por atleta
  certo fora de posição. Acerto parcial existe porque cravar o top 5 é quase
  impossível — sem ele, o mais provável é ninguém ganhar.
- **Palpite enviado nunca muda.** Decisão do dono, e é a regra que sustenta
  o bolão pago: poder editar até o fechamento abriria a brecha de palpitar
  cedo, esperar o resultado vazar e trocar a escolha. Quem quiser palpitar de
  novo compra outra entrada.
- **Cada ticket é UMA entrada** (`bolao_palpites.compra_id`, único). Três
  tickets do Open = três palpites concorrendo, e o ranking lista entradas,
  não pessoas — por isso a chave das linhas é `palpiteId`. Por isso também a
  unicidade `compras_uma_por_ingresso` saiu do banco: quem barra compra
  repetida de ingresso de assistir é `comprarIngresso`, que sabe distinguir
  os dois casos.
- **Empate no topo divide o prêmio** (`campeoes` + `fatiaDoPremio`, com
  teste). Empate é comum em bolão e premiar só o primeiro a palpitar seria
  arbitrário — o dono levantou isso e tinha razão. Como o prêmio anunciado é
  o teto, o custo dele não muda com a quantidade de campeões.
- `criado_em` do palpite **não muda** quando a pessoa corrige a escolha: ele
  ainda ordena a lista, e mexer nele puniria quem corrige.
- **`fecha_em`** trava a categoria. É o que impede palpitar já sabendo o
  resultado; o palpite pode ser corrigido quantas vezes quiser até lá.
- O ranking mostra nome abreviado (`apelidoPublico`) — a página é pública e
  ninguém se inscreveu para ter o nome inteiro exposto.
- Atleta só sai da lista enquanto não houver palpite: os palpites apontam
  para ele, e removê-lo apagaria a escolha de quem tinha palpitado.

## Loja

`/loja` é a vitrine única: ingresso da transmissão e entradas do bolão, por
live. Substituiu "Minhas lives" — `/minhas-lives` ficou como redirecionamento
permanente porque o endereço antigo saiu em e-mail de recuperação de senha.

A página é **pública**: quem ainda não tem conta precisa ver o preço antes de
se cadastrar, e por isso o link também saiu de dentro do bloco de logado no
cabeçalho. Quem já comprou vê "Meus acessos" no topo.

Os cartões do bolão não usam `ListaDeIngressos`: lá o `jaTenho` esconde o
botão, e ticket de bolão é justamente o que se compra de novo. Eles mostram
"Você tem N entradas" e o botão vira "Comprar outra".

## Chat ao vivo

Ao lado do player, só para quem tem acesso agora. Chega pelo **Realtime do
Supabase**: o navegador escuta `mensagens_chat` direto, então **a política de
RLS é a tranca de verdade** (só enxerga quem tem compra aprovada da live).
Escrever passa pelo servidor — o navegador nunca insere.

- `src/lib/chat-regras.ts` é puro e tem teste. A regra que mais importa é o
  **bloqueio de link**, incluindo disfarces ("site ponto com", caractere
  invisível): sem ela, alguém cola o endereço de uma transmissão pirata
  dentro da página que o dono vende. O admin escapa do filtro.
- **Modo lento** (`lives.chat_modo_lento`, padrão 5s) e limite por IP. São as
  defesas que funcionam sozinhas — no dia ele está comentando, não moderando.
- Apagar não deleta a linha, marca `apagada`. E a política **deixa ler
  mensagem apagada** de propósito: é assim que o aviso de exclusão chega ao
  navegador de quem já estava com ela na tela.
- `apelido` e `do_dono` ficam **gravados na mensagem**. O RLS de `perfis` só
  deixa cada um ver o próprio, então buscar o nome na hora deixaria a
  mensagem chegar sem autor.
- Silenciar (`chat_silenciados`) é castigo temporário por live — banir quem
  pagou ingresso é desproporcional e dá trabalho de reembolso.

Em `src/lib/config.ts`, as duas variáveis `NEXT_PUBLIC_` são lidas com o nome
**escrito literal**, e não pelo `ler()`: o Next só substitui
`process.env.NEXT_PUBLIC_ALGO` quando o nome aparece por extenso. Com acesso
dinâmico elas chegam vazias no navegador e o chat nunca recebe mensagem nova.
