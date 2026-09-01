"use client";

import { useActionState, useState } from "react";

import type { EstadoFormulario } from "@/lib/tipos";

type Props = {
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  rotulo: string;
  /** O que aparece no lugar do rótulo quando pede confirmação. */
  confirmacao: string;
  titulo?: string;
};

/**
 * Botão de ação que não tem volta, na lista de compradores.
 *
 * O primeiro clique só troca o texto; o segundo é que executa. É o mesmo
 * princípio do botão de apagar live, em tamanho de linha de lista — aqui os
 * botões ficam encostados uns nos outros e um clique errado tiraria o acesso
 * de quem pagou.
 */
export function BotaoDeRisco({ acao, rotulo, confirmacao, titulo }: Props) {
  const [estado, executar, executando] = useActionState<EstadoFormulario, FormData>(
    acao,
    null,
  );
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      {confirmando ? (
        <div className="flex gap-1">
          <form action={executar}>
            <button
              className="botao botao-perigo !px-3 !py-1.5 !text-xs"
              type="submit"
              disabled={executando}
            >
              {executando ? "…" : confirmacao}
            </button>
          </form>
          <button
            className="botao botao-secundario !px-3 !py-1.5 !text-xs"
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={executando}
          >
            Não
          </button>
        </div>
      ) : (
        <button
          className="botao botao-secundario !px-3 !py-1.5 !text-xs"
          type="button"
          title={titulo}
          onClick={() => setConfirmando(true)}
        >
          {rotulo}
        </button>
      )}

      {estado?.erro ? (
        <span className="max-w-64 text-right text-xs leading-snug text-erro">
          {estado.erro}
        </span>
      ) : null}
      {estado?.aviso ? (
        <span className="max-w-64 text-right text-xs leading-snug text-ok">
          {estado.aviso}
        </span>
      ) : null}
    </div>
  );
}
