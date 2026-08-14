# Fase 1 — Ligar o site de verdade (passo a passo)

O site já tem **todo o código pronto**: cadastro, login, página da live, botão
de compra, pagamento, player com cadeado, marca d'água, sessão única e painel
do dono. Só que ele está desligado, porque nenhuma chave foi cadastrada ainda.

Este guia liga tudo. **São 6 passos**, na ordem. Cada um termina com um teste,
e depois de cada teste você já vê uma parte do site funcionando de verdade.

**Tempo:** 1 hora, sem pressa. Dá para parar no meio e voltar depois.

| Passo | O que liga | Custo | O que passa a funcionar |
|---|---|---|---|
| 1 | Supabase | grátis | Cadastro e login |
| 2 | Banco de dados | grátis | Criar lives, painel do dono |
| 3 | Mercado Pago | grátis (teste) | Botão de compra |
| 4 | Aviso de pagamento | grátis | Liberação automática do acesso |
| 5 | Cloudflare Stream | US$ 5 | A transmissão em si |
| 6 | Proteção do vídeo | grátis | O cadeado do player |

---

## 📌 A receita de cadastrar uma chave (você vai repetir várias vezes)

1. Abra <https://vercel.com/dashboard> → clique no projeto **clan-maromba**
2. Aba **Settings** (no topo) → **Environment Variables** (menu da esquerda)
3. **Key:** cole o NOME (ex.: `NEXT_PUBLIC_SUPABASE_URL`)
4. **Value:** cole o valor que você copiou
5. **Save**
6. No fim de cada passo: aba **Deployments** → no primeiro da lista, clique nos
   **três pontinhos (…)** → **Redeploy** → confirme.
   *Sem esse Redeploy o site não enxerga as chaves novas.*

> ⚠️ Chaves são as senhas do seu negócio. Cole só na Vercel — nunca em
> WhatsApp, e-mail, print ou conversa com o assistente.

**Antes de começar**, cadastre esta, que ficou faltando lá da Fase 0:

- **Key:** `NEXT_PUBLIC_SITE_URL`
- **Value:** `https://clan-maromba.vercel.app`

---

## Passo 1 — Supabase: as contas dos seus compradores

Siga o **Passo 2 do guia `docs/fase-0-configuracao.md`** — ele já explica tela
por tela como criar o projeto e copiar as 3 chaves:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Depois volte aqui e faça mais **um ajuste importante**:

**Desligar a confirmação por e-mail** (por enquanto). O Supabase gratuito só
manda 3 e-mails por hora — na estreia isso trava seus compradores.

1. No Supabase, menu da esquerda → **Authentication**
2. → **Sign In / Providers** → **Email**
3. Desmarque **Confirm email** → **Save**

*(Na Fase 2 a gente liga um serviço de e-mail de verdade e reativa isso.)*

Faça o **Redeploy**.

✅ **Teste:** abra `https://clan-maromba.vercel.app/status`. A luz do
**Supabase** deve estar **verde**, escrito "Conectado", e as quatro primeiras
variáveis com ✅.

Abra também `/cadastro`: o formulário deve aparecer. **Ainda não crie a conta** —
ela vem no passo 2, logo depois das tabelas existirem.

---

## Passo 2 — Criar as tabelas, sua conta e virar administrador

O Supabase nasce vazio. Faça **nesta ordem** — as tabelas primeiro, a conta
depois.

**2a. Criar as tabelas**

1. No Supabase → menu da esquerda → **SQL Editor** → **New query**
2. Abra o arquivo **`supabase/schema.sql`** deste projeto no GitHub:
   <https://github.com/gabrielabattalini/clan-maromba/blob/main/supabase/schema.sql>
3. Clique no botão de **copiar** (ícone de duas folhinhas, canto superior
   direito do arquivo) e **cole tudo** no SQL Editor
4. Clique em **Run** (ou Ctrl+Enter). Deve aparecer *"Success. No rows returned"*

**2b. Criar a sua conta**

Agora sim: abra `https://clan-maromba.vercel.app/cadastro` e crie a conta com o
seu e-mail de verdade. Deve entrar direto e seu nome aparecer no canto superior
direito.

