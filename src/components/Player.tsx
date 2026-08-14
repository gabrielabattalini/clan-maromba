"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  slug: string;
  /** Texto da marca d'água: nome, e-mail e início do IP do espectador. */
  identificacao: string;
};

type Situacao =
  | { tipo: "carregando" }
  | { tipo: "tocando" }
  | { tipo: "parado"; mensagem: string; permiteTentarDeNovo: boolean };

const SEGUNDOS_ENTRE_HEARTBEATS = 10;
/** Pedimos um token novo antes do atual vencer (ele dura 5 minutos). */
const SEGUNDOS_ENTRE_TOKENS = 210;
const SEGUNDOS_ENTRE_MUDANCAS_DA_MARCA = 7;

const MENSAGENS: Record<string, string> = {
  outro_aparelho:
    "Sua conta foi aberta em outro aparelho. Cada acesso vale para um aparelho por vez.",
  sem_login: "Sua sessão expirou. Entre de novo para continuar assistindo.",
  banido: "Esta conta está bloqueada.",
  sem_compra: "Não encontramos sua compra para esta live.",
  fora_do_ar: "A transmissão não está no ar neste momento.",
  sem_canal: "A transmissão ainda não foi preparada. Tente em instantes.",
  sem_assinatura: "A proteção do vídeo ainda não foi configurada neste site.",
  excesso: "Muitos pedidos seguidos. Aguarde um instante e recarregue.",
};

/** Troca o token dentro do endereço (ele fica logo depois do domínio). */
function comTokenAtual(endereco: string, token: string): string {
  try {
    const url = new URL(endereco);
    const partes = url.pathname.split("/").filter(Boolean);
    if (partes.length === 0) return endereco;
    partes[0] = token;
    url.pathname = `/${partes.join("/")}`;
    return url.toString();
  } catch {
    return endereco;
  }
}

function tokenDoEndereco(endereco: string): string {
  try {
    return new URL(endereco).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return "";
  }
}

