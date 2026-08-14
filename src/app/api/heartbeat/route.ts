import { NextResponse } from "next/server";

import { contaAtual } from "@/lib/conta";
import { conferirSessaoUnica } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/**
 * O player chama esta rota a cada poucos segundos enquanto assiste.
 *
 * É assim que a "sessão única" funciona na prática: se alguém entrar na
 * mesma conta em outro aparelho, o registro no banco muda e a resposta
 * aqui passa a ser `valida: false` — o player para na hora.
 */
export async function POST() {
  const conta = await contaAtual();

  if (!conta) {
    return NextResponse.json(
      { valida: false, motivo: "sem_login" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (conta.perfil?.banido) {
    return NextResponse.json(
      { valida: false, motivo: "banido" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const sessao = await conferirSessaoUnica(conta.usuarioId);

  return NextResponse.json(
    { valida: sessao.valida, motivo: sessao.motivo },
    { headers: { "Cache-Control": "no-store" } },
  );
}
