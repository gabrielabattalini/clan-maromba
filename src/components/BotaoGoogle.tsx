"use client";

import { useState } from "react";

import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Entrar com a conta Google.
 *
 * É o caminho principal de propósito: quem entra por aqui não tem senha para
 * esquecer nem e-mail de confirmação para esperar — o Google já garantiu que
 * aquele endereço é dela. Sobra menos coisa para dar errado no dia da live,
 * que é quando ninguém tem tempo de resolver problema de login.
 *
 * E-mail e senha continuam existindo logo abaixo: quem não tem conta Google
 * (Hotmail, Outlook, iCloud) precisa poder comprar do mesmo jeito.
 */
export function BotaoGoogle({ voltar }: { voltar: string }) {
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState("");

  async function entrarComGoogle() {
    setIndo(true);
    setErro("");

    // O Google devolve para /auth/confirmar, que já sabe trocar o código por
    // sessão e abrir a sessão única. `fluxo=google` é o que diz àquela rota
    // que isto é um login, e não a confirmação de um e-mail.
    const proximo = voltar === "/" ? "" : `&proximo=${encodeURIComponent(voltar)}`;
    const destino = `${window.location.origin}/auth/confirmar?fluxo=google${proximo}`;

    const { error } = await clienteNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: destino },
    });

    if (error) {
      setIndo(false);
      setErro("Não consegui abrir o login do Google. Tente pelo e-mail abaixo.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {erro ? (
        <p className="aviso aviso-erro" role="alert">
          {erro}
        </p>
      ) : null}

      <button
        className="botao botao-secundario w-full !py-3 !text-base"
        type="button"
        onClick={entrarComGoogle}
        disabled={indo}
      >
        {indo ? "Abrindo o Google…" : "Entrar com Google"}
      </button>

      <div className="flex items-center gap-3">
        <span className="regua flex-1" />
        <span className="text-xs uppercase tracking-widest text-texto-apagado">ou</span>
        <span className="regua flex-1" />
      </div>
    </div>
  );
}
