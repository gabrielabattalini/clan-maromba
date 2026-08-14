import type { MetadataRoute } from "next";

import { enderecoDoSite } from "@/lib/config";
import { listarLivesPublicas } from "@/lib/lives";

export const dynamic = "force-dynamic";

/**
 * Mapa do site para os buscadores: só a home e as lives já anunciadas.
 * Rascunho não entra — `listarLivesPublicas` já o exclui, e é o que mantém
 * uma live não anunciada fora do Google.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = enderecoDoSite();
  const lives = await listarLivesPublicas();

  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    ...lives.map((live) => ({
      url: `${site}/live/${live.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
