"use client";

import { useActionState } from "react";

import type { EstadoFormulario } from "@/lib/tipos";

type Props = {
  modo: "pedir" | "definir";
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
};

export function FormularioSenha({ modo, acao }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(acao, null);
  const pedindo = modo === "pedir";

  // Depois que o e-mail sai, o formulário some: repetir o envio não ajuda
  // ninguém e só faz a pessoa achar que não funcionou.
  if (pedindo && estado?.aviso) {
    return (
      <p className="aviso aviso-ok" role="status">
        {estado.aviso}
      </p>
    );
  }

  return (
    <form action={enviar} className="flex w-full flex-col gap-4">
      {estado?.erro ? (
        <p className="aviso aviso-erro" role="alert">
          {estado.erro}
        </p>
      ) : null}

      {pedindo ? (
        <div>
          <label className="rotulo" htmlFor="email">
            E-mail da sua conta
          </label>
          <input
            className="campo"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        </div>
      ) : (
        <>
          <div>
            <label className="rotulo" htmlFor="senha">
              Nova senha
            </label>
            <input
              className="campo"
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="repetir">
              Repita a nova senha
            </label>
            <input
              className="campo"
              id="repetir"
              name="repetir"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        </>
      )}

      <button className="botao mt-1 w-full !py-3" type="submit" disabled={enviando}>
        {enviando
          ? "Aguarde…"
          : pedindo
            ? "Enviar link por e-mail"
            : "Salvar nova senha"}
      </button>
    </form>
  );
}
