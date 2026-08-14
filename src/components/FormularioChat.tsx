"use client";

import { useActionState } from "react";

import { ajustarChat } from "@/app/admin/acoes";
import type { EstadoFormulario } from "@/lib/tipos";

export function FormularioChat({
  liveId,
  ligado,
  modoLento,
}: {
  liveId: string;
  ligado: boolean;
  modoLento: number;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    ajustarChat.bind(null, liveId),
    null,
  );

  return (
    <form action={enviar} className="mt-4 flex flex-col gap-4">
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

      <div className="flex flex-wrap items-end gap-5">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            className="size-4 accent-[var(--destaque)]"
            type="checkbox"
            name="ligado"
            value="sim"
            defaultChecked={ligado}
          />
          Chat ligado
        </label>

        <div>
          <label className="rotulo" htmlFor="modo_lento">
            Segundos entre mensagens
          </label>
          <input
            className="campo max-w-28"
            id="modo_lento"
            name="modo_lento"
            inputMode="numeric"
            defaultValue={modoLento}
          />
        </div>

        <button className="botao botao-secundario" type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-texto-apagado">
        <strong>5 segundos</strong> é um bom padrão: não atrapalha a conversa e
        acaba com quem manda dez mensagens seguidas. Zero desliga a espera. A
        regra não vale para você.
      </p>
    </form>
  );
}
