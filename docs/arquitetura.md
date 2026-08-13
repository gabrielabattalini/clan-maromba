# Arquitetura — Clan Maromba (plataforma de lives pagas)

Decisões técnicas e fatos verificados na documentação oficial em **12/08/2026**
(Cloudflare Stream e Mercado Pago). Este arquivo é a referência de implementação
das Fases 1–3; se algo aqui conflitar com a doc atual na hora de implementar,
a doc atual vence e este arquivo deve ser atualizado.

## Visão geral

- **Site:** Next.js (App Router, TypeScript), deploy na Vercel.
- **Login/banco:** Supabase (e-mail/senha), RLS em todas as tabelas.
- **Vídeo:** Cloudflare Stream Live — ingest RTMPS do OBS, playback HLS com
  tokens assinados.
- **Pagamento:** Mercado Pago Checkout Pro (Pix + cartão), liberação de acesso
  somente via webhook com assinatura verificada.

## Cloudflare Stream — decisões

1. **Um live input por live** (evento avulso), criado pelo painel admin via
   `POST /accounts/{account}/stream/live_inputs` com:
   ```json
   {
     "meta": { "name": "<título da live>" },
     "recording": { "mode": "automatic", "requireSignedURLs": true, "timeoutSeconds": 60 },
     "preferLowLatency": true
   }
   ```
   - `recording.mode: "automatic"` é obrigatório para playback HLS e habilita a
     gravação para o replay (Fase 2).
   - `recording.requireSignedURLs: true` **vale para o playback ao vivo** quando
     se assiste pelo *live input ID* (confirmado na doc "Watch a live stream") e
     é herdado pelas gravações.
   - `preferLowLatency: true` (LL-HLS, beta, ~3 s de latência). A combinação
     LL-HLS + token assinado **não é documentada** — validar em staging; se não
     funcionar, o fallback é HLS padrão (<10 s) sem mudar arquitetura.
   - A resposta traz `rtmps.url` + `rtmps.streamKey` → exibidos **só no admin**
     para colar no OBS.
2. **Playback pelo live input ID** (fixo por live):
   `https://customer-{CODE}.cloudflarestream.com/{TOKEN}/manifest/video.m3u8`
   — o **token JWT substitui o UID no path** (não é query param).
3. **Player próprio (HLS.js) num `<video>` nosso — não o iframe da Cloudflare.**
   Motivos: o iframe não permite sobrepor a marca d'água (DOM inacessível), e o
   watermark nativo do Stream **não funciona em lives**. HLS.js + overlay de
   marca d'água por cima do `<video>` é o caminho suportado (exemplo oficial
   `stream/examples/hls-js`). Não cachear manifests.
4. **Tokens assinados: auto-assinados com signing key** (não o endpoint
   `/token`, que é rate-limited e recomendado só para <1.000 tokens/dia):
   - Criar 1 vez: `POST /accounts/{account}/stream/keys` → `{id, pem, jwk}`
     (base64, exibidos uma única vez → guardar como env vars
     `CLOUDFLARE_STREAM_SIGNING_KEY_ID` / `CLOUDFLARE_STREAM_SIGNING_KEY_JWK`
     na Fase 1).
   - JWT RS256, header `{alg: "RS256", kid}`, claims:
     `{sub: <input_uid>, kid, exp: agora+5min, accessRules: [...]}`.
   - Emitido pela rota `/api/token` apenas para: usuário logado + sessão ativa
     única + compra `approved` daquela live. Renovação automática pelo player
     antes de expirar.
5. **Descobrir se a live está no ar:** webhooks de Notifications
   (`live_input.connected` / `disconnected`, header `cf-webhook-auth`) e/ou
   `GET https://customer-{CODE}.cloudflarestream.com/{input}/lifecycle`.
6. **Replay (Fase 2):** `GET .../live_inputs/{uid}/videos`, usar o vídeo
   `ready` (herda `requireSignedURLs`); token com `sub` = video UID.
7. **Custos:** ingest grátis; entrega US$ 1/1.000 min assistidos; armazenamento
   US$ 5/1.000 min (pré-pago). `deleteRecordingAfterDays` (mín. 30) para
   limpar gravações antigas.
