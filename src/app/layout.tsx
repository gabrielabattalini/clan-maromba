import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Clan Maromba",
    template: "%s · Clan Maromba",
  },
  description:
    "Transmissões ao vivo exclusivas do Clan Maromba. Compre o acesso e assista de qualquer dispositivo.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-fundo text-texto">{children}</body>
    </html>
  );
}
