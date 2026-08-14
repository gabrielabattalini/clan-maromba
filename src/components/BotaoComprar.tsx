"use client";

import { useActionState } from "react";

import type { EstadoFormulario } from "@/lib/tipos";

type Props = {
  acao: (anterior: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  rotulo: string;
};

export function BotaoComprar({ acao, rotulo }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(acao, null);

  return (
    <form action={enviar} className="flex w-full flex-col gap-3">
      {estado?.erro ? (
        <p className="aviso aviso-erro" role="alert">
          {estado.erro}
        </p>
      ) : null}

      <button className="botao w-full !py-3 !text-base" type="submit" disabled={enviando}>
        {enviando ? "Abrindo o pagamento…" : rotulo}
      </button>

      <p className="text-center text-xs leading-relaxed text-texto-apagado">
        Pix ou cartão, pelo Mercado Pago.
        <br />O acesso libera sozinho quando o pagamento é confirmado.
      </p>
    </form>
  );
}
