// Leitura central das variáveis de ambiente.
// Nada aqui quebra o build quando uma chave está faltando: as páginas
// checam `xConfigurado` e mostram um aviso amigável em vez de dar erro.

function ler(nome: string): string {
  return process.env[nome]?.trim() ?? "";
}

export const SUPABASE_URL = ler("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_CHAVE_PUBLICA = ler("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SUPABASE_CHAVE_SECRETA = ler("SUPABASE_SERVICE_ROLE_KEY");

export const CF_CONTA = ler("CLOUDFLARE_ACCOUNT_ID");
export const CF_TOKEN = ler("CLOUDFLARE_API_TOKEN");
export const CF_CODIGO_CLIENTE = ler("CLOUDFLARE_STREAM_CUSTOMER_CODE");
export const CF_CHAVE_ASSINATURA_ID = ler("CLOUDFLARE_STREAM_SIGNING_KEY_ID");
export const CF_CHAVE_ASSINATURA_JWK = ler("CLOUDFLARE_STREAM_SIGNING_KEY_JWK");

export const MP_TOKEN = ler("MP_ACCESS_TOKEN");
export const MP_SEGREDO_WEBHOOK = ler("MP_WEBHOOK_SECRET");

/** Login e banco disponíveis (Passo 2 da Fase 0). */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_CHAVE_PUBLICA);

/** Escrita no banco pelo servidor (necessária para compras e admin). */
export const supabaseServidorConfigurado = Boolean(SUPABASE_URL && SUPABASE_CHAVE_SECRETA);

/** Criação de lives no Cloudflare Stream (Passo 4 da Fase 0). */
export const cloudflareConfigurado = Boolean(CF_CONTA && CF_TOKEN && CF_CODIGO_CLIENTE);

/** Tokens de reprodução assinados (chave criada na Fase 1). */
export const assinaturaConfigurada = Boolean(
  CF_CHAVE_ASSINATURA_ID && CF_CHAVE_ASSINATURA_JWK,
);

/** Cobrança pelo Mercado Pago (Passo 3 da Fase 0). */
export const mercadoPagoConfigurado = Boolean(MP_TOKEN);

/**
 * Endereço público do site. Usado nos retornos do Checkout Pro, que exige
 * HTTPS. Se `NEXT_PUBLIC_SITE_URL` não estiver preenchida, caímos no
 * endereço que a própria Vercel injeta no deploy.
 */
export function enderecoDoSite(): string {
  const configurado = ler("NEXT_PUBLIC_SITE_URL");
  if (configurado) return configurado.replace(/\/$/, "");

  const producao = ler("VERCEL_PROJECT_PRODUCTION_URL");
  if (producao) return `https://${producao}`;

  const deploy = ler("VERCEL_URL");
  if (deploy) return `https://${deploy}`;

  return "http://localhost:3000";
}
