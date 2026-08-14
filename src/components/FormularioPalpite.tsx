"use client";

import { useActionState, useState } from "react";

import { salvarPalpite } from "@/lib/acoes/palpite";
import type { BolaoAtleta, EstadoFormulario } from "@/lib/tipos";

const POSICOES = [
  { campo: "atleta_1", rotulo: "1º lugar" },
  { campo: "atleta_2", rotulo: "2º lugar" },
  { campo: "atleta_3", rotulo: "3º lugar" },
  { campo: "atleta_4", rotulo: "4º lugar" },
  { campo: "atleta_5", rotulo: "5º lugar" },
] as const;

type Props = {
  categoriaId: string;
  atletas: BolaoAtleta[];
  /** O que a pessoa já tinha palpitado, do 1º ao 5º. */
  escolhaAtual: string[];
};

export function FormularioPalpite({ categoriaId, atletas, escolhaAtual }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    salvarPalpite.bind(null, categoriaId),
    null,
  );

  const [escolhas, setEscolhas] = useState<string[]>(() =>
    POSICOES.map((_, i) => escolhaAtual[i] ?? ""),
  );

  function escolher(indice: number, valor: string) {
    setEscolhas((antes) => {
      const novo = [...antes];
      // Escolher alguém que já estava em outra posição tira ele de lá, em vez
      // de deixar a pessoa montar um palpite repetido e só descobrir no envio.
      const jaEstava = novo.indexOf(valor);
      if (valor && jaEstava !== -1) novo[jaEstava] = "";
      novo[indice] = valor;
      return novo;
    });
  }

  const faltam = escolhas.filter((e) => !e).length;

  return (
    <form action={enviar} className="mt-4 flex flex-col gap-3">
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

      {POSICOES.map(({ campo, rotulo }, indice) => (
        <div key={campo} className="flex items-center gap-3">
          <span className="numero w-16 shrink-0 text-sm font-bold text-texto-apagado">
            {rotulo}
          </span>
          <select
            className="campo flex-1"
            name={campo}
            aria-label={rotulo}
            value={escolhas[indice]}
            onChange={(evento) => escolher(indice, evento.target.value)}
            required
          >
            <option value="">Escolha o atleta…</option>
            {atletas.map((atleta) => (
              <option key={atleta.id} value={atleta.id}>
                {atleta.nome}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button className="botao" type="submit" disabled={enviando || faltam > 0}>
          {enviando ? "Guardando…" : "Guardar palpite"}
        </button>
        <span className="text-xs text-texto-apagado">
          {faltam > 0
            ? `Faltam ${faltam} ${faltam === 1 ? "posição" : "posições"}`
            : "Dá para mudar até os palpites fecharem"}
        </span>
      </div>
    </form>
  );
}