> Se aparecer *"Confira seu e-mail e clique no link de confirmação"*, é porque
> o **Confirm email** do passo 1 ficou ligado. Volte lá, desligue e tente de novo.

**2c. Virar administrador**

Volte ao **SQL Editor**, apague tudo e cole esta única linha, **trocando pelo
seu e-mail** (exatamente o mesmo do cadastro):

```sql
update public.perfis set admin = true where email = 'seu-email@exemplo.com';
```

Clique em **Run**. Tem que aparecer **`Success. 1 row(s) affected`** —
se disser **0 rows**, o e-mail está diferente do que você usou no cadastro.

✅ **Teste:** recarregue o site. No topo deve ter aparecido o botão
**Painel**. Clique nele: você está em `/admin`. Crie uma live de mentira
(título "Teste", preço 10) só para ver funcionando.

> A live nasce como **rascunho** — ninguém além de você enxerga. Você pode
> apagar depois direto no Supabase (Table Editor → lives).

---

## Passo 3 — Mercado Pago: o botão de compra

Siga o **Passo 3 do guia `docs/fase-0-configuracao.md`**: criar a aplicação e
copiar o **Access Token de teste** (começa com `TEST-`) para a Vercel como
`MP_ACCESS_TOKEN`.

Faça o **Redeploy**.

✅ **Teste:** no painel, abra sua live de teste e mude o estado para
**Anunciada**. Depois abra a home do site: a live aparece. Clique nela — o
botão **Comprar acesso** já aparece. Ainda não clique.

---

## Passo 4 — O aviso de pagamento (o mais importante)

Este é o passo que **libera o acesso do comprador automaticamente**. Sem ele,
a pessoa paga e não recebe nada.

1. No site, entre em **`/admin/configuracao`** (ou Painel → Configuração)
2. A seção **2. Aviso de pagamento** mostra o endereço que você precisa colar.
   Ele é este:
   ```
   https://clan-maromba.vercel.app/api/webhooks/mercadopago
   ```
3. Vá em <https://www.mercadopago.com.br/developers/panel> → sua aplicação
   **Clan Maromba** → menu da esquerda → **Webhooks**
4. Em **Modo teste**, cole o endereço acima no campo de URL
5. Marque o evento **Pagamentos** e clique em **Salvar**
6. A tela mostra uma **assinatura secreta**. Copie e cadastre na Vercel como
   `MP_WEBHOOK_SECRET`

Faça o **Redeploy**.

✅ **Teste da compra completa** (com cartão de mentira, sem dinheiro real):

1. No site, abra sua live de teste e clique em **Comprar acesso**
2. Você cai no Checkout do Mercado Pago. Escolha **Cartão**
3. Use um cartão de teste:
   - **Número:** `5031 4332 1540 6351`
   - **Validade:** `11/30` · **CVV:** `123`
   - **Nome do titular:** `APRO` ← *é isto que faz o pagamento ser aprovado*
   - **CPF:** `12345678909`
4. Confirme. Você volta para a página da live
5. **Aguarde uns 10 segundos e recarregue.** Deve aparecer
   **"✓ Você tem acesso a esta live"**

> Se não aparecer: no Mercado Pago, em Webhooks, tem um botão de **simular
> notificação** — use para reenviar. E confira se o `MP_WEBHOOK_SECRET` foi
> colado inteiro.

> **Pix não funciona em modo teste** — o QR do sandbox não conclui. Pix real
> a gente valida na Fase 3, com uma compra de R$ 1.

---

## Passo 5 — Cloudflare Stream: a transmissão

Este é o único passo pago: **US$ 5**, e precisa de cartão internacional.

