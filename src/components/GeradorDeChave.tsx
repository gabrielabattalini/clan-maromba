"use client";

import { useActionState } from "react";

import { gerarChaveDeAssinatura } from "@/app/admin/acoes";
import { CampoCopiavel } from "@/components/CampoCopiavel";
import type { ChaveAssinaturaGerada } from "@/lib/tipos";

export function GeradorDeChave() {
  const [estado, gerar, gerando] = useActionState<ChaveAssinaturaGerada, FormData>(
    gerarChaveDeAssinatura,
    null,
  );

  if (estado?.id && estado.jwk) {
    return (
      <div className="flex flex-col gap-4">
        <p className="aviso aviso-atencao">
          <strong>Copie agora.</strong> A Cloudflare mostra esta chave uma única
          vez. Cole as duas na Vercel (Settings → Environment Variables) e depois
          faça o Redeploy. Se fechar a página sem copiar, é só gerar outra.
        </p>

        <CampoCopiavel rotulo="CLOUDFLARE_STREAM_SIGNING_KEY_ID" valor={estado.id} />
        <CampoCopiavel
          rotulo="CLOUDFLARE_STREAM_SIGNING_KEY_JWK"
          valor={estado.jwk}
          secreto
        />
      </div>
    );
  }

  return (
    <form action={gerar} className="flex flex-col items-start gap-3">
      {estado?.erro ? (
        <p className="aviso aviso-erro" role="alert">
          {estado.erro}
        </p>
      ) : null}

      <button className="botao" type="submit" disabled={gerando}>
        {gerando ? "Gerando…" : "Gerar chave de assinatura"}
      </button>
    </form>
  );
}
