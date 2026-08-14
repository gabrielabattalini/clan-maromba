"use server";

import { redirect } from "next/navigation";

import { registrar } from "@/lib/auditoria";
import { enderecoDoSite, supabaseConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { podeTentar } from "@/lib/limite-taxa";
import { ipDoVisitante, navegadorDoVisitante } from "@/lib/requisicao";
import { abrirSessaoUnica } from "@/lib/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { EstadoFormulario } from "@/lib/tipos";

const SENHA_MINIMA = 8;

/** A mesma resposta sempre, exista ou não a conta. */
const RECADO_NEUTRO =
  "Se existir uma conta com esse e-mail, o link para criar uma senha nova chega em instantes. Confira também o spam.";

/**
 * Envia o e-mail de "esqueci minha senha".
 *
 * Responde a mesma coisa para e-mail que existe e e-mail que não existe.
 * Se a resposta mudasse, qualquer pessoa poderia usar este formulário para
 * descobrir quem é cliente seu — é o jeito mais fácil de vazar sua lista de
 * compradores.
 */
export async function pedirNovaSenha(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  if (!supabaseConfigurado) {
    return { erro: "O sistema de contas ainda não foi ligado." };
  }

  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { erro: "Escreva um e-mail válido." };

  const ip = await ipDoVisitante();
  const navegador = await navegadorDoVisitante();

  // No máximo 5 pedidos a cada 15 minutos por IP, para o formulário não
  // virar máquina de mandar e-mail em nome do site.
  const liberado = await podeTentar(`recuperar:${ip ?? "sem-ip"}`, 5, 900);
  if (!liberado) {
    return { erro: "Muitos pedidos seguidos. Espere alguns minutos." };
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${enderecoDoSite()}/auth/confirmar`,
  });

  if (error) {
    console.error("[senha] falha ao pedir recuperação:", error.message);
  }

  await registrar({ acao: "recuperacao_pedida", ip, navegador, detalhes: { email } });

  return { aviso: RECADO_NEUTRO };
}

/**
 * Grava a senha nova. Só funciona com a sessão que veio do link do e-mail.
 */
export async function definirNovaSenha(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const conta = await contaAtual();
  if (!conta) {
    return {
      erro: "O link de recuperação venceu. Peça um novo em “Esqueci minha senha”.",
    };
  }

  const senha = String(dados.get("senha") ?? "");
  const repetida = String(dados.get("repetir") ?? "");

  if (senha.length < SENHA_MINIMA) {
    return { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  }
  if (senha !== repetida) {
    return { erro: "As duas senhas não são iguais." };
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) {
    const igual = /same|different from the old/i.test(error.message);
    return {
      erro: igual
        ? "Essa é a senha atual. Escolha uma diferente."
        : "Não consegui trocar a senha agora. Peça um link novo e tente de novo.",
    };
  }

  const ip = await ipDoVisitante();
  const navegador = await navegadorDoVisitante();

  // Trocar a senha derruba os outros aparelhos: se alguém tinha entrado na
  // conta, é aqui que ele perde o acesso.
  await abrirSessaoUnica(conta.usuarioId, ip, navegador);
  await registrar({ usuarioId: conta.usuarioId, acao: "senha_trocada", ip, navegador });

  redirect("/minhas-lives");
}
