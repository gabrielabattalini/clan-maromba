# Mister Olympia 2026 — ingressos prontos para colar

Evento: **24 a 27 de setembro de 2026**, Las Vegas. Transmissão é o dono
comentando, do Brasil.

Las Vegas em setembro está **4 horas atrás** de Brasília (lá é horário de
verão; o Brasil não tem mais). Todos os horários abaixo já estão **em horário
de Brasília** — é o que o comprador vê e é o que vale no acesso.

| Bloco do evento | Las Vegas | **Brasília** |
|---|---|---|
| Qui 24 — expo, meet & greet | 10h–18h | 14h–22h |
| Sex 25 — prejudging + finais de divisões | 09h–22h | 13h → **02h de sábado** |
| Sáb 26 — prejudging | 09h–14h | 13h–18h |
| **Sáb 26 — FINAIS (Mr. Olympia)** | 18h–23h | **22h → 03h de domingo** |
| Dom 27 — encerramento | 10h–16h | 14h–20h |

As janelas dos ingressos são um pouco mais largas que os blocos oficiais, de
propósito: dá folga para atraso do evento e para o pré e pós-show.

---

## Antes: atualizar o banco (uma vez só)

A tabela `ingressos` **é nova**. Ela não existe no seu banco ainda, porque o
schema foi rodado antes desta entrega. Sem esse passo, o bloco de baixo dá
erro dizendo que a tabela não existe.

1. Abra o arquivo `supabase/schema.sql` deste projeto
2. Copie o arquivo **inteiro**
3. Supabase → **SQL Editor** → **New query** → cole → **Run**

Pode rodar sem medo mesmo já tendo rodado antes: o arquivo é feito para ser
colado várias vezes. Ele cria só o que falta e não apaga nada que já existe —
suas contas, sua live e seus logs continuam onde estão.

---

## Como usar

1. Supabase → **SQL Editor** → **New query**
2. Cole o bloco abaixo **inteiro**
3. Clique em **Run**

É **um ingresso só**, de R$ 19,90, valendo os quatro dias. Os ingressos de dia
saíram: com o passe a R$ 19,90, sexta + sábado avulsos custariam quase o
mesmo e o passe ficaria sem graça.

A tabela **Programação** continua na página — ela agora é informação do
evento, guardada à parte, e não a lista do que está à venda. O mesmo comando
recria os quatro blocos.

O comando acha a live **pelo nome**: qualquer live com "Olympia" no título.
Não depende do endereço, que muda sozinho quando você apaga e recria uma live.
Se achar nenhuma ou mais de uma, ele avisa e não faz nada. Rodar duas vezes
**não duplica**: ele apaga os ingressos anteriores desta live antes de recriar.

> ⚠️ Só rode antes de começar a vender. Depois que houver compra, apagar
> ingresso deixaria a compra órfã — daí em diante mexa pelo painel.

