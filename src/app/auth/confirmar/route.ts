import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { registrar } from "@/lib/auditoria";
import { clienteAdmin } from "@/lib/supabase/admin";
import { supabaseConfigurado } from "@/lib/config";
import { destinoSeguro } from "@/lib/destino";
import { ipDaRequisicao } from "@/lib/requisicao";
import { abrirSessaoUnica } from "@/lib/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

/**
 * Onde caem os links que o Supabase manda por e-mail.
 *
 * Antes disto existir, o link levava para um endereço do próprio Supabase
 * que não mostra nada: a conta era confirmada de verdade, mas a pessoa via
 * uma tela quebrada e achava que tinha dado errado.
 *
 * O Supabase manda o link de dois jeitos, dependendo do modelo de e-mail:
 * com `code` (troca por sessão) ou com `token_hash` + `type`. Aceitamos os
 * dois — o segundo, inclusive, é o que funciona quando a pessoa abre o
 * e-mail em outro aparelho, e é o caso mais comum: cadastra no computador,
 * confirma pelo celular.
 */
const TIPOS_ACEITOS: EmailOtpType[] = [
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
  "email",
];

export async function GET(requisicao: Request) {
  const url = new URL(requisicao.url);
  const paraOSite = (caminho: string) => NextResponse.redirect(new URL(caminho, url));

  if (!supabaseConfigurado) return paraOSite("/");

  // `fluxo=google` diz que isto é um login social, e não a confirmação de um
  // e-mail: o Google devolve para cá do mesmo jeito, com `code`, mas o
  // desfecho é outro — a pessoa vai direto para onde estava, sem passar por
  // uma tela dizendo "conta confirmada".
  const ehLoginSocial = url.searchParams.get("fluxo") === "google";

  const codigo = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipoBruto = url.searchParams.get("type") ?? "";
  const tipo = TIPOS_ACEITOS.includes(tipoBruto as EmailOtpType)
    ? (tipoBruto as EmailOtpType)
    : null;

  const supabase = await clienteServidor();
  let deuErro = true;

  if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    deuErro = Boolean(error);
  } else if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    deuErro = Boolean(error);
  }

  if (deuErro) {
    return paraOSite(`/auth/pronto?estado=falhou&tipo=${tipo ?? "signup"}`);
  }

  // Deu certo: a pessoa está logada. Abrimos a sessão única aqui também,
  // senão ela ficaria autenticada sem aparelho registrado — e o player a
  // derrubaria no primeiro heartbeat.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Conta banida não entra por porta nenhuma. O login por e-mail já
    // conferia isto; sem a mesma checagem aqui, bastaria entrar pelo Google
    // para o banimento deixar de valer.
    const { data: perfil } = await clienteAdmin()
      .from("perfis")
      .select("banido")
      .eq("id", user.id)
      .maybeSingle<{ banido: boolean }>();

    if (perfil?.banido) {
      await supabase.auth.signOut();
      await registrar({
        usuarioId: user.id,
        acao: "login_recusado_conta_banida",
        ip: ipDaRequisicao(requisicao),
        navegador: requisicao.headers.get("user-agent"),
      });
      return paraOSite("/entrar?estado=banido");
    }

    await abrirSessaoUnica(
      user.id,
      ipDaRequisicao(requisicao),
      requisicao.headers.get("user-agent"),
    );
    await registrar({
      usuarioId: user.id,
      acao: ehLoginSocial
        ? "login_google"
        : tipo === "recovery"
          ? "recuperacao_confirmada"
          : "email_confirmado",
      ip: ipDaRequisicao(requisicao),
      navegador: requisicao.headers.get("user-agent"),
    });
  }

  // Quem veio pelo "esqueci a senha" precisa escolher a senha nova agora.
  if (tipo === "recovery") return paraOSite("/nova-senha");

  const voltar = destinoSeguro(url.searchParams.get("proximo"));

  // Quem entrou pelo Google já está dentro: mandar para uma tela de "pronto"
  // seria um passo a mais sem nada para fazer nele.
  if (ehLoginSocial) return paraOSite(voltar);

  const extra = voltar === "/" ? "" : `&proximo=${encodeURIComponent(voltar)}`;

  return paraOSite(`/auth/pronto?estado=ok&tipo=${tipo ?? "signup"}${extra}`);
}
