// Trava de compilação: se algum dia alguém importar este arquivo dentro de
// um componente que roda no navegador, o build QUEBRA em vez de publicar a
// chave-mestra do banco para o mundo. O aviso do comentário abaixo depende
// de alguém ler; esta linha, não.
import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_CHAVE_SECRETA, SUPABASE_URL } from "@/lib/config";

/**
 * Cliente com a chave secreta: ignora as travas de RLS e enxerga tudo.
 *
 * ⚠️ NUNCA importe este arquivo em um componente com "use client".
 * Ele só pode rodar no servidor (páginas de servidor, ações e rotas de API).
 */
export function clienteAdmin() {
  if (!SUPABASE_URL || !SUPABASE_CHAVE_SECRETA) {
    throw new Error(
      "Supabase não configurado: faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_CHAVE_SECRETA, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