```sql
do $$
declare
  v_live uuid;
  v_quantas integer;
begin
  select count(*) into v_quantas
    from public.lives where titulo ilike '%olympia%';

  if v_quantas = 0 then
    raise exception 'Não achei nenhuma live com "Olympia" no nome. Crie a live em /admin antes.';
  end if;
  if v_quantas > 1 then
    raise exception 'Achei % lives com "Olympia" no nome. Apague as repetidas em /admin e rode de novo.', v_quantas;
  end if;

  select id into v_live from public.lives where titulo ilike '%olympia%';

  if exists (select 1 from public.compras where live_id = v_live and status = 'aprovada') then
    raise exception 'Esta live já tem compra paga — não vou mexer nos ingressos.';
  end if;

  -- Nome e datas da manchete.
  update public.lives
     set titulo = 'Mister Olympia 2026',
         dia_inicio = '2026-09-24',
         dia_fim = '2026-09-27',
         hora = null
   where id = v_live;

  -- ---------------- INGRESSO ÚNICO ----------------
  -- Um só, valendo os quatro dias. Os ingressos de dia saíram: com o passe a
  -- R$ 19,90, sexta + sábado avulsos custariam quase o mesmo, e o passe
  -- ficaria sem graça. Ingresso de bolão (so_bolao) não é apagado aqui.
  delete from public.ingressos where live_id = v_live and so_bolao = false;

  insert into public.ingressos
    (live_id, nome, descricao, preco_centavos, preco_cheio_centavos,
     promocao_ate, inicia_em, termina_em, limite, ordem)
  values
    (v_live, 'Acesso completo',
     'Os quatro dias, do começo ao fim. Inclui as finais de sábado.',
     1990, 2990,
     '2026-09-17 23:59:00-03', null, null, null, 0);

  -- ---------------- PROGRAMAÇÃO ----------------
  -- Só informação: aparece na home e na página da live, e não muda o que a
  -- pessoa pode assistir. Por isso dá para anunciar os quatro dias vendendo
  -- um ingresso só.
  delete from public.blocos_programacao where live_id = v_live;

  insert into public.blocos_programacao
    (live_id, nome, descricao, inicia_em, termina_em, ordem)
  values
    (v_live, 'Dia 1 — Quinta 24/09', 'Expo, bastidores e meet & greet.',
     '2026-09-24 13:00:00-03', '2026-09-25 00:00:00-03', 1),
    (v_live, 'Dia 2 — Sexta 25/09', 'Prejudging e as finais das primeiras divisões.',
     '2026-09-25 12:00:00-03', '2026-09-26 04:00:00-03', 2),
    (v_live, 'Dia 3 — Sábado 26/09 · FINAIS', 'O dia do título. Prejudging à tarde e a final do Mr. Olympia na madrugada.',
     '2026-09-26 12:00:00-03', '2026-09-27 05:00:00-03', 3),
    (v_live, 'Dia 4 — Domingo 27/09', 'Encerramento, resultados e análise.',
     '2026-09-27 13:00:00-03', '2026-09-27 23:00:00-03', 4);
end $$;
```

---

## O que cada número significa

**`1990` e `2990`** — R$ 19,90 agora, R$ 29,90 depois. O riscado na tela é o
preço cheio, e ele **passa a ser cobrado de verdade** quando a promoção vencer.
É o que faz o contador ser honesto em vez de enfeite.

**`'2026-09-17 23:59:00-03'`** — quando a promoção acaba. Mude para a data que
quiser; o contador na página segue este valor.

**`limite` em `null`** — sem limite de ingressos. Se quiser criar urgência de
verdade, ponha um número: o site mostra "Restam N" e trava sozinho quando
esgotar.

**As janelas do ingresso em `null`** — vale a transmissão inteira, os quatro
dias.

**Os horários dos blocos** são só a propaganda. Repare no Dia 3: vai até
**05:00 do dia 27**, porque as finais viram a madrugada no Brasil.

---

## O nome da live também muda

O bloco arruma a manchete de quebra. Ela era **"Mister Olympia 2026 - Full
acess"**, com "24 de setembro, a partir das 15h", e passa a ser **"Mister
Olympia 2026"**, com "24 a 27 de setembro".

O "Full acess" era nome de produto, e quem faz esse papel agora é o ingresso
**Passe completo** — no título ele só polui. Tirei a hora porque o horário de
cada dia já está na tabela de programação, com mais precisão. O **endereço da
live não muda**, então nenhum link que você já tenha mandado para alguém
quebra.

---

## Depois de rodar

Abra a home do site. Você deve ver:

- A manchete **Mister Olympia 2026**, com **24 a 27 de setembro** embaixo
- O **Acesso completo** em destaque, com **R$ 29,90 riscado**, **R$ 19,90**
  grande e o contador regressivo
- A tabela **Programação**, em horário de Brasília, montada a partir das
  janelas dos próprios ingressos — uma fonte só, sem risco de a tabela dizer
  uma coisa e o acesso valer outra

Para ajustar qualquer coisa depois, use o painel: **/admin → a live → seção
Ingressos**.
