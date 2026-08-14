import type { Metadata } from "next";
import Link from "next/link";

import { GeradorDeChave } from "@/components/GeradorDeChave";
import {
  assinaturaConfigurada,
  cloudflareConfigurado,
  enderecoDoSite,
  mercadoPagoConfigurado,
  MP_SEGREDO_WEBHOOK,
} from "@/lib/config";
import { exigirAdmin } from "@/lib/conta";

export const metadata: Metadata = { title: "Configuração" };
export const dynamic = "force-dynamic";

export default async function PaginaConfiguracao() {
  await exigirAdmin();
  const site = enderecoDoSite();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Link className="text-sm text-texto-fraco hover:text-texto" href="/admin">
        ← Voltar ao painel
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Configuração</h1>
      <p className="mt-1 text-sm text-texto-fraco">
        Duas coisas precisam ser ligadas uma única vez, e é aqui que elas se
        resolvem.
      </p>

      {/* -------- Chave de assinatura do vídeo -------- */}
      <section className="cartao mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">1. Proteção do vídeo</h2>
          <Situacao ligado={assinaturaConfigurada} />
        </div>

        <p className="mt-2 text-sm text-texto-fraco">
          É esta chave que faz o vídeo só tocar para quem comprou. Sem ela, o
          player não libera nada.
        </p>

        <div className="mt-4">
          {assinaturaConfigurada ? (
            <p className="text-sm text-ok">
              ✓ Já configurada. Só gere outra se precisar trocar a chave.
            </p>
          ) : !cloudflareConfigurado ? (
            <p className="aviso aviso-atencao">
              Antes disso, conclua o Passo 4 da Fase 0 (Cloudflare Stream).
            </p>
          ) : null}

          {cloudflareConfigurado ? (
            <div className="mt-4">
              <GeradorDeChave />
            </div>
          ) : null}
        </div>
      </section>

      {/* -------- Webhook do Mercado Pago -------- */}
      <section className="cartao mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">2. Aviso de pagamento</h2>
          <Situacao ligado={Boolean(MP_SEGREDO_WEBHOOK)} />
        </div>

        <p className="mt-2 text-sm text-texto-fraco">
          O Mercado Pago avisa o site quando um pagamento é aprovado. É esse
          aviso — e só ele — que libera o acesso do comprador.
        </p>

        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm text-texto-fraco">
          <li>
            Entre em{" "}
            <a
              className="text-destaque hover:underline"
              href="https://www.mercadopago.com.br/developers/panel"
              target="_blank"
              rel="noreferrer"
            >
              Suas integrações
            </a>{" "}
            → aplicação <strong>Clan Maromba</strong> → <strong>Webhooks</strong>.
          </li>
          <li>
            Em <strong>Modo teste</strong>, cole este endereço no campo de URL:
            <code className="mt-1.5 block overflow-x-auto rounded-lg border border-borda bg-fundo px-3 py-2 font-mono text-xs">
              {site}/api/webhooks/mercadopago
            </code>
          </li>
          <li>
            Marque o evento <strong>Pagamentos</strong> e salve.
          </li>
          <li>
            O painel mostra uma <strong>assinatura secreta</strong>. Copie e
            cadastre na Vercel como <code>MP_WEBHOOK_SECRET</code>, depois faça
            o Redeploy.
          </li>
        </ol>

        {!mercadoPagoConfigurado ? (
          <p className="aviso aviso-atencao mt-4">
            O <code>MP_ACCESS_TOKEN</code> ainda não foi cadastrado (Passo 3 da
            Fase 0).
          </p>
        ) : null}
      </section>

      <p className="mt-8 text-center text-sm text-texto-fraco">
        Para conferir tudo de uma vez, veja a página{" "}
        <Link className="text-destaque hover:underline" href="/status">
          /status
        </Link>
        .
      </p>
    </main>
  );
}

function Situacao({ ligado }: { ligado: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider ${
        ligado ? "bg-ok/15 text-ok" : "bg-alerta/15 text-alerta"
      }`}
    >
      {ligado ? "Ligado" : "Pendente"}
    </span>
  );
}
