import type { MetadataRoute } from "next";

import { enderecoDoSite } from "@/lib/config";

/**
 * Robôs que copiam conteúdo para TREINAR modelos de IA.
 *
 * Ficam de fora do site inteiro. Não é o mesmo que bloquear busca: os robôs
 * que respondem perguntas ("onde assistir o Mister Olympia 2026?") continuam
 * liberados na regra geral abaixo, porque quando eles citam o site isso é
 * visita que chega de graça. Os de treinamento não devolvem nada.
 *
 * A Vercel oferece a mesma trava no painel do domínio, mas ela escreve num
 * `robots.txt` gerenciado por ela — e este arquivo aqui já responde por
 * `/robots.txt`, então quem vale é este. Um lugar só para mexer.
 */
const ROBOS_DE_TREINAMENTO = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "FacebookBot",
  "Bytespider",
  "Amazonbot",
  "PerplexityBot",
  "cohere-ai",
  "Diffbot",
  "omgili",
];

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
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/assistir/", "/status", "/api/"],
      },
      { userAgent: ROBOS_DE_TREINAMENTO, disallow: "/" },
    ],
    sitemap: `${enderecoDoSite()}/sitemap.xml`,
  };
}
