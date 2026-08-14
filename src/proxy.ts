import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL, supabaseConfigurado } from "@/lib/config";

/**
 * Roda antes de cada página. No Next 16 este arquivo se chama "proxy"
 * (era o antigo "middleware"). Ele mantém a sessão do Supabase fresca.
 *
 * Sem isto o login "cai" sozinho depois de uma hora, porque o token de
 * acesso vence e ninguém o renova entre uma página e outra.
 */
export async function proxy(requisicao: NextRequest) {
  let resposta = NextResponse.next({ request: requisicao });

  if (!supabaseConfigurado) return resposta;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    cookies: {
      getAll() {
        return requisicao.cookies.getAll();
      },
      setAll(novos) {
        for (const { name, value } of novos) {
          requisicao.cookies.set(name, value);
        }
        resposta = NextResponse.next({ request: requisicao });
        for (const { name, value, options } of novos) {
          resposta.cookies.set(name, value, options);
        }
      },
    },
  });

  // Só de chamar já renova o token quando necessário.
  await supabase.auth.getUser();

  return resposta;
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos, imagens e o webhook do Mercado Pago
    // (que chega sem cookie nenhum e não precisa de sessão).
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
