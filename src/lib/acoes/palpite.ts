"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { registrar } from "@/lib/auditoria";
import { buscarCategoria, categoriaAberta, listarAtletas } from "@/lib/bolao";
import { supabaseServidorConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { comprouAlgumaCoisa } from "@/lib/ingressos";
import { podeTentar } from "@/lib/limite-taxa";
import { buscarLivePorId } from "@/lib/lives";
import { ipDoVisitante } from "@/lib/requisicao";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { EstadoFormulario } from "@/lib/tipos";

const POSICOES = ["atleta_1", "atleta_2", "atleta_3", "atleta_4", "atleta_5"] as const;

/**
 * Guarda o palpite de uma pessoa numa categoria.
 *
 * Dá para corrigir quantas vezes quiser até a categoria fechar. O que
 * **não** muda numa correção é o `criado_em`: ele é o último critério de
 * desempate do ranking, e teria de valer o primeiro envio, não o último —
 * senão corrigir uma vírgula jogaria a pessoa para o fim da fila.
 */
export async function salvarPalpite(
  categoriaId: string,
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const categoria = await buscarCategoria(categoriaId);
  if (!categoria) return { erro: "Categoria não encontrada." };

  const live = await buscarLivePorId(categoria.live_id);
  if (!live) return { erro: "Live não encontrada." };

  const conta = await contaAtual();
  if (!conta) {
    redirect(`/entrar?voltar=${encodeURIComponent(`/bolao/${live.slug}`)}`);
  }

  if (!supabaseServidorConfigurado) {
    return { erro: "O site ainda está sendo configurado. Tente mais tarde." };
  }
  if (conta.perfil?.banido) return { erro: "Esta conta está bloqueada." };

  // O bolão é benefício de quem comprou. Vale qualquer ingresso da live, e
  // não só o que cobre este instante: quem comprou o domingo palpita na
  // quinta, muito antes da janela dele abrir.
  const ehAdmin = Boolean(conta.perfil?.admin);
  if (!ehAdmin && !(await comprouAlgumaCoisa(conta.usuarioId, live.id))) {
    return { erro: "O bolão é para quem tem ingresso desta live." };
  }

  // A trava do horário é o que impede palpitar já sabendo o resultado.
  if (!categoriaAberta(categoria)) {
    return { erro: `Os palpites de ${categoria.nome} já estão fechados.` };
  }

  const ip = await ipDoVisitante();
  if (!(await podeTentar(`palpite:${ip}`, 30, 600))) {
    return { erro: "Muitas tentativas. Espere alguns minutos." };
  }

  const escolhidos = POSICOES.map((campo) => String(dados.get(campo) ?? "").trim());

  if (escolhidos.some((id) => !id)) {
    return { erro: "Escolha os cinco atletas, do 1º ao 5º lugar." };
  }
  if (new Set(escolhidos).size !== escolhidos.length) {
    return { erro: "Não repita o mesmo atleta em duas posições." };
  }

  // Os atletas têm de ser desta categoria: sem isto, um palpite montado à
  // mão poderia apontar para atleta de outra categoria — ou inexistente.
  const daCategoria = new Set(
    (await listarAtletas([categoria.id])).map((atleta) => atleta.id),
  );
  if (escolhidos.some((id) => !daCategoria.has(id))) {
    return { erro: "Atleta inválido. Recarregue a página e tente de novo." };
  }

  const linha = Object.fromEntries(
    POSICOES.map((campo, indice) => [campo, escolhidos[indice]]),
  );

  const { error } = await clienteAdmin()
    .from("bolao_palpites")
    .upsert(
      {
        categoria_id: categoria.id,
        usuario_id: conta.usuarioId,
        ...linha,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "categoria_id,usuario_id" },
    );

  if (error) {
    console.error("[palpite] falha ao salvar:", error.message);
    return { erro: "Não consegui salvar seu palpite. Tente de novo." };
  }

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: live.id,
    acao: "palpite_salvo",
    ip,
    detalhes: { categoria: categoria.nome },
  });

  revalidatePath(`/bolao/${live.slug}`);
  return { aviso: `Palpite de ${categoria.nome} guardado.` };
}
