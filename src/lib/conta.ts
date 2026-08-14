import { redirect } from "next/navigation";

import { supabaseConfigurado, supabaseServidorConfigurado } from "@/lib/config";
import { clienteAdmin } from "@/lib/supabase/admin";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Perfil } from "@/lib/tipos";

export type Conta = {
  usuarioId: string;
  email: string;
  perfil: Perfil | null;
};

/** Quem está logado agora — ou `null` se for um visitante. */
export async function contaAtual(): Promise<Conta | null> {
  if (!supabaseConfigurado) return null;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let perfil: Perfil | null = null;
  if (supabaseServidorConfigurado) {
    const { data } = await clienteAdmin()
      .from("perfis")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Perfil>();
    perfil = data ?? null;
  }

  return { usuarioId: user.id, email: user.email ?? "", perfil };
}

/** Exige login. Manda para a tela de entrar, guardando para onde voltar. */
export async function exigirConta(voltarPara: string): Promise<Conta> {
  const conta = await contaAtual();
  if (!conta) redirect(`/entrar?voltar=${encodeURIComponent(voltarPara)}`);
  return conta;
}

/** Exige que seja o dono do canal. Qualquer outra pessoa vai para a home. */
export async function exigirAdmin(): Promise<Conta> {
  const conta = await exigirConta("/admin");
  if (!conta.perfil?.admin) redirect("/");
  return conta;
}

export async function ehAdmin(): Promise<boolean> {
  const conta = await contaAtual();
  return Boolean(conta?.perfil?.admin);
}
