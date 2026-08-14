import type { MetadataRoute } from "next";

import { enderecoDoSite } from "@/lib/config";

/**
 * O que os buscadores podem indexar.
 *
 * A home e as páginas de venda são para serem achadas — é assim que a live
 * vende. O resto, não: painel, player, configuração e a área da conta não
 * têm nada de útil numa busca, e aparecer no Google só serve para dar pistas
 * a quem procura o que atacar.
 *
 * Isto é sinalização, não tranca: quem ignorar o arquivo continua barrado
 * pelo login. A tranca de verdade está em `exigirAdmin` e `exigirConta`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/assistir/", "/minhas-lives", "/status", "/api/"],
    },
    sitemap: `${enderecoDoSite()}/sitemap.xml`,
  };
}
