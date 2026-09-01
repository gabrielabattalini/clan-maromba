"use server";

import { redirect } from "next/navigation";

import { registrar } from "@/lib/auditoria";
import { enderecoDoSite, supabaseConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { podeTentar } from "@/lib/limite-taxa";
import { ipDoVisitante, navegadorDoVisitante } from "@/lib/requisicao";
import { abrirSessaoUnica, fecharSessaoUnica } from "@/lib/sessao";
import { clienteAdmin } from "@/lib/supabase/admin";
import { destinoSeguro } from "@/lib/destino";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { EstadoFormulario } from "@/lib/tipos";

const SENHA_MINIMA = 8;

export async function entrar(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  if (!supabaseConfigurado) {
    return { erro: "O login ainda não foi ligado. Fale com o administrador." };
  }

  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const senha = String(dados.get("senha") ?? "");
  const voltar = destinoSeguro(dados.get("voltar"));

  if (!email || !senha) {
    return { erro: "Preencha o e-mail e a senha." };
  }

  const ip = await ipDoVisitante();
  const navegador = await navegadorDoVisitante();

  // No máximo 8 tentativas de login a cada 10 minutos, por IP + e-mail.
  const liberado = await podeTentar(`entrar:${ip ?? "sem-ip"}:${email}`, 8, 600);
  if (!liberado) {
    await registrar({ acao: "login_bloqueado_por_excesso", ip, navegador, detalhes: { email } });
    return { erro: "Muitas tentativas seguidas. Espere 10 minutos e tente de novo." };
  }

  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error || !data.user) {
    await registrar({ acao: "login_falhou", ip, navegador, detalhes: { email } });
    return { erro: "E-mail ou senha incorretos." };
  }

  // Conta banida pelo administrador não entra.
  const { data: perfil } = await clienteAdmin()
    .from("perfis")
    .select("banido")
    .eq("id", data.user.id)
    .maybeSingle<{ banido: boolean }>();

  if (perfil?.banido) {
    await supabase.auth.signOut();
    await registrar({
      usuarioId: data.user.id,
      acao: "login_recusado_conta_banida",
      ip,
      navegador,
    });
    return { erro: "Esta conta está bloqueada. Fale com o suporte." };
  }

  await abrirSessaoUnica(data.user.id, ip, navegador);
  await registrar({ usuarioId: data.user.id, acao: "login", ip, navegador });

  redirect(voltar);
}

export async function cadastrar(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  if (!supabaseConfigurado) {
    return { erro: "O cadastro ainda não foi ligado. Fale com o administrador." };
  }

  const nome = String(dados.get("nome") ?? "").trim();
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const senha = String(dados.get("senha") ?? "");
  const voltar = destinoSeguro(dados.get("voltar"));

  if (nome.length < 2) return { erro: "Escreva seu nome completo." };
  if (!email.includes("@")) return { erro: "Escreva um e-mail válido." };
  if (senha.length < SENHA_MINIMA) {
    return { erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  }

  const ip = await ipDoVisitante();
  const navegador = await navegadorDoVisitante();

  // No máximo 5 cadastros a cada 30 minutos vindos do mesmo IP.
  const liberado = await podeTentar(`cadastro:${ip ?? "sem-ip"}`, 5, 1800);
  if (!liberado) {
    return { erro: "Muitas contas criadas deste aparelho. Tente novamente mais tarde." };
  }

  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome },
      // Sem isto o link do e-mail cai num endereço do próprio Supabase, que
      // confirma a conta mas não mostra nada — parece que deu errado.
      emailRedirectTo: `${enderecoDoSite()}/auth/confirmar${
        voltar === "/" ? "" : `?proximo=${encodeURIComponent(voltar)}`
      }`,
    },
  });

  // A MESMA resposta para e-mail novo e para e-mail que já tem conta.
  //
  // Se a tela dissesse "este e-mail já é cadastrado", o formulário de
  // cadastro viraria uma forma de descobrir quem é cliente do dono — a mesma
  // brecha que `pedirNovaSenha` já fecha. Em vez de contar, a tela mostra os
  // dois caminhos (entrar / nova senha), que é o que a pessoa precisa nos
  // dois casos.
  // As duas frases são condicionais de propósito: valem tanto com a
  // confirmação por e-mail ligada quanto desligada no Supabase, e nenhuma
  // delas conta se este e-mail existe ou não.
  const CONFIRA_O_EMAIL: EstadoFormulario = {
    aviso:
      "Se você acabou de criar a conta, o link de confirmação foi para a sua " +
      "caixa de entrada — olhe também o lixo eletrônico.",
    codigo: "conferir_email",
  };

  if (error) {
    // O Supabase às vezes devolve erro de duplicado (quando a confirmação
    // por e-mail está desligada). Também aqui a resposta não muda.
    const jaExiste = /already|registered|exists/i.test(error.message);
    if (jaExiste) {
      await registrar({ acao: "cadastro_com_email_ja_usado", ip, navegador, detalhes: { email } });
      return CONFIRA_O_EMAIL;
    }
    return { erro: "Não consegui criar a conta agora. Tente de novo em instantes." };
  }

  // Com a confirmação de e-mail ligada, e-mail que JÁ TEM CONTA não dá erro:
  // o Supabase devolve sucesso, sem sessão, com um usuário de mentira cuja
  // lista de identidades vem vazia — e não manda e-mail nenhum. Era isso que
  // fazia a tela dizer "conta criada, confira seu e-mail" para quem nunca ia
  // receber e-mail nenhum. O registro fica no diário: é o que permite ao
  // dono responder "você já tem conta" quando a pessoa reclamar.
  const jaTinhaConta = (data.user?.identities?.length ?? 1) === 0;
  if (jaTinhaConta) {
    await registrar({ acao: "cadastro_com_email_ja_usado", ip, navegador, detalhes: { email } });
    return CONFIRA_O_EMAIL;
  }

  // Sem sessão = a confirmação por e-mail está ligada e a pessoa precisa
  // clicar no link da caixa de entrada.
  if (!data.session || !data.user) return CONFIRA_O_EMAIL;

  await abrirSessaoUnica(data.user.id, ip, navegador);
  await registrar({ usuarioId: data.user.id, acao: "cadastro", ip, navegador });

  redirect(voltar);
}

export async function sair(): Promise<void> {
  const conta = await contaAtual();
  const supabase = await clienteServidor();

  await supabase.auth.signOut();
  await fecharSessaoUnica(conta?.usuarioId ?? null);

  if (conta) {
    await registrar({ usuarioId: conta.usuarioId, acao: "logout" });
  }

  redirect("/");
}
