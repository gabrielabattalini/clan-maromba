# Especificação do produto — Clan Maromba

Registro da visão do dono do projeto (agosto/2026), para consulta em qualquer
fase. O dono é criador de conteúdo, fazia lives no Discord e quer plataforma
própria de transmissões ao vivo pagas.

## Requisitos do produto

1. Transmissão da tela **pelo OBS** (RTMP, com URL de servidor + chave de
   transmissão visíveis só para o dono, no painel admin).
2. Cada live é um **evento avulso com preço próprio** — compra por live
   específica (preço típico: R$ 10–30).
3. Pagamento em reais com **Pix e cartão via Mercado Pago (Checkout Pro)**,
   com webhook que libera o acesso automaticamente na aprovação.
4. **Acesso individual**: cadastro com e-mail e senha; **apenas 1 sessão ativa
   por conta** — login em outro dispositivo derruba a sessão anterior em
   poucos segundos.
5. Vídeo só toca para quem comprou: **tokens de reprodução assinados e de
   curta duração (~5 min, renovados automaticamente)** — link copiado não
   funciona para terceiros.
6. **Marca d'água dinâmica** sobre o vídeo: nome + e-mail (+ parte do IP) do
   espectador, semi-transparente, mudando de posição a cada poucos segundos,
   difícil de remover — para rastrear vazamentos.
7. **Painel admin** (só o dono): criar live (título, descrição, data, preço),
   ver URL RTMP + stream key para o OBS, marcar "no ar"/"encerrada", lista de
   compradores, banir/derrubar usuário na hora.
8. **Logs de auditoria**: quem assistiu, quando, de qual IP.

## Stack definida

Next.js (App Router, TypeScript) na Vercel · Supabase (login, banco, RLS,
sessão única) · Cloudflare Stream Live Inputs (RTMP do OBS + entrega com
signed tokens, menor latência disponível) · Mercado Pago Checkout Pro (com
validação de assinatura do webhook) · Visual limpo, tema escuro, mobile-first,
todo em pt-BR.

## Fases acordadas

- **Fase 0 — Setup:** contas, projeto, variáveis de ambiente. ✅
- **Fase 1 — MVP:** cadastro/login → página da live com compra → checkout em
  teste → liberação via webhook → player com token → marca d'água → sessão
  única → admin mínimo. Termina com teste completo com o dono (transmitir do
  OBS, assistir como comprador, tentar burlar as travas).
- **Fase 2 (após MVP aprovado):** replay pago (gravação automática), cupons de
  desconto, e-mail de confirmação de compra, chat ao vivo, home com próximas
  lives.
- **Fase 3 — Lançamento:** credenciais MP de produção, domínio próprio,
  checklist do dia da live (OBS: resolução/bitrate/keyframe; abrir/encerrar;
  o que verificar se algo der errado).

## Segurança — não negociável

- Nunca liberar acesso pelo redirect de "pagamento aprovado"; somente via
  webhook verificado.
- RLS em todas as tabelas do Supabase.
- Stream key visível apenas no admin.
- Tokens de reprodução apenas para sessão ativa + compra confirmada.
- Rate limiting em login, compra e emissão de token.

## Histórico

- **Fase 0 (12/08/2026):** projeto nasceu por engano dentro do repositório do
  Cupomzei (Guiadodesconto, PR #1, fechado sem merge) e foi movido para este
  repositório próprio a pedido do dono.
