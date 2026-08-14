import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança.
 *
 * `frame-ancestors 'none'` é o que impede que alguém coloque o site dentro
 * de um iframe invisível no site dele e engane o visitante a clicar em
 * "Comprar" ou, pior, em algo do painel. Os outros são higiene: não deixar
 * o navegador adivinhar tipo de arquivo, não vazar o endereço completo da
 * página para terceiros, e desligar câmera, microfone e localização, que
 * este site nunca usa.
 */
const cabecalhosDeSeguranca = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // O X-Powered-By só conta a quem está do outro lado qual versão estamos
  // rodando. Não protege nada e ajuda quem procura alvo por versão.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: cabecalhosDeSeguranca,
      },
      {
        // O painel mostra chave de transmissão e a chave de assinatura do
        // vídeo. Nada dessas páginas pode ficar guardado em cache — nem do
        // navegador, nem de intermediário no caminho.
        source: "/admin/:caminho*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
