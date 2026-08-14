import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioConta } from "@/components/FormularioConta";
import { entrar } from "@/lib/acoes/autenticacao";
import { supabaseConfigurado } from "@/lib/config";
import { destinoSeguro } from "@/lib/destino";
import { contaAtual } from "@/lib/conta";

export const metadata: Metadata = { title: "Entrar" };

type Props = { searchParams: Promise<{ voltar?: string }> };

export default async function PaginaEntrar({ searchParams }: Props) {
  const { voltar } = await searchParams;
  const destino = destinoSeguro(voltar);

  if (supabaseConfigurado) {
    const conta = await contaAtual();
    if (conta) redirect(destino);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-7 px-5 py-16 sm:py-24">
      <header>
        <h1 className="display text-4xl">Entrar</h1>
        <p className="mt-3 text-sm leading-relaxed text-texto-fraco">
          Use a conta que você criou para comprar e assistir às lives.
        </p>
      </header>

      {supabaseConfigurado ? (
        <div className="cartao p-6 sm:p-7">
          <FormularioConta modo="entrar" acao={entrar} voltar={destino} />
        </div>
      ) : (
        <p className="aviso aviso-atencao">
          O sistema de contas ainda não foi ligado. Se você é o administrador,
          conclua o Passo 2 do guia de configuração.
        </p>
      )}
    </main>
  );
}
