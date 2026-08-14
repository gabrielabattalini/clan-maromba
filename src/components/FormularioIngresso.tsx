"use client";

import { useActionState } from "react";

import { criarIngresso } from "@/app/admin/acoes";
import type { EstadoFormulario } from "@/lib/tipos";

export function FormularioIngresso({ liveId }: { liveId: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    criarIngresso.bind(null, liveId),
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {estado?.erro ? (
        <p className="aviso aviso-erro" role="alert">
          {estado.erro}
        </p>
      ) : null}
      {estado?.aviso ? (
        <p className="aviso aviso-ok" role="status">
          {estado.aviso}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="rotulo" htmlFor="nome">
            Nome do ingresso
          </label>
          <input
            className="campo"
            id="nome"
            name="nome"
            placeholder="Dia 3 — Sábado 26/09"
            required
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="ordem">
            Ordem
          </label>
          <input className="campo" id="ordem" name="ordem" inputMode="numeric" placeholder="0" />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao">
          Descrição (opcional)
        </label>
        <input
          className="campo"
          id="descricao"
          name="descricao"
          placeholder="Prejudging e finais, com comentário ao vivo"
        />
      </div>

      <fieldset className="rounded-lg border border-borda p-4">
        <legend className="px-1.5 text-sm font-semibold">Preço</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="preco">
              Preço agora
            </label>
            <input
              className="campo"
              id="preco"
              name="preco"
              inputMode="decimal"
              placeholder="9,90"
              required
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="preco_cheio">
              Preço cheio
            </label>
            <input
              className="campo"
              id="preco_cheio"
              name="preco_cheio"
              inputMode="decimal"
              placeholder="39,90"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="promocao_ate">
              Promoção até
            </label>
            <input
              className="campo"
              id="promocao_ate"
              name="promocao_ate"
              type="datetime-local"
            />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-texto-apagado">
          O <strong>preço cheio</strong> é o que aparece riscado — e é o que o
          site <strong>passa a cobrar de verdade</strong> quando o prazo vencer.
          Por isso o contador na tela é honesto. Deixe os dois últimos em branco
          para vender sem promoção.
        </p>
      </fieldset>

      <fieldset className="rounded-lg border border-borda p-4">
        <legend className="px-1.5 text-sm font-semibold">
          Quando este ingresso dá acesso
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="inicia_em">
              Começa
            </label>
            <input className="campo" id="inicia_em" name="inicia_em" type="datetime-local" />
          </div>
          <div>
            <label className="rotulo" htmlFor="termina_em">
              Termina
            </label>
            <input className="campo" id="termina_em" name="termina_em" type="datetime-local" />
          </div>
          <div>
            <label className="rotulo" htmlFor="limite">
              Limite
            </label>
            <input className="campo" id="limite" name="limite" inputMode="numeric" placeholder="sem limite" />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-texto-apagado">
          Horário de <strong>Brasília</strong>. Deixe os dois em branco para o
          passe completo, que vale a transmissão inteira. Para as finais, use
          fim depois da meia-noite (ex.: 27/09 às 03:00) — assim o acesso não
          corta no meio.
        </p>

        <label className="mt-4 flex items-start gap-2.5 border-t border-borda pt-4 text-sm">
          <input
            className="mt-0.5 size-4 shrink-0 accent-[var(--destaque)]"
            type="checkbox"
            name="so_bolao"
            value="sim"
          />
          <span>
            <strong>Só o bolão</strong> — dá direito a palpitar e{" "}
            <strong>não</strong> abre a transmissão. Use para vender a
            participação no bolão à parte, para quem não vai assistir.
          </span>
        </label>
      </fieldset>

      <button className="botao self-start" type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Adicionar ingresso"}
      </button>
    </form>
  );
}