export function Player({ slug, identificacao }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const molduraRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef<string>("");

  const [situacao, setSituacao] = useState<Situacao>({ tipo: "carregando" });
  const [posicaoMarca, setPosicaoMarca] = useState({ topo: 12, esquerda: 8, opacidade: 0.42 });
  const [geracaoMarca, setGeracaoMarca] = useState(0);

  const pedirToken = useCallback(async (): Promise<string | null> => {
    const resposta = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      cache: "no-store",
    });

    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { motivo?: string } | null;
      const motivo = corpo?.motivo ?? "";
      setSituacao({
        tipo: "parado",
        mensagem: MENSAGENS[motivo] ?? "Não consegui liberar o vídeo agora.",
        permiteTentarDeNovo: motivo === "fora_do_ar" || motivo === "sem_canal" || !motivo,
      });
      return null;
    }

    const { url } = (await resposta.json()) as { url: string };
    tokenRef.current = tokenDoEndereco(url);
    return url;
  }, [slug]);

  // ---------------------------------------------------------------
  // Liga o vídeo e mantém o token renovado
  // ---------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;
    let hls: import("hls.js").default | null = null;
    let renovacao: ReturnType<typeof setInterval> | null = null;

    async function iniciar() {
      const endereco = await pedirToken();
      if (!endereco || cancelado) return;

      const video = videoRef.current;
      if (!video) return;

      const { default: Hls } = await import("hls.js");
      if (cancelado) return;

      if (Hls.isSupported()) {
        // Todo pedido à Cloudflare sai com o token mais recente que temos.
        // É isso que permite renovar sem cortar a transmissão.
        const CarregadorBase = Hls.DefaultConfig.loader;
        class CarregadorComToken extends CarregadorBase {
          load(
            contexto: Parameters<InstanceType<typeof CarregadorBase>["load"]>[0],
            config: Parameters<InstanceType<typeof CarregadorBase>["load"]>[1],
            callbacks: Parameters<InstanceType<typeof CarregadorBase>["load"]>[2],
          ) {
            if (tokenRef.current) {
              contexto.url = comTokenAtual(contexto.url, tokenRef.current);
            }
            super.load(contexto, config, callbacks);
          }
        }

        hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 30,
          loader: CarregadorComToken,
        });

        hls.on(Hls.Events.ERROR, (_evento, dados) => {
          if (!dados.fatal) return;
          if (dados.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls?.startLoad();
            return;
          }
          if (dados.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          setSituacao({
            tipo: "parado",
            mensagem: "A transmissão caiu. Recarregue a página para voltar.",
            permiteTentarDeNovo: true,
          });
        });

        hls.loadSource(endereco);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari toca HLS sozinho.
        video.src = endereco;
      } else {
        setSituacao({
          tipo: "parado",
          mensagem: "Seu navegador não consegue tocar esta transmissão.",
          permiteTentarDeNovo: false,
        });
        return;
      }

      if (!cancelado) setSituacao({ tipo: "tocando" });

      renovacao = setInterval(async () => {
        const novo = await pedirToken();
        if (!novo) return;
        // Safari não usa o carregador do HLS.js: trocamos o endereço na mão.
        if (!hls && videoRef.current) {
          const momento = videoRef.current.currentTime;
          videoRef.current.src = novo;
          videoRef.current.currentTime = momento;
          void videoRef.current.play().catch(() => {});
        }
      }, SEGUNDOS_ENTRE_TOKENS * 1000);
    }

    void iniciar();

    return () => {
      cancelado = true;
      if (renovacao) clearInterval(renovacao);
      hls?.destroy();
    };
  }, [pedirToken]);

  // ---------------------------------------------------------------
  // Sessão única: confere de tempos em tempos se ainda é este aparelho
  // ---------------------------------------------------------------
  useEffect(() => {
    const relogio = setInterval(async () => {
      try {
        const resposta = await fetch("/api/heartbeat", { method: "POST", cache: "no-store" });
        const corpo = (await resposta.json()) as { valida: boolean; motivo: string };
        if (corpo.valida) return;

        videoRef.current?.pause();
        setSituacao({
          tipo: "parado",
          mensagem: MENSAGENS[corpo.motivo] ?? "Sua sessão foi encerrada.",
          permiteTentarDeNovo: false,
        });
      } catch {
        // Falha de rede momentânea não derruba ninguém.
      }
    }, SEGUNDOS_ENTRE_HEARTBEATS * 1000);

    return () => clearInterval(relogio);
  }, []);

  // ---------------------------------------------------------------
  // Marca d'água: muda de lugar sozinha
  // ---------------------------------------------------------------
  useEffect(() => {
    const relogio = setInterval(() => {
      setPosicaoMarca({
        topo: 6 + Math.random() * 78,
        esquerda: 4 + Math.random() * 55,
        opacidade: 0.32 + Math.random() * 0.22,
      });
    }, SEGUNDOS_ENTRE_MUDANCAS_DA_MARCA * 1000);

    return () => clearInterval(relogio);
  }, []);

  // ---------------------------------------------------------------
  // Se a marca d'água for removida do DOM, o vídeo para.
  // ---------------------------------------------------------------
  useEffect(() => {
    const moldura = molduraRef.current;
    if (!moldura) return;

    const observador = new MutationObserver(() => {
      const marca = moldura.querySelector("[data-marca]");
      const escondida =
        marca instanceof HTMLElement &&
        (getComputedStyle(marca).display === "none" ||
          getComputedStyle(marca).visibility === "hidden" ||
          Number(getComputedStyle(marca).opacity) < 0.05);

      if (!marca || escondida) {
        videoRef.current?.pause();
        setGeracaoMarca((n) => n + 1); // recria o elemento
      }
    });

    observador.observe(moldura, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    return () => observador.disconnect();
  }, []);

  const parado = situacao.tipo === "parado";

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={molduraRef}
        className="relative aspect-video w-full overflow-hidden rounded-xl border border-borda bg-black"
      >
        <video
          ref={videoRef}
          className="size-full"
          playsInline
          controls
          autoPlay
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
        />

        {/* Marca d'água — recriada do zero a cada geração */}
        <span
          key={geracaoMarca}
          data-marca=""
          className="pointer-events-none absolute select-none whitespace-nowrap text-[0.6875rem] font-medium tracking-wide text-white mix-blend-difference sm:text-xs"
          style={{
            top: `${posicaoMarca.topo}%`,
            left: `${posicaoMarca.esquerda}%`,
            opacity: posicaoMarca.opacidade,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            transition: "top 1.2s ease, left 1.2s ease, opacity 1.2s ease",
          }}
        >
          {identificacao}
        </span>

        {situacao.tipo === "carregando" ? (
          <div className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-texto-fraco">
            Liberando a transmissão…
          </div>
        ) : null}

        {parado ? (
          <div className="absolute inset-0 grid place-items-center bg-black/85 px-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <p className="max-w-sm text-sm text-texto">{situacao.mensagem}</p>
              {situacao.permiteTentarDeNovo ? (
                <button
                  className="botao"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Tentar de novo
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-texto-fraco">
        Esta transmissão está marcada com os seus dados. Compartilhar a tela ou
        gravar leva a marca junto e pode bloquear sua conta.
      </p>
    </div>
  );
}
