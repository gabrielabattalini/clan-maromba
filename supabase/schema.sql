-- ============================================================
-- Clan Maromba — estrutura do banco de dados (Fase 1)
-- ============================================================
-- COMO USAR (você não precisa entender o que está escrito aqui):
--   1. Abra https://supabase.com/dashboard e entre no projeto clan-maromba
--   2. Menu da esquerda → "SQL Editor" → botão "New query"
--   3. Copie TODO o conteúdo deste arquivo e cole lá
--   4. Clique em "Run" (ou Ctrl+Enter)
--   5. Deve aparecer "Success. No rows returned" — é isso mesmo.
--
-- Pode rodar de novo quantas vezes quiser: nada é apagado nem duplicado.
--
-- No FINAL do arquivo tem um comando extra para te tornar administrador.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PERFIS — os dados públicos de cada conta criada
-- ------------------------------------------------------------
create table if not exists public.perfis (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text        not null default '',
  email      text        not null default '',
  admin      boolean     not null default false,
  banido     boolean     not null default false,
  criado_em  timestamptz not null default now()
);

-- Quando alguém se cadastra, o perfil nasce junto automaticamente.
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- O gatilho acima só vale para quem se cadastrar DEPOIS daqui. Se você já
-- tinha criado sua conta antes de rodar este arquivo, o perfil dela não
-- existiria — e aí o comando de virar administrador, lá no final, não
-- acharia ninguém. Esta linha cria os perfis que estiverem faltando.
insert into public.perfis (id, nome, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'nome', ''),
  coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- LIVES — cada transmissão é um evento avulso com preço próprio
-- ------------------------------------------------------------
create table if not exists public.lives (
  id              uuid primary key default gen_random_uuid(),
  slug            text        not null unique,
  titulo          text        not null,
  descricao       text        not null default '',
  -- Quando acontece: os TRÊS campos são opcionais, de propósito.
  --   nada preenchido      -> "Data a definir" (dá para vender assim)
  --   só dia_inicio        -> "18 de setembro"
  --   dia_inicio + dia_fim -> "18 a 21 de setembro" (evento de vários dias)
  --   + hora               -> "..., a partir das 21h"
  dia_inicio      date,
  dia_fim         date,
  hora            time,
  preco_centavos  integer     not null check (preco_centavos >= 0),
  estado          text        not null default 'rascunho'
                  check (estado in ('rascunho', 'anunciada', 'no_ar', 'encerrada')),
  criado_em       timestamptz not null default now()
);

-- Para quem já rodou a versão anterior deste arquivo.
alter table public.lives add column if not exists dia_inicio date;
alter table public.lives add column if not exists dia_fim    date;
alter table public.lives add column if not exists hora       time;

-- A versão antiga guardava data e hora juntas em `comeca_em`, o que obrigava
-- a saber o horário exato. Isto passa o conteúdo para os campos novos e
-- remove a coluna. Roda uma vez; depois disso não faz mais nada.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lives'
      and column_name = 'comeca_em'
  ) then
    update public.lives
       set dia_inicio = coalesce(dia_inicio, (comeca_em at time zone 'America/Sao_Paulo')::date),
           hora       = coalesce(hora,       (comeca_em at time zone 'America/Sao_Paulo')::time)
     where comeca_em is not null;

    alter table public.lives drop column comeca_em;
  end if;
end $$;

-- Fim antes do começo é engano de digitação.
alter table public.lives drop constraint if exists lives_dias_coerentes;
alter table public.lives add constraint lives_dias_coerentes
  check (dia_fim is null or dia_inicio is null or dia_fim >= dia_inicio);

