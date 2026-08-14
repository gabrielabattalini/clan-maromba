import Link from "next/link";

import { CartaoLive } from "@/components/CartaoLive";
import { marcarQuaisEstaoNoAr } from "@/lib/ao-vivo";
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

  // Quem diz se uma live está no ar é a Cloudflare, não um botão do painel.
  const comSituacao = await marcarQuaisEstaoNoAr(lives);

  const noAr = comSituacao.filter((i) => i.noAr);
  const proximas = comSituacao.filter((i) => !i.noAr && i.live.estado !== "encerrada");
  const encerradas = comSituacao.filter((i) => !i.noAr && i.live.estado === "encerrada");

  return (
    <main className="mx-auto w-full max-w-6xl px-5">
      {/* ---------------- Herói ---------------- */}
      <section className="surgir py-16 sm:py-24">
        <p className="etiqueta">Transmissões ao vivo · acesso por evento</p>

        <h1 className="display mt-5 text-[clamp(3rem,13vw,8.5rem)]">
          Clan
          <br />
          <span className="text-destaque">Maromba</span>
        </h1>

        <div className="regua mt-8" />

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-md text-base leading-relaxed text-texto-fraco sm:text-lg">
            Você compra o acesso a uma live específica e assiste de onde estiver.
            Sem mensalidade, sem pacote — paga só pelo que quer ver.
          </p>

          {!conta ? (
            <div className="flex flex-wrap gap-3">
              <Link className="botao" href="/cadastro">
                Criar minha conta
              </Link>
              <Link className="botao botao-secundario" href="/entrar">
                Já tenho conta
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {!supabaseServidorConfigurado ? (
        <p className="aviso aviso-atencao max-w-lg">
          O site ainda está sendo configurado. Volte em breve para conferir a
          agenda de lives.
        </p>
      ) : null}

      {noAr.length > 0 ? (
        <Secao titulo="Acontecendo agora" contagem={noAr.length}>
          {noAr.map(({ live }) => (
            <CartaoLive key={live.id} live={live} noAr comprada={compradas.has(live.id)} />
          ))}
        </Secao>
      ) : null}

      {proximas.length > 0 ? (
        <Secao titulo="Próximas lives" contagem={proximas.length}>
          {proximas.map(({ live }) => (
            <CartaoLive
              key={live.id}
              live={live}
              noAr={false}
              comprada={compradas.has(live.id)}
            />
          ))}
        </Secao>
      ) : null}

      {encerradas.length > 0 ? (
        <Secao titulo="Já aconteceram" contagem={encerradas.length}>
          {encerradas.map(({ live }) => (
            <CartaoLive
              key={live.id}
              live={live}
              noAr={false}
              comprada={compradas.has(live.id)}
            />
          ))}
        </Secao>
      ) : null}

      {supabaseServidorConfigurado && lives.length === 0 ? (
        <div className="cartao mx-auto max-w-lg p-8 text-center">
          <p className="display text-xl">Nenhuma live na agenda</p>
          <p className="mt-2 text-sm leading-relaxed text-texto-fraco">
            Ainda não há transmissão anunciada. Crie sua conta agora — quando a
            próxima entrar na agenda, você já está pronto para comprar.
          </p>
          {!conta ? (
            <Link className="botao mt-5" href="/cadastro">
              Criar minha conta
            </Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function Secao({
  titulo,
  contagem,
  children,
}: {
  titulo: string;
  contagem: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-5 flex items-baseline gap-3">
        <h2 className="etiqueta !text-texto-fraco">{titulo}</h2>
        <span className="numero etiqueta">{contagem}</span>
        <span className="regua flex-1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
