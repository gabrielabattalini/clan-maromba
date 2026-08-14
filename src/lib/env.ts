// Catálogo central das variáveis de ambiente da plataforma.
// Nenhum valor é exportado daqui — apenas nomes e situação (definida ou não),
// para que a página /status nunca vaze um segredo.

export type VarInfo = {
  nome: string;
  descricao: string;
  fase: 0 | 1;
};

export const VARIAVEIS: VarInfo[] = [
  {
    nome: "NEXT_PUBLIC_SITE_URL",
    descricao: "Endereço público do site (ex.: https://clanmaromba.vercel.app)",
    fase: 0,
  },
  {
    nome: "NEXT_PUBLIC_SUPABASE_URL",
    descricao: "URL do projeto no Supabase",
    fase: 0,
  },
  {
    nome: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    descricao: "Chave pública (publishable/anon) do Supabase",
    fase: 0,
  },
  {
    nome: "SUPABASE_SERVICE_ROLE_KEY",
    descricao: "Chave secreta (secret/service_role) do Supabase — só no servidor",
    fase: 0,
  },
  {
    nome: "CLOUDFLARE_ACCOUNT_ID",
    descricao: "ID da conta Cloudflare",
    fase: 0,
  },
  {
    nome: "CLOUDFLARE_API_TOKEN",
    descricao: "Token de API da Cloudflare com permissão de Stream",
    fase: 0,
  },
  {
    nome: "CLOUDFLARE_STREAM_CUSTOMER_CODE",
    descricao: "Código de cliente do Stream (subdomínio customer-XXXX)",
    fase: 0,
  },
  {
    nome: "MP_ACCESS_TOKEN",
    descricao: "Access Token do Mercado Pago (TEST- em teste, APP_USR- em produção)",
    fase: 0,
  },
  {
    nome: "MP_WEBHOOK_SECRET",
    descricao: "Assinatura secreta do webhook do Mercado Pago",
    fase: 1,
  },
  {
    nome: "CLOUDFLARE_STREAM_SIGNING_KEY_ID",
    descricao: "ID da chave que assina os tokens de reprodução (gerada em /admin/configuracao)",
    fase: 1,
  },
  {
    nome: "CLOUDFLARE_STREAM_SIGNING_KEY_JWK",
    descricao: "Chave secreta que assina os tokens de reprodução (gerada em /admin/configuracao)",
    fase: 1,
  },
];

export function definida(nome: string): boolean {
  const valor = process.env[nome];
  return typeof valor === "string" && valor.trim().length > 0;
}
