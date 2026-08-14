/**
 * Para onde o site pode mandar alguém depois de entrar ou se cadastrar.
 *
 * O endereço vem da barra do navegador (`?voltar=...`), então é entrada de
 * estranho: sem esta peneira, um link como
 * `.../entrar?voltar=/\site-falso.com` levaria a pessoa para fora do site
 * logo depois de digitar a senha — o golpe clássico de phishing, com a
 * credibilidade emprestada do nosso domínio.
 *
 * Só passa caminho interno. Em especial:
 * - `//site.com` e `/\site.com` são endereços de OUTRO site (o navegador
 *   normaliza a barra invertida para barra), então os dois são recusados;
 * - qualquer coisa que não comece com `/` também é recusada.
 */
export function destinoSeguro(valor: unknown): string {
  const texto = typeof valor === "string" ? valor.trim() : "";

  if (!texto.startsWith("/")) return "/";
  if (texto.startsWith("//") || texto.startsWith("/\\")) return "/";
  // Caracteres de controle e espaço servem para driblar a checagem acima
  // (ex.: "/\t/site-falso.com"), então nenhum deles passa.
  if (/[\u0000-\u0020]/.test(texto)) return "/";

  return texto;
}
