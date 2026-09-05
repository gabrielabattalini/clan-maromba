# Fase 0 — Ligar os serviços (passo a passo)

Guia para quem **não é da área de TI**. São 5 passos, e a ordem foi escolhida
para você ver resultado logo: primeiro o site fica no ar, depois ligamos um
serviço de cada vez e vamos vendo as luzinhas ficarem verdes.

**Resultado final:** a página `https://SEU-SITE/status` **toda verde**.
Enquanto não estiver, a Fase 1 não começa. 😉

**Tempo total:** 30 a 45 minutos, sem pressa. Dá para parar no meio e voltar
depois — cada passo é independente.

| Passo | O que faz | Custo |
|---|---|---|
| 1 | Vercel — coloca o site no ar | grátis |
| 2 | Supabase — login e banco de dados | grátis |
| 3 | Mercado Pago — pagamentos (modo teste) | grátis |
| 4 | Cloudflare Stream — o vídeo | US$ 5 iniciais |
| 5 | Conferir tudo verde | — |

---

## 📌 A receita que você vai repetir (guarde este quadro)

Nos passos 2, 3 e 4 você vai copiar chaves e colar na Vercel. **Sempre do
mesmo jeito:**

1. Abra <https://vercel.com/dashboard> → clique no projeto **clan-maromba**
2. Aba **Settings** (no topo) → **Environment Variables** (menu da esquerda)
3. No campo **Key** cole o NOME (ex.: `NEXT_PUBLIC_SUPABASE_URL`)
4. No campo **Value** cole o valor que você copiou
5. Clique em **Save**
6. Repita para as outras chaves do passo
7. **Importante:** vá na aba **Deployments** → no primeiro da lista, clique nos
   **três pontinhos (...)** → **Redeploy** → confirme.
   *Sem esse Redeploy o site não enxerga as chaves novas.*

> ⚠️ **Chaves são senhas do seu negócio.** Nunca mande por WhatsApp, e-mail ou
> print. Cole só na Vercel. As que começam com `NEXT_PUBLIC_` são públicas
> (podem aparecer no navegador); as outras são secretas.

---

## Passo 1 — Vercel: colocar o site no ar

Aqui o site já vai para o ar, mesmo sem nenhuma chave. Ele sobe "vazio" de
propósito — a página `/status` vai mostrar tudo amarelo, e é isso que a gente
vai pintando de verde nos próximos passos.

1. Entre em <https://vercel.com/new> (logado na sua conta).
2. Na lista **Import Git Repository**, procure **`clan-maromba`** e clique em
   **Import**.
   - *Não apareceu na lista?* Clique no link de ajustar permissões do GitHub na
     mesma página (algo como **Adjust GitHub App Permissions**), autorize o
     repositório `clan-maromba` e volte.
3. Na tela seguinte **não mexa em nada** — a Vercel reconhece o Next.js
   sozinho. Só confira se o **Project Name** está `clan-maromba`.
4. Clique em **Deploy** e espere 1 a 3 minutos (vai aparecer uma animação de
   confete quando terminar).
5. Anote o endereço que a Vercel te deu — algo como
   `https://clan-maromba.vercel.app`. **Esse é o endereço do seu site.**
6. Agora cadastre esse endereço como variável, usando **a receita do quadro
   acima**:
   - **Key:** `NEXT_PUBLIC_SITE_URL`
   - **Value:** o endereço completo, com `https://` e **sem barra no final**

