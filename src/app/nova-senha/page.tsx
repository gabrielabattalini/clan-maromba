import type { Metadata } from "next";
import Link from "next/link";

import { FormularioSenha } from "@/components/FormularioSenha";
import { definirNovaSenha } from "@/lib/acoes/senha";
import { contaAtual } from "@/lib/conta";

export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function PaginaNovaSenha() {
  // Chega-se aqui pelo link do e-mail, que já deixou a pessoa conectada.
  // Sem sessão, o link venceu ou alguém digitou o endereço na mão.
  const conta = await contaAtual();

  if (!conta) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-col gap-7 px-5 py-16 sm:py-24">
        <header>
          <h1 className="display text-4xl">Link expirado</h1>
          <p className="mt-3 text-sm leading-relaxed text-texto-fraco">
            Para criar uma senha nova é preciso abrir o link que mandamos por
            e-mail — e ele vale por pouco tempo.
          </p>
        </header>
        <Link className="botao self-start" href="/recuperar">
          Pedir um link novo
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-7 px-5 py-16 sm:py-24">
      <header>
        <h1 className="display text-4xl">Nova senha</h1>
        <p className="mt-3 text-sm leading-relaxed text-texto-fraco">
          Escolhendo para <strong className="text-texto">{conta.email}</strong>.
          Ao salvar, os outros aparelhos conectados nesta conta são
          desconectados.
        </p>
      </header>

      <div className="cartao p-6 sm:p-7">
        <FormularioSenha modo="definir" acao={definirNovaSenha} />
      </div>
    </main>
  );
}
