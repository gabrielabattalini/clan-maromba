"use server";

import { redirect } from "next/navigation";

import { registrar } from "@/lib/auditoria";
import { mercadoPagoConfigurado, supabaseServidorConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { podeTentar } from "@/lib/limite-taxa";
import { criarPreferencia } from "@/lib/mercadopago";
import { ipDoVisitante, navegadorDoVisitante } from "@/lib/requisicao";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Compra, EstadoFormulario, Live } from "@/lib/tipos";

/**
 * Começa a compra de uma live: cria (ou reaproveita) a linha em `compras`
 * e manda a pessoa para o Checkout Pro.
 *
 * O acesso NÃO é liberado aqui — quem libera é o webhook, depois de conferir
 * a assinatura do Mercado Pago.
 */
export async function comprarAcesso(
  slug: string,
  _anterior: EstadoFormulario,
): Promise<EstadoFormulario> {
  const conta = await contaAtual();
  if (!conta) redirect(`/entrar?voltar=${encodeURIComponent(`/live/${slug}`)}`);

  if (!supabaseServidorConfigurado || !mercadoPagoConfigurado) {
    return { erro: "O pagamento ainda não foi ligado. Tente novamente mais tarde." };
  }

  if (conta.perfil?.banido) {
    return { erro: "Esta conta está bloqueada." };
  }

  const ip = await ipDoVisitante();
  const navegador = await navegadorDoVisitante();

  // No máximo 10 tentativas de compra a cada 10 minutos por conta.
  const liberado = await podeTentar(`comprar:${conta.usuarioId}`, 10, 600);
  if (!liberado) {
    return { erro: "Muitas tentativas seguidas. Espere alguns minutos." };
  }

  const supabase = clienteAdmin();

  const { data: live } = await supabase
    .from("lives")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Live>();

  if (!live) return { erro: "Live não encontrada." };
  if (live.estado === "rascunho") return { erro: "Esta live ainda não foi anunciada." };
  if (live.estado === "encerrada") return { erro: "Esta live já foi encerrada." };

  const { data: compraExistente } = await supabase
    .from("compras")
    .select("*")
    .eq("usuario_id", conta.usuarioId)
    .eq("live_id", live.id)
    .maybeSingle<Compra>();

  if (compraExistente?.status === "aprovada") {
    redirect(`/live/${slug}`);
  }

  let compraId = compraExistente?.id ?? "";

  if (compraExistente) {
    await supabase
      .from("compras")
      .update({
        status: "pendente",
        valor_centavos: live.preco_centavos,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", compraExistente.id);
  } else {
    const { data: nova, error } = await supabase
      .from("compras")
      .insert({
        usuario_id: conta.usuarioId,
        live_id: live.id,
        status: "pendente",
        valor_centavos: live.preco_centavos,
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !nova) {
      console.error("[compra] falha ao criar registro:", error?.message);
      return { erro: "Não consegui iniciar a compra. Tente de novo." };
    }
    compraId = nova.id;
  }

  let enderecoCheckout: string;
  try {
    enderecoCheckout = await criarPreferencia({
      compraId,
      titulo: live.titulo,
      descricao: live.descricao,
      precoCentavos: live.preco_centavos,
      slugDaLive: live.slug,
      emailComprador: conta.email,
    });
  } catch (erro) {
    console.error("[compra] falha no Mercado Pago:", erro);
    return { erro: "O pagamento está indisponível no momento. Tente de novo em instantes." };
  }

  await registrar({
    usuarioId: conta.usuarioId,
    liveId: live.id,
    acao: "compra_iniciada",
    ip,
    navegador,
    detalhes: { compraId, valorCentavos: live.preco_centavos },
  });

  redirect(enderecoCheckout);
}
