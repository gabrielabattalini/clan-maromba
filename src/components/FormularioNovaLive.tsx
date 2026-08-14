"use client";

import { useActionState } from "react";

import { criarLive } from "@/app/admin/acoes";
import type { EstadoFormulario } from "@/lib/tipos";

export function FormularioNovaLive() {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(criarLive, null);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {estado?.erro ? (
        <p className="aviso aviso-erro" role="alert">
          {estado.erro}
        </p>
      ) : null}

      <div>
        <label className="rotulo" htmlFor="titulo">
          Título da live
        </label>
        <input
          className="campo"
          id="titulo"
          name="titulo"
          type="text"
          placeholder="Ex.: Treino de peito e tríceps — ao vivo"
          required
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao">
          Descrição (opcional)
        </label>
        <textarea
          className="campo min-h-24 resize-y"
          id="descricao"
          name="descricao"
          placeholder="O que a pessoa vai ver nessa live?"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="comeca_em">
            Data e hora
          </label>
          <input className="campo" id="comeca_em" name="comeca_em" type="datetime-local" />
        </div>

        <div>
          <label className="rotulo" htmlFor="preco">
            Preço em reais
          </label>
          <input
            className="campo"
            id="preco"
            name="preco"
            type="text"
            inputMode="decimal"
            placeholder="19,90"
            required
          />
        </div>
      </div>

      <button className="botao self-start" type="submit" disabled={enviando}>
        {enviando ? "Criando…" : "Criar live"}
      </button>

      <p className="text-xs text-texto-fraco">
        A live nasce como <strong>rascunho</strong> — ninguém vê ainda. Na tela
        seguinte você pega os dados do OBS e escolhe quando anunciar.
      </p>
    </form>
  );
}
