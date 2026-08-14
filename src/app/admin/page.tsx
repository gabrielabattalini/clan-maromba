import type { Metadata } from "next";
import Link from "next/link";

import { FormularioNovaLive } from "@/components/FormularioNovaLive";
import {
  assinaturaConfigurada,
  cloudflareConfigurado,
  mercadoPagoConfigurado,
  supabaseServidorConfigurado,
} from "@/lib/config";
import { marcarQuaisEstaoNoAr } from "@/lib/ao-vivo";
import { exigirAdmin } from "@/lib/conta";
import { precoEmReais, quandoAcontece } from "@/lib/formato";
import { listarTodasAsLives } from "@/lib/lives";
import { ROTULO_ESTADO } from "@/lib/tipos";

export const metadata: Metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

export default async function PainelAdmin() {
  await exigirAdmin();
  const lives = await marcarQuaisEstaoNoAr(await listarTodasAsLives());

  const pendencias = [
    !supabaseServidorConfigurado && "SUPABASE_SERVICE_ROLE_KEY (banco de dados)",
    !cloudflareConfigurado && "Cloudflare Stream (vídeo)",
    !assinaturaConfigurada && "chave de assinatura do Stream (proteção do vídeo)",
    !mercadoPagoConfigurado && "Mercado Pago (pagamento)",
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-4xl">Painel do dono</h1>
          <p className="mt-2 text-sm text-texto-fraco">
            Crie as lives, pegue os dados do OBS e acompanhe quem comprou.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="botao botao-secundario !py-1.5 !text-xs" href="/admin/configuracao">
            Configuração
          </Link>
          <Link className="botao botao-secundario !py-1.5 !text-xs" href="/status">
            Status
          </Link>
        </div>
      </div>

      {pendencias.length > 0 ? (
        <div className="aviso aviso-atencao mt-6">
          <strong>Ainda falta configurar:</strong>
          <ul className="mt-1.5 list-inside list-disc">
            {pendencias.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2">
            Enquanto isso, o que depende desses serviços fica desligado. Veja o
            passo a passo em <code>docs/fase-1-ligar-tudo.md</code> ou abra a{" "}
            <Link className="underline" href="/admin/configuracao">
              página de configuração
            </Link>
            .
          </p>
        </div>
      ) : null}

      <section className="cartao mt-8 p-6">
        <h2 className="mb-5 display text-xl">Nova live</h2>
        <FormularioNovaLive />
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="etiqueta !text-texto-fraco">Suas lives</h2>
          <span className="numero etiqueta">{lives.length}</span>
          <span className="regua flex-1" />
        </div>

        {lives.length === 0 ? (
          <p className="text-sm text-texto-fraco">
            Nenhuma live criada ainda. Use o formulário acima.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lives.map(({ live, noAr }) => (
              <li key={live.id}>
                <Link
                  href={`/admin/live/${live.id}`}
                  className="cartao flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:border-destaque/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{live.titulo}</p>
                    <p className="numero mt-0.5 text-xs text-texto-apagado">
                      {quandoAcontece(live)} · {precoEmReais(live.preco_centavos)}
                    </p>
                  </div>
                  <span className={`selo shrink-0 ${noAr ? "selo-vivo" : "selo-neutro"}`}>
                    {noAr ? (
                      <>
                        <span className="ponto-vivo" aria-hidden />
                        No ar
                      </>
                    ) : (
                      ROTULO_ESTADO[live.estado]
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
