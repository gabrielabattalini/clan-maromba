"use client";

import { useEffect, useState } from "react";

/**
 * Conta o tempo que falta para a promoção acabar.
 *
 * Quando zera, o preço sobe de verdade — o servidor recalcula sozinho. Por
 * isso a página recarrega ao chegar em zero: para mostrar o preço novo em
 * vez de continuar exibindo um valor que não vale mais.
 */
export function Contador({ ate }: { ate: string }) {
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    const alvo = new Date(ate).getTime();

    function tique() {
      const falta = alvo - Date.now();
      setRestante(falta);
      if (falta <= 0) window.location.reload();
    }

    tique();
    const relogio = setInterval(tique, 1000);
    return () => clearInterval(relogio);
  }, [ate]);

  // Antes de montar no navegador não dá para saber a hora certa sem brigar
  // com o servidor, então não mostramos nada.
  if (restante === null) return null;
  if (restante <= 0) return null;

  const segundos = Math.floor(restante / 1000);
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segs = segundos % 60;

  const blocos: [number, string][] = dias > 0
    ? [[dias, "d"], [horas, "h"], [minutos, "min"]]
    : [[horas, "h"], [minutos, "min"], [segs, "s"]];

  return (
    <span className="numero inline-flex items-baseline gap-1.5 font-semibold tabular-nums">
      {blocos.map(([valor, unidade]) => (
        <span key={unidade}>
          {String(valor).padStart(2, "0")}
          <span className="text-[0.75em] text-texto-apagado">{unidade}</span>
        </span>
      ))}
    </span>
  );
}
