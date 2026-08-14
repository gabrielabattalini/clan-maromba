import { SignJWT, importJWK, type JWK } from "jose";

import {
  CF_CHAVE_ASSINATURA_ID,
  CF_CHAVE_ASSINATURA_JWK,
  CF_CODIGO_CLIENTE,
  CF_CONTA,
  CF_TOKEN,
  assinaturaConfigurada,
  cloudflareConfigurado,
} from "@/lib/config";

const BASE = "https://api.cloudflare.com/client/v4";

type RespostaCF<T> = {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: T;
};

async function chamarCloudflare<T>(
  caminho: string,
  init: RequestInit = {},
): Promise<T> {
  if (!cloudflareConfigurado) {
    throw new Error(
      "Cloudflare Stream não configurado: faltam CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN ou CLOUDFLARE_STREAM_CUSTOMER_CODE.",
    );
  }

  const resposta = await fetch(`${BASE}/accounts/${CF_CONTA}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const corpo = (await resposta.json().catch(() => null)) as RespostaCF<T> | null;

  if (!resposta.ok || !corpo?.success || corpo.result === undefined) {
    const motivo =
      corpo?.errors?.map((e) => e.message).join("; ") || `erro HTTP ${resposta.status}`;
    throw new Error(`Cloudflare Stream recusou a operação: ${motivo}`);
  }

  return corpo.result;
}

export type LiveInputCriado = {
  uid: string;
  rtmpsUrl: string;
  streamKey: string;
};

/**
 * Cria um "live input": o endereço RTMPS + a chave que vão no OBS.
 *
 * `requireSignedURLs` é o que faz o vídeo só tocar com token assinado, e
 * `recording.mode: automatic` é obrigatório para o playback HLS funcionar
 * (e já deixa a gravação pronta para o replay da Fase 2).
 */
export async function criarLiveInput(titulo: string): Promise<LiveInputCriado> {
  const resultado = await chamarCloudflare<{
    uid: string;
    rtmps?: { url?: string; streamKey?: string };
  }>("/stream/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: { name: titulo },
      recording: {
        mode: "automatic",
        requireSignedURLs: true,
        timeoutSeconds: 60,
      },
      preferLowLatency: true,
    }),
  });

  return {
    uid: resultado.uid,
    rtmpsUrl: resultado.rtmps?.url ?? "",
    streamKey: resultado.rtmps?.streamKey ?? "",
  };
}

export async function apagarLiveInput(uid: string): Promise<void> {
  await fetch(`${BASE}/accounts/${CF_CONTA}/stream/live_inputs/${uid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${CF_TOKEN}` },
    cache: "no-store",
  });
}

/**
 * Cria a chave usada para assinar os tokens de reprodução.
 * O segredo só é mostrado uma vez pela Cloudflare — por isso o painel
 * exibe o resultado na tela para o dono colar na Vercel.
 */
export async function criarChaveDeAssinatura(): Promise<{ id: string; jwk: string }> {
  const resultado = await chamarCloudflare<{ id: string; jwk: string }>("/stream/keys", {
    method: "POST",
    body: JSON.stringify({}),
  });

  return { id: resultado.id, jwk: resultado.jwk };
}

/**
 * Gera o token curto que libera o vídeo. Ele vale poucos minutos e é
 * amarrado a UMA live — link copiado para outra pessoa vence sozinho.
 */
export async function assinarTokenReproducao(
  inputUid: string,
  duracaoSegundos = 300,
): Promise<string> {
  if (!assinaturaConfigurada) {
    throw new Error(
      "Faltam CLOUDFLARE_STREAM_SIGNING_KEY_ID e CLOUDFLARE_STREAM_SIGNING_KEY_JWK.",
    );
  }

  const jwk = JSON.parse(
    Buffer.from(CF_CHAVE_ASSINATURA_JWK, "base64").toString("utf8"),
  ) as JWK;

  const chave = await importJWK(jwk, "RS256");
  const expiraEm = Math.floor(Date.now() / 1000) + duracaoSegundos;

  return new SignJWT({ sub: inputUid, kid: CF_CHAVE_ASSINATURA_ID, exp: expiraEm })
    .setProtectedHeader({ alg: "RS256", kid: CF_CHAVE_ASSINATURA_ID })
    .sign(chave);
}

/** Endereço do manifesto HLS — o token entra no lugar do id do vídeo. */
export function enderecoDoManifesto(token: string): string {
  return `https://customer-${CF_CODIGO_CLIENTE}.cloudflarestream.com/${token}/manifest/video.m3u8`;
}

/** Pergunta à Cloudflare se o OBS está transmitindo neste momento. */
export async function estaTransmitindo(inputUid: string): Promise<boolean> {
  if (!CF_CODIGO_CLIENTE) return false;

  try {
    const resposta = await fetch(
      `https://customer-${CF_CODIGO_CLIENTE}.cloudflarestream.com/${inputUid}/lifecycle`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!resposta.ok) return false;

    const corpo = (await resposta.json()) as { live?: boolean };
    return corpo.live === true;
  } catch {
    return false;
  }
}
