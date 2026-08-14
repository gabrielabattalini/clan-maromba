"use client";

import { useState } from "react";

type Props = {
  rotulo: string;
  valor: string;
  secreto?: boolean;
};

/** Mostra um valor com botão de copiar. Segredos começam escondidos. */
export function CampoCopiavel({ rotulo, valor, secreto = false }: Props) {
  const [visivel, setVisivel] = useState(!secreto);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setVisivel(true);
    }
  }

  return (
    <div>
      <span className="rotulo">{rotulo}</span>
      <div className="flex items-stretch gap-2">
        <code className="campo overflow-x-auto whitespace-nowrap font-mono text-sm leading-6">
          {visivel ? valor : "•".repeat(Math.min(valor.length, 32))}
        </code>
        {secreto ? (
          <button
            className="botao botao-secundario shrink-0 !px-3"
            type="button"
            onClick={() => setVisivel((v) => !v)}
          >
            {visivel ? "Ocultar" : "Mostrar"}
          </button>
        ) : null}
        <button className="botao shrink-0 !px-3" type="button" onClick={copiar}>
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
