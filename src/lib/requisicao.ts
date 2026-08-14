import { headers } from "next/headers";

/** IP de quem fez a requisição, atrás do proxy da Vercel. */
export async function ipDoVisitante(): Promise<string | null> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

/** Navegador/aparelho de quem fez a requisição. */
export async function navegadorDoVisitante(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

export function ipDaRequisicao(req: Request): string | null {
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}
