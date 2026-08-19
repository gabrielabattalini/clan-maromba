"use client";

import { useActionState } from "react";

import { liberarCortesia } from "@/app/admin/acoes";
import type { EstadoFormulario } from "@/lib/tipos";

type Opcao = { id: string; nome: string };

/**
 * Dar acesso a alguém sem cobrar.
 *
 * Fica junto da lista de compradores porque o resultado aparece lá: a
 * cortesia entra como compra de R$ 0,00, com o mesmo nome e os mesmos botões
 * de derrubar e banir de quem pagou.
 */
export function FormularioCortesia({
  liveId,
  ingressos,
}: {
  liveId: string;
  ingressos: Opcao[];
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    liberarCortesia.bind(null, liveId),
    null,
  );

  if (ingressos.length === 0) {
    return (
      <p className="text-sm text-texto-fraco">
        Crie um ingresso antes de liberar cortesia.
      </p>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-3">
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

      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
        <div>
          <label className="rotulo" htmlFor="cortesia-email">
            E-mail da conta
          </label>
          <input
            className="campo"
            id="cortesia-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="pessoa@email.com"
            required
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="cortesia-ingresso">
            O que liberar
          </label>
          <select className="campo" id="cortesia-ingresso" name="ingresso" required>
            {ingressos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </div>

        <button
          className="botao botao-secundario sm:mb-0"
          type="submit"
          disabled={enviando}
        >
          {enviando ? "Liberando…" : "Liberar"}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-texto-apagado">
        A pessoa precisa já ter conta no site. O acesso entra como compra de
        R$ 0,00 e fica registrado no diário de auditoria.
      </p>
    </form>
  );
}