8. **OBS (Fase 3, checklist):** H.264 + AAC, keyframe/GOP 2–4 s, sem B-frames
   para LL-HLS.

## Mercado Pago — decisões

1. **Checkout Pro** com SDK oficial `mercadopago` (v3, Node ≥18):
   `new Preference(client).create(...)` com `items` (BRL), `external_reference`
   = id da compra no nosso banco, `back_urls` (HTTPS), `auto_return:
   "approved"`, `payment_methods.excluded_payment_types: [{id: "ticket"}]`
   (sem boleto), `notification_url` apontando para `/api/webhooks/mercadopago`.
   Redirecionar o comprador para `init_point` (com credenciais de teste o
   próprio `init_point` já abre o sandbox — **não usar** `sandbox_init_point`).
2. **Webhook é a única fonte de verdade** para liberar acesso (o retorno via
   `back_urls` nunca libera nada). Configurar no painel da aplicação
   (Webhooks → evento "Pagamentos"), que gera a **assinatura secreta**
   (`MP_WEBHOOK_SECRET`).
3. **Validação da assinatura** (obrigatória, doc oficial):
   - Header `x-signature` = `ts=...,v1=...`; header `x-request-id`;
     query param `data.id`.
   - Manifest: `id:{data.id em lowercase};request-id:{x-request-id};ts:{ts};`
     (segmentos ausentes são removidos inteiros).
   - HMAC-SHA256(manifest, MP_WEBHOOK_SECRET) em hex, comparar com `v1` em
     tempo constante. Chave é **por aplicação** (teste e produção diferem).
   - Depois: `GET /v1/payments/{data.id}` e agir pelo `status` real
     (`approved` libera; `refunded`/`charged_back` revoga). Responder 200
     rápido; MP faz retry por até 4 dias.
4. **Pix em teste não é aprovável** (o QR de sandbox não conclui o pagamento).
   Testes end-to-end: cartão de teste (contas de teste comprador/vendedor,
   nome do titular controla o resultado, ex. APRO) + simulador de webhooks do
   painel. Pix real é validado na Fase 3 com uma compra de valor baixo.
5. **Produção (Fase 3):** ativar credenciais de produção (exige completar
   dados do negócio), trocar `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET`, URLs
   HTTPS estáveis (domínio próprio), homologação/medição de qualidade.
6. **Taxas (aprox., confirmar na conta):** Pix ~0,99%; cartão à vista ~4,98%
   (D0) a ~3,98% (D30).

## Supabase — plano (Fase 1)

- Auth e-mail/senha. Tabelas: `perfis`, `lives`, `compras`, `sessoes_ativas`,
  `logs_auditoria` — todas com RLS; escrita sensível só via service role no
  servidor.
- **Sessão única:** tabela `sessoes_ativas` com 1 linha por usuário
  (`session_id` atual). No login, o `session_id` novo substitui o antigo;
  o player faz heartbeat (~10 s) enviando seu `session_id`; se divergir,
  desloga na hora. Derrubar/banir usuário = admin apaga/troca a linha.
- **Rate limiting** (login, compra, emissão de token): contadores em tabela
  Postgres com janela deslizante — sem serviço extra (Vercel serverless não
  tem memória compartilhada).

## Marca d'água (Fase 1)

- Overlay HTML/canvas sobre o `<video>`: nome + e-mail + parte do IP,
  semi-transparente, posição/opacidade mudando a cada poucos segundos
  (aleatório com jitter). Dificultadores: elemento recriado com ids/classes
  aleatórios, reinserido via MutationObserver se removido, player pausa se o
  overlay sumir do DOM. Honestidade técnica: quem gravar a tela leva a marca
  junto — o objetivo é **rastrear** vazamento (o token curto + sessão única
  cuidam do compartilhamento de link/conta).

## Variáveis de ambiente

Fase 0: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_STREAM_CUSTOMER_CODE`, `MP_ACCESS_TOKEN`.
Fase 1 (novas): `MP_WEBHOOK_SECRET`, `CLOUDFLARE_STREAM_SIGNING_KEY_ID`,
`CLOUDFLARE_STREAM_SIGNING_KEY_JWK`.
