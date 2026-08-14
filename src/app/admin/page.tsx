import type { Metadata } from "next";
import Link from "next/link";

import { FormularioNovaLive } from "@/components/FormularioNovaLive";
import {
  assinaturaConfigurada,
  cloudflareConfigurado,
  mercadoPagoConfigurado,
  supabaseServidorConfigurado,
} from "@/lib/config";
import { exigirAdmin } from "@/lib/conta";
import { dataCurta, precoEmReais } from "@/lib/formato";
import { listarTodasAsLives } from "@/lib/lives";
import { ROTULO_ESTADO } from "@/lib/tipos";

export const metadata: Metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

export default async function PainelAdmin() {
  await exigirAdmin();
  const lives = await listarTodasAsLives();

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
          <h1 className="text-2xl font-bold">Painel do dono</h1>
          <p className="mt-1 text-sm text-texto-fraco">
            Aqui você cria as lives, pega os dados do OBS e acompanha quem comprou.
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
        <h2 className="mb-4 text-base font-bold">Nova live</h2>
        <FormularioNovaLive />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-texto-fraco">
          Suas lives
        </h2>

        {lives.length === 0 ? (
          <p className="text-sm text-texto-fraco">
            Nenhuma live criada ainda. Use o formulário acima.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lives.map((live) => (
              <li key={live.id}>
                <Link
                  href={`/admin/live/${live.id}`}
                  className="cartao flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:border-destaque/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{live.titulo}</p>
                    <p className="text-xs text-texto-fraco">
                      {dataCurta(live.comeca_em)} · {precoEmReais(live.preco_centavos)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider ${
                      live.estado === "no_ar"
                        ? "bg-destaque/15 text-destaque"
                        : "bg-fundo text-texto-fraco"
                    }`}
                  >
                    {ROTULO_ESTADO[live.estado]}
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
