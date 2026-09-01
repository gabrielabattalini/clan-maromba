"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { EstadoFormulario } from "@/lib/tipos";

type Props = {
  modo: "entrar" | "cadastro";
  acao: (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
  voltar: string;
};

export function FormularioConta({ modo, acao, voltar }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(acao, null);
  const ehCadastro = modo === "cadastro";

  return (
    <form action={enviar} className="flex w-full flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />

      {estado?.erro ? (
        <p className="aviso aviso-erro" role="alert">
          {estado.erro}
        </p>
      ) : null}

      {estado?.codigo === "conferir_email" ? (
        // Os dois caminhos ficam à mão: se a pessoa já tinha conta, nada foi
        // enviado, e é daqui que ela sai do lugar sem precisar do e-mail.
        <div className="aviso aviso-ok" role="status">
          {estado.aviso}
          <p className="mt-2 text-texto-fraco">
            Não chegou nada? Pode ser que este e-mail já tenha conta — nesse
            caso o cadastro não se repete.{" "}
            <Link className="font-medium text-texto underline" href="/entrar">
              Entrar
            </Link>{" "}
            ou{" "}
            <Link className="font-medium text-texto underline" href="/recuperar">
              criar uma senha nova
            </Link>
            .
          </p>
        </div>
      ) : estado?.aviso ? (
        <p className="aviso aviso-ok" role="status">
          {estado.aviso}
        </p>
      ) : null}

      {ehCadastro ? (
        <div>
          <label className="rotulo" htmlFor="nome">
            Seu nome
          </label>
          <input
            className="campo"
            id="nome"
            name="nome"
            type="text"
            autoComplete="name"
            placeholder="Como você quer ser chamado"
            required
          />
        </div>
      ) : null}

      <div>
        <label className="rotulo" htmlFor="email">
          E-mail
        </label>
        <input
          className="campo"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          required
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          className="campo"
          id="senha"
          name="senha"
          type="password"
          autoComplete={ehCadastro ? "new-password" : "current-password"}
          placeholder={ehCadastro ? "Mínimo de 8 caracteres" : "Sua senha"}
          minLength={ehCadastro ? 8 : undefined}
          required
        />
        {ehCadastro ? (
          <p className="mt-1.5 text-xs text-texto-fraco">
            Use pelo menos 8 caracteres. Guarde bem: é com ela que você entra na live.
          </p>
        ) : null}
      </div>

      <button className="botao mt-1 w-full" type="submit" disabled={enviando}>
        {enviando ? "Aguarde…" : ehCadastro ? "Criar conta" : "Entrar"}
      </button>

      {!ehCadastro ? (
        <Link
          className="text-center text-sm text-texto-apagado transition-colors hover:text-texto"
          href="/recuperar"
        >
          Esqueci minha senha
        </Link>
      ) : null}

      <p className="text-center text-sm text-texto-fraco">
        {ehCadastro ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link
          className="font-medium text-destaque hover:underline"
          href={{
            pathname: ehCadastro ? "/entrar" : "/cadastro",
            query: voltar === "/" ? undefined : { voltar },
          }}
        >
          {ehCadastro ? "Entrar" : "Criar agora"}
        </Link>
      </p>
    </form>
  );
}