✅ **Teste do passo 1:** abra o endereço do site. Deve aparecer uma página
escura escrito **"Clan Maromba — em construção"**. Abra também
`SEU-ENDEREÇO/status`: as três luzinhas estarão amarelas ("Aguardando
chaves"). É exatamente o esperado.

---

## Passo 2 — Supabase: login e banco de dados

É onde ficam as contas dos seus alunos/compradores e o registro de quem
comprou cada live. Plano gratuito dá e sobra no começo.

1. Entre em <https://supabase.com/dashboard> e clique em **New project**.
2. Preencha:
   - **Name:** `clan-maromba`
   - **Database password:** clique em **Generate a password** e **guarde essa
     senha** no seu gerenciador de senhas. (Não vamos usá-la agora, mas se
     perder não dá para recuperar.)
   - **Region:** escolha **South America (São Paulo)** — mais perto do seu
     público, site mais rápido.
3. Clique em **Create new project** e espere 1 a 2 minutos.
4. No menu da esquerda, clique na **engrenagem** (**Project Settings**) →
   **API Keys** (em alguns painéis aparece como **Data API**).
5. Copie três coisas e cadastre na Vercel (**receita do quadro**):

   | O que procurar na tela | Cole na Vercel como |
   |---|---|
   | **Project URL** (`https://algo.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` |
   | **Publishable key** (`sb_publishable_...`) — em contas antigas: **anon public** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | **Secret key** (`sb_secret_...`, pode precisar clicar em **Reveal**) — em contas antigas: **service_role** | `SUPABASE_SERVICE_ROLE_KEY` ⚠️ secreta |

6. Faça o **Redeploy** (item 7 da receita).

✅ **Teste do passo 2:** abra `SEU-ENDEREÇO/status` — a luz do **Supabase**
deve estar **verde**, escrito "Conectado".

---

## Passo 3 — Mercado Pago: pagamentos

Vamos usar as **credenciais de teste**: compras simuladas, sem dinheiro de
verdade. Só na Fase 3, no lançamento, trocamos pelas de verdade.

1. Entre em <https://www.mercadopago.com.br/developers> (logado na sua conta).
2. Clique em **Suas integrações** (canto superior direito) → **Criar aplicação**.
3. Preencha:
   - **Nome:** `Clan Maromba`
   - Em "Qual produto você está integrando?", escolha **CheckoutPro**
     (pagamentos online).
   - Confirme.
4. No menu da esquerda da aplicação: **Testes** → **Credenciais de teste**.
5. Copie o **Access Token** (começa com `TEST-`) e cadastre na Vercel
   (**receita do quadro**) como `MP_ACCESS_TOKEN` ⚠️ secreta.
6. Faça o **Redeploy**.

> A tal "assinatura secreta do webhook" (`MP_WEBHOOK_SECRET`) só será criada na
> Fase 1, quando ligarmos o aviso automático de pagamento. Por enquanto ela
> aparece com um ⏳ na página de status — está tudo certo.

✅ **Teste do passo 3:** em `SEU-ENDEREÇO/status`, o **Mercado Pago** fica
**verde** e escrito **"modo TESTE"** — que é o certo agora.

---

## Passo 4 — Cloudflare Stream: o vídeo

Este é o único serviço pago da base, e é o coração do produto: é ele que
recebe a transmissão do seu OBS e entrega o vídeo protegido para quem comprou.

**Quanto custa** (conferido em 02/09/2026): US$ 5 por mês compram 1.000
minutos de armazenamento **e já incluem 5.000 minutos de entrega**. Passando
disso, a entrega custa US$ 1 a cada 1.000 minutos assistidos — ex.: 100
pessoas × 2h ≈ US$ 12. Mandar a live do OBS para lá é **grátis**: a Cloudflare
não cobra nem o envio nem a conversão. Precisa de cartão internacional.

⚠️ **Toda transmissão ao vivo é gravada automaticamente, e não dá para
desligar.** A gravação ocupa armazenamento: 20 horas de evento são 1.200
minutos, o que já passa dos 1.000 inclusos e leva a conta para US$ 10/mês
enquanto os arquivos existirem. Se não for vender replay, apague as gravações
depois do evento.

**4a. Assinar o Stream**

1. Entre em <https://dash.cloudflare.com> e clique em **Stream** no menu da
   esquerda.
2. Siga o fluxo de assinatura da página (comece com o plano mínimo, US$ 5).
   Sem assinar, a live nem inicia.

**4b. Pegar o ID da conta**

1. Com o painel aberto, aperte **Ctrl + K** (Windows) ou **Cmd + K** (Mac).
2. Digite `Copy account ID` e clique no resultado — ele copia sozinho.
3. Cadastre na Vercel como `CLOUDFLARE_ACCOUNT_ID`.

**4c. Criar o token de acesso** ⚠️ secreta

1. Clique no **ícone de perfil** (canto superior direito) → **My Profile** →
   aba **API Tokens** → botão **Create Token**.
2. Role a página até o final e clique em **Create Custom Token** →
   **Get started**.
3. Preencha:
   - **Token name:** `clan-maromba-stream`
   - **Permissions:** três caixinhas lado a lado — na 1ª escolha **Account**,
     na 2ª **Stream**, na 3ª **Edit**.
   - **Account Resources:** deixe **Include** → sua conta.
4. **Continue to summary** → **Create Token**.
5. Copie o token da tela (**ele só aparece uma vez!**) e cadastre na Vercel
   como `CLOUDFLARE_API_TOKEN`.

**4d. Pegar o código do player**

1. Volte em **Stream** → **Live Inputs** → **Create live input** (dê o nome
   `teste`; pode apagar depois).
2. Abra o input criado e procure o bloco **Embed** ou **HLS Manifest URL**.
   Vai aparecer um endereço assim:
   `customer-a1b2c3d4e5.cloudflarestream.com`
3. Copie **só o pedaço do meio** — no exemplo, `a1b2c3d4e5` (o que fica entre
   `customer-` e `.cloudflarestream.com`).
4. Cadastre na Vercel como `CLOUDFLARE_STREAM_CUSTOMER_CODE`.
5. Faça o **Redeploy**.

✅ **Teste do passo 4:** em `SEU-ENDEREÇO/status`, o **Cloudflare Stream** fica
**verde**.

---

## Passo 5 — Conferir tudo verde

Abra `SEU-ENDEREÇO/status`. O esperado:

- **Supabase:** Conectado ✅
- **Cloudflare Stream:** Conectado ✅
- **Mercado Pago:** Conectado, modo TESTE ✅
- Na lista de baixo, só o `MP_WEBHOOK_SECRET` com ⏳ (é da Fase 1)
- No topo, a faixa verde: **"Tudo verde! A Fase 0 está completa"**

### Se alguma luz ficar vermelha

A própria página diz o motivo. Os casos comuns:

| O que aparece | Provável causa | O que fazer |
|---|---|---|
| "Aguardando..." | A variável não foi salva, ou o nome saiu errado | Settings → Environment Variables → confira o **nome exato** (maiúsculas e underlines) |
| Continua igual depois de salvar | Faltou o **Redeploy** | Deployments → "..." → Redeploy |
| Supabase erro 401/403 | Chave incompleta (elas são bem longas) | Copie de novo, inteira |
| Cloudflare erro 401/403 | Token sem a permissão certa | Refaça o **4c** com Account → Stream → **Edit** |
| Cloudflare outro erro | Assinatura do Stream não ativada | Refaça o **4a** |
| Mercado Pago erro 401 | Token de produção, ou incompleto | Use o de **teste** (começa com `TEST-`) |

Quando estiver tudo verde, me avise — começa a **Fase 1**: cadastro dos
compradores, botão de compra, player com cadeado, marca d'água e sessão única.
