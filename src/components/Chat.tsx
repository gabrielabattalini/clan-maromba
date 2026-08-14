"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { apagarMensagem, enviarMensagem, silenciar } from "@/lib/acoes/chat";
import { TAMANHO_MAXIMO } from "@/lib/chat-regras";
import { supabaseConfigurado } from "@/lib/config";
import { clienteNavegador } from "@/lib/supabase/navegador";
import type { MensagemNaTela } from "@/lib/tipos";

type Props = {
  slug: string;
  liveId: string;
  usuarioId: string;
  souAdmin: boolean;
  ligado: boolean;
  modoLento: number;
  iniciais: MensagemNaTela[];
};

/** Linha crua que o Realtime entrega — é a linha da tabela, não a da tela. */
type LinhaDoBanco = {
  id: number;
  usuario_id: string;
  apelido: string;
  do_dono: boolean;
  texto: string;
  apagada: boolean;
  criado_em: string;
};

export function Chat({
  slug,
  liveId,
  usuarioId,
  souAdmin,
  ligado,
  modoLento,
  iniciais,
}: Props) {
  const [mensagens, setMensagens] = useState<MensagemNaTela[]>(iniciais);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  const fim = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  // Só puxa a rolagem para baixo se a pessoa já estava no fim. Arrastar o
  // chat para reler algo e ser jogado de volta a cada mensagem nova é a
  // forma mais rápida de fazer alguém desistir de acompanhar.
  const noFim = useRef(true);

  useEffect(() => {
    // Sem chave configurada não há Realtime — a tela continua funcionando
    // com o histórico e o envio, que passam pelo servidor.
    if (!supabaseConfigurado) return;

    const supabase = clienteNavegador();

    const canal = supabase
      .channel(`chat:${liveId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_chat",
          filter: `live_id=eq.${liveId}`,
        },
        (evento) => {
          const linha = evento.new as LinhaDoBanco;
          setMensagens((antes) =>
            antes.some((m) => m.id === linha.id)
              ? antes
              : [
                  ...antes,
                  {
                    id: linha.id,
                    usuarioId: linha.usuario_id,
                    apelido:
                      linha.usuario_id === usuarioId ? "Você" : linha.apelido,
                    doDono: linha.do_dono,
                    texto: linha.texto,
                    criadoEm: linha.criado_em,
                  },
                ].slice(-200),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensagens_chat",
          filter: `live_id=eq.${liveId}`,
        },
        (evento) => {
          const linha = evento.new as LinhaDoBanco;
          if (linha.apagada) {
            setMensagens((antes) => antes.filter((m) => m.id !== linha.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [liveId, usuarioId]);

  useEffect(() => {
    if (noFim.current) fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setErro(null);
    // Limpa o campo já: se a mensagem for recusada, o erro aparece e a
    // pessoa reescreve — melhor que travar o campo esperando o servidor.
    setTexto("");
    noFim.current = true;

    iniciarEnvio(async () => {
      const resposta = await enviarMensagem(slug, conteudo);
      if (resposta?.erro) {
        setErro(resposta.erro);
        setTexto(conteudo);
      }
    });
  }

  return (
    <section className="cartao flex h-[28rem] flex-col overflow-hidden lg:h-[calc(100vh-11rem)]">
      <header className="flex items-center justify-between border-b border-borda px-4 py-2.5">
        <h2 className="etiqueta">Chat</h2>
        <span className="numero text-xs text-texto-apagado">
          {ligado ? `${mensagens.length} msg` : "desligado"}
        </span>
      </header>

      <div
        ref={listaRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          noFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {mensagens.length === 0 ? (
          <p className="text-sm text-texto-apagado">
            Ninguém falou nada ainda. Manda o primeiro.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {mensagens.map((m) => (
              <li key={m.id} className="group text-sm leading-snug">
                <span
                  className={`font-semibold ${
                    m.doDono
                      ? "text-destaque"
                      : m.usuarioId === usuarioId
                        ? "text-texto"
                        : "text-texto-fraco"
                  }`}
                >
                  {m.doDono ? "★ " : ""}
                  {m.apelido}
                </span>
                <span className="text-texto-apagado"> · </span>
                <span className="[overflow-wrap:anywhere]">{m.texto}</span>

                {souAdmin && m.usuarioId !== usuarioId ? (
                  <span className="ml-2 hidden gap-2 text-xs group-hover:inline-flex">
                    <button
                      className="text-texto-apagado hover:text-destaque"
                      onClick={() => apagarMensagem(m.id)}
                      type="button"
                    >
                      apagar
                    </button>
                    <button
                      className="text-texto-apagado hover:text-destaque"
                      onClick={() => silenciar(liveId, m.usuarioId, 10)}
                      type="button"
                      title="Silencia esta pessoa por 10 minutos"
                    >
                      silenciar
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div ref={fim} />
      </div>

      <div className="border-t border-borda p-3">
        {erro ? (
          <p className="mb-2 text-xs font-semibold text-destaque" role="alert">
            {erro}
          </p>
        ) : null}

        {ligado ? (
          <form onSubmit={enviar} className="flex gap-2">
            <input
              className="campo flex-1 !py-2 text-sm"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={TAMANHO_MAXIMO}
              placeholder="Escreva algo…"
              aria-label="Mensagem"
            />
            <button
              className="botao !px-4 !py-2 !text-sm"
              type="submit"
              disabled={enviando || texto.trim().length === 0}
            >
              Enviar
            </button>
          </form>
        ) : (
          <p className="text-xs text-texto-apagado">
            O chat está desligado nesta transmissão.
          </p>
        )}

        <p className="mt-2 text-[0.6875rem] leading-relaxed text-texto-apagado">
          Links não são permitidos.
          {modoLento > 0 && !souAdmin
            ? ` Uma mensagem a cada ${modoLento}s.`
            : ""}
        </p>
      </div>
    </section>
  );
}
