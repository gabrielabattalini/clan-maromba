"use client";

import { useActionState } from "react";

import {
  criarCategoriaDoBolao,
  criarTicketDoBolao,
  definirResultado,
  mudarFechamentoDoBolao,
  salvarAtletas,
  salvarPremioDaCategoria,
  salvarPremioDoBolao,
} from "@/app/admin/acoes";
import type { BolaoAtleta, EstadoFormulario } from "@/lib/tipos";

function Recado({ estado }: { estado: EstadoFormulario }) {
  if (estado?.erro) {
    return (
      <p className="aviso aviso-erro" role="alert">
        {estado.erro}
      </p>
    );
  }
  if (estado?.aviso) {
    return (
      <p className="aviso aviso-ok" role="status">
        {estado.aviso}
      </p>
    );
  }
  return null;
}

export function FormularioPremio({
  liveId,
  premioAtual,
}: {
  liveId: string;
  premioAtual: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    salvarPremioDoBolao.bind(null, liveId),
    null,
  );

  return (
    <form action={enviar} className="mt-4 flex flex-col gap-3">
      <Recado estado={estado} />
      <label className="rotulo" htmlFor="premio">
        O que o campeão ganha
      </label>
      <input
        className="campo"
        id="premio"
        name="premio"
        defaultValue={premioAtual}
        placeholder="Acesso grátis às próximas 3 lives + nome lido ao vivo"
      />
      <button className="botao botao-secundario self-start" type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar prêmio"}
      </button>
    </form>
  );
}

export function FormularioCategoria({ liveId }: { liveId: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    criarCategoriaDoBolao.bind(null, liveId),
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <Recado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1.4fr_0.6fr]">
        <div>
          <label className="rotulo" htmlFor="nome">
            Categoria
          </label>
          <input
            className="campo"
            id="nome"
            name="nome"
            placeholder="Men's Open"
            required
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="fecha_em">
            Palpites fecham em
          </label>
          <input
            className="campo"
            id="fecha_em"
            name="fecha_em"
            type="datetime-local"
            required
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="ordem">
            Ordem
          </label>
          <input className="campo" id="ordem" name="ordem" inputMode="numeric" placeholder="0" />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-texto-apagado">
        Horário de <strong>Brasília</strong>. Ponha a hora em que a categoria
        começa a ser julgada — depois disso ninguém mais muda o palpite.
      </p>

      <button className="botao self-start" type="submit" disabled={enviando}>
        {enviando ? "Criando…" : "Criar categoria"}
      </button>
    </form>
  );
}

/** Campo de horário exato de fechamento, já em horário de Brasília. */
export function FormularioFechamento({
  categoriaId,
  fechaEm,
}: {
  categoriaId: string;
  fechaEm: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    mudarFechamentoDoBolao.bind(null, categoriaId),
    null,
  );

  // O input datetime-local não aceita fuso: precisa do relógio de Brasília
  // escrito como "2026-09-26T22:00".
  const emBrasilia = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(fechaEm))
    .replace(" ", "T");

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <Recado estado={estado} />
      <label className="rotulo" htmlFor="fecha_em">
        Ou marque outro horário (Brasília)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="campo max-w-56"
          id="fecha_em"
          name="fecha_em"
          type="datetime-local"
          defaultValue={emBrasilia}
          required
        />
        <button
          className="botao botao-secundario"
          type="submit"
          disabled={enviando}
        >
          {enviando ? "Salvando…" : "Salvar horário"}
        </button>
      </div>
    </form>
  );
}

