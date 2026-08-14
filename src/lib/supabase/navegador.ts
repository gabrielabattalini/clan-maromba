import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "@/lib/config";

/** Cliente do Supabase para usar dentro do navegador (componentes "use client"). */
export function clienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA);
}
