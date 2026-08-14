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
  /** Texto livre do prêmio do bolão. Vazio = não anuncia prêmio. */
  bolao_premio: string;
  chat_ligado: boolean;
  /** Segundos que cada pessoa espera entre mensagens. 0 = sem espera. */
  chat_modo_lento: number;
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

export type Ingresso = {
  id: string;
  live_id: string;
  nome: string;
  descricao: string;
  preco_centavos: number;
  /** Preço "de", para o corte. Só existe se foi preço realmente praticado. */
  preco_cheio_centavos: number | null;
  /** Quando a promoção acaba de verdade e o preço sobe. */
  promocao_ate: string | null;
  /** Janela de acesso. Os dois nulos = passe completo. */
  inicia_em: string | null;
  termina_em: string | null;
  limite: number | null;
  /** Dá direito ao bolão e NÃO ao vídeo. */
  so_bolao: boolean;
  ordem: number;
  ativo: boolean;
  criado_em: string;
};

/** O ingresso somado ao que só se sabe consultando as vendas e o relógio. */
export type IngressoNaVitrine = {
  ingresso: Ingresso;
  /** O que o comprador paga AGORA — sobe sozinho quando a promoção vence. */
  precoAgora: number;
  emPromocao: boolean;
  vendidos: number;
  restam: number | null;
  esgotado: boolean;
  /** Já comprado por quem está olhando. */
  jaTenho: boolean;
};

export type BolaoCategoria = {
  id: string;
  live_id: string;
  nome: string;
  /** Depois deste instante o palpite tranca. */
  fecha_em: string;
  ordem: number;
  criado_em: string;
};

export type BolaoAtleta = {
  id: string;
  categoria_id: string;
  nome: string;
  ordem: number;
};

/** As cinco posições, do 1º ao 5º. Serve para palpite e para resultado. */
export type TopCinco = [string, string, string, string, string];

export type BolaoPalpite = {
  id: string;
  categoria_id: string;
  usuario_id: string;
  atleta_1: string;
  atleta_2: string;
  atleta_3: string;
  atleta_4: string;
  atleta_5: string;
  criado_em: string;
  atualizado_em: string;
};

export type BolaoResultado = {
  categoria_id: string;
  atleta_1: string;
  atleta_2: string;
  atleta_3: string;
  atleta_4: string;
  atleta_5: string;
  publicado_em: string;
};

/** Uma linha da classificação, já somada e ordenada. */
export type LinhaDoRanking = {
  usuarioId: string;
  apelido: string;
  pontos: number;
  /** Quantas posições exatas acertou — primeiro critério de desempate. */
  exatos: number;
  /** Primeiro envio; desempata quem empatou em tudo. */
  desde: string;
};

export type MensagemChat = {
  id: number;
  live_id: string;
  usuario_id: string;
  apelido: string;
  do_dono: boolean;
  texto: string;
  apagada: boolean;
  criado_em: string;
};

/** O que o navegador recebe do chat — sem e-mail, sem nome completo. */
export type MensagemNaTela = {
  id: number;
  usuarioId: string;
  apelido: string;
  /** Mensagem do dono do canal, destacada no chat. */
  doDono: boolean;
  texto: string;
  criadoEm: string;
};

export type Compra = {
  id: string;
  usuario_id: string;
  live_id: string;
  ingresso_id: string | null;
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
