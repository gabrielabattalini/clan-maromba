"use client";

import { useActionState } from "react";

import { criarBloco } from "@/app/admin/acoes";
import type { EstadoFormulario } from "@/lib/tipos";

export function FormularioBloco({ liveId }: { liveId: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    criarBloco.bind(null, liveId),
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

      <div>
        <label className="rotulo" htmlFor="bloco_nome">
          Nome do bloco
        </label>
        <input
          className="campo"
          id="bloco_nome"
          name="nome"
          placeholder="Dia 3 — Sábado 26/09 · FINAIS"
          required
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="bloco_descricao">
          Descrição (opcional)
        </label>
        <input
          className="campo"
          id="bloco_descricao"
          name="descricao"
          placeholder="Prejudging à tarde e a final do Mr. Olympia na madrugada"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="bloco_inicia">
            Começa
          </label>
          <input
            className="campo"
            id="bloco_inicia"
            name="inicia_em"
            type="datetime-local"
            required
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="bloco_termina">
            Termina (opcional)
          </label>
          <input
            className="campo"
            id="bloco_termina"
            name="termina_em"
            type="datetime-local"
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-texto-apagado">
        Horário de <strong>Brasília</strong>. Isto é só informação na página —
        não muda o que a pessoa pode assistir. O ingresso continua valendo a
        transmissão inteira.
      </p>

      <button className="botao self-start" type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Adicionar à programação"}
      </button>
    </form>
  );
}
