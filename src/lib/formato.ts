// Formatação de textos exibidos ao público — sempre em pt-BR.

export function precoEmReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function dataPorExtenso(iso: string | null): string {
  if (!iso) return "Data a definir";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
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

/** Mostra só o começo do IP na marca d'água (ex.: "189.40.x.x"). */
export function ipResumido(ip: string | null): string {
  if (!ip) return "ip desconhecido";
  const partes = ip.split(".");
  if (partes.length === 4) return `${partes[0]}.${partes[1]}.x.x`;
  return ip.slice(0, 12);
}
