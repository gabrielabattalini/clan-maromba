// Testes de conexão usados pela página /status.
// Cada teste responde: as chaves coladas funcionam de verdade?
// Nenhum valor de chave sai daqui — apenas "funcionou" ou o motivo do erro.

export type ResultadoCheck = {
  servico: string;
  ok: boolean | null; // null = ainda não configurado
  detalhe: string;
};

const TIMEOUT_MS = 6000;

async function tentar(fn: () => Promise<ResultadoCheck>): Promise<ResultadoCheck> {
  try {
    return await fn();
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    return {
      servico: "",
      ok: false,
      detalhe: `Falha de rede ao testar: ${msg}`,
    };
  }
}

export async function checarSupabase(): Promise<ResultadoCheck> {
  const servico = "Supabase";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !chave) {
    return {
      servico,
      ok: null,
      detalhe: "Aguardando NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }
  const resultado = await tentar(async () => {
    const resposta = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: chave },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (resposta.ok) {
      return { servico, ok: true, detalhe: "Conectado — login e banco prontos para a Fase 1." };
    }
    return {
      servico,
      ok: false,
      detalhe: `O Supabase respondeu com erro ${resposta.status}. Confira se a URL e a chave pública foram coladas completas.`,
    };
  });
  return { ...resultado, servico };
}

export async function checarCloudflare(): Promise<ResultadoCheck> {
  const servico = "Cloudflare Stream";
  const conta = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!conta || !token) {
    return {
      servico,
      ok: null,
      detalhe: "Aguardando CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.",
    };
  }
  const resultado = await tentar(async () => {
    const resposta = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${conta}/stream/live_inputs`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (resposta.ok) {
      return {
        servico,
        ok: true,
        detalhe: "Conectado — token com permissão de Stream funcionando.",
      };
    }
    if (resposta.status === 403 || resposta.status === 401) {
      return {
        servico,
        ok: false,
        detalhe:
          "A Cloudflare recusou o token (erro " +
          resposta.status +
          "). Confira se o token tem a permissão \"Stream: Edit\" e se o ID da conta está certo.",
      };
    }
    return {
      servico,
      ok: false,
      detalhe: `A Cloudflare respondeu com erro ${resposta.status}. Confira se a assinatura do Stream está ativa na conta.`,
    };
  });
  return { ...resultado, servico };
}

export async function checarMercadoPago(): Promise<ResultadoCheck> {
  const servico = "Mercado Pago";
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) {
    return { servico, ok: null, detalhe: "Aguardando MP_ACCESS_TOKEN." };
  }
  const modo = token.startsWith("TEST-")
    ? "modo TESTE (correto para agora)"
    : token.startsWith("APP_USR-")
      ? "modo PRODUÇÃO (troque para o de teste até a Fase 3)"
      : "prefixo não reconhecido";
  const resultado = await tentar(async () => {
    const resposta = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (resposta.ok) {
      return { servico, ok: true, detalhe: `Conectado — token válido, ${modo}.` };
    }
    return {
      servico,
      ok: false,
      detalhe: `O Mercado Pago recusou o token (erro ${resposta.status}). Confira se copiou o Access Token completo (${modo}).`,
    };
  });
  return { ...resultado, servico };
}
