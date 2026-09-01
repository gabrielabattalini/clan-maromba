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
import { donoDoToken } from "@/lib/mercadopago";

export const metadata: Metadata = { title: "Configuração" };
export const dynamic = "force-dynamic";

export default async function PaginaConfiguracao() {
  await exigirAdmin();
  const site = enderecoDoSite();

  // De qual conta são as credenciais que estão no ar AGORA.
  //
  // Trocar entre teste e produção era um ato às cegas: as duas telas são
  // idênticas e o resultado só aparece quando um comprador fica sem acesso.
  // Em 01/09/2026 foi assim — o token de teste pertencia a um usuário de
  // teste do Mercado Pago, não à conta do dono, e nada na tela dizia isso.
  const dono = mercadoPagoConfigurado ? await donoDoToken() : null;
  const ehContaDeTeste = dono?.apelido.startsWith("TESTUSER") ?? false;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Link className="text-sm text-texto-fraco hover:text-texto" href="/admin">
        ← Voltar ao painel
      </Link>

      <h1 className="display mt-4 text-4xl">Configuração</h1>
      <p className="mt-3 text-sm leading-relaxed text-texto-fraco">
        Duas coisas precisam ser ligadas uma única vez, e é aqui que elas se
        resolvem.
      </p>

      {/* -------- Chave de assinatura do vídeo -------- */}
      <section className="cartao mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-xl">1. Proteção do vídeo</h2>
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
          <h2 className="display text-xl">2. Aviso de pagamento</h2>
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
        ) : dono ? (
          <div
            className={`aviso mt-4 ${ehContaDeTeste ? "aviso-atencao" : "aviso-ok"}`}
          >
            <strong>
              {ehContaDeTeste ? "Modo de teste" : "Modo de produção"}
            </strong>{" "}
            — as credenciais no ar agora são da conta{" "}
            <span className="numero">{dono.apelido || dono.id}</span>.
            {ehContaDeTeste ? (
              <span className="mt-1.5 block text-xs leading-relaxed">
                Esta é uma conta de teste que o Mercado Pago criou, e não a
                sua: o dinheiro não entra, e o aviso de pagamento chega
                assinado com um segredo que não é o do seu painel — por isso
                o acesso não libera sozinho. Use o botão{" "}
                <strong>Conferir pagamento</strong>, na lista de compradores.
              </span>
            ) : (
              <span className="mt-1.5 block text-xs leading-relaxed">
                Venda valendo: o pagamento é de verdade e o aviso libera o
                acesso sozinho.
              </span>
            )}
          </div>
        ) : (
          <p className="aviso aviso-erro mt-4">
            O <code>MP_ACCESS_TOKEN</code> está cadastrado, mas o Mercado Pago
            não reconheceu. Confira se ele foi copiado inteiro.
          </p>
        )}
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
    <span className={`selo selo-neutro ${ligado ? "!text-ok" : "!text-alerta"}`}>
      {ligado ? "Ligado" : "Pendente"}
    </span>
  );
}
