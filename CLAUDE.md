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

## Fases (aprovação do dono entre elas)

- **Fase 0 (feita):** esqueleto + página `/status` (testa conexões) + guia
  `docs/fase-0-configuracao.md`.
- **Fase 1 (MVP):** cadastro/login (Supabase) → página da live com compra →
  Checkout Pro em teste → liberação via webhook assinado → player HLS.js com
  token assinado renovável → marca d'água → sessão única → admin mínimo
  (criar live, ver RTMP+key, no ar/encerrada, compradores, banir/derrubar) →
  logs de auditoria. Termina com teste completo junto com o dono.
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
npm run build      # build de produção
```

CI roda lint + typecheck + build em todo push (`.github/workflows/ci.yml`).

## Convenções

- Todo texto voltado ao usuário em pt-BR; código/identificadores em pt-BR
  simples (já usado em `src/lib/env.ts` e `src/lib/checks.ts`).
- Tema escuro fixo, mobile-first; tokens de cor em `src/app/globals.css`.
- A página `/status` nunca exibe valores de chaves — só "ok/erro/faltando".
  A partir da Fase 1 ela deve ficar restrita ao admin.
