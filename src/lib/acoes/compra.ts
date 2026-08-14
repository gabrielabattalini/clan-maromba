"use server";

import { redirect } from "next/navigation";

import { registrar } from "@/lib/auditoria";
import { mercadoPagoConfigurado, supabaseServidorConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { buscarIngresso, precoAgora } from "@/lib/ingressos";
import { podeTentar } from "@/lib/limite-taxa";
import { criarPreferencia } from "@/lib/mercadopago";
import { ipDoVisitante, navegadorDoVisitante } from "@/lib/requisicao";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Compra, EstadoFormulario, Live } from "@/lib/tipos";

/**
 * Começa a compra de um ingresso e manda a pessoa para o Checkout Pro.
 *
 * O preço é decidido AQUI, no servidor, a partir do banco — nunca vem do
 * navegador. E é o preço que vale neste instante: se a promoção acabou de
 * vencer, o valor cobrado é o cheio, igual ao que a tela mostra.
 *
 * O acesso NÃO é liberado aqui. Quem libera é o webhook, depois de conferir
 * a assinatura do Mercado Pago.
 */
export async function comprarIngresso(
  ingressoId: string,
  _anterior: EstadoFormulario,
): Promise<EstadoFormulario> {
  const conta = await contaAtual();

  const ingresso = await buscarIngresso(ingressoId);
  if (!ingresso) return { erro: "Ingresso não encontrado." };

  const supabase = supabaseServidorConfigurado ? clienteAdmin() : null;
  const { data: live } = supabase
    ? await supabase
        .from("lives")
        .select("*")
        .eq("id", ingresso.live_id)
        .maybeSingle<Live>()
    : { data: null };

  if (!live) return { erro: "Live não encontrada." };

  if (!conta) {
    redirect(`/entrar?voltar=${encodeURIComponent(`/live/${live.slug}`)}`);
  }

  if (!supabase || !mercadoPagoConfigurado) {
    return { erro: "O pagamento ainda não foi ligado. Tente novamente mais tarde." };
  }

  if (conta.perfil?.banido) return { erro: "Esta conta está bloqueada." };

  if (!ingresso.ativo) return { erro: "Este ingresso não está mais à venda." };
  if (live.estado === "rascunho") return { erro: "Esta live ainda não foi anunciada." };
  if (live.estado === "encerrada") return { erro: "Esta live já foi encerrada." };

  const ip = await ipDoVisitante();
  const navegador = await navegadorDoVisitante();

  const liberado = await podeTentar(`comprar:${conta.usuarioId}`, 10, 600);
  if (!liberado) {
    return { erro: "Muitas tentativas seguidas. Espere alguns minutos." };
  }

  // Já é seu?
  //
  // Ticket de bolão é a exceção: cada um é UMA entrada, e o palpite não pode
  // ser alterado depois de enviado. Quem quiser palpitar de novo compra
  // outra entrada — então aqui a compra repetida é permitida e nasce sempre
  // como um registro novo.
  const { data: compraExistente } = ingresso.so_bolao
    ? { data: null }
    : await supabase
        .from("compras")
        .select("*")
        .eq("usuario_id", conta.usuarioId)
        .eq("ingresso_id", ingresso.id)
        .maybeSingle<Compra>();

  if (compraExistente?.status === "aprovada") {
    redirect(`/live/${live.slug}`);
  }

  // Limite de vendas. Duas compras simultâneas na última vaga podem passar
  // as duas — preferimos vender uma a mais a recusar quem já pagou. O painel
  // mostra o número real de vendidos.
  if (ingresso.limite !== null) {
    const { count } = await supabase
      .from("compras")
      .select("id", { count: "exact", head: true })
      .eq("ingresso_id", ingresso.id)
      .eq("status", "aprovada");

    if ((count ?? 0) >= ingresso.limite) {
      return { erro: "Este ingresso esgotou." };
    }
  }

  const valor = precoAgora(ingresso);

  let compraId = compraExistente?.id ?? "";
  if (compraExistente) {
    await supabase
      .from("compras")
      .update({
        status: "pendente",
        valor_centavos: valor,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", compraExistente.id);
  } else {
    const { data: nova, error } = await supabase
      .from("compras")
      .insert({
        usuario_id: conta.usuarioId,
        live_id: live.id,
        ingresso_id: ingresso.id,
        status: "pendente",
        valor_centavos: valor,
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
      titulo: `${live.titulo} — ${ingresso.nome}`,
      descricao: ingresso.descricao || live.descricao,
      precoCentavos: valor,
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
    detalhes: { compraId, ingressoId: ingresso.id, valorCentavos: valor },
  });

  redirect(enderecoCheckout);
}