-- ------------------------------------------------------------
-- LIVES_PRIVADO — a chave de transmissão do OBS mora aqui.
-- Esta tabela NÃO tem nenhuma permissão de leitura: nem um usuário
-- logado, nem o navegador conseguem chegar nela. Só o servidor.
-- ------------------------------------------------------------
create table if not exists public.lives_privado (
  live_id        uuid primary key references public.lives (id) on delete cascade,
  cf_input_uid   text,
  cf_rtmps_url   text,
  cf_stream_key  text,
  atualizado_em  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INGRESSOS — os produtos à venda de uma live
-- ------------------------------------------------------------
-- Uma live pode ter vários ingressos: um por dia, um passe completo,
-- lote promocional. Cada um com seu preço e sua janela de validade.
--
-- A janela é em data-e-hora, não em "dia", de propósito: as finais do
-- Mister Olympia começam 22h de sábado e terminam 3h de domingo no horário
-- do Brasil. Com "dia" o acesso cortaria à meia-noite, bem no clímax.
-- ------------------------------------------------------------
create table if not exists public.ingressos (
  id                    uuid primary key default gen_random_uuid(),
  live_id               uuid        not null references public.lives (id) on delete cascade,
  nome                  text        not null,
  descricao             text        not null default '',

  preco_centavos        integer     not null check (preco_centavos >= 0),
  -- Preço cheio, para o "de / por". Só preencha se for preço realmente
  -- praticado: riscar um valor que nunca existiu é propaganda enganosa.
  preco_cheio_centavos  integer     check (preco_cheio_centavos is null or preco_cheio_centavos > 0),
  -- Quando a promoção acaba. Passou disso, o site cobra o preço cheio de
  -- verdade — o contador na tela não é enfeite.
  promocao_ate          timestamptz,

  -- Janela de acesso. Os dois nulos = passe completo (vale a live toda).
  inicia_em             timestamptz,
  termina_em            timestamptz,

  -- Limite real de vendas. Nulo = sem limite.
  limite                integer     check (limite is null or limite > 0),

  ordem                 integer     not null default 0,
  ativo                 boolean     not null default true,
  criado_em             timestamptz not null default now(),

  -- Ingresso que dá SÓ o bolão: não abre o player. Sem esta coluna, um
  -- ingresso barato sem janela seria lido como passe completo e liberaria a
  -- transmissão inteira.
  so_bolao              boolean not null default false,

  constraint ingressos_janela_coerente
    check (termina_em is null or inicia_em is null or termina_em > inicia_em),
  constraint ingressos_promocao_faz_sentido
    check (promocao_ate is null or preco_cheio_centavos is not null)
);

create index if not exists ingressos_da_live_idx on public.ingressos (live_id, ordem);

-- ------------------------------------------------------------
-- COMPRAS — quem comprou o acesso a qual live
-- ------------------------------------------------------------
create table if not exists public.compras (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid        not null references auth.users (id) on delete cascade,
  live_id           uuid        not null references public.lives (id) on delete cascade,
  status            text        not null default 'pendente'
                    check (status in ('pendente', 'aprovada', 'recusada', 'reembolsada')),
  valor_centavos    integer     not null,
  mp_preference_id  text,
  mp_payment_id     text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  unique (usuario_id, live_id)
);

-- Uma compra agora é de um INGRESSO, não da live inteira. A coluna é
-- opcional para não quebrar o que já existe; o backfill logo abaixo liga
-- as compras antigas ao ingresso padrão da live.
alter table public.ingressos add column if not exists so_bolao boolean not null default false;

alter table public.compras add column if not exists ingresso_id uuid
  references public.ingressos (id) on delete set null;

-- A regra antiga era "uma compra por live". Com vários ingressos, a pessoa
-- pode comprar o Dia 1 e o Dia 2 — a regra passaria a ser por ingresso.
--
-- Mas o ticket de bolão pode ser comprado várias vezes pela mesma pessoa:
-- cada ticket é UMA entrada, e o palpite não pode ser alterado depois de
-- enviado — quem quiser mudar compra outra entrada. Por isso a unicidade no
-- banco saiu: quem barra a compra repetida de um ingresso de assistir é
-- `comprarIngresso`, que sabe distinguir os dois casos.
alter table public.compras drop constraint if exists compras_usuario_id_live_id_key;
drop index if exists compras_uma_por_ingresso;

create index if not exists compras_live_idx on public.compras (live_id);
create index if not exists compras_ingresso_idx on public.compras (ingresso_id);

-- Toda live precisa de pelo menos um ingresso à venda. Lives criadas antes
-- desta mudança ganham um padrão, com o preço que já tinham.
insert into public.ingressos (live_id, nome, descricao, preco_centavos, ordem)
select l.id, 'Acesso à live', '', l.preco_centavos, 0
  from public.lives l
 where not exists (select 1 from public.ingressos i where i.live_id = l.id);

update public.compras c
   set ingresso_id = (
     select i.id
       from public.ingressos i
      where i.live_id = c.live_id
      order by i.ordem, i.criado_em
      limit 1
   )
 where c.ingresso_id is null;
create index if not exists compras_pagamento_idx on public.compras (mp_payment_id);

-- ------------------------------------------------------------
-- SESSOES_ATIVAS — 1 linha por pessoa = 1 aparelho por vez
-- ------------------------------------------------------------
create table if not exists public.sessoes_ativas (
  usuario_id  uuid primary key references auth.users (id) on delete cascade,
  sessao_id   uuid        not null,
  ip          text,
  navegador   text,
  criado_em   timestamptz not null default now(),
  visto_em    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- LOGS_AUDITORIA — quem assistiu o quê, quando e de qual IP
-- ------------------------------------------------------------
create table if not exists public.logs_auditoria (
  id          bigserial primary key,
  usuario_id  uuid references auth.users (id) on delete set null,
  live_id     uuid references public.lives (id) on delete set null,
  acao        text        not null,
  ip          text,
  navegador   text,
  detalhes    jsonb,
  criado_em   timestamptz not null default now()
);

create index if not exists logs_recentes_idx on public.logs_auditoria (criado_em desc);

-- ------------------------------------------------------------
-- BOLÃO — palpite grátis nas categorias, com ranking por pontos
-- ------------------------------------------------------------
-- Entrada é de graça e o prêmio sai do bolso do dono: assim é promoção,
-- não aposta. Cobrar para participar e pagar o vencedor com o bolo
-- arrecadado exigiria licença federal e é proibido pelo Mercado Pago —
-- perderíamos a conta que recebe os ingressos.

create table if not exists public.bolao_categorias (
  id          uuid primary key default gen_random_uuid(),
  live_id     uuid        not null references public.lives (id) on delete cascade,
  nome        text        not null,
  -- Depois deste instante o palpite tranca. Sem isso alguém palpitaria
  -- já sabendo o resultado.
  fecha_em    timestamptz not null,
  -- Prêmio desta categoria, anunciado antes de abrir a venda. Fixo: é o que
  -- separa concurso de banca.
  premio      text        not null default '',
  ordem       integer     not null default 0,
  criado_em   timestamptz not null default now()
);

alter table public.bolao_categorias add column if not exists premio text not null default '';
-- Um ticket de bolão vale para UMA categoria. Quem quer palpitar nas três
-- compra três. A coluna vive aqui, e não em bolao_categorias, porque quem
-- manda no preço e no limite continua sendo o ingresso.
alter table public.ingressos add column if not exists categoria_bolao_id uuid
  references public.bolao_categorias (id) on delete cascade;


create index if not exists bolao_categorias_da_live_idx
  on public.bolao_categorias (live_id, ordem);

create table if not exists public.bolao_atletas (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid    not null references public.bolao_categorias (id) on delete cascade,
  nome          text    not null,
  ordem         integer not null default 0
);

create index if not exists bolao_atletas_da_categoria_idx
  on public.bolao_atletas (categoria_id, ordem);

-- O palpite tem as cinco posições em colunas, e não uma linha por posição:
-- é sempre exatamente um top 5, e assim o banco garante isso sozinho.
create table if not exists public.bolao_palpites (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid not null references public.bolao_categorias (id) on delete cascade,
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  atleta_1      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_2      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_3      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_4      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_5      uuid not null references public.bolao_atletas (id) on delete cascade,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Uma entrada por ticket comprado. O palpite é imutável depois de
  -- enviado; quem quiser outro palpite compra outro ticket.
  compra_id     uuid references public.compras (id) on delete cascade,
  unique (compra_id),
  -- Cinco atletas diferentes. Comparação par a par porque o Postgres não
  -- aceita subconsulta dentro de check.
  constraint bolao_palpite_sem_repetido check (
    atleta_1 <> atleta_2 and atleta_1 <> atleta_3 and atleta_1 <> atleta_4 and
    atleta_1 <> atleta_5 and atleta_2 <> atleta_3 and atleta_2 <> atleta_4 and
    atleta_2 <> atleta_5 and atleta_3 <> atleta_4 and atleta_3 <> atleta_5 and
    atleta_4 <> atleta_5
  )
);

-- Migração para quem rodou a versão em que o palpite podia ser corrigido.
alter table public.bolao_palpites add column if not exists compra_id uuid
  references public.compras (id) on delete cascade;

alter table public.bolao_palpites drop constraint if exists bolao_palpites_categoria_id_usuario_id_key;

create unique index if not exists bolao_palpites_uma_por_compra
  on public.bolao_palpites (compra_id)
  where compra_id is not null;

create index if not exists bolao_palpites_da_categoria_idx
  on public.bolao_palpites (categoria_id);

create table if not exists public.bolao_resultados (
  categoria_id  uuid primary key references public.bolao_categorias (id) on delete cascade,
  atleta_1      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_2      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_3      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_4      uuid not null references public.bolao_atletas (id) on delete cascade,
  atleta_5      uuid not null references public.bolao_atletas (id) on delete cascade,
  publicado_em  timestamptz not null default now(),
  constraint bolao_resultado_sem_repetido check (
    atleta_1 <> atleta_2 and atleta_1 <> atleta_3 and atleta_1 <> atleta_4 and
    atleta_1 <> atleta_5 and atleta_2 <> atleta_3 and atleta_2 <> atleta_4 and
    atleta_2 <> atleta_5 and atleta_3 <> atleta_4 and atleta_3 <> atleta_5 and
    atleta_4 <> atleta_5
  )
);

-- O prêmio é texto livre porque quem escreve é o dono, e ele muda de
-- evento para evento ("acesso às próximas 3 lives", "R$ 500 no Pix").
alter table public.lives add column if not exists bolao_premio text not null default '';

-- ------------------------------------------------------------
-- CHAT — conversa ao vivo, só para quem está assistindo
-- ------------------------------------------------------------
create table if not exists public.mensagens_chat (
  id          bigserial primary key,
  live_id     uuid not null references public.lives (id) on delete cascade,
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  -- O apelido fica gravado na própria mensagem, e não é buscado no perfil na
  -- hora de mostrar: o RLS de `perfis` só deixa cada um ver o próprio, então
  -- sem isto a mensagem chegaria ao vivo sem nome nenhum.
  apelido     text not null default '',
  do_dono     boolean not null default false,
  texto       text not null check (char_length(texto) between 1 and 300),
  -- Mensagem apagada não some da tabela: some da tela. O registro fica para
  -- o dono conseguir provar o que aconteceu se precisar banir alguém.
  apagada     boolean not null default false,
  criado_em   timestamptz not null default now()
);

create index if not exists mensagens_da_live_idx
  on public.mensagens_chat (live_id, id desc);

-- Silenciar é temporário e por live: castigo de 10 minutos resolve quase
-- tudo sem precisar banir a conta de quem pagou ingresso.
create table if not exists public.chat_silenciados (
  live_id     uuid not null references public.lives (id) on delete cascade,
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  ate         timestamptz not null,
  primary key (live_id, usuario_id)
);

alter table public.lives add column if not exists chat_ligado boolean not null default true;
-- Segundos que cada pessoa espera entre uma mensagem e outra. É a defesa que
-- funciona sozinha enquanto o dono está comentando e não pode moderar.
alter table public.lives add column if not exists chat_modo_lento integer not null default 5;

-- O Realtime só entrega as mensagens novas se a tabela estiver publicada.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'mensagens_chat'
  ) then
    alter publication supabase_realtime add table public.mensagens_chat;
  end if;
end $$;

-- ------------------------------------------------------------
-- LIMITES_TAXA — trava tentativa em excesso (login, compra, token)
-- ------------------------------------------------------------
create table if not exists public.limites_taxa (
  chave      text        not null,
  janela     timestamptz not null,
  contagem   integer     not null default 0,
  primary key (chave, janela)
);

create or replace function public.registrar_tentativa(
  p_chave   text,
  p_janela  timestamptz,
  p_limite  integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contagem integer;
begin
  insert into public.limites_taxa (chave, janela, contagem)
  values (p_chave, p_janela, 1)
  on conflict (chave, janela)
    do update set contagem = public.limites_taxa.contagem + 1
  returning contagem into v_contagem;

  -- limpeza preguiçosa das janelas velhas
  delete from public.limites_taxa where janela < now() - interval '2 hours';

  return v_contagem <= p_limite;
end;
$$;

-- ============================================================
-- SEGURANÇA (RLS) — regra de ouro do projeto
-- ============================================================
-- Ligamos a trava em TODAS as tabelas. Sem uma permissão explícita
-- abaixo, ninguém lê nada pelo navegador. Tudo que é sensível passa
-- pelo servidor, que usa a chave secreta.
-- ============================================================

alter table public.perfis          enable row level security;
alter table public.lives           enable row level security;
alter table public.lives_privado   enable row level security;
alter table public.ingressos       enable row level security;
alter table public.compras         enable row level security;
alter table public.bolao_categorias enable row level security;
alter table public.bolao_atletas    enable row level security;
alter table public.bolao_palpites   enable row level security;
alter table public.bolao_resultados enable row level security;
alter table public.mensagens_chat   enable row level security;
alter table public.chat_silenciados enable row level security;
alter table public.sessoes_ativas  enable row level security;
alter table public.logs_auditoria  enable row level security;
alter table public.limites_taxa    enable row level security;

-- Cada pessoa enxerga apenas o próprio perfil.
-- (Alterar o perfil só acontece pelo servidor — assim ninguém se
--  promove a administrador sozinho.)
drop policy if exists "perfil proprio" on public.perfis;
create policy "perfil proprio" on public.perfis
  for select using (auth.uid() = id);

-- Qualquer visitante enxerga as lives publicadas. Rascunho é só seu.
drop policy if exists "lives publicadas" on public.lives;
create policy "lives publicadas" on public.lives
  for select using (estado <> 'rascunho');

-- Os ingressos de uma live anunciada são públicos — é a vitrine.
drop policy if exists "ingressos de lives publicas" on public.ingressos;
create policy "ingressos de lives publicas" on public.ingressos
  for select using (
    exists (
      select 1 from public.lives l
       where l.id = ingressos.live_id
         and l.estado <> 'rascunho'
    )
  );

-- Categorias, atletas e resultado do bolão são propaganda: público.
drop policy if exists "bolao categorias publicas" on public.bolao_categorias;
create policy "bolao categorias publicas" on public.bolao_categorias
  for select using (
    exists (
      select 1 from public.lives l
       where l.id = bolao_categorias.live_id
         and l.estado <> 'rascunho'
    )
  );

drop policy if exists "bolao atletas publicos" on public.bolao_atletas;
create policy "bolao atletas publicos" on public.bolao_atletas
  for select using (true);

drop policy if exists "bolao resultados publicos" on public.bolao_resultados;
create policy "bolao resultados publicos" on public.bolao_resultados
  for select using (true);

-- Palpite alheio só depois que a categoria fecha. Antes disso, ver o
-- palpite dos outros seria copiar de quem entende — e o ranking perderia
-- a graça. Depois de fechada, é público: é o que faz o ranking existir.
drop policy if exists "palpite proprio ou ja fechado" on public.bolao_palpites;
create policy "palpite proprio ou ja fechado" on public.bolao_palpites
  for select using (
    auth.uid() = usuario_id
    or exists (
      select 1 from public.bolao_categorias c
       where c.id = bolao_palpites.categoria_id
         and c.fecha_em <= now()
    )
  );

-- O chat é lido direto pelo navegador (é assim que a mensagem aparece na
-- hora, sem recarregar), então esta política é a tranca de verdade: só quem
-- pagou por esta live enxerga a conversa.
--
-- Mensagem apagada continua legível por aqui de propósito. O navegador
-- precisa receber o aviso de que ela foi apagada para tirá-la da tela de
-- quem já estava com ela aberta — se a política a escondesse, o aviso não
-- chegaria e a mensagem ficaria para sempre na tela de quem viu.
drop policy if exists "chat de quem comprou" on public.mensagens_chat;
create policy "chat de quem comprou" on public.mensagens_chat
  for select using (
    exists (
      select 1 from public.compras c
       where c.live_id = mensagens_chat.live_id
         and c.usuario_id = auth.uid()
         and c.status = 'aprovada'
    )
  );

-- Cada pessoa enxerga apenas as próprias compras.
drop policy if exists "compras proprias" on public.compras;
create policy "compras proprias" on public.compras
  for select using (auth.uid() = usuario_id);

-- Cada pessoa enxerga apenas a própria sessão.
drop policy if exists "sessao propria" on public.sessoes_ativas;
create policy "sessao propria" on public.sessoes_ativas
  for select using (auth.uid() = usuario_id);

-- lives_privado, logs_auditoria, limites_taxa e chat_silenciados ficam SEM
-- nenhuma permissão de propósito: são exclusivas do servidor.

-- A função de limite de tentativas também não fica exposta.
revoke execute on function public.registrar_tentativa(text, timestamptz, integer)
  from public, anon, authenticated;

-- ============================================================
-- ÚLTIMO PASSO — vire administrador
-- ============================================================
-- 1. Primeiro crie sua conta no site, em /cadastro
-- 2. Depois volte aqui, troque o e-mail na linha abaixo pelo SEU,
--    tire os dois tracinhos do começo e clique em Run de novo:
--
-- update public.perfis set admin = true where email = 'seu-email@exemplo.com';
