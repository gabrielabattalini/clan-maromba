import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "@/lib/config";

/**
 * Cliente do Supabase para usar dentro de páginas e ações do servidor.
 * Enxerga o usuário logado através dos cookies e respeita as travas de
 * segurança (RLS) do banco.
 */
export async function clienteServidor() {
  const cookiesDaRequisicao = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    cookies: {
      getAll() {
        return cookiesDaRequisicao.getAll();
      },
      setAll(novos) {
        try {
          for (const { name, value, options } of novos) {
            cookiesDaRequisicao.set(name, value, options);
          }
        } catch {
          // Componentes de servidor não podem gravar cookies. Tudo bem:
          // quem renova a sessão nesse caso é o middleware.
        }
      },
    },
  });
}