export function FormularioPremioDaCategoria({
  categoriaId,
  premioAtual,
}: {
  categoriaId: string;
  premioAtual: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    salvarPremioDaCategoria.bind(null, categoriaId),
    null,
  );

  return (
    <form action={enviar} className="mt-4 flex flex-col gap-3">
      <Recado estado={estado} />
      <label className="rotulo" htmlFor="premio">
        O que o campeão desta categoria leva
      </label>
      <input
        className="campo"
        id="premio"
        name="premio"
        defaultValue={premioAtual}
        placeholder="R$ 200 no Pix + nome lido ao vivo"
      />
      <p className="text-xs leading-relaxed text-texto-apagado">
        Anuncie antes de abrir a venda e não mude depois. Prêmio que muda
        conforme o quanto foi arrecadado não é prêmio anunciado — é outra
        coisa, e é justamente o que a gente não vai fazer.
      </p>
      <button className="botao botao-secundario self-start" type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar prêmio"}
      </button>
    </form>
  );
}

export function FormularioTicketDoBolao({ categoriaId }: { categoriaId: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    criarTicketDoBolao.bind(null, categoriaId),
    null,
  );

  return (
    <form action={enviar} className="mt-4 flex flex-col gap-3">
      <Recado estado={estado} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="rotulo" htmlFor="preco">
            Preço do ticket
          </label>
          <input
            className="campo max-w-32"
            id="preco"
            name="preco"
            inputMode="decimal"
            placeholder="5,00"
            required
          />
        </div>
        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? "Criando…" : "Criar ticket"}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-texto-apagado">
        Vale só para esta categoria e <strong>não abre a transmissão</strong>.
        Aparece à venda na página do bolão, ao lado dela.
      </p>
    </form>
  );
}

export function FormularioAtletas({
  categoriaId,
  listaAtual,
}: {
  categoriaId: string;
  listaAtual: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    salvarAtletas.bind(null, categoriaId),
    null,
  );

  return (
    <form action={enviar} className="mt-4 flex flex-col gap-3">
      <Recado estado={estado} />
      <label className="rotulo" htmlFor="atletas">
        Um atleta por linha
      </label>
      <textarea
        className="campo min-h-56 font-mono text-sm"
        id="atletas"
        name="atletas"
        defaultValue={listaAtual}
        placeholder={"Derek Lunsford\nHadi Choopan\nNick Walker\nSamson Dauda\nAndrew Jacked"}
      />
      <p className="text-xs leading-relaxed text-texto-apagado">
        A ordem que você colar é a ordem que aparece na lista de escolha. Depois
        que alguém palpitar, dá para acrescentar nomes, mas não tirar.
      </p>
      <button className="botao self-start" type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar lista"}
      </button>
    </form>
  );
}

export function FormularioResultado({
  categoriaId,
  atletas,
  resultadoAtual,
}: {
  categoriaId: string;
  atletas: BolaoAtleta[];
  resultadoAtual: string[];
}) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    definirResultado.bind(null, categoriaId),
    null,
  );

  const posicoes = ["1º", "2º", "3º", "4º", "5º"];

  return (
    <form action={enviar} className="mt-4 flex flex-col gap-3">
      <Recado estado={estado} />

      {posicoes.map((rotulo, indice) => (
        <div key={rotulo} className="flex items-center gap-3">
          <span className="numero w-8 shrink-0 text-sm font-bold text-texto-apagado">
            {rotulo}
          </span>
          <select
            className="campo flex-1"
            name={`atleta_${indice + 1}`}
            aria-label={`${rotulo} lugar`}
            defaultValue={resultadoAtual[indice] ?? ""}
            required
          >
            <option value="">Escolha…</option>
            {atletas.map((atleta) => (
              <option key={atleta.id} value={atleta.id}>
                {atleta.nome}
              </option>
            ))}
          </select>
        </div>
      ))}

      <p className="text-xs leading-relaxed text-texto-apagado">
        Publicar recalcula o ranking na hora, para todo mundo. Dá para corrigir
        depois, se a organização mudar o resultado.
      </p>

      <button className="botao self-start" type="submit" disabled={enviando}>
        {enviando ? "Publicando…" : "Publicar resultado"}
      </button>
    </form>
  );
}
