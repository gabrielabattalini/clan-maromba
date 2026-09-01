"use client";

import { useActionState } from "react";

import { conferirPagamento } from "@/app/admin/acoes";
import type { EstadoFormulario } from "@/lib/tipos";

/**
 * Pergunta ao Mercado Pago se a compra foi paga.
 *
 * A resposta aparece ao lado do botão porque "clicou e a tela ficou igual" é
 * o pior desfecho possível aqui: o dono não saberia se o site não achou o
 * pagamento, se achou e não liberou, ou se o clique nem chegou.
 */
export function BotaoConferirPagamento({ compraId }: { compraId: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    conferirPagamento.bind(null, compraId),
    null,
  );

  return (
    <form action={enviar} className="flex flex-col items-end gap-1">
      <button className="botao !px-3 !py-1.5 !text-xs" type="submit" disabled={enviando}>
        {enviando ? "Perguntando…" : "Conferir pagamento"}
      </button>

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
    </form>
  );
}
