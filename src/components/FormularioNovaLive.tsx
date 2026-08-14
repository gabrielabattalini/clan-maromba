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

      <fieldset className="rounded-lg border border-borda p-4">
        <legend className="px-1.5 text-sm font-semibold">Quando acontece</legend>
        <p className="mb-3 text-xs text-texto-fraco">
          Tudo aqui é opcional. Deixe em branco e a live é anunciada como{" "}
          <strong>&ldquo;Data a definir&rdquo;</strong> — dá para vender assim
          mesmo e avisar a data depois.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="dia_inicio">
              Primeiro dia
            </label>
            <input className="campo" id="dia_inicio" name="dia_inicio" type="date" />
          </div>

          <div>
            <label className="rotulo" htmlFor="dia_fim">
              Último dia
            </label>
            <input className="campo" id="dia_fim" name="dia_fim" type="date" />
            <p className="mt-1.5 text-xs text-texto-fraco">
              Só se durar mais de um dia.
            </p>
          </div>

          <div>
            <label className="rotulo" htmlFor="hora">
              Horário
            </label>
            <input className="campo" id="hora" name="hora" type="time" />
            <p className="mt-1.5 text-xs text-texto-fraco">
              Deixe vazio se ainda não sabe.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="sm:max-w-48">
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
