import Link from "next/link";

import { CartaoLive } from "@/components/CartaoLive";
import { supabaseServidorConfigurado } from "@/lib/config";
import { contaAtual } from "@/lib/conta";
import { listarLivesPublicas, listarMinhasLives } from "@/lib/lives";

export const dynamic = "force-dynamic";

export default async function Home() {
  const conta = await contaAtual();
  const lives = await listarLivesPublicas();

  const minhas = conta ? await listarMinhasLives(conta.usuarioId) : [];
  const compradas = new Set(
    minhas.filter((i) => i.compra.status === "aprovada").map((i) => i.live.id),
  );

  const noAr = lives.filter((l) => l.estado === "no_ar");
  const proximas = lives.filter((l) => l.estado === "anunciada");
  const encerradas = lives.filter((l) => l.estado === "encerrada");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <section className="flex flex-col items-center gap-5 text-center">
        <h1 className="text-4xl font-black uppercase tracking-tight sm:text-6xl">
          Clan <span className="text-destaque">Maromba</span>
        </h1>
        <p className="max-w-lg text-balance text-base text-texto-fraco sm:text-lg">
          Transmissões ao vivo exclusivas. Compre o acesso à live e assista de
          qualquer dispositivo, com qualidade e sem enrolação.
        </p>
        {!conta ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link className="botao" href="/cadastro">
              Criar minha conta
            </Link>
            <Link className="botao botao-secundario" href="/entrar">
              Já tenho conta
            </Link>
          </div>
        ) : null}
      </section>

      {!supabaseServidorConfigurado ? (
        <p className="aviso aviso-atencao mx-auto mt-12 max-w-lg text-center">
          O site ainda está sendo configurado. Volte em breve para conferir a
          agenda de lives.
        </p>
      ) : null}

      {noAr.length > 0 ? (
        <Secao titulo="Acontecendo agora">
          {noAr.map((live) => (
            <CartaoLive key={live.id} live={live} comprada={compradas.has(live.id)} />
          ))}
        </Secao>
      ) : null}

      {proximas.length > 0 ? (
        <Secao titulo="Próximas lives">
          {proximas.map((live) => (
            <CartaoLive key={live.id} live={live} comprada={compradas.has(live.id)} />
          ))}
        </Secao>
      ) : null}

      {encerradas.length > 0 ? (
        <Secao titulo="Já aconteceram">
          {encerradas.map((live) => (
            <CartaoLive key={live.id} live={live} comprada={compradas.has(live.id)} />
          ))}
        </Secao>
      ) : null}

      {supabaseServidorConfigurado && lives.length === 0 ? (
        <p className="mt-14 text-center text-sm text-texto-fraco">
          Nenhuma live anunciada por enquanto. Crie sua conta para ser avisado
          quando a próxima entrar na agenda.
        </p>
      ) : null}
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-texto-fraco">
        {titulo}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
