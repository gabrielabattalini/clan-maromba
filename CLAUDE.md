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

Situação das chaves em 14/08/2026 (conferida pela página `/status`):
**Supabase conectado** — `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` preenchidas e
funcionando. As 5 restantes (Cloudflare ×3, Mercado Pago ×2) continuam vazias.

Ordem de dependência (não dá para pular): Supabase → SQL do
`supabase/schema.sql` → virar admin → Mercado Pago → `MP_WEBHOOK_SECRET` →
Cloudflare Stream → chave de assinatura (gerada em `/admin/configuracao`).

Da Fase 0, o que já estava resolvido:

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
- ⬜ **Supabase (banco)** — rodar `supabase/schema.sql`, criar a conta do dono e
  o `update perfis set admin = true`. Ordem importa: as tabelas primeiro. O SQL
  faz backfill de `auth.users` para `perfis`, então uma conta criada antes de
  rodar o arquivo também ganha perfil.
- ⬜ **Mercado Pago** — Access Token de teste
- ⬜ **Webhook do MP** — `MP_WEBHOOK_SECRET`
- ⬜ **Cloudflare Stream** — 3 chaves (é o passo pago, US$ 5)
- ⬜ **Chave de assinatura** — 2 valores, gerados em `/admin/configuracao`

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
- **Fase 3:** credenciais MP de produção, domínio próprio, checklist do dia da
  live (OBS: resolução/bitrate/keyframe, abrir/encerrar, plano B).

## Segurança — inegociável

- Acesso liberado SOMENTE via webhook do MP com assinatura `x-signature`
  validada (nunca pelo redirect de volta).
- RLS em todas as tabelas do Supabase.
- Stream key só no painel admin.
- Token de reprodução só para sessão ativa + compra confirmada da live.
- Rate limiting em login, compra e emissão de token.

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
