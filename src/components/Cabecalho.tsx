import Link from "next/link";

import { sair } from "@/lib/acoes/autenticacao";
import { contaAtual } from "@/lib/conta";

export async function Cabecalho() {
  const conta = await contaAtual();
  const primeiroNome = conta?.perfil?.nome?.split(" ")[0] || conta?.email?.split("@")[0];

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-fundo/90 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link
          href="/"
          className="display text-lg leading-none tracking-tight sm:text-xl"
          aria-label="Clan Maromba, página inicial"
        >
          Clan<span className="text-destaque">·</span>Maromba
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {conta ? (
            <>
              <Link
                className="hidden text-texto-fraco transition-colors hover:text-texto sm:inline"
                href="/minhas-lives"
              >
                Minhas lives
              </Link>

              {conta.perfil?.admin ? (
                <Link
                  className="botao botao-secundario !px-3 !py-1.5 !text-xs"
                  href="/admin"
                >
                  Painel
                </Link>
              ) : null}

              <span
                className="hidden max-w-[8rem] truncate text-texto-apagado md:inline"
                title={conta.email}
              >
                {primeiroNome}
              </span>

              <form action={sair}>
                <button
                  className="text-texto-apagado transition-colors hover:text-texto"
                  type="submit"
                >
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                className="text-texto-fraco transition-colors hover:text-texto"
                href="/entrar"
              >
                Entrar
              </Link>
              <Link className="botao !px-3.5 !py-1.5 !text-xs" href="/cadastro">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
