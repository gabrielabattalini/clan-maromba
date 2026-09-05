# Ligar o domínio próprio — `misterolympia2026.online`

Comprado em 05/09/2026. O endereço antigo (`clan-maromba.vercel.app`)
**continua funcionando** — a Vercel não desliga nada. Ele só deixa de ser o
endereço principal.

**No código não muda nada.** O site inteiro descobre o próprio endereço por
uma variável só (`NEXT_PUBLIC_SITE_URL`). Trocar essa variável troca o
endereço nos e-mails de confirmação, no retorno do Mercado Pago, no sitemap e
no link do webhook. O que precisa de trabalho manual são **4 painéis**.

Faça na ordem. Cada passo tem o teste dele.

---

## Passo 1 — Vercel: apontar o domínio

1. <https://vercel.com> → time **CLAN MAROMBA** → projeto **clan-maromba**
2. Aba **Settings** → menu da esquerda → **Domains**
3. **Add Domain** → digite `misterolympia2026.online` → **Add**
4. Na tela **Connect your domain**:
   - **Search:** `Allow` — é como o Google acha o site
   - **Agent:** `Allow` — é como o ChatGPT cita o site quando alguém pergunta
     onde assistir
   - **Training:** deixe como veio
   - **Import DNS records:** `Automatic`
   - **Continue**
5. A Vercel vai mostrar **o que cadastrar no site onde você comprou o
   domínio**. São dois caminhos possíveis; ela te diz qual:
   - **Nameservers** — você troca os servidores de DNS lá no registrador pelos
     que a Vercel mostrar. Mais simples, e a Vercel passa a cuidar do DNS.
   - **Registro A / CNAME** — você cria os registros que ela mostrar.
   Copie os valores **da tela**, não daqui: eles mudam.
6. Espere. Pode levar de 10 minutos a algumas horas (é o DNS se espalhando
   pelo mundo). A Vercel mostra ✅ **Valid Configuration** quando terminar, e
   emite o certificado HTTPS sozinha.
7. Quando ficar verde, ainda em **Domains**, deixe
   `misterolympia2026.online` como **Primary** (menu `···` → *Set as
   Primary*). Isso faz o `.vercel.app` redirecionar para ele.

✅ **Teste:** abra `https://misterolympia2026.online`. Tem que carregar a home
com o cadeado de seguro na barra de endereço.

> Enquanto o DNS não propaga, o site fica **no ar pelo endereço antigo**.
> Ninguém fica na porta.

---

## Passo 2 — Vercel: a variável do endereço

Este é o passo que faz o site *saber* que mudou de endereço. Sem ele, o
e-mail de confirmação de conta continua mandando a pessoa para o `.vercel.app`.

1. Mesmo projeto → **Settings** → **Environment Variables**
2. Procure `NEXT_PUBLIC_SITE_URL` → `···` → **Edit**
3. Troque o valor por:
   ```
   https://misterolympia2026.online
   ```
   Com `https://`, **sem barra no final**, tudo minúsculo.
4. **Save**
5. Aba **Deployments** → no primeiro da lista → `···` → **Redeploy** →
   confirme.
   *Sem o Redeploy a variável nova não vale.*

✅ **Teste:** abra `https://misterolympia2026.online/robots.txt`. A última
linha (`Sitemap:`) tem que dizer `misterolympia2026.online`. Se ainda disser
`vercel.app`, o Redeploy não terminou ou não foi feito.

---

## Passo 3 — Supabase: os links de e-mail

O Supabase só aceita mandar a pessoa de volta para endereços que ele conhece.
Se o novo não estiver na lista, o link de confirmação de conta e o de
recuperação de senha **param de funcionar**.

1. <https://supabase.com/dashboard> → projeto `mkzsizdhkgqfhsngenoc`
2. Menu da esquerda → **Authentication** → **URL Configuration**
3. **Site URL:** troque para
   ```
   https://misterolympia2026.online
   ```
4. **Redirect URLs:** clique em **Add URL** e acrescente **as duas**
   (não apague as antigas — o endereço velho ainda funciona e há e-mail
   antigo circulando com ele):
   ```
   https://misterolympia2026.online/**
   https://clan-maromba.vercel.app/**
   ```
5. **Save**

✅ **Teste:** em `https://misterolympia2026.online/entrar`, clique em
**Esqueci minha senha** e peça o link para o seu e-mail. O link que chegar
tem que começar com `misterolympia2026.online` e abrir a tela de nova senha.

---

## Passo 4 — Mercado Pago: o aviso de pagamento

É o passo que libera o acesso de quem paga. Se ficar apontando para o
endereço velho **não quebra nada hoje** (o `.vercel.app` continua no ar), mas
deixa o negócio dependendo de um endereço que você não controla.

1. <https://www.mercadopago.com.br/developers/panel> → aplicação
   **Clan Maromba** → menu da esquerda → **Webhooks**
2. Em **Modo produção**, troque a URL para:
   ```
   https://misterolympia2026.online/api/webhooks/mercadopago
   ```
3. Confira que o evento **Pagamentos** continua marcado → **Salvar**
4. Repita em **Modo teste**.
5. **Se a assinatura secreta mudar** ao salvar (o campo mostra um valor novo):
   copie e cadastre na Vercel em `MP_WEBHOOK_SECRET`.
   Você pode deixar **os dois segredos separados por vírgula** — o site
   aceita ambos, e assim não existe um segundo em que quem pagou fica na
   porta:
   ```
   segredo-antigo,segredo-novo
   ```
   Depois de uma semana, apague o antigo.

✅ **Teste:** no painel do Mercado Pago, botão **Simular notificação** →
evento *Pagamentos* → **Enviar**. Tem que responder **200 - OK**.

---

## Passo 5 — Entrar com Google: **não mexe em nada**

Parece que teria de mudar, e não tem. O caminho do Google não passa pelo
nosso endereço: ele volta para o Supabase
(`mkzsizdhkgqfhsngenoc.supabase.co/auth/v1/callback`), e é o Supabase que
devolve a pessoa para o site. Como esse endereço não mudou, o cadastro no
Google Cloud continua valendo.

O que faz o Google funcionar no domínio novo é o **Passo 3** (a lista de
Redirect URLs do Supabase) — que você já fez.

✅ **Teste:** entre em `https://misterolympia2026.online/entrar` numa aba
anônima e clique em **Entrar com Google**. Tem que voltar logado.

---

## Passo 6 — Teste final, de ponta a ponta

Numa aba anônima, no endereço novo:

1. `/` → a home carrega e mostra o evento
2. `/loja` → os ingressos aparecem com preço
3. Criar conta → o e-mail de confirmação chega com link do domínio novo
4. Comprar um ingresso → o Mercado Pago abre e, ao voltar, aparece
   **✓ Acesso garantido**
5. `/status` → só a Cloudflare em amarelo (é o que ainda falta)

---

## Onde o endereço antigo ainda aparece

Nada disso é problema, mas é bom saber:

- **`clan-maromba.vercel.app`** continua respondendo e, depois do *Set as
  Primary*, redireciona para o domínio novo.
- **E-mails de recuperação de senha antigos** apontam para o endereço velho.
  Continuam funcionando pelo redirecionamento.
- **O nome do projeto na Vercel e no GitHub** segue `clan-maromba`. É nome
  interno, ninguém vê.
