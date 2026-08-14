import type { Metadata, Viewport } from "next";
import { Anton, Archivo, IBM_Plex_Mono } from "next/font/google";

import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";
import "./globals.css";

// Anton carrega o peso de cartaz de competição; Archivo segura o texto miúdo
// sem perder a mesma robustez; o mono é para chave de transmissão e códigos.
const display = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--fonte-display",
  display: "swap",
});

const corpo = Archivo({
  subsets: ["latin"],
  variable: "--fonte-corpo",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fonte-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Clan Maromba",
    template: "%s · Clan Maromba",
  },
  description:
    "Transmissões ao vivo exclusivas do Clan Maromba. Compre o acesso e assista de qualquer dispositivo.",
};

export const viewport: Viewport = {
  themeColor: "#0b0908",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${corpo.variable} ${mono.variable}`}
    >
      <body className="flex min-h-dvh flex-col bg-fundo text-texto">
        <Cabecalho />
        <div className="flex-1">{children}</div>
        <Rodape />
      </body>
    </html>
  );
}
