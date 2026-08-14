// Formato dos dados que circulam entre banco, páginas e rotas.

export type EstadoFormulario = { erro?: string; aviso?: string } | null;

export type ChaveAssinaturaGerada = {
  erro?: string;
  id?: string;
  jwk?: string;
} | null;

export type EstadoLive = "rascunho" | "anunciada" | "no_ar" | "encerrada";

export type StatusCompra = "pendente" | "aprovada" | "recusada" | "reembolsada";

export type Live = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  /** "2026-09-18" — opcional: dá para anunciar sem saber a data. */
  dia_inicio: string | null;
  /** "2026-09-21" — só quando o evento passa de um dia. */
  dia_fim: string | null;
  /** "21:00:00" — opcional, quando o horário já está definido. */
  hora: string | null;
  preco_centavos: number;
  estado: EstadoLive;
  criado_em: string;
};

export type LivePrivado = {
  live_id: string;
  cf_input_uid: string | null;
  cf_rtmps_url: string | null;
  cf_stream_key: string | null;
  atualizado_em: string;
};

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  admin: boolean;
  banido: boolean;
  criado_em: string;
};

export type Compra = {
  id: string;
  usuario_id: string;
  live_id: string;
  status: StatusCompra;
  valor_centavos: number;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

export const ROTULO_ESTADO: Record<EstadoLive, string> = {
  rascunho: "Rascunho",
  anunciada: "Anunciada",
  no_ar: "No ar",
  encerrada: "Encerrada",
};

export const ROTULO_STATUS_COMPRA: Record<StatusCompra, string> = {
  pendente: "Aguardando pagamento",
  aprovada: "Pago",
  recusada: "Recusado",
  reembolsada: "Reembolsado",
};