Siga o **Passo 4 do guia `docs/fase-0-configuracao.md`** — assinar o Stream e
copiar as 3 chaves:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`

Faça o **Redeploy**.

✅ **Teste:** no painel, crie uma live nova (as antigas não têm canal de
transmissão porque foram criadas antes da Cloudflare estar ligada — para elas,
use o botão **Criar canal de transmissão**). Abra a live no painel: agora
aparecem **Servidor (URL)** e **Chave de transmissão**.

---

## Passo 6 — O cadeado do vídeo

1. No site, entre em **`/admin/configuracao`**
2. Na seção **1. Proteção do vídeo**, clique em **Gerar chave de assinatura**
3. Aparecem dois valores. **Copie os dois agora** — a Cloudflare só mostra uma
   vez (se perder, é só gerar outra):
   - `CLOUDFLARE_STREAM_SIGNING_KEY_ID`
   - `CLOUDFLARE_STREAM_SIGNING_KEY_JWK`
4. Cadastre os dois na Vercel

Faça o **Redeploy**.

✅ **Teste:** abra `/status`. Tudo deve estar verde e sem nenhum ❌.

---

## 🎬 Teste final: uma live de ponta a ponta

Agora o ensaio geral. Faça isso **antes** de anunciar a primeira live paga.

**No seu computador (OBS):**

1. Painel → sua live de teste → copie **Servidor (URL)** e **Chave de
   transmissão**
2. No OBS: **Configurações → Transmissão**
   - **Serviço:** Personalizado
   - **Servidor:** cole a URL
   - **Chave de transmissão:** cole a chave
3. **Configurações → Saída** (modo Avançado):
   - Codificador: x264 ou NVENC · **Bitrate:** 3000–4500 kbps
   - **Intervalo de keyframe: 2 segundos** ← importante
   - Perfil: `main` · **B-frames: 0**
4. **Iniciar transmissão**
5. Volte ao painel: deve aparecer **● OBS conectado**

**No site:**

6. No painel, mude o estado da live para **No ar**
7. Abra a live (pode ser no celular, na sua conta que já comprou) →
   **Assistir agora**
8. O vídeo deve tocar, com seu nome e e-mail flutuando por cima

**As travas (teste cada uma):**

9. **Sessão única:** com o vídeo tocando no celular, entre na mesma conta no
   computador. Em ~10 segundos o celular deve parar com o aviso
   *"Sua conta foi aberta em outro aparelho"*
10. **Sem compra não entra:** crie uma segunda conta (outro e-mail), sem
    comprar, e tente abrir `/assistir/sua-live` — deve mandar de volta para a
    página de compra
11. **Link não vaza:** copie o endereço `/assistir/...` e abra numa janela
    anônima — deve pedir login
12. **Derrubar/banir:** no painel, na lista de compradores, teste os botões
    **Derrubar** e **Banir**

Quando terminar, mude a live para **Encerrada** e pare o OBS.

---

## ⚠️ Duas coisas antes de vender de verdade

1. **O plano Hobby da Vercel proíbe uso comercial.** Vender ingresso é uso
   comercial. Antes da primeira live paga, é preciso ir para o **Vercel Pro**
   (US$ 20/mês) ou migrar o site para **Cloudflare Workers** (US$ 0–5/mês).
   A recomendação é a Cloudflare, já que você vai ser cliente deles por causa
   do Stream.

2. **O Mercado Pago ainda está em modo teste.** Nenhum dinheiro entra de
   verdade. Trocar para produção é a Fase 3 — exige completar os dados do seu
   negócio no painel do Mercado Pago.

---

## Se algo der errado

| O que acontece | Provável causa | O que fazer |
|---|---|---|
| Chave cadastrada mas o site não vê | Faltou o Redeploy | Deployments → … → Redeploy |
| "Página restrita" no `/status` | Você não está logado como admin | Entre com a conta que virou admin no Passo 2 |
| Não aparece o botão Painel | O comando `update ... admin = true` não rodou | Refaça o Passo 2, confira se o e-mail está exatamente igual |
| Paguei e o acesso não liberou | Webhook | Confira `MP_WEBHOOK_SECRET` e o endereço no painel do MP |
| Live sem URL/chave do OBS | Foi criada antes da Cloudflare | Botão **Criar canal de transmissão** |
| Player diz "proteção não configurada" | Falta o Passo 6 | Gere a chave em `/admin/configuracao` |
| OBS conecta mas o vídeo não abre | Estado da live | Precisa estar **No ar** |
