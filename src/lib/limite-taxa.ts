import { clienteAdmin } from "@/lib/supabase/admin";
import { supabaseServidorConfigurado } from "@/lib/config";

/**
 * Trava de tentativas em excesso (login, compra, emissão de token).
 *
 * Como a Vercel roda cada requisição em um processo separado, o contador
 * mora no Postgres: uma linha por (chave, janela de tempo).
 *
 * Retorna `true` quando a ação está liberada e `false` quando o limite
 * daquela janela já estourou.
 */
export async function podeTentar(
  chave: string,
  limite: number,
  janelaSegundos: number,
): Promise<boolean> {
  if (!supabaseServidorConfigurado) return true;

  const agora = Date.now();
  const inicioDaJanela = new Date(
    Math.floor(agora / (janelaSegundos * 1000)) * janelaSegundos * 1000,
  ).toISOString();

  try {
    const { data, error } = await clienteAdmin().rpc("registrar_tentativa", {
      p_chave: chave,
      p_janela: inicioDaJanela,
      p_limite: limite,
    });

    if (error) {
      console.error("[limite-taxa] falha ao contar tentativa:", error.message);
      return true; // na dúvida, não bloqueia um cliente legítimo
    }

    return data !== false;
  } catch (erro) {
    console.error("[limite-taxa] erro inesperado:", erro);
    return true;
  }
}
