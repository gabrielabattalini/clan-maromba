"use client";

import { useActionState, useState } from "react";

import type { EstadoFormulario } from "@/lib/tipos";

type Props = {
  acao: () => Promise<EstadoFormulario>;
  titulo: string;
};

/**
 * Apagar é definitivo, então pede confirmação antes.
 * O primeiro clique só troca o botão; o segundo é que apaga.
 */
export function BotaoApagarLive({ acao, titulo }: Props) {
  const [estado, apagar, apagando] = useActionState<EstadoFormulario, FormData>(
    acao,
    null,
  );
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {estado?.erro ? (
        <p className="aviso aviso-erro" role="alert">
          {estado.erro}
        </p>
      ) : null}

      {confirmando ? (
        <>
          <p className="text-sm">
            Apagar <strong>{titulo}</strong> de vez? Isto não tem volta — a
            página da live sai do ar e o canal de transmissão é removido da
            Cloudflare.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={apagar}>
              <button className="botao" type="submit" disabled={apagando}>
                {apagando ? "Apagando…" : "Sim, apagar"}
              </button>
            </form>
            <button
              className="botao botao-secundario"
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={apagando}
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <button
          className="botao botao-secundario self-start"
          type="button"
          onClick={() => setConfirmando(true)}
        >
          Apagar esta live
        </button>
      )}
    </div>
  );
}
