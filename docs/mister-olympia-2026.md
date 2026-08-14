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

## Como usar

1. Supabase → **SQL Editor** → **New query**
2. Cole o bloco abaixo **inteiro**
3. Clique em **Run**

O comando acha a live pelo endereço (`slug`). O valor já vem preenchido com o
da sua live — é o que aparece depois de `/live/` quando você abre a live no
painel. Se não bater, o comando avisa em vez de fazer bobagem. Rodar duas
vezes **não duplica**: ele apaga os ingressos anteriores desta live antes de
recriar.

> ⚠️ Só rode antes de começar a vender. Depois que houver compra, apagar
> ingresso deixaria a compra órfã — daí em diante mexa pelo painel.

```sql
do $$
declare
  v_slug text := 'mister-olympia-2026-full-acess-3';  -- confira no painel
  v_live uuid;
begin
  select id into v_live from public.lives where slug = v_slug;
  if v_live is null then
    raise exception 'Não achei live com slug %. Confira em /admin.', v_slug;
  end if;

  if exists (select 1 from public.compras where live_id = v_live and status = 'aprovada') then
    raise exception 'Esta live já tem compra paga — não vou mexer nos ingressos.';
  end if;

  delete from public.ingressos where live_id = v_live;

  insert into public.ingressos
    (live_id, nome, descricao, preco_centavos, preco_cheio_centavos,
     promocao_ate, inicia_em, termina_em, limite, ordem)
  values
    -- PASSE COMPLETO: promoção de lançamento de verdade. Quando o prazo
    -- vencer, o site passa a cobrar R$ 39,90 sozinho.
    (v_live, 'Passe completo',
     'Os quatro dias, do começo ao fim. Inclui as finais de sábado.',
     2990, 3990,
     '2026-09-17 23:59:00-03', null, null, 100, 0),

    (v_live, 'Dia 1 — Quinta 24/09',
     'Expo, bastidores e meet & greet.',
     990, null, null,
     '2026-09-24 13:00:00-03', '2026-09-25 00:00:00-03', null, 1),

    (v_live, 'Dia 2 — Sexta 25/09',
     'Prejudging e as finais das primeiras divisões.',
     990, null, null,
     '2026-09-25 12:00:00-03', '2026-09-26 04:00:00-03', null, 2),

    (v_live, 'Dia 3 — Sábado 26/09 · FINAIS',
     'O dia do título. Prejudging à tarde e a final do Mr. Olympia na madrugada.',
     990, null, null,
     '2026-09-26 12:00:00-03', '2026-09-27 05:00:00-03', null, 3),

    (v_live, 'Dia 4 — Domingo 27/09',
     'Encerramento, resultados e análise.',
     990, null, null,
     '2026-09-27 13:00:00-03', '2026-09-27 23:00:00-03', null, 4);
end $$;
```

---

## O que cada número significa

**`2990` e `3990`** — R$ 29,90 agora, R$ 39,90 depois. O riscado na tela é o
preço cheio, e ele **passa a ser cobrado de verdade** quando a promoção vencer.
É o que faz o contador ser honesto em vez de enfeite.

**`'2026-09-17 23:59:00-03'`** — quando a promoção acaba. Mude para a data que
quiser; o contador na página segue este valor.

**`100`** — limite de passes completos. Quando esgotar, o botão trava sozinho e
a página mostra "Esgotado". Deixe `null` para não ter limite.

**As janelas** (`inicia_em` / `termina_em`) — quando aquele ingresso dá acesso
ao vídeo. Repare no Dia 3: termina **05:00 do dia 27**, não à meia-noite. As
finais viram a madrugada, e cortar o acesso no clímax seria o pior erro
possível.

**Passe completo tem as duas janelas em `null`** — vale a transmissão inteira.

---

## Opcional: arrumar o nome e as datas da live

Hoje a home anuncia **"Mister Olympia 2026 - Full acess"**, com "24 de setembro,
a partir das 15h". Duas coisas ficaram estranhas depois dos ingressos:

- o "Full acess" era o nome do produto, e agora quem faz esse papel é o
  ingresso **Passe completo** — no título ele só polui a manchete (e está
  escrito com um "s" a menos);
- falta o dia de fim, então o site anuncia um dia só em vez dos quatro.

Este comando arruma os dois. **Não mexe no endereço** (`slug`), então nenhum
link que você já tenha mandado para alguém quebra:

```sql
update public.lives
   set titulo = 'Mister Olympia 2026',
       dia_inicio = '2026-09-24',
       dia_fim = '2026-09-27',
       hora = null
 where slug = 'mister-olympia-2026-full-acess-3';
```

Depois disso a home passa a dizer **"24 a 27 de setembro"**. Tirei a hora
porque o horário de cada dia já está na tabela de programação — repetir "a
partir das 15h" na manchete brigaria com ela.

---

## Depois de rodar

Abra a home do site. Você deve ver:

- O passe completo em destaque, com **R$ 39,90 riscado**, **R$ 29,90** grande,
  o contador regressivo e "Restam 100 ingressos"
- Os quatro dias a R$ 9,90 cada
- A tabela **Programação**, em horário de Brasília, montada a partir das
  janelas dos próprios ingressos — uma fonte só, sem risco de a tabela dizer
  uma coisa e o acesso valer outra

Para ajustar qualquer coisa depois, use o painel: **/admin → a live → seção
Ingressos**.
