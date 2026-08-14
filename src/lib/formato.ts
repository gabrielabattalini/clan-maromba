// Formatação de textos exibidos ao público — sempre em pt-BR.

export function precoEmReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * Lê "2026-09-18" sem passar pelo `new Date`.
 *
 * `new Date("2026-09-18")` é interpretado como meia-noite em UTC, o que no
 * Brasil cai no dia 17 — o clássico erro de um dia a menos. Como aqui a data
 * é um dia do calendário (não um instante), ler os números direto do texto é
 * o certo.
 */
function partesDoDia(iso: string): { dia: number; mes: number; ano: number } | null {
  const achado = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!achado) return null;
  return { ano: Number(achado[1]), mes: Number(achado[2]), dia: Number(achado[3]) };
}

/** "21:00:00" → "21h"; "21:30:00" → "21h30". */
function horaLegivel(hora: string): string {
  const achado = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!achado) return hora;
  const minutos = achado[2]!;
  return minutos === "00" ? `${Number(achado[1])}h` : `${Number(achado[1])}h${minutos}`;
}

type QuandoAcontecem = {
  dia_inicio: string | null;
  dia_fim: string | null;
  hora: string | null;
};

/**
 * Frase de quando a live acontece, aceitando tudo em aberto.
 *
 *   (nada)                       → "Data a definir"
 *   18/09                        → "18 de setembro"
 *   18/09 às 21h                 → "18 de setembro, a partir das 21h"
 *   18/09 a 21/09                → "18 a 21 de setembro"
 *   28/09 a 02/10                → "28 de setembro a 2 de outubro"
 */
export function quandoAcontece(live: QuandoAcontecem): string {
  const inicio = live.dia_inicio ? partesDoDia(live.dia_inicio) : null;
  const complemento = live.hora ? `, a partir das ${horaLegivel(live.hora)}` : "";

  if (!inicio) {
    return live.hora ? `Data a definir${complemento}` : "Data a definir";
  }

  const fim = live.dia_fim ? partesDoDia(live.dia_fim) : null;
  const anoAtual = new Date().getFullYear();
  const mesmoDia =
    !fim || (fim.dia === inicio.dia && fim.mes === inicio.mes && fim.ano === inicio.ano);

  const comAno = (p: { dia: number; mes: number; ano: number }, forcar = false) =>
    `${p.dia} de ${MESES[p.mes - 1]}${p.ano !== anoAtual || forcar ? ` de ${p.ano}` : ""}`;

  let texto: string;
  if (mesmoDia) {
    texto = comAno(inicio);
  } else if (fim!.mes === inicio.mes && fim!.ano === inicio.ano) {
    texto = `${inicio.dia} a ${comAno(fim!)}`;
  } else {
    const anosDiferentes = inicio.ano !== fim!.ano;
    texto = `${comAno(inicio, anosDiferentes)} a ${comAno(fim!)}`;
  }

  return texto + complemento;
}

export function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Transforma "Treino de Peito #3" em "treino-de-peito-3". */
export function gerarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Uma janela de acesso em horário de Brasília.
 *
 * Aqui o `new Date` é o certo: `inicia_em` e `termina_em` são instantes
 * (timestamptz), não dias de calendário — o contrário do caso de
 * `quandoAcontece`. E é sempre em horário do Brasil, porque é onde o
 * comprador está, mesmo quando o evento é fora.
 */
export function janelaLegivel(inicia: string | null, termina: string | null): string {
  if (!inicia && !termina) return "Vale a transmissão inteira";

  const marcar = (iso: string) => {
    const d = new Date(iso);
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
    return {
      dia: `${p("day")}/${p("month")}`,
      hora: `${p("hour")}h${p("minute") === "00" ? "" : p("minute")}`,
    };
  };

  if (inicia && termina) {
    const a = marcar(inicia);
    const b = marcar(termina);
    return a.dia === b.dia
      ? `${a.dia}, das ${a.hora} às ${b.hora}`
      : `${a.dia} às ${a.hora} → ${b.dia} às ${b.hora}`;
  }

  const only = marcar((inicia ?? termina)!);
  return inicia ? `A partir de ${only.dia}, ${only.hora}` : `Até ${only.dia}, ${only.hora}`;
}

/** Mostra só o começo do IP na marca d'água (ex.: "189.40.x.x"). */
export function ipResumido(ip: string | null): string {
  if (!ip) return "ip desconhecido";
  const partes = ip.split(".");
  if (partes.length === 4) return `${partes[0]}.${partes[1]}.x.x`;
  return ip.slice(0, 12);
}
