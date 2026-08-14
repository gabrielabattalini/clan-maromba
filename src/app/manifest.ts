import type { MetadataRoute } from "next";

/**
 * O que o celular usa quando alguém salva o site na tela de início.
 *
 * Vale a pena porque a maior parte do público chega pelo telefone: com isso o
 * atalho fica com o ícone da marca e abre sem a barra do navegador, em vez de
 * virar um quadradinho branco com a letra "C".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clan Maromba",
    short_name: "Clan Maromba",
    description:
      "Transmissões ao vivo exclusivas do Clan Maromba. Compre o acesso e assista de qualquer dispositivo.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0908",
    theme_color: "#0b0908",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      // "maskable" é o que deixa o Android recortar no formato dele sem cortar
      // a letra: por isso estes dois não têm canto arredondado próprio.
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
