import type { Metadata } from "next";
import {
  checarCloudflare,
  checarMercadoPago,
  checarSupabase,
  type ResultadoCheck,
} from "@/lib/checks";
import { supabaseServidorConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { definida, VARIAVEIS } from "@/lib/env";
import { clienteAdmin } from "@/lib/supabase/admin";

// Página de verificação da Fase 0: mostra se cada serviço está conectado.
// Nunca exibe valores de chaves — apenas "conectado", "com erro" ou "faltando".
// A partir do momento em que existe um administrador cadastrado, a página
// passa a ser restrita a ele — antes disso fica aberta, senão o dono não
// conseguiria conferir o Supabase justamente no passo que cria o admin.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status da configuração",
  robots: { index: false },
};

function CartaoServico({ resultado }: { resultado: ResultadoCheck }) {
  const cor =
    resultado.ok === true
      ? "bg-ok"
      : resultado.ok === false
        ? "bg-destaque"
        : "bg-alerta";
  const situacao =
    resultado.ok === true
      ? "Conectado"
      : resultado.ok === false
        ? "Com problema"
        : "Aguardando chaves";
  return (
    <div className="cartao p-5">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 shrink-0 rounded-full ${cor}`} aria-hidden />
        <h2 className="text-lg font-bold">{resultado.servico}</h2>
        <span className="ml-auto text-sm text-texto-fraco">{situacao}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-texto-fraco">
        {resultado.detalhe}
      </p>
    </div>
  );
}

/** Já existe algum administrador cadastrado no banco? */
async function jaTemDono(): Promise<boolean> {
  if (!supabaseServidorConfigurado) return false;
  try {
    const { count } = await clienteAdmin()
      .from("perfis")
      .select("id", { count: "exact", head: true })
      .eq("admin", true);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export default async function PaginaStatus() {
  if (await jaTemDono()) {
    const conta = await contaAtual();
    if (!conta?.perfil?.admin) {
      return (
        <main className="mx-auto w-full max-w-md px-6 py-24 text-center">
          <h1 className="text-xl font-bold">Página restrita</h1>
          <p className="mt-3 text-sm text-texto-fraco">
            Esta página é do administrador do site.
          </p>
        </main>
      );
    }
  }

  const [supabase, cloudflare, mercadoPago] = await Promise.all([
    checarSupabase(),
    checarCloudflare(),
    checarMercadoPago(),
  ]);
  const resultados = [supabase, cloudflare, mercadoPago];
  const tudoVerde =
    resultados.every((r) => r.ok === true) &&
    VARIAVEIS.filter((v) => v.fase === 0).every((v) => definida(v.nome));

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-widest text-texto-fraco">
        Clan Maromba · Configuração
      </p>
      <h1 className="display mt-2 text-4xl">Status da configuração</h1>
      <p className="mt-2 text-sm text-texto-fraco">
        Esta página testa, ao vivo, se as chaves dos serviços foram coladas
        corretamente. Recarregue depois de cada ajuste.
      </p>

      {tudoVerde ? (
        <div className="mt-6 rounded-xl border border-ok/40 bg-ok/10 p-4 text-sm font-medium text-ok">
          ✅ Serviços conectados. Falta só o que está com ⏳ na lista abaixo —
          veja o guia <code>docs/fase-1-ligar-tudo.md</code>.
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {resultados.map((r) => (
          <CartaoServico key={r.servico} resultado={r} />
        ))}
      </div>

      <h2 className="display mt-12 text-2xl">Variáveis de ambiente</h2>
      <p className="mt-1 text-sm text-texto-fraco">
        Onde obter cada uma: veja o guia{" "}
        <code className="rounded bg-painel px-1 py-0.5 text-xs">
          docs/fase-0-configuracao.md
        </code>
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {VARIAVEIS.map((v) => {
          const ok = definida(v.nome);
          const pendenteFase1 = !ok && v.fase === 1;
          return (
            <li
              key={v.nome}
              className="cartao flex items-start gap-3 px-4 py-3"
            >
              <span aria-hidden className="mt-0.5">
                {ok ? "✅" : pendenteFase1 ? "⏳" : "❌"}
              </span>
              <div>
                <code className="font-mono text-sm font-medium">{v.nome}</code>
                <p className="text-xs text-texto-fraco">
                  {v.descricao}
                  {pendenteFase1 ? " — pendente da Fase 1." : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
