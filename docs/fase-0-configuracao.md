# Fase 0 — Conectar os serviços (guia passo a passo)

Este guia supõe que você **já tem conta** nos quatro serviços (Vercel, Supabase,
Cloudflare e Mercado Pago) — vamos apenas ativar produtos e copiar chaves.

**Resultado final desta fase:** o site no ar na Vercel e a página
`https://SEU-SITE/status` **toda verde**. Esse é o teste — nada de verde,
nada de Fase 1. 😉

**Tempo estimado:** 30 a 45 minutos, sem pressa.

Você vai copiar 8 valores no total. Sugestão: abra um bloco de notas e vá
colando cada valor com o nome da variável ao lado, para depois colar tudo de
uma vez na Vercel (Passo 4).

| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Vercel (Passo 4) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (Passo 1) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (Passo 1) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (Passo 1) — **segredo** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare (Passo 2) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare (Passo 2) — **segredo** |
| `CLOUDFLARE_STREAM_CUSTOMER_CODE` | Cloudflare (Passo 2) |
| `MP_ACCESS_TOKEN` | Mercado Pago (Passo 3) — **segredo** |

> ⚠️ Os três marcados como **segredo** valem como senha do seu negócio.
> Nunca envie por WhatsApp/e-mail, nunca cole em site que não seja a Vercel.

---

## Passo 1 — Supabase (login e banco de dados)

1. Entre em <https://supabase.com/dashboard> e clique em **New project**.
2. Preencha:
   - **Name:** `clan-maromba`
   - **Database password:** clique em **Generate a password** e **guarde essa
     senha** no seu gerenciador de senhas (não vamos usá-la agora, mas é sua).
   - **Region:** `South America (São Paulo)` — mais perto do seu público.
3. Clique em **Create new project** e aguarde 1–2 minutos.
4. No menu lateral, vá em **Project Settings** (engrenagem) → **API Keys**
   (em alguns painéis aparece como **Data API**):
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
     → copie para `NEXT_PUBLIC_SUPABASE_URL`
   - A chave **pública** — aparece como **Publishable key**
     (`sb_publishable_...`) ou, em projetos com chaves antigas, **anon public**
     → copie para `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - A chave **secreta** — aparece como **Secret key** (`sb_secret_...`; talvez
     seja preciso clicar em **Reveal**/**Create new**) ou, no formato antigo,
     **service_role** → copie para `SUPABASE_SERVICE_ROLE_KEY` ⚠️ segredo

---

## Passo 2 — Cloudflare Stream (o vídeo)

O Stream é o único serviço **pago** da nossa base: US$ 5 já compram 1.000
minutos de armazenamento de gravações, e a entrega custa US$ 1 por 1.000
minutos assistidos (enviar a live pelo OBS é grátis). Sem assinar, a live nem
inicia.

**2a. Ativar o Stream**

1. Entre em <https://dash.cloudflare.com> e, no menu lateral esquerdo, clique
   em **Stream**.
2. Siga o fluxo de assinatura que a página oferecer (cartão internacional;
   comece com o plano mínimo de US$ 5/1.000 minutos de armazenamento).

**2b. ID da conta**

1. Com o painel aberto, pressione **Ctrl+K** (Windows) ou **Cmd+K** (Mac).
2. Digite `Copy account ID` e clique no resultado — o ID já vai para a área de
   transferência → cole em `CLOUDFLARE_ACCOUNT_ID`.
   *(Alternativa: página **Workers & Pages**, caixa **Account details** à
   direita, botão de copiar ao lado de "Account ID".)*

**2c. Token de API** ⚠️ segredo

1. Clique no **ícone de perfil** (canto superior direito) → **My Profile** →
   aba **API Tokens** → **Create Token**.
2. Desça até **Create Custom Token** → **Get started**.
3. Preencha:
   - **Token name:** `clan-maromba-stream`
   - **Permissions:** na primeira caixa escolha **Account**, na segunda
     **Stream**, na terceira **Edit**.
   - **Account Resources:** **Include** → sua conta.
4. **Continue to summary** → **Create Token**.
5. Copie o token exibido (ele aparece **uma única vez**) → `CLOUDFLARE_API_TOKEN`.

**2d. Código de cliente do player**

1. Volte à página **Stream** do painel → **Live Inputs** → **Create live input**
   (dê qualquer nome, ex.: `teste`; pode apagar depois).
2. Ao abrir o input criado, procure o trecho **Embed** ou **HLS Manifest URL**:
   nele aparece um endereço no formato
   `customer-XXXXXXXX.cloudflarestream.com`.
3. Copie **só a parte `XXXXXXXX`** (o que fica entre `customer-` e
   `.cloudflarestream.com`) → `CLOUDFLARE_STREAM_CUSTOMER_CODE`.

---

## Passo 3 — Mercado Pago (pagamentos)

Vamos usar as **credenciais de teste** — compras simuladas, sem dinheiro de
verdade — até a Fase 3.

1. Entre em <https://www.mercadopago.com.br/developers> logado na sua conta.
2. Clique em **Suas integrações** (canto superior direito) → **Criar aplicação**.
3. Preencha:
   - **Nome:** `Clan Maromba`
   - Em "Qual produto você está integrando?" escolha **CheckoutPro**
     (pagamentos online).
   - Confirme a criação.
4. No menu lateral esquerdo da aplicação: **Testes → Credenciais de teste**.
5. Copie o **Access Token** (começa com `TEST-`) → `MP_ACCESS_TOKEN` ⚠️ segredo.

> A "assinatura secreta do webhook" (`MP_WEBHOOK_SECRET`) será gerada na
> Fase 1, quando configurarmos as notificações de pagamento — por enquanto
> pode deixar em branco.

---

## Passo 4 — Vercel (colocar o site no ar)

1. Entre em <https://vercel.com/new> (logado).
2. Em **Import Git Repository**, localize **`clan-maromba`** e clique em
   **Import**. *(Se o repositório não aparecer, clique no ajuste de permissões
   do GitHub na própria página e libere o acesso da Vercel a ele.)*
3. **Antes de clicar em Deploy**, configure:
   - **Project Name:** `clan-maromba`
   - **Framework Preset:** deve reconhecer **Next.js** sozinho.
   - Abra a seção **Environment Variables** e cole as 7 variáveis que você já
     coletou (nome no campo da esquerda, valor no da direita). Em
     `NEXT_PUBLIC_SITE_URL` coloque `https://clan-maromba.vercel.app`.
