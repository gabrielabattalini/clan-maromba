import Link from "next/link";

import { BotaoComprar } from "@/components/BotaoComprar";
import { Contador } from "@/components/Contador";
import { comprarIngresso } from "@/lib/acoes/compra";
import { precoEmReais } from "@/lib/formato";
import type { IngressoNaVitrine } from "@/lib/tipos";

type Props = {
  itens: IngressoNaVitrine[];
  slugDaLive: string;
  logado: boolean;
  pagamentoLigado: boolean;
};

export function ListaDeIngressos({ itens, slugDaLive, logado, pagamentoLigado }: Props) {
  if (itens.length === 0) {
    return (
      <p className="aviso aviso-atencao">
        Os ingressos desta live ainda não foram colocados à venda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {itens.map((item) => (
        <CartaoIngresso
          key={item.ingresso.id}
          item={item}
          slugDaLive={slugDaLive}
          logado={logado}
          pagamentoLigado={pagamentoLigado}
        />
      ))}
    </div>
  );
}

function CartaoIngresso({
  item,
  slugDaLive,
  logado,
  pagamentoLigado,
}: {
  item: IngressoNaVitrine;
  slugDaLive: string;
  logado: boolean;
  pagamentoLigado: boolean;
}) {
  const { ingresso, precoAgora, emPromocao, restam, esgotado, jaTenho } = item;
  // O passe completo é o que não tem janela — mas o ingresso do bolão também
  // não tem, e ele não é passe nenhum. Sem esta segunda condição ele apareceria
  // com a faixa "melhor escolha · todos os dias" por R$ 5.
  const destacado =
    !ingresso.so_bolao &&
    ingresso.inicia_em === null &&
    ingresso.termina_em === null;

  return (
    <div
      className={`cartao overflow-hidden ${
        destacado ? "border-destaque/50" : ""
      } ${esgotado && !jaTenho ? "opacity-60" : ""}`}
    >
      {destacado ? (
        <p className="bg-destaque/12 px-5 py-1.5 text-center text-[0.6875rem] font-bold uppercase tracking-widest text-destaque-fraco">
          Melhor escolha · todos os dias
        </p>
      ) : null}

      {ingresso.so_bolao ? (
        <p className="border-b border-borda bg-fundo-2 px-5 py-1.5 text-center text-[0.6875rem] font-bold uppercase tracking-widest text-texto-apagado">
          Só o bolão · não assiste a live
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-40 flex-1">
          <h3 className="display text-xl">{ingresso.nome}</h3>
          {ingresso.descricao ? (
            <p className="mt-1.5 text-sm leading-relaxed text-texto-fraco">
              {ingresso.descricao}
            </p>
          ) : null}

          {ingresso.so_bolao ? (
            <p className="mt-2 text-xs leading-relaxed text-alerta">
              Este aqui <strong>não dá acesso à transmissão</strong>: serve
              apenas para participar do bolão.
            </p>
          ) : null}

          {restam !== null && !esgotado ? (
            <p className="numero mt-2 text-xs font-semibold text-alerta">
              {restam === 1 ? "Resta 1 ingresso" : `Restam ${restam} ingressos`}
            </p>
          ) : null}
        </div>

        <div className="text-right">
          {emPromocao && ingresso.preco_cheio_centavos !== null ? (
            <p className="numero text-sm text-texto-apagado line-through">
              {precoEmReais(ingresso.preco_cheio_centavos)}
            </p>
          ) : null}
          <p className="numero display text-3xl leading-none">
            {precoEmReais(precoAgora)}
          </p>
        </div>
      </div>

      {emPromocao && ingresso.promocao_ate ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borda bg-fundo-2 px-5 py-2.5 text-xs">
          <span className="text-texto-fraco">Este preço acaba em</span>
          <Contador ate={ingresso.promocao_ate} />
        </div>
      ) : null}

      <div className="border-t border-borda p-5">
        {jaTenho ? (
          <p className="text-center text-sm font-semibold text-ok">
            ✓ Você já tem este ingresso
          </p>
        ) : esgotado ? (
          <p className="text-center text-sm font-semibold text-texto-apagado">
            Esgotado
          </p>
        ) : !logado ? (
          <Link
            className="botao w-full !py-3"
            href={`/entrar?voltar=${encodeURIComponent(`/live/${slugDaLive}`)}`}
          >
            Entrar para comprar
          </Link>
        ) : !pagamentoLigado ? (
          <p className="aviso aviso-atencao text-center">
            O pagamento ainda não foi ligado neste site.
          </p>
        ) : (
          <BotaoComprar
            acao={comprarIngresso.bind(null, ingresso.id)}
            rotulo={`Comprar · ${precoEmReais(precoAgora)}`}
          />
        )}
      </div>
    </div>
  );
}
