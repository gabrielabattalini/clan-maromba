# Clan Maromba — plataforma de lives pagas

Plataforma própria de transmissões ao vivo pagas: o criador transmite pelo OBS
(RTMP → Cloudflare Stream) e cada live é um evento avulso com preço próprio,
pago via Mercado Pago (Pix/cartão). Acesso individual com sessão única, player
com tokens assinados de curta duração e marca d'água dinâmica com os dados do
espectador.

**Stack:** Next.js (App Router, TypeScript) na Vercel · Supabase (login, banco,
RLS) · Cloudflare Stream (ingest RTMP + HLS com signed tokens) · Mercado Pago
Checkout Pro.

A especificação completa do produto está em
[`docs/especificacao.md`](docs/especificacao.md).

## Estado atual: Fase 0 (setup)

- ✅ Esqueleto Next.js (App Router, TypeScript, Tailwind 4, tema escuro, pt-BR)
- ✅ Página `/status` que testa a conexão com Supabase, Cloudflare Stream e
  Mercado Pago (sem nunca expor chaves)
- ✅ Guia de configuração das contas: [`docs/fase-0-configuracao.md`](docs/fase-0-configuracao.md)
- ✅ Decisões técnicas verificadas na documentação oficial: [`docs/arquitetura.md`](docs/arquitetura.md)
- ⬜ Fase 1 (MVP): cadastro/login → compra → webhook → player com token
  assinado → marca d'água → sessão única → admin mínimo
- ⬜ Fase 2: replay pago, cupons, e-mail de confirmação, chat, página inicial
- ⬜ Fase 3: produção (credenciais reais, domínio, checklist do dia da live)

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha seguindo docs/fase-0-configuracao.md
npm run dev                  # http://localhost:3000
```

Sem variáveis preenchidas o site sobe normalmente — a página `/status` apenas
mostra o que falta.

## Segurança (regras do projeto)

- Acesso à live é liberado **somente** pelo webhook do Mercado Pago com
  assinatura verificada — nunca pelo redirect de volta ao site.
- RLS ativado em todas as tabelas do Supabase.
- Stream key do OBS visível apenas no painel admin.
- Token de reprodução emitido apenas para sessão ativa + compra confirmada.
- Rate limiting nas rotas de login, compra e emissão de token.
- Segredos apenas em variáveis de ambiente (`.env.local` / Vercel) — nunca no
  código.
