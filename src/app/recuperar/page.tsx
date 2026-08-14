import type { Metadata } from "next";
import Link from "next/link";

import { FormularioSenha } from "@/components/FormularioSenha";
import { pedirNovaSenha } from "@/lib/acoes/senha";
import { supabaseConfigurado } from "@/lib/config";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaRecuperar() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-7 px-5 py-16 sm:py-24">
      <header>
        <h1 className="display text-4xl">Esqueci minha senha</h1>
        <p className="mt-3 text-sm leading-relaxed text-texto-fraco">
          Escreva o e-mail da sua conta. Mandamos um link para você criar uma
          senha nova.
        </p>
      </header>

      {supabaseConfigurado ? (
        <div className="cartao p-6 sm:p-7">
          <FormularioSenha modo="pedir" acao={pedirNovaSenha} />
        </div>
      ) : (
        <p className="aviso aviso-atencao">
          O sistema de contas ainda não foi ligado.
        </p>
      )}

      <p className="text-center text-sm text-texto-fraco">
        Lembrou?{" "}
        <Link className="font-medium text-destaque hover:underline" href="/entrar">
          Entrar
        </Link>
      </p>
    </main>
  );
}
