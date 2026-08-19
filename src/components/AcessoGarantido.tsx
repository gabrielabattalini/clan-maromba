import Link from "next/link";

type Props = {
  slugDaLive: string;
  /** O que a pessoa comprou desta live, pelo nome. */
  itens: string[];
  /** A Cloudflare está recebendo o OBS agora? */
  noAr: boolean;
  /** Tem ingresso cuja janela cobre este instante? */
  podeAssistirAgora: boolean;
  /** Mostra o link para a página da live. Falso quando já se está nela. */
  linkDaLive?: boolean;
};

/**
 * "Seu acesso está garantido" — o que quem já comprou vê no lugar do preço.
 *
 * Existe em três telas (home, loja e página da live) porque o dono não sabe
 * por onde a pessoa volta depois de pagar. Em qualquer uma delas ela precisa
 * de duas coisas na mesma tela: a confirmação de que não precisa comprar de
 * novo, e o caminho para chegar à transmissão.
 */
export function AcessoGarantido({
  slugDaLive,
  itens,
  noAr,
  podeAssistirAgora,
  linkDaLive = false,
}: Props) {
  return (
    <div className="cartao border-ok/40 p-6 text-center">
      <span className="etiqueta !text-ok">✓ Acesso garantido</span>

      <p className="display mt-2 text-2xl">
        {noAr && podeAssistirAgora ? "A transmissão começou" : "Você já comprou"}
      </p>

      {itens.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-texto-fraco">
          {itens.map((nome, indice) => (
            <li key={`${nome}-${indice}`}>{nome}</li>
          ))}
        </ul>
      ) : null}

      {noAr && podeAssistirAgora ? (
        <Link className="botao mt-5 w-full !py-3 !text-base" href={`/assistir/${slugDaLive}`}>
          Assistir agora
        </Link>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-texto-apagado">
          Não precisa comprar de novo. O botão de assistir aparece sozinho
          quando a transmissão começar.
        </p>
      )}

      {linkDaLive ? (
        <Link
          className={`botao botao-secundario mt-3 w-full ${
            noAr && podeAssistirAgora ? "" : "!py-3"
          }`}
          href={`/live/${slugDaLive}`}
        >
          Abrir a página da live
        </Link>
      ) : null}
    </div>
  );
}