4. Clique em **Deploy** e aguarde o build terminar (1–3 minutos).

*(Se o endereço final for diferente de `clan-maromba.vercel.app`, ajuste a
variável `NEXT_PUBLIC_SITE_URL` em **Settings → Environment Variables** e
faça **Redeploy** em Deployments → menu "..." → Redeploy.)*

---

## Passo 5 — Testar (o teste da Fase 0)

1. Abra `https://clan-maromba.vercel.app` → deve aparecer a página escura
   **"Clan Maromba — em construção"**.
2. Abra `https://clan-maromba.vercel.app/status`:
   - **Supabase: Conectado** ✅
   - **Cloudflare Stream: Conectado** ✅
   - **Mercado Pago: Conectado** (e dizendo **modo TESTE**) ✅
   - `MP_WEBHOOK_SECRET` aparece como ⏳ (normal — é da Fase 1).

**Se algo ficar vermelho**, a própria página diz o motivo mais provável.
Os erros clássicos:

| Sintoma | Causa provável | Correção |
|---|---|---|
| "Aguardando..." | Variável não foi colada na Vercel | Settings → Environment Variables → confira o **nome exato** |
| Supabase erro 401/403 | Chave pública incompleta | Recopie a chave inteira (é longa) |
| Cloudflare erro 401/403 | Token sem a permissão "Stream: Edit" | Refaça o Passo 2c |
| Cloudflare outro erro | Assinatura do Stream não ativada | Refaça o Passo 2a |
| Mercado Pago erro 401 | Access Token de produção ou incompleto | Use o de **teste** (`TEST-`), completo |

> Depois de corrigir qualquer variável na Vercel, é preciso fazer **Redeploy**
> (Deployments → "..." → Redeploy) para o site enxergar o novo valor.

Quando estiver tudo verde, me avise — começamos a **Fase 1**: cadastro,
compra, player com token assinado, marca d'água e sessão única.
