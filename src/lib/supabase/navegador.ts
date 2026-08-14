"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "@/lib/config";

/**
 * Cliente do Supabase que roda no navegador.
 *
 * Existe por um motivo só: o chat precisa receber mensagem nova sem
 * recarregar a página, e isso é uma conexão aberta do navegador até o
 * Supabase (Realtime).
 *
 * A chave usada aqui é a **pública** — ela é feita para aparecer no
 * navegador. Quem protege os dados é o RLS: a política do chat só entrega
 * mensagem de live que a pessoa comprou. A chave secreta nunca chega perto
 * deste arquivo.
 */
export function clienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA);
}
