import Link from "next/link";

import { sair } from "@/lib/acoes/autenticacao";
import { contaAtual } from "@/lib/conta";

export async function Cabecalho() {
  const conta = await contaAtual();
  const primeiroNome = conta?.perfil?.nome?.split(" ")[0] || conta?.email?.split("@")[0];

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-fundo/85 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Link className="text-sm font-black uppercase tracking-tight sm:text-base" href="/">
          Clan <span className="text-destaque">Maromba</span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          {conta ? (
            <>
              {conta.perfil?.admin ? (
                <Link className="botao botao-secundario !px-3 !py-1.5 !text-xs" href="/admin">
                  Painel
                </Link>
              ) : null}
              <Link
                className="hidden text-texto-fraco hover:text-texto sm:inline"
                href="/minhas-lives"
              >
                Minhas lives
              </Link>
              <span className="hidden text-texto-fraco sm:inline">·</span>
              <span className="max-w-[9rem] truncate text-texto-fraco" title={conta.email}>
                {primeiroNome}
              </span>
              <form action={sair}>
                <button className="botao botao-secundario !px-3 !py-1.5 !text-xs" type="submit">
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="text-texto-fraco hover:text-texto" href="/entrar">
                Entrar
              </Link>
              <Link className="botao !px-3 !py-1.5 !text-xs" href="/cadastro">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
