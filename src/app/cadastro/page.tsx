import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioConta } from "@/components/FormularioConta";
import { cadastrar } from "@/lib/acoes/autenticacao";
import { supabaseConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";

export const metadata: Metadata = { title: "Criar conta" };

type Props = { searchParams: Promise<{ voltar?: string }> };

export default async function PaginaCadastro({ searchParams }: Props) {
  const { voltar } = await searchParams;
  const destino = voltar?.startsWith("/") && !voltar.startsWith("//") ? voltar : "/";

  if (supabaseConfigurado) {
    const conta = await contaAtual();
    if (conta) redirect(destino);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center gap-6 px-6 py-14">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Criar conta</h1>
        <p className="mt-1 text-sm text-texto-fraco">
          Leva 30 segundos. A conta é individual — só um aparelho por vez.
        </p>
      </header>

      {supabaseConfigurado ? (
        <div className="cartao p-6">
          <FormularioConta modo="cadastro" acao={cadastrar} voltar={destino} />
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
